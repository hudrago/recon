CREATE TABLE "inventory_adjustment_records" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "refundId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "adjustedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "inventory_adjustment_records_pkey" PRIMARY KEY ("orgId", "id")
);

CREATE INDEX "inventory_adjustment_records_orgId_orderId_idx" ON "inventory_adjustment_records"("orgId", "orderId");

ALTER TABLE "inventory_adjustment_records" ADD CONSTRAINT "inventory_adjustment_records_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
