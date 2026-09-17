import { describe, expect, it } from 'vitest';
import {
  malformedShopifyRefundFixture,
  shopifyRefundCreatedFixture,
  shopifyRefundNoRestockFixture,
} from './__fixtures__/refundCreated.fixture';
import { mapShopifyRefundCreatedToInventoryAdjustment } from './mapInventoryAdjustment';

describe('mapShopifyRefundCreatedToInventoryAdjustment', () => {
  it('maps a refund with a restocked line item to an InventoryAdjustment', () => {
    expect(mapShopifyRefundCreatedToInventoryAdjustment(shopifyRefundCreatedFixture, 'org_1')).toEqual({
      id: 'gid://shopify/Refund/890088186047892319:restock',
      orgId: 'org_1',
      orderId: '820982911946154508',
      refundId: 'gid://shopify/Refund/890088186047892319',
      quantity: 1,
      adjustedAt: '2026-09-14T11:00:00.000Z',
    });
  });

  it('returns null when every line item is marked no_restock', () => {
    expect(mapShopifyRefundCreatedToInventoryAdjustment(shopifyRefundNoRestockFixture, 'org_1')).toBeNull();
  });

  it('returns null for an incomplete payload', () => {
    expect(mapShopifyRefundCreatedToInventoryAdjustment(malformedShopifyRefundFixture, 'org_1')).toBeNull();
  });
});
