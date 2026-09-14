---
applyTo: "apps/api/**"
description: "Rules for the exception lifecycle API, action runner, and audit log."
---

# API — Exception Lifecycle & Action Runner

`apps/api` orchestrates: ingest normalized events, run reconciliation rules
from `packages/domain`, expose the exception inbox, and execute approved
actions through `packages/integrations` adapters.

## Rules

- Every endpoint that mutates state (approve, dismiss, execute action)
  validates input with Zod and checks tenant/organization scope.
- Action execution is wrapped in an idempotency check keyed on the action's
  declared idempotency key before calling any adapter.
- Every executed action writes an audit log entry (actor, reason, before/after
  state) in the same transaction as the state change, not best-effort after.
- No endpoint calls a provider SDK directly — always go through a
  `packages/integrations` adapter.
- Auto-execution of an action is only allowed when the merchant has explicitly
  enabled it for that specific rule; default is always human approval.
