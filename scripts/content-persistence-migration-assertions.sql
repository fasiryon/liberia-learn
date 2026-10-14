DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM "ScheduledWork" WHERE id='content-test-work'
    AND "contentId"='content-test-lesson' AND "bundleId" IS NULL AND "bundleVersion" IS NULL
    AND "bundleContentHash" IS NULL AND "itemId" IS NULL AND "itemVersion" IS NULL AND "itemKind" IS NULL;
  IF n <> 1 THEN RAISE EXCEPTION 'Existing row changed'; END IF;
  SELECT count(*) INTO n FROM pg_indexes WHERE schemaname='public' AND indexname IN (
    'ContentBundleRecord_bundleId_bundleVersion_key', 'ContentBundleRecord_schoolId_contentHash_idx',
    'ContentBundleRecord_curriculumReleaseId_idx', 'ScheduledWork_bundleId_bundleVersion_idx');
  IF n <> 4 THEN RAISE EXCEPTION 'Indexes missing'; END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='"ContentBundleRecord"'::regclass) THEN RAISE EXCEPTION 'RLS absent'; END IF;
  IF has_table_privilege('anon', '"ContentBundleRecord"', 'SELECT') OR has_table_privilege('authenticated', '"ContentBundleRecord"', 'SELECT') THEN RAISE EXCEPTION 'Unexpected direct client access'; END IF;
END $$;
INSERT INTO "ContentBundleRecord" (id, "bundleId", "bundleVersion", "schemaVersion", "contentHash", "compositionHash", "curriculumReleaseId", "releaseIdentity", "schoolId", "sealedComposition", "createdById")
VALUES ('db-guard-test', 'synthetic.db.guard', '1', 'content-bundle.v1', repeat('a',64), repeat('b',64), 'synthetic.release', 'synthetic.identity', 'content-test-school', '{}', 'synthetic-actor');
DO $$
BEGIN
  BEGIN
    UPDATE "ContentBundleRecord" SET "bundleVersion"='2' WHERE id='db-guard-test';
    RAISE EXCEPTION 'Mutation was allowed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'ContentBundleRecord is append-only:%' THEN RAISE; END IF;
  END;
  BEGIN
    DELETE FROM "ContentBundleRecord" WHERE id='db-guard-test';
    RAISE EXCEPTION 'Deletion was allowed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'ContentBundleRecord is append-only:%' THEN RAISE; END IF;
  END;
  BEGIN
    TRUNCATE "ContentBundleRecord";
    RAISE EXCEPTION 'Truncate was allowed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'ContentBundleRecord is append-only:%' THEN RAISE; END IF;
  END;
  BEGIN
    INSERT INTO "ContentBundleRecord" SELECT 'duplicate', "bundleId", "bundleVersion", "schemaVersion", "contentHash", "compositionHash", "curriculumReleaseId", "releaseIdentity", "schoolId", "sealedComposition", "createdAt", "createdById" FROM "ContentBundleRecord" WHERE id='db-guard-test';
    RAISE EXCEPTION 'Duplicate was allowed';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
END $$;
