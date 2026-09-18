CREATE TABLE "case_briefs" (
    "orgId" TEXT NOT NULL,
    "exceptionId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "recommendation" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "inputHash" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "case_briefs_pkey" PRIMARY KEY ("orgId", "exceptionId", "locale")
);

ALTER TABLE "case_briefs" ADD CONSTRAINT "case_briefs_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
