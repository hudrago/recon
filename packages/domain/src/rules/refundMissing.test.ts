import { describe, expect, it } from 'vitest';
import type { Refund, ReturnRecord } from '../entities';
import { REFUND_MISSING_THRESHOLD_MS, evaluateRefundMissing } from './refundMissing';

const returnRecord: ReturnRecord = {
  id: 'ret_1',
  orgId: 'org_1',
  orderId: 'order_1',
  receivedAt: '2026-09-01T10:00:00.000Z',
};

describe('evaluateRefundMissing', () => {
  it('fires when the threshold has passed and no refund exists', () => {
    const now = new Date(new Date(returnRecord.receivedAt).getTime() + REFUND_MISSING_THRESHOLD_MS + 1000);
    const exception = evaluateRefundMissing({ returnRecord, refunds: [], now });
    expect(exception).not.toBeNull();
    expect(exception?.code).toBe('REFUND_MISSING');
    expect(exception?.orderId).toBe('order_1');
  });

  it('does not fire when a matching refund exists', () => {
    const now = new Date(new Date(returnRecord.receivedAt).getTime() + REFUND_MISSING_THRESHOLD_MS + 1000);
    const refunds: Refund[] = [
      { id: 'rf_1', orgId: 'org_1', orderId: 'order_1', amount: 10, currency: 'EUR', issuedAt: now.toISOString() },
    ];
    expect(evaluateRefundMissing({ returnRecord, refunds, now })).toBeNull();
  });

  it('does not fire just under the threshold', () => {
    const now = new Date(new Date(returnRecord.receivedAt).getTime() + REFUND_MISSING_THRESHOLD_MS - 1000);
    expect(evaluateRefundMissing({ returnRecord, refunds: [], now })).toBeNull();
  });

  it('fires exactly at the threshold boundary', () => {
    const now = new Date(new Date(returnRecord.receivedAt).getTime() + REFUND_MISSING_THRESHOLD_MS);
    expect(evaluateRefundMissing({ returnRecord, refunds: [], now })).not.toBeNull();
  });
});
