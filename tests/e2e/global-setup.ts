import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const require = createRequire(path.resolve(process.cwd(), 'package.json'));

function databaseConfiguration() {
  const databaseUrl = process.env.E2E_DATABASE_URL;
  if (!databaseUrl) throw new Error('E2E_DATABASE_URL was not configured');

  const parsedUrl = new URL(databaseUrl);
  const schema = parsedUrl.searchParams.get('schema');
  if (!schema?.startsWith('recon_e2e') || !/^[a-zA-Z0-9_]+$/.test(schema)) {
    throw new Error('Refusing to reset a database schema that is not prefixed with recon_e2e');
  }

  const administrativeUrl = new URL(parsedUrl);
  administrativeUrl.searchParams.set('schema', 'public');
  return { databaseUrl, administrativeUrl: administrativeUrl.toString(), schema };
}

async function dropE2eSchema(administrativeUrl: string, schema: string) {
  const prisma = new PrismaClient({ datasources: { db: { url: administrativeUrl } } });
  try {
    await prisma.$executeRawUnsafe("SET statement_timeout = '15s'");
    await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  } finally {
    await prisma.$disconnect();
  }
}

async function verifyLastOwnerConstraint(databaseUrl: string) {
  const first = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const second = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const suffix = `${process.pid}_${Date.now()}`;
  const organizationId = `e2e_owner_guard_${suffix}`;
  const firstUserId = `e2e_owner_1_${suffix}`;
  const secondUserId = `e2e_owner_2_${suffix}`;

  try {
    await first.organization.create({
      data: {
        id: organizationId,
        name: 'E2E owner guard',
        slug: organizationId,
        createdAt: new Date(),
        members: {
          create: [
            { id: `member_1_${suffix}`, role: 'owner', createdAt: new Date(), user: { create: { id: firstUserId, name: 'Owner One', email: `${firstUserId}@example.com`, emailVerified: true, createdAt: new Date(), updatedAt: new Date() } } },
            { id: `member_2_${suffix}`, role: 'owner', createdAt: new Date(), user: { create: { id: secondUserId, name: 'Owner Two', email: `${secondUserId}@example.com`, emailVerified: true, createdAt: new Date(), updatedAt: new Date() } } },
          ],
        },
      },
    });

    const removals = await Promise.allSettled([
      first.member.delete({ where: { userId_organizationId: { userId: firstUserId, organizationId } } }),
      second.member.delete({ where: { userId_organizationId: { userId: secondUserId, organizationId } } }),
    ]);
    if (removals.filter(({ status }) => status === 'fulfilled').length !== 1) {
      throw new Error('Last-owner constraint did not serialize concurrent removals');
    }
  } finally {
    await first.organization.deleteMany({ where: { id: organizationId } });
    await first.user.deleteMany({ where: { id: { in: [firstUserId, secondUserId] } } });
    await Promise.all([first.$disconnect(), second.$disconnect()]);
  }
}

export default async function globalSetup() {
  const { databaseUrl, administrativeUrl, schema } = databaseConfiguration();
  await dropE2eSchema(administrativeUrl, schema);

  try {
    execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'], {
      cwd: path.resolve(process.cwd(), 'apps/api'),
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: 'inherit',
    });
    await verifyLastOwnerConstraint(databaseUrl);
  } catch (error) {
    await dropE2eSchema(administrativeUrl, schema);
    throw error;
  }

  return async () => dropE2eSchema(administrativeUrl, schema);
}
