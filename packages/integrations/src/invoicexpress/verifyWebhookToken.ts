import { timingSafeEqual } from 'node:crypto';

// InvoiceXpress webhooks aren't HMAC-signed like Shopify/Stripe — authenticity instead relies on
// a shared secret token that the merchant configures as part of the webhook URL/header on both
// sides. Verify field names/behavior against the live InvoiceXpress account before depending on
// this in production; there's no public webhook signing scheme to check against offline.
export function verifyInvoiceXpressWebhookToken(providedToken: string | undefined, expectedToken: string): boolean {
  if (!providedToken) return false;

  const providedBuffer = Buffer.from(providedToken, 'utf8');
  const expectedBuffer = Buffer.from(expectedToken, 'utf8');
  if (providedBuffer.length !== expectedBuffer.length) return false;

  return timingSafeEqual(providedBuffer, expectedBuffer);
}
