import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OrgGuard } from '../auth/org.guard';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';

describe('BillingController (http)', () => {
  let app: INestApplication;
  const getEntitlement = vi.fn();
  const getPlanCatalog = vi.fn();
  const createCheckoutSession = vi.fn();

  beforeEach(async () => {
    getEntitlement.mockReset();
    getPlanCatalog.mockReset();
    createCheckoutSession.mockReset();
    const moduleRef = await Test.createTestingModule({
      controllers: [BillingController],
      providers: [{ provide: BillingService, useValue: { getEntitlement, getPlanCatalog, createCheckoutSession } }],
    })
      .overrideGuard(OrgGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns the current entitlement status for the organization', async () => {
    getEntitlement.mockResolvedValue({ displayStatus: 'trialing', canIngest: true, canExecuteActions: true });
    const response = await request(app.getHttpServer()).get('/orgs/org_1/billing').expect(200);
    expect(response.body).toMatchObject({ displayStatus: 'trialing' });
    expect(getEntitlement).toHaveBeenCalledWith('org_1', expect.any(Date));
  });

  it('returns the self-serve plan catalog', async () => {
    getPlanCatalog.mockReturnValue({ plans: [{ code: 'STARTER' }], enterprise: { code: 'ENTERPRISE' } });
    const response = await request(app.getHttpServer()).get('/orgs/org_1/billing/plans').expect(200);
    expect(response.body.plans).toEqual([{ code: 'STARTER' }]);
  });

  it('creates a Stripe checkout session for a valid self-serve plan', async () => {
    createCheckoutSession.mockResolvedValue({ url: 'https://checkout.stripe.com/session_1' });
    const response = await request(app.getHttpServer()).post('/orgs/org_1/billing/checkout-session').send({ planCode: 'GROWTH' }).expect(201);
    expect(response.body).toEqual({ url: 'https://checkout.stripe.com/session_1' });
    expect(createCheckoutSession).toHaveBeenCalledWith('org_1', 'GROWTH', expect.stringContaining('/billing?checkout=success'), expect.stringContaining('/billing?checkout=cancel'));
  });

  it('rejects a checkout session request for an invalid plan code', async () => {
    await request(app.getHttpServer()).post('/orgs/org_1/billing/checkout-session').send({ planCode: 'ENTERPRISE' }).expect(400);
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });
});
