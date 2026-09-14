---
applyTo: "packages/domain/**"
description: "Rules for the canonical domain model and reconciliation rules engine."
---

# Domain Model & Reconciliation Rules

`packages/domain` is pure: no HTTP calls, no database client, no provider SDKs.
It defines entities, exception codes, and the deterministic rules that turn
normalized events into `Exception`s.

## Rules

- Entities and exception codes must match `docs/architecture/domain-glossary.md`
  exactly. Update the glossary in the same change if you add or rename one.
- A reconciliation rule is a pure function: `(event, currentState) => Exception | null`.
  No side effects, no randomness, no calls to AI models.
- Every new rule ships with tests for: the case that fires, at least one
  adjacent case that must NOT fire, and a boundary case (e.g. exactly at the
  24h threshold).
- `Action` definitions declare their idempotency key explicitly — never rely
  on "probably won't be called twice."
- Breaking changes to an entity shape require updating `packages/integrations`
  mappers and `apps/api` consumers in the same change, not a follow-up.
