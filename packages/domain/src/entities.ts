export interface Order {
  id: string;
  orgId: string;
  currency: string;
  total: number;
  paidAt: string;
}

// The point a returned product is confirmed back at the warehouse, not when the customer shipped it.
export interface ReturnRecord {
  id: string;
  orgId: string;
  orderId: string;
  receivedAt: string;
}

export interface Refund {
  id: string;
  orgId: string;
  orderId: string;
  amount: number;
  currency: string;
  issuedAt: string;
}

export interface Invoice {
  id: string;
  orgId: string;
  orderId: string;
  issuedAt: string;
}

export interface InventoryAdjustment {
  id: string;
  orgId: string;
  orderId: string;
  refundId: string;
  adjustedAt: string;
}

export type ShipmentStatus = 'IN_TRANSIT' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'RETURNED' | 'CANCELLED' | 'EXCEPTION';

export interface Shipment {
  id: string;
  orgId: string;
  orderId: string;
  status: ShipmentStatus;
  lastStatusChangeAt: string;
}
