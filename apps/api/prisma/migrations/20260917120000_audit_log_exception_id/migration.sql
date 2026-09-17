ALTER TABLE "audit_log_entries" ADD COLUMN "exceptionId" TEXT;

CREATE INDEX "audit_log_entries_orgId_exceptionId_idx" ON "audit_log_entries"("orgId", "exceptionId");
