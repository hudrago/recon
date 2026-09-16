import { Inject, Injectable } from '@nestjs/common';
import { prismaAdapter } from '@better-auth/prisma-adapter';
import { betterAuth } from 'better-auth';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { fromNodeHeaders, toNodeHandler } from 'better-auth/node';
import { organization } from 'better-auth/plugins';
import type { IncomingHttpHeaders } from 'node:http';
import { BillingService } from '../billing/billing.service';
import { PrismaService } from '../prisma.service';
import type { AuthSession, AuthSessionProvider } from './auth.types';

const developmentSecret = 'recon-development-secret-change-before-production';

@Injectable()
export class BetterAuthService implements AuthSessionProvider {
  private readonly auth;
  readonly handler;

  constructor(
    @Inject(PrismaService) prisma: PrismaService,
    @Inject(BillingService) billing: BillingService,
  ) {
    if (process.env.NODE_ENV === 'production' && !process.env.BETTER_AUTH_SECRET) {
      throw new Error('BETTER_AUTH_SECRET is required in production');
    }

    this.auth = betterAuth({
      appName: 'Recon',
      baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3001',
      secret: process.env.BETTER_AUTH_SECRET ?? developmentSecret,
      trustedOrigins: [process.env.WEB_URL ?? 'http://localhost:3000'],
      database: prismaAdapter(prisma, { provider: 'postgresql' }),
      emailAndPassword: { enabled: true },
      hooks: {
        before: createAuthMiddleware(async (context) => {
          if (context.path === '/delete-user' && !context.body?.password) {
            throw new APIError('BAD_REQUEST', { message: 'Password is required to delete the account.' });
          }
        }),
      },
      user: {
        deleteUser: {
          enabled: true,
          beforeDelete: async (user) => {
            const [memberships, invitations] = await Promise.all([
              prisma.member.findMany({ where: { userId: user.id }, select: { role: true } }),
              prisma.invitation.count({ where: { inviterId: user.id } }),
            ]);
            if (memberships.some(({ role }) => role.split(',').map((value) => value.trim()).includes('owner'))) {
              throw new APIError('CONFLICT', { message: 'Delete or transfer owned organizations before deleting the account.' });
            }
            if (invitations > 0) throw new APIError('CONFLICT', { message: 'Revoke outstanding organization invitations before deleting the account.' });
          },
        },
      },
      advanced: process.env.NODE_ENV === 'production'
        ? { ipAddress: { ipAddressHeaders: ['x-real-ip'] } }
        : undefined,
      plugins: [organization({
        requireEmailVerificationOnInvitation: true,
        disableOrganizationDeletion: true,
        organizationHooks: {
          // Every new organization starts on a 30-day Growth trial, no card required. Idempotent —
          // safe even if this hook is retried after a partial failure.
          afterCreateOrganization: async ({ organization: createdOrganization }) => {
            await billing.ensureTrial(createdOrganization.id, new Date());
          },
        },
      })],
    });
    this.handler = toNodeHandler(this.auth);
  }

  async getSession(headers: IncomingHttpHeaders): Promise<AuthSession | null> {
    const session = await this.auth.api.getSession({ headers: fromNodeHeaders(headers) });
    if (!session) return null;
    return {
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
      },
    };
  }
}