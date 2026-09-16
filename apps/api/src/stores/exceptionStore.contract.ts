import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { DomainException, Refund } from '@recon/domain';
import type { ExceptionStore, PendingEvaluation } from '../exceptionStore';

// Shared behavior contract for every ExceptionStore implementation. Run this against BOTH
// InMemoryExceptionStore and PrismaExceptionStore so neither implementation silently diverges.
// All generated ids/orgIds are prefixed with "contract_" so a live-database run can clean up
// everything it created without touching unrelated data.
export function runExceptionStoreContract(
  storeName: string,
  setup: () => Promise<ExceptionStore> | ExceptionStore,
  teardown?: (store: ExceptionStore) => Promise<void> | void,
  prepareOrganization?: (orgId: string) => Promise<void> | void,
) {
  describe(`ExceptionStore contract: ${storeName}`, () => {
    let store: ExceptionStore;

    beforeAll(async () => {
      store = await setup();
    });

    afterAll(async () => {
      if (teardown) await teardown(store);
    });

    function makeException(overrides: Partial<DomainException> = {}): DomainException {
      return {
        id: `contract_${randomUUID()}`,
        orgId: `contract_${randomUUID()}`,
        code: 'REFUND_MISSING',
        orderId: `contract_${randomUUID()}`,
        detectedAt: new Date().toISOString(),
        status: 'open',
        context: { note: 'contract test' },
        ...overrides,
      };
    }

    async function prepare(...orgIds: string[]) {
      if (prepareOrganization) await Promise.all(orgIds.map((orgId) => prepareOrganization(orgId)));
    }

    it('claims a provider webhook once and permits retry after release', async () => {
      const eventId = `contract_${randomUUID()}`;
      const orgId = `contract_${randomUUID()}`;
      await prepare(orgId);

      expect(await store.claimWebhook('shopify', eventId, orgId)).toBe(true);
      expect(await store.claimWebhook('shopify', eventId, orgId)).toBe(false);
      await store.completeWebhook('shopify', eventId);
      expect(await store.claimWebhook('shopify', eventId, orgId)).toBe(false);
      await store.releaseWebhook('shopify', eventId);
      expect(await store.claimWebhook('shopify', eventId, orgId)).toBe(true);
    });

    it('returns undefined for an exception that was never saved', async () => {
      expect(await store.get(`contract_${randomUUID()}`)).toBeUndefined();
    });

    it('saves and retrieves an exception by id', async () => {
      const exception = makeException();
      await prepare(exception.orgId);
      await store.save(exception);
      expect(await store.get(exception.id)).toEqual(exception);
    });

    it('updates an existing exception on save instead of duplicating it', async () => {
      const exception = makeException();
      await prepare(exception.orgId);
      await store.save(exception);
      await store.save({ ...exception, status: 'dismissed' });
      expect((await store.get(exception.id))?.status).toBe('dismissed');
    });

    it('listOpen returns only open exceptions scoped to the given org', async () => {
      const orgId = `contract_${randomUUID()}`;
      const openException = makeException({ orgId, status: 'open' });
      const dismissedException = makeException({ orgId, status: 'dismissed' });
      const otherOrgException = makeException({ status: 'open' });
      await prepare(orgId, otherOrgException.orgId);
      await store.save(openException);
      await store.save(dismissedException);
      await store.save(otherOrgException);

      const result = await store.listOpen(orgId);
      expect(result.map((exception) => exception.id)).toEqual([openException.id]);
    });

    it('upserts pending evaluations and returns only records that are due', async () => {
      const id = `contract_${randomUUID()}`;
      const dueAt = new Date(Date.now() - 1000).toISOString();
      const evaluation: PendingEvaluation = {
        id,
        dueAt,
        kind: 'delivery-stalled',
        shipment: {
          id: `contract_${randomUUID()}`,
          orgId: `contract_${randomUUID()}`,
          orderId: `contract_${randomUUID()}`,
          status: 'IN_TRANSIT',
          lastStatusChangeAt: new Date().toISOString(),
        },
      };
      await prepare(evaluation.shipment.orgId);

      await store.savePendingEvaluation({ ...evaluation, dueAt: new Date(Date.now() + 60_000).toISOString() });
      await store.savePendingEvaluation(evaluation);

      expect(await store.listDueEvaluations(new Date())).toContainEqual(evaluation);
    });

    it('deletes a pending evaluation', async () => {
      const evaluation: PendingEvaluation = {
        id: `contract_${randomUUID()}`,
        dueAt: new Date(Date.now() - 1000).toISOString(),
        kind: 'delivery-stalled',
        shipment: {
          id: `contract_${randomUUID()}`,
          orgId: `contract_${randomUUID()}`,
          orderId: `contract_${randomUUID()}`,
          status: 'IN_TRANSIT',
          lastStatusChangeAt: new Date().toISOString(),
        },
      };
      await prepare(evaluation.shipment.orgId);
      await store.savePendingEvaluation(evaluation);
      await store.deletePendingEvaluation(evaluation.id);

      expect(await store.listDueEvaluations(new Date())).not.toContainEqual(evaluation);
    });

    it('upserts and lists refunds by organization and order', async () => {
      const orgId = `contract_${randomUUID()}`;
      const orderId = `contract_${randomUUID()}`;
      const refund: Refund = {
        id: `contract_${randomUUID()}`,
        orgId,
        orderId,
        amount: 12.5,
        currency: 'EUR',
        issuedAt: new Date().toISOString(),
      };
      await prepare(orgId);
      await store.saveRefund(refund);
      await store.saveRefund(refund);

      expect(await store.listRefunds(orgId, orderId)).toEqual([refund]);
      expect(await store.listRefunds(`contract_${randomUUID()}`, orderId)).toEqual([]);
    });

    it('prevents an outbound claim when an inbound refund reserved the order first', async () => {
      const exception = makeException();
      const refund: Refund = {
        id: `contract_${randomUUID()}`,
        orgId: exception.orgId,
        orderId: exception.orderId,
        amount: 10,
        currency: 'EUR',
        issuedAt: new Date().toISOString(),
      };
      await prepare(exception.orgId);
      await store.saveRefund(refund);

      expect(await store.claimAction(`contract_${randomUUID()}`, exception.id, exception.orgId, exception.orderId))
        .toEqual({ status: 'succeeded', result: { refundId: refund.id } });
    });

    it('claims, completes, and replays an action by idempotency key', async () => {
      const idempotencyKey = `contract_${randomUUID()}`;
      const exception = makeException();
      await prepare(exception.orgId);
      await store.save(exception);
      expect(await store.claimAction(idempotencyKey, exception.id, exception.orgId, exception.orderId)).toEqual({ status: 'claimed' });
      expect(await store.claimAction(idempotencyKey, exception.id, exception.orgId, exception.orderId)).toEqual({ status: 'in_progress' });

      const result = { refundId: `contract_${randomUUID()}` };
      const resolved = { ...exception, status: 'resolved' as const };
      const audit = { orgId: exception.orgId, actor: 'operator', reason: 'refund', before: exception, after: resolved, at: new Date().toISOString() };
      const refund = { id: `contract_${randomUUID()}`, orgId: exception.orgId, orderId: exception.orderId, amount: 10, currency: 'EUR', issuedAt: new Date().toISOString() };
      await store.completeAction(idempotencyKey, result, refund, resolved, audit);

      expect(await store.claimAction(idempotencyKey, exception.id, exception.orgId, exception.orderId)).toEqual({ status: 'succeeded', result });
      expect(await store.listRefunds(exception.orgId, exception.orderId)).toContainEqual(refund);
    });

    it('allows a failed action to be claimed for retry', async () => {
      const idempotencyKey = `contract_${randomUUID()}`;
      const exception = makeException();
      await prepare(exception.orgId);
      await store.save(exception);
      await store.claimAction(idempotencyKey, exception.id, exception.orgId, exception.orderId);
      await store.failAction(idempotencyKey, 'provider unavailable');
      expect(await store.claimAction(idempotencyKey, exception.id, exception.orgId, exception.orderId)).toEqual({ status: 'claimed' });
    });

    it('replays the existing result for another exception on the same organization order', async () => {
      const first = makeException();
      const second = makeException({ orgId: first.orgId, orderId: first.orderId });
      await prepare(first.orgId);
      await store.save(first);
      await store.save(second);
      const firstKey = `contract_${randomUUID()}`;
      expect(await store.claimAction(firstKey, first.id, first.orgId, first.orderId)).toEqual({ status: 'claimed' });
      const result = { refundId: `contract_${randomUUID()}` };
      const refund = { id: result.refundId, orgId: first.orgId, orderId: first.orderId, amount: 10, currency: 'EUR', issuedAt: new Date().toISOString() };
      const resolved = { ...first, status: 'resolved' as const };
      await store.completeAction(firstKey, result, refund, resolved, {
        orgId: first.orgId,
        actor: 'operator',
        reason: 'refund',
        before: first,
        after: resolved,
        at: new Date().toISOString(),
      });

      expect(await store.claimAction(`contract_${randomUUID()}`, second.id, second.orgId, second.orderId)).toEqual({ status: 'succeeded', result });
    });

    it('appends and retrieves audit log entries scoped to an org, in order', async () => {
      const orgId = `contract_${randomUUID()}`;
      const otherOrgId = `contract_${randomUUID()}`;
      const first = { orgId, actor: 'operator', reason: 'first', before: {}, after: {}, at: new Date(Date.now() - 1000).toISOString() };
      const second = { orgId, actor: 'operator', reason: 'second', before: {}, after: {}, at: new Date().toISOString() };
      const otherOrgEntry = { orgId: otherOrgId, actor: 'operator', reason: 'other', before: {}, after: {}, at: new Date().toISOString() };
      await prepare(orgId, otherOrgId);

      await store.appendAuditLog(first);
      await store.appendAuditLog(second);
      await store.appendAuditLog(otherOrgEntry);

      const result = await store.getAuditLog(orgId);
      expect(result.map((entry) => entry.reason)).toEqual(['first', 'second']);
    });
  });
}
