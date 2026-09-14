export interface RefundGatewayRequest {
  orderId: string;
  amount: number;
  currency: string;
  idempotencyKey: string;
}

export interface RefundGatewayResult {
  refundId: string;
}

export interface RefundGateway {
  createRefund(request: RefundGatewayRequest): Promise<RefundGatewayResult>;
}

// NestJS DI token — RefundGateway is an interface, so there's no class to bind a provider to directly.
export const REFUND_GATEWAY = Symbol('REFUND_GATEWAY');
