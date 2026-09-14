-- CreateTable
CREATE TABLE "exceptions" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "context" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "executed_actions" (
    "idempotencyKey" TEXT NOT NULL,
    "exceptionId" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "executed_actions_pkey" PRIMARY KEY ("idempotencyKey")
);

-- CreateTable
CREATE TABLE "audit_log_entries" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "before" JSONB NOT NULL,
    "after" JSONB NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "exceptions_orgId_status_idx" ON "exceptions"("orgId", "status");

-- CreateIndex
CREATE INDEX "executed_actions_exceptionId_idx" ON "executed_actions"("exceptionId");

-- CreateIndex
CREATE INDEX "audit_log_entries_orgId_idx" ON "audit_log_entries"("orgId");
