# P2-C Pre-Cutover Action Closure — Completion Record

Date: 2026-08-19. Branch `codex/p2c-waec-baseline-alignment`, on top of the
production-authorization audit (`ca1e617c`). PR #86 (open, not merged).
Production untouched throughout — no migration, no seed, no AI call, no
feature-flag change, no merge.

## Why

The final production-authorization audit returned
`AUTHORIZED_WITH_PRE_CUTOVER_ACTIONS`. This pass closes the 10 explicitly
authorized preparation actions so the *next* pass can be the actual
controlled cutover with nothing left to design mid-execution.

## Action 1 — PR metadata: done

PR #86's title and body updated (`gh pr edit`) to state the cumulative
P2-A+P2-B+P2-C scope, current HEAD, CI status, and the audit verdict.
Confirmed live via a fresh `gh pr view`.

## Action 2 — Legacy framework decision: implemented in the seed manifest

Production will seed exactly the 4 canonical frameworks (LPSCE, LJHSCE,
LSHSCE-Regular, LSHSCE-Private). The 5th, superseded merged-pilot row
stays in staging/history only — see
`docs/ops/P2C_PRODUCTION_SEED_MANIFEST.md`.

## Action 3 — Production-safe dedupe index: designed and validated, not executed

New scripts: `scripts/p2c-production-dedupekey-preflight.sql`,
`scripts/p2c-production-dedupekey-apply.sql` (the actual `CREATE UNIQUE
INDEX CONCURRENTLY`, mirroring the proven `20260810_000003_p2a_ai_generation_correlation_index`
precedent for the same table), `scripts/p2c-production-dedupekey-verify.sql`,
`scripts/p2c-production-dedupekey-ledger.ts`, and the orchestrator
`scripts/p2c-production-dedupekey-cutover.ps1`.

**Ledger-integrity design:** the canonical migration file
(`prisma/canonical/migrations/20260819_000001_p2c_ai_interaction_dedupekey_unique/migration.sql`)
is left byte-for-byte unchanged — its checksum already matches staging's
ledger entry. The production apply script executes different (CONCURRENTLY,
non-transactional) DDL to reach the same end state, then records the SAME
checksum (of the unchanged file) in production's ledger. This is
consistent with how every other migration in this repository is already
applied (a hand-written script reaching the canonical file's schema state,
checksummed against that unchanged file, never executed verbatim) — not a
new pattern, and it keeps `prisma migrate status`/`deploy` healthy in both
environments: neither will ever attempt to re-apply this migration, and
neither will report a checksum mismatch against the other.

**Testing performed:** Docker was not running in this environment, so a
full disposable-Postgres execution of the CONCURRENTLY DDL was not
possible — disclosed honestly, not skipped silently. What was validated:
(1) the orchestrator's dry-run mode runs cleanly with no production
access; (2) every SQL statement in the preflight/verify files executed
successfully (no syntax errors) against real staging data, confirming
valid Postgres syntax — the only "errors" observed were the test
harness's own inability to JSON-serialize a `BigInt`, not SQL problems;
(3) staging's actual ledger checksum for this migration
(`9b5452b91cbe0d9bb499fa0b1882cc395ffdbddfae04bfdc6fd16575393829ba`) was
confirmed live, matching exactly what the production ledger script targets.
A human operator should still watch the actual `CONCURRENTLY` DDL run live
during the real cutover rather than treat this as unattended, given the
disposable-container test gap.

## Action 4 — Backup script boundary: added, derived not guessed

`scripts/p2a-production-backup-restore.ps1` gained a `post-p2c`
`-MigrationBoundary` value. The expected active-migration count (13) was
derived from a **fresh, live query of production's actual ledger**
(9 active migrations today: 4 P2-A + 3 P2-B + 2 baseline/hardening) plus
the 4 net-new P2-C migrations this cutover adds — not copied from staging
or guessed. Also added a `p2cLikeCount` column/check to both the source
and restore-verification queries (0 today, expected 4 post-cutover).
PowerShell syntax-checked (`[System.Management.Automation.Language.Parser]::ParseFile`)
without execution.

