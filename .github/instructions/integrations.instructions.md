---
applyTo: "packages/integrations/**"
description: "Rules for provider adapters (Shopify, carriers, InvoiceXpress/Moloni)."
---

# Integration Adapters

Adapters translate a provider's shape into `packages/domain` entities. They
never contain reconciliation logic and never call the action runner directly.

## Rules

- One adapter per provider, one direction of translation each way:
  `toDomain(providerPayload) => DomainEntity` and
  `fromDomainAction(action) => providerRequest`.
- Every adapter has fixture-based contract tests under `__fixtures__/` —
  recorded/representative payloads, not live API calls in tests.
- Webhook handlers are idempotent: the same webhook delivered twice must not
  create duplicate domain events. Use the provider's event id as the
  deduplication key.
- Respect provider rate limits explicitly (backoff/retry), don't assume
  unlimited throughput.
- If a provider field doesn't map cleanly to an existing domain entity, raise
  it as a domain model question rather than bolting on a provider-specific
  field to a shared type.
- Do not implement UI, reconciliation rules, or action approval logic here —
  that belongs to `apps/api` and `packages/domain`.
