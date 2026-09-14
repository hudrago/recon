import type { Shipment } from '../entities';
import type { DomainException } from '../exceptions';

export const DELIVERY_STALLED_THRESHOLD_MS = 72 * 60 * 60 * 1000;

const TERMINAL_SHIPMENT_STATUSES = new Set<Shipment['status']>(['DELIVERED', 'RETURNED', 'CANCELLED']);

export interface DeliveryStalledInput {
  shipment: Shipment;
  now: Date;
}

// Deterministic per shipment, so re-running the rule on the same event never creates a duplicate exception.
export function deliveryStalledExceptionId(shipment: Shipment): string {
  return `DELIVERY_STALLED:${shipment.orgId}:${shipment.id}`;
}

export function evaluateDeliveryStalled({ shipment, now }: DeliveryStalledInput): DomainException | null {
  if (TERMINAL_SHIPMENT_STATUSES.has(shipment.status)) return null;

  const elapsed = now.getTime() - new Date(shipment.lastStatusChangeAt).getTime();
  if (elapsed < DELIVERY_STALLED_THRESHOLD_MS) return null;

  return {
    id: deliveryStalledExceptionId(shipment),
    orgId: shipment.orgId,
    code: 'DELIVERY_STALLED',
    orderId: shipment.orderId,
    detectedAt: now.toISOString(),
    status: 'open',
    context: { shipmentId: shipment.id, elapsedMs: elapsed },
  };
}
