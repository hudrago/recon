import { Inject, Injectable } from '@nestjs/common';
import type {
  DomainException,
  ExceptionCode,
  Invoice,
  InventoryAdjustment,
  Order,
  Refund,
  ReturnRecord,
  Shipment,
} from "@recon/domain";
import {
  DELIVERY_STALLED_THRESHOLD_MS,
  evaluateDeliveryStalled,
  evaluateInvoiceMissing,
  evaluateRefundMissing,
  evaluateRestockMissing,
  INVOICE_MISSING_THRESHOLD_MS,
  REFUND_MISSING_THRESHOLD_MS,
  RESTOCK_MISSING_THRESHOLD_MS,
  TERMINAL_SHIPMENT_STATUSES,
} from "@recon/domain";
import {
  actionResultFromSideEffect,
  EXCEPTION_STORE,
  type ActionKind,
  type ActionSideEffect,
  type AuditLogEntry,
  type ExceptionStore,
  type ExecutedActionResult,
  type PendingEvaluation,
} from "./exceptionStore";
import { REFUND_GATEWAY, type RefundGateway } from "./refundGateway";
import { RESTOCK_GATEWAY, type RestockGateway } from "./restockGateway";
import { INVOICE_GATEWAY, type InvoiceGateway } from "./invoiceGateway";

export type { AuditLogEntry } from "./exceptionStore";

// The public shape of a case timeline entry — deliberately excludes the raw before/after JSON
// blobs (which can carry PII/order data) from ever reaching the browser; see getAuditLogForException.
export interface AuditLogItem {
  actor: string;
  reason: string;
  at: string;
  statusBefore?: string;
  statusAfter?: string;
  actionKind?: string;
  result?: unknown;
}

function extractStatus(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  if (typeof record.status === "string") return record.status;
  const exception = record.exception;
  if (
    exception &&
    typeof exception === "object" &&
    typeof (exception as Record<string, unknown>).status === "string"
  ) {
    return (exception as Record<string, unknown>).status as string;
  }
  return undefined;
}

function extractAction(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object") return undefined;
  const action = (value as Record<string, unknown>).action;
  return action && typeof action === "object"
    ? (action as Record<string, unknown>)
    : undefined;
}

export interface RefundActionRequest {
  exceptionId: string;
}

export interface RestockActionRequest {
  exceptionId: string;
}

export interface IssueInvoiceActionRequest {
  exceptionId: string;
}

export interface RefundApprovalTerms {
  amountMinor: number;
  currency: string;
}

export interface RestockApprovalTerms {
  quantity: number;
}

// Business logic only — all storage goes through the injected ExceptionStore (in-memory for
// tests/local dev, Postgres via Prisma in production). See exceptionStore.ts.
@Injectable()
export class ExceptionService {
  constructor(
    @Inject(EXCEPTION_STORE) private readonly store: ExceptionStore,
    @Inject(REFUND_GATEWAY) private readonly refundGateway: RefundGateway,
    @Inject(RESTOCK_GATEWAY) private readonly restockGateway: RestockGateway,
    @Inject(INVOICE_GATEWAY) private readonly invoiceGateway: InvoiceGateway,
  ) {}

  async claimWebhook(
    provider: string,
    eventId: string,
    orgId: string,
  ): Promise<boolean> {
    return this.store.claimWebhook(provider, eventId, orgId);
  }

  async releaseWebhook(provider: string, eventId: string): Promise<void> {
    await this.store.releaseWebhook(provider, eventId);
  }

  async completeWebhook(provider: string, eventId: string): Promise<void> {
    await this.store.completeWebhook(provider, eventId);
  }

