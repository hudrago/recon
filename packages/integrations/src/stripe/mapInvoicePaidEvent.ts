import { z } from 'zod';

const stripeInvoiceObjectSchema = z.object({
  id: z.string().min(1),
  customer: z.string().min(1),
  amount_paid: z.number().int().nonnegative(),
  currency: z.string().length(3),
  status: z.string().min(1),
  hosted_invoice_url: z.string().nullable().optional(),
  period_start: z.number(),
  period_end: z.number(),
});

export type StripeInvoiceObjectPayload = z.input<typeof stripeInvoiceObjectSchema>;

// Raw shape translated out of a Stripe `invoice.paid` event's `data.object`. Org resolution
// happens in apps/api/src/billing via the Stripe customer id, not here.
export interface StripeInvoicePaidEvent {
  stripeCustomerId: string;
  stripeInvoiceId: string;
  amountCents: number;
  currency: string;
  status: string;
  hostedInvoiceUrl: string | null;
  periodStart: string;
  periodEnd: string;
}

export function mapStripeInvoicePaidEvent(invoiceObject: unknown): StripeInvoicePaidEvent | null {
  const result = stripeInvoiceObjectSchema.safeParse(invoiceObject);
  if (!result.success) return null;

  return {
    stripeCustomerId: result.data.customer,
    stripeInvoiceId: result.data.id,
    amountCents: result.data.amount_paid,
    currency: result.data.currency.toUpperCase(),
    status: result.data.status,
    hostedInvoiceUrl: result.data.hosted_invoice_url ?? null,
    periodStart: new Date(result.data.period_start * 1000).toISOString(),
    periodEnd: new Date(result.data.period_end * 1000).toISOString(),
  };
}
