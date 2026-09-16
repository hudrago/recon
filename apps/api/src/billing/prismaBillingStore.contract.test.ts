import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../prisma.service';
import type { SubscriptionRecord } from './billingEntitlement';
import { PrismaBillingStore } from './prismaBillingStore';

// Runs against the REAL Supabase Postgres database (see DATABASE_URL in .env). Skipped
// automatically when DATABASE_URL isn't set, e.g. a fresh clone with no DB yet. All ids are
// prefixed with "contract_" so this suite can clean up everything it created afterward.
describe.skipIf(!process.env.DATABASE_URL)('PrismaBillingStore (live database)', () => {
  let prisma: PrismaService;
  let store: PrismaBillingStore;
  const orgId = 'contract_billing_org';

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.onModuleInit();
    store = new PrismaBillingStore(prisma);
    await prisma.organization.upsert({
      where: { id: orgId },
      create: { id: orgId, name: 'Contract billing test', slug: orgId, createdAt: new Date() },
      update: {},
    });
  });

  afterAll(async () => {
    // Scoped to this suite's exact org id, not a broad "contract_" prefix — the exception-store
    // contract suite uses the same prefix convention and runs concurrently in another worker;
    // a broad deleteMany() here previously raced with it and hit an unrelated FK constraint.
    await prisma.processedOrder.deleteMany({ where: { orgId } });
    await prisma.subscription.deleteMany({ where: { orgId } });
    await prisma.billingWebhookReceipt.deleteMany({ where: { eventId: { startsWith: 'contract_' } } });
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await prisma.onModuleDestroy();
  });

  function trialSubscription(overrides: Partial<SubscriptionRecord> = {}): SubscriptionRecord {
    return {
      orgId,
      planCode: 'GROWTH',
      status: 'trialing',
      trialEndsAt: new Date('2026-01-31T00:00:00.000Z'),
      graceEndsAt: new Date('2026-02-07T00:00:00.000Z'),
      currentPeriodStart: new Date('2026-01-01T00:00:00.000Z'),
      currentPeriodEnd: new Date('2026-01-31T00:00:00.000Z'),
      ...overrides,
    };
  }

  it('creates a subscription once and is idempotent on repeated ensureSubscription calls', async () => {
    const first = await store.ensureSubscription(trialSubscription());
    const second = await store.ensureSubscription(trialSubscription({ planCode: 'PRO' }));
    expect(second).toEqual(first);
    expect((await store.getSubscription(orgId))?.planCode).toBe('GROWTH');
  });

  it('updates subscription fields in place', async () => {
    const updated = await store.updateSubscription(orgId, { status: 'active' });
    expect(updated.status).toBe('active');
  });

  it('never double-counts a processed order recorded twice for the same external order id', async () => {
    const paidAt = new Date('2026-01-10T00:00:00.000Z');
    await store.recordProcessedOrder({ orgId, provider: 'shopify', externalOrderId: 'contract_order_1', amountCents: 1_000, currency: 'EUR', paidAt });
    await store.recordProcessedOrder({ orgId, provider: 'shopify', externalOrderId: 'contract_order_1', amountCents: 1_000, currency: 'EUR', paidAt });
    await store.recordProcessedOrder({ orgId, provider: 'shopify', externalOrderId: 'contract_order_1', amountCents: 1_000, currency: 'EUR', paidAt });

    const count = await store.countProcessedOrders(orgId, new Date('2026-01-01T00:00:00.000Z'), new Date('2026-02-01T00:00:00.000Z'));
    expect(count).toBe(1);
  });

  it('counts distinct processed orders only within the requested period', async () => {
    await store.recordProcessedOrder({ orgId, provider: 'shopify', externalOrderId: 'contract_order_2', amountCents: 500, currency: 'EUR', paidAt: new Date('2026-01-05T00:00:00.000Z') });
    await store.recordProcessedOrder({ orgId, provider: 'shopify', externalOrderId: 'contract_order_3', amountCents: 500, currency: 'EUR', paidAt: new Date('2026-02-05T00:00:00.000Z') });

    const januaryCount = await store.countProcessedOrders(orgId, new Date('2026-01-01T00:00:00.000Z'), new Date('2026-02-01T00:00:00.000Z'));
    expect(januaryCount).toBeGreaterThanOrEqual(1);
    const februaryCount = await store.countProcessedOrders(orgId, new Date('2026-02-01T00:00:00.000Z'), new Date('2026-03-01T00:00:00.000Z'));
    expect(februaryCount).toBeGreaterThanOrEqual(1);
  });

  it('claims a billing webhook event once and rejects a replayed event id', async () => {
    const claimed = await store.claimBillingWebhook('stripe', 'contract_evt_1', orgId);
    const replayed = await store.claimBillingWebhook('stripe', 'contract_evt_1', orgId);
    expect(claimed).toBe(true);
    expect(replayed).toBe(false);
    await store.completeBillingWebhook('stripe', 'contract_evt_1');
  });
});
