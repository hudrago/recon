import { createHmac, timingSafeEqual } from 'node:crypto';

// Verifies a Shopify webhook's X-Shopify-Hmac-Sha256 header against the raw request body.
// The caller MUST pass the raw, unparsed request body — re-serializing a JSON-parsed body
// can change whitespace/key order and invalidate the signature even for a legitimate request.
export function verifyShopifyWebhookHmac(rawBody: string, hmacHeader: string, secret: string): boolean {
  const digest = createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64');

  const digestBuffer = Buffer.from(digest, 'base64');
  const headerBuffer = Buffer.from(hmacHeader, 'base64');
  if (digestBuffer.length !== headerBuffer.length) return false;

  return timingSafeEqual(digestBuffer, headerBuffer);
}
