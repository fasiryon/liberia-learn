-- Expand only. No existing row is rewritten. Canonical history only.
SET lock_timeout = '5s';
SET statement_timeout = '5min';

CREATE TABLE "ContentBundleRecord" (
  "id" TEXT NOT NULL,
  "bundleId" TEXT NOT NULL,
  "bundleVersion" TEXT NOT NULL,
  "schemaVersion" TEXT NOT NULL,
  "contentHash" VARCHAR(64) NOT NULL,
  "compositionHash" VARCHAR(64) NOT NULL,
  "curriculumReleaseId" TEXT NOT NULL,
  "releaseIdentity" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "sealedComposition" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" TEXT NOT NULL,
  CONSTRAINT "ContentBundleRecord_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ContentBundleRecord_bundleId_bundleVersion_key" ON "ContentBundleRecord"("bundleId", "bundleVersion");
CREATE INDEX "ContentBundleRecord_schoolId_contentHash_idx" ON "ContentBundleRecord"("schoolId", "contentHash");
CREATE INDEX "ContentBundleRecord_curriculumReleaseId_idx" ON "ContentBundleRecord"("curriculumReleaseId");
ALTER TABLE "ContentBundleRecord" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "ContentBundleRecord" FROM anon, authenticated;

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

RESET lock_timeout;
RESET statement_timeout;
