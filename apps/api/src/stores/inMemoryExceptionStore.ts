import type { DomainException } from '@recon/domain';
import type { AuditLogEntry, ExceptionStore, ExecutedActionResult, PendingEvaluation } from '../exceptionStore';

// Used by tests and local dev without a database; state is lost on restart.
export class InMemoryExceptionStore implements ExceptionStore {
  private webhookReceipts = new Set<string>();
  private exceptions = new Map<string, DomainException>();
  private pendingEvaluations = new Map<string, PendingEvaluation>();
  private executedActions = new Map<string, { exceptionId: string; result: ExecutedActionResult }>();
  private auditLog: AuditLogEntry[] = [];

  async claimWebhook(provider: string, eventId: string, _orgId: string): Promise<boolean> {
    const key = `${provider}:${eventId}`;
    if (this.webhookReceipts.has(key)) return false;
    this.webhookReceipts.add(key);
    return true;
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

  async getExecutedAction(idempotencyKey: string): Promise<ExecutedActionResult | undefined> {
    return this.executedActions.get(idempotencyKey)?.result;
  }

  async saveExecutedAction(idempotencyKey: string, exceptionId: string, result: ExecutedActionResult): Promise<void> {
    this.executedActions.set(idempotencyKey, { exceptionId, result });
  }

  async appendAuditLog(entry: AuditLogEntry): Promise<void> {
    this.auditLog.push(entry);
  }

  async getAuditLog(orgId: string): Promise<AuditLogEntry[]> {
    return this.auditLog.filter((entry) => entry.orgId === orgId);
  }
}
