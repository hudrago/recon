// Provider adapters (Shopify, carriers, InvoiceXpress/Moloni) — translate to/from packages/domain.
export * from './shopify/mapReturn';
export * from './shopify/mapOrderPaid';
export * from './shopify/mapRefundCreated';
export * from './shopify/verifyWebhookSignature';
export * from './carrier/parseCarrierCsv';
