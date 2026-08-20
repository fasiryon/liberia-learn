\set ON_ERROR_STOP on

INSERT INTO "School" ("id", "name", "createdAt") VALUES
  ('p2b-school-a', 'P2B School A', now()),
  ('p2b-school-b', 'P2B School B', now());

INSERT INTO "User" ("id", "email", "role", "schoolId", "createdAt", "updatedAt") VALUES
  ('p2b-author', 'p2b-author@example.test', 'TEACHER', 'p2b-school-a', now(), now()),
  ('p2b-reviewer-1', 'p2b-reviewer-1@example.test', 'TEACHER', 'p2b-school-a', now(), now()),
  ('p2b-reviewer-2', 'p2b-reviewer-2@example.test', 'TEACHER', 'p2b-school-a', now(), now()),
  ('p2b-verifier', 'p2b-verifier@example.test', 'ADMIN', 'p2b-school-a', now(), now());

INSERT INTO "CurriculumContent" (
  "id", "contentId", "title", "grade", "subject", "contentType", "status", "version",
  "payload", "createdAt", "updatedAt", "editedById", "schoolId"
) VALUES (
  'p2b-content-row', 'p2b-content', 'P2B concurrency fixture', 7, 'MATHEMATICS', 'lesson', 'NEEDS_REVIEW', '1',
  '{"title":"P2B concurrency fixture","grade":7,"subject":"MATHEMATICS","contentType":"lesson"}'::jsonb,
  now(), now(), 'p2b-author', 'p2b-school-a'
);

INSERT INTO "CurriculumProvenance" (
  "id", "curriculumContentId", "provenanceCompleteness", "lifecycleState", "createdAt", "updatedAt"
) VALUES ('p2b-provenance', 'p2b-content-row', 'VERIFIED', 'PENDING_REVIEW', now(), now());

INSERT INTO "CurriculumContentRevision" (
  "id", "provenanceId", "sequence", "revisionKind", "originKind", "snapshotSchemaVersion",
  "contentSnapshot", "contentHash", "authorUserId", "createdAt"
) VALUES (
  'p2b-revision', 'p2b-provenance', 1, 'HUMAN_EDIT', 'HUMAN_AUTHORED', 1,
  '{"title":"P2B concurrency fixture","grade":7,"subject":"MATHEMATICS","contentType":"lesson"}'::jsonb,
  repeat('a', 64), 'p2b-author', now()
);
UPDATE "CurriculumProvenance" SET "currentRevisionId" = 'p2b-revision' WHERE "id" = 'p2b-provenance';

INSERT INTO "ReviewerProfile" (
  "id", "userId", "organizationType", "authority", "schoolId", "updatedAt", "creationIdempotencyKey"
) VALUES
  ('p2b-profile-1', 'p2b-reviewer-1', 'SCHOOL', 'SCHOOL', 'p2b-school-a', now(), 'p2b-profile-fixture-1'),
  ('p2b-profile-2', 'p2b-reviewer-2', 'SCHOOL', 'SCHOOL', 'p2b-school-a', now(), 'p2b-profile-fixture-2');

INSERT INTO "ReviewerCredential" (
  "id", "reviewerProfileId", "credentialType", "issuer", "authority", "status", "validFrom",
  "expiresAt", "verifiedAt", "verifierUserId", "evidenceRef", "updatedAt", "idempotencyKey"
) VALUES
  ('p2b-credential-1', 'p2b-profile-1', 'SUBJECT_REVIEW', 'P2B fixture issuer', 'SCHOOL', 'VERIFIED', now() - interval '1 day', now() + interval '1 year', now(), 'p2b-verifier', 'fixture:evidence:1', now(), 'p2b-credential-fixture-1'),
  ('p2b-credential-2', 'p2b-profile-2', 'SUBJECT_REVIEW', 'P2B fixture issuer', 'SCHOOL', 'VERIFIED', now() - interval '1 day', now() + interval '1 year', now(), 'p2b-verifier', 'fixture:evidence:2', now(), 'p2b-credential-fixture-2');

INSERT INTO "ReviewerCredentialScope" (
  "id", "credentialId", "subject", "gradeMin", "gradeMax", "curriculumScopes", "curriculumTypes", "schoolId"
) VALUES
  ('p2b-scope-1', 'p2b-credential-1', 'MATHEMATICS', 7, 9, ARRAY['SCHOOL']::"ReviewerCurriculumScope"[], ARRAY['lesson'], 'p2b-school-a'),
  ('p2b-scope-2', 'p2b-credential-2', 'MATHEMATICS', 7, 9, ARRAY['SCHOOL']::"ReviewerCurriculumScope"[], ARRAY['lesson'], 'p2b-school-a');

INSERT INTO "CurriculumReviewTask" (
  "id", "provenanceId", "revisionId", "policyKey", "policyVersion", "rubricKey", "rubricVersion",
  "priorityBand", "priorityScore", "requiredAuthority", "requiredReviewCount", "blindSecondReview",
  "schoolId", "dueAt", "idempotencyKey", "updatedAt"
) VALUES (
  'p2b-task', 'p2b-provenance', 'p2b-revision', 'P2B_QUALIFIED_REVIEW', 1,
  'LIBERIALEARN_CURRICULUM_REVIEW', 1, 'HIGH', 3005, 'SCHOOL', 2, true,
  'p2b-school-a', now() + interval '1 day', 'p2b-task-fixture', now()
);

DO $$
BEGIN
  BEGIN
    INSERT INTO "ReviewerCredentialScope" ("id", "credentialId", "gradeMin", "gradeMax")
      VALUES ('p2b-invalid-grade', 'p2b-credential-1', 0, 13);
    RAISE EXCEPTION 'grade guard did not reject invalid range';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  BEGIN
    INSERT INTO "CurriculumReviewTask" (
      "id", "provenanceId", "revisionId", "policyKey", "policyVersion", "rubricKey", "rubricVersion",
      "priorityBand", "priorityScore", "requiredAuthority", "dueAt", "idempotencyKey", "updatedAt"
    ) VALUES (
      'p2b-invalid-task', 'p2b-provenance', 'missing-revision', 'P2B_INVALID', 1, 'R', 1,
      'LOW', 1000, 'SCHOOL', now(), 'p2b-invalid-task', now()
    );
    RAISE EXCEPTION 'exact revision guard did not reject mismatch';
  EXCEPTION WHEN foreign_key_violation THEN
    NULL;
  END;
END;
$$;
