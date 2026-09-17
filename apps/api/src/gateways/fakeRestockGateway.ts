import type { RestockGateway, RestockGatewayRequest, RestockGatewayResult } from '../restockGateway';

// Used by tests and local dev without Shopify credentials — never calls a real API.
export class FakeRestockGateway implements RestockGateway {
  async adjustInventory(request: RestockGatewayRequest): Promise<RestockGatewayResult> {
    return { adjustmentId: `adjustment_${request.idempotencyKey}` };
  }
}
