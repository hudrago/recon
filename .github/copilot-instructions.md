# Recon — Agent Instructions

Portuguese e-commerce exception-management workspace: reconciles orders across
Shopify, carriers (CTT/DPD), and Portuguese invoicing (InvoiceXpress/Moloni),
then lets a human approve refunds/restocks/invoices before they execute.

## Stack

- TypeScript everywhere. Next.js (App Router) for `apps/web`.
- `apps/api`: NestJS or Next.js route handlers — match whatever already exists
  in `apps/api`, don't mix conventions within the same app.
- PostgreSQL + Prisma. Zod for all external input validation.
- Vitest for unit/contract tests, Playwright for `tests/e2e`.
- Background jobs: queue-based (BullMQ or Trigger.dev) — never fire-and-forget
  a provider call from a request handler.

## Folder Ownership

| Path | Owner | Rule |
|---|---|---|
| `packages/domain` | recon-implementer | Single source of truth for entities/rules. No I/O. |
| `packages/integrations` | recon-integration | Adapters only. Consumes domain types, never redefines them. |
| `apps/api` | recon-implementer | Exception lifecycle, action runner, audit log. |
| `apps/web` | recon-frontend (or implementer) | Inbox, case timeline, approvals. Talks to `apps/api` only. |
| `tests/e2e` | whoever owns the flow | Fixture/recorded-data based, no live provider calls. |

Changing a shared type in `packages/domain` requires updating every consumer in
the same change — never leave `packages/integrations` or `apps/api` on a stale
shape.

## Money-Safety Rules (non-negotiable)

- Every `Action` (refund, restock, invoice, credit note) must be idempotent:
  replaying it with the same key produces no duplicate side effect.
- No `Action` executes without human approval, unless a merchant has opted a
  specific rule into auto-execution.
- Every executed `Action` is recorded in an audit log with actor, reason, and
  before/after state.
- Reconciliation rules are deterministic and testable. Do not use an LLM to
  decide whether to issue a refund — only to summarize/draft/classify with a
  `requiresApproval: true` recommendation.

## Data Handling (GDPR / EU)

- Customer PII stays minimal: name, email, order history. No storage of
  payment card data — that stays with the payment provider.
- Data resides in an EU region. Don't introduce a dependency that stores
  customer data outside the EU without flagging it first.

## Commands

```
pnpm install
pnpm dev            # apps/web + apps/api
pnpm test           # vitest across packages
pnpm test:e2e        # playwright
pnpm typecheck
pnpm lint
```

## Gates Before Calling Work Done

1. `pnpm typecheck` clean.
2. `pnpm test` green, including a test for the "rule does NOT fire" case.
3. `pnpm lint` clean.
4. Any new `Action` has an idempotency test (replay = no duplicate effect).
5. Any new provider field flows through `packages/domain`, not ad-hoc types.
