// Provider adapters (Shopify, carriers, InvoiceXpress/Moloni) — translate to/from packages/domain.
export * from './shopify/mapReturn';
export * from './shopify/mapOrderPaid';
export * from './shopify/mapRefundCreated';
export * from './shopify/verifyWebhookSignature';
export * from './carrier/parseCarrierCsv';
// Stripe adapter — billing/subscription events, not part of the reconciliation domain model.
export * from './stripe/verifyWebhookSignature';
export * from './stripe/mapSubscriptionEvent';
export * from './stripe/mapInvoicePaidEvent';
// InvoiceXpress adapter — Portuguese fiscal invoices tied to an Order, feeds INVOICE_MISSING.
export * from './invoicexpress/verifyWebhookToken';
export * from './invoicexpress/mapInvoiceCreated';
