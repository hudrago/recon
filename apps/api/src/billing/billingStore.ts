import type { PlanCode } from './plans';
import type { SubscriptionLifecycleStatus, SubscriptionRecord } from './billingEntitlement';

export interface ProcessedOrderInput {
  orgId: string;
  provider: string;
  externalOrderId: string;
  amountCents: number;
  currency: string;
  paidAt: Date;
}

export interface BillingInvoiceInput {
  orgId: string;
  stripeInvoiceId: string;
  amountCents: number;
  currency: string;
  status: string;
  hostedInvoiceUrl: string | null;
  periodStart: Date;
  periodEnd: Date;
}

// NestJS DI token — BillingStore is an interface, so there's no class to bind a provider to directly.
export const BILLING_STORE = Symbol('BILLING_STORE');

export interface BillingStore {
  /** Creates the subscription only if one doesn't already exist for this org (idempotent). */
  ensureSubscription(record: SubscriptionRecord): Promise<SubscriptionRecord>;
  getSubscription(orgId: string): Promise<SubscriptionRecord | undefined>;
  updateSubscription(orgId: string, patch: Partial<Omit<SubscriptionRecord, 'orgId'>>): Promise<SubscriptionRecord>;
  setStripeIdentifiers(orgId: string, stripeCustomerId: string, stripeSubscriptionId: string | null): Promise<void>;
  findByStripeCustomerId(stripeCustomerId: string): Promise<SubscriptionRecord | undefined>;
  /** Records a paid order once; a duplicate (same orgId/provider/externalOrderId) is a no-op. */
  recordProcessedOrder(order: ProcessedOrderInput): Promise<void>;
  /** Count of distinct paid orders recorded for the org within [periodStart, periodEnd). */
  countProcessedOrders(orgId: string, periodStart: Date, periodEnd: Date): Promise<number>;
  /** Records a Stripe invoice once; a duplicate (same stripeInvoiceId) is a no-op. */
  recordInvoice(invoice: BillingInvoiceInput): Promise<void>;
  claimBillingWebhook(provider: string, eventId: string, orgId: string | null): Promise<boolean>;
  completeBillingWebhook(provider: string, eventId: string): Promise<void>;
  /** Releases a claimed-but-failed webhook so a provider retry can reprocess it. */
  releaseBillingWebhook(provider: string, eventId: string): Promise<void>;
}

export type { PlanCode, SubscriptionLifecycleStatus, SubscriptionRecord };
