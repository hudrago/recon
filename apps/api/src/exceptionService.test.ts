import { beforeEach, describe, expect, it } from 'vitest';
import type { Invoice, InventoryAdjustment, Order, Refund, ReturnRecord, Shipment } from '@recon/domain';
import {
  DELIVERY_STALLED_THRESHOLD_MS,
  INVOICE_MISSING_THRESHOLD_MS,
  REFUND_MISSING_THRESHOLD_MS,
  RESTOCK_MISSING_THRESHOLD_MS,
} from '@recon/domain';
import { ExceptionService } from './exceptionService';
import { FakeRefundGateway } from './gateways/fakeRefundGateway';
import { InMemoryExceptionStore } from './stores/inMemoryExceptionStore';

const returnRecord: ReturnRecord = {
  id: 'ret_1',
  orgId: 'org_1',
  orderId: 'order_1',
  receivedAt: '2026-09-01T10:00:00.000Z',
};

const now = new Date(new Date(returnRecord.receivedAt).getTime() + REFUND_MISSING_THRESHOLD_MS + 1000);

describe('ExceptionService', () => {
  let service: ExceptionService;

  beforeEach(() => {
    service = new ExceptionService(new InMemoryExceptionStore(), new FakeRefundGateway());
  });

  it('creates an open exception when a return has no matching refund past the threshold', async () => {
    await service.ingestReturn(returnRecord, [], now);
    expect(await service.listOpenExceptions('org_1')).toHaveLength(1);
  });

  it('does not create an exception when a matching refund already exists', async () => {
    const refunds: Refund[] = [
      { id: 'rf_1', orgId: 'org_1', orderId: 'order_1', amount: 10, currency: 'EUR', issuedAt: now.toISOString() },
    ];
    await service.ingestReturn(returnRecord, refunds, now);
    expect(await service.listOpenExceptions('org_1')).toHaveLength(0);
  });

  it('ingesting the same return twice (duplicate webhook) does not duplicate the exception', async () => {
    await service.ingestReturn(returnRecord, [], now);
    await service.ingestReturn(returnRecord, [], now);
    expect(await service.listOpenExceptions('org_1')).toHaveLength(1);
  });

  it('creates an exception when a below-threshold return becomes due', async () => {
    const beforeThreshold = new Date(new Date(returnRecord.receivedAt).getTime() + REFUND_MISSING_THRESHOLD_MS - 1000);
    await service.ingestReturn(returnRecord, [], beforeThreshold);
    expect(await service.listOpenExceptions('org_1')).toHaveLength(0);

    const detected = await service.reevaluatePending(now);

    expect(detected).toBe(1);
    expect(await service.listOpenExceptions('org_1')).toHaveLength(1);
    expect(await service.reevaluatePending(now)).toBe(0);
  });

  it('refuses to execute a refund action before the exception is approved', async () => {
    await service.ingestReturn(returnRecord, [], now);
    const [exception] = await service.listOpenExceptions('org_1');
    await expect(
      service.executeRefund(
        { idempotencyKey: 'key_1', exceptionId: exception.id, orderId: 'order_1', amount: 10, currency: 'EUR' },
        'operator_1',
      ),
    ).rejects.toThrow(/not approved/);
  });

  it('executes the refund once approved and records an audit entry', async () => {
    await service.ingestReturn(returnRecord, [], now);
    const [exception] = await service.listOpenExceptions('org_1');
    await service.approve(exception.id);

    const result = await service.executeRefund(
      { idempotencyKey: 'key_1', exceptionId: exception.id, orderId: 'order_1', amount: 10, currency: 'EUR' },
      'operator_1',
    );

    expect(result.refundId).toBe('refund_key_1');
    expect(await service.getAuditLog('org_1')).toHaveLength(1);
  });

  it('replaying the same idempotency key does not issue a duplicate refund', async () => {
    await service.ingestReturn(returnRecord, [], now);
    const [exception] = await service.listOpenExceptions('org_1');
    await service.approve(exception.id);

    const request = { idempotencyKey: 'key_1', exceptionId: exception.id, orderId: 'order_1', amount: 10, currency: 'EUR' };
    const first = await service.executeRefund(request, 'operator_1');
    const second = await service.executeRefund(request, 'operator_1');

    expect(second).toEqual(first);
    expect(await service.getAuditLog('org_1')).toHaveLength(1);
  });

  it('returns undefined for a nonexistent exception id instead of throwing', async () => {
    expect(await service.getException('does-not-exist')).toBeUndefined();
  });
});

