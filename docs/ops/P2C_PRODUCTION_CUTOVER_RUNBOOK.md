# P2-C Production Cutover Runbook

Prepared 2026-08-19. **Not executed.** This is the operator runbook for the
next pass — the actual controlled production cutover. Every phase names
the exact script/command to run in this repository; nothing here is a
placeholder. Each phase has explicit PASS / STOP / RECOVERY criteria.

Prerequisites before starting: audited HEAD `ca1e617c37fe74ac23009050f0abc74ca5e2c75f`
(or later, re-verified — see Phase 0), Docker running locally (required for
Phase 1 and the `p2a-production-psql.ps1` wrapper used throughout).

---

## PHASE 0 — Freeze

- `git rev-parse HEAD` must equal the SHA this runbook was frozen against.
  If it differs, STOP — re-derive this runbook against the new HEAD first
  (do not assume prior gates still hold).
- Confirm PR #86 state: `gh pr view 86 --json state,mergeable,headRefOid`.
- Confirm production project identity: `bnphuinpvgpmebcsvmsp`.

**PASS:** all three match. **STOP:** any mismatch — do not proceed.

## PHASE 1 — Recovery

- `pwsh scripts/p2a-production-backup-restore.ps1 -Owner <name> -EvidenceLocation <path> -MigrationBoundary post-p2b-human`
  (the CURRENT boundary — production has not yet received any P2-C
  migration, so this is the correct boundary to snapshot *before* Phase 4,
  not `post-p2c`). Requires Docker running and `DATABASE_URL` set to
  production's transaction pooler (`.env.p2a-production.local`).
- Confirms production identity, PostgreSQL 17, TLS, dumps via `pg_dump`,
  restores into a disposable container, verifies row/migration counts
  match, writes signed evidence JSON to `artifacts/p2a-production/`.

**PASS:** script prints "Disposable PostgreSQL 17 restore: PASS" and writes
an evidence JSON. **STOP:** any thrown error — do not proceed past this
phase without a real, verified recovery point.

## PHASE 2 — DB Preflight

- `pwsh scripts/p2a-production-psql.ps1 -File scripts/p2c-production-dedupekey-preflight.sql -UrlVariable DATABASE_URL`
  — re-run the dedupeKey duplicate check one more time here, immediately
  before Phase 4 (state may have changed since the pre-cutover preparation
  pass that last checked it).
- Manually confirm: zero duplicate non-null `dedupeKey` groups.
- RLS baseline: re-run the same schema-wide RLS/grant check the
  confirmation audit used (0 of N public tables RLS-disabled, 0
  anon/authenticated mutating grants) to confirm no drift since the last
  check.
- Critical row counts: re-run `scripts/p2c-production-dedupekey-preflight.sql`'s
  own row-count query (already included) plus a spot count of `User`/`School`
  to confirm production still looks like production (not corrupted/emptied).

**PASS:** zero duplicates, RLS/grants unchanged, row counts sane.
**STOP:** any duplicate found, or RLS/grants drifted — do not proceed;
these are exactly this task's own hard-stop conditions.

## PHASE 3 — Repository / Deployment

- Update PR #86 metadata if not already current (Action 1 — done as of
  this runbook's freeze date; re-check if time has passed).
- Human reviewer explicitly acknowledges, in the PR review itself, that
  this is the cumulative P2-A+P2-B+P2-C delivery.
- Merge PR #86 into `main` via the normal GitHub merge UI or `gh pr merge 86`.
- Record the exact resulting `main` SHA: `git rev-parse main` (after
  `git fetch origin main`).
- Confirm deployment behavior: check whether a new Vercel deployment with
  `target: production` appears for that `main` SHA
  (`mcp__plugin_vercel_vercel__list_deployments` or the Vercel dashboard).
  Per the pre-cutover preparation pass's finding, zero code anywhere under
  `app/` references any P2-C Prisma model, so an auto-deploy landing before
  Phase 4's migration is not unsafe — but confirm it anyway, don't assume.

**PASS:** PR merged, main SHA recorded, deployment status confirmed either
way. **STOP:** merge conflicts, or a P2-C model reference is somehow found
in `app/` at merge time that wasn't there before (re-run the Gate-18 grep
from the production audit as a final check before merging, not just before
this runbook was written).

## PHASE 4 — Migrations

Apply only the 4 missing P2-C migrations (production already has the other
9 via a prior cutover, per the production authorization audit's Gate
10/11 reconciliation).

- The 3 schema migrations (`20260817_000001_p2c_waec_baseline_alignment`,
  `20260817_000002_p2c_assessment_framework_exam_aliases`,
  `20260818_000001_p2c_evidence_specificity_and_baseline_depth`) — all
  touch brand-new, empty-in-production tables, low risk. Apply via the
  same raw-execution + manual-ledger pattern already used for staging
  (mirror `scripts/p2c-staging-apply-evidence-specificity-migration.ts`,
  written as production-scoped equivalents — **not yet written**, write
  them at the start of this phase, following that exact staging precedent).
- The dedupeKey-unique index (highest-risk migration in the chain, touches
  a live table): `pwsh scripts/p2c-production-dedupekey-cutover.ps1 -Confirm`
  — already written and tested (dry-run + SQL-syntax validated against
  staging) in the pre-cutover preparation pass. Walks preflight → apply
  (CONCURRENTLY) → verify → ledger, with operator confirmation gates at
  each step.

**PASS:** all 4 migrations show `finished_at` in production's
`_prisma_migrations`, checksums match the canonical files. **STOP:** any
migration fails partway — the 3 schema migrations are transactional
(safe to retry cleanly); the dedupeKey one has its own recovery guidance
in `scripts/p2c-production-dedupekey-verify.sql`'s header comment (an
INVALID concurrent index needs an explicit `DROP INDEX CONCURRENTLY`
before retrying, not a blind re-run).