  // Re-ingesting the same return (duplicate webhook) must not create a duplicate exception.
  async ingestReturn(
    returnRecord: ReturnRecord,
    refunds: Refund[],
    now: Date,
  ): Promise<DomainException | null> {
    const knownRefunds = [
      ...refunds,
      ...(await this.store.listRefunds(
        returnRecord.orgId,
        returnRecord.orderId,
      )),
    ];
    return this.ingestEvaluation(
      {
        id: `REFUND_MISSING:${returnRecord.orgId}:${returnRecord.id}`,
        dueAt: new Date(
          new Date(returnRecord.receivedAt).getTime() +
            REFUND_MISSING_THRESHOLD_MS,
        ).toISOString(),
        kind: "refund-missing",
        returnRecord,
        refunds: knownRefunds,
      },
      now,
    );
  }

  // Re-ingesting the same order (duplicate webhook) must not create a duplicate exception.
  async ingestOrder(
    order: Order,
    invoices: Invoice[],
    now: Date,
  ): Promise<DomainException | null> {
    const knownInvoices = [
      ...invoices,
      ...(await this.store.listInvoices(order.orgId, order.id)),
    ];
    return this.ingestEvaluation(
      {
        id: `INVOICE_MISSING:${order.orgId}:${order.id}`,
        dueAt: new Date(
          new Date(order.paidAt).getTime() + INVOICE_MISSING_THRESHOLD_MS,
        ).toISOString(),
        kind: "invoice-missing",
        order,
        invoices: knownInvoices,
      },
      now,
    );
  }

  // An invoice never opens its own exception — it only cancels/resolves a pending or open
  // INVOICE_MISSING for the same order, mirroring how ingestRefund resolves REFUND_MISSING.
  async ingestInvoice(invoice: Invoice, now: Date): Promise<void> {
    await this.store.saveInvoice(invoice);
    await this.store.cancelPendingInvoiceEvaluation(
      invoice.orgId,
      invoice.orderId,
    );
    const invoiceMissing = await this.store.findInvoiceMissing(
      invoice.orgId,
      invoice.orderId,
    );
    if (
      invoiceMissing &&
      (invoiceMissing.status === "open" || invoiceMissing.status === "approved")
    ) {
      const resolved = { ...invoiceMissing, status: "resolved" as const };
      await this.store.saveWithAudit(resolved, {
        orgId: invoice.orgId,
        exceptionId: invoiceMissing.id,
        actor: "system:invoicexpress-webhook",
        reason: `Observed InvoiceXpress invoice ${invoice.id}`,
        before: invoiceMissing,
        after: resolved,
        at: now.toISOString(),
      });
    }
  }

  // Re-ingesting the same refund (duplicate webhook) must not create a duplicate exception.
  async ingestRefund(
    refund: Refund,
    adjustments: InventoryAdjustment[],
    now: Date,
  ): Promise<DomainException | null> {
    await this.store.saveRefund(refund);
    // Some providers (e.g. Shopify) report a restock as part of the same refund event rather
    // than a separate inventory webhook — persist it now so it's on record before any later
    // reevaluation or restock-action attempt.
    for (const adjustment of adjustments) {
      await this.store.saveAdjustment(adjustment);
    }
    await this.store.cancelPendingRefundEvaluation(
      refund.orgId,
      refund.orderId,
    );
    const refundMissing = await this.store.findRefundMissing(
      refund.orgId,
      refund.orderId,
    );
    if (
      refundMissing &&
      (refundMissing.status === "open" || refundMissing.status === "approved")
    ) {
      const resolved = { ...refundMissing, status: "resolved" as const };
      await this.store.saveWithAudit(resolved, {
        orgId: refund.orgId,
        exceptionId: refundMissing.id,
        actor: "system:shopify-webhook",
        reason: `Observed Shopify refund ${refund.id}`,
        before: refundMissing,
        after: resolved,
        at: now.toISOString(),
      });
    }
    return this.ingestEvaluation(
      {
        id: `RESTOCK_MISSING:${refund.orgId}:${refund.id}`,
        dueAt: new Date(
          new Date(refund.issuedAt).getTime() + RESTOCK_MISSING_THRESHOLD_MS,
        ).toISOString(),
        kind: "restock-missing",
        refund,
        adjustments,
      },
      now,
    );
  }

