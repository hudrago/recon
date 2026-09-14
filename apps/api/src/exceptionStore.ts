import type { DomainException, Invoice, InventoryAdjustment, Order, Refund, ReturnRecord, Shipment } from '@recon/domain';

export type PendingEvaluation =
  | { id: string; dueAt: string; kind: 'refund-missing'; returnRecord: ReturnRecord; refunds: Refund[] }
  | { id: string; dueAt: string; kind: 'invoice-missing'; order: Order; invoices: Invoice[] }
  | { id: string; dueAt: string; kind: 'restock-missing'; refund: Refund; adjustments: InventoryAdjustment[] }
  | { id: string; dueAt: string; kind: 'delivery-stalled'; shipment: Shipment };

export interface ExecutedActionResult {
  refundId: string;
}

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
  claimWebhook(provider: string, eventId: string, orgId: string): Promise<boolean>;
  releaseWebhook(provider: string, eventId: string): Promise<void>;
  get(exceptionId: string): Promise<DomainException | undefined>;
  save(exception: DomainException): Promise<void>;
  listOpen(orgId: string): Promise<DomainException[]>;
  savePendingEvaluation(evaluation: PendingEvaluation): Promise<void>;
  listDueEvaluations(now: Date): Promise<PendingEvaluation[]>;
  deletePendingEvaluation(evaluationId: string): Promise<void>;
  getExecutedAction(idempotencyKey: string): Promise<ExecutedActionResult | undefined>;
  saveExecutedAction(idempotencyKey: string, exceptionId: string, result: ExecutedActionResult): Promise<void>;
  appendAuditLog(entry: AuditLogEntry): Promise<void>;
  getAuditLog(orgId: string): Promise<AuditLogEntry[]>;
}
