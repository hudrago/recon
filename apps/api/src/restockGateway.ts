export interface RestockGatewayRequest {
  orgId: string;
  orderId: string;
  quantity: number;
  idempotencyKey: string;
}

export interface RestockGatewayResult {
  adjustmentId: string;
}

export interface RestockGateway {
  adjustInventory(request: RestockGatewayRequest): Promise<RestockGatewayResult>;
}

// NestJS DI token — mirrors REFUND_GATEWAY in refundGateway.ts.
export const RESTOCK_GATEWAY = Symbol('RESTOCK_GATEWAY');
