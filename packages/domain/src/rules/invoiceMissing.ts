import type { Invoice, Order } from '../entities';
import type { DomainException } from '../exceptions';

export const INVOICE_MISSING_THRESHOLD_MS = 2 * 60 * 60 * 1000;

export interface InvoiceMissingInput {
  order: Order;
  invoices: Invoice[];
  now: Date;
}

// Deterministic per order, so re-running the rule on the same event never creates a duplicate exception.
export function invoiceMissingExceptionId(order: Order): string {
  return `INVOICE_MISSING:${order.orgId}:${order.id}`;
}

export function evaluateInvoiceMissing({ order, invoices, now }: InvoiceMissingInput): DomainException | null {
  const hasInvoice = invoices.some((invoice) => invoice.orderId === order.id);
  if (hasInvoice) return null;

  const elapsed = now.getTime() - new Date(order.paidAt).getTime();
  if (elapsed < INVOICE_MISSING_THRESHOLD_MS) return null;

  return {
    id: invoiceMissingExceptionId(order),
    orgId: order.orgId,
    code: 'INVOICE_MISSING',
    orderId: order.id,
    detectedAt: now.toISOString(),
    status: 'open',
    context: { elapsedMs: elapsed },
  };
}
