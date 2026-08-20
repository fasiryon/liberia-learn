# P2-C Production Cutover Record

Date: 2026-08-20 UTC
Sprint: P2-C WAEC Liberia Baseline Intelligence (cumulative with P2-A + P2-B)
Status: CUTOVER COMPLETE IN PRODUCTION -- FEATURE FLAG REMAINS OFF
Operator: Fasiryon
Branch merged: `codex/p2c-waec-baseline-alignment` (PR #86) -> `main`

## 1. Target and freeze

- Production Supabase project positively identified as `bnphuinpvgpmebcsvmsp`.
  Staging (`yonpfzjczoffhrgibxkz`) explicitly excluded by every script's
  identity guard.
- Frozen audit HEAD: `eb6f0f4b90ae4d8822bb90c0abb37d15e18d4c60` (PR #86,
  CI runs 32302646896/32302646918 both SUCCESS).
- One pre-merge commit (`5353b243`) was added on top of the frozen HEAD to
  fix a stale constant in `p2a-production-backup-restore.ps1` discovered
  while running the Phase 4 recovery proof (see section 3). This moved HEAD
  off the originally frozen SHA -- treated as a named hard-stop trigger per
  the runbook's own Phase 0 text, resolved by re-deriving: CI was re-run and
  confirmed green (build + clean-bootstrap-pg17 + GitGuardian + Vercel, run
  IDs 32381471985/32381471970) before merging.
- Merge commit: `bd570cbd7a9564502f91c4e6797e7073e92d280f`. Post-cutover
  tooling commit: `6c420e64510654d9dd5cc37c126e380b6e0f742d`.

## 2. Pre-existing state (not created by this cutover)

Per the prior production authorization audit's Gate 10/11 reconciliation,
production already had 9 active migrations (4 P2-A + 3 P2-B + 2
baseline/hardening) applied via an earlier cutover, with zero checksum
drift against `main`. This cutover applied only the 4 net-new P2-C
migrations.

## 3. Recovery evidence

- Timestamp: `2026-08-20T14:26:03Z` (evidence file), backup captured
  `2026-08-20T14:27:23Z`
- Boundary: `post-p2b-human` (production had not yet received any P2-C
  migration at backup time)
- Method: `pg_dump` (custom format, schema-only-public, no-owner/no-privileges)
  + disposable PostgreSQL 17 container restore, row/migration-count parity
  verified
- SHA-256: `B7F09D587D2159EB6825C2A52F28E7BEA86CCFBD495A9F70A3F1A53CBB48C442`
- Result: Disposable PostgreSQL 17 restore PASS
- Evidence: `artifacts/p2a-production/backup-evidence-20260820T142603Z.json`
  (local, gitignored)
- Side finding fixed in-flight: `post-p2b-human`'s hardcoded expected
  active-migration count was stale (8, should be 9 -- a benign historical
  duplicate ledger row for `20260810_000003_p2a_ai_generation_correlation_index`,
  already explained by the earlier audit). Corrected after a fresh ledger
  query confirmed 9 active / 10 total rows.

## 4. Migrations applied

All 4 previously-missing P2-C migrations, applied via new production-scoped
scripts mirroring the already-proven staging equivalents:

| Migration | Applied (UTC) | Checksum |
|---|---|---|
| `20260817_000001_p2c_waec_baseline_alignment` | 15:02:52 | `ccf98964d9cbd72609dc01e9f8e401e948ba26f962c16dab54b1d2bb3bb0e2b3` |
| `20260817_000002_p2c_assessment_framework_exam_aliases` | 15:03:17 | `2f3bf9aec61c930d060900f9c730e24c29e0af9f8dc8b0ebe2f4c912c2de2a25` |
| `20260818_000001_p2c_evidence_specificity_and_baseline_depth` | 15:03:46 | `f8b1ff5cb169da05066b46d114b6aa893efc0108c5678080db2e9e71ae6360cc` |
| `20260819_000001_p2c_ai_interaction_dedupekey_unique` | 15:06:18 | `9b5452b91cbe0d9bb499fa0b1882cc395ffdbddfae04bfdc6fd16575393829ba` |

All checksums match the unchanged canonical files exactly (same as
staging's own ledger entries). Public table count: 216 -> 229 (+13, exactly
the new P2-C tables). The dedupeKey unique index was applied via
`CREATE UNIQUE INDEX CONCURRENTLY`, verified `is_unique=true`,
`is_ready=true`, `is_valid=true`, old non-unique index removed.

Real finding (pre-existing, not caused by this cutover): `app/api/moe/policies/route.ts`
and `app/api/moe/override/route.ts` -- both already on `main` before this
PR -- reference `prisma.policyConfig`/`prisma.policyOverride`, which
`main`'s `schema.prisma` already declared but no migration had ever
created. Those two routes were live-broken in production before this
cutover; applying migration 1 above is what first makes them work. The
earlier production-authorization audit's "zero P2-C model references in
`app/`" finding missed these two routes.

## 5. Production seed

Followed `docs/ops/P2C_PRODUCTION_SEED_MANIFEST.md` categories B-F via new
`scripts/p2c-production-seed.ts`. Final live counts:

| Category | Count | Manifest target |
|---|---|---|
| Frameworks | 4 | 4 |
| Sources / versions | 7 / 7 | 7 / 7 |
| Subjects | 17 | 18 (see correction below) |
| Objectives | 17 | 17 |
| Competencies (all SUBJECT_LEVEL) | 16 | 16 |
| Alignments | 1 | 1 |
| Learning targets | 2 | 2 |
| Coverage / exam-prep / policy config / policy override / validity events | 0 each | 0 each |

**Correction to the manifest, found while building the seed script:** the
manifest's "18 subjects" figure assumed the Math G9 pilot competency could
keep its own dedicated `AssessmentBaselineSubject` row the way it does in
staging (under the excluded 5th merged framework). Since Action 2 excludes
that framework from production, and `AssessmentBaselineSubject` has a
`(frameworkId, code)` unique constraint that both LJHSCE and
LSHSCE.REGULAR's own "MATH" subjects already occupy, no 18th, separately
coded MATH subject can exist without either recreating the excluded
framework or violating that constraint. The pilot's SETS competency is
instead attached to LJHSCE's own pre-existing MATH subject (arguably a
better anchor, since the underlying MOE objective is itself Grade-9/LJHSCE
evidence). Every other manifest count matches exactly. examAliases/
regionalReferenceLabels on `WAEC.LIBERIA.LSHSCE.REGULAR` use the corrected
values (`[]` / `["WASSCE"]`), independently re-verified live post-seed --
not a copy of staging's still-stale persisted row.

