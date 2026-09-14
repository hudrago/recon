---
name: add-reconciliation-rule
description: 'Use when adding a new exception type or reconciliation rule to packages/domain (e.g. DELIVERY_STALLED, INVOICE_MISSING, RESTOCK_MISSING, or a brand new code): scaffolds the domain event/entity fields, the pure rule function, exception code, fires/does-not-fire/boundary tests, and wiring into the exception lifecycle. Trigger phrases: new exception type, reconciliation rule, add exception code.'
argument-hint: 'Exception code + the condition that should trigger it'
---

# Add a Reconciliation Rule

Adds one new exception type end-to-end: domain shapes → pure rule → tests →
wiring into the exception lifecycle. Mirrors how `REFUND_MISSING` was built.

## When to Use

- Adding a new `ExceptionCode` (e.g. `DELIVERY_STALLED`, `INVOICE_MISSING`, `RESTOCK_MISSING`)
- A merchant workflow needs a new kind of mismatch detected

## Procedure

1. **Update the glossary first.** Add the code and its trigger condition to
   [domain-glossary.md](../../../docs/architecture/domain-glossary.md) before
   writing any code — it's the single source of truth for exception codes.

2. **Add or extend entities** in `packages/domain/src/entities.ts` if the rule
   needs data not already modeled. Keep them provider-agnostic — no
   Shopify/carrier-specific field names.

3. **Write the rule** as a pure function using
   [rule.template.ts](./assets/rule.template.ts):
   - Deterministic exception `id` per input, so re-running the rule on the
     same event never creates a duplicate exception.
   - No I/O, no `Date.now()` inside — take `now: Date` as a parameter.
   - Return `null` when the condition isn't met.

4. **Write tests** using
   [rule.test.template.ts](./assets/rule.test.template.ts). Every rule needs:
   - a case that fires
   - an adjacent case that must NOT fire (the counter-evidence exists)
   - a boundary case at the exact threshold

5. **Wire it into the exception lifecycle** (`apps/api/src/exceptionService.ts`
   or its equivalent): an `ingestX` method that calls the rule and dedupes on
   the exception id, the same pattern as `ingestReturn`.

6. **Run the gates**: `pnpm test`, `pnpm typecheck`, `pnpm lint`. A rule isn't
   done until the boundary and does-not-fire tests both pass.

## Non-negotiables

- Never call an AI model to decide whether the rule fires — rules are
  deterministic and testable.
- Never execute a refund/restock/invoice action directly from the rule — a
  rule only produces an `Exception`; actions require separate approval.
