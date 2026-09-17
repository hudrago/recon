CREATE TABLE "shipment_records" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "lastStatusChangeAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "shipment_records_pkey" PRIMARY KEY ("orgId", "id")
);

CREATE INDEX "shipment_records_orgId_orderId_idx" ON "shipment_records"("orgId", "orderId");

ALTER TABLE "shipment_records" ADD CONSTRAINT "shipment_records_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
