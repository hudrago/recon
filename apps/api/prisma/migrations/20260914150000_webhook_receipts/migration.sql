-- CreateTable
CREATE TABLE "webhook_receipts" (
    "provider" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_receipts_pkey" PRIMARY KEY ("provider", "eventId")
);

-- CreateIndex
CREATE INDEX "webhook_receipts_orgId_receivedAt_idx" ON "webhook_receipts"("orgId", "receivedAt");