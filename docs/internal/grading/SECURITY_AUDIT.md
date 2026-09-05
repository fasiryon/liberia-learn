# Grading Security Evidence Index

This file is a synthesis, not a claim that a new independent audit occurred.

## Canonical completed evidence

- `docs/roadmaps/NR14_5_GRADING_FAIRNESS_AUDIT.md` is the canonical NR-14.5
  assessment-integrity and fairness review. It records server-held answer-key
  remediation, server-held code-test authority, bounded AI grading prompts,
  offline grading behavior, tests, and merge evidence.
- `docs/security/INTERNAL_SECURITY_REVIEW_2026-08-10.md` finding #2 records the
  grading override cross-school IDOR. The route now resolves the submission's
  school and returns 403 before update when it differs from the caller's school;
  platform-admin elevation remains explicit.
- `lib/quality/fixtures/regression.ts` preserves the grading IDOR as a P7-C
  regression fixture so the release gate retains institutional memory.

## Pre-NR15 verification notes (2026-09-04)

- The grading override catch path mapped only messages containing
  `Unauthorized` to 403. A narrow error-mapping correction now also maps
  `Forbidden` to 403. Existing tenant enforcement remains unchanged; this was
  not a newly discovered access-control hole.
- The proposed MOE dashboard cache-key concern was investigated in the MOE
  dashboard routes and supporting aggregation code. **NOT CONFIRMED:** no
  repository-local shared cache key omitting tenant or authority scope was found.
- The proposed PII-logging concern was investigated narrowly across MOE and
  grading request paths plus the central logger. **NOT CONFIRMED:** the central
  logger redacts email, phone, token, password, and authorization keys, and no
  learner response or prompt logging was found in the audited paths. This is not
  a claim that every log in the repository received an independent audit.

No production or staging mutation was performed for this synthesis.
