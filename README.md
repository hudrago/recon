# Recon

Portuguese e-commerce exception-management workspace. Reconciles orders across
commerce, shipping, payments, returns and invoicing systems, surfaces the
exceptions that need a human decision, and executes approved actions safely.

## Structure

```
apps/web/                 Operations inbox, case timeline, approvals (Next.js)
apps/api/                 Exception lifecycle, action runner, audit log
packages/domain/          Canonical entities + reconciliation rules (no I/O)
packages/integrations/    Shopify / carrier / InvoiceXpress adapters
packages/ui/              Shared UI components
tests/e2e/                End-to-end flows
docs/architecture/        Domain glossary, ADRs
.github/                  Copilot instructions, scoped instructions, agents
```

See `docs/architecture/domain-glossary.md` for entities and exception codes,
and `.github/copilot-instructions.md` for stack and safety rules.

## Local development

Copy the values from `.env.example` into `apps/api/.env` and from
`apps/web/.env.example` into `apps/web/.env.local`, then run:

```bash
docker compose up -d
pnpm --filter @recon/api run prisma:generate
pnpm --filter @recon/api exec prisma migrate deploy
pnpm run dev:api
pnpm run dev:web
```

The web app runs at `http://localhost:3000` and the API at
`http://localhost:3001`. Authentication is provided by Better Auth. Operational
API routes require a valid session and membership in the organization named in
the URL. Redis runs at `redis://localhost:6379` and backs durable exception
reevaluation jobs. Shopify webhooks require `SHOPIFY_ORG_ID`,
`SHOPIFY_SHOP_DOMAIN`, `SHOPIFY_CLIENT_ID`, and `SHOPIFY_CLIENT_SECRET`; requests
are verified by HMAC, bound to that organization/shop mapping, and deduplicated
by Shopify webhook ID. Set a unique, random `BETTER_AUTH_SECRET` of at least 32
characters in every deployed environment. Production startup fails when any
required database, Redis, authentication, or Shopify setting is missing.
