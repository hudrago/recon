import { describe, expect, it } from 'vitest';
import type { InventoryAdjustment, Refund } from '../entities';
import { RESTOCK_MISSING_THRESHOLD_MS, evaluateRestockMissing } from './restockMissing';

const refund: Refund = {
  id: 'rf_1',
  orgId: 'org_1',
  orderId: 'order_1',
  amount: 20,
  currency: 'EUR',
  issuedAt: '2026-09-01T10:00:00.000Z',
};

describe('evaluateRestockMissing', () => {
  it('fires when the threshold has passed and no inventory adjustment exists', () => {
    const now = new Date(new Date(refund.issuedAt).getTime() + RESTOCK_MISSING_THRESHOLD_MS + 1000);
    const exception = evaluateRestockMissing({ refund, adjustments: [], now });
    expect(exception).not.toBeNull();
    expect(exception?.code).toBe('RESTOCK_MISSING');
    expect(exception?.orderId).toBe('order_1');
  });

  it('does not fire when a matching inventory adjustment exists', () => {
    const now = new Date(new Date(refund.issuedAt).getTime() + RESTOCK_MISSING_THRESHOLD_MS + 1000);
    const adjustments: InventoryAdjustment[] = [
      { id: 'adj_1', orgId: 'org_1', orderId: 'order_1', refundId: 'rf_1', adjustedAt: now.toISOString() },
    ];
    expect(evaluateRestockMissing({ refund, adjustments, now })).toBeNull();
  });

  it('does not fire just under the threshold', () => {
    const now = new Date(new Date(refund.issuedAt).getTime() + RESTOCK_MISSING_THRESHOLD_MS - 1000);
    expect(evaluateRestockMissing({ refund, adjustments: [], now })).toBeNull();
  });

  it('fires exactly at the threshold boundary', () => {
    const now = new Date(new Date(refund.issuedAt).getTime() + RESTOCK_MISSING_THRESHOLD_MS);
    expect(evaluateRestockMissing({ refund, adjustments: [], now })).not.toBeNull();
  });
});
