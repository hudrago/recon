import { Inject, Injectable } from '@nestjs/common';
import type {
  DomainException,
  ExceptionCode,
  ExceptionStatus,
  Invoice,
  InventoryAdjustment,
  Refund,
  Shipment,
  ShipmentStatus,
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
import { PrismaService } from "../prisma.service";

interface ExceptionRecordRow {
  id: string;
  orgId: string;
  code: string;
  orderId: string;
  detectedAt: Date;
  status: string;
  context: unknown;
}

function toDomainException(record: ExceptionRecordRow): DomainException {
  return {
    id: record.id,
    orgId: record.orgId,
    code: record.code as ExceptionCode,
    orderId: record.orderId,
    detectedAt: record.detectedAt.toISOString(),
    status: record.status as ExceptionStatus,
    context: (record.context as Record<string, unknown>) ?? {},
  };
}

// Real Postgres-backed store. NOT exercised by an automated test in this repo yet — there is no
// live Postgres instance in the dev sandbox this was written in. Verify against a real database
// (see docker-compose.yml) before trusting this in production.
@Injectable()
export class PrismaExceptionStore implements ExceptionStore {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async claimWebhook(
    provider: string,
    eventId: string,
    orgId: string,
  ): Promise<boolean> {
    try {
      await this.prisma.webhookReceipt.create({
        data: { provider, eventId, orgId, status: "PROCESSING" },
      });
      return true;
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2002"
      ) {
        const reclaimed = await this.prisma.webhookReceipt.updateMany({
          where: {
            provider,
            eventId,
            orgId,
            status: "PROCESSING",
            updatedAt: { lte: new Date(Date.now() - 5 * 60 * 1000) },
          },
          data: { status: "PROCESSING" },
        });
        return reclaimed.count === 1;
      }
      throw error;
    }
  }

  async completeWebhook(provider: string, eventId: string): Promise<void> {
    await this.prisma.webhookReceipt.update({
      where: { provider_eventId: { provider, eventId } },
      data: { status: "SUCCEEDED" },
    });
  }

  async releaseWebhook(provider: string, eventId: string): Promise<void> {
    await this.prisma.webhookReceipt.deleteMany({
      where: { provider, eventId },
    });
  }

  async get(exceptionId: string): Promise<DomainException | undefined> {
    const record = await this.prisma.exceptionRecord.findUnique({
      where: { id: exceptionId },
    });
    return record ? toDomainException(record) : undefined;
  }

  async save(exception: DomainException): Promise<void> {
    await this.prisma.exceptionRecord.upsert({
      where: { id: exception.id },
      create: {
        id: exception.id,
        orgId: exception.orgId,
        code: exception.code,
        orderId: exception.orderId,
        detectedAt: new Date(exception.detectedAt),
        status: exception.status,
        context: exception.context as object,
      },
      update: {
        status: exception.status,
        context: exception.context as object,
      },
    });
  }

  async saveWithAudit(
    exception: DomainException,
    entry: AuditLogEntry,
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.exceptionRecord.upsert({
        where: { id: exception.id },
        create: {
          id: exception.id,
          orgId: exception.orgId,
          code: exception.code,
          orderId: exception.orderId,
          detectedAt: new Date(exception.detectedAt),
          status: exception.status,
          context: exception.context as object,
        },
        update: {
          status: exception.status,
          context: exception.context as object,
        },
      }),
      this.prisma.auditLogEntry.create({
        data: {
          orgId: entry.orgId,
          exceptionId: entry.exceptionId,
          actor: entry.actor,
          reason: entry.reason,
          before: entry.before as object,
          after: entry.after as object,
          at: new Date(entry.at),
        },
      }),
    ]);
  }

  async listOpen(orgId: string): Promise<DomainException[]> {
    const records = await this.prisma.exceptionRecord.findMany({
      where: { orgId, status: "open" },
    });
    return records.map(toDomainException);
  }

  async savePendingEvaluation(evaluation: PendingEvaluation): Promise<void> {
    const orgId =
      "returnRecord" in evaluation
        ? evaluation.returnRecord.orgId
        : "order" in evaluation
          ? evaluation.order.orgId
          : "refund" in evaluation
            ? evaluation.refund.orgId
            : evaluation.shipment.orgId;
    await this.prisma.pendingEvaluation.upsert({
      where: { id: evaluation.id },
      create: {
        id: evaluation.id,
        orgId,
        kind: evaluation.kind,
        dueAt: new Date(evaluation.dueAt),
        payload: evaluation as object,
      },
      update: {
        orgId,
        kind: evaluation.kind,
        dueAt: new Date(evaluation.dueAt),
        payload: evaluation as object,
      },
    });
  }

  async listDueEvaluations(now: Date): Promise<PendingEvaluation[]> {
    const records = await this.prisma.pendingEvaluation.findMany({
      where: { dueAt: { lte: now } },
      orderBy: { dueAt: "asc" },
    });
    return records.map(
      (record) => record.payload as unknown as PendingEvaluation,
    );
  }

  async deletePendingEvaluation(evaluationId: string): Promise<void> {
    await this.prisma.pendingEvaluation.deleteMany({
      where: { id: evaluationId },
    });
  }

  async saveRefund(refund: Refund): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.refundRecord.upsert({
        where: { orgId_id: { orgId: refund.orgId, id: refund.id } },
        create: { ...refund, issuedAt: new Date(refund.issuedAt) },
        update: {
          orderId: refund.orderId,
          amount: refund.amount,
          currency: refund.currency,
          issuedAt: new Date(refund.issuedAt),
        },
      }),
      this.prisma.executedAction.createMany({
        data: [
          {
            idempotencyKey: `observed-refund:${refund.id}`,
            exceptionId: `observed-refund:${refund.orgId}:${refund.orderId}`,
            orgId: refund.orgId,
            orderId: refund.orderId,
            actionKind: "REFUND",
            status: "SUCCEEDED",
            result: { kind: "REFUND", refundId: refund.id },
          },
        ],
        skipDuplicates: true,
      }),
    ]);
  }

  async listRefunds(orgId: string, orderId: string): Promise<Refund[]> {
    const records = await this.prisma.refundRecord.findMany({
      where: { orgId, orderId },
    });
    return records.map((record) => ({
      ...record,
      issuedAt: record.issuedAt.toISOString(),
    }));
  }

  async cancelPendingRefundEvaluation(
    orgId: string,
    orderId: string,
  ): Promise<void> {
    const records = await this.prisma.pendingEvaluation.findMany({
      where: { orgId, kind: "refund-missing" },
    });
    const ids = records
      .filter((record) => {
        const evaluation = record.payload as unknown as PendingEvaluation;
        return (
          evaluation.kind === "refund-missing" &&
          evaluation.returnRecord.orgId === orgId &&
          evaluation.returnRecord.orderId === orderId
        );
      })
      .map((record) => record.id);
    if (ids.length > 0)
      await this.prisma.pendingEvaluation.deleteMany({
        where: { id: { in: ids } },
      });
  }

  async findRefundMissing(
    orgId: string,
    orderId: string,
  ): Promise<DomainException | undefined> {
    const record = await this.prisma.exceptionRecord.findFirst({
      where: { orgId, orderId, code: "REFUND_MISSING" },
    });
    return record ? toDomainException(record) : undefined;
  }

  async cancelPendingInvoiceEvaluation(
    orgId: string,
    orderId: string,
  ): Promise<void> {
    const records = await this.prisma.pendingEvaluation.findMany({
      where: { orgId, kind: "invoice-missing" },
    });
    const ids = records
      .filter((record) => {
        const evaluation = record.payload as unknown as PendingEvaluation;
        return (
          evaluation.kind === "invoice-missing" &&
          evaluation.order.orgId === orgId &&
          evaluation.order.id === orderId
        );
      })
      .map((record) => record.id);
    if (ids.length > 0)
      await this.prisma.pendingEvaluation.deleteMany({
        where: { id: { in: ids } },
      });
  }

  async findInvoiceMissing(
    orgId: string,
    orderId: string,
  ): Promise<DomainException | undefined> {
    const record = await this.prisma.exceptionRecord.findFirst({
      where: { orgId, orderId, code: "INVOICE_MISSING" },
    });
    return record ? toDomainException(record) : undefined;
  }

  async saveInvoice(invoice: Invoice): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.invoiceRecord.upsert({
        where: { orgId_id: { orgId: invoice.orgId, id: invoice.id } },
        create: { ...invoice, issuedAt: new Date(invoice.issuedAt) },
        update: {
          orderId: invoice.orderId,
          issuedAt: new Date(invoice.issuedAt),
        },
      }),
      this.prisma.executedAction.createMany({
        data: [
          {
            idempotencyKey: `observed-invoice:${invoice.id}`,
            exceptionId: `observed-invoice:${invoice.orgId}:${invoice.orderId}`,
            orgId: invoice.orgId,
            orderId: invoice.orderId,
            actionKind: "INVOICE",
            status: "SUCCEEDED",
            result: { kind: "INVOICE", invoiceId: invoice.id },
          },
        ],
        skipDuplicates: true,
      }),
    ]);
  }

  async listInvoices(orgId: string, orderId: string): Promise<Invoice[]> {
    const records = await this.prisma.invoiceRecord.findMany({
      where: { orgId, orderId },
    });
    return records.map((record) => ({
      ...record,
      issuedAt: record.issuedAt.toISOString(),
    }));
  }

  async saveAdjustment(adjustment: InventoryAdjustment): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.inventoryAdjustmentRecord.upsert({
        where: { orgId_id: { orgId: adjustment.orgId, id: adjustment.id } },
        create: { ...adjustment, adjustedAt: new Date(adjustment.adjustedAt) },
        update: {
          orderId: adjustment.orderId,
          refundId: adjustment.refundId,
          quantity: adjustment.quantity,
          adjustedAt: new Date(adjustment.adjustedAt),
        },
      }),
      this.prisma.executedAction.createMany({
        data: [
          {
            idempotencyKey: `observed-restock:${adjustment.id}`,
            exceptionId: `observed-restock:${adjustment.orgId}:${adjustment.orderId}`,
            orgId: adjustment.orgId,
            orderId: adjustment.orderId,
            actionKind: "RESTOCK",
            status: "SUCCEEDED",
            result: { kind: "RESTOCK", adjustmentId: adjustment.id },
          },
        ],
        skipDuplicates: true,
      }),
    ]);
  }

  async listAdjustments(
    orgId: string,
    orderId: string,
  ): Promise<InventoryAdjustment[]> {
    const records = await this.prisma.inventoryAdjustmentRecord.findMany({
      where: { orgId, orderId },
    });
    return records.map((record) => ({
      ...record,
      adjustedAt: record.adjustedAt.toISOString(),
    }));
  }

  async saveShipment(shipment: Shipment): Promise<void> {
    await this.prisma.shipmentRecord.upsert({
      where: { orgId_id: { orgId: shipment.orgId, id: shipment.id } },
      create: {
        ...shipment,
        lastStatusChangeAt: new Date(shipment.lastStatusChangeAt),
      },
      update: {
        orderId: shipment.orderId,
        status: shipment.status,
        lastStatusChangeAt: new Date(shipment.lastStatusChangeAt),
      },
    });
  }

  async listActiveShipments(): Promise<Shipment[]> {
    const records = await this.prisma.shipmentRecord.findMany({
      where: { status: { notIn: [...TERMINAL_SHIPMENT_STATUSES] } },
    });
    return records.map((record) => ({
      ...record,
      status: record.status as ShipmentStatus,
      lastStatusChangeAt: record.lastStatusChangeAt.toISOString(),
    }));
  }

  async claimAction(
    idempotencyKey: string,
    exceptionId: string,
    orgId: string,
    orderId: string,
    actionKind: ActionKind,
  ): Promise<ActionClaim> {
    try {
      await this.prisma.executedAction.create({
        data: {
          idempotencyKey,
          exceptionId,
          orgId,
          orderId,
          actionKind,
          status: "PENDING",
        },
      });
      return { status: "claimed" };
    } catch (error) {
      if (
        !(
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === "P2002"
        )
      )
        throw error;
    }

    const retried = await this.prisma.executedAction.updateMany({
      where: {
        idempotencyKey,
        exceptionId,
        OR: [
          { status: "FAILED" },
          {
            status: "PENDING",
            updatedAt: { lte: new Date(Date.now() - 5 * 60 * 1000) },
          },
        ],
      },
      data: { status: "PENDING", error: null, attempts: { increment: 1 } },
    });
    if (retried.count === 1) return { status: "claimed" };

    const action = await this.prisma.executedAction.findUnique({
      where: { idempotencyKey },
    });
    if (action && action.exceptionId !== exceptionId)
      throw new Error("Idempotency key belongs to another exception");
    if (action?.status === "SUCCEEDED" && action.result) {
      return {
        status: "succeeded",
        result: action.result as unknown as ExecutedActionResult,
      };
    }
    const reserved = await this.prisma.executedAction.findFirst({
      where: { orgId, orderId, actionKind },
    });
    if (reserved?.status === "SUCCEEDED" && reserved.result) {
      return {
        status: "succeeded",
        result: reserved.result as unknown as ExecutedActionResult,
      };
    }
    return { status: "in_progress" };
  }

  async completeAction(
    idempotencyKey: string,
    exception: DomainException,
    sideEffect: ActionSideEffect,
    entry: AuditLogEntry,
  ): Promise<void> {
    const result = actionResultFromSideEffect(sideEffect);
    const sideEffectWrite =
      sideEffect.kind === "REFUND"
        ? this.prisma.refundRecord.upsert({
            where: {
              orgId_id: {
                orgId: sideEffect.refund.orgId,
                id: sideEffect.refund.id,
              },
            },
            create: {
              ...sideEffect.refund,
              issuedAt: new Date(sideEffect.refund.issuedAt),
            },
            update: {
              orderId: sideEffect.refund.orderId,
              amount: sideEffect.refund.amount,
              currency: sideEffect.refund.currency,
              issuedAt: new Date(sideEffect.refund.issuedAt),
            },
          })
        : sideEffect.kind === "RESTOCK"
          ? this.prisma.inventoryAdjustmentRecord.upsert({
              where: {
                orgId_id: {
                  orgId: sideEffect.adjustment.orgId,
                  id: sideEffect.adjustment.id,
                },
              },
              create: {
                ...sideEffect.adjustment,
                adjustedAt: new Date(sideEffect.adjustment.adjustedAt),
              },
              update: {
                orderId: sideEffect.adjustment.orderId,
                refundId: sideEffect.adjustment.refundId,
                quantity: sideEffect.adjustment.quantity,
                adjustedAt: new Date(sideEffect.adjustment.adjustedAt),
              },
            })
          : this.prisma.invoiceRecord.upsert({
              where: {
                orgId_id: {
                  orgId: sideEffect.invoice.orgId,
                  id: sideEffect.invoice.id,
                },
              },
              create: {
                ...sideEffect.invoice,
                issuedAt: new Date(sideEffect.invoice.issuedAt),
              },
              update: {
                orderId: sideEffect.invoice.orderId,
                issuedAt: new Date(sideEffect.invoice.issuedAt),
              },
            });
    await this.prisma.$transaction([
      this.prisma.executedAction.update({
        where: { idempotencyKey },
        data: { status: "SUCCEEDED", result: result as object, error: null },
      }),
      this.prisma.exceptionRecord.update({
        where: { id: exception.id },
        data: {
          status: exception.status,
          context: exception.context as object,
        },
      }),
      sideEffectWrite,
      this.prisma.auditLogEntry.create({
        data: {
          orgId: entry.orgId,
          exceptionId: entry.exceptionId,
          actor: entry.actor,
          reason: entry.reason,
          before: entry.before as object,
          after: entry.after as object,
          at: new Date(entry.at),
        },
      }),
    ]);
  }

  async failAction(idempotencyKey: string, error: string): Promise<void> {
    await this.prisma.executedAction.updateMany({
      where: { idempotencyKey, status: "PENDING" },
      data: { status: "FAILED", error },
    });
  }

  async appendAuditLog(entry: AuditLogEntry): Promise<void> {
    await this.prisma.auditLogEntry.create({
      data: {
        orgId: entry.orgId,
        exceptionId: entry.exceptionId,
        actor: entry.actor,
        reason: entry.reason,
        before: entry.before as object,
        after: entry.after as object,
        at: new Date(entry.at),
      },
    });
  }

  async getAuditLog(orgId: string): Promise<AuditLogEntry[]> {
    const records = await this.prisma.auditLogEntry.findMany({
      where: { orgId },
      orderBy: { at: "asc" },
    });
    return records.map((record) => ({
      orgId: record.orgId,
      exceptionId: record.exceptionId ?? undefined,
      actor: record.actor,
      reason: record.reason,
      before: record.before,
      after: record.after,
      at: record.at.toISOString(),
    }));
  }

  async getAuditLogForException(
    orgId: string,
    exceptionId: string,
  ): Promise<AuditLogEntry[]> {
    const records = await this.prisma.auditLogEntry.findMany({
      where: { orgId, exceptionId },
      orderBy: { at: "asc" },
    });
    return records.map((record) => ({
      orgId: record.orgId,
      exceptionId: record.exceptionId ?? undefined,
      actor: record.actor,
      reason: record.reason,
      before: record.before,
      after: record.after,
      at: record.at.toISOString(),
    }));
  }
}
