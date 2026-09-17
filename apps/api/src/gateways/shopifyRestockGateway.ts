import { Injectable } from '@nestjs/common';
import type { RestockGateway, RestockGatewayRequest, RestockGatewayResult } from '../restockGateway';

interface ShopifyGraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

interface OrderLineItemsResponse {
  order: { lineItems: { edges: Array<{ node: { variant: { inventoryItem: { id: string } } | null } }> } } | null;
}

interface LocationsResponse {
  locations: { edges: Array<{ node: { id: string } }> };
}

interface InventoryAdjustResponse {
  inventoryAdjustQuantities: {
    inventoryAdjustmentGroup: { id: string } | null;
    userErrors: Array<{ field: string[] | null; message: string }>;
  };
}

interface AccessTokenResponse {
  access_token: string;
  expires_in: number;
}

function toOrderGid(orderId: string): string {
  return orderId.startsWith('gid://shopify/Order/') ? orderId : `gid://shopify/Order/${orderId}`;
}

// Real Shopify Admin GraphQL integration, same OAuth client credentials grant as
// ShopifyRefundGateway. NOT YET VERIFIED against a real multi-item order — adjusts only the
// FIRST line item's inventory item, at the shop's first location, which is correct for a
// single-SKU return but needs revisiting before trusting it on an order with several SKUs.
@Injectable()
export class ShopifyRestockGateway implements RestockGateway {
  private readonly apiUrl: string;
  private readonly tokenUrl: string;
  private cachedToken: { value: string; expiresAt: number } | null = null;

  constructor(
    private readonly orgId: string,
    private readonly shopDomain: string,
    private readonly clientId: string,
    private readonly clientSecret: string,
  ) {
    this.apiUrl = `https://${shopDomain}/admin/api/2026-07/graphql.json`;
    this.tokenUrl = `https://${shopDomain}/admin/oauth/access_token`;
  }

  async adjustInventory(request: RestockGatewayRequest): Promise<RestockGatewayResult> {
    if (request.orgId !== this.orgId) throw new Error('Shopify installation is not mapped to this organization');
    const orderGid = toOrderGid(request.orderId);
    const inventoryItemId = await this.findInventoryItem(orderGid);
    const locationId = await this.findPrimaryLocation();
    const idempotencyKeyLiteral = JSON.stringify(request.idempotencyKey);

    const query = `
      mutation AdjustInventory($input: InventoryAdjustQuantitiesInput!) {
        inventoryAdjustQuantities(input: $input) @idempotent(key: ${idempotencyKeyLiteral}) {
          inventoryAdjustmentGroup { id }
          userErrors { field message }
        }
      }
    `;
    const variables = {
      input: {
        reason: 'restock',
        name: 'available',
        changes: [{ inventoryItemId, locationId, delta: request.quantity }],
      },
    };

    const result = await this.graphql<InventoryAdjustResponse>(query, variables);
    const { inventoryAdjustmentGroup, userErrors } = result.inventoryAdjustQuantities;
    if (userErrors.length > 0) {
      throw new Error(`Shopify inventoryAdjustQuantities failed: ${userErrors.map((error) => error.message).join('; ')}`);
    }
    if (!inventoryAdjustmentGroup) {
      throw new Error('Shopify inventoryAdjustQuantities returned no adjustment group and no userErrors');
    }
    return { adjustmentId: inventoryAdjustmentGroup.id };
  }

  private async findInventoryItem(orderGid: string): Promise<string> {
    const query = `
      query OrderLineItems($id: ID!) {
        order(id: $id) {
          lineItems(first: 1) {
            edges { node { variant { inventoryItem { id } } } }
          }
        }
      }
    `;
    const result = await this.graphql<OrderLineItemsResponse>(query, { id: orderGid });
    const inventoryItemId = result.order?.lineItems.edges[0]?.node.variant?.inventoryItem.id;
    if (!inventoryItemId) throw new Error(`No inventory item found on order ${orderGid}`);
    return inventoryItemId;
  }

  private async findPrimaryLocation(): Promise<string> {
    const query = `
      query PrimaryLocation {
        locations(first: 1) {
          edges { node { id } }
        }
      }
    `;
    const result = await this.graphql<LocationsResponse>(query, {});
    const locationId = result.locations.edges[0]?.node.id;
    if (!locationId) throw new Error('No Shopify location found for this shop');
    return locationId;
  }

  // Refreshes 60s before actual expiry so an in-flight request never gets a token that expires
  // mid-call.
  private async getAccessToken(): Promise<string> {
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now() + 60_000) {
      return this.cachedToken.value;
    }

    const response = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: this.clientId, client_secret: this.clientSecret, grant_type: 'client_credentials' }),
    });
    if (!response.ok) {
      throw new Error(`Shopify token exchange failed: ${response.status} ${response.statusText}`);
    }
    const body = (await response.json()) as AccessTokenResponse;
    this.cachedToken = { value: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
    return this.cachedToken.value;
  }

  private async graphql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
    const token = await this.getAccessToken();
    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
      body: JSON.stringify({ query, variables }),
    });
    if (!response.ok) {
      throw new Error(`Shopify GraphQL request failed: ${response.status} ${response.statusText}`);
    }
    const body = (await response.json()) as ShopifyGraphQLResponse<T>;
    if (body.errors && body.errors.length > 0) {
      throw new Error(`Shopify GraphQL errors: ${body.errors.map((error) => error.message).join('; ')}`);
    }
    if (!body.data) throw new Error('Shopify GraphQL response missing data');
    return body.data;
  }
}
