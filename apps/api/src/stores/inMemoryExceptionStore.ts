import type { DomainException, Refund } from '@recon/domain';
import type { ActionClaim, AuditLogEntry, ExceptionStore, ExecutedActionResult, PendingEvaluation } from '../exceptionStore';

// Used by tests and local dev without a database; state is lost on restart.
export class InMemoryExceptionStore implements ExceptionStore {
  private webhookReceipts = new Map<string, 'PROCESSING' | 'SUCCEEDED'>();
  private exceptions = new Map<string, DomainException>();
  private pendingEvaluations = new Map<string, PendingEvaluation>();
  private refunds = new Map<string, Refund>();
  private actions = new Map<string, { exceptionId: string; orgId: string; orderId: string; status: 'PENDING' | 'SUCCEEDED' | 'FAILED'; result?: ExecutedActionResult; error?: string }>();
  private auditLog: AuditLogEntry[] = [];

  async claimWebhook(provider: string, eventId: string, _orgId: string): Promise<boolean> {
    const key = `${provider}:${eventId}`;
    if (this.webhookReceipts.has(key)) return false;
    this.webhookReceipts.set(key, 'PROCESSING');
    return true;
  }

  async completeWebhook(provider: string, eventId: string): Promise<void> {
    this.webhookReceipts.set(`${provider}:${eventId}`, 'SUCCEEDED');
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

  async saveWithAudit(exception: DomainException, entry: AuditLogEntry): Promise<void> {
    this.exceptions.set(exception.id, exception);
    this.auditLog.push(entry);
  }

  async listOpen(orgId: string): Promise<DomainException[]> {
    return [...this.exceptions.values()].filter((exception) => exception.orgId === orgId && exception.status === 'open');
  }

  async savePendingEvaluation(evaluation: PendingEvaluation): Promise<void> {
    this.pendingEvaluations.set(evaluation.id, evaluation);
  }

  async listDueEvaluations(now: Date): Promise<PendingEvaluation[]> {
    return [...this.pendingEvaluations.values()].filter((evaluation) => new Date(evaluation.dueAt) <= now);
  }

  async deletePendingEvaluation(evaluationId: string): Promise<void> {
    this.pendingEvaluations.delete(evaluationId);
  }

  async saveRefund(refund: Refund): Promise<void> {
    this.refunds.set(`${refund.orgId}:${refund.id}`, refund);
    const reserved = [...this.actions.values()].some((action) => action.orgId === refund.orgId && action.orderId === refund.orderId);
    if (!reserved) {
      this.actions.set(`observed-refund:${refund.id}`, {
        exceptionId: `observed-refund:${refund.orgId}:${refund.orderId}`,
        orgId: refund.orgId,
        orderId: refund.orderId,
        status: 'SUCCEEDED',
        result: { refundId: refund.id },
      });
    }
  }

  async listRefunds(orgId: string, orderId: string): Promise<Refund[]> {
    return [...this.refunds.values()].filter((refund) => refund.orgId === orgId && refund.orderId === orderId);
  }

  async cancelPendingRefundEvaluation(orgId: string, orderId: string): Promise<void> {
    for (const [id, evaluation] of this.pendingEvaluations) {
      if (evaluation.kind === 'refund-missing' && evaluation.returnRecord.orgId === orgId && evaluation.returnRecord.orderId === orderId) {
        this.pendingEvaluations.delete(id);
      }
    }
  }

  async findRefundMissing(orgId: string, orderId: string): Promise<DomainException | undefined> {
    return [...this.exceptions.values()].find((exception) => exception.orgId === orgId && exception.orderId === orderId && exception.code === 'REFUND_MISSING');
  }

  async claimAction(idempotencyKey: string, exceptionId: string, orgId: string, orderId: string): Promise<ActionClaim> {
    const reserved = [...this.actions.entries()].find(([, action]) => action.orgId === orgId && action.orderId === orderId);
    if (reserved && reserved[0] !== idempotencyKey) {
      if (reserved[1].status === 'SUCCEEDED') return { status: 'succeeded', result: reserved[1].result! };
      return { status: 'in_progress' };
    }
    const action = this.actions.get(idempotencyKey);
    if (action && action.exceptionId !== exceptionId) throw new Error('Idempotency key belongs to another exception');
    if (action?.status === 'SUCCEEDED') return { status: 'succeeded', result: action.result! };
    if (action?.status === 'PENDING') return { status: 'in_progress' };
    this.actions.set(idempotencyKey, { exceptionId, orgId, orderId, status: 'PENDING' });
    return { status: 'claimed' };
  }

  async completeAction(idempotencyKey: string, result: ExecutedActionResult, refund: Refund, exception: DomainException, entry: AuditLogEntry): Promise<void> {
    const action = this.actions.get(idempotencyKey);
    if (!action) throw new Error(`Unknown action: ${idempotencyKey}`);
    this.actions.set(idempotencyKey, { ...action, status: 'SUCCEEDED', result, error: undefined });
    await this.saveRefund(refund);
    this.exceptions.set(exception.id, exception);
    this.auditLog.push(entry);
  }

  async failAction(idempotencyKey: string, error: string): Promise<void> {
    const action = this.actions.get(idempotencyKey);
    if (!action) throw new Error(`Unknown action: ${idempotencyKey}`);
    this.actions.set(idempotencyKey, { ...action, status: 'FAILED', error });
  }

  async appendAuditLog(entry: AuditLogEntry): Promise<void> {
    this.auditLog.push(entry);
  }

  async getAuditLog(orgId: string): Promise<AuditLogEntry[]> {
    return this.auditLog.filter((entry) => entry.orgId === orgId);
  }
}
