import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import type { SubscriptionLifecycleStatus, SubscriptionRecord } from './billingEntitlement';
import type { BillingInvoiceInput, BillingStore, ProcessedOrderInput } from './billingStore';
import type { PlanCode } from './plans';

interface SubscriptionRow {
  orgId: string;
  planCode: string;
  status: string;
  trialEndsAt: Date | null;
  graceEndsAt: Date | null;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
}

function toSubscriptionRecord(row: SubscriptionRow): SubscriptionRecord {
  return {
    orgId: row.orgId,
    planCode: row.planCode as PlanCode,
    status: row.status as SubscriptionLifecycleStatus,
    trialEndsAt: row.trialEndsAt,
    graceEndsAt: row.graceEndsAt,
    currentPeriodStart: row.currentPeriodStart,
    currentPeriodEnd: row.currentPeriodEnd,
  };
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

// Real Postgres-backed store. NOT exercised by an automated test in this repo yet — there is no
// live Postgres instance in the dev sandbox this was written in. Verify against a real database
// (see docker-compose.yml) before trusting this in production.
@Injectable()
export class PrismaBillingStore implements BillingStore {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async ensureSubscription(record: SubscriptionRecord): Promise<SubscriptionRecord> {
    try {
      const created = await this.prisma.subscription.create({
        data: {
          orgId: record.orgId,
          planCode: record.planCode,
          status: record.status,
          trialEndsAt: record.trialEndsAt,
          graceEndsAt: record.graceEndsAt,
          currentPeriodStart: record.currentPeriodStart,
          currentPeriodEnd: record.currentPeriodEnd,
        },
      });
      return toSubscriptionRecord(created);
    } catch (error) {
      if (!isUniqueConstraintViolation(error)) throw error;
      const existing = await this.getSubscription(record.orgId);
      if (!existing) throw error;
      return existing;
    }
  }

  async getSubscription(orgId: string): Promise<SubscriptionRecord | undefined> {
    const row = await this.prisma.subscription.findUnique({ where: { orgId } });
    return row ? toSubscriptionRecord(row) : undefined;
  }

  async updateSubscription(orgId: string, patch: Partial<Omit<SubscriptionRecord, 'orgId'>>): Promise<SubscriptionRecord> {
    const updated = await this.prisma.subscription.update({ where: { orgId }, data: patch });
    return toSubscriptionRecord(updated);
  }

  async setStripeIdentifiers(orgId: string, stripeCustomerId: string, stripeSubscriptionId: string | null): Promise<void> {
    await this.prisma.subscription.update({ where: { orgId }, data: { stripeCustomerId, stripeSubscriptionId } });
  }

  async findByStripeCustomerId(stripeCustomerId: string): Promise<SubscriptionRecord | undefined> {
    const row = await this.prisma.subscription.findFirst({ where: { stripeCustomerId } });
    return row ? toSubscriptionRecord(row) : undefined;
  }

  async recordProcessedOrder(order: ProcessedOrderInput): Promise<void> {
    try {
      await this.prisma.processedOrder.create({
        data: {
          orgId: order.orgId,
          provider: order.provider,
          externalOrderId: order.externalOrderId,
          amountCents: order.amountCents,
          currency: order.currency,
          paidAt: order.paidAt,
        },
      });
    } catch (error) {
      if (!isUniqueConstraintViolation(error)) throw error;
    }
  }

  async countProcessedOrders(orgId: string, periodStart: Date, periodEnd: Date): Promise<number> {
    return this.prisma.processedOrder.count({ where: { orgId, paidAt: { gte: periodStart, lt: periodEnd } } });
  }

  async recordInvoice(invoice: BillingInvoiceInput): Promise<void> {
    try {
      await this.prisma.billingInvoice.create({
        data: {
          id: randomUUID(),
          orgId: invoice.orgId,
          stripeInvoiceId: invoice.stripeInvoiceId,
          amountCents: invoice.amountCents,
          currency: invoice.currency,
          status: invoice.status,
          hostedInvoiceUrl: invoice.hostedInvoiceUrl,
          periodStart: invoice.periodStart,
          periodEnd: invoice.periodEnd,
        },
      });
    } catch (error) {
      if (!isUniqueConstraintViolation(error)) throw error;
    }
  }

  async claimBillingWebhook(provider: string, eventId: string, orgId: string | null): Promise<boolean> {
    try {
      await this.prisma.billingWebhookReceipt.create({ data: { provider, eventId, orgId, status: 'PROCESSING' } });
      return true;
    } catch (error) {
      if (!isUniqueConstraintViolation(error)) throw error;
      return false;
    }
  }

  async completeBillingWebhook(provider: string, eventId: string): Promise<void> {
    await this.prisma.billingWebhookReceipt.update({ where: { provider_eventId: { provider, eventId } }, data: { status: 'SUCCEEDED' } });
  }

  async releaseBillingWebhook(provider: string, eventId: string): Promise<void> {
    await this.prisma.billingWebhookReceipt.deleteMany({ where: { provider, eventId } });
  }
}
