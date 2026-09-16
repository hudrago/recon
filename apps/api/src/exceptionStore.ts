import type { DomainException, Invoice, InventoryAdjustment, Order, Refund, ReturnRecord, Shipment } from '@recon/domain';

export type PendingEvaluation =
  | { id: string; dueAt: string; kind: 'refund-missing'; returnRecord: ReturnRecord; refunds: Refund[] }
  | { id: string; dueAt: string; kind: 'invoice-missing'; order: Order; invoices: Invoice[] }
  | { id: string; dueAt: string; kind: 'restock-missing'; refund: Refund; adjustments: InventoryAdjustment[] }
  | { id: string; dueAt: string; kind: 'delivery-stalled'; shipment: Shipment };

export interface ExecutedActionResult {
  refundId: string;
}

export type ActionClaim =
  | { status: 'claimed' }
  | { status: 'in_progress' }
  | { status: 'succeeded'; result: ExecutedActionResult };

export interface AuditLogEntry {
  orgId: string;
  actor: string;
  reason: string;
  before: unknown;
  after: unknown;
  at: string;
}

// NestJS DI token — ExceptionStore is an interface, so there's no class to bind a provider to directly.
export const EXCEPTION_STORE = Symbol('EXCEPTION_STORE');

export interface ExceptionStore {
  claimWebhook(
    provider: string,
    eventId: string,
    orgId: string,
  ): Promise<boolean>;
  completeWebhook(provider: string, eventId: string): Promise<void>;
  releaseWebhook(provider: string, eventId: string): Promise<void>;
  get(exceptionId: string): Promise<DomainException | undefined>;
  save(exception: DomainException): Promise<void>;
  saveWithAudit(
    exception: DomainException,
    entry: AuditLogEntry,
  ): Promise<void>;
  listOpen(orgId: string): Promise<DomainException[]>;
  savePendingEvaluation(evaluation: PendingEvaluation): Promise<void>;
  listDueEvaluations(now: Date): Promise<PendingEvaluation[]>;
  deletePendingEvaluation(evaluationId: string): Promise<void>;
  saveRefund(refund: Refund): Promise<void>;
  listRefunds(orgId: string, orderId: string): Promise<Refund[]>;
  cancelPendingRefundEvaluation(orgId: string, orderId: string): Promise<void>;
  findRefundMissing(
    orgId: string,
    orderId: string,
  ): Promise<DomainException | undefined>;
  saveInvoice(invoice: Invoice): Promise<void>;
  listInvoices(orgId: string, orderId: string): Promise<Invoice[]>;
  cancelPendingInvoiceEvaluation(orgId: string, orderId: string): Promise<void>;
  findInvoiceMissing(
    orgId: string,
    orderId: string,
  ): Promise<DomainException | undefined>;
  claimAction(
    idempotencyKey: string,
    exceptionId: string,
    orgId: string,
    orderId: string,
  ): Promise<ActionClaim>;
  completeAction(
    idempotencyKey: string,
    result: ExecutedActionResult,
    refund: Refund,
    exception: DomainException,
    entry: AuditLogEntry,
  ): Promise<void>;
  failAction(idempotencyKey: string, error: string): Promise<void>;
  appendAuditLog(entry: AuditLogEntry): Promise<void>;
  getAuditLog(orgId: string): Promise<AuditLogEntry[]>;
}
