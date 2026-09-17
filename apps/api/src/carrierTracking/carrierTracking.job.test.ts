import { describe, expect, it, vi } from 'vitest';
import type { CarrierTrackingGateway } from '../carrierTrackingGateway';
import type { ExceptionService } from '../exceptionService';
import type { ExceptionStore } from '../exceptionStore';
import { CarrierTrackingJob } from './carrierTracking.job';

const activeShipment = { id: 'track_1', orgId: 'org_1', orderId: 'order_1', status: 'IN_TRANSIT' as const, lastStatusChangeAt: '2026-09-01T10:00:00.000Z' };

describe('CarrierTrackingJob', () => {
  it('does nothing when there are no active shipments', async () => {
    const listActiveShipments = vi.fn().mockResolvedValue([]);
    const fetchStatuses = vi.fn();
    const ingestShipment = vi.fn();
    const job = new CarrierTrackingJob(
      { listActiveShipments } as unknown as ExceptionStore,
      { fetchStatuses } as unknown as CarrierTrackingGateway,
      { ingestShipment } as unknown as ExceptionService,
    );

    await job.run();

    expect(fetchStatuses).not.toHaveBeenCalled();
    expect(ingestShipment).not.toHaveBeenCalled();
  });

  it('re-ingests a shipment only when the gateway reports a changed status', async () => {
    const listActiveShipments = vi.fn().mockResolvedValue([activeShipment]);
    const fetchStatuses = vi.fn().mockResolvedValue([{ trackingNumber: 'track_1', status: 'DELIVERED', statusChangedAt: '2026-09-05T10:00:00.000Z' }]);
    const ingestShipment = vi.fn();
    const job = new CarrierTrackingJob(
      { listActiveShipments } as unknown as ExceptionStore,
      { fetchStatuses } as unknown as CarrierTrackingGateway,
      { ingestShipment } as unknown as ExceptionService,
    );

    await job.run();

    expect(fetchStatuses).toHaveBeenCalledWith(['track_1']);
    expect(ingestShipment).toHaveBeenCalledOnce();
    expect(ingestShipment.mock.calls[0][0]).toMatchObject({ id: 'track_1', status: 'DELIVERED', lastStatusChangeAt: '2026-09-05T10:00:00.000Z' });
  });

  it('does not re-ingest when the gateway reports the same status', async () => {
    const listActiveShipments = vi.fn().mockResolvedValue([activeShipment]);
    const fetchStatuses = vi.fn().mockResolvedValue([{ trackingNumber: 'track_1', status: 'IN_TRANSIT', statusChangedAt: activeShipment.lastStatusChangeAt }]);
    const ingestShipment = vi.fn();
    const job = new CarrierTrackingJob(
      { listActiveShipments } as unknown as ExceptionStore,
      { fetchStatuses } as unknown as CarrierTrackingGateway,
      { ingestShipment } as unknown as ExceptionService,
    );

    await job.run();

    expect(ingestShipment).not.toHaveBeenCalled();
  });

  it('does not overlap tracking runs', async () => {
    let finishFetch: (value: never[]) => void = () => undefined;
    const listActiveShipments = vi.fn().mockResolvedValue([activeShipment]);
    const fetchStatuses = vi.fn().mockImplementation(() => new Promise((resolve) => (finishFetch = resolve)));
    const ingestShipment = vi.fn();
    const job = new CarrierTrackingJob(
      { listActiveShipments } as unknown as ExceptionStore,
      { fetchStatuses } as unknown as CarrierTrackingGateway,
      { ingestShipment } as unknown as ExceptionService,
    );

    const firstRun = job.run();
    await job.run();
    expect(fetchStatuses).toHaveBeenCalledOnce();

    finishFetch([]);
    await firstRun;
  });
});
