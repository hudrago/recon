ALTER TABLE "pending_evaluations" ADD COLUMN "orgId" TEXT;

UPDATE "pending_evaluations"
SET "orgId" = COALESCE(
  "payload"->'returnRecord'->>'orgId',
  "payload"->'order'->>'orgId',
  "payload"->'refund'->>'orgId',
  "payload"->'shipment'->>'orgId'
);

ALTER TABLE "pending_evaluations" ALTER COLUMN "orgId" SET NOT NULL;
CREATE INDEX "pending_evaluations_orgId_idx" ON "pending_evaluations"("orgId");

INSERT INTO "organization" ("id", "name", "slug", "createdAt", "metadata")
SELECT "orgId", 'Archived workspace', 'archived-' || md5("orgId"), CURRENT_TIMESTAMP, '{"recoveredFrom":"orphanedOperationalData"}'
FROM (
  SELECT "orgId" FROM "exceptions"
  UNION SELECT "orgId" FROM "pending_evaluations"
  UNION SELECT "orgId" FROM "refund_records"
  UNION SELECT "orgId" FROM "webhook_receipts"
  UNION SELECT "orgId" FROM "executed_actions" WHERE "orgId" IS NOT NULL
  UNION SELECT "orgId" FROM "audit_log_entries"
) AS "operationalOrganizations"
WHERE NOT EXISTS (SELECT 1 FROM "organization" WHERE "organization"."id" = "operationalOrganizations"."orgId")
ON CONFLICT ("id") DO NOTHING;

ALTER TABLE "exceptions" ADD CONSTRAINT "exceptions_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pending_evaluations" ADD CONSTRAINT "pending_evaluations_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "refund_records" ADD CONSTRAINT "refund_records_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "webhook_receipts" ADD CONSTRAINT "webhook_receipts_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "executed_actions" ADD CONSTRAINT "executed_actions_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "audit_log_entries" ADD CONSTRAINT "audit_log_entries_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION prevent_last_organization_owner_removal() RETURNS TRIGGER AS $$
BEGIN
  IF OLD."role" !~ '(^|,)\s*owner\s*(,|$)' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  IF TG_OP = 'UPDATE'
    AND NEW."organizationId" = OLD."organizationId"
    AND NEW."role" ~ '(^|,)\s*owner\s*(,|$)'
  THEN
    RETURN NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM "organization" WHERE "id" = OLD."organizationId")
    AND NOT EXISTS (
      SELECT 1
      FROM "member"
      WHERE "organizationId" = OLD."organizationId"
        AND "id" <> OLD."id"
        AND "role" ~ '(^|,)\s*owner\s*(,|$)'
    )
  THEN
    RAISE EXCEPTION 'organization must retain at least one owner' USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "member_prevent_last_owner_removal"
BEFORE DELETE OR UPDATE OF "organizationId", "role" ON "member"
FOR EACH ROW EXECUTE FUNCTION prevent_last_organization_owner_removal();
