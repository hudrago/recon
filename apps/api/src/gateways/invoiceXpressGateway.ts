import { Injectable } from '@nestjs/common';
import type { InvoiceGateway, InvoiceGatewayRequest, InvoiceGatewayResult } from '../invoiceGateway';

interface InvoiceXpressCreateResponse {
  invoice: { id: number | string };
}

// NOT VERIFIED against a live InvoiceXpress account — their public API docs weren't reachable
// while building this (see mapInvoiceCreated.ts's same disclaimer). Best-effort shape based on
// general InvoiceXpress API conventions: POST /invoices.json?api_key=..., account subdomain per
// tenant, `reference` carries the Recon order id (mirrors how the inbound webhook mapper reads
// it back). Confirm every field against a real account before relying on this in production.
@Injectable()
export class InvoiceXpressGateway implements InvoiceGateway {
  private readonly apiUrl: string;

  constructor(
    private readonly orgId: string,
    private readonly accountName: string,
    private readonly apiKey: string,
  ) {
    this.apiUrl = `https://${accountName}.app.invoicexpress.com/invoices.json`;
  }

  async issueInvoice(request: InvoiceGatewayRequest): Promise<InvoiceGatewayResult> {
    if (request.orgId !== this.orgId) throw new Error('InvoiceXpress account is not mapped to this organization');

    const response = await fetch(`${this.apiUrl}?api_key=${encodeURIComponent(this.apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invoice: {
          date: new Date().toISOString().slice(0, 10),
          reference: request.orderId,
        },
      }),
    });
    if (!response.ok) {
      throw new Error(`InvoiceXpress invoice creation failed: ${response.status} ${response.statusText}`);
    }
    const body = (await response.json()) as InvoiceXpressCreateResponse;
    return { invoiceId: String(body.invoice.id) };
  }
}
