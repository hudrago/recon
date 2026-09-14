ALTER TABLE "webhook_receipts"
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'SUCCEEDED',
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "executed_actions"
ADD COLUMN "orgId" TEXT,
ADD COLUMN "orderId" TEXT,
ADD COLUMN "actionKind" TEXT;

CREATE UNIQUE INDEX "executed_actions_orgId_orderId_actionKind_key"
ON "executed_actions"("orgId", "orderId", "actionKind");