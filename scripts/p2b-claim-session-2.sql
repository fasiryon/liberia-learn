\set ON_ERROR_STOP on
INSERT INTO "CurriculumReviewAssignment" (
  "id", "taskId", "slot", "reviewerProfileId", "credentialId", "credentialScopeId", "leaseToken",
  "leaseExpiresAt", "maxContinuousUntil", "idempotencyKey", "updatedAt"
) VALUES (
  'p2b-assignment-2', 'p2b-task', 'FIRST', 'p2b-profile-2', 'p2b-credential-2', 'p2b-scope-2', 'p2b-lease-2',
  now() + interval '15 minutes', now() + interval '2 hours', 'p2b-claim-2', now()
);
