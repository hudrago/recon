import { describe, expect, it } from 'vitest';
import { FakeStripeGateway } from '../gateways/fakeStripeGateway';
import { BillingService } from './billing.service';
import { InMemoryBillingStore } from './inMemoryBillingStore';

describe('BillingService', () => {
  it('provisions a 30-day Growth trial with a 7-day grace period', async () => {
    const service = new BillingService(new InMemoryBillingStore(), new FakeStripeGateway());
    const now = new Date('2026-01-01T00:00:00.000Z');
    const subscription = await service.ensureTrial('org_1', now);
    expect(subscription).toMatchObject({ orgId: 'org_1', planCode: 'GROWTH', status: 'trialing' });
    expect(subscription.trialEndsAt).toEqual(new Date('2026-01-31T00:00:00.000Z'));
    expect(subscription.graceEndsAt).toEqual(new Date('2026-02-07T00:00:00.000Z'));
  });

  it('is idempotent: calling ensureTrial twice never resets an in-progress trial', async () => {
    const store = new InMemoryBillingStore();
    const service = new BillingService(store, new FakeStripeGateway());
    const first = await service.ensureTrial('org_1', new Date('2026-01-01T00:00:00.000Z'));
    const second = await service.ensureTrial('org_1', new Date('2026-01-15T00:00:00.000Z'));
    expect(second).toEqual(first);
  });

  it('self-heals a missing subscription so an organization without one is never permanently blocked', async () => {
    const service = new BillingService(new InMemoryBillingStore(), new FakeStripeGateway());
    const entitlement = await service.getEntitlement('org_never_provisioned', new Date());
    expect(entitlement).toMatchObject({ displayStatus: 'trialing', canIngest: true, canExecuteActions: true });
  });

  it('blocks action execution once processed orders reach the plan limit', async () => {
    const store = new InMemoryBillingStore();
    const service = new BillingService(store, new FakeStripeGateway());
    const now = new Date('2026-01-10T00:00:00.000Z');
    await store.ensureSubscription({
      orgId: 'org_1',
      planCode: 'STARTER',
      status: 'active',
      trialEndsAt: null,
      graceEndsAt: null,
      currentPeriodStart: new Date('2026-01-01T00:00:00.000Z'),
      currentPeriodEnd: new Date('2026-02-01T00:00:00.000Z'),
    });
    for (let index = 0; index < 1_000; index += 1) {
      await service.recordProcessedOrder({ orgId: 'org_1', provider: 'shopify', externalOrderId: `order_${index}`, amountCents: 1_000, currency: 'EUR', paidAt: now });
    }
    expect(await service.canIngest('org_1', now)).toBe(true);
    expect(await service.canExecuteActions('org_1', now)).toBe(false);
  });

  it('never double-counts a replayed processed-order event', async () => {
    const store = new InMemoryBillingStore();
    const service = new BillingService(store, new FakeStripeGateway());
    const event = { orgId: 'org_1', provider: 'shopify', externalOrderId: 'order_1', amountCents: 1_000, currency: 'EUR', paidAt: new Date('2026-01-10T00:00:00.000Z') };
    await service.recordProcessedOrder(event);
    await service.recordProcessedOrder(event);
    await service.recordProcessedOrder(event);
    const count = await store.countProcessedOrders('org_1', new Date('2026-01-01T00:00:00.000Z'), new Date('2026-02-01T00:00:00.000Z'));
    expect(count).toBe(1);
  });

  it('creates a Stripe checkout session for a self-serve plan via the gateway', async () => {
    const service = new BillingService(new InMemoryBillingStore(), new FakeStripeGateway());
    const result = await service.createCheckoutSession(
      'org_1',
      'GROWTH',
      'https://app.example/success',
      'https://app.example/cancel',
      { STRIPE_PRICE_GROWTH: 'price_growth' } as NodeJS.ProcessEnv,
    );
    expect(result.url).toContain('org_1');
  });

  it('rejects a checkout session for a plan without a self-serve Stripe price (Enterprise)', async () => {
    const service = new BillingService(new InMemoryBillingStore(), new FakeStripeGateway());
    await expect(service.createCheckoutSession('org_1', 'ENTERPRISE', 'https://app.example/success', 'https://app.example/cancel')).rejects.toThrow(/no self-serve stripe price/i);
  });

  it('applies a subscription webhook event: upgrades plan/status/period and links Stripe identifiers', async () => {
    const store = new InMemoryBillingStore();
    const service = new BillingService(store, new FakeStripeGateway());
    await service.ensureTrial('org_1', new Date('2026-01-01T00:00:00.000Z'));

    await service.applyStripeSubscriptionEvent({
      orgId: 'org_1',
      stripeCustomerId: 'cus_1',
      stripeSubscriptionId: 'sub_1',
      stripeStatus: 'active',
      priceId: 'price_pro',
      currentPeriodStart: '2026-01-01T00:00:00.000Z',
      currentPeriodEnd: '2026-02-01T00:00:00.000Z',
      canceledAt: null,
    }, { STRIPE_PRICE_PRO: 'price_pro' } as NodeJS.ProcessEnv);

    const subscription = await store.getSubscription('org_1');
    expect(subscription).toMatchObject({ planCode: 'PRO', status: 'active' });
    expect(await store.findByStripeCustomerId('cus_1')).toMatchObject({ orgId: 'org_1' });
  });

  it('ignores a subscription webhook event with no attributable org', async () => {
    const store = new InMemoryBillingStore();
    const service = new BillingService(store, new FakeStripeGateway());
    await expect(
      service.applyStripeSubscriptionEvent({
        orgId: null,
        stripeCustomerId: 'cus_1',
        stripeSubscriptionId: 'sub_1',
        stripeStatus: 'active',
        priceId: 'price_pro',
        currentPeriodStart: '2026-01-01T00:00:00.000Z',
        currentPeriodEnd: '2026-02-01T00:00:00.000Z',
        canceledAt: null,
      }),
    ).resolves.toBeUndefined();
  });

  it('maps an unrecognized/failed Stripe status conservatively to past_due, never to active', async () => {
    const store = new InMemoryBillingStore();
    const service = new BillingService(store, new FakeStripeGateway());
    await service.ensureTrial('org_1', new Date('2026-01-01T00:00:00.000Z'));

    await service.applyStripeSubscriptionEvent({
      orgId: 'org_1',
      stripeCustomerId: 'cus_1',
      stripeSubscriptionId: 'sub_1',
      stripeStatus: 'incomplete',
      priceId: 'price_unknown',
      currentPeriodStart: '2026-01-01T00:00:00.000Z',
      currentPeriodEnd: '2026-02-01T00:00:00.000Z',
      canceledAt: null,
    });

    expect((await store.getSubscription('org_1'))?.status).toBe('past_due');
  });

  it('records an invoice once the org is resolved via the Stripe customer id', async () => {
    const store = new InMemoryBillingStore();
    const service = new BillingService(store, new FakeStripeGateway());
    await service.ensureTrial('org_1', new Date('2026-01-01T00:00:00.000Z'));
    await service.applyStripeSubscriptionEvent({
      orgId: 'org_1',
      stripeCustomerId: 'cus_1',
      stripeSubscriptionId: 'sub_1',
      stripeStatus: 'active',
      priceId: 'price_growth',
      currentPeriodStart: '2026-01-01T00:00:00.000Z',
      currentPeriodEnd: '2026-02-01T00:00:00.000Z',
      canceledAt: null,
    });

    const invoiceEvent = {
      stripeCustomerId: 'cus_1',
      stripeInvoiceId: 'in_1',
      amountCents: 24_900,
      currency: 'EUR',
      status: 'paid',
      hostedInvoiceUrl: 'https://invoice.stripe.com/i/test',
      periodStart: '2026-01-01T00:00:00.000Z',
      periodEnd: '2026-02-01T00:00:00.000Z',
    };
    await service.applyStripeInvoicePaidEvent(invoiceEvent);
    await service.applyStripeInvoicePaidEvent(invoiceEvent);

    expect(store.getRecordedInvoiceCount()).toBe(1);
  });

  it('ignores an invoice event whose Stripe customer id cannot be resolved to an org', async () => {
    const store = new InMemoryBillingStore();
    const service = new BillingService(store, new FakeStripeGateway());
    await service.applyStripeInvoicePaidEvent({
      stripeCustomerId: 'cus_unknown',
      stripeInvoiceId: 'in_1',
      amountCents: 24_900,
      currency: 'EUR',
      status: 'paid',
      hostedInvoiceUrl: null,
      periodStart: '2026-01-01T00:00:00.000Z',
      periodEnd: '2026-02-01T00:00:00.000Z',
    });
    expect(store.getRecordedInvoiceCount()).toBe(0);
  });
});
