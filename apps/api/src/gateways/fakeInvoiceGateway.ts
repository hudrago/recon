import type { InvoiceGateway, InvoiceGatewayRequest, InvoiceGatewayResult } from '../invoiceGateway';

// Used by tests and local dev without InvoiceXpress credentials — never calls a real API.
export class FakeInvoiceGateway implements InvoiceGateway {
  async issueInvoice(request: InvoiceGatewayRequest): Promise<InvoiceGatewayResult> {
    return { invoiceId: `invoice_${request.idempotencyKey}` };
  }
}
