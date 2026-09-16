import { createHmac } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OrgGuard } from "../auth/org.guard";
import { BillingService } from "../billing/billing.service";
import { rawJsonBodyParser } from "../common/rawJsonBody";
import { ExceptionService } from "../exceptionService";
import { IngestController } from "./ingest.controller";

describe("IngestController Shopify webhook (http)", () => {
  let app: INestApplication;
  const ingestReturn = vi.fn().mockResolvedValue(null);
  const ingestOrder = vi.fn().mockResolvedValue(null);
  const ingestRefund = vi.fn().mockResolvedValue(null);
  const claimWebhook = vi.fn().mockResolvedValue(true);
  const completeWebhook = vi.fn().mockResolvedValue(undefined);
  const releaseWebhook = vi.fn().mockResolvedValue(undefined);
  const canIngest = vi.fn().mockResolvedValue(true);
  const recordProcessedOrder = vi.fn().mockResolvedValue(undefined);
  const secret = "test-shopify-secret";
  const payload = JSON.stringify({
    id: 123,
    admin_graphql_api_id: "gid://shopify/Return/123",
    order_id: 456,
    status: "closed",
  });

  beforeEach(async () => {
    process.env.SHOPIFY_CLIENT_SECRET = secret;
    process.env.SHOPIFY_ORG_ID = "org_1";
    process.env.SHOPIFY_SHOP_DOMAIN = "recon-test.myshopify.com";
    ingestReturn.mockClear();
    ingestOrder.mockClear();
    ingestRefund.mockClear();
    claimWebhook.mockClear().mockResolvedValue(true);
    completeWebhook.mockClear();
    releaseWebhook.mockClear();
    canIngest.mockClear().mockResolvedValue(true);
    recordProcessedOrder.mockClear();
    const moduleRef = await Test.createTestingModule({
      controllers: [IngestController],
      providers: [
        {
          provide: ExceptionService,
          useValue: {
            claimWebhook,
            completeWebhook,
            releaseWebhook,
            ingestReturn,
            ingestOrder,
            ingestRefund,
            ingestShipment: vi.fn(),
          },
        },
        {
          provide: BillingService,
          useValue: { canIngest, recordProcessedOrder },
        },
      ],
    })
      .overrideGuard(OrgGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = moduleRef.createNestApplication({ bodyParser: false });
    app.use(rawJsonBodyParser);
    await app.init();
  });

  afterEach(async () => {
    delete process.env.SHOPIFY_CLIENT_SECRET;
    delete process.env.SHOPIFY_ORG_ID;
    delete process.env.SHOPIFY_SHOP_DOMAIN;
    await app?.close();
  });

  it("accepts a webhook signed over the exact raw body", async () => {
    const hmac = createHmac("sha256", secret).update(payload).digest("base64");

    await request(app.getHttpServer())
      .post("/orgs/org_1/ingest/shopify/returns")
      .set("content-type", "application/json")
      .set("x-shopify-hmac-sha256", hmac)
      .set("x-shopify-webhook-id", "webhook_1")
      .set("x-shopify-shop-domain", "recon-test.myshopify.com")
      .send(payload)
      .expect(200);

    expect(ingestReturn).toHaveBeenCalledOnce();
  });

  it.each([
    ["missing", undefined],
    [
      "forged",
      createHmac("sha256", "wrong-secret").update(payload).digest("base64"),
    ],
  ])("rejects a %s signature", async (_label, hmac) => {
    const webhook = request(app.getHttpServer())
      .post("/orgs/org_1/ingest/shopify/returns")
      .set("content-type", "application/json");
    if (hmac) webhook.set("x-shopify-hmac-sha256", hmac);

    await webhook.send(payload).expect(401);
    expect(ingestReturn).not.toHaveBeenCalled();
  });

  it("accepts a replay without processing it again", async () => {
    claimWebhook.mockResolvedValue(false);
    const hmac = createHmac("sha256", secret).update(payload).digest("base64");

    const response = await request(app.getHttpServer())
      .post("/orgs/org_1/ingest/shopify/returns")
      .set("content-type", "application/json")
      .set("x-shopify-hmac-sha256", hmac)
      .set("x-shopify-webhook-id", "webhook_1")
      .set("x-shopify-shop-domain", "recon-test.myshopify.com")
      .send(payload)
      .expect(200);

    expect(response.body.duplicate).toBe(true);
    expect(ingestReturn).not.toHaveBeenCalled();
  });

  it("preserves a large Shopify order id when ingesting a refund", async () => {
    const refundPayload =
      '{"id":890088186047892319,"admin_graphql_api_id":"gid://shopify/Refund/890088186047892319","order_id":820982911946154508,"processed_at":"2026-09-14T11:00:00.000Z","refund_line_items":[{"subtotal_set":{"shop_money":{"amount":"12.50","currency_code":"EUR"}}}],"transactions":[{"kind":"refund","status":"success","amount":"12.50","currency":"EUR"}]}';
    const hmac = createHmac("sha256", secret)
      .update(refundPayload)
      .digest("base64");

    await request(app.getHttpServer())
      .post("/orgs/org_1/ingest/shopify/refunds")
      .set("content-type", "application/json")
      .set("x-shopify-hmac-sha256", hmac)
      .set("x-shopify-webhook-id", "webhook_refund_1")
      .set("x-shopify-shop-domain", "recon-test.myshopify.com")
      .send(refundPayload)
      .expect(200);

    expect(ingestRefund).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: "820982911946154508" }),
      [],
      expect.any(Date),
    );
  });

  it("ingests a signed paid-order webhook", async () => {
    const orderPayload = JSON.stringify({
      id: "820982911946154508",
      admin_graphql_api_id: "gid://shopify/Order/820982911946154508",
      currency: "EUR",
      total_price: "104.95",
      processed_at: "2026-09-14T10:00:00.000Z",
    });
    const hmac = createHmac("sha256", secret)
      .update(orderPayload)
      .digest("base64");

    await request(app.getHttpServer())
      .post("/orgs/org_1/ingest/shopify/orders/paid")
      .set("content-type", "application/json")
      .set("x-shopify-hmac-sha256", hmac)
      .set("x-shopify-webhook-id", "webhook_order_1")
      .set("x-shopify-shop-domain", "recon-test.myshopify.com")
      .send(orderPayload)
      .expect(200);

    expect(ingestOrder).toHaveBeenCalledOnce();
    expect(recordProcessedOrder).toHaveBeenCalledWith({
      orgId: "org_1",
      provider: "shopify",
      externalOrderId: "820982911946154508",
      amountCents: 10495,
      currency: "EUR",
      paidAt: new Date("2026-09-14T10:00:00.000Z"),
    });
  });

  it("acknowledges but does not evaluate a webhook for a billing-paused organization", async () => {
    canIngest.mockResolvedValue(false);
    const orderPayload = JSON.stringify({
      id: "820982911946154508",
      admin_graphql_api_id: "gid://shopify/Order/820982911946154508",
      currency: "EUR",
      total_price: "104.95",
      processed_at: "2026-09-14T10:00:00.000Z",
    });
    const hmac = createHmac("sha256", secret)
      .update(orderPayload)
      .digest("base64");

    const response = await request(app.getHttpServer())
      .post("/orgs/org_1/ingest/shopify/orders/paid")
      .set("content-type", "application/json")
      .set("x-shopify-hmac-sha256", hmac)
      .set("x-shopify-webhook-id", "webhook_order_2")
      .set("x-shopify-shop-domain", "recon-test.myshopify.com")
      .send(orderPayload)
      .expect(200);

    expect(response.body.billingPaused).toBe(true);
    expect(ingestOrder).not.toHaveBeenCalled();
    expect(recordProcessedOrder).not.toHaveBeenCalled();
    expect(completeWebhook).toHaveBeenCalledWith("shopify", "webhook_order_2");
  });

  it("rejects a valid signature from a shop not mapped to the URL organization", async () => {
    const hmac = createHmac("sha256", secret).update(payload).digest("base64");

    await request(app.getHttpServer())
      .post("/orgs/org_2/ingest/shopify/returns")
      .set("content-type", "application/json")
      .set("x-shopify-hmac-sha256", hmac)
      .set("x-shopify-webhook-id", "webhook_2")
      .set("x-shopify-shop-domain", "recon-test.myshopify.com")
      .send(payload)
      .expect(401);

    expect(claimWebhook).not.toHaveBeenCalled();
    expect(ingestReturn).not.toHaveBeenCalled();
  });
});

