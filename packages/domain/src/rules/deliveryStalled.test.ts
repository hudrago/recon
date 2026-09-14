import { describe, expect, it } from 'vitest';
import type { Shipment } from '../entities';
import { DELIVERY_STALLED_THRESHOLD_MS, evaluateDeliveryStalled } from './deliveryStalled';

const shipment: Shipment = {
  id: 'ship_1',
  orgId: 'org_1',
  orderId: 'order_1',
  status: 'IN_TRANSIT',
  lastStatusChangeAt: '2026-09-01T10:00:00.000Z',
};

describe('evaluateDeliveryStalled', () => {
  it('fires when the shipment has not changed status past the threshold', () => {
    const now = new Date(new Date(shipment.lastStatusChangeAt).getTime() + DELIVERY_STALLED_THRESHOLD_MS + 1000);
    const exception = evaluateDeliveryStalled({ shipment, now });
    expect(exception).not.toBeNull();
    expect(exception?.code).toBe('DELIVERY_STALLED');
    expect(exception?.orderId).toBe('order_1');
  });

  it('does not fire when the shipment already reached a terminal status', () => {
    const now = new Date(new Date(shipment.lastStatusChangeAt).getTime() + DELIVERY_STALLED_THRESHOLD_MS + 1000);
    expect(evaluateDeliveryStalled({ shipment: { ...shipment, status: 'DELIVERED' }, now })).toBeNull();
  });

  it('does not fire just under the threshold', () => {
    const now = new Date(new Date(shipment.lastStatusChangeAt).getTime() + DELIVERY_STALLED_THRESHOLD_MS - 1000);
    expect(evaluateDeliveryStalled({ shipment, now })).toBeNull();
  });

  it('fires exactly at the threshold boundary', () => {
    const now = new Date(new Date(shipment.lastStatusChangeAt).getTime() + DELIVERY_STALLED_THRESHOLD_MS);
    expect(evaluateDeliveryStalled({ shipment, now })).not.toBeNull();
  });
});
