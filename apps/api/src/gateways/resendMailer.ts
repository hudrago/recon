import { Injectable } from '@nestjs/common';
import type { Mailer, SendEmailRequest } from '../mailer';

// Real Resend HTTP API integration (plain fetch, no SDK, mirrors the Stripe/Shopify gateways).
// Resend supports EU data residency via a dedicated EU sending region configured on the
// account/domain in their dashboard — not something this client controls, flagging so it's
// verified before relying on it for the GDPR "data resides in an EU region" rule.
@Injectable()
export class ResendMailer implements Mailer {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(request: SendEmailRequest): Promise<void> {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ from: this.from, to: request.to, subject: request.subject, html: request.html }),
    });
    if (!response.ok) {
      throw new Error(`Resend send failed: ${response.status} ${response.statusText}`);
    }
  }
}
