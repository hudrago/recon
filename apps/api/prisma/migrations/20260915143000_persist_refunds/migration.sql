CREATE TABLE "refund_records" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "refund_records_pkey" PRIMARY KEY ("orgId", "id")
);

CREATE INDEX "refund_records_orgId_orderId_idx" ON "refund_records"("orgId", "orderId");