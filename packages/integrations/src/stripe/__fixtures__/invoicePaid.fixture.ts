export const stripeInvoicePaidFixture = {
  id: 'in_1P0000000000000001',
  customer: 'cus_1P0000000000000001',
  amount_paid: 24_900,
  currency: 'eur',
  status: 'paid',
  hosted_invoice_url: 'https://invoice.stripe.com/i/acct_1/test_1',
  period_start: 1_767_225_600, // 2026-01-01T00:00:00Z
  period_end: 1_769_904_000, // 2026-02-01T00:00:00Z
};

export const malformedStripeInvoiceFixture = {
  id: 'in_1P0000000000000002',
  customer: 'cus_1P0000000000000001',
  amount_paid: 'not-a-number',
  status: 'paid',
};
