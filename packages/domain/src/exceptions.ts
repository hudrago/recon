export type ExceptionCode =
  | 'REFUND_MISSING'
  | 'RESTOCK_MISSING'
  | 'INVOICE_MISSING'
  | 'DELIVERY_STALLED';

export type ExceptionStatus = 'open' | 'approved' | 'dismissed' | 'resolved';

export interface DomainException {
  id: string;
  orgId: string;
  code: ExceptionCode;
  orderId: string;
  detectedAt: string;
  status: ExceptionStatus;
  context: Record<string, unknown>;
}
