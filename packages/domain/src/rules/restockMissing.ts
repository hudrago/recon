import type { InventoryAdjustment, Refund } from '../entities';
import type { DomainException } from '../exceptions';

// Assumption: warehouse restock SLA — no explicit value in the glossary yet, confirm with operations.
export const RESTOCK_MISSING_THRESHOLD_MS = 4 * 60 * 60 * 1000;

export interface RestockMissingInput {
  refund: Refund;
  adjustments: InventoryAdjustment[];
  now: Date;
}

// Deterministic per refund, so re-running the rule on the same event never creates a duplicate exception.
export function restockMissingExceptionId(refund: Refund): string {
  return `RESTOCK_MISSING:${refund.id}`;
}

export function evaluateRestockMissing({ refund, adjustments, now }: RestockMissingInput): DomainException | null {
  const hasAdjustment = adjustments.some((adjustment) => adjustment.refundId === refund.id);
  if (hasAdjustment) return null;

  const elapsed = now.getTime() - new Date(refund.issuedAt).getTime();
  if (elapsed < RESTOCK_MISSING_THRESHOLD_MS) return null;

  return {
    id: restockMissingExceptionId(refund),
    orgId: refund.orgId,
    code: 'RESTOCK_MISSING',
    orderId: refund.orderId,
    detectedAt: now.toISOString(),
    status: 'open',
    context: { refundId: refund.id, elapsedMs: elapsed },
  };
}
