import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ShopifyRefundGateway } from './shopifyRefundGateway';

function jsonResponse(body: unknown, ok = true): Response {
  return { ok, statusText: ok ? 'OK' : 'Error', json: async () => body } as Response;
}

function tokenResponse(token = 'shpat_cached_token'): Response {
  return jsonResponse({ access_token: token, expires_in: 86399 });
}

describe('ShopifyRefundGateway', () => {
  let gateway: ShopifyRefundGateway;

  beforeEach(() => {
    gateway = new ShopifyRefundGateway('org_1', 'test-shop.myshopify.com', 'client_id_test', 'client_secret_test');
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('exchanges client credentials for a token, looks up the parent transaction, then creates a refund', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            order: {
              currencyCode: 'EUR',
              transactions: [{ id: 'gid://shopify/OrderTransaction/1', kind: 'SALE', status: 'SUCCESS', gateway: 'bogus' }],
            },
          },
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ data: { refundCreate: { refund: { id: 'gid://shopify/Refund/99' }, userErrors: [] } } }));

    const result = await gateway.createRefund({ orgId: 'org_1', orderId: '123', amount: 10, currency: 'EUR', idempotencyKey: 'key_1' });

    expect(result).toEqual({ refundId: 'gid://shopify/Refund/99' });
    expect(fetchMock).toHaveBeenCalledTimes(3);

    const tokenCall = fetchMock.mock.calls[0];
    expect(tokenCall[0]).toBe('https://test-shop.myshopify.com/admin/oauth/access_token');
    const tokenBody = JSON.parse((tokenCall[1] as RequestInit).body as string);
    expect(tokenBody).toEqual({ client_id: 'client_id_test', client_secret: 'client_secret_test', grant_type: 'client_credentials' });

    const refundCall = fetchMock.mock.calls[2];
    expect((refundCall[1] as RequestInit).headers).toMatchObject({ 'X-Shopify-Access-Token': 'shpat_cached_token' });
    const refundBody = JSON.parse((refundCall[1] as RequestInit).body as string);
    expect(refundBody.query).toContain('@idempotent(key: "key_1")');
    expect(refundBody.variables.input.orderId).toBe('gid://shopify/Order/123');
    expect(refundBody.variables.input.transactions[0]).toEqual({
      orderId: 'gid://shopify/Order/123',
      parentId: 'gid://shopify/OrderTransaction/1',
      kind: 'REFUND',
      gateway: 'bogus',
      amount: '10.00',
    });
  });

  it('reuses a cached token across multiple calls instead of re-exchanging it', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(jsonResponse({ data: { order: { currencyCode: 'EUR', transactions: [{ id: 'gid://shopify/OrderTransaction/1', kind: 'SALE', status: 'SUCCESS', gateway: 'bogus' }] } } }))
      .mockResolvedValueOnce(jsonResponse({ data: { refundCreate: { refund: { id: 'gid://shopify/Refund/1' }, userErrors: [] } } }))
      .mockResolvedValueOnce(jsonResponse({ data: { order: { currencyCode: 'EUR', transactions: [{ id: 'gid://shopify/OrderTransaction/1', kind: 'SALE', status: 'SUCCESS', gateway: 'bogus' }] } } }))
      .mockResolvedValueOnce(jsonResponse({ data: { refundCreate: { refund: { id: 'gid://shopify/Refund/2' }, userErrors: [] } } }));

    await gateway.createRefund({ orgId: 'org_1', orderId: '123', amount: 5, currency: 'EUR', idempotencyKey: 'key_a' });
    await gateway.createRefund({ orgId: 'org_1', orderId: '456', amount: 5, currency: 'EUR', idempotencyKey: 'key_b' });

    // 1 token exchange + 2 calls per refund (transaction lookup + refundCreate) = 5, not 6.
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it('throws when the order has no refundable transaction', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(jsonResponse({ data: { order: { currencyCode: 'EUR', transactions: [] } } }));

    await expect(gateway.createRefund({ orgId: 'org_1', orderId: '123', amount: 10, currency: 'EUR', idempotencyKey: 'key_1' })).rejects.toThrow(
      /No refundable transaction/,
    );
  });

  it('throws when Shopify returns userErrors', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            order: {
              currencyCode: 'EUR',
              transactions: [{ id: 'gid://shopify/OrderTransaction/1', kind: 'SALE', status: 'SUCCESS', gateway: 'bogus' }],
            },
          },
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ data: { refundCreate: { refund: null, userErrors: [{ field: ['amount'], message: 'Amount too large' }] } } }));

    await expect(gateway.createRefund({ orgId: 'org_1', orderId: '123', amount: 999999, currency: 'EUR', idempotencyKey: 'key_2' })).rejects.toThrow(
      /Amount too large/,
    );
  });

  it('rejects an approved currency that differs from the Shopify order', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(jsonResponse({ data: { order: { currencyCode: 'USD', transactions: [] } } }));

    await expect(gateway.createRefund({ orgId: 'org_1', orderId: '123', amount: 10, currency: 'EUR', idempotencyKey: 'key_currency' }))
      .rejects.toThrow(/does not match/);
  });

  it('throws when the token exchange itself fails', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'invalid_client' }, false));

    await expect(gateway.createRefund({ orgId: 'org_1', orderId: '123', amount: 10, currency: 'EUR', idempotencyKey: 'key_1' })).rejects.toThrow(
      /Shopify token exchange failed/,
    );
  });

  it('rejects an organization that is not mapped to this Shopify installation', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    await expect(gateway.createRefund({ orgId: 'org_2', orderId: '123', amount: 10, currency: 'EUR', idempotencyKey: 'key_org' }))
      .rejects.toThrow(/not mapped/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
