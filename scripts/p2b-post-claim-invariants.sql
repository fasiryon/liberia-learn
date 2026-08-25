\set ON_ERROR_STOP on

DO $$
DECLARE active_count integer;
BEGIN
  SELECT count(*) INTO active_count FROM "CurriculumReviewAssignment"
    WHERE "taskId" = 'p2b-task' AND "slot" = 'FIRST' AND "status" = 'ACTIVE';
  IF active_count <> 1 THEN RAISE EXCEPTION 'exclusive claim invariant failed: %', active_count; END IF;
END;
$$;

DO $$
DECLARE changed_count integer;
DECLARE current_version integer;
BEGIN
  UPDATE "CurriculumReviewAssignment"
  SET "leaseExpiresAt" = now() + interval '15 minutes',
      "lastHeartbeatAt" = now(),
      "version" = "version" + 1
  WHERE "id" = 'p2b-assignment-1' AND "status" = 'ACTIVE' AND "version" = 1;
  GET DIAGNOSTICS changed_count = ROW_COUNT;
  IF changed_count <> 1 THEN RAISE EXCEPTION 'heartbeat optimistic update failed: %', changed_count; END IF;

  UPDATE "CurriculumReviewAssignment"
  SET "leaseExpiresAt" = now() + interval '15 minutes', "version" = "version" + 1
  WHERE "id" = 'p2b-assignment-1' AND "status" = 'ACTIVE' AND "version" = 1;
  GET DIAGNOSTICS changed_count = ROW_COUNT;
  IF changed_count <> 0 THEN RAISE EXCEPTION 'stale heartbeat unexpectedly succeeded'; END IF;

  SELECT "version" INTO current_version FROM "CurriculumReviewAssignment" WHERE "id" = 'p2b-assignment-1';
  IF current_version <> 2 THEN RAISE EXCEPTION 'heartbeat version mismatch: %', current_version; END IF;
END;
$$;

UPDATE "CurriculumReviewAssignment"
SET "status" = 'EXPIRED', "releasedAt" = now(), "releaseReason" = 'LEASE_EXPIRED', "version" = "version" + 1
WHERE "id" = 'p2b-assignment-1' AND "status" = 'ACTIVE' AND "version" = 2;

INSERT INTO "CurriculumReviewAssignment" (
  "id", "taskId", "slot", "reviewerProfileId", "credentialId", "credentialScopeId", "leaseToken",
  "leaseExpiresAt", "maxContinuousUntil", "idempotencyKey", "updatedAt"
) VALUES (
  'p2b-assignment-2', 'p2b-task', 'FIRST', 'p2b-profile-2', 'p2b-credential-2', 'p2b-scope-2', 'p2b-lease-2',
  now() + interval '15 minutes', now() + interval '2 hours', 'p2b-reclaim-2', now()
);

INSERT INTO "CurriculumReviewAssignment" (
  "id", "taskId", "slot", "reviewerProfileId", "credentialId", "credentialScopeId", "leaseToken",
  "leaseExpiresAt", "maxContinuousUntil", "idempotencyKey", "updatedAt"
) VALUES (
  'p2b-assignment-second-slot', 'p2b-task', 'SECOND', 'p2b-profile-1', 'p2b-credential-1', 'p2b-scope-1', 'p2b-lease-second',
  now() + interval '15 minutes', now() + interval '2 hours', 'p2b-independent-slot', now()
);

DO $$
DECLARE active_slots integer;
BEGIN
  SELECT count(*) INTO active_slots FROM "CurriculumReviewAssignment"
    WHERE "taskId" = 'p2b-task' AND "status" = 'ACTIVE';
  IF active_slots <> 2 THEN RAISE EXCEPTION 'independent active slot invariant failed: %', active_slots; END IF;

  BEGIN
    UPDATE "CurriculumReviewAssignment" SET "status" = 'ACTIVE'
    WHERE "id" = 'p2b-assignment-1';
    RAISE EXCEPTION 'stale owner unexpectedly reclaimed an occupied slot';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;
END;
$$;

INSERT INTO "CurriculumReviewAssessment" (
  "id", "taskId", "assignmentId", "reviewerProfileId", "credentialId", "credentialScopeId", "status",
  "reviewerRoleSnapshot", "qualificationSnapshot", "rubricKey", "rubricVersion", "rubricResponses",
  "recommendation", "rationale", "submittedAt", "idempotencyKey", "updatedAt"
) VALUES (
  'p2b-assessment-1', 'p2b-task', 'p2b-assignment-1', 'p2b-profile-1', 'p2b-credential-1', 'p2b-scope-1', 'SUBMITTED',
  'TEACHER', '{"credentialId":"p2b-credential-1"}'::jsonb, 'LIBERIALEARN_CURRICULUM_REVIEW', 1,
  '{"factual_correctness":{"value":"PASS"}}'::jsonb, 'APPROVE', 'Fixture rationale', now(), 'p2b-assessment-fixture', now()
);

DO $$
BEGIN
  BEGIN
    UPDATE "CurriculumReviewAssessment" SET "rationale" = 'mutated' WHERE "id" = 'p2b-assessment-1';
    RAISE EXCEPTION 'submitted assessment immutability failed';
  EXCEPTION WHEN object_not_in_prerequisite_state THEN
    NULL;
  END;
END;
$$;

INSERT INTO "ReviewCalibrationSession" (
  "id", "name", "revisionId", "policyKey", "policyVersion", "rubricKey", "rubricVersion",
  "referenceSnapshot", "createdByUserId", "updatedAt", "idempotencyKey"
) VALUES (
  'p2b-calibration', 'P2B fixture calibration', 'p2b-revision', 'P2B_QUALIFIED_REVIEW', 1,
  'LIBERIALEARN_CURRICULUM_REVIEW', 1, '{}'::jsonb, 'p2b-verifier', now(), 'p2b-calibration-fixture'
);
INSERT INTO "ReviewCalibrationResult" (
  "id", "sessionId", "reviewerProfileId", "assessmentSnapshot", "comparisonResult", "idempotencyKey"
) VALUES ('p2b-calibration-result', 'p2b-calibration', 'p2b-profile-1', '{}'::jsonb, '{}'::jsonb, 'p2b-calibration-result-fixture');

DO $$
BEGIN
  BEGIN
    DELETE FROM "ReviewCalibrationResult" WHERE "id" = 'p2b-calibration-result';
    RAISE EXCEPTION 'calibration result immutability failed';
  EXCEPTION WHEN object_not_in_prerequisite_state THEN
    NULL;
  END;
END;
$$;

SELECT 'P2B_DISPOSABLE_DB_INVARIANTS_PASS' AS result;
