import { Inject, Injectable } from '@nestjs/common';
import type { StripeInvoicePaidEvent, StripeSubscriptionEvent } from '@recon/integrations';
import { computeEntitlement, type Entitlement, type SubscriptionLifecycleStatus, type SubscriptionRecord } from './billingEntitlement';
import { BILLING_STORE, type BillingStore } from './billingStore';
import { GRACE_DURATION_MS, listSelfServePlans, PLAN_CATALOG, type PlanCode, TRIAL_DURATION_MS, TRIAL_PLAN_CODE } from './plans';
import { STRIPE_GATEWAY, type StripeGateway } from './stripeGateway';
import { planCodeForStripePrice, stripePriceIdForPlan } from './stripePricing';

export interface ProcessedOrderEvent {
  orgId: string;
  provider: string;
  externalOrderId: string;
  amountCents: number;
  currency: string;
  paidAt: Date;
}

// Stripe subscription statuses that mean "no successful payment ever went through" are treated
// the same as past_due — conservative default, never silently grants active access.
function mapStripeStatusToLifecycle(stripeStatus: string): SubscriptionLifecycleStatus {
  switch (stripeStatus) {
    case 'trialing':
      return 'trialing';
    case 'active':
      return 'active';
    case 'canceled':
      return 'canceled';
    case 'past_due':
    case 'unpaid':
    case 'incomplete':
    case 'incomplete_expired':
    case 'paused':
    default:
      return 'past_due';
  }
}

@Injectable()
export class BillingService {
  constructor(
    @Inject(BILLING_STORE) private readonly store: BillingStore,
    @Inject(STRIPE_GATEWAY) private readonly stripeGateway: StripeGateway,
  ) {}

  // Idempotent: safe to call every time an organization is created, and safe to call again if a
  // prior attempt was interrupted (e.g. the afterCreateOrganization hook throwing after this ran).
  async ensureTrial(orgId: string, now: Date): Promise<SubscriptionRecord> {
    const trialEndsAt = new Date(now.getTime() + TRIAL_DURATION_MS);
    const graceEndsAt = new Date(trialEndsAt.getTime() + GRACE_DURATION_MS);
    return this.store.ensureSubscription({
      orgId,
      planCode: TRIAL_PLAN_CODE,
      status: 'trialing',
      trialEndsAt,
      graceEndsAt,
      currentPeriodStart: now,
      currentPeriodEnd: trialEndsAt,
    });
  }

  async recordProcessedOrder(event: ProcessedOrderEvent): Promise<void> {
    await this.store.recordProcessedOrder(event);
  }

  async claimBillingWebhook(provider: string, eventId: string, orgId: string | null): Promise<boolean> {
    return this.store.claimBillingWebhook(provider, eventId, orgId);
  }

  async completeBillingWebhook(provider: string, eventId: string): Promise<void> {
    await this.store.completeBillingWebhook(provider, eventId);
  }

  async releaseBillingWebhook(provider: string, eventId: string): Promise<void> {
    await this.store.releaseBillingWebhook(provider, eventId);
  }

  async createCheckoutSession(
    orgId: string,
    planCode: PlanCode,
    successUrl: string,
    cancelUrl: string,
    env: NodeJS.ProcessEnv = process.env,
  ): Promise<{ url: string }> {
    const priceId = stripePriceIdForPlan(planCode, env);
    if (!priceId) throw new Error(`No self-serve Stripe price configured for plan ${planCode}`);
    return this.stripeGateway.createCheckoutSession({ orgId, priceId, successUrl, cancelUrl });
  }

  // Applies a `customer.subscription.*` webhook event. A missing orgId (subscription created
  // outside our checkout flow, or metadata stripped) is logged and skipped rather than guessed.
  async applyStripeSubscriptionEvent(event: StripeSubscriptionEvent, env: NodeJS.ProcessEnv = process.env): Promise<void> {
    if (!event.orgId) return;
    const planCode = planCodeForStripePrice(event.priceId, env);
    const status = mapStripeStatusToLifecycle(event.stripeStatus);
    await this.store.updateSubscription(event.orgId, {
      ...(planCode ? { planCode } : {}),
      status,
      currentPeriodStart: new Date(event.currentPeriodStart),
      currentPeriodEnd: new Date(event.currentPeriodEnd),
    });
    await this.store.setStripeIdentifiers(event.orgId, event.stripeCustomerId, event.stripeSubscriptionId);
  }

  // Applies an `invoice.paid` webhook event. The org is resolved via the Stripe customer id
  // (set by a prior subscription event) rather than trusting anything Stripe-side to name it.
  async applyStripeInvoicePaidEvent(event: StripeInvoicePaidEvent): Promise<void> {
    const subscription = await this.store.findByStripeCustomerId(event.stripeCustomerId);
    if (!subscription) return;
    await this.store.recordInvoice({
      orgId: subscription.orgId,
      stripeInvoiceId: event.stripeInvoiceId,
      amountCents: event.amountCents,
      currency: event.currency,
      status: event.status,
      hostedInvoiceUrl: event.hostedInvoiceUrl,
      periodStart: new Date(event.periodStart),
      periodEnd: new Date(event.periodEnd),
    });
  }

  async getEntitlement(orgId: string, now: Date): Promise<Entitlement> {
    let subscription = await this.store.getSubscription(orgId);
    // Self-heals an organization whose trial provisioning hook never ran (e.g. it was created
    // before billing existed, or the hook failed). Anchoring the trial at "now" is deliberately
    // permissive — a late trial start only ever grants extra time, never revokes access early.
    if (!subscription) subscription = await this.ensureTrial(orgId, now);
    const orderCount = await this.store.countProcessedOrders(orgId, subscription.currentPeriodStart, subscription.currentPeriodEnd);
    return computeEntitlement(subscription, orderCount, now);
  }

  async canExecuteActions(orgId: string, now: Date): Promise<boolean> {
    return (await this.getEntitlement(orgId, now)).canExecuteActions;
  }

  async canIngest(orgId: string, now: Date): Promise<boolean> {
    return (await this.getEntitlement(orgId, now)).canIngest;
  }

  getPlanCatalog() {
    return { plans: listSelfServePlans(), enterprise: PLAN_CATALOG.ENTERPRISE };
  }
}