**Side finding, out of scope, flagged not fixed:** the script's
pre-existing `post-p2b-human` boundary expects 8 active migrations, but a
fresh query found production's actual current count is 9 (likely
explained by the same historical duplicate ledger row — an initial
`20260810_000003_p2a_ai_generation_correlation_index` attempt that rolled
back, then a second resolved row — the production-authorization audit
already found and explained). If `post-p2b-human` is ever invoked again as
literally written, it may need the same kind of review this pass gave
`post-p2c`. Not touched here — outside this pass's 10 authorized actions.

## Action 5 — Production seed manifest: written, with a real finding

`docs/ops/P2C_PRODUCTION_SEED_MANIFEST.md` — explicit allowlist (A–G),
explicit exclusion list (H–K), every count freshly re-queried from staging
this pass (not carried from old commit messages).

**Real finding, not previously caught:** staging's live
`WAEC.LIBERIA.LSHSCE.REGULAR` framework row still has
`examAliases: ["WASSCE"]` / `regionalReferenceLabels: []` — the exact
opposite of what its own seed script currently sets
(`examAliases: []` / `regionalReferenceLabels: ["WASSCE"]`). Independently
re-verified via raw SQL, bypassing any Prisma-client-layer explanation.
Every prior "PASS" on WASSCE isolation this session verified the seed
script's *source code*, not this specific row's *live, already-persisted*
value — the isolation fix changed future-insert behavior but was never
re-applied to this existing row. Does not affect calculation safety
(confirmed no calculation code reads `examAliases`), but the production
seed manifest explicitly specifies the *corrected* values rather than a
literal copy of staging's current row. Recommend a small, separate,
explicitly authorized staging correction before or alongside the next
pass so staging matches its own source code.

## Action 6 — Feature flag: exhaustively attempted, genuinely unverified

Two independent attempts this pass (one direct, one via a parallel fork)
confirm: no tool available in this session — Vercel MCP `get_project`,
`list_projects`, `list_teams`, or any other loaded Vercel tool — exposes
decrypted environment variable values for any variable, not just this one.
The Vercel CLI is not installed. `.vercel/project.json` exists and
resolves the correct project (`prj_gr1ksFqzN4MXaqxxj7vmkJFitTxf`), but
project-metadata endpoints don't carry env values. **Result:
`FEATURE_FLAG_UNVERIFIED`** — a platform/tooling-access limitation, not
something resolvable by retrying. Must be confirmed via dashboard or CLI
access before Phase 8 of the cutover runbook.

## Action 7 — Automatic deployment behavior: evidenced directly

`mcp__plugin_vercel_vercel__list_deployments` for this project shows: every
recent deployment from this PR's branch (`codex/p2c-waec-baseline-alignment`)
has `target: null` (preview), including the current HEAD's own deployment
— none have reached `target: production`. By contrast, historical
deployments from a *different* branch (`codex/p2b-qualified-review-operations`,
tied to the recorded "p2b production cutover no-go" commits) did reach
`target: production` in this project's history. This confirms production
auto-deploy is a real, demonstrated capability of this Vercel project (not
merely assumed default behavior), while also confirming this exact PR
branch has never itself triggered one. The precise current production-branch
name was not exposed by a dedicated settings field in the tools available
this session. Moot for safety regardless: zero code under `app/` references
any P2-C model (re-confirmed this session), so a deploy landing before
migration cannot error against absent schema.

## Action 8 — Cutover runbook: written

`docs/ops/P2C_PRODUCTION_CUTOVER_RUNBOOK.md` — 12 phases (0–11), each with
an exact command/script and PASS/STOP criteria, built on the actual
scripts this and prior passes produced (not generic placeholders). Not
executed.

## Action 9 — Observability checklist: included in the runbook

Existing tooling only (Sentry, `/api/health`, `MetricEvent`, the AI-budget
cron) — see the runbook's own checklist section. One honest gap disclosed:
no existing signal surfaces dedupeKey-conflict frequency; not built in
this pass.

## Action 10 — Final validation

See the final report for exact results. `npx prisma validate`/`generate`
PASS. Full `tsc`/`vitest`/`build` relied on CI as the clean-room authority
(same disclosed pattern as prior passes — this dev machine is memory
constrained). `git diff --check` PASS. Fresh CI triggered against the new
HEAD after pushing these changes.

## Staging / production impact

Zero staging or production writes performed by this pass, beyond the read
queries needed to derive real numbers (dedupeKey stats, ledger counts,
seed-source counts, the WASSCE row check) — all read-only. Production
re-confirmed untouched at the end.
