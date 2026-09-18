import type { DomainException, Invoice, InventoryAdjustment, Order, Refund, ReturnRecord, Shipment } from '@recon/domain';

export type PendingEvaluation =
  | { id: string; dueAt: string; kind: 'refund-missing'; returnRecord: ReturnRecord; refunds: Refund[] }
  | { id: string; dueAt: string; kind: 'invoice-missing'; order: Order; invoices: Invoice[] }
  | { id: string; dueAt: string; kind: 'restock-missing'; refund: Refund; adjustments: InventoryAdjustment[] }
  | { id: string; dueAt: string; kind: 'delivery-stalled'; shipment: Shipment };

// Every executable remediation kind. Each has its own idempotency-scoped action row so a refund
// and a restock on the same order never collide, even though they share the (orgId, orderId) key.
export type ActionKind = 'REFUND' | 'RESTOCK' | 'INVOICE';

export type ExecutedActionResult =
  | { kind: 'REFUND'; refundId: string }
  | { kind: 'RESTOCK'; adjustmentId: string }
  | { kind: 'INVOICE'; invoiceId: string };

// The domain record an action's completion persists, tagged so the store can route it to the
// right table without the service layer knowing storage details.
export type ActionSideEffect =
  | { kind: 'REFUND'; refund: Refund }
  | { kind: 'RESTOCK'; adjustment: InventoryAdjustment }
  | { kind: 'INVOICE'; invoice: Invoice };

export function actionResultFromSideEffect(sideEffect: ActionSideEffect): ExecutedActionResult {
  switch (sideEffect.kind) {
    case 'REFUND':
      return { kind: 'REFUND', refundId: sideEffect.refund.id };
    case 'RESTOCK':
      return { kind: 'RESTOCK', adjustmentId: sideEffect.adjustment.id };
    case 'INVOICE':
      return { kind: 'INVOICE', invoiceId: sideEffect.invoice.id };
  }
}

export type ActionClaim =
  | { status: 'claimed' }
  | { status: 'in_progress' }
  | { status: 'succeeded'; result: ExecutedActionResult };

export interface AuditLogEntry {
  orgId: string;
  exceptionId?: string;
  actor: string;
  reason: string;
  // Provenance of `reason` text — defaults to 'human' at the store layer when omitted. Only
  // approve/dismiss ever set 'ai-draft'/'ai-edited'; every other audit entry (webhook
  // resolutions, executed-action results) is system-authored text, tracked as 'human' here since
  // it was never AI-drafted.
  reasonSource?: "human" | "ai-draft" | "ai-edited";
  before: unknown;
  after: unknown;
  at: string;
}

// A cached AI-generated case brief — see aiGateway.ts and ai/buildBriefInput.ts. `inputHash` is
// the cache key (sha256 of the redacted input + prompt version) so reopening a case with no new
// audit activity never re-bills a model call.
export interface CaseBrief {
  orgId: string;
  exceptionId: string;
  locale: string;
  summary: string;
  recommendation: string;
  rationale: string;
  modelId: string;
  promptVersion: string;
  inputHash: string;
  generatedAt: string;
}

// NestJS DI token — ExceptionStore is an interface, so there's no class to bind a provider to directly.
export const EXCEPTION_STORE = Symbol("EXCEPTION_STORE");

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
  saveAdjustment(adjustment: InventoryAdjustment): Promise<void>;
  listAdjustments(
    orgId: string,
    orderId: string,
  ): Promise<InventoryAdjustment[]>;
  saveShipment(shipment: Shipment): Promise<void>;
  listActiveShipments(): Promise<Shipment[]>;
  claimAction(
    idempotencyKey: string,
    exceptionId: string,
    orgId: string,
    orderId: string,
    actionKind: ActionKind,
  ): Promise<ActionClaim>;
  completeAction(
    idempotencyKey: string,
    exception: DomainException,
    sideEffect: ActionSideEffect,
    entry: AuditLogEntry,
  ): Promise<void>;
  failAction(idempotencyKey: string, error: string): Promise<void>;
  appendAuditLog(entry: AuditLogEntry): Promise<void>;
  getAuditLog(orgId: string): Promise<AuditLogEntry[]>;
  getAuditLogForException(
    orgId: string,
    exceptionId: string,
  ): Promise<AuditLogEntry[]>;
  getCaseBrief(
    orgId: string,
    exceptionId: string,
    locale: string,
  ): Promise<CaseBrief | undefined>;
  saveCaseBrief(brief: CaseBrief): Promise<void>;
}

