import { describe, expect, it } from 'vitest';
import { verifyInvoiceXpressWebhookToken } from './verifyWebhookToken';

describe('verifyInvoiceXpressWebhookToken', () => {
  const secret = 'test_shared_token';

  it('accepts the exact configured token', () => {
    expect(verifyInvoiceXpressWebhookToken(secret, secret)).toBe(true);
  });

  it('rejects a wrong token', () => {
    expect(verifyInvoiceXpressWebhookToken('wrong_token', secret)).toBe(false);
  });

  it('rejects a missing token', () => {
    expect(verifyInvoiceXpressWebhookToken(undefined, secret)).toBe(false);
  });

  it('rejects a token of different length without throwing', () => {
    expect(verifyInvoiceXpressWebhookToken('short', secret)).toBe(false);
  });
});
