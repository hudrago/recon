import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyShopifyWebhookHmac } from './verifyWebhookSignature';

describe('verifyShopifyWebhookHmac', () => {
  const secret = 'test_shared_secret';
  const rawBody = '{"id":123,"status":"closed"}';
  const validHmac = createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64');

  it('accepts a signature computed with the correct secret over the exact raw body', () => {
    expect(verifyShopifyWebhookHmac(rawBody, validHmac, secret)).toBe(true);
  });

  it('rejects a signature when the body has been tampered with after signing', () => {
    expect(verifyShopifyWebhookHmac(`${rawBody}x`, validHmac, secret)).toBe(false);
  });

  it('rejects a signature computed with the wrong secret', () => {
    const wrongHmac = createHmac('sha256', 'wrong_secret').update(rawBody, 'utf8').digest('base64');
    expect(verifyShopifyWebhookHmac(rawBody, wrongHmac, secret)).toBe(false);
  });
});
