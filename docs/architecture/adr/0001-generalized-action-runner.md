# 0001. Generalized action runner for exception remediation

Status: accepted

## Context

`REFUND_MISSING` originally had the only executable `Action` — a hand-written
`ExceptionService.executeRefund()` that hardcoded the refund-shaped
idempotency key, store calls (`ExecutedActionResult = { refundId: string }`),
and audit entry. Adding a second remediation (`RESTOCK_MISSING`'s inventory
adjustment) on top of that shape would have meant copy-pasting the entire
claim → guard → invoke → complete sequence, with no shared idempotency or
audit guarantees between the two — exactly the kind of divergence
money-safety rules in the root instructions are meant to prevent.

## Decision

`ExceptionStore`'s action-related surface became kind-agnostic:

- `ActionKind = 'REFUND' | 'RESTOCK'` (extend with `'CREDIT_NOTE'`, etc. as
  further actions are added).
- `ExecutedActionResult` and `ActionSideEffect` are discriminated unions
  tagged by `kind`, one variant per action kind.
- `claimAction(idempotencyKey, exceptionId, orgId, orderId, actionKind)` and
  `completeAction(idempotencyKey, exception, sideEffect, auditEntry)` take the
  kind/side-effect explicitly instead of assuming `REFUND`.
- `ExceptionService.runAction<TTerms>()` is a single private generic method
  implementing the full lifecycle (validate exception code/status → resolve
  approved terms → claim idempotency lease → guard against an
  already-observed side effect → invoke the provider gateway → atomically
  persist the result, the observed record, and the audit entry). Every
  `executeX()` public method (`executeRefund`, `executeRestock`) is a thin
  wrapper supplying `runAction` its kind-specific callbacks.

## Consequences

- Adding a new action (e.g. a future credit-note/invoice action) means: add
  an `ActionKind` + `ExecutedActionResult`/`ActionSideEffect` variant, a
  `Gateway` interface + fake + real implementation (mirroring
  `RefundGateway`/`RestockGateway`), one `runAction` call in
  `ExceptionService`, one controller route, and one `approve()` terms branch
  — not a new copy of the claim/guard/complete sequence.
- `packages/domain`'s `InventoryAdjustment` entity gained a required
  `quantity: number` field to support restock, per
  domain-model.instructions.md's rule that entity changes update every
  consumer in the same change (mappers, apps/api, fixtures were all updated
  together).
- The in-memory store's "is this order already reserved" check now filters
  by `actionKind` in addition to `(orgId, orderId)` — before generalization,
  reserving one action kind on an order would have incorrectly blocked a
  different action kind on the same order, since only `REFUND` existed and
  the check never needed to distinguish kinds.
- `apps/web`'s `CaseActions.tsx` branches its approval-terms form and confirm
  dialog copy by `exception.code`; exception types with no wired action yet
  (`INVOICE_MISSING`, `DELIVERY_STALLED`) show a "no automated action" state
  once approved, instead of a misleading generic execute button.

## Alternatives Considered

- **Keep `executeRefund` as-is, write a fully separate `executeRestock` with
  its own claim/guard/complete logic.** Rejected: guarantees (idempotency,
  audit, duplicate-side-effect detection) would drift the moment either
  method changed without the other being updated to match — the exact
  failure mode the API's money-safety rules exist to prevent.
- **A generic `Action` entity in `packages/domain` describing all remediation
  kinds structurally, with the rules engine deciding which fields apply.**
  Rejected for now: `packages/domain` must stay I/O-free and provider-agnostic;
  the claim/lease/idempotency mechanics are inherently storage concerns that
  belong in `apps/api`, not a pure domain construct. Revisit if a third and
  fourth action reveal more shared structure than `runAction` already
  captures.
