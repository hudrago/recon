import { describe, expect, it } from 'vitest';
import { malformedStripeSubscriptionFixture, stripeSubscriptionActiveFixture, stripeSubscriptionCanceledFixture } from './__fixtures__/subscriptionEvent.fixture';
import { mapStripeSubscriptionEvent } from './mapSubscriptionEvent';

describe('mapStripeSubscriptionEvent', () => {
  it('maps an active subscription fixture to the raw event shape', () => {
    expect(mapStripeSubscriptionEvent(stripeSubscriptionActiveFixture)).toEqual({
      orgId: 'org_1',
      stripeCustomerId: 'cus_1P0000000000000001',
      stripeSubscriptionId: 'sub_1P0000000000000001',
      stripeStatus: 'active',
      priceId: 'price_growth',
      currentPeriodStart: '2026-01-01T00:00:00.000Z',
      currentPeriodEnd: '2026-02-01T00:00:00.000Z',
      canceledAt: null,
    });
  });

  it('maps a canceled subscription with a canceledAt timestamp', () => {
    const mapped = mapStripeSubscriptionEvent(stripeSubscriptionCanceledFixture);
    expect(mapped).toMatchObject({ stripeStatus: 'canceled', canceledAt: '2026-01-02T00:00:00.000Z' });
  });

  it('returns null for a payload missing a price line item', () => {
    expect(mapStripeSubscriptionEvent(malformedStripeSubscriptionFixture)).toBeNull();
  });

  it('returns null orgId when metadata does not carry one', () => {
    const rest: Record<string, unknown> = { ...stripeSubscriptionActiveFixture };
    delete rest.metadata;
    expect(mapStripeSubscriptionEvent(rest)?.orgId).toBeNull();
  });
});
