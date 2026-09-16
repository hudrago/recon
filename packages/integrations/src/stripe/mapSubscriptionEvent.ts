import { z } from 'zod';

const stripeSubscriptionObjectSchema = z.object({
  id: z.string().min(1),
  customer: z.string().min(1),
  status: z.string().min(1),
  cancel_at: z.number().nullable().optional(),
  canceled_at: z.number().nullable().optional(),
  metadata: z.record(z.string()).optional(),
  items: z.object({
    data: z
      .array(
        z.object({
          price: z.object({ id: z.string().min(1) }),
          current_period_start: z.number(),
          current_period_end: z.number(),
        }),
      )
      .min(1),
  }),
});

export type StripeSubscriptionObjectPayload = z.input<typeof stripeSubscriptionObjectSchema>;

// Raw shape translated out of a Stripe `customer.subscription.*` event's `data.object` — no
// business meaning attached yet (no plan-code or lifecycle-status mapping). That mapping is a
// billing decision and belongs to apps/api/src/billing, not this adapter.
export interface StripeSubscriptionEvent {
  orgId: string | null;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  stripeStatus: string;
  priceId: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  canceledAt: string | null;
}

export function mapStripeSubscriptionEvent(subscriptionObject: unknown): StripeSubscriptionEvent | null {
  const result = stripeSubscriptionObjectSchema.safeParse(subscriptionObject);
  if (!result.success) return null;

  const item = result.data.items.data[0];
  const orgId = result.data.metadata?.orgId ?? null;

  return {
    orgId,
    stripeCustomerId: result.data.customer,
    stripeSubscriptionId: result.data.id,
    stripeStatus: result.data.status,
    priceId: item.price.id,
    currentPeriodStart: new Date(item.current_period_start * 1000).toISOString(),
    currentPeriodEnd: new Date(item.current_period_end * 1000).toISOString(),
    canceledAt: result.data.canceled_at ? new Date(result.data.canceled_at * 1000).toISOString() : null,
  };
}
