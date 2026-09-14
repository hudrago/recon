-- CreateTable
CREATE TABLE "pending_evaluations" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pending_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pending_evaluations_dueAt_idx" ON "pending_evaluations"("dueAt");