---
applyTo: "tests/**,**/*.test.ts,**/*.spec.ts"
description: "Testing conventions for domain rules, adapters, and end-to-end flows."
---

# Testing Conventions

- Unit tests for `packages/domain` rules: no I/O, table-driven over fixture
  events, always include a "must not fire" case alongside the "fires" case.
- Contract tests for `packages/integrations` adapters use recorded fixtures
  under `__fixtures__/`, never live network calls.
- Idempotency tests for any `Action`: execute twice with the same key, assert
  the side effect (refund/restock/invoice) happened exactly once.
- `tests/e2e` (Playwright) drives the UI against a seeded test environment,
  not production provider accounts.
