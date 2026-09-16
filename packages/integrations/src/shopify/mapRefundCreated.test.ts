import { describe, expect, it } from 'vitest';
import { malformedShopifyRefundFixture, shopifyPartialRefundFixture, shopifyRefundCreatedFixture } from './__fixtures__/refundCreated.fixture';
import { mapShopifyRefundCreatedToDomain } from './mapRefundCreated';

describe('mapShopifyRefundCreatedToDomain', () => {
  it('maps successful transactions to one canonical Refund', () => {
    expect(mapShopifyRefundCreatedToDomain(shopifyRefundCreatedFixture, 'org_1')).toEqual({
      id: 'gid://shopify/Refund/890088186047892319',
      orgId: 'org_1',
      orderId: '820982911946154508',
      amount: 30,
      currency: 'EUR',
      issuedAt: '2026-09-14T11:00:00.000Z',
    });
  });

  it('excludes failed transactions and falls back to line-item currency', () => {
    expect(mapShopifyRefundCreatedToDomain(shopifyPartialRefundFixture, 'org_1')).toMatchObject({ amount: 12.5, currency: 'EUR' });
  });

  it('returns null for an incomplete payload', () => {
    expect(mapShopifyRefundCreatedToDomain(malformedShopifyRefundFixture, 'org_1')).toBeNull();
  });

  it('rejects an unsafe numeric order id that may already be rounded', () => {
    expect(mapShopifyRefundCreatedToDomain({ ...shopifyRefundCreatedFixture, order_id: 820982911946154508 }, 'org_1')).toBeNull();
  });
});