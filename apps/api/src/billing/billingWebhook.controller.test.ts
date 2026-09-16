import { createHmac } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { rawJsonBodyParser } from '../common/rawJsonBody';
import { BillingService } from './billing.service';
import { BillingWebhookController } from './billingWebhook.controller';

describe('BillingWebhookController Stripe webhook (http)', () => {
  let app: INestApplication;
  const claimBillingWebhook = vi.fn().mockResolvedValue(true);
  const completeBillingWebhook = vi.fn().mockResolvedValue(undefined);
  const releaseBillingWebhook = vi.fn().mockResolvedValue(undefined);
  const applyStripeSubscriptionEvent = vi.fn().mockResolvedValue(undefined);
  const applyStripeInvoicePaidEvent = vi.fn().mockResolvedValue(undefined);
  const secret = 'whsec_test_secret';

  const subscriptionPayload = JSON.stringify({
    id: 'evt_1',
    type: 'customer.subscription.updated',
    data: {
      object: {
        id: 'sub_1',
        customer: 'cus_1',
        status: 'active',
        metadata: { orgId: 'org_1' },
        items: { data: [{ price: { id: 'price_growth' }, current_period_start: 1_767_225_600, current_period_end: 1_769_904_000 }] },
      },
    },
  });

  function signatureHeader(body: string, timestamp: number, signingSecret: string): string {
    const signature = createHmac('sha256', signingSecret).update(`${timestamp}.${body}`, 'utf8').digest('hex');
    return `t=${timestamp},v1=${signature}`;
  }

  beforeEach(async () => {
    process.env.STRIPE_WEBHOOK_SECRET = secret;
    claimBillingWebhook.mockClear().mockResolvedValue(true);
    completeBillingWebhook.mockClear();
    releaseBillingWebhook.mockClear();
    applyStripeSubscriptionEvent.mockClear();
    applyStripeInvoicePaidEvent.mockClear();
    const moduleRef = await Test.createTestingModule({
      controllers: [BillingWebhookController],
      providers: [
        {
          provide: BillingService,
          useValue: { claimBillingWebhook, completeBillingWebhook, releaseBillingWebhook, applyStripeSubscriptionEvent, applyStripeInvoicePaidEvent },
        },
      ],
    }).compile();
    app = moduleRef.createNestApplication({ bodyParser: false });
    app.use(rawJsonBodyParser);
    await app.init();
  });

  afterEach(async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    await app?.close();
  });

  it('accepts a subscription event signed over the exact raw body and applies it', async () => {
    const timestamp = Math.floor(Date.now() / 1000);
    await request(app.getHttpServer())
      .post('/billing/webhooks/stripe')
      .set('content-type', 'application/json')
      .set('stripe-signature', signatureHeader(subscriptionPayload, timestamp, secret))
      .send(subscriptionPayload)
      .expect(200);

    expect(applyStripeSubscriptionEvent).toHaveBeenCalledOnce();
    expect(completeBillingWebhook).toHaveBeenCalledWith('stripe', 'evt_1');
  });

  it.each([
    ['missing', undefined],
    ['forged', 'this-is-not-a-real-header'],
  ])('rejects a %s signature', async (_label, header) => {
    const webhook = request(app.getHttpServer()).post('/billing/webhooks/stripe').set('content-type', 'application/json');
    if (header) webhook.set('stripe-signature', header);

    await webhook.send(subscriptionPayload).expect(401);
    expect(applyStripeSubscriptionEvent).not.toHaveBeenCalled();
  });

  it('accepts a replayed event id without applying it again', async () => {
    claimBillingWebhook.mockResolvedValue(false);
    const timestamp = Math.floor(Date.now() / 1000);

    const response = await request(app.getHttpServer())
      .post('/billing/webhooks/stripe')
      .set('content-type', 'application/json')
      .set('stripe-signature', signatureHeader(subscriptionPayload, timestamp, secret))
      .send(subscriptionPayload)
      .expect(200);

    expect(response.body.duplicate).toBe(true);
    expect(applyStripeSubscriptionEvent).not.toHaveBeenCalled();
  });

  it('releases the webhook claim so Stripe can retry when processing throws', async () => {
    applyStripeSubscriptionEvent.mockRejectedValue(new Error('db unavailable'));
    const timestamp = Math.floor(Date.now() / 1000);

    await request(app.getHttpServer())
      .post('/billing/webhooks/stripe')
      .set('content-type', 'application/json')
      .set('stripe-signature', signatureHeader(subscriptionPayload, timestamp, secret))
      .send(subscriptionPayload)
      .expect(500);

    expect(releaseBillingWebhook).toHaveBeenCalledWith('stripe', 'evt_1');
    expect(completeBillingWebhook).not.toHaveBeenCalled();
  });

  it('acknowledges an unhandled event type without calling any apply method', async () => {
    const unhandledPayload = JSON.stringify({ id: 'evt_2', type: 'customer.created', data: { object: { id: 'cus_1' } } });
    const timestamp = Math.floor(Date.now() / 1000);

    await request(app.getHttpServer())
      .post('/billing/webhooks/stripe')
      .set('content-type', 'application/json')
      .set('stripe-signature', signatureHeader(unhandledPayload, timestamp, secret))
      .send(unhandledPayload)
      .expect(200);

    expect(applyStripeSubscriptionEvent).not.toHaveBeenCalled();
    expect(applyStripeInvoicePaidEvent).not.toHaveBeenCalled();
    expect(completeBillingWebhook).toHaveBeenCalledWith('stripe', 'evt_2');
  });
});
