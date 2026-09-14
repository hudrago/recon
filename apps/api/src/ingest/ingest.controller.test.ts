import { createHmac } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OrgGuard } from '../auth/org.guard';
import { rawJsonBodyParser } from '../common/rawJsonBody';
import { ExceptionService } from '../exceptionService';
import { IngestController } from './ingest.controller';

describe('IngestController Shopify webhook (http)', () => {
  let app: INestApplication;
  const ingestReturn = vi.fn().mockResolvedValue(null);
  const claimWebhook = vi.fn().mockResolvedValue(true);
  const releaseWebhook = vi.fn().mockResolvedValue(undefined);
  const secret = 'test-shopify-secret';
  const payload = JSON.stringify({
    id: 123,
    admin_graphql_api_id: 'gid://shopify/Return/123',
    order_id: 456,
    status: 'closed',
  });

  beforeEach(async () => {
    process.env.SHOPIFY_CLIENT_SECRET = secret;
    process.env.SHOPIFY_ORG_ID = 'org_1';
    process.env.SHOPIFY_SHOP_DOMAIN = 'recon-test.myshopify.com';
    ingestReturn.mockClear();
    claimWebhook.mockClear().mockResolvedValue(true);
    releaseWebhook.mockClear();
    const moduleRef = await Test.createTestingModule({
      controllers: [IngestController],
      providers: [{ provide: ExceptionService, useValue: { claimWebhook, releaseWebhook, ingestReturn, ingestShipment: vi.fn() } }],
    })
      .overrideGuard(OrgGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = moduleRef.createNestApplication({ bodyParser: false });
    app.use(rawJsonBodyParser);
    await app.init();
  });

  afterEach(async () => {
    delete process.env.SHOPIFY_CLIENT_SECRET;
    delete process.env.SHOPIFY_ORG_ID;
    delete process.env.SHOPIFY_SHOP_DOMAIN;
    await app?.close();
  });

  it('accepts a webhook signed over the exact raw body', async () => {
    const hmac = createHmac('sha256', secret).update(payload).digest('base64');

    await request(app.getHttpServer())
      .post('/orgs/org_1/ingest/shopify/returns')
      .set('content-type', 'application/json')
      .set('x-shopify-hmac-sha256', hmac)
      .set('x-shopify-webhook-id', 'webhook_1')
      .set('x-shopify-shop-domain', 'recon-test.myshopify.com')
      .send(payload)
      .expect(200);

    expect(ingestReturn).toHaveBeenCalledOnce();
  });

  it.each([
    ['missing', undefined],
    ['forged', createHmac('sha256', 'wrong-secret').update(payload).digest('base64')],
  ])('rejects a %s signature', async (_label, hmac) => {
    const webhook = request(app.getHttpServer())
      .post('/orgs/org_1/ingest/shopify/returns')
      .set('content-type', 'application/json');
    if (hmac) webhook.set('x-shopify-hmac-sha256', hmac);

    await webhook.send(payload).expect(401);
    expect(ingestReturn).not.toHaveBeenCalled();
  });

  it('accepts a replay without processing it again', async () => {
    claimWebhook.mockResolvedValue(false);
    const hmac = createHmac('sha256', secret).update(payload).digest('base64');

    const response = await request(app.getHttpServer())
      .post('/orgs/org_1/ingest/shopify/returns')
      .set('content-type', 'application/json')
      .set('x-shopify-hmac-sha256', hmac)
      .set('x-shopify-webhook-id', 'webhook_1')
      .set('x-shopify-shop-domain', 'recon-test.myshopify.com')
      .send(payload)
      .expect(200);

    expect(response.body.duplicate).toBe(true);
    expect(ingestReturn).not.toHaveBeenCalled();
  });

  it('rejects a valid signature from a shop not mapped to the URL organization', async () => {
    const hmac = createHmac('sha256', secret).update(payload).digest('base64');

    await request(app.getHttpServer())
      .post('/orgs/org_2/ingest/shopify/returns')
      .set('content-type', 'application/json')
      .set('x-shopify-hmac-sha256', hmac)
      .set('x-shopify-webhook-id', 'webhook_2')
      .set('x-shopify-shop-domain', 'recon-test.myshopify.com')
      .send(payload)
      .expect(401);

    expect(claimWebhook).not.toHaveBeenCalled();
    expect(ingestReturn).not.toHaveBeenCalled();
  });
});