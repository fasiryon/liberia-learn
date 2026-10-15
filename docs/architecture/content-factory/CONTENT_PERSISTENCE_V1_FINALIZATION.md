# Persistence V1 finalization evidence

Date: 2026-10-14. Branch: `feat/content-persistence-scheduledwork-v1-repairs`.
Approved repair: `afec4d3f8f2849c72c60e3a60cb33ba8088a932a`.
Repair tree: `5bde50af05c86c5e0c51d053a28c3c1394717e57`.
Main `1e196d9401426c7a252e3605d4d2a972e57cecd2` is an ancestor, including
the Activity Wave merge. Finalization changes documentation only; application,
library, tests, scripts, schema, canonical manifests and migration are unchanged
from that repair.

## Migration safety hold

Migration: `20261013_000001_content_bundle_scheduledwork_pins`.
SQL SHA-256: `563c0b00e51eb99e653bae35b108dabbd8b4edfb778ce8811878f5fff70bd6bb`.

| Environment | Status | Evidence / missing verification |
| --- | --- | --- |
| Production (`bnphuinpvgpmebcsvmsp`) | NOT_APPLIED | Read-only live queries at 2026-10-14 17:39 UTC via both configured endpoints; zero matching public ledger rows. At 17:42:56 UTC, zero matching rows in both `public._prisma_migrations` and `p2a_legacy_migration_history._prisma_migrations`. |
| Staging (`yonpfzjczoffhrgibxkz`) | NOT_APPLIED | Operator's Supabase SQL Editor result: "Success. No rows returned"; independently confirmed by executor read-only query at 17:57:50 UTC, zero exact-name rows in the visible public Prisma ledger. |
| Vercel shared / Preview / Development | NOT_APPLIED | Live inventory at 17:56-17:57 UTC: Production, default Preview and Development database settings identify production; two branch-specific staging Preview overrides identify staging. Both actual databases have checked ledgers. No custom environments or additional LiberiaLearn-linked projects in the audited team. |
| GitHub weekly eval database | UNVERIFIED | `.github/workflows/evals.yml` consumes repository `DATABASE_URL` / `DIRECT_URL` secrets. Secret values are not readable through GitHub's secret metadata API; their target identity has not been supplied or independently verified. |
| AWS worker database | UNVERIFIED | Tracked ECS definitions reference Secrets Manager `liberialearn/DATABASE_URL` / `DIRECT_URL` and SSM `/liberialearn/DATABASE_URL` / `DIRECT_URL`, with other task templates using an SSM ARN placeholder. No AWS credentials, CLI or connector are available to inspect current secret targets or establish that these paths are inactive. |

No push is permitted while any relevant target is UNVERIFIED. An APPLIED result,
including an attempted or rolled-back ledger entry, requires review rather than
certifying an in-place edit safe. Local disposable database success does not prove
hosted absence. No hosted migration, history modification, backfill, allocation,
curriculum publication, deployment or PR creation occurred during finalization.
Hosted access was limited to read-only production ledger queries.

Evidence is retained locally under
`C:/liberia-learn/.task-evidence/persistence-finalization/`; it contains no
connection credentials. `production-ledger-retry.json` records both endpoint
checks and confirms read-only mode; `production-all-ledgers.json` records the
current and archived ledger checks. `staging-ledger-and-development.json` records
the direct staging check and Development's target identity. The first sandboxed attempt could not connect;
the subsequent authorized read-only checks succeeded.

Inventory source: live Vercel API reads scoped to project
`prj_gr1ksFqzN4MXaqxxj7vmkJFitTxf`, team
`team_cp7I3ep96a9HgntG2NB8Bw9G`; redacted evidence in
`vercel-database-inventory.json` and `vercel-database-identities.json`.
The connector's team-scoped requests returned 403; read-only API fallback with an
existing local token succeeded. Individual settings were classified in memory;
no secret values were written to evidence. Development values required recognizing
the project reference inside the setting rather than parsing it as a clean URL;
their configuration validity is outside this task. This audit establishes the
Vercel targets, not all GitHub/AWS targets or organization-wide Supabase inventory.

