import { beforeEach, describe, expect, it, vi } from 'vitest';
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

  it('does not create a refund exception when the refund webhook arrives first', async () => {
    const refund: Refund = { id: 'rf_first', orgId: 'org_1', orderId: 'order_1', amount: 10, currency: 'EUR', issuedAt: now.toISOString() };
    await service.ingestRefund(refund, [], now);
    await service.ingestReturn(returnRecord, [], now);
    expect((await service.listOpenExceptions('org_1')).filter((exception) => exception.code === 'REFUND_MISSING')).toHaveLength(0);
  });

  it('cancels pending refund evaluation when the refund webhook arrives later', async () => {
    const beforeThreshold = new Date(new Date(returnRecord.receivedAt).getTime() + REFUND_MISSING_THRESHOLD_MS - 1000);
    await service.ingestReturn(returnRecord, [], beforeThreshold);
    await service.ingestRefund({ id: 'rf_later', orgId: 'org_1', orderId: 'order_1', amount: 10, currency: 'EUR', issuedAt: beforeThreshold.toISOString() }, [], beforeThreshold);
    expect(await service.reevaluatePending(now)).toBe(0);
    expect((await service.listOpenExceptions('org_1')).filter((exception) => exception.code === 'REFUND_MISSING')).toHaveLength(0);
  });

  it('resolves an open refund exception when Shopify reports the refund', async () => {
    await service.ingestReturn(returnRecord, [], now);
    await service.ingestRefund({ id: 'rf_resolve', orgId: 'org_1', orderId: 'order_1', amount: 10, currency: 'EUR', issuedAt: now.toISOString() }, [], now);
    expect(await service.listOpenExceptions('org_1')).toHaveLength(0);
    expect((await service.getException(`REFUND_MISSING:org_1:${returnRecord.id}`))?.status).toBe('resolved');
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
        { exceptionId: exception.id },
        'operator_1',
      ),
    ).rejects.toThrow(/not approved/);
  });

  it('executes the refund once approved and records an audit entry', async () => {
    await service.ingestReturn(returnRecord, [], now);
    const [exception] = await service.listOpenExceptions('org_1');
    await service.approve(exception.id, 'operator_1', 'Customer refund approved', { amountMinor: 1000, currency: 'EUR' });

    const result = await service.executeRefund(
      { exceptionId: exception.id },
      'operator_1',
    );

    expect(result.refundId).toBe('refund_refund:REFUND_MISSING:org_1:ret_1');
    expect(await service.getAuditLog('org_1')).toHaveLength(2);
  });

  it('replaying the same idempotency key does not issue a duplicate refund', async () => {
    await service.ingestReturn(returnRecord, [], now);
    const [exception] = await service.listOpenExceptions('org_1');
    await service.approve(exception.id, 'operator_1', 'Customer refund approved', { amountMinor: 1000, currency: 'EUR' });

    const request = { exceptionId: exception.id };
    const first = await service.executeRefund(request, 'operator_1');
    const second = await service.executeRefund(request, 'operator_1');

    expect(second).toEqual(first);
    expect(await service.getAuditLog('org_1')).toHaveLength(2);
  });

  it('allows only one concurrent request to reach the refund gateway', async () => {
    let releaseGateway!: () => void;
    const gatewayResult = new Promise<{ refundId: string }>((resolve) => { releaseGateway = () => resolve({ refundId: 'refund_key_concurrent' }); });
    const createRefund = vi.fn().mockReturnValue(gatewayResult);
    service = new ExceptionService(new InMemoryExceptionStore(), { createRefund });
    await service.ingestReturn(returnRecord, [], now);
    const [exception] = await service.listOpenExceptions('org_1');
    await service.approve(exception.id, 'operator_1', 'Customer refund approved', { amountMinor: 1000, currency: 'EUR' });
    const request = { exceptionId: exception.id };

    const first = service.executeRefund(request, 'operator_1');
    await expect(service.executeRefund(request, 'operator_1')).rejects.toThrow(/already in progress/);
    releaseGateway();
    await expect(first).resolves.toEqual({ refundId: 'refund_key_concurrent' });
    expect(createRefund).toHaveBeenCalledOnce();
  });

  it('persists a provider failure and permits retry with the same key', async () => {
    const createRefund = vi.fn()
      .mockRejectedValueOnce(new Error('Shopify temporarily unavailable'))
      .mockResolvedValueOnce({ refundId: 'refund_key_retry' });
    service = new ExceptionService(new InMemoryExceptionStore(), { createRefund });
    await service.ingestReturn(returnRecord, [], now);
    const [exception] = await service.listOpenExceptions('org_1');
    await service.approve(exception.id, 'operator_1', 'Customer refund approved', { amountMinor: 1000, currency: 'EUR' });
    const request = { exceptionId: exception.id };

    await expect(service.executeRefund(request, 'operator_1')).rejects.toThrow('Shopify temporarily unavailable');
    await expect(service.executeRefund(request, 'operator_1')).resolves.toEqual({ refundId: 'refund_key_retry' });
    expect(createRefund).toHaveBeenCalledTimes(2);
  });

  it('retries ambiguous local completion with identical provider parameters', async () => {
    const store = new InMemoryExceptionStore();
    const completeAction = store.completeAction.bind(store);
    vi.spyOn(store, 'completeAction')
      .mockRejectedValueOnce(new Error('Database commit failed'))
      .mockImplementation(completeAction);
    const createRefund = vi.fn().mockResolvedValue({ refundId: 'refund_ambiguous' });
    service = new ExceptionService(store, { createRefund });
    await service.ingestReturn(returnRecord, [], now);
    const [exception] = await service.listOpenExceptions('org_1');
    await service.approve(exception.id, 'operator_1', 'Customer refund approved', { amountMinor: 1000, currency: 'EUR' });

    await expect(service.executeRefund({ exceptionId: exception.id }, 'operator_1')).rejects.toThrow('Database commit failed');
    await expect(service.executeRefund({ exceptionId: exception.id }, 'operator_1')).resolves.toEqual({ refundId: 'refund_ambiguous' });
    expect(createRefund).toHaveBeenCalledTimes(2);
    expect(createRefund.mock.calls[1]).toEqual(createRefund.mock.calls[0]);
  });

  it('rejects approval without immutable refund terms', async () => {
    await service.ingestReturn(returnRecord, [], now);
    const [exception] = await service.listOpenExceptions('org_1');
    await expect(service.approve(exception.id, 'operator_1', 'Customer refund approved')).rejects.toThrow(/requires immutable/);
  });

  it('does not allow a resolved exception to be approved again', async () => {
    await service.ingestReturn(returnRecord, [], now);
    const [exception] = await service.listOpenExceptions('org_1');
    await service.approve(exception.id, 'operator_1', 'Customer refund approved', { amountMinor: 1000, currency: 'EUR' });
    await service.executeRefund({ exceptionId: exception.id }, 'operator_1');
    await expect(service.approve(exception.id, 'operator_1', 'Approve again')).rejects.toThrow(/cannot be approved/);
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

  it("does not create an invoice exception when the InvoiceXpress webhook arrives first", async () => {
    const invoice: Invoice = {
      id: "inv_first",
      orgId: "org_1",
      orderId: "order_1",
      issuedAt: invoiceMissingNow.toISOString(),
    };
    await service.ingestInvoice(invoice, invoiceMissingNow);
    await service.ingestOrder(order, [], invoiceMissingNow);
    expect(
      (await service.listOpenExceptions("org_1")).filter(
        (exception) => exception.code === "INVOICE_MISSING",
      ),
    ).toHaveLength(0);
  });

  it("cancels pending invoice evaluation when the invoice webhook arrives later", async () => {
    const beforeThreshold = new Date(
      new Date(order.paidAt).getTime() + INVOICE_MISSING_THRESHOLD_MS - 1000,
    );
    await service.ingestOrder(order, [], beforeThreshold);
    await service.ingestInvoice(
      {
        id: "inv_later",
        orgId: "org_1",
        orderId: "order_1",
        issuedAt: beforeThreshold.toISOString(),
      },
      beforeThreshold,
    );
    expect(await service.reevaluatePending(invoiceMissingNow)).toBe(0);
    expect(
      (await service.listOpenExceptions("org_1")).filter(
        (exception) => exception.code === "INVOICE_MISSING",
      ),
    ).toHaveLength(0);
  });

  it("resolves an open invoice exception when InvoiceXpress reports the invoice", async () => {
    await service.ingestOrder(order, [], invoiceMissingNow);
    await service.ingestInvoice(
      {
        id: "inv_resolve",
        orgId: "org_1",
        orderId: "order_1",
        issuedAt: invoiceMissingNow.toISOString(),
      },
      invoiceMissingNow,
    );
    expect(await service.listOpenExceptions("org_1")).toHaveLength(0);
    expect(
      (await service.getException(`INVOICE_MISSING:org_1:${order.id}`))?.status,
    ).toBe("resolved");
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
