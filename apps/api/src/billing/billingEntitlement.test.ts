import { describe, expect, it } from 'vitest';
import { computeEntitlement, type SubscriptionRecord } from './billingEntitlement';

const DAY_MS = 24 * 60 * 60 * 1000;

function trial(overrides: Partial<SubscriptionRecord> = {}): SubscriptionRecord {
  return {
    orgId: 'org_1',
    planCode: 'GROWTH',
    status: 'trialing',
    trialEndsAt: new Date('2026-01-31T00:00:00.000Z'),
    graceEndsAt: new Date('2026-02-07T00:00:00.000Z'),
    currentPeriodStart: new Date('2026-01-01T00:00:00.000Z'),
    currentPeriodEnd: new Date('2026-01-31T00:00:00.000Z'),
    ...overrides,
  };
}

describe('computeEntitlement — trial lifecycle', () => {
  it('fires: grants full access on day 29 of a 30-day trial', () => {
    const now = new Date('2026-01-30T00:00:00.000Z');
    const entitlement = computeEntitlement(trial(), 0, now);
    expect(entitlement).toMatchObject({ displayStatus: 'trialing', canIngest: true, canExecuteActions: true });
  });

  it('boundary: still trialing at the exact trialEndsAt instant minus one tick, read-only at the instant itself', () => {
    const subscription = trial();
    const oneTickBefore = new Date(subscription.trialEndsAt!.getTime() - 1);
    expect(computeEntitlement(subscription, 0, oneTickBefore).displayStatus).toBe('trialing');
    expect(computeEntitlement(subscription, 0, subscription.trialEndsAt!).displayStatus).toBe('grace');
  });

  it('fires: enters grace on day 30-37 after the trial ends, with full access preserved', () => {
    const now = new Date('2026-02-03T00:00:00.000Z'); // day 33 (day 30 trial + 3 into grace)
    const entitlement = computeEntitlement(trial(), 0, now);
    expect(entitlement).toMatchObject({ displayStatus: 'grace', canIngest: true, canExecuteActions: true });
  });

  it('fires: becomes read-only after day 37 (30-day trial + 7-day grace) with no paid subscription', () => {
    const now = new Date('2026-02-08T00:00:00.000Z'); // day 38
    const entitlement = computeEntitlement(trial(), 0, now);
    expect(entitlement).toMatchObject({ displayStatus: 'read_only', canIngest: false, canExecuteActions: false });
  });

  it('boundary: read-only starts at the exact graceEndsAt instant', () => {
    const subscription = trial();
    expect(computeEntitlement(subscription, 0, subscription.graceEndsAt!).displayStatus).toBe('read_only');
    expect(computeEntitlement(subscription, 0, new Date(subscription.graceEndsAt!.getTime() - 1)).displayStatus).toBe('grace');
  });

  it('does not fire usage warnings while trialing, regardless of processed order count', () => {
    const entitlement = computeEntitlement(trial(), 100_000, new Date('2026-01-15T00:00:00.000Z'));
    expect(entitlement.usageWarning).toBe(false);
    expect(entitlement.overLimit).toBe(false);
  });
});

