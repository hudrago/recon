import { Inject, Injectable } from '@nestjs/common';
import { prismaAdapter } from '@better-auth/prisma-adapter';
import { betterAuth } from 'better-auth';
import { fromNodeHeaders, toNodeHandler } from 'better-auth/node';
import { organization } from 'better-auth/plugins';
import type { IncomingHttpHeaders } from 'node:http';
import { PrismaService } from '../prisma.service';
import type { AuthSession, AuthSessionProvider } from './auth.types';

const developmentSecret = 'recon-development-secret-change-before-production';

@Injectable()
export class BetterAuthService implements AuthSessionProvider {
  private readonly auth;
  readonly handler;

  constructor(@Inject(PrismaService) prisma: PrismaService) {
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
      plugins: [organization({ requireEmailVerificationOnInvitation: true })],
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