import { Body, Controller, Headers, HttpCode, Inject, Param, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { mapShopifyReturnToDomain, parseCarrierStatusCsv, verifyShopifyWebhookHmac } from '@recon/integrations';
import { z } from 'zod';
import { ZodValidationPipe } from '../common/zodValidationPipe';
import { OrgGuard } from '../auth/org.guard';
import type { RawBodyRequest } from '../common/rawJsonBody';
import { ExceptionService } from '../exceptionService';

const shopifyReturnCloseSchema = z.object({
  id: z.union([z.string(), z.number()]),
  admin_graphql_api_id: z.string(),
  order_id: z.union([z.string(), z.number()]),
  status: z.string(),
});

const carrierCsvSchema = z.object({ csv: z.string().min(1) });

@Controller('orgs/:orgId/ingest')
export class IngestController {
  constructor(@Inject(ExceptionService) private readonly exceptions: ExceptionService) {}

  // Shopify `returns/close` webhook.
  @Post('shopify/returns')
  @HttpCode(200)
  async shopifyReturnClosed(
    @Param('orgId') orgId: string,
    @Req() request: RawBodyRequest,
    @Body(new ZodValidationPipe(shopifyReturnCloseSchema)) body: z.infer<typeof shopifyReturnCloseSchema>,
    @Headers('x-shopify-hmac-sha256') hmac: string | undefined,
    @Headers('x-shopify-webhook-id') webhookId: string | undefined,
    @Headers('x-shopify-shop-domain') shopDomain: string | undefined,
    @Headers('x-shopify-triggered-at') triggeredAt: string | undefined,
  ) {
    const secret = process.env.SHOPIFY_CLIENT_SECRET;
    if (!secret || !hmac || !request.rawBody || !verifyShopifyWebhookHmac(request.rawBody.toString('utf8'), hmac, secret)) {
      throw new UnauthorizedException('Invalid Shopify webhook signature');
    }

    const configuredOrgId = process.env.SHOPIFY_ORG_ID;
    const configuredShopDomain = process.env.SHOPIFY_SHOP_DOMAIN?.toLowerCase();
    if (!webhookId || !shopDomain || orgId !== configuredOrgId || shopDomain.toLowerCase() !== configuredShopDomain) {
      throw new UnauthorizedException('Shopify webhook is not mapped to this organization');
    }

    const claimed = await this.exceptions.claimWebhook('shopify', webhookId, orgId);
    if (!claimed) return { status: 'accepted', duplicate: true, exceptionCreated: false };

    try {
      const returnRecord = mapShopifyReturnToDomain(body, triggeredAt ?? new Date().toISOString(), orgId);
      const exception = await this.exceptions.ingestReturn(returnRecord, [], new Date());
      return { status: 'accepted', duplicate: false, exceptionCreated: Boolean(exception) };
    } catch (error) {
      await this.exceptions.releaseWebhook('shopify', webhookId);
      throw error;
    }
  }

  // MVP carrier integration: CSV upload instead of a live carrier API (see architecture notes).
  @Post('carrier-csv')
  @HttpCode(200)
  @UseGuards(OrgGuard)
  async carrierCsv(
    @Param('orgId') orgId: string,
    @Body(new ZodValidationPipe(carrierCsvSchema)) body: z.infer<typeof carrierCsvSchema>,
  ) {
    const { shipments, errors } = parseCarrierStatusCsv(body.csv, orgId);
    const now = new Date();
    let exceptionsCreated = 0;
    for (const shipment of shipments) {
      const exception = await this.exceptions.ingestShipment(shipment, now);
      if (exception) exceptionsCreated += 1;
    }
    return { accepted: shipments.length, exceptionsCreated, errors };
  }
}
