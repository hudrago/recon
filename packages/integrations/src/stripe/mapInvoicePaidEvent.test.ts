import { describe, expect, it } from 'vitest';
import { malformedStripeInvoiceFixture, stripeInvoicePaidFixture } from './__fixtures__/invoicePaid.fixture';
import { mapStripeInvoicePaidEvent } from './mapInvoicePaidEvent';

describe('mapStripeInvoicePaidEvent', () => {
  it('maps a paid invoice fixture to the raw event shape', () => {
    expect(mapStripeInvoicePaidEvent(stripeInvoicePaidFixture)).toEqual({
      stripeCustomerId: 'cus_1P0000000000000001',
      stripeInvoiceId: 'in_1P0000000000000001',
      amountCents: 24_900,
      currency: 'EUR',
      status: 'paid',
      hostedInvoiceUrl: 'https://invoice.stripe.com/i/acct_1/test_1',
      periodStart: '2026-01-01T00:00:00.000Z',
      periodEnd: '2026-02-01T00:00:00.000Z',
    });
  });

  it('returns null for a malformed payload', () => {
    expect(mapStripeInvoicePaidEvent(malformedStripeInvoiceFixture)).toBeNull();
  });
});
