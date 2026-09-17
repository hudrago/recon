import { PrismaClient } from '@prisma/client';

export interface SeededException {
  exceptionId: string;
  orderId: string;
}

// Seeds a REFUND_MISSING exception directly in the e2e database — per testing.instructions.md,
// e2e drives the UI against a seeded environment, not a live provider webhook. Reproducing the
// real Shopify HMAC + single-tenant SHOPIFY_ORG_ID match here would require the org id to be
// known ahead of time, but better-auth generates it when the UI creates the organization.
export async function seedRefundMissingException(orgId: string): Promise<SeededException> {
  const databaseUrl = process.env.E2E_DATABASE_URL;
  if (!databaseUrl) throw new Error('E2E_DATABASE_URL was not configured');

  const suffix = `${process.pid}_${Date.now().toString(36)}`;
  const orderId = `e2e_order_${suffix}`;
  const exceptionId = `REFUND_MISSING:${orgId}:e2e_return_${suffix}`;

  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    await prisma.exceptionRecord.create({
      data: {
        id: exceptionId,
        orgId,
        code: 'REFUND_MISSING',
        orderId,
        detectedAt: new Date(),
        status: 'open',
        context: {},
      },
    });
  } finally {
    await prisma.$disconnect();
  }

  return { exceptionId, orderId };
}
