import type { Refund } from '@recon/domain';
import { z } from 'zod';

const transactionSchema = z.object({
  kind: z.string(),
  status: z.string(),
  amount: z.union([z.string(), z.number()]),
  currency: z.string().length(3).nullable().optional(),
});

const moneySchema = z.object({
  amount: z.string(),
  currency_code: z.string().length(3),
});

const shopifyRefundCreatedSchema = z.object({
  id: z.union([z.string(), z.number().int().safe()]),
  admin_graphql_api_id: z.string().min(1),
  order_id: z.union([z.string(), z.number().int().safe()]),
  processed_at: z.string().datetime({ offset: true }),
  transactions: z.array(transactionSchema),
  refund_line_items: z.array(z.object({ subtotal_set: z.object({ shop_money: moneySchema }) })).default([]),
});

export type ShopifyRefundCreatedPayload = z.input<typeof shopifyRefundCreatedSchema>;

export function mapShopifyRefundCreatedToDomain(payload: unknown, orgId: string): Refund | null {
  const result = shopifyRefundCreatedSchema.safeParse(payload);
  if (!result.success) return null;

  const successful = result.data.transactions.filter(
    (transaction) => transaction.kind.toLowerCase() === 'refund' && transaction.status.toLowerCase() === 'success',
  );
  const amount = successful.reduce((total, transaction) => total + Number(transaction.amount), 0);
  const currency = successful.find((transaction) => transaction.currency)?.currency
    ?? result.data.refund_line_items[0]?.subtotal_set.shop_money.currency_code;
  if (!currency || !Number.isFinite(amount) || amount <= 0) return null;

  return {
    id: result.data.admin_graphql_api_id,
    orgId,
    orderId: String(result.data.order_id),
    amount,
    currency,
    issuedAt: result.data.processed_at,
  };
}