describe('computeEntitlement — active plan usage limits', () => {
  function activeSubscription(overrides: Partial<SubscriptionRecord> = {}): SubscriptionRecord {
    return {
      orgId: 'org_1',
      planCode: 'STARTER', // 1,000 orders/month
      status: 'active',
      trialEndsAt: null,
      graceEndsAt: null,
      currentPeriodStart: new Date('2026-01-01T00:00:00.000Z'),
      currentPeriodEnd: new Date('2026-02-01T00:00:00.000Z'),
      ...overrides,
    };
  }

  it('does not fire the usage warning below 80% of the plan limit', () => {
    const entitlement = computeEntitlement(activeSubscription(), 799, new Date('2026-01-15T00:00:00.000Z'));
    expect(entitlement.usageWarning).toBe(false);
    expect(entitlement.canExecuteActions).toBe(true);
  });

  it('boundary: fires the usage warning at exactly 80% of the plan limit', () => {
    const entitlement = computeEntitlement(activeSubscription(), 800, new Date('2026-01-15T00:00:00.000Z'));
    expect(entitlement.usageWarning).toBe(true);
    expect(entitlement.overLimit).toBe(false);
    expect(entitlement.canExecuteActions).toBe(true);
  });

  it('fires: keeps detecting problems but blocks new action execution once at the plan limit', () => {
    const entitlement = computeEntitlement(activeSubscription(), 1_000, new Date('2026-01-15T00:00:00.000Z'));
    expect(entitlement).toMatchObject({ displayStatus: 'active', canIngest: true, canExecuteActions: false, overLimit: true, usagePercent: 100 });
  });

  it('boundary: allows action execution one order below the limit, blocks it one order at the limit', () => {
    expect(computeEntitlement(activeSubscription(), 999, new Date('2026-01-15T00:00:00.000Z')).canExecuteActions).toBe(true);
    expect(computeEntitlement(activeSubscription(), 1_000, new Date('2026-01-15T00:00:00.000Z')).canExecuteActions).toBe(false);
  });

  it('does not fire a usage limit for Enterprise, which has no fixed monthly order limit', () => {
    const entitlement = computeEntitlement(activeSubscription({ planCode: 'ENTERPRISE' }), 1_000_000, new Date('2026-01-15T00:00:00.000Z'));
    expect(entitlement).toMatchObject({ monthlyOrderLimit: null, overLimit: false, usageWarning: false, canExecuteActions: true });
  });
});

describe('computeEntitlement — payment failure and cancellation', () => {
  it('fires: grants a 7-day grace period after payment failure, same as trial expiry', () => {
    const subscription: SubscriptionRecord = {
      orgId: 'org_1',
      planCode: 'GROWTH',
      status: 'past_due',
      trialEndsAt: null,
      graceEndsAt: new Date(Date.now() + 3 * DAY_MS),
      currentPeriodStart: new Date('2026-01-01T00:00:00.000Z'),
      currentPeriodEnd: new Date('2026-02-01T00:00:00.000Z'),
    };
    expect(computeEntitlement(subscription, 0, new Date()).displayStatus).toBe('grace');
  });

  it('fires: becomes read-only once the payment-failure grace period elapses', () => {
    const subscription: SubscriptionRecord = {
      orgId: 'org_1',
      planCode: 'GROWTH',
      status: 'past_due',
      trialEndsAt: null,
      graceEndsAt: new Date(Date.now() - 1),
      currentPeriodStart: new Date('2026-01-01T00:00:00.000Z'),
      currentPeriodEnd: new Date('2026-02-01T00:00:00.000Z'),
    };
    expect(computeEntitlement(subscription, 0, new Date())).toMatchObject({ displayStatus: 'read_only', canIngest: false, canExecuteActions: false });
  });

  it('does not fire read-only for a canceled subscription still inside its paid period', () => {
    const subscription: SubscriptionRecord = {
      orgId: 'org_1',
      planCode: 'GROWTH',
      status: 'canceled',
      trialEndsAt: null,
      graceEndsAt: null,
      currentPeriodStart: new Date('2026-01-01T00:00:00.000Z'),
      currentPeriodEnd: new Date('2026-02-01T00:00:00.000Z'),
    };
    expect(computeEntitlement(subscription, 0, new Date('2026-01-20T00:00:00.000Z')).displayStatus).toBe('active');
  });

  it('fires: a canceled subscription becomes read-only once its paid period ends', () => {
    const subscription: SubscriptionRecord = {
      orgId: 'org_1',
      planCode: 'GROWTH',
      status: 'canceled',
      trialEndsAt: null,
      graceEndsAt: null,
      currentPeriodStart: new Date('2026-01-01T00:00:00.000Z'),
      currentPeriodEnd: new Date('2026-02-01T00:00:00.000Z'),
    };
    expect(computeEntitlement(subscription, 0, new Date('2026-02-01T00:00:00.000Z'))).toMatchObject({ displayStatus: 'read_only', canIngest: false, canExecuteActions: false });
  });
});
