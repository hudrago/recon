ALTER TABLE "invitation" DROP CONSTRAINT "invitation_inviterId_fkey";
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION prevent_last_organization_owner_removal() RETURNS TRIGGER AS $$
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

  PERFORM pg_advisory_xact_lock(hashtextextended(OLD."organizationId", 0));

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
