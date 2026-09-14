import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import { ExceptionService } from '../exceptionService';

@Injectable()
export class ReevaluationJob {
  private readonly logger = new Logger(ReevaluationJob.name);
  private running = false;

  constructor(@Inject(ExceptionService) private readonly exceptions: ExceptionService) {}

  async run(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const detected = await this.exceptions.reevaluatePending(new Date());
      if (detected > 0) {
        this.logger.log(`Detected ${detected} exception${detected === 1 ? '' : 's'} from pending evaluations`);
      }
    } finally {
      this.running = false;
    }
  }
}

@Injectable()
export class ReevaluationQueue implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReevaluationQueue.name);
  private redis?: Redis;
  private queue?: Queue;
  private worker?: Worker;

  constructor(@Inject(ReevaluationJob) private readonly reevaluation: ReevaluationJob) {}

  async onModuleInit(): Promise<void> {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) return;

    this.redis = new Redis(redisUrl, { maxRetriesPerRequest: null });
    this.queue = new Queue('exception-reevaluation', { connection: this.redis });
    this.worker = new Worker('exception-reevaluation', () => this.reevaluation.run(), {
      connection: this.redis,
      concurrency: 1,
    });
    this.worker.on('failed', (job, error) => this.logger.error(`Reevaluation job ${job?.id ?? 'unknown'} failed`, error.stack));

    await this.queue.upsertJobScheduler(
      'hourly-exception-reevaluation',
      { every: 60 * 60 * 1000 },
      {
        name: 'reevaluate-pending',
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