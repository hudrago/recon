import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReturnRecord } from '@recon/domain';
import { REFUND_MISSING_THRESHOLD_MS } from '@recon/domain';
import { AppModule } from '../app.module';
import { AUTH_SESSION_PROVIDER, MEMBERSHIP_STORE } from '../auth/auth.types';
import { ExceptionService } from '../exceptionService';
import { EXCEPTION_STORE } from '../exceptionStore';
import { FakeRefundGateway } from '../gateways/fakeRefundGateway';
import { PrismaService } from '../prisma.service';
import { REFUND_GATEWAY } from '../refundGateway';
import { InMemoryExceptionStore } from '../stores/inMemoryExceptionStore';

describe('ExceptionsController (http)', () => {
  let app: INestApplication;
  let exceptions: ExceptionService;
  let getSession: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    getSession = vi.fn().mockResolvedValue({ user: { id: 'user_1', email: 'operator@example.com' } });
    // Override the real (Postgres-backed) store with the in-memory one — no live DB in tests.
    // PrismaService is also overridden: it's a separate provider that Nest instantiates (and
    // calls onModuleInit/$connect on) regardless of whether EXCEPTION_STORE still points at it.
    // REFUND_GATEWAY is overridden too so this test never depends on whether Shopify env vars
    // happen to be set in this process — always deterministic, never a real network call.
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(EXCEPTION_STORE)
      .useClass(InMemoryExceptionStore)
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(REFUND_GATEWAY)
      .useClass(FakeRefundGateway)
      .overrideProvider(AUTH_SESSION_PROVIDER)
      .useValue({ getSession })
      .overrideProvider(MEMBERSHIP_STORE)
      .useValue({ getRole: async (_userId: string, orgId: string) => (orgId === 'org_1' ? 'operator' : null) })
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
    exceptions = moduleRef.get(ExceptionService);
  });

  afterEach(async () => {
    await app.close();
  });

  const returnRecord: ReturnRecord = {
    id: 'ret_http_1',
    orgId: 'org_1',
    orderId: 'order_1',
    receivedAt: '2026-09-01T10:00:00.000Z',
  };
  const now = new Date(new Date(returnRecord.receivedAt).getTime() + REFUND_MISSING_THRESHOLD_MS + 1000);

  it('rejects an unauthenticated request', async () => {
    getSession.mockResolvedValue(null);
    await request(app.getHttpServer()).get('/orgs/org_1/exceptions').expect(401);
  });

  it('lists open exceptions scoped to the requesting org', async () => {
    await exceptions.ingestReturn(returnRecord, [], now);

    const own = await request(app.getHttpServer()).get('/orgs/org_1/exceptions').expect(200);
    expect(own.body).toHaveLength(1);
    expect(own.body[0].code).toBe('REFUND_MISSING');

    await request(app.getHttpServer()).get('/orgs/org_2/exceptions').expect(403);
  });

  it('rejects dismiss with an invalid body', async () => {
    await exceptions.ingestReturn(returnRecord, [], now);
    const [exception] = await exceptions.listOpenExceptions('org_1');

    await request(app.getHttpServer())
      .post(`/orgs/org_1/exceptions/${exception.id}/dismiss`)
      .send({})
      .expect(400);
  });

  it('fetches a single exception scoped to the requesting org', async () => {
    await exceptions.ingestReturn(returnRecord, [], now);
    const [exception] = await exceptions.listOpenExceptions('org_1');

    const own = await request(app.getHttpServer()).get(`/orgs/org_1/exceptions/${exception.id}`).expect(200);
    expect(own.body.code).toBe('REFUND_MISSING');

    await request(app.getHttpServer()).get(`/orgs/org_2/exceptions/${exception.id}`).expect(403);
  });

  it('returns 404 for a nonexistent exception id', async () => {
    await request(app.getHttpServer()).get('/orgs/org_1/exceptions/does-not-exist').expect(404);
  });

  it('approves then executes a refund, and rejects a cross-org attempt', async () => {
    await exceptions.ingestReturn(returnRecord, [], now);
    const [exception] = await exceptions.listOpenExceptions('org_1');

    await request(app.getHttpServer())
      .post(`/orgs/org_1/exceptions/${exception.id}/approve`)
      .send({ reason: 'Customer refund approved', amountMinor: 1000, currency: 'EUR' })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/orgs/org_2/exceptions/${exception.id}/actions/refund`)
      .send({})
      .expect(403);

    await request(app.getHttpServer())
      .post(`/orgs/org_1/exceptions/${exception.id}/actions/refund`)
      .send({ amount: 999999, currency: 'EUR' })
      .expect(400);

    const response = await request(app.getHttpServer())
      .post(`/orgs/org_1/exceptions/${exception.id}/actions/refund`)
      .send({})
      .expect(200);

    expect(response.body.refundId).toBe('refund_refund:REFUND_MISSING:org_1:ret_http_1');
    expect((await exceptions.getAuditLog('org_1')).map((entry) => entry.actor)).toEqual(['user_1', 'user_1']);
  });
});