const order: Order = {
  id: 'order_1',
  orgId: 'org_1',
  currency: 'EUR',
  total: 42,
  paidAt: '2026-09-01T10:00:00.000Z',
};

const invoiceMissingNow = new Date(new Date(order.paidAt).getTime() + INVOICE_MISSING_THRESHOLD_MS + 1000);

describe('ExceptionService — INVOICE_MISSING', () => {
  let service: ExceptionService;

  beforeEach(() => {
    service = new ExceptionService(new InMemoryExceptionStore(), new FakeRefundGateway());
  });

  it('creates an open exception when an order has no invoice past the threshold', async () => {
    await service.ingestOrder(order, [], invoiceMissingNow);
    expect(await service.listOpenExceptions('org_1')).toHaveLength(1);
  });

  it('does not create an exception when a matching invoice already exists', async () => {
    const invoices: Invoice[] = [
      { id: 'inv_1', orgId: 'org_1', orderId: 'order_1', issuedAt: invoiceMissingNow.toISOString() },
    ];
    await service.ingestOrder(order, invoices, invoiceMissingNow);
    expect(await service.listOpenExceptions('org_1')).toHaveLength(0);
  });

  it('ingesting the same order twice (duplicate webhook) does not duplicate the exception', async () => {
    await service.ingestOrder(order, [], invoiceMissingNow);
    await service.ingestOrder(order, [], invoiceMissingNow);
    expect(await service.listOpenExceptions('org_1')).toHaveLength(1);
  });
});

const refund: Refund = {
  id: 'rf_1',
  orgId: 'org_1',
  orderId: 'order_1',
  amount: 20,
  currency: 'EUR',
  issuedAt: '2026-09-01T10:00:00.000Z',
};

const restockMissingNow = new Date(new Date(refund.issuedAt).getTime() + RESTOCK_MISSING_THRESHOLD_MS + 1000);

describe('ExceptionService — RESTOCK_MISSING', () => {
  let service: ExceptionService;

  beforeEach(() => {
    service = new ExceptionService(new InMemoryExceptionStore(), new FakeRefundGateway());
  });

  it('creates an open exception when a refund has no inventory adjustment past the threshold', async () => {
    await service.ingestRefund(refund, [], restockMissingNow);
    expect(await service.listOpenExceptions('org_1')).toHaveLength(1);
  });

  it('does not create an exception when a matching inventory adjustment already exists', async () => {
    const adjustments: InventoryAdjustment[] = [
      { id: 'adj_1', orgId: 'org_1', orderId: 'order_1', refundId: 'rf_1', adjustedAt: restockMissingNow.toISOString() },
    ];
    await service.ingestRefund(refund, adjustments, restockMissingNow);
    expect(await service.listOpenExceptions('org_1')).toHaveLength(0);
  });

  it('ingesting the same refund twice (duplicate webhook) does not duplicate the exception', async () => {
    await service.ingestRefund(refund, [], restockMissingNow);
    await service.ingestRefund(refund, [], restockMissingNow);
    expect(await service.listOpenExceptions('org_1')).toHaveLength(1);
  });
});

const shipment: Shipment = {
  id: 'ship_1',
  orgId: 'org_1',
  orderId: 'order_1',
  status: 'IN_TRANSIT',
  lastStatusChangeAt: '2026-09-01T10:00:00.000Z',
};

const deliveryStalledNow = new Date(new Date(shipment.lastStatusChangeAt).getTime() + DELIVERY_STALLED_THRESHOLD_MS + 1000);

describe('ExceptionService — DELIVERY_STALLED', () => {
  let service: ExceptionService;

  beforeEach(() => {
    service = new ExceptionService(new InMemoryExceptionStore(), new FakeRefundGateway());
  });

  it('creates an open exception when a shipment has not changed status past the threshold', async () => {
    await service.ingestShipment(shipment, deliveryStalledNow);
    expect(await service.listOpenExceptions('org_1')).toHaveLength(1);
  });

  it('does not create an exception when the shipment already reached a terminal status', async () => {
    await service.ingestShipment({ ...shipment, status: 'DELIVERED' }, deliveryStalledNow);
    expect(await service.listOpenExceptions('org_1')).toHaveLength(0);
  });

  it('ingesting the same shipment status twice (duplicate webhook) does not duplicate the exception', async () => {
    await service.ingestShipment(shipment, deliveryStalledNow);
    await service.ingestShipment(shipment, deliveryStalledNow);
    expect(await service.listOpenExceptions('org_1')).toHaveLength(1);
  });
});
