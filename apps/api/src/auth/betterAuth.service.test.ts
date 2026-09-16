import { prismaAdapter } from '@better-auth/prisma-adapter';
import { betterAuth } from 'better-auth';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma.service';
import { BetterAuthService } from './betterAuth.service';

vi.mock('@better-auth/prisma-adapter', () => ({ prismaAdapter: vi.fn(() => ({})) }));
vi.mock('better-auth', () => ({ betterAuth: vi.fn(() => ({ api: {} })) }));
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

    new BetterAuthService({} as PrismaService);

    expect(prismaAdapter).toHaveBeenCalledWith({}, { provider: 'postgresql' });
    expect(betterAuth).toHaveBeenCalledWith(expect.objectContaining({
      advanced: { ipAddress: { ipAddressHeaders: ['x-real-ip'] } },
    }));
  });
});