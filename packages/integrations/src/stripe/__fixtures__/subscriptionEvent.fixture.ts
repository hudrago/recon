export const stripeSubscriptionActiveFixture = {
  id: 'sub_1P0000000000000001',
  customer: 'cus_1P0000000000000001',
  status: 'active',
  cancel_at: null,
  canceled_at: null,
  metadata: { orgId: 'org_1' },
  items: {
    data: [
      {
        price: { id: 'price_growth' },
        current_period_start: 1_767_225_600, // 2026-01-01T00:00:00Z
        current_period_end: 1_769_904_000, // 2026-02-01T00:00:00Z
      },
    ],
  },
};

export const stripeSubscriptionCanceledFixture = {
  ...stripeSubscriptionActiveFixture,
  id: 'sub_1P0000000000000002',
  status: 'canceled',
  canceled_at: 1_767_312_000, // 2026-01-02T00:00:00Z
};

export const malformedStripeSubscriptionFixture = {
  id: 'sub_1P0000000000000003',
  customer: 'cus_1P0000000000000001',
  status: 'active',
  items: { data: [] },
};
