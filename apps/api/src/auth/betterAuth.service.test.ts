import { prismaAdapter } from '@better-auth/prisma-adapter';
import { betterAuth } from 'better-auth';
import { createAuthMiddleware } from 'better-auth/api';
import { organization } from 'better-auth/plugins';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BillingService } from '../billing/billing.service';
import type { PrismaService } from '../prisma.service';
import { BetterAuthService } from './betterAuth.service';

function createBillingServiceStub() {
  return { ensureTrial: vi.fn().mockResolvedValue(undefined) } as unknown as BillingService;
}

vi.mock('@better-auth/prisma-adapter', () => ({ prismaAdapter: vi.fn(() => ({})) }));
vi.mock('better-auth', () => ({ betterAuth: vi.fn(() => ({ api: {} })) }));
vi.mock('better-auth/api', async (importOriginal) => {
  const original = await importOriginal<typeof import('better-auth/api')>();
  return { ...original, createAuthMiddleware: vi.fn((handler) => handler) };
});
vi.mock('better-auth/node', () => ({ fromNodeHeaders: vi.fn(), toNodeHandler: vi.fn(() => vi.fn()) }));
vi.mock('better-auth/plugins', () => ({ organization: vi.fn(() => ({})) }));

describe('BetterAuthService', () => {
  const originalEnvironment = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnvironment };
    vi.clearAllMocks();
  });

  it('uses Railway client IP header for production rate limiting', () => {
    process.env.NODE_ENV = 'production';
    process.env.BETTER_AUTH_SECRET = 'production-secret-with-at-least-32-characters';

    new BetterAuthService({} as PrismaService, createBillingServiceStub());

    expect(prismaAdapter).toHaveBeenCalledWith({}, { provider: 'postgresql' });
    expect(betterAuth).toHaveBeenCalledWith(expect.objectContaining({
      advanced: { ipAddress: { ipAddressHeaders: ['x-real-ip'] } },
    }));
  });

  it('enables guarded account deletion and disables the permissive organization endpoint', async () => {
    const member = { findMany: vi.fn().mockResolvedValue([{ role: 'admin,owner' }]) };
    const invitation = { count: vi.fn().mockResolvedValue(0) };
    new BetterAuthService({ member, invitation } as unknown as PrismaService, createBillingServiceStub());

    const options = vi.mocked(betterAuth).mock.calls[0][0];
    expect(options.user?.deleteUser?.enabled).toBe(true);
    await expect(options.user?.deleteUser?.beforeDelete?.({ id: 'user_1' } as never)).rejects.toThrow('Delete or transfer owned organizations');
    expect(member.findMany).toHaveBeenCalledWith({ where: { userId: 'user_1' }, select: { role: true } });
    expect(organization).toHaveBeenCalledWith(expect.objectContaining({ disableOrganizationDeletion: true }));
  });

  it('provisions a trial subscription when a new organization is created', async () => {
    const billing = createBillingServiceStub();
    new BetterAuthService({} as PrismaService, billing);

    const organizationOptions = vi.mocked(organization).mock.calls[0][0] as { organizationHooks: { afterCreateOrganization: (data: { organization: { id: string } }) => Promise<void> } };
    await organizationOptions.organizationHooks.afterCreateOrganization({ organization: { id: 'org_1' } });
    expect(billing.ensureTrial).toHaveBeenCalledWith('org_1', expect.any(Date));
  });

  it('requires a password at the server boundary for account deletion', async () => {
    new BetterAuthService({} as PrismaService, createBillingServiceStub());
    const options = vi.mocked(betterAuth).mock.calls[0][0];
    const beforeHook = vi.mocked(createAuthMiddleware).mock.calls[0][0];

    await expect(beforeHook({ path: '/delete-user', body: {} } as never)).rejects.toThrow('Password is required');
    await expect(beforeHook({ path: '/delete-user', body: { password: 'secret' } } as never)).resolves.toBeUndefined();
    expect(options.hooks?.before).toBeDefined();
  });
});