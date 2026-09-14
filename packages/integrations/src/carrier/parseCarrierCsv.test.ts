import { describe, expect, it } from 'vitest';
import { malformedCarrierCsv, validCarrierCsv } from './__fixtures__/carrierStatus.fixture';
import { parseCarrierStatusCsv } from './parseCarrierCsv';

describe('parseCarrierStatusCsv', () => {
  it('parses valid rows into Shipment records', () => {
    const { shipments, errors } = parseCarrierStatusCsv(validCarrierCsv, 'org_1');
    expect(errors).toHaveLength(0);
    expect(shipments).toHaveLength(2);
    expect(shipments[0]).toEqual({
      id: 'TRACK123',
      orgId: 'org_1',
      orderId: 'order_1',
      status: 'IN_TRANSIT',
      lastStatusChangeAt: '2026-09-01T10:00:00.000Z',
    });
  });

  it('collects errors for malformed rows without throwing', () => {
    const { shipments, errors } = parseCarrierStatusCsv(malformedCarrierCsv, 'org_1');
    expect(shipments).toHaveLength(0);
    expect(errors).toHaveLength(3);
  });
});