  // Re-ingesting the same shipment status (duplicate webhook) must not create a duplicate exception.
  async ingestShipment(
    shipment: Shipment,
    now: Date,
  ): Promise<DomainException | null> {
    await this.store.saveShipment(shipment);
    if (TERMINAL_SHIPMENT_STATUSES.has(shipment.status)) {
      const exceptionId = `DELIVERY_STALLED:${shipment.orgId}:${shipment.id}`;
      const deliveryStalled = await this.store.get(exceptionId);
      if (
        deliveryStalled &&
        (deliveryStalled.status === "open" ||
          deliveryStalled.status === "approved")
      ) {
        const resolved = { ...deliveryStalled, status: "resolved" as const };
        await this.store.saveWithAudit(resolved, {
          orgId: shipment.orgId,
          exceptionId: deliveryStalled.id,
          actor: "system:carrier-tracking",
          reason: `Observed terminal shipment status ${shipment.status} for shipment ${shipment.id}`,
          before: deliveryStalled,
          after: resolved,
          at: now.toISOString(),
        });
      }
    }
    return this.ingestEvaluation(
      {
        id: `DELIVERY_STALLED:${shipment.orgId}:${shipment.id}`,
        dueAt: new Date(
          new Date(shipment.lastStatusChangeAt).getTime() +
            DELIVERY_STALLED_THRESHOLD_MS,
        ).toISOString(),
        kind: "delivery-stalled",
        shipment,
      },
      now,
    );
  }

  async reevaluatePending(now: Date): Promise<number> {
    const evaluations = await this.store.listDueEvaluations(now);
    let exceptionsDetected = 0;

    for (const evaluation of evaluations) {
      const exception = this.evaluate(evaluation, now);
      if (exception) {
        await this.recordException(exception);
        exceptionsDetected += 1;
      }
      await this.store.deletePendingEvaluation(evaluation.id);
    }

    return exceptionsDetected;
  }

  private async ingestEvaluation(
    evaluation: PendingEvaluation,
    now: Date,
  ): Promise<DomainException | null> {
    const exception = this.evaluate(evaluation, now);
    if (now < new Date(evaluation.dueAt)) {
      await this.store.savePendingEvaluation(evaluation);
    } else {
      await this.store.deletePendingEvaluation(evaluation.id);
    }
    return exception ? this.recordException(exception) : null;
  }

  private evaluate(
    evaluation: PendingEvaluation,
    now: Date,
  ): DomainException | null {
    switch (evaluation.kind) {
      case "refund-missing":
        return evaluateRefundMissing({
          returnRecord: evaluation.returnRecord,
          refunds: evaluation.refunds,
          now,
        });
      case "invoice-missing":
        return evaluateInvoiceMissing({
          order: evaluation.order,
          invoices: evaluation.invoices,
          now,
        });
      case "restock-missing":
        return evaluateRestockMissing({
          refund: evaluation.refund,
          adjustments: evaluation.adjustments,
          now,
        });
      case "delivery-stalled":
        return evaluateDeliveryStalled({ shipment: evaluation.shipment, now });
    }
  }

  private async recordException(
    exception: DomainException,
  ): Promise<DomainException> {
    const existing = await this.store.get(exception.id);
    if (existing) return existing;
    await this.store.save(exception);
    return exception;
  }

  async listOpenExceptions(orgId: string): Promise<DomainException[]> {
    return this.store.listOpen(orgId);
  }

  // Used by the HTTP layer to confirm an exception belongs to the org making the request.
  // Returns undefined rather than throwing so callers can turn a missing id into a 404, not a 500.
  async getException(
    exceptionId: string,
  ): Promise<DomainException | undefined> {
    return this.store.get(exceptionId);
  }

