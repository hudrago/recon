import { PLAN_CATALOG, type PlanCode, USAGE_WARNING_THRESHOLD } from './plans';

export type SubscriptionLifecycleStatus = 'trialing' | 'active' | 'past_due' | 'canceled';

// Persisted shape (mirrors the `Subscription` Prisma model, using plain strings/Dates so this
// stays storage-agnostic and testable without Prisma).
export interface SubscriptionRecord {
  orgId: string;
  planCode: PlanCode;
  status: SubscriptionLifecycleStatus;
  trialEndsAt: Date | null;
  graceEndsAt: Date | null;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
}

// What the rest of the app is allowed to check "is this org allowed to X". Never derive access
// from `SubscriptionRecord.status` directly outside this module — always go through here so the
// trial/grace/over-limit rules stay in one place and are unit-testable in isolation.
export interface Entitlement {
  planCode: PlanCode;
  /** Coarse lifecycle bucket surfaced to the UI: trialing | grace | active | read_only. */
  displayStatus: 'trialing' | 'grace' | 'active' | 'read_only';
  monthlyOrderLimit: number | null;
  processedOrderCount: number;
  usagePercent: number;
  usageWarning: boolean;
  overLimit: boolean;
  /** Whether newly ingested provider events should still be evaluated for problems. */
  canIngest: boolean;
  /** Whether a provider-side action (refund, restock, invoice) may be executed. */
  canExecuteActions: boolean;
  trialEndsAt: Date | null;
  graceEndsAt: Date | null;
}

export function computeEntitlement(subscription: SubscriptionRecord, processedOrderCount: number, now: Date): Entitlement {
  const plan = PLAN_CATALOG[subscription.planCode];
  const limit = plan.monthlyOrderLimit;
  const usagePercent = limit ? Math.min(100, Math.round((processedOrderCount / limit) * 100)) : 0;
  const overLimit = limit !== null && processedOrderCount >= limit;
  const usageWarning = limit !== null && processedOrderCount >= limit * USAGE_WARNING_THRESHOLD;

  const base = { planCode: subscription.planCode, monthlyOrderLimit: limit, processedOrderCount, usagePercent, usageWarning, overLimit, trialEndsAt: subscription.trialEndsAt, graceEndsAt: subscription.graceEndsAt };

  if (subscription.status === 'trialing') {
    if (subscription.trialEndsAt && now < subscription.trialEndsAt) {
      return { ...base, displayStatus: 'trialing', canIngest: true, canExecuteActions: true, overLimit: false, usageWarning: false };
    }
    if (subscription.graceEndsAt && now < subscription.graceEndsAt) {
      return { ...base, displayStatus: 'grace', canIngest: true, canExecuteActions: true, overLimit: false, usageWarning: false };
    }
    return { ...base, displayStatus: 'read_only', canIngest: false, canExecuteActions: false };
  }

  if (subscription.status === 'past_due') {
    if (subscription.graceEndsAt && now < subscription.graceEndsAt) {
      return { ...base, displayStatus: 'grace', canIngest: true, canExecuteActions: !overLimit };
    }
    return { ...base, displayStatus: 'read_only', canIngest: false, canExecuteActions: false };
  }

  if (subscription.status === 'canceled' && now >= subscription.currentPeriodEnd) {
    return { ...base, displayStatus: 'read_only', canIngest: false, canExecuteActions: false, overLimit: false, usageWarning: false };
  }

  // 'active', or 'canceled' but still inside the paid-through period.
  return { ...base, displayStatus: 'active', canIngest: true, canExecuteActions: !overLimit };
}
