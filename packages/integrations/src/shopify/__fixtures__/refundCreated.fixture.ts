export const shopifyRefundCreatedFixture = {
  id: '890088186047892319',
  admin_graphql_api_id: 'gid://shopify/Refund/890088186047892319',
  order_id: '820982911946154508',
  processed_at: '2026-09-14T11:00:00.000Z',
  refund_line_items: [
    { subtotal_set: { shop_money: { amount: '30.00', currency_code: 'EUR' } } },
  ],
  transactions: [
    { kind: 'refund', status: 'success', amount: '20.00', currency: 'EUR' },
    { kind: 'refund', status: 'success', amount: '10.00', currency: 'EUR' },
  ],
};

export const shopifyPartialRefundFixture = {
  ...shopifyRefundCreatedFixture,
  id: '890088186047892320',
  admin_graphql_api_id: 'gid://shopify/Refund/890088186047892320',
  transactions: [
    { kind: 'refund', status: 'success', amount: '12.50', currency: null },
    { kind: 'refund', status: 'failure', amount: '99.00', currency: 'EUR' },
  ],
};

export const malformedShopifyRefundFixture = {
  id: '890088186047892321',
  order_id: '820982911946154508',
  transactions: [],
};