  async approve(
    exceptionId: string,
    actor: string,
    reason: string,
    refundTerms?: RefundApprovalTerms,
    restockTerms?: RestockApprovalTerms,
  ): Promise<void> {
    const exception = await this.requireException(exceptionId);
    if (exception.status !== "open")
      throw new Error(
        `Exception ${exceptionId} cannot be approved from ${exception.status}`,
      );
    if (exception.code === "REFUND_MISSING" && !refundTerms)
      throw new Error(
        "Refund approval requires immutable amount and currency terms",
      );
    if (exception.code === "RESTOCK_MISSING" && !restockTerms)
      throw new Error("Restock approval requires an immutable quantity");
    const context = { ...exception.context };
    if (refundTerms) context.approvedRefund = refundTerms;
    if (restockTerms) context.approvedRestock = restockTerms;
    const after: DomainException = {
      ...exception,
      status: "approved",
      context,
    };
    await this.store.saveWithAudit(after, {
      orgId: exception.orgId,
      exceptionId: exception.id,
      actor,
      reason,
      before: exception,
      after,
      at: new Date().toISOString(),
    });
  }

  async dismiss(
    exceptionId: string,
    actor: string,
    reason: string,
  ): Promise<void> {
    const exception = await this.requireException(exceptionId);
    const after: DomainException = { ...exception, status: "dismissed" };
    await this.store.saveWithAudit(after, {
      orgId: exception.orgId,
      exceptionId: exception.id,
      actor,
      reason,
      before: exception,
      after,
      at: new Date().toISOString(),
    });
  }

  // Only runs once approved; replaying the same idempotencyKey never issues a second refund.
  async executeRefund(
    request: RefundActionRequest,
    actor: string,
  ): Promise<Extract<ExecutedActionResult, { kind: "REFUND" }>> {
    const result = await this.runAction<RefundApprovalTerms>({
      exceptionId: request.exceptionId,
      actor,
      expectedCode: "REFUND_MISSING",
      actionKind: "REFUND",
      getApprovedTerms: (exception) => {
        const approvedRefund = exception.context.approvedRefund as
          | RefundApprovalTerms
          | undefined;
        if (
          !approvedRefund ||
          !Number.isSafeInteger(approvedRefund.amountMinor) ||
          approvedRefund.amountMinor <= 0 ||
          !/^[A-Z]{3}$/.test(approvedRefund.currency)
        ) {
          throw new Error(
            `Exception ${request.exceptionId} has no valid approved refund terms`,
          );
        }
        return approvedRefund;
      },
      hasExistingSideEffect: async (exception) =>
        (await this.store.listRefunds(exception.orgId, exception.orderId))
          .length > 0,
      duplicateSideEffectMessage: (exception) =>
        `Order ${exception.orderId} already has a recorded refund`,
      invoke: async (exception, terms, idempotencyKey) => {
        const gatewayResult = await this.refundGateway.createRefund({
          orderId: exception.orderId,
          amount: terms.amountMinor / 100,
          currency: terms.currency,
          idempotencyKey,
          orgId: exception.orgId,
        });
        return {
          kind: "REFUND",
          refund: {
            id: gatewayResult.refundId,
            orgId: exception.orgId,
            orderId: exception.orderId,
            amount: terms.amountMinor / 100,
            currency: terms.currency,
            issuedAt: new Date().toISOString(),
          },
        };
      },
      auditReason: (exception) =>
        `Executed REFUND_MISSING remediation for order ${exception.orderId}`,
    });
    return result as Extract<ExecutedActionResult, { kind: "REFUND" }>;
  }

