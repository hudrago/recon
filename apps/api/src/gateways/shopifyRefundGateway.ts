import { Injectable } from '@nestjs/common';
import type { RefundGateway, RefundGatewayRequest, RefundGatewayResult } from '../refundGateway';

interface ShopifyGraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

interface OrderTransactionNode {
  id: string;
  kind: string;
  status: string;
  gateway: string;
}

interface OrderTransactionsResponse {
  order: { currencyCode: string; transactions: OrderTransactionNode[] } | null;
}

interface RefundCreateResponse {
  refundCreate: {
    refund: { id: string } | null;
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

// Real Shopify Admin GraphQL integration for a Dev Dashboard custom app (created after Jan 2026
// — these no longer get a static shpat_ token). Uses the OAuth client credentials grant to fetch
// a short-lived (~24h) access token, cached and refreshed automatically. See
// https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens
//
// As of API version 2026-04, refundCreate also requires the idempotency key as a literal in the
// @idempotent directive (not a GraphQL variable), so it's string-embedded via JSON.stringify.
@Injectable()
export class ShopifyRefundGateway implements RefundGateway {
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

  async createRefund(request: RefundGatewayRequest): Promise<RefundGatewayResult> {
    if (request.orgId !== this.orgId) throw new Error('Shopify installation is not mapped to this organization');
    const orderGid = toOrderGid(request.orderId);
    const parentTransaction = await this.findRefundableTransaction(orderGid, request.currency);
    const idempotencyKeyLiteral = JSON.stringify(request.idempotencyKey);

    const query = `
      mutation CreateRefund($input: RefundInput!) {
        refundCreate(input: $input) @idempotent(key: ${idempotencyKeyLiteral}) {
          refund { id }
          userErrors { field message }
        }
      }
    `;
    const variables = {
      input: {
        orderId: orderGid,
        transactions: [
          {
            orderId: orderGid,
            parentId: parentTransaction.id,
            kind: 'REFUND',
            gateway: parentTransaction.gateway,
            amount: request.amount.toFixed(2),
          },
        ],
      },
    };

    const result = await this.graphql<RefundCreateResponse>(query, variables);
    const { refund, userErrors } = result.refundCreate;
    if (userErrors.length > 0) {
      throw new Error(`Shopify refundCreate failed: ${userErrors.map((error) => error.message).join('; ')}`);
    }
    if (!refund) {
      throw new Error('Shopify refundCreate returned no refund and no userErrors');
    }

    return { refundId: refund.id };
  }

  private async findRefundableTransaction(orderGid: string, approvedCurrency: string): Promise<{ id: string; gateway: string }> {
    const query = `
      query OrderTransactions($id: ID!) {
        order(id: $id) {
          currencyCode
          transactions(first: 10) {
            id kind status gateway
          }
        }
      }
    `;
    const result = await this.graphql<OrderTransactionsResponse>(query, { id: orderGid });
    if (result.order?.currencyCode !== approvedCurrency) {
      throw new Error(`Approved currency ${approvedCurrency} does not match Shopify order currency ${result.order?.currencyCode ?? 'unknown'}`);
    }
    const parent = result.order.transactions
      .filter((transaction) => (transaction.kind === 'SALE' || transaction.kind === 'CAPTURE') && transaction.status === 'SUCCESS')
      .sort((left, right) => BigInt(left.id.split('/').at(-1)!) < BigInt(right.id.split('/').at(-1)!) ? -1 : 1)[0];
    if (!parent) {
      throw new Error(`No refundable transaction found on order ${orderGid}`);
    }
    return parent;
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
    const accessToken = await this.getAccessToken();
    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken,
      },
      body: JSON.stringify({ query, variables }),
    });

    const body = (await response.json()) as ShopifyGraphQLResponse<T>;
    if (!response.ok || (body.errors && body.errors.length > 0)) {
      const message = body.errors?.map((error) => error.message).join('; ') ?? response.statusText;
      throw new Error(`Shopify GraphQL request failed: ${message}`);
    }
    if (!body.data) {
      throw new Error('Shopify GraphQL response missing data');
    }
    return body.data;
  }
}
