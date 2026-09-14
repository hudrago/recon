import 'dotenv/config';
import { describe } from 'vitest';
import { PrismaService } from '../prisma.service';
import { runExceptionStoreContract } from './exceptionStore.contract';
import { PrismaExceptionStore } from './prismaExceptionStore';

// Runs the shared contract against the REAL Supabase Postgres database (see DATABASE_URL in
// .env). Skipped automatically when DATABASE_URL isn't set, e.g. a fresh clone with no DB yet.
describe.skipIf(!process.env.DATABASE_URL)('PrismaExceptionStore (live database)', () => {
  let prisma: PrismaService;

  runExceptionStoreContract(
    'PrismaExceptionStore',
    async () => {
      prisma = new PrismaService();
      await prisma.onModuleInit();
      return new PrismaExceptionStore(prisma);
    },
    async () => {
      // Every row this suite can create is prefixed with "contract_" — delete them all so the
      // live database doesn't accumulate test data, then close the connection.
      await prisma.webhookReceipt.deleteMany({ where: { eventId: { startsWith: 'contract_' } } });
      await prisma.exceptionRecord.deleteMany({ where: { id: { startsWith: 'contract_' } } });
      await prisma.pendingEvaluation.deleteMany({ where: { id: { startsWith: 'contract_' } } });
      await prisma.refundRecord.deleteMany({ where: { id: { startsWith: 'contract_' } } });
      await prisma.executedAction.deleteMany({ where: { OR: [{ idempotencyKey: { startsWith: 'contract_' } }, { orgId: { startsWith: 'contract_' } }] } });
      await prisma.auditLogEntry.deleteMany({ where: { orgId: { startsWith: 'contract_' } } });
      await prisma.onModuleDestroy();
    },
  );
});
