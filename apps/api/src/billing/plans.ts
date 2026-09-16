export type PlanCode = 'STARTER' | 'GROWTH' | 'PRO' | 'ENTERPRISE';

export interface Plan {
  code: PlanCode;
  name: string;
  priceCents: number | null; // null for Enterprise — contact sales, no self-serve price.
  currency: 'EUR';
  /** Paid orders allowed per billing period. `null` means no fixed limit (Enterprise). */
  monthlyOrderLimit: number | null;
  selfServe: boolean;
}

// Single source of truth for plan pricing/limits — the web app and any billing surface must read
// this catalog rather than hardcoding prices or limits.
export const PLAN_CATALOG: Record<PlanCode, Plan> = {
  STARTER: { code: 'STARTER', name: 'Starter', priceCents: 9_900, currency: 'EUR', monthlyOrderLimit: 1_000, selfServe: true },
  GROWTH: { code: 'GROWTH', name: 'Growth', priceCents: 24_900, currency: 'EUR', monthlyOrderLimit: 5_000, selfServe: true },
  PRO: { code: 'PRO', name: 'Pro', priceCents: 59_900, currency: 'EUR', monthlyOrderLimit: 20_000, selfServe: true },
  ENTERPRISE: { code: 'ENTERPRISE', name: 'Enterprise', priceCents: null, currency: 'EUR', monthlyOrderLimit: null, selfServe: false },
};

export const TRIAL_PLAN_CODE: PlanCode = 'GROWTH';
export const TRIAL_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
export const GRACE_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
export const USAGE_WARNING_THRESHOLD = 0.8;

export function listSelfServePlans(): Plan[] {
  return Object.values(PLAN_CATALOG).filter((plan) => plan.selfServe);
}
