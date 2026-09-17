import type { ShipmentStatus } from '@recon/domain';

export interface CarrierTrackingUpdate {
  trackingNumber: string;
  // Callers are expected to already speak Recon's ShipmentStatus vocabulary — a real carrier
  // integration maps its own raw status strings in packages/integrations/carrier before this point.
  status: ShipmentStatus;
  statusChangedAt: string;
}

export interface CarrierTrackingGateway {
  fetchStatuses(trackingNumbers: string[]): Promise<CarrierTrackingUpdate[]>;
}

// NestJS DI token — mirrors REFUND_GATEWAY/RESTOCK_GATEWAY.
export const CARRIER_TRACKING_GATEWAY = Symbol('CARRIER_TRACKING_GATEWAY');
