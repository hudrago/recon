import type {
  DomainException,
  Invoice,
  InventoryAdjustment,
  Refund,
  Shipment,
} from "@recon/domain";
import { TERMINAL_SHIPMENT_STATUSES } from "@recon/domain";
import {
  actionResultFromSideEffect,
  type ActionClaim,
  type ActionKind,
  type ActionSideEffect,
  type AuditLogEntry,
  type ExceptionStore,
  type ExecutedActionResult,
  type PendingEvaluation,
} from "../exceptionStore";

// Used by tests and local dev without a database; state is lost on restart.
export class InMemoryExceptionStore implements ExceptionStore {
  private webhookReceipts = new Map<string, "PROCESSING" | "SUCCEEDED">();
  private exceptions = new Map<string, DomainException>();
  private pendingEvaluations = new Map<string, PendingEvaluation>();
  private refunds = new Map<string, Refund>();
  private invoices = new Map<string, Invoice>();
  private adjustments = new Map<string, InventoryAdjustment>();
  private shipments = new Map<string, Shipment>();
  private actions = new Map<
    string,
    {
      exceptionId: string;
      orgId: string;
      orderId: string;
      actionKind: ActionKind;
      status: "PENDING" | "SUCCEEDED" | "FAILED";
      result?: ExecutedActionResult;
      error?: string;
    }
  >();
  private auditLog: AuditLogEntry[] = [];

  async claimWebhook(
    provider: string,
    eventId: string,
    _orgId: string,
  ): Promise<boolean> {
    const key = `${provider}:${eventId}`;
    if (this.webhookReceipts.has(key)) return false;
    this.webhookReceipts.set(key, "PROCESSING");
    return true;
  }

  async completeWebhook(provider: string, eventId: string): Promise<void> {
    this.webhookReceipts.set(`${provider}:${eventId}`, "SUCCEEDED");
  }

  async releaseWebhook(provider: string, eventId: string): Promise<void> {
    this.webhookReceipts.delete(`${provider}:${eventId}`);
  }

  async get(exceptionId: string): Promise<DomainException | undefined> {
    return this.exceptions.get(exceptionId);
  }

  async save(exception: DomainException): Promise<void> {
    this.exceptions.set(exception.id, exception);
  }

  async saveWithAudit(
    exception: DomainException,
    entry: AuditLogEntry,
  ): Promise<void> {
    this.exceptions.set(exception.id, exception);
    this.auditLog.push(entry);
  }

  async listOpen(orgId: string): Promise<DomainException[]> {
    return [...this.exceptions.values()].filter(
      (exception) => exception.orgId === orgId && exception.status === "open",
    );
  }

  async savePendingEvaluation(evaluation: PendingEvaluation): Promise<void> {
    this.pendingEvaluations.set(evaluation.id, evaluation);
  }

  async listDueEvaluations(now: Date): Promise<PendingEvaluation[]> {
    return [...this.pendingEvaluations.values()].filter(
      (evaluation) => new Date(evaluation.dueAt) <= now,
    );
  }

  async deletePendingEvaluation(evaluationId: string): Promise<void> {
    this.pendingEvaluations.delete(evaluationId);
  }

  async saveRefund(refund: Refund): Promise<void> {
    this.refunds.set(`${refund.orgId}:${refund.id}`, refund);
    const reserved = [...this.actions.values()].some(
      (action) =>
        action.orgId === refund.orgId &&
        action.orderId === refund.orderId &&
        action.actionKind === "REFUND",
    );
    if (!reserved) {
      this.actions.set(`observed-refund:${refund.id}`, {
        exceptionId: `observed-refund:${refund.orgId}:${refund.orderId}`,
        orgId: refund.orgId,
        orderId: refund.orderId,
        actionKind: "REFUND",
        status: "SUCCEEDED",
        result: { kind: "REFUND", refundId: refund.id },
      });
    }
  }

  async listRefunds(orgId: string, orderId: string): Promise<Refund[]> {
    return [...this.refunds.values()].filter(
      (refund) => refund.orgId === orgId && refund.orderId === orderId,
    );
  }

  async cancelPendingRefundEvaluation(
    orgId: string,
    orderId: string,
  ): Promise<void> {
    for (const [id, evaluation] of this.pendingEvaluations) {
      if (
        evaluation.kind === "refund-missing" &&
        evaluation.returnRecord.orgId === orgId &&
        evaluation.returnRecord.orderId === orderId
      ) {
        this.pendingEvaluations.delete(id);
      }
    }
  }

  async findRefundMissing(
    orgId: string,
    orderId: string,
  ): Promise<DomainException | undefined> {
    return [...this.exceptions.values()].find(
      (exception) =>
        exception.orgId === orgId &&
        exception.orderId === orderId &&
        exception.code === "REFUND_MISSING",
    );
  }

  async cancelPendingInvoiceEvaluation(
    orgId: string,
    orderId: string,
  ): Promise<void> {
    for (const [id, evaluation] of this.pendingEvaluations) {
      if (
        evaluation.kind === "invoice-missing" &&
        evaluation.order.orgId === orgId &&
        evaluation.order.id === orderId
      ) {
        this.pendingEvaluations.delete(id);
      }
    }
  }

  async findInvoiceMissing(
    orgId: string,
    orderId: string,
  ): Promise<DomainException | undefined> {
    return [...this.exceptions.values()].find(
      (exception) =>
        exception.orgId === orgId &&
        exception.orderId === orderId &&
        exception.code === "INVOICE_MISSING",
    );
  }

