\set ON_ERROR_STOP on

DO $$
DECLARE active_count integer;
BEGIN
  SELECT count(*) INTO active_count FROM "CurriculumReviewAssignment"
    WHERE "taskId" = 'p2b-task' AND "slot" = 'FIRST' AND "status" = 'ACTIVE';
  IF active_count <> 1 THEN RAISE EXCEPTION 'exclusive claim invariant failed: %', active_count; END IF;
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
