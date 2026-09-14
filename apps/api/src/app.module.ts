import { Module } from '@nestjs/common';
import { AUTH_SESSION_PROVIDER, MEMBERSHIP_STORE } from './auth/auth.types';
import { BetterAuthService } from './auth/betterAuth.service';
import { DisabledAuthSessionProvider, DisabledMembershipStore } from './auth/disabledAuthProviders';
import { OrgGuard } from './auth/org.guard';
import { PrismaMembershipStore } from './auth/prismaMembershipStore';
import { ExceptionsController } from './exceptions/exceptions.controller';
import { ExceptionService } from './exceptionService';
import { EXCEPTION_STORE } from './exceptionStore';
import { FakeRefundGateway } from './gateways/fakeRefundGateway';
import { ShopifyRefundGateway } from './gateways/shopifyRefundGateway';
import { IngestController } from './ingest/ingest.controller';
import { PrismaService } from './prisma.service';
import { ReevaluationJob, ReevaluationQueue } from './reevaluation/reevaluation.job';
import { REFUND_GATEWAY } from './refundGateway';
import { InMemoryExceptionStore } from './stores/inMemoryExceptionStore';
import { PrismaExceptionStore } from './stores/prismaExceptionStore';

// Falls back to an in-memory store when DATABASE_URL isn't set, so the API can run locally
// without Postgres. Real deployments must set DATABASE_URL to get real persistence.
const usePrisma = Boolean(process.env.DATABASE_URL);

// Falls back to a fake refund gateway (no network call) when Shopify credentials aren't set.
const useShopify = Boolean(process.env.SHOPIFY_SHOP_DOMAIN && process.env.SHOPIFY_CLIENT_ID && process.env.SHOPIFY_CLIENT_SECRET);

@Module({
  controllers: [ExceptionsController, IngestController],
  providers: [
    ...(usePrisma
      ? [
          PrismaService,
          { provide: EXCEPTION_STORE, useClass: PrismaExceptionStore },
          { provide: AUTH_SESSION_PROVIDER, useClass: BetterAuthService },
          { provide: MEMBERSHIP_STORE, useClass: PrismaMembershipStore },
        ]
      : [
          { provide: EXCEPTION_STORE, useClass: InMemoryExceptionStore },
          { provide: AUTH_SESSION_PROVIDER, useClass: DisabledAuthSessionProvider },
          { provide: MEMBERSHIP_STORE, useClass: DisabledMembershipStore },
        ]),
    useShopify
      ? {
          provide: REFUND_GATEWAY,
          useFactory: () =>
            new ShopifyRefundGateway(process.env.SHOPIFY_SHOP_DOMAIN!, process.env.SHOPIFY_CLIENT_ID!, process.env.SHOPIFY_CLIENT_SECRET!),
        }
      : { provide: REFUND_GATEWAY, useClass: FakeRefundGateway },
    ExceptionService,
    OrgGuard,
    ...(process.env.REDIS_URL ? [ReevaluationJob, ReevaluationQueue] : []),
  ],
})
export class AppModule {}
