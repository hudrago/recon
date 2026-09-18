import { describe, expect, it } from 'vitest';
import type { DomainException } from '@recon/domain';
import { suggestApprovalTerms } from './suggestApprovalTerms';

function makeException(code: DomainException['code'], context: Record<string, unknown> = {}): DomainException {
  return {
    id: `${code}:org_1:x`,
    orgId: 'org_1',
    code,
    orderId: 'order_1',
    detectedAt: '2026-09-01T10:00:00.000Z',
    status: 'open',
    context,
  };
}

describe('suggestApprovalTerms', () => {
  it('never suggests refund terms — Recon has no per-order line total to draw from', () => {
    expect(suggestApprovalTerms(makeException('REFUND_MISSING'), [], [])).toEqual({});
  });

  it('never suggests restock terms — Recon has no unit-quantity source to draw from', () => {
    expect(
      suggestApprovalTerms(makeException('RESTOCK_MISSING', { refundId: 'rf_1' }), [
        { id: 'rf_1', orgId: 'org_1', orderId: 'order_1', amount: 20, currency: 'EUR', issuedAt: '2026-09-01T10:00:00.000Z' },
      ], []),
    ).toEqual({});
  });

  it('returns no suggestion for codes with no approval terms at all', () => {
    expect(suggestApprovalTerms(makeException('INVOICE_MISSING'), [], [])).toEqual({});
    expect(suggestApprovalTerms(makeException('DELIVERY_STALLED'), [], [])).toEqual({});
  });
});
