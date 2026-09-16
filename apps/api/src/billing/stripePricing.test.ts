import { afterEach, describe, expect, it } from 'vitest';
import { planCodeForStripePrice, stripePriceIdForPlan } from './stripePricing';

describe('stripePricing', () => {
  const env = { STRIPE_PRICE_STARTER: 'price_starter', STRIPE_PRICE_GROWTH: 'price_growth', STRIPE_PRICE_PRO: 'price_pro' };

  afterEach(() => {
    // no shared mutable state — kept for symmetry with other env-driven test suites.
  });

  it('resolves the Stripe price id configured for a self-serve plan', () => {
    expect(stripePriceIdForPlan('GROWTH', env)).toBe('price_growth');
  });

  it('returns null for Enterprise, which has no self-serve Stripe price', () => {
    expect(stripePriceIdForPlan('ENTERPRISE', env)).toBeNull();
  });

  it('resolves the plan code for a known Stripe price id', () => {
    expect(planCodeForStripePrice('price_pro', env)).toBe('PRO');
  });

  it('returns null for an unrecognized Stripe price id', () => {
    expect(planCodeForStripePrice('price_unknown', env)).toBeNull();
  });
});