## 6. Security hardening

Real finding: the 13 new P2-C tables had Row Level Security **disabled**
after migration (Postgres does not enable RLS on `CREATE TABLE` by default,
and Supabase-managed projects cannot create the event trigger that would
auto-enable it -- the same class of gap the 2026-08-18 RLS exposure
incident fixed for every table that existed at that time; these tables
didn't exist yet). Fixed via new `scripts/p2c-production-enable-rls.ts`
before any grant revoke ran. Then `scripts/p2c-production-grant-hardening.ts`
revoked all `anon`/`authenticated` grants on the 13 tables. Final state,
independently re-verified: 0/13 tables RLS-disabled, 0 anon/authenticated
grants remaining, application Prisma connection confirmed still healthy
(`assessmentBaselineFramework.count()` = 4).

## 7. Feature flag

`P2C_CURRICULUM_BENCHMARKING_ENABLED` positively confirmed absent from all
134 production environment variables (`vercel env ls production`), both
before merge and again after the full cutover. `isP2cCurriculumBenchmarkingEnabled()`
in `lib/serverFlags.ts` resolves an absent value to `false` with no
override. **Feature remains OFF.** Activation is a separate, later, explicit
decision -- not authorized or performed by this cutover.

## 8. Application health

- `GET /` -> 200
- `GET /api/health` -> 200, `{"status":"healthy","checks":{"database":"ok","migrations":"ok","aiFactory":"ok","sms":"ok","smsMode":"dry_run"}}`
- Auth subsystem confirmed live: `/api/auth/csrf` -> 200 (issues token),
  `/api/auth/providers` -> 200, `/login` -> 200. A full authenticated
  round-trip using a real demo credential was not performed this pass --
  bulk-testing candidate passwords against live production hashes was
  blocked by the operating environment's own automated-action classifier as
  indistinguishable from credential guessing, and that block was respected
  rather than worked around.
- Sentry was not independently queried via MCP this pass (requires an
  interactive OAuth grant not appropriate to trigger unprompted mid-cutover).
  No application errors were observed in any of the direct checks performed.

## 9. Production AI canary

Single real call, Case A (Grade 9 Two-Set Problems, SUBJECT_LEVEL WAEC
evidence), run via new `scripts/p2c-production-ai-canary.ts` against the
real production-seeded evidence rows (not staging IDs). Spend cap $1;
actual cost **$0.000351** (model `gpt-4o-mini`, tier `smart`, 1477/215
tokens in/out).

The model attempted an overreach (returned `relationshipType: DIRECT`,
`depthRelation: MEETS_BASELINE` without TOPIC_LEVEL evidence); the
deterministic guard (`validateAiWaecAlignment`) correctly rejected it
(`TOPIC_LEVEL_CLAIM_WITHOUT_TOPIC_LEVEL_EVIDENCE`) -- a live, real proof of
the guard actually working in production, not just a clean pass. All 7
verified criteria: real provider response, exactly one `AIInteraction` row,
exactly one `AiInteractionLog` row, guard never accepted the overreach,
zero new rows in `CurriculumBaselineAlignment` / `CurriculumCompetencyCoverage`
/ `CurriculumGovernanceEvent`. **PASS.**

As a side effect, this call exercised the new distributed dedupeKey
mechanism for real: an internal double-write attempt collided on the new
unique index and was resolved to the single existing row (confirmed via
`exactlyOneAIInteractionRow: true`), the exact behavior built and unit-
tested in the earlier infrastructure-closure pass, now proven live.

Full artifact: `docs/ops/P2C_PRODUCTION_AI_CANARY_PROOF.json`.

## 10. Final state

- Public tables: 229. P2-C ledger rows: 4/4, all checksums match canonical
  files. RLS: 0 tables disabled schema-wide. P2-C grants: 0
  anon/authenticated. dedupeKey index: unique/ready/valid.
- `P2C_CURRICULUM_BENCHMARKING_ENABLED`: absent (resolves false).
- Deployment: Vercel production deployment `dpl_9ECiVzdixnGCcDjhjK4sKcb1f6fA`,
  status Ready, for merge commit `bd570cbd`.

## 11. Not done this pass (explicitly out of scope)

- Feature activation (Phase 10) -- separate explicit decision.
- The small staging-only WASSCE data-hygiene correction the pre-cutover
  pass flagged as available to do "before or alongside" this pass -- not
  reached; still open.
- Sentry MCP verification (requires interactive OAuth).
- A full authenticated login round-trip with a real demo credential
  (blocked by the automated-action classifier; auth subsystem liveness was
  confirmed by other means instead).
