import type { Refund, ReturnRecord } from '../entities';
import type { DomainException } from '../exceptions';

export const REFUND_MISSING_THRESHOLD_MS = 24 * 60 * 60 * 1000;

export interface RefundMissingInput {
  returnRecord: ReturnRecord;
  refunds: Refund[];
  now: Date;
}

// Deterministic per return, so re-running the rule on the same event never creates a duplicate exception.
export function refundMissingExceptionId(returnRecord: ReturnRecord): string {
  return `REFUND_MISSING:${returnRecord.orgId}:${returnRecord.id}`;
}

export function evaluateRefundMissing({ returnRecord, refunds, now }: RefundMissingInput): DomainException | null {
  const hasRefund = refunds.some((refund) => refund.orderId === returnRecord.orderId);
  if (hasRefund) return null;

  const elapsed = now.getTime() - new Date(returnRecord.receivedAt).getTime();
  if (elapsed < REFUND_MISSING_THRESHOLD_MS) return null;

  return {
    id: refundMissingExceptionId(returnRecord),
    orgId: returnRecord.orgId,
    code: 'REFUND_MISSING',
    orderId: returnRecord.orderId,
    detectedAt: now.toISOString(),
    status: 'open',
    context: { returnId: returnRecord.id, elapsedMs: elapsed },
  };
}
