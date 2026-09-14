// Real `returns/close` webhook payload shape, verified against https://shopify.dev/docs/api/webhooks
// (Sept 2026). No timestamp field in the body — see mapReturn.ts for why.
export const shopifyReturnCloseFixture = {
  id: 123134564567890,
  admin_graphql_api_id: 'gid://shopify/Return/123134564567890',
  order_id: 4783296544821,
  status: 'closed',
};
