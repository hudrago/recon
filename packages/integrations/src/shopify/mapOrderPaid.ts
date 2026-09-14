import type { Order } from '@recon/domain';
import { z } from 'zod';

const shopifyOrderPaidSchema = z.object({
  id: z.union([z.string(), z.number().int().safe()]),
  admin_graphql_api_id: z.string().min(1),
  currency: z.string().length(3),
  total_price: z.union([z.string(), z.number()]),
  processed_at: z.string().datetime({ offset: true }),
});

export type ShopifyOrderPaidPayload = z.input<typeof shopifyOrderPaidSchema>;

export function mapShopifyOrderPaidToDomain(payload: unknown, orgId: string): Order | null {
  const result = shopifyOrderPaidSchema.safeParse(payload);
  if (!result.success) return null;

  const total = Number(result.data.total_price);
  if (!Number.isFinite(total) || total < 0) return null;

  return {
    id: String(result.data.id),
    orgId,
    currency: result.data.currency,
    total,
    paidAt: result.data.processed_at,
  };
}