# P2-C Staging Migration — Completion Record

Date: 2026-08-17. Branch `codex/p2c-waec-baseline-alignment`. Staging project
`yonpfzjczoffhrgibxkz` (approved, same project P2-A/P2-B used). Production
project `bnphuinpvgpmebcsvmsp` was not touched.

## What was applied

`prisma/canonical/migrations/20260817_000001_p2c_waec_baseline_alignment/migration.sql`
(690 lines, SHA-256 `ccf98964d9cbd72609dc01e9f8e401e948ba26f962c16dab54b1d2bb3bb0e2b3`),
applied directly via `psql` inside a disposable `postgres:17-alpine`
container, then recorded in `_prisma_migrations` with a matching checksum.
113 statements: 20 `CREATE TYPE`, 13 `CREATE TABLE`, 45 `CREATE INDEX`, 35
`ALTER TABLE ... ADD CONSTRAINT` (foreign keys). No `DROP`, no
`ALTER COLUMN`, no destructive statement of any kind.

## Why a raw `prisma migrate diff` was not applied as-is

Running `prisma migrate diff` against the live staging schema produced a
901-line raw diff that mixed genuine P2-C additions with substantial,
unrelated, and in places destructive staging drift predating P2-C entirely:
`DROP TABLE "TrendSnapshot"`, `ALTER TABLE "User" DROP COLUMN
"welcomeCompletedAt"`, numerous `DROP INDEX` / `DROP CONSTRAINT` /
`ALTER COLUMN ... SET DATA TYPE` statements on unrelated live tables
(Attendance, Exam, Timetable, CurriculumUnit, TeacherLessonAssignment, and
others), and cosmetic constraint/index rename noise. This confirms and
extends what Codex's session flagged before running out of context. Applying
that raw diff would have violated the standing rule against destructive
migrations and against unrelated remediation.

Instead, the raw diff was programmatically filtered (`extract-p2c-migration.mjs`,
scratchpad-only, not committed) to keep only `CreateEnum` statements, plus
`CreateTable` / `CreateIndex` / `AddForeignKey` statements whose target
table is one of the 13 genuinely new P2-C tables. Every dropped statement
was logged with its reason; every kept statement was logged with its
target. Ground truth was independently re-verified by querying staging
directly (not just trusting the diff tool) before and after: `AIReviewSpecialty`
already had a `WAEC_ALIGNMENT` value from the already-merged P2-B AI SME
migration (`20260814_000002_p2b_ai_sme_review`, itself dated before this
branch existed) — not new drift, and correctly excluded from the P2-C
migration since it already exists.

## Incident during application (contained, no data impact)

The first `prisma migrate deploy` attempt used the default `prisma/migrations`
directory (135 unrelated legacy migration files) instead of
`prisma/canonical/migrations` (the actual 9-migration canonical ledger this
staging project tracks), because `prisma/p2c-staging.config.ts` did not
specify a `migrations.path`. It attempted `20260213_222830_baseline_from_existing_db`
and failed client-side ("error encoding message to server: string contains
embedded null") before any SQL reached the server. This left one `started_at`-only,
unfinished row in `_prisma_migrations`. Verified via direct query that no
other row was affected (all 9 legitimate migrations remained `finished_at`
true, `rolled_back_at` false, ledger content byte-identical to before).
Deleted the single bogus unfinished row directly (not a `migrate resolve
--rolled-back`, since this migration was never legitimately part of this
project's ledger — it was an operator/config error, not a real attempt in
the real sequence). Verified the ledger returned to exactly its prior
9-migration state before proceeding. The actual P2-C migration was then
applied via a direct, explicit `psql` execution instead of `prisma migrate
deploy`, to avoid relying on directory auto-discovery again. Also fixed
`prisma/p2c-staging.config.ts`'s `schema` path (`"prisma/schema.prisma"` was
resolving relative to the config file's own directory as
`prisma/prisma/schema.prisma`; corrected to `"schema.prisma"`).

## Recovery point

A fresh, real `pg_dump` (custom format, `--schema=public --no-owner
--no-privileges`) of the complete pre-P2C staging state was taken
immediately before applying the migration (the existing P2-A backup evidence
was 5 days stale and predated 3 since-applied P2-B migrations, so it was not
a valid recovery point for this operation). Restore-verified into a
disposable `pgvector/pgvector:0.8.0-pg17` container: 216 tables restored,
migration ledger matched live staging exactly (9/9), and
`CurriculumAuthoritySource` (a new P2-C table) was correctly absent,
confirming the backup genuinely captures the pre-P2C state. Evidence:
`artifacts/p2c-staging/backup-evidence-20260817T164456Z.json` (gitignored,
local operator evidence, same convention as the P2-A backup record). Dump
SHA-256: `50929398d6b8f8718aa7b488d60b981246ab7a26d5b9267e8ac35d3d6bb228c8`.

## Post-migration verification (live queries against staging)

- Migration ledger: exactly 10 finished rows (9 prior + the new P2-C one),
  0 unfinished, 0 unexpected rolled-back rows beyond the pre-existing,
  already-documented P2-A B2 incident pair.
- P2-C tables: 13/13 present (`CurriculumAuthoritySource`,
  `CurriculumAuthoritySourceVersion`, `MoeCurriculumObjective`,
  `AssessmentBaselineFramework`, `AssessmentBaselineSubject`,
  `AssessmentBaselineCompetency`, `CurriculumBaselineAlignment`,
  `CurriculumAlignmentValidityEvent`, `CurriculumLearningTarget`,
  `CurriculumCompetencyCoverage`, `ExamPreparationProfile`, `PolicyConfig`,
  `PolicyOverride`).
- P2-A tables: 4/4 still present and untouched (`CurriculumProvenance`,
  `CurriculumContentRevision`, `CurriculumGovernanceEvent`,
  `CurriculumEvidence`).
- P2-B tables: 11/11 still present and untouched (`ReviewerProfile`,
  `ReviewerCredential`, `ReviewerCredentialScope`,
  `ReviewerCredentialStatusEvent`, `ReviewerRestriction`,
  `CurriculumReviewTask`, `CurriculumReviewAssignment`,
  `CurriculumReviewAssessment`, `CurriculumReviewDecision`,
  `ReviewCalibrationSession`, `ReviewCalibrationResult`).
- Total public tables: 229 (216 baseline + 13 new), matching exactly.
- Foreign keys on the 13 new tables: 0 unvalidated (`NOT convalidated`
  count is 0 — every FK the migration added is a fully validated
  constraint).
- Migration client connection: TLS 1.3 (`TLS_AES_256_GCM_SHA384`).
- Staging app health (`P2A_STAGING_APP_URL/api/health`, the currently
  deployed P2-A/P2-B Preview, unrelated to this DB-only change): HTTP 200
  after the migration.

## What was not done

No code was deployed to this or any Preview environment as part of this
migration — this is a database-only change. `P2C_CURRICULUM_BENCHMARKING_ENABLED`
remains unset/false everywhere; nothing reads or writes the new tables in
any running deployment yet. Production (`bnphuinpvgpmebcsvmsp`) was not
touched, queried, or connected to at any point in this operation.
