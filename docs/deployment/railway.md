# Railway API and Redis

Deploy the repository as a Railway service from the repository root. Railway
uses the root `Dockerfile` and runs Prisma migrations before starting the API.

Add a Redis service to the same Railway project, then configure the API service
with these variables:

```text
NODE_ENV=production
PORT=3001
WEB_URL=<deployed web origin>
BETTER_AUTH_URL=<Railway API public URL>
BETTER_AUTH_SECRET=<unique random value, at least 32 characters>
DATABASE_URL=<Supabase session-pooler PostgreSQL URL>
REDIS_URL=${{Redis.REDIS_URL}}
SHOPIFY_ORG_ID=<Recon organization ID>
SHOPIFY_SHOP_DOMAIN=<store>.myshopify.com
SHOPIFY_CLIENT_ID=<Shopify app client ID>
SHOPIFY_CLIENT_SECRET=<Shopify app client secret>
```

Generate a public Railway domain for the API. After `/health` returns `200`,
update the Shopify app subscriptions to these stable callback URLs:

```text
https://<api-domain>/orgs/<org-id>/ingest/shopify/orders/paid
https://<api-domain>/orgs/<org-id>/ingest/shopify/refunds
https://<api-domain>/orgs/<org-id>/ingest/shopify/returns
```

Keep Redis private. The API only needs Railway's internal `REDIS_URL`; do not
enable Redis public networking.