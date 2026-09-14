import { Inject, Injectable } from '@nestjs/common';
import type { DomainException, ExceptionCode, ExceptionStatus } from '@recon/domain';
import type { AuditLogEntry, ExceptionStore, ExecutedActionResult, PendingEvaluation } from '../exceptionStore';
import { PrismaService } from '../prisma.service';

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

  async claimWebhook(provider: string, eventId: string, orgId: string): Promise<boolean> {
    try {
      await this.prisma.webhookReceipt.create({ data: { provider, eventId, orgId } });
      return true;
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') return false;
      throw error;
    }
  }

  async releaseWebhook(provider: string, eventId: string): Promise<void> {
    await this.prisma.webhookReceipt.deleteMany({ where: { provider, eventId } });
  }

  async get(exceptionId: string): Promise<DomainException | undefined> {
    const record = await this.prisma.exceptionRecord.findUnique({ where: { id: exceptionId } });
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

  async listOpen(orgId: string): Promise<DomainException[]> {
    const records = await this.prisma.exceptionRecord.findMany({ where: { orgId, status: 'open' } });
    return records.map(toDomainException);
  }

  async savePendingEvaluation(evaluation: PendingEvaluation): Promise<void> {
    await this.prisma.pendingEvaluation.upsert({
      where: { id: evaluation.id },
      create: {
        id: evaluation.id,
        kind: evaluation.kind,
        dueAt: new Date(evaluation.dueAt),
        payload: evaluation as object,
      },
      update: {
        kind: evaluation.kind,
        dueAt: new Date(evaluation.dueAt),
        payload: evaluation as object,
      },
    });
  }

  async listDueEvaluations(now: Date): Promise<PendingEvaluation[]> {
    const records = await this.prisma.pendingEvaluation.findMany({
      where: { dueAt: { lte: now } },
      orderBy: { dueAt: 'asc' },
    });
    return records.map((record) => record.payload as unknown as PendingEvaluation);
  }

  async deletePendingEvaluation(evaluationId: string): Promise<void> {
    await this.prisma.pendingEvaluation.deleteMany({ where: { id: evaluationId } });
  }

  async getExecutedAction(idempotencyKey: string): Promise<ExecutedActionResult | undefined> {
    const record = await this.prisma.executedAction.findUnique({ where: { idempotencyKey } });
    return record ? (record.result as unknown as ExecutedActionResult) : undefined;
  }

  async saveExecutedAction(idempotencyKey: string, exceptionId: string, result: ExecutedActionResult): Promise<void> {
    await this.prisma.executedAction.create({
      data: { idempotencyKey, exceptionId, result: result as object },
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
    const records = await this.prisma.auditLogEntry.findMany({ where: { orgId }, orderBy: { at: 'asc' } });
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
