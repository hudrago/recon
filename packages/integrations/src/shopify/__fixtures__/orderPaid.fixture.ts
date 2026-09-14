export const shopifyOrderPaidFixture = {
  id: '820982911946154508',
  admin_graphql_api_id: 'gid://shopify/Order/820982911946154508',
  currency: 'EUR',
  total_price: '104.95',
  processed_at: '2026-09-14T10:00:00.000Z',
};

export const shopifyFreeOrderPaidFixture = {
  ...shopifyOrderPaidFixture,
  id: '820982911946154509',
  admin_graphql_api_id: 'gid://shopify/Order/820982911946154509',
  total_price: '0.00',
};

export const malformedShopifyOrderPaidFixture = {
  id: '820982911946154510',
  currency: 'EUR',
  total_price: 'not-money',
};