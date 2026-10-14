-- Expand only. No existing row is rewritten. Canonical history only.
-- DEC-011: immutable bundle identity is separate from ownership and school allocation.
SET lock_timeout = '5s';
SET statement_timeout = '5min';

-- One immutable record per exact bundle identity. NATIONAL records are stored once and are
-- never available to a school without an allocation. SCHOOL records are owned by one school
-- and must use that school's identity namespace, so they can neither claim a national
-- identity nor collide with another school's identity.
CREATE TABLE "ContentBundleRecord" (
  "id" TEXT NOT NULL,
  "bundleId" TEXT NOT NULL,
  "bundleVersion" TEXT NOT NULL,
  "schemaVersion" TEXT NOT NULL,
  "contentHash" VARCHAR(64) NOT NULL,
  "compositionHash" VARCHAR(64) NOT NULL,
  "curriculumReleaseId" TEXT NOT NULL,
  "releaseIdentity" TEXT NOT NULL,
  "ownerScope" TEXT NOT NULL,
  "ownerSchoolId" TEXT,
  "sealedComposition" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" TEXT NOT NULL,
  CONSTRAINT "ContentBundleRecord_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ContentBundleRecord_hash_format_check" CHECK ("contentHash" ~ '^[a-f0-9]{64}$' AND "compositionHash" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "ContentBundleRecord_owner_scope_check" CHECK (
    ("ownerScope" = 'NATIONAL' AND "ownerSchoolId" IS NULL AND "bundleId" NOT LIKE 'school.%')
    OR ("ownerScope" = 'SCHOOL' AND "ownerSchoolId" IS NOT NULL
      AND left("bundleId", length('school.' || "ownerSchoolId" || '.')) = 'school.' || "ownerSchoolId" || '.'
      AND length("bundleId") > length('school.' || "ownerSchoolId" || '.'))
  )
);
CREATE UNIQUE INDEX "ContentBundleRecord_bundleId_bundleVersion_key" ON "ContentBundleRecord"("bundleId", "bundleVersion");
CREATE INDEX "ContentBundleRecord_contentHash_idx" ON "ContentBundleRecord"("contentHash");
CREATE INDEX "ContentBundleRecord_ownerSchoolId_idx" ON "ContentBundleRecord"("ownerSchoolId");
CREATE INDEX "ContentBundleRecord_curriculumReleaseId_idx" ON "ContentBundleRecord"("curriculumReleaseId");
ALTER TABLE "ContentBundleRecord" ADD CONSTRAINT "ContentBundleRecord_ownerSchoolId_fkey"
  FOREIGN KEY ("ownerSchoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "ContentBundleRecord" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "ContentBundleRecord" FROM anon, authenticated;

-- Explicit school entitlement to one exact NATIONAL bundle version. Existence of a national
-- record never implies availability. Revocation is a one-way state change; history is kept.
CREATE TABLE "ContentBundleAllocation" (
  "id" TEXT NOT NULL,
  "bundleRecordId" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "governanceRef" TEXT NOT NULL,
  "grantedById" TEXT NOT NULL,
  "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedById" TEXT,
  "revokedAt" TIMESTAMP(3),
  "revocationRef" TEXT,
  CONSTRAINT "ContentBundleAllocation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ContentBundleAllocation_governance_ref_check" CHECK (btrim("governanceRef") <> ''),
  CONSTRAINT "ContentBundleAllocation_status_check" CHECK (
    ("status" = 'ACTIVE' AND "revokedById" IS NULL AND "revokedAt" IS NULL AND "revocationRef" IS NULL)
    OR ("status" = 'REVOKED' AND "revokedById" IS NOT NULL AND "revokedAt" IS NOT NULL AND btrim(coalesce("revocationRef", '')) <> '')
  )
);
CREATE UNIQUE INDEX "ContentBundleAllocation_one_active_per_school_key"
  ON "ContentBundleAllocation"("schoolId", "bundleRecordId") WHERE "status" = 'ACTIVE';
CREATE INDEX "ContentBundleAllocation_bundleRecordId_idx" ON "ContentBundleAllocation"("bundleRecordId");
CREATE INDEX "ContentBundleAllocation_schoolId_status_idx" ON "ContentBundleAllocation"("schoolId", "status");
ALTER TABLE "ContentBundleAllocation" ADD CONSTRAINT "ContentBundleAllocation_bundleRecordId_fkey"
  FOREIGN KEY ("bundleRecordId") REFERENCES "ContentBundleRecord"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "ContentBundleAllocation" ADD CONSTRAINT "ContentBundleAllocation_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "ContentBundleAllocation" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "ContentBundleAllocation" FROM anon, authenticated;

ALTER TABLE "ScheduledWork"
  ADD COLUMN "bundleId" TEXT,
  ADD COLUMN "bundleVersion" TEXT,
  ADD COLUMN "bundleContentHash" VARCHAR(64),
  ADD COLUMN "itemId" TEXT,
  ADD COLUMN "itemVersion" TEXT,
  ADD COLUMN "itemKind" TEXT;
CREATE INDEX "ScheduledWork_bundleId_bundleVersion_idx" ON "ScheduledWork"("bundleId", "bundleVersion");

-- Same append-only convention as curriculum revision history, with a dedicated guard.
CREATE FUNCTION reject_content_bundle_record_mutation() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'ContentBundleRecord is append-only: % is not permitted', TG_OP;
END;
$$;
CREATE TRIGGER content_bundle_record_no_update_or_delete
BEFORE UPDATE OR DELETE ON "ContentBundleRecord" FOR EACH ROW
EXECUTE FUNCTION reject_content_bundle_record_mutation();
CREATE TRIGGER content_bundle_record_no_truncate
BEFORE TRUNCATE ON "ContentBundleRecord" FOR EACH STATEMENT
EXECUTE FUNCTION reject_content_bundle_record_mutation();

-- Allocations target NATIONAL records only, start ACTIVE, and may only move ACTIVE -> REVOKED
-- with every grant field unchanged. Rows are never deleted or truncated.
CREATE FUNCTION guard_content_bundle_allocation() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."status" <> 'ACTIVE' THEN
      RAISE EXCEPTION 'ContentBundleAllocation must be created ACTIVE';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM "ContentBundleRecord" r WHERE r."id" = NEW."bundleRecordId" AND r."ownerScope" = 'NATIONAL') THEN
      RAISE EXCEPTION 'ContentBundleAllocation may only reference a NATIONAL ContentBundleRecord';
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD."status" <> 'ACTIVE' OR NEW."status" <> 'REVOKED'
      OR NEW."id" IS DISTINCT FROM OLD."id" OR NEW."bundleRecordId" IS DISTINCT FROM OLD."bundleRecordId"
      OR NEW."schoolId" IS DISTINCT FROM OLD."schoolId" OR NEW."governanceRef" IS DISTINCT FROM OLD."governanceRef"
      OR NEW."grantedById" IS DISTINCT FROM OLD."grantedById" OR NEW."grantedAt" IS DISTINCT FROM OLD."grantedAt" THEN
      RAISE EXCEPTION 'ContentBundleAllocation permits only ACTIVE -> REVOKED';
    END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'ContentBundleAllocation is retained history: % is not permitted', TG_OP;
END;
$$;
CREATE TRIGGER content_bundle_allocation_guard
BEFORE INSERT OR UPDATE OR DELETE ON "ContentBundleAllocation" FOR EACH ROW
EXECUTE FUNCTION guard_content_bundle_allocation();
CREATE TRIGGER content_bundle_allocation_no_truncate
BEFORE TRUNCATE ON "ContentBundleAllocation" FOR EACH STATEMENT
EXECUTE FUNCTION guard_content_bundle_allocation();

RESET lock_timeout;
RESET statement_timeout;
