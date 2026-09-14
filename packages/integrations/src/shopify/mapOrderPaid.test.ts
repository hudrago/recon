import { describe, expect, it } from 'vitest';
import { malformedShopifyOrderPaidFixture, shopifyFreeOrderPaidFixture, shopifyOrderPaidFixture } from './__fixtures__/orderPaid.fixture';
import { mapShopifyOrderPaidToDomain } from './mapOrderPaid';

describe('mapShopifyOrderPaidToDomain', () => {
  it('maps a paid order fixture to the canonical Order', () => {
    expect(mapShopifyOrderPaidToDomain(shopifyOrderPaidFixture, 'org_1')).toEqual({
      id: '820982911946154508',
      orgId: 'org_1',
      currency: 'EUR',
      total: 104.95,
      paidAt: '2026-09-14T10:00:00.000Z',
    });
  });

  it('accepts a valid free order', () => {
    expect(mapShopifyOrderPaidToDomain(shopifyFreeOrderPaidFixture, 'org_1')?.total).toBe(0);
  });

  it('returns null for an incomplete payload', () => {
    expect(mapShopifyOrderPaidToDomain(malformedShopifyOrderPaidFixture, 'org_1')).toBeNull();
  });

  it('rejects an unsafe numeric id that may already be rounded', () => {
    expect(mapShopifyOrderPaidToDomain({ ...shopifyOrderPaidFixture, id: 820982911946154508 }, 'org_1')).toBeNull();
  });
});