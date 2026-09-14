// Canonical domain entities and reconciliation rules live here — no I/O, no provider SDKs.
export * from './entities';
export * from './exceptions';
export * from './rules/refundMissing';
export * from './rules/invoiceMissing';
export * from './rules/restockMissing';
export * from './rules/deliveryStalled';
