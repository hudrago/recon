import type { Invoice } from '@recon/domain';
import { z } from 'zod';

// The `reference` field is a genuine InvoiceXpress invoice field (shown on the document) — the
// integration must be configured to populate it with the originating Recon order id when the
// invoice is created. Verify this exact webhook envelope shape against a live account before
// depending on it in production; InvoiceXpress's webhook payload isn't publicly specified here.
const invoiceXpressInvoiceSchema = z.object({
  id: z.union([z.string(), z.number().int()]),
  reference: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD'),
});

const invoiceXpressWebhookSchema = z.object({ invoice: invoiceXpressInvoiceSchema });

export type InvoiceXpressInvoiceCreatedPayload = z.input<typeof invoiceXpressWebhookSchema>;

export function mapInvoiceXpressInvoiceToDomain(payload: unknown, orgId: string): Invoice | null {
  const result = invoiceXpressWebhookSchema.safeParse(payload);
  if (!result.success) return null;

  const { id, reference, date } = result.data.invoice;
  const issuedAt = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(issuedAt.getTime())) return null;

  return {
    id: String(id),
    orgId,
    orderId: reference,
    issuedAt: issuedAt.toISOString(),
  };
}
