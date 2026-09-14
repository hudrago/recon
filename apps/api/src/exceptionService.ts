import { Inject, Injectable } from '@nestjs/common';
import type { DomainException, Invoice, InventoryAdjustment, Order, Refund, ReturnRecord, Shipment } from '@recon/domain';
import {
  DELIVERY_STALLED_THRESHOLD_MS,
  evaluateDeliveryStalled,
  evaluateInvoiceMissing,
  evaluateRefundMissing,
  evaluateRestockMissing,
  INVOICE_MISSING_THRESHOLD_MS,
  REFUND_MISSING_THRESHOLD_MS,
  RESTOCK_MISSING_THRESHOLD_MS,
} from '@recon/domain';
import { EXCEPTION_STORE, type AuditLogEntry, type ExceptionStore, type ExecutedActionResult, type PendingEvaluation } from './exceptionStore';
import { REFUND_GATEWAY, type RefundGateway } from './refundGateway';

export type { AuditLogEntry } from './exceptionStore';

export interface RefundActionRequest {
  idempotencyKey: string;
  exceptionId: string;
  orderId: string;
  amount: number;
  currency: string;
}

// Business logic only — all storage goes through the injected ExceptionStore (in-memory for
// tests/local dev, Postgres via Prisma in production). See exceptionStore.ts.
@Injectable()
export class ExceptionService {
  constructor(
    @Inject(EXCEPTION_STORE) private readonly store: ExceptionStore,
    @Inject(REFUND_GATEWAY) private readonly refundGateway: RefundGateway,
  ) {}

  async claimWebhook(provider: string, eventId: string, orgId: string): Promise<boolean> {
    return this.store.claimWebhook(provider, eventId, orgId);
  }

  async releaseWebhook(provider: string, eventId: string): Promise<void> {
    await this.store.releaseWebhook(provider, eventId);
  }

  // Re-ingesting the same return (duplicate webhook) must not create a duplicate exception.
  async ingestReturn(returnRecord: ReturnRecord, refunds: Refund[], now: Date): Promise<DomainException | null> {
    return this.ingestEvaluation(
      {
        id: `REFUND_MISSING:${returnRecord.id}`,
        dueAt: new Date(new Date(returnRecord.receivedAt).getTime() + REFUND_MISSING_THRESHOLD_MS).toISOString(),
        kind: 'refund-missing',
        returnRecord,
        refunds,
      },
      now,
    );
  }

  // Re-ingesting the same order (duplicate webhook) must not create a duplicate exception.
  async ingestOrder(order: Order, invoices: Invoice[], now: Date): Promise<DomainException | null> {
    return this.ingestEvaluation(
      {
        id: `INVOICE_MISSING:${order.id}`,
        dueAt: new Date(new Date(order.paidAt).getTime() + INVOICE_MISSING_THRESHOLD_MS).toISOString(),
        kind: 'invoice-missing',
        order,
        invoices,
      },
      now,
    );
  }

  // Re-ingesting the same refund (duplicate webhook) must not create a duplicate exception.
  async ingestRefund(refund: Refund, adjustments: InventoryAdjustment[], now: Date): Promise<DomainException | null> {
    return this.ingestEvaluation(
      {
        id: `RESTOCK_MISSING:${refund.id}`,
        dueAt: new Date(new Date(refund.issuedAt).getTime() + RESTOCK_MISSING_THRESHOLD_MS).toISOString(),
        kind: 'restock-missing',
        refund,
        adjustments,
      },
      now,
    );
  }

  // Re-ingesting the same shipment status (duplicate webhook) must not create a duplicate exception.
  async ingestShipment(shipment: Shipment, now: Date): Promise<DomainException | null> {
    return this.ingestEvaluation(
      {
        id: `DELIVERY_STALLED:${shipment.id}`,
        dueAt: new Date(new Date(shipment.lastStatusChangeAt).getTime() + DELIVERY_STALLED_THRESHOLD_MS).toISOString(),
        kind: 'delivery-stalled',
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

  private async ingestEvaluation(evaluation: PendingEvaluation, now: Date): Promise<DomainException | null> {
    const exception = this.evaluate(evaluation, now);
    if (now < new Date(evaluation.dueAt)) {
      await this.store.savePendingEvaluation(evaluation);
    } else {
      await this.store.deletePendingEvaluation(evaluation.id);
    }
    return exception ? this.recordException(exception) : null;
  }

  private evaluate(evaluation: PendingEvaluation, now: Date): DomainException | null {
    switch (evaluation.kind) {
      case 'refund-missing':
        return evaluateRefundMissing({ returnRecord: evaluation.returnRecord, refunds: evaluation.refunds, now });
      case 'invoice-missing':
        return evaluateInvoiceMissing({ order: evaluation.order, invoices: evaluation.invoices, now });
      case 'restock-missing':
        return evaluateRestockMissing({ refund: evaluation.refund, adjustments: evaluation.adjustments, now });
      case 'delivery-stalled':
        return evaluateDeliveryStalled({ shipment: evaluation.shipment, now });
    }
  }

  private async recordException(exception: DomainException): Promise<DomainException> {
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
  async getException(exceptionId: string): Promise<DomainException | undefined> {
    return this.store.get(exceptionId);
  }

  async approve(exceptionId: string): Promise<void> {
    const exception = await this.requireException(exceptionId);
    await this.store.save({ ...exception, status: 'approved' });
  }

  async dismiss(exceptionId: string, actor: string, reason: string): Promise<void> {
    const exception = await this.requireException(exceptionId);
    const after: DomainException = { ...exception, status: 'dismissed' };
    await this.store.save(after);
    await this.store.appendAuditLog({ orgId: exception.orgId, actor, reason, before: exception, after, at: new Date().toISOString() });
  }

  // Only runs once approved; replaying the same idempotencyKey never issues a second refund.
  async executeRefund(request: RefundActionRequest, actor: string): Promise<ExecutedActionResult> {
    const existing = await this.store.getExecutedAction(request.idempotencyKey);
    if (existing) return existing;

    const exception = await this.requireException(request.exceptionId);
    if (exception.status !== 'approved') {
      throw new Error(`Exception ${request.exceptionId} is not approved for action`);
    }

    const result: ExecutedActionResult = await this.refundGateway.createRefund({
      orderId: request.orderId,
      amount: request.amount,
      currency: request.currency,
      idempotencyKey: request.idempotencyKey,
    });
    await this.store.saveExecutedAction(request.idempotencyKey, request.exceptionId, result);

    const after: DomainException = { ...exception, status: 'resolved' };
    await this.store.save(after);
    await this.store.appendAuditLog({
      orgId: exception.orgId,
      actor,
      reason: `Executed REFUND_MISSING remediation for order ${request.orderId}`,
      before: exception,
      after,
      at: new Date().toISOString(),
    });

    return result;
  }

  async getAuditLog(orgId: string): Promise<AuditLogEntry[]> {
    return this.store.getAuditLog(orgId);
  }

  private async requireException(exceptionId: string): Promise<DomainException> {
    const exception = await this.store.get(exceptionId);
    if (!exception) throw new Error(`Unknown exception: ${exceptionId}`);
    return exception;
  }
}