## PHASE 5 — Production seed

- Follow `docs/ops/P2C_PRODUCTION_SEED_MANIFEST.md` exactly — categories
  A–G only, never H/I/J/K.
- **Before running any seed script against production**, confirm it uses
  the CORRECTED WASSCE values for `WAEC.LIBERIA.LSHSCE.REGULAR`
  (`examAliases: []`, `regionalReferenceLabels: ["WASSCE"]`) — do not
  adapt a script that copies staging's current row verbatim, since that
  row is presently stale (see the manifest's "Hard finding" section).
- 4 frameworks only (LPSCE, LJHSCE, LSHSCE-Regular, LSHSCE-Private) — the
  5th legacy merged pilot row is explicitly excluded per Action 2.

**PASS:** row counts match the manifest exactly (4 frameworks, 7 sources,
7 versions, 18 subjects, 17 objectives, 16 competencies at SUBJECT_LEVEL,
1 alignment, 2 learning targets). **STOP:** any row count differs, or any
H/I/J/K-category data appears.

## PHASE 6 — Security

- Adapt `scripts/p2c-staging-grant-hardening.ts` into a production-scoped
  equivalent (same `REVOKE ALL ... FROM anon, authenticated` pattern on the
  13 P2-C tables, same `assertProduction()`-style identity guard swapped in
  for `assertStaging()`) — **not yet written**, write at the start of this
  phase.
- Run it; verify via `information_schema.role_table_grants` that zero
  anon/authenticated grants remain.
- App/service smoke: confirm the application's own Prisma connection still
  works post-revoke (e.g. `assessmentBaselineFramework.count()` succeeds).

**PASS:** zero anon/authenticated grants, app connection healthy.
**STOP:** any grant remains, or the app connection breaks.

## PHASE 7 — Application health

- `/` — HTTP 200.
- `/api/health` — reports `database`/`migrations`/`aiFactory` all healthy
  (existing endpoint, `app/api/health/route.ts`).
- Login flow — one real login round-trip.
- Sentry — confirm no new fatal-level issue appears in the minutes after
  deploy.

**PASS:** all four green, matching the exact checklist the P2-A cutover
already used and proved. **STOP:** any check fails — this is the point to
strongly consider a fix-forward-or-pause decision before Phase 9.

## PHASE 8 — Feature remains OFF

- Positively re-confirm `P2C_CURRICULUM_BENCHMARKING_ENABLED` is `false`
  in production, by whatever mechanism becomes available at cutover time
  (dashboard, CLI, or MCP tooling) — this was `FEATURE_FLAG_UNVERIFIED`
  during preparation and must be resolved by this phase, not carried
  forward unresolved into activation.

**PASS:** positively confirmed false. **STOP:** confirmed true unexpectedly
(a named hard-stop condition) — halt and investigate before Phase 9.

## PHASE 9 — Production AI canary

- 1 real call, spend cap `$1` (expected actual ~$0.0003), design per the
  production authorization audit's Gate 17/28: Case A or B from
  `scripts/p2c-live-ai-sme-proof.ts`'s structure, adapted to target
  production's staging-equivalent env guard.
- Pass criteria: real provider response; exactly one `AIInteraction` row
  for the invocation; exactly one `AiInteractionLog` row; the guard
  rejects the overreach; zero new rows in `CurriculumBaselineAlignment` /
  `CurriculumCompetencyCoverage` / `CurriculumGovernanceEvent`.

**PASS:** all five criteria met. **STOP:** any criterion fails — do not
proceed to Phase 10 activation.

## PHASE 10 — Activation decision

- A separate, explicit, human authorization to flip
  `P2C_CURRICULUM_BENCHMARKING_ENABLED` to `true` — not automatic, not
  bundled with any prior phase's sign-off.

## PHASE 11 — Final evidence

- Re-run Phase 7's health checks once more.
- Record: final migration checksums, final row counts, RLS/grant state,
  the canary's full telemetry record, the deployment ID/SHA.
- Write `docs/ops/P2C_PRODUCTION_CUTOVER_RECORD.md`, mirroring
  `docs/ops/P2A_PRODUCTION_CUTOVER_RECORD.md`'s structure exactly.
- Update `docs/roadmaps/CURRENT_EXECUTION_STATE.md` to close P2-C.

---

## Observability checklist (existing tooling only — nothing new built)

| Signal | Where |
|---|---|
| General error-rate / new fatal issues | Sentry (already live in production, confirmed via `docs/ops/ALERTS.md` Alert 2's passed drill) |
| App health (DB, migrations, AI factory) | `/api/health` (`app/api/health/route.ts`) |
| 24h error-rate by kind | `MetricEvent` table + `lib/ops/errorRates.ts` |
| AI spend threshold | `/api/cron/check-ai-budget` (Alert 3) — relevant given the Phase 9 canary and any post-activation spend |
| Deploy failures / runtime crashes | Vercel's own function logs and deployment-failure notifications (Alert 1) |
| Guardrail rejection counts | `validateAiWaecAlignment`'s outcome, visible per-call in the canary's own telemetry record (Phase 9); not aggregated anywhere yet |
| dedupeKey P2002 conflict frequency | **No existing signal** — a conflict is silently handled by design (correct behavior), not surfaced anywhere today. Not built in this pass; if this rate ever needs watching post-activation, it would need a new counter. |
| Authorization / RLS errors | Standard Postgres/Supabase logs via the production project dashboard |