## Locked contract and runtime gates

- DEC-011: one national registry record per exact immutable bundle version,
  school-owned private records, explicit exact-version national allocation.
  Namespaces protect against identity collisions; ownership/allocation checks
  authorize access.
- Allocation grant/revoke helpers have no application route or runtime caller;
  only tests and the disposable validator call them. RLS is enabled and direct
  anon/authenticated grants are revoked. Keep ordinary runtime users excluded
  until an audited governance authorization service exists. Decision references
  and actor metadata alone grant no authority.
- Revocation retains assignments, exact pins, attempts, evidence and mastery.
  It updates allocation state only. Scheduling and delivery for the revoked
  school fail closed pending an approved continuation/withdrawal policy.
- Activity-only ScheduledWork is unsupported. Required `contentId` must name an
  explicitly selected lesson member; never infer an arbitrary lesson anchor.
- Governed writes/delivery remain gated on approved exact authority adapters,
  reviewed release/resource/toolkit inputs and audits of all intended consumers.
  Persistence provides no release/publication authority.

## Validation

- `npm run validate:changed -- --base 1e196d9401426c7a252e3605d4d2a972e57cecd2`:
  PASS, including Prisma validation/generation, TypeScript, API policy audit,
  7 focused test files / 121 tests and 29 related files / 502 tests. Counts
  overlap; they are not a unique combined total.
- Disposable PostgreSQL 17 compatibility/runtime validator: PASS. Canonical SQL
  replay, existing legacy row retained with six NULL pins, RLS/grants, indexes,
  immutable record/allocation guards, exact-version allocation, school isolation,
  revocation, atomic schedule/audit and concurrent-edit backfill refusal.
- Full canonical PostgreSQL 17 bootstrap / manifest verification: PASS at
  17:44:58 UTC, 22 migrations, 239/239 tables with RLS, zero P2-C client grants,
  no unregistered or stale registry differences, pinned PostgreSQL object hashes
  matched. Evidence: `canonical/verification-evidence.json` and
  `canonical/layered-diff-report.json` under the local evidence directory.
  As documented in the approved repair, Windows PowerShell 5.1 requires relaxing
  expected stderr handling around the losing P2-B claimant. An ignored temporary
  script changed only that handling; it was removed after completion. The tracked
  validator and manifests are unchanged. Disposable containers were removed.
- Production build: PASS, 387 static pages, including compilation, lint and type
  checks. Existing lint/instrumentation warnings and missing optional Redis settings
  remain in the local build log; no hosted database credentials were used for build.
- Loopback production boot: PASS, homepage HTTP 200 with unreachable local-only
  database URLs. This verifies the local artifact, not hosted or authenticated
  governed delivery.
- Final documentation `validate:changed`: PASS; `git diff --check`: PASS.
- Prior full Vitest evidence is reused from the approved repair's handoff:
  758 files, 7417 passed, 8 skipped, zero failed. This is previously recorded
  evidence, not a new full-suite run. The executable tree and tests are unchanged;
  only documentation differs.

## Deployment prerequisites and handoff

First establish the GitHub eval and AWS worker database target identities (or
evidence that the referenced paths are inactive). If either identifies another
shared database, obtain its read-only Prisma-ledger result. Retain the push hold
until all relevant ledgers prove absence. Then push the clean branch
without deploying or opening a PR until reporting. If any migration was applied,
preserve that history and prepare a separately reviewed forward migration.

Any later deployment requires independent authorization, target identity and
backup/restore evidence, reviewed SQL checksum and pending canonical ledger,
maintenance-window/lock planning, schema-first compatibility verification and
Prisma regeneration. Governed enablement, allocations, publication and write
backfill require their own governance and authorization gates. See the migration
runbook for the operator sequence; this handoff authorizes none of those actions.
