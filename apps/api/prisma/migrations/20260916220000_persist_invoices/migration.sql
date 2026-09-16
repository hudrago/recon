CREATE TABLE "invoice_records" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "invoice_records_pkey" PRIMARY KEY ("orgId", "id")
);

CREATE INDEX "invoice_records_orgId_orderId_idx" ON "invoice_records"("orgId", "orderId");

ALTER TABLE "invoice_records" ADD CONSTRAINT "invoice_records_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
