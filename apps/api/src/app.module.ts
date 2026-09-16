import { Module } from '@nestjs/common';
import { AUTH_SESSION_PROVIDER, MEMBERSHIP_STORE } from './auth/auth.types';
import { BetterAuthService } from './auth/betterAuth.service';
import { DisabledAuthSessionProvider, DisabledMembershipStore } from './auth/disabledAuthProviders';
import { OrgGuard } from './auth/org.guard';
import { PrismaMembershipStore } from './auth/prismaMembershipStore';
import { BillingController } from "./billing/billing.controller";
import { BillingActionGuard } from "./billing/billing.guard";
import { BillingService } from "./billing/billing.service";
import { BILLING_STORE } from "./billing/billingStore";
import { BillingWebhookController } from "./billing/billingWebhook.controller";
import { InMemoryBillingStore } from "./billing/inMemoryBillingStore";
import { PrismaBillingStore } from "./billing/prismaBillingStore";
import { STRIPE_GATEWAY } from "./billing/stripeGateway";
import { ExceptionsController } from "./exceptions/exceptions.controller";
import { ExceptionService } from "./exceptionService";
import { EXCEPTION_STORE } from "./exceptionStore";
import { FakeRefundGateway } from "./gateways/fakeRefundGateway";
import { FakeStripeGateway } from "./gateways/fakeStripeGateway";
import { ShopifyRefundGateway } from "./gateways/shopifyRefundGateway";
import { StripeCheckoutGateway } from "./gateways/stripeCheckoutGateway";
import { HealthController } from "./health.controller";
import { IngestController } from "./ingest/ingest.controller";
import { OrganizationDeletionService } from "./organizations/organizationDeletion.service";
import { OrganizationsController } from "./organizations/organizations.controller";
import { PrismaService } from "./prisma.service";
import {
  ReevaluationJob,
  ReevaluationQueue,
} from "./reevaluation/reevaluation.job";
import { REFUND_GATEWAY } from "./refundGateway";
import { InMemoryExceptionStore } from "./stores/inMemoryExceptionStore";
import { PrismaExceptionStore } from "./stores/prismaExceptionStore";

// Falls back to an in-memory store when DATABASE_URL isn't set, so the API can run locally
// without Postgres. Real deployments must set DATABASE_URL to get real persistence.
const usePrisma = Boolean(process.env.DATABASE_URL);

// Falls back to a fake refund gateway (no network call) when Shopify credentials aren't set.
const useShopify = Boolean(
  process.env.SHOPIFY_SHOP_DOMAIN &&
  process.env.SHOPIFY_CLIENT_ID &&
  process.env.SHOPIFY_CLIENT_SECRET,
);

// Falls back to a fake Stripe gateway (no network call) when Stripe credentials aren't set.
const useStripe = Boolean(process.env.STRIPE_SECRET_KEY);

@Module({
  controllers: [
    ExceptionsController,
    HealthController,
    IngestController,
    BillingController,
    BillingWebhookController,
    ...(usePrisma ? [OrganizationsController] : []),
  ],
  providers: [
    ...(usePrisma
      ? [
          PrismaService,
          { provide: EXCEPTION_STORE, useClass: PrismaExceptionStore },
          { provide: BILLING_STORE, useClass: PrismaBillingStore },
          { provide: AUTH_SESSION_PROVIDER, useClass: BetterAuthService },
          { provide: MEMBERSHIP_STORE, useClass: PrismaMembershipStore },
          OrganizationDeletionService,
        ]
      : [
          { provide: EXCEPTION_STORE, useClass: InMemoryExceptionStore },
          { provide: BILLING_STORE, useClass: InMemoryBillingStore },
          {
            provide: AUTH_SESSION_PROVIDER,
            useClass: DisabledAuthSessionProvider,
          },
          { provide: MEMBERSHIP_STORE, useClass: DisabledMembershipStore },
        ]),
    useShopify
      ? {
          provide: REFUND_GATEWAY,
          useFactory: () =>
            new ShopifyRefundGateway(
              process.env.SHOPIFY_ORG_ID!,
              process.env.SHOPIFY_SHOP_DOMAIN!,
              process.env.SHOPIFY_CLIENT_ID!,
              process.env.SHOPIFY_CLIENT_SECRET!,
            ),
        }
      : { provide: REFUND_GATEWAY, useClass: FakeRefundGateway },
    useStripe
      ? {
          provide: STRIPE_GATEWAY,
          useFactory: () =>
            new StripeCheckoutGateway(process.env.STRIPE_SECRET_KEY!),
        }
      : { provide: STRIPE_GATEWAY, useClass: FakeStripeGateway },
    ExceptionService,
    BillingService,
    BillingActionGuard,
    OrgGuard,
    ...(process.env.REDIS_URL ? [ReevaluationJob, ReevaluationQueue] : []),
  ],
})
export class AppModule {}
