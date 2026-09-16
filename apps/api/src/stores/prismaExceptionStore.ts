import { Inject, Injectable } from '@nestjs/common';
import type {
  DomainException,
  ExceptionCode,
  ExceptionStatus,
  Invoice,
  Refund,
} from "@recon/domain";
import type {
  ActionClaim,
  AuditLogEntry,
  ExceptionStore,
  ExecutedActionResult,
  PendingEvaluation,
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
            result: { refundId: refund.id },
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
    await this.prisma.invoiceRecord.upsert({
      where: { orgId_id: { orgId: invoice.orgId, id: invoice.id } },
      create: { ...invoice, issuedAt: new Date(invoice.issuedAt) },
      update: {
        orderId: invoice.orderId,
        issuedAt: new Date(invoice.issuedAt),
      },
    });
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

  async claimAction(
    idempotencyKey: string,
    exceptionId: string,
    orgId: string,
    orderId: string,
  ): Promise<ActionClaim> {
    try {
      await this.prisma.executedAction.create({
        data: {
          idempotencyKey,
          exceptionId,
          orgId,
          orderId,
          actionKind: "REFUND",
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
      where: { orgId, orderId, actionKind: "REFUND" },
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
    result: ExecutedActionResult,
    refund: Refund,
    exception: DomainException,
    entry: AuditLogEntry,
  ): Promise<void> {
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
      this.prisma.auditLogEntry.create({
        data: {
          orgId: entry.orgId,
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
      actor: record.actor,
      reason: record.reason,
      before: record.before,
      after: record.after,
      at: record.at.toISOString(),
    }));
  }
}