describe("IngestController InvoiceXpress webhook (http)", () => {
  let app: INestApplication;
  const ingestInvoice = vi.fn().mockResolvedValue(undefined);
  const claimWebhook = vi.fn().mockResolvedValue(true);
  const completeWebhook = vi.fn().mockResolvedValue(undefined);
  const releaseWebhook = vi.fn().mockResolvedValue(undefined);
  const canIngest = vi.fn().mockResolvedValue(true);
  const token = "test-invoicexpress-token";
  const invoicePayload = {
    invoice: { id: 987654, reference: "order_1", date: "2026-09-16" },
  };

  beforeEach(async () => {
    process.env.INVOICEXPRESS_WEBHOOK_TOKEN = token;
    process.env.INVOICEXPRESS_ORG_ID = "org_1";
    ingestInvoice.mockClear();
    claimWebhook.mockClear().mockResolvedValue(true);
    completeWebhook.mockClear();
    releaseWebhook.mockClear();
    canIngest.mockClear().mockResolvedValue(true);
    const moduleRef = await Test.createTestingModule({
      controllers: [IngestController],
      providers: [
        {
          provide: ExceptionService,
          useValue: {
            claimWebhook,
            completeWebhook,
            releaseWebhook,
            ingestInvoice,
          },
        },
        { provide: BillingService, useValue: { canIngest } },
      ],
    })
      .overrideGuard(OrgGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    delete process.env.INVOICEXPRESS_WEBHOOK_TOKEN;
    delete process.env.INVOICEXPRESS_ORG_ID;
    await app?.close();
  });

  it("accepts an invoice-created webhook carrying the correct token", async () => {
    await request(app.getHttpServer())
      .post("/orgs/org_1/ingest/invoicexpress/invoices")
      .set("x-invoicexpress-token", token)
      .send(invoicePayload)
      .expect(200);

    expect(ingestInvoice).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "987654",
        orgId: "org_1",
        orderId: "order_1",
      }),
      expect.any(Date),
    );
    expect(completeWebhook).toHaveBeenCalledWith("invoicexpress", "987654");
  });

  it.each([
    ["missing", undefined],
    ["wrong", "not-the-token"],
  ])("rejects a %s token", async (_label, providedToken) => {
    const webhook = request(app.getHttpServer()).post(
      "/orgs/org_1/ingest/invoicexpress/invoices",
    );
    if (providedToken) webhook.set("x-invoicexpress-token", providedToken);

    await webhook.send(invoicePayload).expect(401);
    expect(ingestInvoice).not.toHaveBeenCalled();
  });

  it("rejects a valid token for an organization not mapped to the URL", async () => {
    await request(app.getHttpServer())
      .post("/orgs/org_2/ingest/invoicexpress/invoices")
      .set("x-invoicexpress-token", token)
      .send(invoicePayload)
      .expect(401);

    expect(ingestInvoice).not.toHaveBeenCalled();
  });

  it("accepts a replay without processing it again", async () => {
    claimWebhook.mockResolvedValue(false);

    const response = await request(app.getHttpServer())
      .post("/orgs/org_1/ingest/invoicexpress/invoices")
      .set("x-invoicexpress-token", token)
      .send(invoicePayload)
      .expect(200);

    expect(response.body.duplicate).toBe(true);
    expect(ingestInvoice).not.toHaveBeenCalled();
  });

  it("acknowledges but does not evaluate a webhook for a billing-paused organization", async () => {
    canIngest.mockResolvedValue(false);

    const response = await request(app.getHttpServer())
      .post("/orgs/org_1/ingest/invoicexpress/invoices")
      .set("x-invoicexpress-token", token)
      .send(invoicePayload)
      .expect(200);

    expect(response.body.billingPaused).toBe(true);
    expect(ingestInvoice).not.toHaveBeenCalled();
    expect(completeWebhook).toHaveBeenCalledWith("invoicexpress", "987654");
  });

  it("rejects a malformed invoice payload", async () => {
    await request(app.getHttpServer())
      .post("/orgs/org_1/ingest/invoicexpress/invoices")
      .set("x-invoicexpress-token", token)
      .send({ invoice: { id: 1 } })
      .expect(400);

    expect(claimWebhook).not.toHaveBeenCalled();
  });
});