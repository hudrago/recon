import type { InventoryAdjustment } from '@recon/domain';
import { z } from 'zod';

const restockedLineItemSchema = z.object({
  quantity: z.number().int().nonnegative(),
  restock_type: z.enum(['no_restock', 'cancel', 'return', 'legacy_restock']),
});

const shopifyRefundRestockSchema = z.object({
  admin_graphql_api_id: z.string().min(1),
  order_id: z.union([z.string(), z.number().int().safe()]),
  processed_at: z.string().datetime({ offset: true }),
  refund_line_items: z.array(restockedLineItemSchema).default([]),
});

export type ShopifyRefundRestockPayload = z.input<typeof shopifyRefundRestockSchema>;

// Shopify's refund webhook already declares restock intent per line item (`restock_type`), so a
// live inventory webhook isn't needed to detect this — reads the same raw payload
// mapRefundCreated.ts consumes, and the returned id/refundId join to that same refund record.
export function mapShopifyRefundCreatedToInventoryAdjustment(payload: unknown, orgId: string): InventoryAdjustment | null {
  const result = shopifyRefundRestockSchema.safeParse(payload);
  if (!result.success) return null;

  const restocked = result.data.refund_line_items.filter((item) => item.restock_type !== 'no_restock');
  const quantity = restocked.reduce((total, item) => total + item.quantity, 0);
  if (quantity <= 0) return null;

  return {
    id: `${result.data.admin_graphql_api_id}:restock`,
    orgId,
    orderId: String(result.data.order_id),
    refundId: result.data.admin_graphql_api_id,
    quantity,
    adjustedAt: result.data.processed_at,
  };
}
