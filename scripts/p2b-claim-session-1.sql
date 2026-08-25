\set ON_ERROR_STOP on
BEGIN;
INSERT INTO "CurriculumReviewAssignment" (
  "id", "taskId", "slot", "reviewerProfileId", "credentialId", "credentialScopeId", "leaseToken",
  "leaseExpiresAt", "maxContinuousUntil", "idempotencyKey", "updatedAt"
) VALUES (
  'p2b-assignment-1', 'p2b-task', 'FIRST', 'p2b-profile-1', 'p2b-credential-1', 'p2b-scope-1', 'p2b-lease-1',
  now() + interval '15 minutes', now() + interval '2 hours', 'p2b-claim-1', now()
);
SELECT pg_sleep(8);
COMMIT;
