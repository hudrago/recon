import type { DomainException, InventoryAdjustment, Refund } from '@recon/domain';

export interface SuggestedApprovalTerms {
  amountMinor?: number;
  currency?: string;
  quantity?: number;
}

// Pure arithmetic only — the AI gateway NEVER computes money or quantities, it only explains
// what this function (or a human) already decided. This is the single place any future
// AI-adjacent feature is allowed to prefill approval terms; it must never live in a gateway.
//
// Today this always returns {}: Recon's domain model doesn't persist the source data a safe
// suggestion would need (no per-order line totals for REFUND_MISSING, no unit quantities for
// RESTOCK_MISSING — see packages/domain/src/entities.ts). Fabricating a heuristic value without
// that data would mislead an operator, so this is left honest rather than guessing. Add a case
// here once the required entity fields exist.
export function suggestApprovalTerms(
  _exception: DomainException,
  _refunds: Refund[],
  _adjustments: InventoryAdjustment[],
): SuggestedApprovalTerms {
  return {};
}
