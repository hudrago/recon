import type { CheckoutSessionRequest, CheckoutSessionResult, StripeGateway } from '../billing/stripeGateway';

// Used by tests and local dev without Stripe credentials — never calls a real API.
export class FakeStripeGateway implements StripeGateway {
  async createCheckoutSession(request: CheckoutSessionRequest): Promise<CheckoutSessionResult> {
    return { url: `${request.successUrl}?fake_checkout=1&org=${request.orgId}` };
  }
}