  async saveInvoice(invoice: Invoice): Promise<void> {
    this.invoices.set(`${invoice.orgId}:${invoice.id}`, invoice);
    const reserved = [...this.actions.values()].some(
      (action) =>
        action.orgId === invoice.orgId &&
        action.orderId === invoice.orderId &&
        action.actionKind === "INVOICE",
    );
    if (!reserved) {
      this.actions.set(`observed-invoice:${invoice.id}`, {
        exceptionId: `observed-invoice:${invoice.orgId}:${invoice.orderId}`,
        orgId: invoice.orgId,
        orderId: invoice.orderId,
        actionKind: "INVOICE",
        status: "SUCCEEDED",
        result: { kind: "INVOICE", invoiceId: invoice.id },
      });
    }
  }

  async listInvoices(orgId: string, orderId: string): Promise<Invoice[]> {
    return [...this.invoices.values()].filter(
      (invoice) => invoice.orgId === orgId && invoice.orderId === orderId,
    );
  }

  async saveAdjustment(adjustment: InventoryAdjustment): Promise<void> {
    this.adjustments.set(`${adjustment.orgId}:${adjustment.id}`, adjustment);
    const reserved = [...this.actions.values()].some(
      (action) =>
        action.orgId === adjustment.orgId &&
        action.orderId === adjustment.orderId &&
        action.actionKind === "RESTOCK",
    );
    if (!reserved) {
      this.actions.set(`observed-restock:${adjustment.id}`, {
        exceptionId: `observed-restock:${adjustment.orgId}:${adjustment.orderId}`,
        orgId: adjustment.orgId,
        orderId: adjustment.orderId,
        actionKind: "RESTOCK",
        status: "SUCCEEDED",
        result: { kind: "RESTOCK", adjustmentId: adjustment.id },
      });
    }
  }

  async listAdjustments(
    orgId: string,
    orderId: string,
  ): Promise<InventoryAdjustment[]> {
    return [...this.adjustments.values()].filter(
      (adjustment) =>
        adjustment.orgId === orgId && adjustment.orderId === orderId,
    );
  }

  async saveShipment(shipment: Shipment): Promise<void> {
    this.shipments.set(`${shipment.orgId}:${shipment.id}`, shipment);
  }

  async listActiveShipments(): Promise<Shipment[]> {
    return [...this.shipments.values()].filter(
      (shipment) => !TERMINAL_SHIPMENT_STATUSES.has(shipment.status),
    );
  }

  async claimAction(
    idempotencyKey: string,
    exceptionId: string,
    orgId: string,
    orderId: string,
    actionKind: ActionKind,
  ): Promise<ActionClaim> {
    const reserved = [...this.actions.entries()].find(
      ([, action]) =>
        action.orgId === orgId &&
        action.orderId === orderId &&
        action.actionKind === actionKind,
    );
    if (reserved && reserved[0] !== idempotencyKey) {
      if (reserved[1].status === "SUCCEEDED")
        return { status: "succeeded", result: reserved[1].result! };
      return { status: "in_progress" };
    }
    const action = this.actions.get(idempotencyKey);
    if (action && action.exceptionId !== exceptionId)
      throw new Error("Idempotency key belongs to another exception");
    if (action?.status === "SUCCEEDED")
      return { status: "succeeded", result: action.result! };
    if (action?.status === "PENDING") return { status: "in_progress" };
    this.actions.set(idempotencyKey, {
      exceptionId,
      orgId,
      orderId,
      actionKind,
      status: "PENDING",
    });
    return { status: "claimed" };
  }

  async completeAction(
    idempotencyKey: string,
    exception: DomainException,
    sideEffect: ActionSideEffect,
    entry: AuditLogEntry,
  ): Promise<void> {
    const action = this.actions.get(idempotencyKey);
    if (!action) throw new Error(`Unknown action: ${idempotencyKey}`);
    const result = actionResultFromSideEffect(sideEffect);
    this.actions.set(idempotencyKey, {
      ...action,
      status: "SUCCEEDED",
      result,
      error: undefined,
    });
    if (sideEffect.kind === "REFUND") await this.saveRefund(sideEffect.refund);
    else if (sideEffect.kind === "RESTOCK")
      await this.saveAdjustment(sideEffect.adjustment);
    else await this.saveInvoice(sideEffect.invoice);
    this.exceptions.set(exception.id, exception);
    this.auditLog.push(entry);
  }

  async failAction(idempotencyKey: string, error: string): Promise<void> {
    const action = this.actions.get(idempotencyKey);
    if (!action) throw new Error(`Unknown action: ${idempotencyKey}`);
    this.actions.set(idempotencyKey, { ...action, status: "FAILED", error });
  }

  async appendAuditLog(entry: AuditLogEntry): Promise<void> {
    this.auditLog.push(entry);
  }

  async getAuditLog(orgId: string): Promise<AuditLogEntry[]> {
    return this.auditLog.filter((entry) => entry.orgId === orgId);
  }

  async getAuditLogForException(
    orgId: string,
    exceptionId: string,
  ): Promise<AuditLogEntry[]> {
    return this.auditLog.filter(
      (entry) => entry.orgId === orgId && entry.exceptionId === exceptionId,
    );
  }
}