  // Only runs once approved; replaying the same idempotencyKey never issues a second inventory adjustment.
  async executeRestock(
    request: RestockActionRequest,
    actor: string,
  ): Promise<Extract<ExecutedActionResult, { kind: "RESTOCK" }>> {
    const result = await this.runAction<RestockApprovalTerms>({
      exceptionId: request.exceptionId,
      actor,
      expectedCode: "RESTOCK_MISSING",
      actionKind: "RESTOCK",
      getApprovedTerms: (exception) => {
        const approvedRestock = exception.context.approvedRestock as
          | RestockApprovalTerms
          | undefined;
        if (
          !approvedRestock ||
          !Number.isSafeInteger(approvedRestock.quantity) ||
          approvedRestock.quantity <= 0
        ) {
          throw new Error(
            `Exception ${request.exceptionId} has no valid approved restock terms`,
          );
        }
        return approvedRestock;
      },
      hasExistingSideEffect: async (exception) =>
        (await this.store.listAdjustments(exception.orgId, exception.orderId))
          .length > 0,
      duplicateSideEffectMessage: (exception) =>
        `Order ${exception.orderId} already has a recorded inventory adjustment`,
      invoke: async (exception, terms, idempotencyKey) => {
        const refundId = exception.context.refundId as string | undefined;
        if (!refundId)
          throw new Error(
            `Exception ${request.exceptionId} is missing the refund it is restocking against`,
          );
        const gatewayResult = await this.restockGateway.adjustInventory({
          orderId: exception.orderId,
          quantity: terms.quantity,
          idempotencyKey,
          orgId: exception.orgId,
        });
        return {
          kind: "RESTOCK",
          adjustment: {
            id: gatewayResult.adjustmentId,
            orgId: exception.orgId,
            orderId: exception.orderId,
            refundId,
            quantity: terms.quantity,
            adjustedAt: new Date().toISOString(),
          },
        };
      },
      auditReason: (exception) =>
        `Executed RESTOCK_MISSING remediation for order ${exception.orderId}`,
    });
    return result as Extract<ExecutedActionResult, { kind: "RESTOCK" }>;
  }

  // Only runs once approved; replaying the same idempotencyKey never issues a second invoice.
  async executeIssueInvoice(
    request: IssueInvoiceActionRequest,
    actor: string,
  ): Promise<Extract<ExecutedActionResult, { kind: "INVOICE" }>> {
    const result = await this.runAction<undefined>({
      exceptionId: request.exceptionId,
      actor,
      expectedCode: "INVOICE_MISSING",
      actionKind: "INVOICE",
      getApprovedTerms: () => undefined,
      hasExistingSideEffect: async (exception) =>
        (await this.store.listInvoices(exception.orgId, exception.orderId))
          .length > 0,
      duplicateSideEffectMessage: (exception) =>
        `Order ${exception.orderId} already has a recorded invoice`,
      invoke: async (exception, _terms, idempotencyKey) => {
        const gatewayResult = await this.invoiceGateway.issueInvoice({
          orderId: exception.orderId,
          orgId: exception.orgId,
          idempotencyKey,
        });
        return {
          kind: "INVOICE",
          invoice: {
            id: gatewayResult.invoiceId,
            orgId: exception.orgId,
            orderId: exception.orderId,
            issuedAt: new Date().toISOString(),
          },
        };
      },
      auditReason: (exception) =>
        `Executed INVOICE_MISSING remediation for order ${exception.orderId}`,
    });
    return result as Extract<ExecutedActionResult, { kind: "INVOICE" }>;
  }

