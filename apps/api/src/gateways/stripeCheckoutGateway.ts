import { Injectable } from '@nestjs/common';
import type { CheckoutSessionRequest, CheckoutSessionResult, StripeGateway } from '../billing/stripeGateway';

interface StripeCheckoutSessionResponse {
  url: string | null;
}

interface StripeErrorResponse {
  error?: { message: string };
}

// Real Stripe REST integration — plain fetch calls rather than the `stripe` SDK, mirroring
// ShopifyRefundGateway's approach. See https://docs.stripe.com/api/checkout/sessions/create
@Injectable()
export class StripeCheckoutGateway implements StripeGateway {
  private readonly apiUrl = 'https://api.stripe.com/v1/checkout/sessions';

  constructor(private readonly secretKey: string) {}

  async createCheckoutSession(request: CheckoutSessionRequest): Promise<CheckoutSessionResult> {
    const body = new URLSearchParams({
      mode: 'subscription',
      'line_items[0][price]': request.priceId,
      'line_items[0][quantity]': '1',
      success_url: request.successUrl,
      cancel_url: request.cancelUrl,
      client_reference_id: request.orgId,
      'subscription_data[metadata][orgId]': request.orgId,
    });

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    const payload = (await response.json()) as StripeCheckoutSessionResponse & StripeErrorResponse;
    if (!response.ok || !payload.url) {
      throw new Error(`Stripe checkout session creation failed: ${payload.error?.message ?? response.statusText}`);
    }

    return { url: payload.url };
  }
}
