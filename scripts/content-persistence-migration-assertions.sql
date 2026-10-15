DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM "ScheduledWork" WHERE id='content-test-work'
    AND "contentId"='content-test-lesson' AND "bundleId" IS NULL AND "bundleVersion" IS NULL
    AND "bundleContentHash" IS NULL AND "itemId" IS NULL AND "itemVersion" IS NULL AND "itemKind" IS NULL;
  IF n <> 1 THEN RAISE EXCEPTION 'Existing row changed'; END IF;
  SELECT count(*) INTO n FROM pg_indexes WHERE schemaname='public' AND indexname IN (
    'ContentBundleRecord_bundleId_bundleVersion_key', 'ContentBundleRecord_contentHash_idx',
    'ContentBundleRecord_ownerSchoolId_idx', 'ContentBundleRecord_curriculumReleaseId_idx',
    'ContentBundleAllocation_one_active_per_school_key', 'ContentBundleAllocation_bundleRecordId_idx',
    'ContentBundleAllocation_schoolId_status_idx', 'ScheduledWork_bundleId_bundleVersion_idx');
  IF n <> 8 THEN RAISE EXCEPTION 'Indexes missing'; END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='"ContentBundleRecord"'::regclass) THEN RAISE EXCEPTION 'RLS absent'; END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='"ContentBundleAllocation"'::regclass) THEN RAISE EXCEPTION 'Allocation RLS absent'; END IF;
  IF has_table_privilege('anon', '"ContentBundleRecord"', 'SELECT') OR has_table_privilege('authenticated', '"ContentBundleRecord"', 'SELECT')
    OR has_table_privilege('anon', '"ContentBundleAllocation"', 'SELECT') OR has_table_privilege('authenticated', '"ContentBundleAllocation"', 'SELECT') THEN RAISE EXCEPTION 'Unexpected direct client access'; END IF;
  SELECT count(*) INTO n FROM information_schema.columns WHERE table_name='ScheduledWork' AND is_nullable='YES'
    AND column_name IN ('bundleId','bundleVersion','bundleContentHash','itemId','itemVersion','itemKind');
  IF n <> 6 THEN RAISE EXCEPTION 'Pin columns must be nullable'; END IF;
END $$;
INSERT INTO "ContentBundleRecord" (id, "bundleId", "bundleVersion", "schemaVersion", "contentHash", "compositionHash", "curriculumReleaseId", "releaseIdentity", "ownerScope", "ownerSchoolId", "sealedComposition", "createdById")
VALUES ('db-guard-test', 'synthetic.db.guard', '1', 'content-bundle.v1', repeat('a',64), repeat('b',64), 'synthetic.release', 'synthetic.identity', 'NATIONAL', NULL, '{}', 'synthetic-actor');
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
  -- Plain TRUNCATE is refused by the allocation foreign key (0A000) or the guard trigger.
  BEGIN
    TRUNCATE "ContentBundleRecord";
    RAISE EXCEPTION 'Truncate was allowed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'ContentBundleRecord is append-only:%' THEN RAISE; END IF;
  WHEN feature_not_supported THEN NULL;
  END;
  -- CASCADE passes the foreign-key check, so the append-only triggers must refuse it.
  BEGIN
    TRUNCATE "ContentBundleRecord" CASCADE;
    RAISE EXCEPTION 'Truncate cascade was allowed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'ContentBundleRecord is append-only:%' AND SQLERRM NOT LIKE 'ContentBundleAllocation is retained history:%' THEN RAISE; END IF;
  END;
  BEGIN
    INSERT INTO "ContentBundleRecord" (id, "bundleId", "bundleVersion", "schemaVersion", "contentHash", "compositionHash", "curriculumReleaseId", "releaseIdentity", "ownerScope", "ownerSchoolId", "sealedComposition", "createdById")
    SELECT 'duplicate', "bundleId", "bundleVersion", "schemaVersion", "contentHash", "compositionHash", "curriculumReleaseId", "releaseIdentity", "ownerScope", "ownerSchoolId", "sealedComposition", "createdById" FROM "ContentBundleRecord" WHERE id='db-guard-test';
    RAISE EXCEPTION 'Duplicate was allowed';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  -- A school may not occupy a national identity or another school's namespace.
  BEGIN
    INSERT INTO "ContentBundleRecord" (id, "bundleId", "bundleVersion", "schemaVersion", "contentHash", "compositionHash", "curriculumReleaseId", "releaseIdentity", "ownerScope", "ownerSchoolId", "sealedComposition", "createdById")
    VALUES ('squat', 'synthetic.db.guard', '2', 'content-bundle.v1', repeat('a',64), repeat('b',64), 'r', 'i', 'SCHOOL', 'content-test-school', '{}', 'synthetic-actor');
    RAISE EXCEPTION 'School claimed a national identity';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  -- Allocation history is append-only apart from ACTIVE -> REVOKED.
  INSERT INTO "ContentBundleAllocation" (id, "bundleRecordId", "schoolId", "governanceRef", "grantedById")
  VALUES ('db-guard-allocation', 'db-guard-test', 'content-test-school', 'synthetic.decision', 'synthetic-actor');
  BEGIN
    UPDATE "ContentBundleAllocation" SET "schoolId"='other' WHERE id='db-guard-allocation';
    RAISE EXCEPTION 'Allocation identity mutation was allowed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'ContentBundleAllocation permits only%' THEN RAISE; END IF;
  END;
  BEGIN
    DELETE FROM "ContentBundleAllocation" WHERE id='db-guard-allocation';
    RAISE EXCEPTION 'Allocation deletion was allowed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'ContentBundleAllocation is retained history:%' THEN RAISE; END IF;
  END;
  UPDATE "ContentBundleAllocation" SET status='REVOKED', "revokedById"='synthetic-actor', "revokedAt"=now(), "revocationRef"='synthetic.revoke' WHERE id='db-guard-allocation';
END $$;
