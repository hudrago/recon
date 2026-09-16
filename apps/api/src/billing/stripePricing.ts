import { listSelfServePlans, type PlanCode } from './plans';

// Maps a self-serve plan code to the env var name holding its Stripe price id — config.ts already
// enforces all three are set whenever BILLING_ENABLED is true.
const STRIPE_PRICE_ENV_BY_PLAN: Record<PlanCode, string | null> = {
  STARTER: 'STRIPE_PRICE_STARTER',
  GROWTH: 'STRIPE_PRICE_GROWTH',
  PRO: 'STRIPE_PRICE_PRO',
  ENTERPRISE: null,
};

export function stripePriceIdForPlan(planCode: PlanCode, env: NodeJS.ProcessEnv = process.env): string | null {
  const envVar = STRIPE_PRICE_ENV_BY_PLAN[planCode];
  return envVar ? (env[envVar] ?? null) : null;
}

export function planCodeForStripePrice(priceId: string, env: NodeJS.ProcessEnv = process.env): PlanCode | null {
  const plan = listSelfServePlans().find((candidate) => stripePriceIdForPlan(candidate.code, env) === priceId);
  return plan?.code ?? null;
}
