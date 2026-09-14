---
name: add-integration-adapter
description: 'Use when adding or updating a provider adapter in packages/integrations (Shopify, CTT/DPD carriers, InvoiceXpress/Moloni): scaffolds the payload type, toDomain mapper, fixtures, and contract test. Trigger phrases: new adapter, provider integration, webhook mapper, fixture, contract test.'
argument-hint: 'Provider name + capability (e.g. "CTT shipment status webhook")'
---

# Add an Integration Adapter

Adds one provider capability end-to-end: payload type → mapper → fixtures →
contract test. Mirrors how the Shopify return mapper was built.

## When to Use

- A new provider needs to feed data into `packages/domain`
- An existing adapter needs a new capability (e.g. Shopify refunds, on top of
  an existing Shopify returns mapper)

## Procedure

1. **Check the live API first.** Use `#tool:web` to confirm current field
   names and shapes — don't rely on memory, provider APIs drift.

2. **Define the payload type** for just the fields you actually use, not the
   whole provider schema.

3. **Write the mapper** using [adapter.template.ts](./assets/adapter.template.ts):
   `toDomain(payload, orgId) => DomainEntity`. If a field doesn't map cleanly
   onto an existing `packages/domain` entity, stop and raise it as a domain
   model question instead of bolting it on.

4. **Add fixtures** under `__fixtures__/` using
   [fixture.template.ts](./assets/fixture.template.ts): the common case, one
   edge case (partial refund, split shipment, etc.), and one malformed or
   incomplete payload.

5. **Write the contract test** using
   [adapter.test.template.ts](./assets/adapter.test.template.ts): assert each
   fixture maps to the expected domain shape, and that the malformed fixture
   doesn't throw.

6. **If this adapter receives webhooks**, add a dedup test: the same event
   delivered twice must not produce two domain events. Key on the provider's
   event id.

7. **Run the gates**: `pnpm test`, `pnpm typecheck`, `pnpm lint`.

## Non-negotiables

- No live network calls in tests — fixtures only.
- Adapters never call reconciliation rules or the action runner directly;
  they only translate shapes.
- Respect provider rate limits explicitly where this capability involves
  polling or bulk sync — don't assume unlimited throughput.
