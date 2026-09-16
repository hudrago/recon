import { BadRequestException, Controller, Headers, HttpCode, Inject, Post, Req, UnauthorizedException } from '@nestjs/common';
import { mapStripeInvoicePaidEvent, mapStripeSubscriptionEvent, verifyStripeWebhookSignature } from '@recon/integrations';
import { z } from 'zod';
import type { RawBodyRequest } from '../common/rawJsonBody';
import { BillingService } from './billing.service';

const stripeEventEnvelopeSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  data: z.object({ object: z.unknown() }),
});

const SUBSCRIPTION_EVENT_TYPES = new Set(['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted']);

@Controller('billing/webhooks')
export class BillingWebhookController {
  constructor(@Inject(BillingService) private readonly billing: BillingService) {}

  // Not org-scoped like the Shopify webhooks — Stripe doesn't know our org id, so it's resolved
  // from the subscription's metadata (set at checkout) or, for invoices, the Stripe customer id.
  @Post('stripe')
  @HttpCode(200)
  async stripe(@Req() request: RawBodyRequest, @Headers('stripe-signature') signature: string | undefined) {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    const rawBody = request.rawBody?.toString('utf8');
    if (!secret || !signature || !rawBody || !verifyStripeWebhookSignature(rawBody, signature, secret)) {
      throw new UnauthorizedException('Invalid Stripe webhook signature');
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      throw new BadRequestException('Invalid Stripe JSON payload');
    }

    const event = stripeEventEnvelopeSchema.safeParse(payload);
    if (!event.success) throw new BadRequestException('Invalid Stripe event payload');
    const { id: eventId, type, data } = event.data;

    const claimed = await this.billing.claimBillingWebhook('stripe', eventId, null);
    if (!claimed) return { status: 'accepted', duplicate: true };

    try {
      if (SUBSCRIPTION_EVENT_TYPES.has(type)) {
        const mapped = mapStripeSubscriptionEvent(data.object);
        if (mapped) await this.billing.applyStripeSubscriptionEvent(mapped);
      } else if (type === 'invoice.paid') {
        const mapped = mapStripeInvoicePaidEvent(data.object);
        if (mapped) await this.billing.applyStripeInvoicePaidEvent(mapped);
      }
      // Other event types are acknowledged without action — Stripe retries on non-2xx only.
      await this.billing.completeBillingWebhook('stripe', eventId);
      return { status: 'accepted', duplicate: false };
    } catch (error) {
      await this.billing.releaseBillingWebhook('stripe', eventId);
      throw error;
    }
  }
}
