import type { RefundGateway, RefundGatewayRequest, RefundGatewayResult } from '../refundGateway';

// Used by tests and local dev without Shopify credentials — never calls a real API.
export class FakeRefundGateway implements RefundGateway {
  async createRefund(request: RefundGatewayRequest): Promise<RefundGatewayResult> {
    return { refundId: `refund_${request.idempotencyKey}` };
  }
}
