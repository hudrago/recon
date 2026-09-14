import { BadRequestException, Body, Controller, Headers, HttpCode, Inject, Param, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { mapShopifyOrderPaidToDomain, mapShopifyRefundCreatedToDomain, mapShopifyReturnToDomain, parseCarrierStatusCsv, verifyShopifyWebhookHmac } from '@recon/integrations';
import JSONbig from 'json-bigint';
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
const parseShopifyJson = JSONbig({ storeAsString: true, strict: true }).parse;

@Controller('orgs/:orgId/ingest')
export class IngestController {
  constructor(@Inject(ExceptionService) private readonly exceptions: ExceptionService) {}

  // Shopify `returns/close` webhook.
  @Post('shopify/returns')
  @HttpCode(200)
  async shopifyReturnClosed(
    @Param('orgId') orgId: string,
    @Req() request: RawBodyRequest,
    @Headers('x-shopify-hmac-sha256') hmac: string | undefined,
    @Headers('x-shopify-webhook-id') webhookId: string | undefined,
    @Headers('x-shopify-shop-domain') shopDomain: string | undefined,
    @Headers('x-shopify-triggered-at') triggeredAt: string | undefined,
  ) {
    return this.handleShopifyWebhook(request, hmac, webhookId, shopDomain, orgId, async (payload) => {
      const body = shopifyReturnCloseSchema.safeParse(payload);
      if (!body.success) throw new BadRequestException('Invalid Shopify return payload');
      const returnRecord = mapShopifyReturnToDomain(body.data, triggeredAt ?? new Date().toISOString(), orgId);
      const exception = await this.exceptions.ingestReturn(returnRecord, [], new Date());
      return Boolean(exception);
    });
  }

  @Post('shopify/orders/paid')
  @HttpCode(200)
  async shopifyOrderPaid(
    @Param('orgId') orgId: string,
    @Req() request: RawBodyRequest,
    @Headers('x-shopify-hmac-sha256') hmac: string | undefined,
    @Headers('x-shopify-webhook-id') webhookId: string | undefined,
    @Headers('x-shopify-shop-domain') shopDomain: string | undefined,
  ) {
    return this.handleShopifyWebhook(request, hmac, webhookId, shopDomain, orgId, async (payload) => {
      const order = mapShopifyOrderPaidToDomain(payload, orgId);
      if (!order) throw new BadRequestException('Invalid Shopify paid order payload');
      const exception = await this.exceptions.ingestOrder(order, [], new Date());
      return Boolean(exception);
    });
  }

  @Post('shopify/refunds')
  @HttpCode(200)
  async shopifyRefundCreated(
    @Param('orgId') orgId: string,
    @Req() request: RawBodyRequest,
    @Headers('x-shopify-hmac-sha256') hmac: string | undefined,
    @Headers('x-shopify-webhook-id') webhookId: string | undefined,
    @Headers('x-shopify-shop-domain') shopDomain: string | undefined,
  ) {
    return this.handleShopifyWebhook(request, hmac, webhookId, shopDomain, orgId, async (payload) => {
      const refund = mapShopifyRefundCreatedToDomain(payload, orgId);
      if (!refund) throw new BadRequestException('Invalid Shopify refund payload');
      const exception = await this.exceptions.ingestRefund(refund, [], new Date());
      return Boolean(exception);
    });
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

  private async handleShopifyWebhook(
    request: RawBodyRequest,
    hmac: string | undefined,
    webhookId: string | undefined,
    shopDomain: string | undefined,
    orgId: string,
    ingest: (payload: unknown) => Promise<boolean>,
  ) {
    const secret = process.env.SHOPIFY_CLIENT_SECRET;
    const rawBody = request.rawBody?.toString('utf8');
    if (!secret || !hmac || !rawBody || !verifyShopifyWebhookHmac(rawBody, hmac, secret)) {
      throw new UnauthorizedException('Invalid Shopify webhook signature');
    }

    const configuredOrgId = process.env.SHOPIFY_ORG_ID;
    const configuredShopDomain = process.env.SHOPIFY_SHOP_DOMAIN?.toLowerCase();
    if (!webhookId || !shopDomain || orgId !== configuredOrgId || shopDomain.toLowerCase() !== configuredShopDomain) {
      throw new UnauthorizedException('Shopify webhook is not mapped to this organization');
    }

    let payload: unknown;
    try {
      payload = parseShopifyJson(rawBody);
    } catch {
      throw new BadRequestException('Invalid Shopify JSON payload');
    }

    const claimed = await this.exceptions.claimWebhook('shopify', webhookId, orgId);
    if (!claimed) return { status: 'accepted', duplicate: true, exceptionCreated: false };

    try {
      const exceptionCreated = await ingest(payload);
      await this.exceptions.completeWebhook('shopify', webhookId);
      return { status: 'accepted', duplicate: false, exceptionCreated };
    } catch (error) {
      await this.exceptions.releaseWebhook('shopify', webhookId);
      throw error;
    }
  }
}
