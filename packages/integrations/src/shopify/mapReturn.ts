import type { ReturnRecord } from '@recon/domain';

// Matches the real `returns/close` webhook payload (verified against Shopify's webhook docs,
// Sept 2026): https://shopify.dev/docs/api/webhooks — list of topics, returns/close example.
// IMPORTANT: the body carries NO timestamp field at all. The event time comes from the
// `X-Shopify-Triggered-At` delivery header, so it must be passed in separately by the caller.
interface ShopifyReturnClosePayload {
  id: number | string;
  admin_graphql_api_id: string;
  order_id: number | string;
  status: string;
}

export function mapShopifyReturnToDomain(
  payload: ShopifyReturnClosePayload,
  triggeredAt: string,
  orgId: string,
): ReturnRecord {
  return {
    id: String(payload.id),
    orgId,
    orderId: String(payload.order_id),
    receivedAt: triggeredAt,
  };
}
