import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import { CARRIER_TRACKING_GATEWAY, type CarrierTrackingGateway } from '../carrierTrackingGateway';
import { ExceptionService } from '../exceptionService';
import { EXCEPTION_STORE, type ExceptionStore } from '../exceptionStore';

// No real CTT/DPD gateway exists yet (see FakeCarrierTrackingGateway) — this job is wired and
// tested end-to-end so a future real gateway only needs to be swapped in via
// CARRIER_TRACKING_GATEWAY, without touching the polling/ingestion plumbing.
@Injectable()
export class CarrierTrackingJob {
  private readonly logger = new Logger(CarrierTrackingJob.name);
  private running = false;

  constructor(
    @Inject(EXCEPTION_STORE) private readonly store: ExceptionStore,
    @Inject(CARRIER_TRACKING_GATEWAY) private readonly gateway: CarrierTrackingGateway,
    @Inject(ExceptionService) private readonly exceptions: ExceptionService,
  ) {}

  async run(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const activeShipments = await this.store.listActiveShipments();
      if (activeShipments.length === 0) return;

      const updates = await this.gateway.fetchStatuses(activeShipments.map((shipment) => shipment.id));
      const updateByTrackingNumber = new Map(updates.map((update) => [update.trackingNumber, update]));
      const now = new Date();

      let applied = 0;
      for (const shipment of activeShipments) {
        const update = updateByTrackingNumber.get(shipment.id);
        if (!update || update.status === shipment.status) continue;
        await this.exceptions.ingestShipment(
          { ...shipment, status: update.status, lastStatusChangeAt: update.statusChangedAt },
          now,
        );
        applied += 1;
      }
      if (applied > 0) {
        this.logger.log(`Applied ${applied} carrier tracking update${applied === 1 ? '' : 's'}`);
      }
    } finally {
      this.running = false;
    }
  }
}

@Injectable()
export class CarrierTrackingQueue implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CarrierTrackingQueue.name);
  private redis?: Redis;
  private queue?: Queue;
  private worker?: Worker;

  constructor(@Inject(CarrierTrackingJob) private readonly tracking: CarrierTrackingJob) {}

  async onModuleInit(): Promise<void> {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) return;

    this.redis = new Redis(redisUrl, { maxRetriesPerRequest: null });
    this.queue = new Queue('carrier-tracking', { connection: this.redis });
    this.worker = new Worker('carrier-tracking', () => this.tracking.run(), {
      connection: this.redis,
      concurrency: 1,
    });
    this.worker.on('failed', (job, error) => this.logger.error(`Carrier tracking job ${job?.id ?? 'unknown'} failed`, error.stack));

    await this.queue.upsertJobScheduler(
      'hourly-carrier-tracking',
      { every: 60 * 60 * 1000 },
      {
        name: 'poll-carrier-tracking',
        data: {},
        opts: {
          attempts: 5,
          backoff: { type: 'exponential', delay: 5_000 },
          removeOnComplete: 100,
          removeOnFail: 1_000,
        },
      },
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
    await this.redis?.quit();
  }
}
