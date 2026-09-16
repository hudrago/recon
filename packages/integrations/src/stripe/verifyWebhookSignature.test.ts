import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyStripeWebhookSignature } from './verifyWebhookSignature';

describe('verifyStripeWebhookSignature', () => {
  const secret = 'whsec_test_shared_secret';
  const rawBody = '{"id":"evt_1","type":"customer.subscription.updated"}';
  const now = new Date('2026-01-01T00:00:00.000Z');
  const timestamp = Math.floor(now.getTime() / 1000);

  function header(ts: number, body: string, signSecret: string): string {
    const signature = createHmac('sha256', signSecret).update(`${ts}.${body}`, 'utf8').digest('hex');
    return `t=${ts},v1=${signature}`;
  }

  it('accepts a signature computed with the correct secret over the exact raw body', () => {
    expect(verifyStripeWebhookSignature(rawBody, header(timestamp, rawBody, secret), secret, now)).toBe(true);
  });

  it('rejects a signature when the body has been tampered with after signing', () => {
    expect(verifyStripeWebhookSignature(`${rawBody}x`, header(timestamp, rawBody, secret), secret, now)).toBe(false);
  });

  it('rejects a signature computed with the wrong secret', () => {
    expect(verifyStripeWebhookSignature(rawBody, header(timestamp, rawBody, 'wrong_secret'), secret, now)).toBe(false);
  });

  it('rejects a signature whose timestamp is outside the replay tolerance window', () => {
    const staleTimestamp = timestamp - 1_000;
    expect(verifyStripeWebhookSignature(rawBody, header(staleTimestamp, rawBody, secret), secret, now)).toBe(false);
  });

  it('accepts when at least one v1 signature in a multi-signature header matches', () => {
    const validSignature = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`, 'utf8').digest('hex');
    const combinedHeader = `t=${timestamp},v1=deadbeef,v1=${validSignature}`;
    expect(verifyStripeWebhookSignature(rawBody, combinedHeader, secret, now)).toBe(true);
  });

  it('rejects a malformed header missing the timestamp or signature', () => {
    expect(verifyStripeWebhookSignature(rawBody, 'v1=abc', secret, now)).toBe(false);
    expect(verifyStripeWebhookSignature(rawBody, `t=${timestamp}`, secret, now)).toBe(false);
  });
});
