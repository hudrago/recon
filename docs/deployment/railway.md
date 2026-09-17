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

Optional — without these, invitation and email-verification links are only
logged (`ConsoleMailer`), never actually emailed:

```text
RESEND_API_KEY=<Resend API key, EU sending region configured on the domain>
EMAIL_FROM=Recon <no-reply@yourdomain.com>
```

Optional — enables the hourly carrier tracking poll job. Leave unset until a
real `CARRIER_TRACKING_GATEWAY` provider is wired in `app.module.ts`; today it
only runs against `FakeCarrierTrackingGateway`, which reports no updates:

```text
CARRIER_TRACKING_ENABLED=true
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

## Web (`apps/web`)

The root `Dockerfile` builds `apps/web` but its `CMD` only starts `@recon/api`
(see the Dockerfile — the web build output isn't served by that container).
Deploy the web app as a **second Railway service** from the same repository,
rather than running two processes in one container:

1. Add a new service to the same Railway project → "Deploy from repo" → pick
   this repository again.
2. In the new service's Settings → Deploy, set a **Custom Start Command**
   that overrides the Dockerfile's `CMD`:
   ```text
   pnpm --filter @recon/web run start
   ```
3. Configure this service's variables:
   ```text
   NODE_ENV=production
   PORT=3000
   API_URL=<the api service's Railway URL, e.g. https://recon-api.up.railway.app>
   ```
4. Generate a public domain for this service, then set the **api** service's
   `WEB_URL` (and `BETTER_AUTH_URL` if it references the web origin) to that
   domain, and redeploy the api service so `trustedOrigins` matches.
5. There's no dedicated web health check route yet — Railway's default TCP
   healthcheck against the service port is sufficient for `next start`.