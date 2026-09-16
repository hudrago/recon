export interface CheckoutSessionRequest {
  orgId: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutSessionResult {
  url: string;
}

export interface StripeGateway {
  createCheckoutSession(request: CheckoutSessionRequest): Promise<CheckoutSessionResult>;
}

// NestJS DI token — StripeGateway is an interface, so there's no class to bind a provider to directly.
export const STRIPE_GATEWAY = Symbol('STRIPE_GATEWAY');