  // Shared action-runner: validates approval state, claims an idempotent lease, guards against a
  // side effect that was already observed out-of-band, invokes the provider, then atomically
  // persists the result, the observed record, and the audit entry. Used by every executeX method
  // so refund/restock/etc. can never diverge on idempotency or audit behavior.
  private async runAction<TTerms>(params: {
    exceptionId: string;
    actor: string;
    expectedCode: ExceptionCode;
    actionKind: ActionKind;
    getApprovedTerms: (exception: DomainException) => TTerms;
    hasExistingSideEffect: (exception: DomainException) => Promise<boolean>;
    duplicateSideEffectMessage: (exception: DomainException) => string;
    invoke: (
      exception: DomainException,
      terms: TTerms,
      idempotencyKey: string,
    ) => Promise<ActionSideEffect>;
    auditReason: (exception: DomainException) => string;
  }): Promise<ExecutedActionResult> {
    const {
      exceptionId,
      actor,
      expectedCode,
      actionKind,
      getApprovedTerms,
      hasExistingSideEffect,
      duplicateSideEffectMessage,
      invoke,
      auditReason,
    } = params;
    const exception = await this.requireException(exceptionId);
    if (exception.code !== expectedCode) {
      throw new Error(
        `Exception ${exceptionId} does not authorize this action`,
      );
    }
    if (exception.status === "open" || exception.status === "dismissed") {
      throw new Error(`Exception ${exceptionId} is not approved for action`);
    }
    const terms = getApprovedTerms(exception);

    const idempotencyKey = `${actionKind.toLowerCase()}:${exceptionId}`;
    const claim = await this.store.claimAction(
      idempotencyKey,
      exceptionId,
      exception.orgId,
      exception.orderId,
      actionKind,
    );
    if (claim.status === "succeeded") return claim.result;
    if (claim.status === "in_progress")
      throw new Error(`Action ${idempotencyKey} is already in progress`);
    if (exception.status !== "approved") {
      await this.store.failAction(
        idempotencyKey,
        `Exception ${exceptionId} is not approved for action`,
      );
      throw new Error(`Exception ${exceptionId} is not approved for action`);
    }
    if (await hasExistingSideEffect(exception)) {
      const message = duplicateSideEffectMessage(exception);
      await this.store.failAction(idempotencyKey, message);
      throw new Error(message);
    }

    let sideEffect: ActionSideEffect;
    try {
      sideEffect = await invoke(exception, terms, idempotencyKey);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown provider failure";
      await this.store.failAction(idempotencyKey, message.slice(0, 500));
      throw error;
    }

    const after: DomainException = { ...exception, status: "resolved" };
    const result = actionResultFromSideEffect(sideEffect);
    try {
      await this.store.completeAction(idempotencyKey, after, sideEffect, {
        orgId: exception.orgId,
        exceptionId: exception.id,
        actor,
        reason: auditReason(exception),
        before: exception,
        after: {
          exception: after,
          action: { idempotencyKey, orderId: exception.orderId, terms, result },
        },
        at: new Date().toISOString(),
      });
    } catch (error) {
      try {
        await this.store.failAction(
          idempotencyKey,
          `Provider succeeded but local completion failed: ${error instanceof Error ? error.message : "unknown error"}`.slice(
            0,
            500,
          ),
        );
      } catch {
        // A stale PENDING claim becomes retryable after its lease expires.
      }
      throw error;
    }

    return result;
  }

  async getAuditLog(orgId: string): Promise<AuditLogEntry[]> {
    return this.store.getAuditLog(orgId);
  }

  // Redacted for the browser: strips the raw before/after state, keeping only actor/reason/
  // timestamps/status transition/action result — see AuditLogItem.
  async getAuditLogForException(
    orgId: string,
    exceptionId: string,
  ): Promise<AuditLogItem[]> {
    const entries = await this.store.getAuditLogForException(
      orgId,
      exceptionId,
    );
    return entries.map((entry) => {
      const action = extractAction(entry.after);
      const result = action?.result;
      return {
        actor: entry.actor,
        reason: entry.reason,
        at: entry.at,
        statusBefore: extractStatus(entry.before),
        statusAfter: extractStatus(entry.after),
        actionKind:
          typeof result === "object" &&
          result !== null &&
          typeof (result as Record<string, unknown>).kind === "string"
            ? ((result as Record<string, unknown>).kind as string)
            : undefined,
        result,
      };
    });
  }

  private async requireException(
    exceptionId: string,
  ): Promise<DomainException> {
    const exception = await this.store.get(exceptionId);
    if (!exception) throw new Error(`Unknown exception: ${exceptionId}`);
    return exception;
  }
}
