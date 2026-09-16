import { describe, expect, it } from 'vitest';
import { invoiceXpressInvoiceCreatedFixture, invoiceXpressStringIdFixture, malformedInvoiceXpressFixture } from './__fixtures__/invoiceCreated.fixture';
import { mapInvoiceXpressInvoiceToDomain } from './mapInvoiceCreated';

describe('mapInvoiceXpressInvoiceToDomain', () => {
  it('maps an invoice-created fixture to the canonical Invoice', () => {
    expect(mapInvoiceXpressInvoiceToDomain(invoiceXpressInvoiceCreatedFixture, 'org_1')).toEqual({
      id: '987654',
      orgId: 'org_1',
      orderId: 'order_1',
      issuedAt: '2026-09-16T00:00:00.000Z',
    });
  });

  it('accepts a string invoice id', () => {
    expect(mapInvoiceXpressInvoiceToDomain(invoiceXpressStringIdFixture, 'org_1')?.id).toBe('987655');
  });

  it('returns null for a payload missing the order reference or with an invalid date', () => {
    expect(mapInvoiceXpressInvoiceToDomain(malformedInvoiceXpressFixture, 'org_1')).toBeNull();
  });

  it('returns null for a completely unrelated payload', () => {
    expect(mapInvoiceXpressInvoiceToDomain({ foo: 'bar' }, 'org_1')).toBeNull();
  });
});
