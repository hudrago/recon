import type { BillingInvoiceInput, BillingStore, ProcessedOrderInput } from './billingStore';
import type { SubscriptionRecord } from './billingEntitlement';

// Used by tests and local dev without a database; state is lost on restart.
export class InMemoryBillingStore implements BillingStore {
  private subscriptions = new Map<string, SubscriptionRecord>();
  private processedOrders = new Map<string, ProcessedOrderInput>();
  private invoices = new Map<string, BillingInvoiceInput>();
  private billingWebhookReceipts = new Map<string, 'PROCESSING' | 'SUCCEEDED'>();
  private orgIdByStripeCustomerId = new Map<string, string>();

  async ensureSubscription(record: SubscriptionRecord): Promise<SubscriptionRecord> {
    const existing = this.subscriptions.get(record.orgId);
    if (existing) return existing;
    this.subscriptions.set(record.orgId, record);
    return record;
  }

  async getSubscription(orgId: string): Promise<SubscriptionRecord | undefined> {
    return this.subscriptions.get(orgId);
  }

  async updateSubscription(orgId: string, patch: Partial<Omit<SubscriptionRecord, 'orgId'>>): Promise<SubscriptionRecord> {
    const existing = this.subscriptions.get(orgId);
    if (!existing) throw new Error(`No subscription for org ${orgId}`);
    const updated = { ...existing, ...patch };
    this.subscriptions.set(orgId, updated);
    return updated;
  }

  async setStripeIdentifiers(orgId: string, stripeCustomerId: string): Promise<void> {
    // Only the stripeCustomerId->org mapping is tracked (for findByStripeCustomerId); the
    // subscription id itself isn't modeled on InMemoryBillingStore's minimal SubscriptionRecord —
    // dev/test mode never talks to Stripe otherwise. See PrismaBillingStore for the real store.
    this.orgIdByStripeCustomerId.set(stripeCustomerId, orgId);
  }

  async findByStripeCustomerId(stripeCustomerId: string): Promise<SubscriptionRecord | undefined> {
    const orgId = this.orgIdByStripeCustomerId.get(stripeCustomerId);
    return orgId ? this.subscriptions.get(orgId) : undefined;
  }

  async recordProcessedOrder(order: ProcessedOrderInput): Promise<void> {
    const key = `${order.orgId}:${order.provider}:${order.externalOrderId}`;
    if (this.processedOrders.has(key)) return;
    this.processedOrders.set(key, order);
  }

  async countProcessedOrders(orgId: string, periodStart: Date, periodEnd: Date): Promise<number> {
    return [...this.processedOrders.values()].filter(
      (order) => order.orgId === orgId && order.paidAt >= periodStart && order.paidAt < periodEnd,
    ).length;
  }

  async recordInvoice(invoice: BillingInvoiceInput): Promise<void> {
    if (this.invoices.has(invoice.stripeInvoiceId)) return;
    this.invoices.set(invoice.stripeInvoiceId, invoice);
  }

  /** Test-only introspection helper — not part of the BillingStore interface. */
  getRecordedInvoiceCount(): number {
    return this.invoices.size;
  }

  async claimBillingWebhook(provider: string, eventId: string): Promise<boolean> {
    const key = `${provider}:${eventId}`;
    if (this.billingWebhookReceipts.has(key)) return false;
    this.billingWebhookReceipts.set(key, 'PROCESSING');
    return true;
  }

  async completeBillingWebhook(provider: string, eventId: string): Promise<void> {
    this.billingWebhookReceipts.set(`${provider}:${eventId}`, 'SUCCEEDED');
  }

  async releaseBillingWebhook(provider: string, eventId: string): Promise<void> {
    this.billingWebhookReceipts.delete(`${provider}:${eventId}`);
  }
}
