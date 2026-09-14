import { describe, expect, it } from 'vitest';
import type { Invoice, Order } from '../entities';
import { INVOICE_MISSING_THRESHOLD_MS, evaluateInvoiceMissing } from './invoiceMissing';

const order: Order = {
  id: 'order_1',
  orgId: 'org_1',
  currency: 'EUR',
  total: 42,
  paidAt: '2026-09-01T10:00:00.000Z',
};

describe('evaluateInvoiceMissing', () => {
  it('fires when the threshold has passed and no invoice exists', () => {
    const now = new Date(new Date(order.paidAt).getTime() + INVOICE_MISSING_THRESHOLD_MS + 1000);
    const exception = evaluateInvoiceMissing({ order, invoices: [], now });
    expect(exception).not.toBeNull();
    expect(exception?.code).toBe('INVOICE_MISSING');
    expect(exception?.orderId).toBe('order_1');
  });

  it('does not fire when a matching invoice exists', () => {
    const now = new Date(new Date(order.paidAt).getTime() + INVOICE_MISSING_THRESHOLD_MS + 1000);
    const invoices: Invoice[] = [{ id: 'inv_1', orgId: 'org_1', orderId: 'order_1', issuedAt: now.toISOString() }];
    expect(evaluateInvoiceMissing({ order, invoices, now })).toBeNull();
  });

  it('does not fire just under the threshold', () => {
    const now = new Date(new Date(order.paidAt).getTime() + INVOICE_MISSING_THRESHOLD_MS - 1000);
    expect(evaluateInvoiceMissing({ order, invoices: [], now })).toBeNull();
  });

  it('fires exactly at the threshold boundary', () => {
    const now = new Date(new Date(order.paidAt).getTime() + INVOICE_MISSING_THRESHOLD_MS);
    expect(evaluateInvoiceMissing({ order, invoices: [], now })).not.toBeNull();
  });
});
