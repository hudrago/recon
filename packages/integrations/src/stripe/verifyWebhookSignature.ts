import { createHmac, timingSafeEqual } from 'node:crypto';

const DEFAULT_TOLERANCE_SECONDS = 300;

function parseSignatureHeader(header: string): { timestamp: string; signatures: string[] } {
  const timestamp = header.match(/(?:^|,)t=([^,]+)/)?.[1];
  const signatures = [...header.matchAll(/(?:^|,)v1=([^,]+)/g)].map((match) => match[1]);
  return { timestamp: timestamp ?? '', signatures };
}

// Verifies a Stripe webhook's `Stripe-Signature` header against the raw request body.
// The caller MUST pass the raw, unparsed request body — re-serializing a JSON-parsed body
// can change whitespace/key order and invalidate the signature even for a legitimate request.
// See https://docs.stripe.com/webhooks#verify-manually
export function verifyStripeWebhookSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string,
  now: Date = new Date(),
  toleranceSeconds = DEFAULT_TOLERANCE_SECONDS,
): boolean {
  const { timestamp, signatures } = parseSignatureHeader(signatureHeader);
  if (!timestamp || signatures.length === 0) return false;

  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds)) return false;
  if (Math.abs(now.getTime() / 1000 - timestampSeconds) > toleranceSeconds) return false;

  const expectedDigest = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`, 'utf8').digest('hex');
  const expectedBuffer = Buffer.from(expectedDigest, 'hex');

  return signatures.some((signature) => {
    const signatureBuffer = Buffer.from(signature, 'hex');
    if (signatureBuffer.length !== expectedBuffer.length) return false;
    return timingSafeEqual(signatureBuffer, expectedBuffer);
  });
}
