export interface InvoiceGatewayRequest {
  orgId: string;
  orderId: string;
  idempotencyKey: string;
}

export interface InvoiceGatewayResult {
  invoiceId: string;
}

export interface InvoiceGateway {
  issueInvoice(request: InvoiceGatewayRequest): Promise<InvoiceGatewayResult>;
}

// NestJS DI token — mirrors REFUND_GATEWAY/RESTOCK_GATEWAY.
export const INVOICE_GATEWAY = Symbol('INVOICE_GATEWAY');
