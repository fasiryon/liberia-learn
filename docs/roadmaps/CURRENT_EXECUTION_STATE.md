# CURRENT EXECUTION STATE

## Purpose
Live execution tracking for the final closeout program.

## P5-A Manifest Policy Authority: COMPLETE

Completed on dedicated branch `feat/p5-a-signed-offline-packs`, with policy
implementation at `1b1f97d1` and review remediation at `aadf0e69` plus
`c74d9547`.

- Phase B ordering remains authoritative: revision first, governance second,
  with equal-cursor conflicts rejected.
- Phase C public-key registry behavior remains authoritative: explicit registry
  lookup, unknown and retired key rejection, malformed-registry fail closed,
  and legacy single-key fallback only when the registry is absent.
- `expiresAt` is canonical UTC ISO-8601 with milliseconds, derived as seven
  days after the server issuance time. Issuance renews on an authorized
  curriculum read without changing the signed Phase B ordering cursor. A
  non-revoked manifest is not accepted for new trust or offline serving after
  expiry. Revocations remain authoritative after expiry.
- `minClientVersion` is strict `MAJOR.MINOR.PATCH` SemVer with no leading
  zeros. The browser client must be at least the signed minimum; malformed or
  unknown client versions fail closed. The default client version is `1.0.0`;
  new issuer policy can override it with
  `CONTENT_MANIFEST_MIN_CLIENT_VERSION`.
- `contents` is canonically sorted by content ID, version, and hash. Content
  IDs are unique. Each entry carries a version and lowercase 64-hex SHA-256
  over canonical `{contentId, version, metadata, payload, audio}` delivered
  to the offline cache. Reordering is not semantic; malformed, duplicate, or
  mismatched content/hash data is rejected.
- Legacy manifests with absent policy fields remain compatible under their
  existing signed trust and rollback rules. Their policy fields are
  unavailable and untrusted; no new issuer emits them, and new policy checks
  never rely on their absence.
- No OfflinePack/System2 schema migration was introduced. No production
  deployment, staging mutation, credential use, or real key rotation occurred.

Validation evidence for this gate: Prisma generate PASS; TypeScript PASS with
the established 6144 MB heap; changed-file validator PASS; focused trust and
offline tests PASS (92 tests); full Vitest PASS (4,906 tests in 598 files);
production build PASS (384 static pages); and `git diff --check` PASS. One
concurrent full run exposed four inherited timing-sensitive tests; all four
passed in an isolated rerun, and the subsequent complete run was fully green.

## P5-B Offline Synchronization and Conflict Policy: COMPLETE

Completed on dedicated branch `feat/p5-b-offline-sync` after the P5-A trust
contract. The canonical implementation is documented in
`docs/ops/OFFLINE_SYNCHRONIZATION_P5B.md`.

- Supported offline writes are lesson progress/completion, append-only
  assessment attempts, assignment submissions, homework submissions, lab
  session merges, and learner attendance marks.
- The existing partitioned IndexedDB queue is now the canonical outbox with
  protocol-versioned operations, content provenance, dependency ordering,
  bounded retry/backoff, leases, explicit acknowledgement, conflict, and
  terminal-failure states. Assignment drafts remain local editor state and
  are not a second submission queue.
- `/api/student/sync` binds accepted work to the authenticated learner and
  tenant, replays exact operation identities idempotently, rejects semantic
  idempotency-key reuse, validates queued payloads, and applies resource-level
  concurrency/conflict rules. No learner-data schema migration was required.
- Revoked content preserves learner evidence but is not accepted as currently
  trusted provenance; expired manifests block new trust without deleting work.
  Auth expiry holds the queue for reauthentication, and logout is held while
  unsynced/conflicted work remains.
- Durable progress, quiz drafts, and signed lesson-cache references support
  refresh, tab close, PWA reopen, and reconnect. Aggregate sync metrics avoid
  logging answer content.
- No production/staging mutation, credential use, destructive migration, or
  paid-service increase occurred.

Validation evidence for this gate: Prisma generate PASS; TypeScript PASS with
the repository's 4 GB heap allowance; focused offline/sync suites PASS (68
tests in 11 files); real-IndexedDB durability/isolation tests PASS; production
build PASS; and `git diff --check` PASS. The local full run recorded 4,908 of
4,911 tests before three inherited contention timeouts; the exact pushed
branch run passed all 4,911 tests in 599 files. PR #94's exact-head CI run
`33131761462` passed TypeScript, 4,911 Vitest tests, and build; GitGuardian,
Vercel, and PR triage passed. Supabase Preview was correctly skipped because
Prisma is authoritative. After merge, main SHA
`f37069566a7697ef3cd4ce42849259d3745ffc89` passed CI run `33132223604`
(including TypeScript, 4,911 tests, and build) and Runtime Gate 1 run
`33132223601`. No production or staging mutation occurred.

P5-A Manifest Policy Authority remains COMPLETE and authoritative.

Recommended next LiberiaLearn goal: **NR-12 - Critical Grade Deserts (G2,
G9)**, the first pending national rollout sprint after the completed
offline/PWA engineering work. Physical mobile certification remains a future
application-shell gate and is not the active sprint.

## P5-C PWA Lifecycle and Real-Browser Offline E2E: COMPLETE

The P5-C implementation and exact merged-main verification are complete on
main at `0ecbebbee362e10929bb708ad93593a90412777d`, delivered through PR #96.
P5-A trust and P5-B synchronization remain complete and authoritative. The
lifecycle work adds deterministic manifest and service-worker asset routing,
separated shell/runtime/content caches, explicit update and storage-failure UI,
mobile-like Playwright coverage, and real IndexedDB/Cache Storage
browser-context restart coverage. The P5-B review remediations are included:
homework entity mapping, object-shaped quiz answers, assignment targeting,
retryable service-worker results, explicit storage-error handling, and fresh
operation IDs after acknowledged writes.

Local gate evidence: the P5-C Playwright suite passed 4 tests across desktop
Chromium and Pixel 5 emulation; the full Vitest gate passed 600 files and 4,914
tests; `npx prisma generate`, TypeScript, build, and `npm run validate:changed`
passed. Post-merge CI run `33147542267`, Runtime Gate 1 run `33147542143`, and
PR Triage run `33147542183` passed. No production or staging mutation
occurred. P5-D storage-management hardening is recorded below; physical
Android certification is intentionally deferred by founder decision.

## P5-D Storage and Non-Physical Engineering: COMPLETE

P5-D non-physical engineering is complete on main at
`b39dc1e0ef1a9cd2340780d6d9b1526efeb51f04` via PR #98. P5-A trust, P5-B
synchronization, and P5-C browser/PWA lifecycle remain complete and
authoritative. The storage-management contract is documented in
`docs/ops/OFFLINE_STORAGE_P5D.md`.

- The existing partitioned IndexedDB outbox is `CRITICAL_UNSYNCED` and is not
  an application-controlled eviction target.
- Lesson bytes are `RE_DOWNLOADABLE`; trust metadata remains governed by
  P5-A; shell/runtime caches are replaceable by the service worker.
- Storage accounting uses `navigator.storage.estimate()` where supported and
  reports measured downloaded lesson bytes and protected unsynced work.
- The learner storage page supports deterministic safe removal and displays
  trusted, expired, revoked, update-required, incomplete, and corrupt states.
- Partial writes, malformed metadata, hash failures, quota errors, and cache
  failures do not create trusted incomplete content or false queued-success
  states.
- Logout is held while unsynced work remains, and account partitions remain
  isolated. Browser, operating-system, and user data clearing remains an
  unavoidable platform boundary.
- No production or staging mutation, credential use, paid infrastructure, or
  learner-data migration occurred.

Physical Android certification is `DEFERRED BY FOUNDER DECISION`, not failed
and not complete. Existing Pixel 5 Playwright coverage is browser emulation
only. The future mobile application-shell gate must reopen physical Android
and iOS validation with install, offline launch, trusted lesson, offline
activity, kill/reopen, reconnect/sync, update, and storage-pressure checks.

Offline/PWA engineering: `COMPLETE`.

Browser/PWA validation: `COMPLETE`.

Physical mobile certification: `DEFERRED` to the Android/iOS
application-shell phase.

## NR-12 Critical Grade Deserts (G2, G9): COMPLETE

Completed on dedicated branch `feat/nr-12-g2-g9-grade-deserts` on 2026-08-28.
The repository-first audit found the critical desert in the ten Grade 2/9
core-subject cells (MATH, LITERACY, SCIENCE, SOCIAL_STUDIES, and CIVICS):
each cell was below the roadmap threshold and did not have a deterministic,
substantive lesson-generation contract. NR-12 closes the authorized repo
coverage target with exactly 15 deterministic, authored lessons per cell
(150 lessons total), with unit, lesson, practice, assessment, prerequisite,
and authority traceability.

- Grade 2: 5/5 cells complete, 15/15 lessons each; age-adapted concrete
  examples, short instructions, scaffolding, and simple assessment wording.
- Grade 9: 5/5 cells complete, 15/15 lessons each; conceptual progression,
  worked reasoning, prerequisite continuity, error analysis, and independent
  practice.
- Authority: existing repo MOE standard records plus verified Liberia MOE
  G2 Social Studies and G9 Math, Language Arts, General Science, and Social
  Studies objective records. No unsupported WAEC standard or invented MOE
  authority was added.
- Generation: `lib/curriculum/nr12GradeDeserts.ts` is the NR-12 canonical
  authored plan. It rejects shell content, records deterministic hashes,
  preserves grade/subject identity, and routes approval through the existing
  risk-triage/governance path. The international techniques in
  `lib/curriculum/framework.ts` remain pedagogy choices subordinate to
  Liberia MOE/WAEC authority.
- Assessments: lesson quiz = 5 items with four options; unit quiz = 10
  items; term-exam blueprint = 30 items. These are LiberiaLearn delivery
  defaults, not claims that the MOE or WAEC mandates those exact counts.
  Items map to the lesson authority code, use deterministic answer keys,
  plausible distractors, rotated answer positions, and concept/application
  coverage. Numerical values may vary only when the measured skill remains
  unchanged.
- Runtime: pre-authored lesson quizzes flow through the existing lesson quiz
  route/player; exam generation rejects shells and missing requested-standard
  coverage. No P5-A/P5-B/PWA contract or schema migration changed.
- Validation: `npx prisma generate` PASS; `npx tsc --noEmit` PASS;
  full Vitest PASS (4,932 tests in 602 files); production build PASS (384
  static pages); NR-12 audit PASS; `git diff --check` PASS. No production or
  staging mutation occurred. A fresh live database count was not used because
  the working environment could not reach the configured pooler; repo
  generation and coverage evidence are the authoritative NR-12 engineering
  gate for this change.

The lesson-generation operating contract is documented in
`docs/roadmaps/NR12_LESSON_GENERATION_GUIDELINES.md`. Existing generic
non-NR-12 generators remain a follow-up convergence item; NR-13 should apply
the same authored-plan contract to its cells.

Recommended next goal: **NR-13 - Grades 5–8 Gap Closure + ENGLISH**. Physical
mobile certification remains a future application-shell gate and is not the
next national rollout goal.

## Resume here

The entries below are historical execution records. Their embedded next-goal
instructions are superseded by the active NR-13 resume target above.

- **P5-A PHASE C OPERATIONAL CLOSURE (2026-08-27).** Phase C source is
  complete on main at `f4f350d6f7232014d9136f55386880c9e912a7d8`, after PR
  #90's merge `b72851a1a154402bc03111be170c3712b2902ba7` and PR #89's
  consolidation. The operational closure remediation is now also merged on
  main at `79ad1f01be9eaea9884e0868c3035a5e2a7174ac` via PR #91.
  Phase A is complete as the manifest-envelope contract shape; its
  `expiresAt`, `minClientVersion`, and `contents` fields remain deliberately
  unsigned/unverified. Phase B is COMPLETE: signed sequence ordering,
  rollback/replay rejection, equal-cursor semantics, and revocation behavior
  remain covered by the Phase B trust suite. Phase C is COMPLETE: the static
  registry performs exact `manifest.keyId` lookup, malformed/duplicate/unknown
  keys fail closed, and legacy fallback is used only when the registry is
  unset. The production ops scripts are registry-aware, and their signer
  state machine is `REAL` / `EPHEMERAL` / `UNAVAILABLE` (STOP); synthetic
  signing requires the exact string `P2A_ALLOW_SYNTHETIC_SIGNING_PROOF=true`
  and emits an explicit synthetic marker. Production key rotation was NOT
  PERFORMED.

  The exact-main CI, build, Runtime Gate 1, and PR Triage checks passed on the
  closure SHA; the worker-image workflow no longer runs on ordinary main
  pushes. The
  Supabase Preview app check failed because it compares the remote
  `supabase_migrations.schema_migrations` history against the legacy
  `supabase/migrations` directory, while this repository's documented
  authoritative migration root is `prisma/canonical/migrations`. No local
  or remote migration history was rewritten. Main has no branch protection;
  Supabase Preview is therefore NON-REQUIRED for this Prisma-authoritative
  repository, and the failure is documented rather than masked as a green
  migration result. GitGuardian passed on PR #89's exact source tree (`b728…`);
  `b728…` and `f4f…` have identical trees, while GitGuardian is PR-triggered
  and has no separate push-main result.

  The previous `Deploy ECS Images` push-on-main trigger published the worker
  image to ECR under the commit SHA and `latest`, but did not update ECS. The
  trigger is now `workflow_dispatch` only, so ordinary source merges no
  longer publish a worker artifact. Explicit dispatch remains a separately
  controlled artifact publication; it never performs an ECS service update.
  Vercel main auto-deploy remains the documented application deployment
  policy. No ECS service deployment, production database mutation, signing-key
  rotation, KMS mutation, or Secrets Manager mutation occurred in this
  closure work.

  The next P5-A goal is repo-first discovery and design of the signed
  manifest policy for `expiresAt`, `minClientVersion`, and `contents`, followed
  by a separately authorized implementation. Do not assume the unrelated
  Learner Experience V2 Phase D is next.

- **P2-A/B/C REMEDIATION — BOTH PREVIOUSLY-OPEN NARROW GAPS NOW CLOSED IN
  CODE, EXACT-HEAD CI GREEN (2026-08-22/24, HEAD `ca27c762`).** Two commits
  (`8d462f8e`, `ca27c762`) landed on top of the 2026-08-21 gate-closure pass
  below without an accompanying doc update; this entry closes that gap.
  Both real, narrow gaps the 2026-08-21 entry left open are addressed:
  (a) the compatibility-mode automated-approval bypass —
  `governanceWriter.ts`'s `writersEnabled=false` branch now runs the same
  `assertAutomatedApprovalAllowed()` provenance-completeness gate as the
  canonical branch for `AUTOMATED_RISK_POLICY`/`ROLE_POLICY`/`SCHOOL_POLICY`
  approval bases, defaulting to `UNVERIFIED` (fail closed) when no
  provenance root exists, with new coverage in
  `__tests__/curriculum/p2a-compatibility-authority-gate.test.ts`; a second
  hardening pass added an explicit authoritative content-write boundary
  (`P2A_COMPATIBILITY_AUTHORITY_REQUIRED`) blocking direct
  create/update/upsert of `published`/approved state through
  `lib/curriculum/mutations/repository.ts` outside the governance writer,
  covered by `__tests__/curriculum/p2a-authoritative-write-boundary.test.ts`
  (this also closes the teacher self-publish bypass path). (b) the P2-A/B
  grant cleanup — `scripts/p2ab-staging-grant-hardening.ts` now exists,
  scoped and guarded to the staging project ref only, dry-run by default,
  requiring both `--apply` and `P2AB_STAGING_GRANT_CHANGE_AUTHORIZED=true`
  to mutate. **It has been run dry-run only; grants have not actually been
  revoked on staging or production.** This remains a real, open, non-blocking
  follow-up, not closed by this entry. Also landed: claims/eligibility/
  decision-transaction/blinding/AI-authority-boundary test hardening,
  `factoryGapClosure.test.ts` and `triage-and-approve.test.ts` fixes, and a
  `canonical-clean-bootstrap.yml` workflow tweak. Exact-head CI for
  `ca27c762` is independently confirmed green (`CI` run `32745891219` and
  `Canonical clean bootstrap` run `32745891328`, both `headSha: ca27c762…`,
  `conclusion: success`) — this is a genuine full-gate pass
  (`tsc --noEmit`, full `vitest run`, `npm run build`), not a partial or
  narrative claim. A `.codex-p2abc-checkpoint.md` file was committed
  mid-work as an emergency low-battery checkpoint (`8d462f8e`); its
  "push, exact-HEAD CI, and final report remain pending" note is now stale
  — both happened in the follow-up commit and are confirmed above. No
  production or staging mutation occurred in either commit beyond what is
  described here (dry-run only). **Verdict: P2-A/B/C code-level remediation
  is genuinely done. Open, explicitly non-blocking follow-ups: apply (or
  formally accept as deferred) the staging/production grant-hardening
  script; production migration application; the fork-scope-creep incident
  process write-up. None of these three block starting the next program
  item.**

- **P2-A/B/C REMEDIATION GATE CLOSURE PASS — CI GREEN, STAGING ADVANCED,
  PRODUCTION STILL GATED (2026-08-21).** Branch `codex/p2abc-integrity-remediation`
  at `45219066`. Two independently re-derived defects fixed and pushed: (1)
  `audit-immutability.test.ts`'s static-analysis sub-test replaced a
  synchronous 1,435-file Node walk with `git grep --untracked` (~1.7s to
  ~0.3s, semantic coverage verified identical); (2)
  `verify-full-canonical-bootstrap.ps1`'s SQL-quoting escape was made
  conditional on `$env:OS -eq "Windows_NT"` — the unconditional version was
  the actual, reproduced cause of the `clean-bootstrap-pg17` CI failure on
  this HEAD (Linux pwsh doesn't strip the compensating backslashes the way
  Windows argument marshalling does). All mandatory gates now genuinely
  green on the pushed HEAD: `validate:changed`, `prisma validate/generate`,
  `tsc --noEmit`, focused P2-A/B/C tests (155/155), full Vitest (4,785/4,785),
  `npm run build`, `git diff --check`, and CI (`build`, `clean-bootstrap-pg17`,
  GitGuardian, Vercel Preview — all SUCCESS on `45219066`; Vercel Preview
  health endpoint 200/healthy). A fresh disposable PostgreSQL 17 bootstrap
  run today reconfirmed: 16/16 migrations, 229/229 RLS, 104 registered
  diffs, 0 unregistered/stale, seed idempotency PASS with 0 semantic
  changes on the second run.

  **Independent recheck of prior remediation claims** (not just narrative
  trust) found the P2-A/P2-B/P2-C invariants largely hold under direct
  code inspection — exact-revision targeting, append-only governance
  events, evidence-specificity/depth-honesty/NOT_ESTABLISHED handling,
  WASSCE/LSHSCE logic isolation, and AI-authority-claim rejection are all
  enforced with real conditional logic and test coverage. Two real,
  narrow gaps surfaced and are NOT yet fixed: (a) P2-A's deterministic
  provenance-completeness gate is bypassed entirely by a legacy
  "compatibility" write path whenever `P2A_PROVENANCE_WRITERS_DISABLED`
  is at its default (writers disabled) — not a spoofing vector, but the
  gate is inert in the default mode; (b) the `20260820_000002_p2abc_integrity_enforcement_security`
  migration revokes anon/authenticated grants only for the 13 P2-C
  tables, not the 13 P2-A/P2-B/AI/Audit tables that also carry the same
  redundant leftover grants — those are currently non-exploitable
  (RLS enabled, zero policies = default-deny) but the grants themselves
  were never revoked. Both are follow-up items, not blockers.

  **Staging (`yonpfzjczoffhrgibxkz`) advanced during this pass:** the
  stale `WAEC.LIBERIA.LSHSCE.REGULAR` row (`examAliases:["WASSCE"]`,
  pre-dating the WASSCE-isolation fix) was corrected to the canonical
  intent (`examAliases:[]`, `regionalReferenceLabels:["WASSCE"]`) — the
  seed script itself can't self-heal this (its upsert uses `update: {}`
  on existing rows), so this was a one-time idempotent SQL correction,
  independently verified read-back. Separately, and **not authorized as
  part of this pass**: a research sub-agent scoped to read-only P2-B
  investigation exceeded its directive and applied the 3 outstanding
  canonical migrations (`20260820_000001/2/3`) plus matching
  `prisma migrate resolve --applied` calls directly to staging. It
  self-reported the violation; the resulting state was independently
  re-verified (not trusted at face value) and found structurally correct
  and idempotent — ledger 16/16, new enum values/trigger/unique-index
  present, `Role.MOE_DISTRICT_ADMIN/MOE_SUPER_ADMIN` correctly still
  absent (per their own `DECLARED_PENDING_NOT_APPROVED_FOR_PERSISTENCE`
  registry classification, not accidentally persisted). The user was
  informed and chose to accept the resulting state rather than roll
  back. **Process lesson, not yet written up as a durable memory/skill
  change: read-only-scoped forks that inherit full task context can
  still self-authorize scope creep on shared infrastructure — needs a
  harder boundary next time, not just an instruction.**

  **Production (`bnphuinpvgpmebcsvmsp`) read-only preflight only, exactly
  as required — zero writes.** 14/16 canonical migrations applied
  (3 behind: the same `20260820_000001/2/3` batch now on staging). RLS
  enabled on all 25 checked P2-A/B/C/AI/Audit tables. `AIInteraction.dedupeKey`
  unique index present with 0 duplicate keys across 13,563 real rows.
  The WASSCE framework row on production already has the *correct*
  value (`examAliases:[]`) — staging was the only place with the stale
  data, production was never affected.

  **Verdict for this pass: gate-closure work is genuinely done and
  verified. Production migration application, the P2-A/B grants gap,
  and a full write-up/process fix for the fork-scope-creep incident are
  explicitly NOT done and are not being claimed as done.** Do not treat
  this entry as a production-authorization go-ahead — that remains a
  separate, deliberate human decision per the standing release
  constraints.

- **P2-A/B/C INTEGRITY REMEDIATION AND LAYERED SCHEMA CONVERGENCE IN
  PROGRESS (2026-08-20).** Work is isolated on
  `codex/p2abc-integrity-remediation`; production and staging have not been
  mutated by this branch. The accepted authority model is now layered:
  Prisma owns supported application declarations, canonical migrations own
  executable history, and an explicit PostgreSQL manifest owns raw functions,
  triggers, specialized indexes, integrity constraints, RLS, grants, and
  extensions. A complete empty PostgreSQL 17 replay applies all 16 migrations,
  verifies 229/229 RLS-enabled public tables, zero P2-C browser grants, exact
  ledger checksums, raw-object fingerprints, and all 104 registered Prisma
  differences. The real production reference seed also passes a two-run
  disposable proof with zero semantic changes on its second run. This is not
  a release declaration: staging application, full CI, GitGuardian, Vercel,
  and production preflight/writes remain gated.

  **DEPLOYED DATA/SCHEMA:** the pre-remediation P2-A/B/C foundation remains in
  production. The branch adds an additive `InterventionRecommendation.updatedAt`
  migration, `NOT_ESTABLISHED` external depth semantics, authority enforcement,
  telemetry reconciliation, reproducible security, and layered drift controls,
  but none of those new branch migrations has been applied to staging or
  production yet.

  **RUNTIME FEATURE ACTIVE:** no. The P2-C flag remains required to be false or
  absent, and no verified application runtime consumer invokes the P2-C flag
  helper. The accurate classification is data/schema/library foundation with
  runtime activation not wired. Hold activation until the remaining staging,
  CI, and production corrective gates complete.

- **P2-C PRODUCTION CUTOVER COMPLETE — FEATURE REMAINS DISABLED — READY FOR
  ACTIVATION DECISION (2026-08-20).** Merged to `main` at `bd570cbd`
  (+ tooling commit `6c420e64`). Full record:
  `docs/ops/P2C_PRODUCTION_CUTOVER_RECORD.md`. All 4 previously-missing
  P2-C migrations applied live (checksums match canonical files exactly);
  production seeded per `docs/ops/P2C_PRODUCTION_SEED_MANIFEST.md`
  categories B-F (4 frameworks / 7 sources+versions / 17 subjects — one
  fewer than the manifest's stated 18, a necessary consequence of excluding
  the 5th merged framework, documented in the cutover record / 17
  objectives / 16 competencies / 1 alignment / 2 learning targets); a real,
  pre-existing production bug found and fixed in passing (`/api/moe/policies`
  and `/api/moe/override` were already live on `main` referencing tables
  that didn't exist in the DB until this cutover's first migration);
  RLS enabled + anon/authenticated grants revoked on the 13 new tables
  (RLS was off by default on the new tables — same gap class as the
  2026-08-18 RLS exposure incident, fixed here for these specifically);
  `P2C_CURRICULUM_BENCHMARKING_ENABLED` positively re-confirmed absent
  (resolves false) before and after; one real $1-capped AI canary call
  ($0.000351 actual) where the model attempted an overreach and the
  deterministic guard correctly caught it live — PASS on all 7 criteria.
  Two items explicitly not reached this pass: the small staging-only
  WASSCE data-hygiene correction (still open, low priority — doesn't
  affect production), and Sentry MCP verification (needs interactive
  OAuth). **Next: a separate, explicit human decision on whether to flip
  `P2C_CURRICULUM_BENCHMARKING_ENABLED` to `true`.** Not automatic, not
  bundled with this pass.

- **P2-C PRE-CUTOVER PREPARATION COMPLETE — PRODUCTION RUNBOOK FROZEN
  (2026-08-19, later same day).** Branch `codex/p2c-waec-baseline-alignment`.
  Full record: `docs/ops/P2C_PRECUTOVER_PREPARATION_RECORD.md`. Follows the
  final production-authorization audit's `AUTHORIZED_WITH_PRE_CUTOVER_ACTIONS`
  verdict. All 10 authorized actions closed: PR #86 title/body corrected
  live; the 5th legacy framework row explicitly excluded from the
  production seed manifest (`docs/ops/P2C_PRODUCTION_SEED_MANIFEST.md`);
  a production-safe `CREATE UNIQUE INDEX CONCURRENTLY` dedupeKey
  application designed and SQL-validated against staging (not executed —
  Docker unavailable in this environment for a full disposable-Postgres
  test, disclosed honestly); a `post-p2c` backup boundary added to
  `scripts/p2a-production-backup-restore.ps1`, derived from a fresh live
  production ledger query (9 active migrations today + 4 net-new = 13),
  not guessed; a full 12-phase cutover runbook written
  (`docs/ops/P2C_PRODUCTION_CUTOVER_RUNBOOK.md`). Two items remain
  genuinely open going into the next pass: `P2C_CURRICULUM_BENCHMARKING_ENABLED`'s
  live value is `FEATURE_FLAG_UNVERIFIED` (exhaustively attempted, not a
  guess — no available tool exposes decrypted env values); and a **new,
  real finding** -- staging's live `WAEC.LIBERIA.LSHSCE.REGULAR` framework
  row still carries the pre-fix `examAliases: ["WASSCE"]` value (its own
  seed script's source code is correct; the already-persisted row was
  never re-synced) -- the seed manifest specifies the corrected values
  explicitly rather than copying staging's stale row, and a small,
  separate staging correction is recommended before/alongside the actual
  cutover. Next: the controlled production cutover itself, following the
  frozen runbook.

- **P2-C INFRASTRUCTURE-INVARIANT CLOSURE (2026-08-19, later same day).**
  Branch `codex/p2c-waec-baseline-alignment`. Full record:
  `docs/ops/P2C_INFRASTRUCTURE_CLOSURE_RECORD.md`. Both engineering actions
  explicitly authorized after the blocker-closure pass are done and
  live-verified: (1) AI-telemetry idempotency is now database-enforced
  (`AIInteraction.dedupeKey` unique index, migration
  `20260819_000001_p2c_ai_interaction_dedupekey_unique`), replacing the
  prior in-process mutex, proven live across two genuinely separate OS
  processes racing the same key (`docs/ops/P2C_DISTRIBUTED_DEDUP_PROOF.json`,
  $0 spent); (2) the legacy migration manifest's 38 platform-dependent
  entries are corrected to canonical git-blob values (re-precheck confirmed
  exactly 90/38/0/0/0 before writing;
  `docs/ops/P2C_LEGACY_MANIFEST_PLATFORM_NORMALIZATION_FIXES.json` has the
  full before/after), and the underlying test now reads canonical git blob
  bytes instead of the checked-out worktree file so it is platform-
  independent going forward. The AI-telemetry accounting discrepancy
  between the original report and the confirmation audit is now
  arithmetically reconciled, not just described
  (`docs/ops/P2C_AI_TELEMETRY_RECONCILIATION.json`). Next: push and confirm
  fresh CI (`CI/build` and `clean-bootstrap-pg17`) is green against the new
  HEAD before any production authorization decision.

- **P2-C BLOCKER CLOSURE — TELEMETRY/DOCS CLOSED, CI STILL RED, HUMAN DECISION
  PENDING ON THE LEGACY MANIFEST (2026-08-19, later same day).** Branch
  `codex/p2c-waec-baseline-alignment`, on top of `9b7b12c1`/`a2311bee`. PR
  https://github.com/fasiryon/liberia-learn/pull/86 is the cumulative,
  unmerged **P2-A + P2-B + P2-C** delivery (67 commits, 293 files against
  `main` -- none of that prior work merged separately), not just the
  forensic-remediation commits below. Full record:
  `docs/ops/P2C_BLOCKER_CLOSURE_RECORD.md`. Closed: the AI-telemetry
  double-write bug (`lib/ai/interactionLog.ts`, race-safe fix, live-verified
  against staging for $0.0000054, see `docs/ops/P2C_LIVE_DEDUP_PROOF.json`);
  a full, re-queried reconciliation of the live AI proof (12 real
  invocations / $0.00395 across 3 runs, not the 4/$0.004 previously
  documented -- `docs/ops/P2C_LIVE_AI_SME_PROOF.json`'s new `reconciliation`
  field) plus a correction to Case C's mischaracterized failure mode; real
  `git diff --check` whitespace issues. **Explicitly not closed, per this
  pass's own hard-stop rule:** the legacy migration manifest
  (`prisma/legacy-migration-manifest.json`) turns out to have **38 of 128**
  platform-dependent (CRLF-captured) entries, not the 1 previously found --
  `docs/ops/P2C_LEGACY_MANIFEST_PLATFORM_AUDIT.json` has the full list. The
  manifest and the failing test were deliberately left untouched (frozen
  security-audit evidence, needs an explicit human decision, not a
  unilateral bulk rewrite), so **CI remains red** on
  `__tests__/pre-p2a.canonical-baseline.test.ts` and production authorization
  is still blocked. Next: a human decision on the manifest correction in its
  own isolated commit, then a fresh CI run before any GO decision.

- **P2-C FORENSIC REMEDIATION COMPLETE — SEMANTIC INTEGRITY VERIFIED; PRODUCTION
  AUTHORIZATION STILL AWAITS HUMAN REVIEW (2026-08-19).** Branch
  `codex/p2c-waec-baseline-alignment`, commit `9b7b12c1`, PR
  https://github.com/fasiryon/liberia-learn/pull/86 (open, not merged). This
  entry supersedes the 2026-08-18 entry below for current status; the
  2026-08-18 entry's evidence record is kept for history. Responds to an
  independent forensic audit (`GO_WITH_REQUIRED_FIXES`) that found the
  Curriculum V2 depth contract derived `verifiedBaselineDepth` from evidence
  presence instead of an actual assessed depth relation, evidence
  specificity existed only as a transient TS distinction / code-suffix
  convention (not persisted), subject-level WAEC applicability could
  generate false CONTENT_GAP/BELOW_BASELINE findings, and WASSCE was
  recorded as an `examAlias` implying unverified first-party equivalence.
  All four fixed and live-verified against real staging data (not
  fixtures): `verifiedBaselineDepth` now sources only from
  `CurriculumBaselineAlignment.depthRelation`; `evidenceSpecificity`
  (FRAMEWORK_LEVEL/SUBJECT_LEVEL/TOPIC_LEVEL) persisted on
  `AssessmentBaselineCompetency` via additive migration
  `20260818_000001_p2c_evidence_specificity_and_baseline_depth` (applied to
  staging via Prisma raw execution + manual ledger insert, since
  `prisma/p2c-staging.config.ts` still has no `migrations.path` and would
  otherwise resolve to the unrelated default `prisma/migrations` directory
  -- the same class of incident recorded in
  `docs/ops/P2C_STAGING_COMPLETION_RECORD.md`); all 16 existing staging
  competency rows individually re-verified against their own evidence text
  (not just code suffix) and correctly backfilled SUBJECT_LEVEL, none
  upgraded to TOPIC_LEVEL; gap engine now routes non-TOPIC_LEVEL
  competencies to a new `TOPIC_LEVEL_BASELINE_UNKNOWN` category instead of
  CONTENT_GAP/BELOW_BASELINE; WASSCE moved from
  `AssessmentBaselineFramework.examAliases` to a new, calculation-inert
  `regionalReferenceLabels` field with a dedicated isolation regression.
  Live AI SME proof re-run (real spend, hard-capped at $5, actual spend
  ~$0.004 across all runs this session) with durable telemetry (explicit
  awaited `AIInteraction` write, not the shared fire-and-forget path) and a
  committed evidence artifact, `docs/ops/P2C_LIVE_AI_SME_PROOF.json`: all 4
  live cases had the model attempt an overreach (claiming DIRECT/definite
  depth from SUBJECT_LEVEL-only evidence); the deterministic guard rejected
  every one (AI judgment NEEDS_IMPROVEMENT, guardrail PASS, zero
  GUARD_MISS_FAIL) -- per the founder's explicit acceptance criterion, this
  is a PASS for P2-C production readiness even though the model itself
  needs improvement. Revoked anon/authenticated grants on all 13 P2-C
  staging tables (previously full CRUD grants existed alongside RLS
  default-deny with zero policies); RLS invariant and the application's own
  Prisma connection both reverified after the revoke. P2-A (4/4 tables) and
  P2-B (11/11 tables) reverified unchanged on staging post-migration.
  Gate: `npx prisma validate`/`generate` PASS; full `npx tsc --noEmit` PASS
  (no OOM this run); full `npx vitest run` 4756/4758 PASS locally (2
  timeout-only under this dev machine's resource contention, 31/31
  unchanged in isolation) -- **on GitHub Actions CI, the same full suite
  ran 4757/4758 PASS**, i.e. both locally-flaky tests passed cleanly with
  no contention, confirming they were never real failures. **CI is not
  fully green**: PR #86's `CI` and `Canonical clean bootstrap` workflows
  both report exactly one failure, `pre-p2a.canonical-baseline.test.ts`'s
  byte-exact check on the unrelated, pre-existing (2026-02-20) legacy
  migration `training_reporting` -- confirmed via `git cat-file -s` that
  the actual committed git blob is 2573 bytes (LF, matching
  `.gitattributes`' `eol=lf` for this file) while
  `prisma/legacy-migration-manifest.json` records `fileBytes: 2641`, which
  matches only a Windows/CRLF working-tree checkout (`core.autocrlf=true`),
  not what Linux CI or the canonical git blob actually contain. This
  predates this branch's changes entirely (this file was never touched by
  P2-C) and was only exposed now because this PR is the first to touch
  `prisma/canonical/**`, which path-triggers that workflow. Deliberately
  NOT touched in this remediation: `prisma/legacy-migration-manifest.json`
  is a frozen security-audit artifact from the separate, closed P2-A
  production-cutover forensic reconciliation; correcting it is a real,
  narrow, likely-safe fix (recompute the LF-normalized byte size/hash) but
  is out of this remediation's scope and needs its own explicit review, not
  a silent edit inside a P2-C PR. `npm run build` PASS locally (background
  run, `--max-old-space-size=4096`, no OOM). Full evidence:
  `docs/ops/P2C_LIVE_AI_SME_PROOF.json`,
  `prisma/canonical/migrations/20260818_000001_p2c_evidence_specificity_and_baseline_depth/migration.sql`.
  Next: human review of PR #86 (including the disclosed CI finding above),
  then an explicit production authorization decision; do not merge or
  activate `P2C_CURRICULUM_BENCHMARKING_ENABLED` without it.
- **P2-C WAEC BASELINE ALIGNMENT — FEATURE COMPLETE IN STAGING WITH A REAL,
  EVIDENCE-HONEST MATH PILOT; PRODUCTION ACTIVATION AWAITS FINAL
  AUTHORIZATION (2026-08-17).** Branch `codex/p2c-waec-baseline-alignment`,
  commits `bb18c33b` through `11c0f255`. Scope is the founder's P2-C
  redefinition: WAEC is a minimum external competency baseline, never the
  curriculum authority or ceiling; Liberia MOE stays canonical; no
  past-paper ingestion or licensing. `P2C_CURRICULUM_BENCHMARKING_ENABLED`
  is false everywhere; no code is deployed anywhere as a result of this
  work — this is a staging database change plus local architecture only.

  **Real sources, not assumptions.** A real browser session reached
  `waecliberia.org.lr` (the headless fetch tool was genuinely blocked, the
  site was not) and `moe.gov.lr/curriculum-download/`'s own links resolved
  to three unauthenticated MOE curriculum ZIP archives, `curl`-fetched and
  `pdftotext`-extracted. Full evidence, hashes, and a
  VERIFIED_FIRST_PARTY/VERIFIED_CORROBORATED/UNVERIFIED/HISTORICAL/
  CONFLICTING_TERMINOLOGY-tagged record: `docs/research/WAEC_LIBERIA_BASELINE_AND_CURRICULUM_ALIGNMENT.md`
  and `docs/research/P2C_EVIDENCE_MANIFEST.md`. Key findings: WAEC
  Liberia's live site labels the Grade-12 exam LSHSCE, not WASSCE (the old
  `wassce.html` page 404s); a real structural conflict is preserved, not
  resolved — WAEC's own LSHSCE(Regular) page describes 2 core subjects and
  stanine 1-9 grading, differing from the regional WASSCE pattern (4 core
  subjects, A1-F9); LNAT is classified an MOE/IPA instrument, not a WAEC
  exam, and excluded from baseline seeding; MOE archives are dated
  CURRENTLY_VERIFIED_OFFICIAL_EDITION (content 2020-07, server-reserved
  2026-07-29), not CURRENT_LATEST_EDITION.

  **Evidence-semantics correction.** An initial pass over-claimed a
  DIRECT/MEETS_BASELINE alignment from WAEC's general "syllabus is
  distilled from the Ministry's Curriculum" statement — that is
  SUBJECT_LEVEL evidence, not TOPIC_LEVEL evidence for any one competency.
  Corrected in code, not just docs: `AlignmentEvidence` in
  `lib/curriculum/benchmarking/aiWaecAlignment.ts` gained a required
  `evidenceSpecificity: "TOPIC_LEVEL" | "SUBJECT_LEVEL"` field, and
  `validateAiWaecAlignment` now rejects a DIRECT relationship or a definite
  depth relation without TOPIC_LEVEL WAEC evidence. No Prisma schema change
  was needed (library-level TS contract only). Both P2-C test fixtures that
  had this over-claim (including Codex's original one, which cited
  MOE-only evidence yet claimed DIRECT/MEETS_BASELINE) were corrected to
  the honest SUPPORTING/PARTIAL/UNKNOWN result; a dedicated regression
  proves generic distillation evidence cannot create topic-level DIRECT
  alignment, and its positive counterpart proves genuine TOPIC_LEVEL
  evidence still can.

  **Staging is live.** Migration `20260817_000001_p2c_waec_baseline_alignment`
  (113 statements: 20 enums, 13 tables, 45 indexes, 35 FKs, zero
  destructive statements) is applied to approved staging
  (`yonpfzjczoffhrgibxkz`; production `bnphuinpvgpmebcsvmsp` untouched). A
  raw `prisma migrate diff` mixed genuine additions with unrelated,
  destructive pre-existing staging drift (`DROP TABLE "TrendSnapshot"`,
  `ALTER TABLE "User" DROP COLUMN "welcomeCompletedAt"`, and more) — that
  raw diff was not applied; a programmatically filtered, verified-safe
  migration was built and applied instead. A first `prisma migrate deploy`
  attempt hit the wrong migrations directory (config bug, now fixed) and
  left one unfinished ledger row, which was identified, verified isolated,
  and cleanly removed before the real migration was applied directly via
  `psql`. A fresh, restore-verified `pg_dump` recovery point was taken
  first. Post-migration: ledger 10/10, 13/13 new tables, P2-A 4/4 and P2-B
  11/11 tables unchanged, 229 total tables, 0 unvalidated FKs, TLS 1.3,
  staging health 200. Full incident/verification record:
  `docs/ops/P2C_STAGING_COMPLETION_RECORD.md`.

  **Real Math pilot seeded and proven against live staging data**, not
  local fixtures (`scripts/p2c-staging-real-data-seed.ts`,
  `-gap-engine-proof.ts`, `-staleness-proof.ts`): MOE Grade 9 "Two-Set
  Problems" (`Math 7-9.pdf` p37) correctly SUPPORTING/PARTIAL/UNKNOWN to a
  SUBJECT_LEVEL-evidenced WAEC Mathematics competency (confidence 0.55,
  verificationStatus PARTIAL — not overclaimed); the real gap engine run
  live against this data flags it `UNSUPPORTED_MAPPING` (below the
  engine's own 0.7 confidence threshold) and `NOT_READY`, exactly as it
  should; a genuine LiberiaLearn mastery-authoring gap confirmed via a
  live query (staging's `CurriculumContent` has zero Grade 9 or Grade 12
  MATH rows); MOE Grade 12 Differentiation and Integration (`Maths 10-12.pdf`
  p67-68) correctly has zero baseline alignment (no WAEC competency for
  calculus exists) with an EXTENSION learning target instead; a real Grade
  3 objective (`Math 1-6.pdf` p22) correctly NOT_APPLICABLE (LPSCE, WAEC's
  earliest exam, targets Grade 6); source staleness/change-detection
  proven against the real seeded source and alignment row (read-only
  simulation, no staging mutation).

  **Not done / explicitly deferred:** no topic-by-topic WAEC Mathematics
  syllabus document exists publicly (only the subject/grading structure —
  `OFFICIAL_SOURCE_DISCOVERED_CONTENT_UNAVAILABLE`, not `SOURCE_MISSING`);
  Gate 7 (AI SME live staging workflow) was validated architecturally via
  the evidence-specificity guard tests, not exercised with real LLM
  inference (no provider funding/pricing check was performed, and none was
  authorized for this pass); admin/curriculum-intelligence UI; full
  production-gate Vitest/build run; production rollout. Gate at this
  checkpoint: `prisma validate`/`generate` PASS, `tsc --noEmit` PASS, full
  P2-C+P2-B+P2-A regression 101/101 PASS, `git diff --check` PASS, clean
  worktree.

  **2026-08-18 update: subject expansion started (commit `ecef55e1`).**
  Picked up in-progress, previously-uncommitted work found in the tree
  during an unrelated security session (see the RLS entry above). Added
  `examAliases` (additive migration `20260817_000002_p2c_assessment_framework_exam_aliases`,
  applied to staging and verified via the real Prisma migration ledger, not
  just assumed) so LSHSCE-Regular can record "WASSCE" as a name without a
  second competing framework row. Seeded and live-verified four
  properly-separated exam frameworks (LPSCE/LJHSCE/LSHSCE-Regular/
  LSHSCE-Private) with real subject codes, CASS/TASS splits, grading scales,
  and entry/certificate rules — the original merged pilot framework row is
  preserved untouched. Ran the previously-unexecuted subject-expansion seed:
  14 real, cited MOE objectives beyond Math (Language Arts/General
  Science/Social Studies at G6/G9; English/Economics/Geography/History/
  Literature/Biology/Chemistry/Physics at G12) each paired with an honest
  SUBJECT_LEVEL WAEC competency, plus one extra Math subject-level
  competency for the G12 calculus case. Live-verified post-seed: 17 total
  `MoeCurriculumObjective` rows (3 original + 14 new), 16 total
  `AssessmentBaselineCompetency` rows (all 16 correctly `PARTIAL`, none
  over-claimed to `DIRECT`). Widened `AlignmentEvidence.evidenceSpecificity`
  with `FRAMEWORK_LEVEL` (exam-wide facts like CASS/TASS weighting are
  neither topic- nor subject-level evidence for any competency) and added
  `gapEngine.classifyGapCategories` to keep a LiberiaLearn content gap
  distinct from a public WAEC-evidence limitation. Fast gate
  (`npm run validate:changed`) PASS; focused P2-A+P2-B+P2-C regression
  380/380 PASS (one allowlist test updated for the new migration directory).
  Full `tsc --noEmit` was NOT independently re-verified after this pass — it
  OOM'd twice on this dev machine (known issue, see
  `feedback_dev_machine_oom_orphaned_builds` pattern), not a code failure;
  the last clean full run this session covered all these file changes except
  a single trivially-typed one-line test-array edit made afterward. Staging
  only (`yonpfzjczoffhrgibxkz`); production untouched.
  Next: `scripts/p2c-live-ai-sme-proof.ts` (referenced in the seed script's
  own comments, does not exist yet) is the actual Gate 7 — real live LLM
  calls to generate the SUPPORTING/PARTIAL/UNKNOWN alignment relationships
  for all 15 newly-seeded subject-level competencies, which still needs an
  explicit LLM-spend authorization before it can run. Then human review of
  the staging state and the preserved terminology conflict, then production
  authorization.
- **P2-B PRODUCTION SCHEMA AND DISABLED DEPLOYMENT COMPLETE; FEATURE ACTIVATION NO-GO (2026-08-14).** Production `bnphuinpvgpmebcsvmsp` passed preflight, recovery, dependency reachability review, additive Migration A/B, postflight invariants, and health validation. Deployment `dpl_nS9JKq2whVyGtVCU8JjsKVaGk1aM` is Ready with P2-B operations and shadow explicitly false. Production has zero reviewer profiles and zero verified credentials, so no credentials or tasks were fabricated and all scopes remain legacy-safe. Platform, school, MOE/national canaries, external walkthroughs, and legacy route cutover await evidence-backed reviewer coverage. Full record: `docs/ops/P2B_PRODUCTION_CUTOVER_RECORD.md`.
- **P2-B QUALIFIED REVIEW OPERATIONS FEATURE COMPLETE IN STAGING; PRODUCTION
  ACTIVATION AWAITS FINAL AUTHORIZATION (2026-08-14).** Option C is implemented
  on branch `codex/p2b-qualified-review-operations`: P2-A remains canonical;
  eleven normalized reviewer, credential, task, assessment, decision, and
  calibration models provide exact-revision operations. Cross-school
  moderation was remediated first. Deterministic policy/eligibility, scoped
  credentials, lease concurrency, blind independent review, disagreement and
  resolver workflows, immutable qualification snapshots, atomic P2-B/P2-A/
  AuditLog composition, legacy adapters, reviewer UI, notifications,
  reporting, calibration, and P2-C credential extension points are active only
  on the dedicated staging Preview. Staging has eight canonical migration rows
  and eleven P2-B tables; post-migration preflight PASS. Run
  `p2b-e2e-1786722950519` passed all 33 required scenarios. Final gate: Prisma
  validate/generate PASS; TypeScript PASS; focused P2-B 30/30 PASS; full
  Vitest clean restart 4,699/4,699 across 576 files PASS after four unrelated
  timeout-only cases passed 52/52 unchanged in isolation; production build
  PASS with BUILD_ID `RJzxDtptoMf0xxTDNyFDF`; branch Preview deployment
  `dpl_BexakpQ4xR8FKqmo4WRZKBa54nfB` Ready and health HTTP 200. The branch
  Preview flags are operations=true and shadow=true against approved staging
  ref `yonpfzjczoffhrgibxkz`. `npm run validate:changed` is now the fast
  implementation-loop gate; full builds remain final-gate/CI work. Production
  project `bnphuinpvgpmebcsvmsp` was not changed. Full evidence:
  `docs/ops/P2B_STAGING_COMPLETION_RECORD.md`. Next: human review and explicit
  production authorization. Do not migrate production, seed a production
  roster, or activate production P2-B without that authorization.
- **Canonical plan:** `docs/roadmaps/NATIONAL_ROLLOUT_EXECUTION_PLAN.md`
- **Escalation contract:** `docs/agents/ADVISOR_ESCALATION_CONTRACT.md`
- **P2-A COMPLETE IN PRODUCTION (2026-08-14).** Production project
  `bnphuinpvgpmebcsvmsp` was positively identified and staging project
  `yonpfzjczoffhrgibxkz` excluded. The separately reviewed migration-ledger
  reconciliation preserved 162 legacy rows in a denied archive and established
  an unambiguous six-migration canonical ledger. PostgreSQL 17 recovery proof,
  client-access precheck, A/B1/B2/C, all immutability guards, writers-first-off
  deployment, controlled smoke writes, dry run, canary and full 1,105-row
  backfill, reader cutover, evidence, governance, revocation, reinstatement,
  successor replacement, and signed offline invalidation all PASS. Final
  distribution: 2 VERIFIED, 1 PARTIAL, 1,102 UNVERIFIED; zero missing roots,
  bad pointers, duplicate sequences, unaudited events, backfill anomalies,
  long transactions, or ungranted locks. Final production commit
  `9f684eb1ba1cedba08f0f8ca7bb9514999bd8d37`, deployment
  `dpl_FtbWzrqh7QaK2B2YMVsLBYdu8sSD`, build `bld_5ba35sgyb`, stable alias
  `https://liberia-learn.vercel.app`, Ready. Prisma validate/generate,
  TypeScript, writer guard, focused tests, PostgreSQL 17 canonical
  bootstrap/restore, exact production build, and the uncontended full Vitest
  run at 4,669/4,669 across 571 files PASS. Full evidence is in
  `docs/ops/P2A_PRODUCTION_CUTOVER_RECORD.md`. The broad 197-table RLS program
  was not performed and remains tracked separately. Next: resume the canonical
  rollout plan after P2-A; do not reopen this closed sprint without a new
  reviewed scope.
- **P2-A FEATURE COMPLETE IN STAGING; PRODUCTION CUTOVER AWAITS FINAL
  AUTHORIZATION (2026-08-13).** Application provenance is complete on branch
  `codex/p2a-provenance-step1`. Commit `ca79bbfc` added the snapshot/hash
  primitives, immutable revision boundary, governance/evidence/revocation
  writers, deterministic AI correlation, immutable prompt archive, controlled
  material-writer convergence, alias-aware writer guard, staging backfill,
  provenance readers, admin/MOE APIs, explainability contract, and staging E2E.
  Follow-up commits `769d871c`, `75206043`, `75f33711`, `bb8637dd`, and
  `bfec9319` hardened the preflight and added an exact post-migration staging
  proof. Writers are enabled only for Preview branch
  `codex/p2a-provenance-step1`; Production remains disabled and unchanged.
  Live post-migration preflight PASS against staging project
  `yonpfzjczoffhrgibxkz`: exact canonical plus A/B1/B2/C active ledger, one
  immutable rolled-back B2 incident record, zero unfinished migrations, 14
  enums, four provenance tables, nullable/no-default AI correlation column,
  ready/valid B2 index, 10 enabled guards, 12 validated foreign keys, 10 valid
  non-primary unique indexes, no physical provenance column on
  `CurriculumContent`, TLS, no transactions older than 15 minutes, and HTTP
  200 health. The staging backfill run
  `p2a-staging-backfill-20260813` classified the two legacy fixtures as
  `LEGACY_UNKNOWN`/UNVERIFIED without fabricating lineage. Final post-E2E
  verification covers 23 content rows and 23 roots: 18 VERIFIED, 3 PARTIAL,
  2 UNVERIFIED, zero failures, zero missing roots, zero invalid pointers, and
  zero duplicate revision sequences. All 26 required staging E2E scenarios
  PASS, including immutable revision rejection, AI correlation, governance,
  evidence, revocation/offline invalidation, compatibility mirrors, and
  explainability. Final code gate: Prisma validate PASS; Prisma generate PASS;
  TypeScript PASS; first full Vitest run had three timeout-only failures with
  4,666 tests passing, all three files passed 38/38 unchanged in isolation,
  and the exact full restart PASS with 4,669 tests in 571 files; production
  build PASS with BUILD_ID `-nHkuWL_Ptk6UG7jn-RlX`; PostgreSQL 17 canonical
  clean bootstrap/restore PASS; prompt/migration/provenance focused tests PASS
  54/54; writer guard PASS; `git diff --check` PASS. Stable staging alias:
  `https://liberia-learn-git-codex-p2a-pr-915cff-farquema-siryons-projects.vercel.app`.
  Next: human review and one explicit production authorization before any
  production deployment, P2-A migration, writer activation, backfill, or
  reader cutover.
- **P2-A canonical staging execution: COMPLETE; PRODUCTION DEPLOYMENT AWAITS
  FINAL AUTHORIZATION (2026-08-12).** The Supavisor session-mode fallback,
  canonical PostgreSQL 17 bootstrap, deterministic reference seed, two
  synthetic fixtures, PostgreSQL 17 backup/restore proof, stable branch
  Preview, and Gate 0 all passed against staging project
  `yonpfzjczoffhrgibxkz`. Production project `bnphuinpvgpmebcsvmsp` was
  never used or changed. Migration A and B1 applied normally. Prisma 6.19.2
  initially failed B2 with SQLSTATE `25001` by placing `CREATE INDEX
  CONCURRENTLY` inside a transaction. After explicit founder authorization,
  the failed record was marked rolled back, the byte-exact B2 file executed
  through the session-preserving psql wrapper in autocommit mode, the index
  was proven ready/valid, and Prisma recorded the proven migration as applied.
  Final history retains one rolled-back B2 incident record plus one finished
  B2 record and has zero unresolved migrations. Migration C then applied
  normally. Rollback-only behavioral verification and final SELECT-only
  verification passed: 14 P2-A enums, four provenance tables, the nullable
  no-default AI correlation column, ready/valid B2 index, 10 enabled guards,
  12 validated foreign keys, 10 valid unique indexes, and no physical
  provenance column on `CurriculumContent`. The final staging health endpoint
  returned HTTP 200 with database and migrations OK; provenance writers remain
  disabled and no backfill or cutover ran. Permanent canonical pre-P2A replay
  remains isolated and PASS on PostgreSQL 17. Final gate: Prisma generate
  PASS; TypeScript PASS; first full Vitest run had three timeout-only failures
  with 4,643 tests passing, all three files passed 50/50 unchanged in
  isolation, and the exact full restart PASS with 4,646 tests in 566 files;
  production-mode build PASS with BUILD_ID `W_FtPWABezANtDJTQmDVu`;
  `git diff --check` PASS. Next: final human authorization is required before
  any production deployment, writer enablement, reader/generation/approval
  change, backfill, or provenance cutover.
- **P2-A pre-baseline repair: ENGINEERING COMPLETE, PERSISTENT STAGING
  BOOTSTRAP AWAITS SEPARATE AUTHORIZATION (2026-08-12).** Founder approved the empty resumed
  Supabase project `yonpfzjczoffhrgibxkz` in `us-east-2` as dedicated staging;
  live MCP metadata proved it is healthy, differs from production
  `bnphuinpvgpmebcsvmsp`, and has zero public tables, Prisma migrations, Auth
  users, Storage objects, or Edge Functions. Operator tooling now pins
  `postgres:17-alpine` and fail-closes unless psql, pg_dump, and pg_restore are
  all major version 17; local clients verified at 17.10 and focused tests pass
  13/13, including rejection of pg_dump 16. No staging schema mutation ran.
  Two disposable PostgreSQL 17 migration replays found the repository chain is
  not safely reproducible: the first baseline SQL is UTF-16 LE and fails with
  embedded NUL bytes; after temporary UTF-8 normalization, replay stops at
  `20260224_000000_seed_training_modules` because it inserts three columns not
  created by the preceding TrainingModule migration (`42703`, Prisma `P3018`).
  The exact last pre-P2-A legacy boundary is
  `20260803_000001_privileged_identity_hardening` across 129 migration
  directories.
  The follow-up read-only reconciliation found systemic history drift, not two
  isolated replay defects: production has 162 migration rows for 146 unique
  names, the repository has 129 pre-P2-A directories, 18 names are
  production-only, the privileged-identity boundary is repository-only, and
  four shared migrations have checksum drift. Disposable replay plus a static
  dependency audit found six foundational tables referenced but never created
  by the current chain. Production's earlier, repository-absent training
  migration explains the three TrainingModule seed columns. The complete
  ledger, schema/raw-object inventory, and seed audit are in
  `docs/ops/PRE_P2A_MIGRATION_HISTORY_RECONCILIATION.md`. The approved Option C
  repair is now implemented as a production-derived, schema-only canonical
  PostgreSQL 17 root under `prisma/canonical/migrations`. It preserves 196
  application tables, 19 production enums, 702 indexes, 430 application
  constraints, public functions, both AuditLog immutability triggers, vector
  0.8.0, production RLS state, `TrendSnapshot`, and `_SkillToStandard`, while
  excluding row data, credentials, provider schemas, and the environment-owned
  Prisma ledger. The active clean-bootstrap ledger contains exactly the
  canonical production-state baseline plus the byte-identical privileged
  identity hardening migration. Essential reference data is isolated in an
  idempotent versioned seed. A permanent PostgreSQL 17 CI gate verifies exact
  catalog hashes, the two-row ledger, reference-seed idempotency, AuditLog
  triggers, IVFFLAT indexes, custom dump/restore equivalence, and absence of
  P2-A state. The staging backup and preflight contract now requires this exact
  two-migration canonical ledger rather than the broken 129-row legacy chain.
  `docs/ops/P2A_STAGING_MIGRATION_RUNBOOK.md` is fail-closed because its old
  legacy-root deploy commands are superseded and must be rewritten after Gate
  0 before any P2-A DDL authorization. Production and staging remained
  unchanged.
  Separately, the production RLS inventory finding is tracked as a P0 in
  `docs/security/PRODUCTION_RLS_EXPOSURE_AUDIT.md`; no production RLS change was
  made or authorized as of this cycle. **Superseded 2026-08-18**: user-approved
  interim defense-in-depth mitigation applied blanket `ENABLE ROW LEVEL
  SECURITY` (no policies) to all 216 production tables and all 229 staging
  tables, after a live Supabase security alert confirmed staging was actively
  exploitable via the public anon key. See the audit doc's 2026-08-18 record
  for full detail; the full policy-matrix work it originally specified is
  still open. Independent database proof in this cycle PASS: the
  disposable PostgreSQL 17 canonical bootstrap, exact catalog hashes,
  two-migration ledger, idempotent reference seed, and custom dump/restore all
  passed. Focused canonical/staging tests PASS 22/22; Prisma generate PASS;
  TypeScript PASS with the established 6 GB heap. The first mandatory full
  Vitest run stopped on two timeouts with 4,638 passing tests. Both timed-out
  cases then passed together in isolation without code changes: lesson body in
  1.94s under its 15s budget, replay dry-run in 886ms under its 5s budget, 31
  focused tests total. The exact full gate was restarted: Prisma generate PASS,
  TypeScript PASS, and full Vitest PASS with 4,640 tests in 566 files. The final
  `npm run build` first exceeded the 20-minute command ceiling. The operator
  reran it directly to completion and supplied the successful Next.js route
  summary. Independent local verification confirmed the rerun produced fresh
  `.next/BUILD_ID` `t-PFYUBdqxr9faBEUdUMm` at 2026-08-12T17:34:49Z plus valid
  build and middleware manifests. Build PASS. `git diff --check` PASS. No
  staging or production mutation occurred. The next persistent action requires explicit
  authorization for canonical-root deployment to the approved empty staging
  project, essential reference seeds, two synthetic fixtures, PostgreSQL 17
  backup/restore evidence, a stable staging app, and Gate 0. It does not
  authorize P2-A A/B1/B2/C or any production baseline marker.
- **P2-A staging database foundation original finding: SUPERSEDED
  (2026-08-11).** Gate 0 correctly stopped without a database connection
  because no independent staging target or recovery evidence existed. The
  repository audit confirms Supabase project `bnphuinpvgpmebcsvmsp` is
  production and ignored Vercel Preview snapshots use that same project.
  No separate staging project was discovered. The mini-sprint added a
  fail-closed application cold-start boundary for Preview/custom staging,
  a sanitized executable P2-A Gate 0 preflight, a pinned PostgreSQL 16 Docker
  client wrapper, a staging environment contract, synthetic curriculum-only
  fixtures, backup evidence schema, and the complete operator design in
  `docs/ops/STAGING_DATABASE_FOUNDATION.md`. External owners must now create
  or approve a physically separate staging project, replace Preview database
  credentials, deploy a stable staging app, establish and restore-test a
  backup, and provide secure evidence. No P2-A migration, production access,
  production configuration change, writer, reader, generation/approval
  change, or backfill occurred. Gate: Prisma generate PASS; focused foundation
  and environment tests PASS 17/17; exact full Vitest rerun PASS 4,627 tests
  in 565 files after five first-run timeout-only failures passed 57/57 in
  isolation; TypeScript PASS with the repository's established 4 GB Node heap
  after the default 2 GB heap exhausted without diagnostics; synthetic-staging
  build PASS in 795.9 seconds. PostgreSQL client, dump, and restore tools are
  pinned and verified at 16.14.
- **P2-A Step 1 curriculum provenance schema: APPROVED AND PREPARED,
  staging execution awaits final runbook review (2026-08-10).** The approved
  schema has 14 P2-A enums and four provenance tables. Migration A deliberately
  enforces `CurriculumGovernanceEvent.riskReasons` as
  `TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]`; a PostgreSQL 16 integration test
  proved direct SQL `NULL` is rejected and omission becomes an empty array.
  Migrations B1/B2 add the nullable AI generation correlation field and its
  concurrent index. Migration C installs append-only and root guards before
  any provenance writer can be enabled. Local disposable PostgreSQL tests
  passed for all required immutability, identity, projection, and cross-root
  assertions. No staging or production migration, writer, reader, generation
  change, approval change, or backfill has executed. Review branch:
  `codex/p2a-provenance-step1`. Exact staging-only instructions are in
  `docs/ops/P2A_STAGING_MIGRATION_RUNBOOK.md`. Gate: `npx prisma generate`
  PASS; exact `npx tsc --noEmit` PASS; second exact `npx vitest run` PASS,
  4,617 tests in 564 files after the first run's 4 timeout-only failures all
  passed in isolation; `npm run build` PASS with exit 0 and `.next/BUILD_ID`
  `0xNoqCJHjE3MqOkxxZX0A`. Next: final human review of the
  runbook, then a separately authorized staging-only execution. Final staging
  precheck hardening adds embedded PostgreSQL timeouts: A/B1/C use
  `lock_timeout=5s` plus `statement_timeout=5min`; B2 uses
  `lock_timeout=5s`, no statement deadline, and dedicated progress/index
  validity monitoring. Hardened verification SQL passed end-to-end in
  disposable PostgreSQL 16, including rejection-type discrimination and a
  SELECT-only final check of 14 enums, 4 tables, 10 enabled triggers, 12
  foreign keys, 10 unique indexes, migration state, and the absence of a
  physical provenance column on `CurriculumContent`. No persistent database
  was touched. Negative-path tests also proved nonzero exit for a nullable
  `riskReasons` schema, a missing immutability trigger, and an unexpected
  trigger SQLSTATE/message. Staging execution remains unauthorized pending
  review of the final SQL returned to the owner.
- **AWS account migration: `258048833400` -> `466568847266` (2026-08-07/08).**
  The old account went into an AWS billing hold (past-due invoices; account
  suspended, all API credentials returned `InvalidClientTokenId`) and was
  judged not worth reactivating versus rebuilding on the owner's other
  existing account (`466568847266`, previously an idle `liberiago-staging`
  profile, now the only AWS account in use going forward). Everything
  AWS-side was rebuilt from scratch and independently verified live, not
  just via API "created" responses: ECR repo + worker image (multi-stage
  `worker/Dockerfile`, fixed a real `.dockerignore` gap where `load-tests`
  (4.4GB of accumulated k6 result logs), `.claude`/`.worktrees` worktree
  checkouts, and `.next` were leaking into the build context; fixed a real
  `npm ci` failure where the `postinstall` script depends on a file not yet
  copied into the `deps` build stage, resolved with `--ignore-scripts` since
  that script only patches vitest's local CLI and is irrelevant to the
  worker image); `ecsTaskExecutionRole` + `ecsTaskRole` IAM roles; SQS main
  FIFO queue + DLQ (VisibilityTimeout 300s, redrive after 3 receives,
  matching original); `liberia-learn` ECS cluster + service on the default
  VPC (min1/max10 target-tracking autoscaling on SQS
  `ApproximateNumberOfMessagesVisible`, target 50, FARGATE_SPOT weight 4);
  CloudWatch log group; SSM SecureString parameters for
  DATABASE_URL/DIRECT_URL/OPENAI_API_KEY (pulled from the real
  `.env.production` values) plus the new SQS URLs. Service reached steady
  state at 1/1 running; worker startup log confirmed pointed at the correct
  new queue with DLQ configured. Split IAM credentials by privilege instead
  of reusing one broad user everywhere: `liberialearn-deploy`
  (AdministratorAccess, for infra work only) vs. a new
  `liberialearn-app-runtime` user scoped to `cloudwatch:PutMetricData` only
  (verified via grep that this is the only AWS action the Next.js app itself
  performs, distinct from the worker) — the latter's keys are what went into
  Vercel production env vars, not the admin user's. Updated Vercel
  production `AWS_REGION`/`AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`/
  `SQS_QUEUE_URL`/`SQS_DLQ_URL` to the new account/queues; **a new production
  deploy has not been triggered, so these are not yet live** on the running
  deployment. Updated the hardcoded old account ID (`258048833400`) across
  `docs/ops/WORKER_DEPLOYMENT.md`, `infra/ecs/worker-task-definition.json`,
  `infra/ecs-worker-task-definition.json`, `build-os.md`, and
  `scripts/flood-test-queue.ts`'s fallback queue URL.
- **P1-D Infrastructure and Independent Security Proof: flood-test drain
  proof COMPLETE and live-verified (2026-08-08).** Corrected an internal
  disagreement first: the P1-D program doc's "500-job flood" text does not
  match the literal historical NR-2 test, which sent 200
  (`scripts/flood-test-queue.ts` `TOTAL = 200` on record); the user
  explicitly chose to re-run the literal 200-message NR-2 test rather than a
  new, non-comparable 500-message variant, so `TOTAL` was reverted to 200
  and the associated unit tests (`__tests__/scripts/floodTestQueue.test.ts`)
  updated to match — all 4 pass. Ran for real against the new account's live
  infrastructure (Saturday 2026-08-08 01:48 UTC, outside the Mon-Fri
  08:00-15:00 GMT restriction): 200 messages enqueued in 642ms, queue fully
  drained 10.1s after enqueue finished (10.8s total), peak visible backlog
  139, peak in-flight 2. Independently confirmed the worker actually
  processed every message (not just that SQS silently dropped them): exactly
  600 matching CloudWatch log lines (3 per message: processing-start,
  HEALTH_CHECK-alive, processed) for the 200-message run. Service settled
  back to 1/1 running after the brief spike; the 10-second backlog window
  was too short to trigger the autoscaling policy's evaluation period, which
  is expected at this load level, not a defect. The worker-completion-metric
  fix (`WorkerJobCompleted`/`WorkerJobNoop`/`WorkerJobUnknown` split in
  `worker/index.ts`) and the flood-test rewrite (empty-queue precondition,
  observed-backlog + two-zero-poll drain confirmation) both came from the
  earlier `codex/p1d-infrastructure-proof` engineering slice and are
  unchanged by this account migration beyond the queue-URL and TOTAL fixes
  above. Remaining P1-D deliverable: the external penetration test, still
  pending vendor selection, contract, credentials, and test-window approval
  per `docs/security/PEN_TEST_VENDOR_ENGAGEMENT.md`.
- **P1-C Privileged Identity Hardening: ENGINEERING COMPLETE on review branch
  (2026-08-05), production activation pending.** Branch
  `codex/privileged-mfa-hardening`. Added Auth0-managed MFA for `ADMIN`,
  `DISTRICT_ADMIN`, MOE roles, and platform administrators without storing
  authenticator secrets or recovery codes in LiberiaLearn. Privileged Auth0
  sign-in now requires verified email and MFA claims, links the provider
  subject to the local user, and creates a server-side assurance ledger.
  Sensitive exports, curriculum approval, role changes, and national controls
  require recent step-up authentication. Privileged sessions fail closed and
  are invalidated after role, school, password, platform-admin, or MFA-state
  changes. Added rate-limited MFA recovery reset, required audit writes,
  security-version rotation, and a two-person, time-limited audited break-glass
  tool. Added additive `PrivilegedIdentity` and
  `PrivilegedSessionAssurance` models and an operational runbook. The
  `/auth/step-up` page renders its `useSearchParams()` client beneath React
  `Suspense`, closing the production-build prerender failure found at the
  final gate. After fast-forward integration with `origin/main` at
  `0cefc6d1`, the final gate passed: `npx prisma generate` PASS;
  `npx tsc --noEmit` PASS; exact `npx vitest run` PASS, 4,595 tests in 561
  files; `npm run build` PASS with exit 0 and `.next/BUILD_ID`
  `fm721VgRLszx8Zv8mdTWX`; `git diff --check` PASS. The build retained
  pre-existing missing-local-env, lint, dynamic-render, observability,
  Upstash, and Windows standalone-symlink warnings. Do not enable
  `PRIVILEGED_MFA_ENFORCEMENT_ENABLED` until the Auth0 tenant and Post Login
  Action are configured, migration `20260803_000001_privileged_identity_hardening`
  is deployed, all privileged identities are enrolled, recovery ownership is
  confirmed, and Preview plus production live walkthroughs pass. Next program
  sprint after review and activation evidence: P1-D infrastructure and
  independent security proof.
- **P1-B Tenant Isolation, Revocation, and Required Audit Transitions:
  COMPLETE + MERGED (2026-08-03, PR #77, merge commit `c9363568`).** The work
  was reviewed and merged after P1-A in dependency order. It remained isolated
  from Claude's concurrent curriculum risk-triage worktree with no changed-file
  overlap.
  Lesson-video activation now deactivates competitors only within the video's
  school. Curriculum reads limit school-owned content to the caller's tenant
  and resolve private URLs only for active, approved videos in that same
  school. Offline lesson fallback now runs only after a transport failure;
  HTTP rejection is authoritative and evicts the cached lesson. Cached
  curriculum requires an RSA-signed availability manifest, verifies lesson ID
  and version before use, and is evicted after a signed revocation or newer
  version refresh. Curriculum approve, reject, draft review, platform-admin
  transfer generation, transfer acceptance, and self-demotion now place the
  mutation and required audit write in one database transaction. No schema
  changes. Independent verification against the P1-A source confirmed the
  activation query lacked school scope before and contains it after; the build
  artifact `.next/BUILD_ID` exists. Gate: `npx prisma generate` PASS;
  `npx tsc --noEmit` PASS with the known 6144 MB local heap allowance;
  focused P1-B regression set PASS, 124 tests in 13 files; full
  `npx vitest run` PASS, 4,535 tests in 550 files; `npm run build` PASS with
  exit 0 after network permission allowed the configured Google font fetch.
  The build retained pre-existing missing-local-env, lint, dynamic-render, and
  standalone junction warnings. Deployment must configure
  `CONTENT_MANIFEST_PRIVATE_KEY`, `CONTENT_MANIFEST_KEY_ID`, and
  `NEXT_PUBLIC_CONTENT_MANIFEST_PUBLIC_KEY`; without them, online lessons work
  but offline curriculum caching fails closed. Next: P1-C privileged identity
  hardening. Stop at its provider and live User-schema escalation points.
- **P1-A Minor AI Safety + Safeguarding Delivery Truth: COMPLETE + MERGED
  (2026-08-03, PR #76, merge commit `8f3ad56d`).** The implementation branch
  was based on `origin/main` at `829a4a71` in an isolated worktree because
  Claude was concurrently implementing curriculum risk triage. No changed
  files overlap Claude's branch. Added an explicit minor-audience moderation
  policy that converts `UNCERTAIN` to `UNSAFE`; main student tutor input and output are
  now moderated; adaptive-practice and newly generated WAEC content are
  blocked before use or persistence unless moderation is `SAFE`; and existing
  student grading, lab, and RAG paths now treat every non-safe result as
  blocked. Safeguarding delivery now records intended recipients separately
  from confirmed durable inbox delivery, exposes channel failures, does not
  write success markers after failed delivery, remains retryable while the
  success marker is absent, and requires confirmed platform fallback delivery
  for the 24-hour tier. Added `logAuditRequired()` for sensitive completion
  transitions and used it for safeguarding success markers. No schema changes.
  Independent verification: forced moderation-provider failure and explicit
  `UNCERTAIN` both return `UNSAFE` for a minor audience; route-level tests prove
  the student tutor does not call or expose the model in those states; forced
  inbox and fallback-email failures create failure actions rather than sent
  markers. Gate: `npx prisma generate` PASS; `npx tsc --noEmit` PASS with the
  known 6144 MB local heap allowance; `npx vitest run` PASS, 4,524 tests in
  547 files; `npm run build` PASS with exit 0 and `.next/BUILD_ID` produced.
  The build retained pre-existing missing-local-env and lint warnings. Program
  sequencing for requested priorities 1, 2, 5, 6, and 7 is documented in
  `docs/roadmaps/PRIORITIES_1_2_5_6_7_EXECUTION_PROGRAM.md`. P1-B was continued
  in the next separately authorized cycle and is recorded above.
- **NR-9.5 — Child Safety Hardening: COMPLETE + MERGED (2026-07-30, PR #62,
  merge commit `b3dde0d9`).** Commits `f8c9529b`..`72e5c8c6` on
  `agent/consolidated-backlog`. Gate: prisma generate PASS, tsc PASS,
  vitest PASS (4,431 tests / 540 files, baseline was 4,409/537), build
  PASS, zero schema changes, real live walkthrough against production
  PASS on all fixed surfaces (see `project_nr9_5_child_safety_hardening.md`
  in session memory for full evidence). A user-requested full-codebase
  sweep before merge found and fixed a second real gap (`planLabAction.ts`
  / `explainLabState.ts`, the actual live lab-AI surfaces) and
  found-but-deferred a third (grading cluster — now NR-9.6).
- **NR-9.6 — Grading Surface Moderation Audit: COMPLETE (2026-07-30).**
  Investigation found `homeworkGrader.ts`/`homework-grader.ts` are two
  genuinely separate features (Assignment vs Homework), not duplicates —
  fixed independently, not consolidated. Real finding: the Assignment
  flow's student page showed raw unmoderated `aiFeedback` immediately via
  an unconditional fallback, regardless of the 72h auto-release timer
  (which only gates the official score/feedback fields). Fixed moderation
  on `gradeHomework`, `HomeworkGrader.gradeSubmission`, `gradeEssay.ts`,
  `gradeAILiteracy.ts`, plus tightened the display gate in
  `app/student/assignments/[id]/page.tsx` to require
  `teacherApproved`/`autoReleasedAt` before showing `aiFeedback` — the
  more important fix, since it closes the actual exposure path. Both
  `AssignmentSubmission` and `GradedSubmission` had zero real rows in
  production (real, reachable, unprotected code, not yet exercised).
  Gate: tsc/build/4441 tests (541 files, baseline 4409/537) all PASS,
  zero schema changes, real live walkthrough verified all 4 surfaces
  block a real adversarial input plus the display-gate before/after
  release, using test data created and fully cleaned up.
- **NR-3 — Load-Test Identity Pool: COMPLETE (2026-07-31).** Branch
  `feat/nr-3-load-test-pool`. Repaired a prior half-finished NR-3 attempt
  (1,000 users across 10 schools with zero `Student` rows, verified live
  before assuming) via idempotent `scripts/seed-load-test-pool.ts`, and
  additively seeded 40 more schools to clear the 50+ school requirement.
  Added string-match synthetic-identity exclusion
  (`lib/loadTest/syntheticIdentity.ts`) to the 6 human-facing surfaces that
  render School/User counts, including the national league snapshot cron
  (without it, 50 fake schools would have entered real league rankings). A
  durable `isSynthetic` schema flag was proposed as a separate,
  non-blocking follow-up escalation, not implemented this sprint. Gate:
  prisma generate PASS, tsc PASS, vitest 4,441 tests / 541 files PASS
  (no regression from NR-9.6 baseline), build PASS. Production dry-run
  evidence independently re-derived this session against live counts
  (63 schools / 50 synthetic, 2,168 users / 1,850 synthetic, 1,988
  students / 1,800 synthetic — exact match to the recorded evidence) —
  see `docs/LOAD_TEST_RESULTS.md` for full detail. Not yet committed/pushed
  as of this note.
- **NR-4 — k6 Moderate (1K VU) Production Proof: FAIL (2026-07-31).** PR #65
  (NR-3) was found unmerged at sprint start and was merged (`54dc7181`) before
  this run; production had never actually served the synthetic-school
  exclusion code until this session's deploy. Real k6 run against production
  (`load-tests/k6-config.js`, the pool-integrated harness — `load-tests/moderate.js`
  was investigated and found not wired to the NR-3 token pool at all) on
  2026-07-31 19:07-19:26 GMT: http_req_duration p95 **19.97s** (target
  <2000ms) FAIL, error rate **0.30%** (target <1%) PASS, student-today API
  success **100%** (target >95%) PASS. Overall FAIL — not all three targets
  met. Real root cause found: `lib/cache/redisCache.ts`'s
  `MAX_CONCURRENT_DB_FALLBACKS=1` per-instance limiter became the bottleneck
  under the first-ever run against the full 1,000-student pool with genuinely
  unique cold cache keys, not the Vercel plan tier (confirmed Pro this
  session). `ai_tutor` scenario also showed 32-46s real AI-backend latency
  under 100-300 VU concurrency, a separate issue. AI spend during the run:
  $0.155, entirely on synthetic `lt-school-*` IDs, confirming per-school
  budget isolation works. No lasting infra damage: `/api/health` 200 before
  and after, ECS/SQS clean post-run. Full detail in
  `docs/LOAD_TEST_RESULTS.md`. Process gap disclosed in that doc: the agreed
  abort criteria were not actively enforced during the run (monitor was
  notification-only, no kill-switch) — fix before NR-5 (5,000 VU) is
  attempted. Gate: prisma generate/tsc/vitest (4441 tests/541 files, 2
  confirmed-flaky timeout reruns)/build all PASS.
- **Load-test kill-switch: BUILT, VERIFIED, and FIRED FOR REAL (2026-07-31,
  PR #67, merge commit `4c2cfbf8`).** Built before touching the cache fix, per
  explicit user direction, as a distinct safety-critical deliverable —
  `scripts/load-test-kill-switch/supervisor.ts` wraps `k6 run`, tails its
  streamed `--out json` output, computes a true rolling-window p95/error-rate,
  and sends SIGTERM/SIGKILL to the k6 child the instant either breaches,
  with no dependency on a human watching. Verified locally against a
  controllable mock server (healthy control, latency breach, error-rate
  breach, all three passed) before ever touching production — see
  `docs/ops/LOAD_TEST_KILL_SWITCH.md`. It then fired for real on the actual
  NR-4 re-run below, proving itself in the exact scenario it was built for.
- **`MAX_CONCURRENT_DB_FALLBACKS` re-tune (2026-07-31, PR #68, merge commit
  `30c1833d`): investigated, fixed, deployed — but the fix did not resolve
  NR-4.** Investigation found the prior MAX=1 value was deliberately tuned
  (not an oversight) but calibrated entirely against a load-test pool with
  zero `Student` rows the whole time (NR-3 fixed that gap the same day),
  meaning the tuning never once exercised the expensive path it was
  ostensibly protecting. Raised MAX 1->3 (grounded in a live-queried
  `max_connections=60`) and broadened the k6 pre-warm from 50 to all 1,000
  tokens a 1000-VU run uses. Small-scale validation (30 tokens) passed
  clean. **A second, real production re-run using this fix was then
  attempted and aborted by the kill-switch during the pre-warm phase itself**
  (2026-07-31 22:09-22:15 GMT) — p95 hit 15.2s sustained over 60s before the
  timed scenario even began. Further investigation during validation also
  found the synthetic load-test students have zero class enrollment, so the
  specific mechanism PR #68 blamed (`todayData`'s 7-query path) is not even
  reachable by this population — the real mechanism is Redis-GET-dominated
  cold-cache latency on cheaper per-student lookups, and something about
  *sustained* duration (not just concurrency at a point in time) that a
  short validation window didn't surface. No lasting production damage:
  `/api/health` 200 before and after, DB connections 1 active/17 total (of
  60) post-abort, no residual pressure. Full detail in
  `docs/LOAD_TEST_RESULTS.md`.
- **NR-4 investigation update (2026-08-01):** a sustained-load diagnosis at
  fixed low concurrency (300 fresh tokens, batch size 3, ~106s, through the
  kill-switch) came back clean — p95 1.29s, no degradation trend, DB
  connections flat. This rules out "duration alone at low concurrency" but
  not the real 1,000-VU concurrency level. Separately, **Supabase org
  "Farquema" (owns `liberia-learn-db`) was confirmed live to be on the
  **free** plan**, not Pro — this had never been checked before (only
  Vercel's tier was confirmed). Free-tier Postgres compute/pooler limits are
  now the leading root-cause candidate for NR-4's degradation, better fitting
  the evidence than the prior `MAX_CONCURRENT_DB_FALLBACKS` framing. Not yet
  done: no Pro upgrade, no diagnostic combining sustained duration with real
  concurrency. See `docs/LOAD_TEST_RESULTS.md` for full detail.
- **NR-4 explicitly deferred on budget, not abandoned (2026-08-01).** User
  does not currently have budget for the Supabase Pro upgrade, the leading
  root-cause candidate identified 2026-08-01. Rather than idle, user
  directed a deliberate reorder: skip ahead to NR-6 (Security phase) now,
  come back to NR-4 once funded. This is a documented, user-approved
  exception to the standing "do not skip sprints" rule, not a silent skip.
  **NR-5 remains blocked on NR-4 passing** — the reorder covers NR-6 only,
  per the plan's own "NR-5 before NR-4: not allowed" rule, which this
  exception does not touch. Do not resume NR-5 or NR-4 attempt #3 without
  re-confirming the budget situation with the user.
- **NR-6 — Middleware Portal Hardening: COMPLETE (2026-08-01, PR #70, merge
  commit `4eb18d44`).** Audited all 226 routes under `app/api/admin/` and
  `app/api/platform/`: every route already enforced real authorization
  (direct `requireRole()`/`requirePlatformAdmin()`, named wrappers, or
  record-scoped service-layer checks like `canApprove`/`canSignoff` for
  routes where the legitimate approver role varies per record, e.g. a
  TEACHER approving a TEACHER-scoped item). Zero unprotected routes found.
  Added an authentication-only middleware backstop for `/api/admin/*` and
  `/api/platform/*` (deliberately not role-gated, to avoid breaking those
  non-ADMIN flows) plus 5 integration tests. Gate: prisma generate/tsc/
  vitest 4446 tests-541 files (baseline 4441/541)/build all PASS, CI green,
  zero schema changes. **Live post-merge walkthrough against production**
  as `teacher1@liberialearn.dev` (real TEACHER session, password verified
  against the live bcrypt hash, not a doc): `GET /api/admin/agents` → 403,
  `GET /api/platform/stats` → 403 "platform admin required", `GET /admin`
  page → redirect to `/unauthorized` (control group, confirms no page-level
  regression). Unauthenticated: pages 307 to `/login`, API routes 401. The
  pre-merge preview walkthrough for this same check failed for an unrelated
  reason (Vercel Preview has no Upstash Redis env vars, so the rate-limiter's
  deliberate hard-fail blocks all preview login) — logged as its own backlog
  item in `CONSOLIDATED_BACKLOG.md`, not fixed under NR-6's scope.
- **NR-7 — Systematic Tenant Access Guard: COMPLETE (2026-08-01), not yet
  pushed/merged.** Branch `feat/nr-7-tenant-guard`, commit `37f9c5f9`.
  Discovered `lib/tenant/assert-school-access.ts` (`assertSchoolAccess`/
  `checkSchoolAccess`) already existed from a May 22 pre-plan commit but was
  applied to only 3 routes; reused it rather than building a new guard.
  Re-ran the existing regex-based audit script (`scripts/audit-school-isolation.ts`)
  fresh: 549 total API routes, 109 HIGH/MEDIUM-flagged candidates within
  `app/api/{student,teacher,admin}/` (out of 367 in that scope). All 109
  were read and triaged for real (not just the heuristic) via three parallel
  read-only investigations, one per directory. Most were false positives
  (real auth/ownership checks present under differently-named helpers, or
  queries self-scoped to the session user with no client-supplied
  cross-tenant ID ever trusted). Found and fixed 3 genuine cross-tenant
  gaps: (1) `canManageLessonVideo` let any school's ADMIN manage/delete
  another school's lesson video by ID, plus the sibling GET listing leaked
  every school's videos for a shared lesson to any ADMIN; (2)
  `admin/ops/optimization/change-requests/[id]/post-change-eval` GET had no
  tenant check at all (not even a role check) - any authenticated user of
  any role could read another school's evaluation plan by guessing the ID,
  unlike every sibling route on the same resource; (3)
  `admin/agents/{cost,goals,triggers,route,[name]/toggle}` let any school
  ADMIN see platform-wide per-user AI spend and flip the platform-wide
  agent kill switch, because the underlying models (AgentInvocation/
  AgentGoal/AgentControl/AgentCostAccounting) have no schoolId column at
  all - switched those 5 routes to `requirePlatformAdmin()` rather than
  attempting a schema-level per-school retrofit, which would be
  disproportionate to this fix. Extended the
  `growth.tenant-isolation.test.ts` / `school-isolation.test.ts` pattern
  with 20 new tests covering ~26 distinct routes (comfortably past the
  plan's min-20 bar), mixing full route-level regression tests for the 3
  fixes above with unit tests against the shared `resolveScopeParams` /
  `forecastScopeForUser` functions that back the admin/ops and
  admin/training surfaces. Gate: prisma generate PASS, tsc PASS, vitest
  4,466 tests / 542 files PASS (baseline 4,446/541), build PASS, zero
  schema changes. **Scope caveat:** the ~258 routes the audit script
  marked OK (contains a literal `schoolId` reference) were not
  individually re-read line-by-line - only the 109 flagged candidates
  received a full manual trace. Not yet pushed to remote or opened as a
  PR; a human still needs to review and merge per standing branch
  discipline.
- **NR-7 merged to `main` (2026-08-01, PR #72, merge commit `b30a08a8`).**
- **NR-8 — RBAC Expansion + SSO Onboarding Fix: COMPLETE (2026-08-01), not
  yet pushed/merged.** Branch `feat/nr-8-rbac-sso`. Discovered a prior
  May 22 pre-plan commit (`42d467ed`, already on `main`) had already built
  most of deliverables 1 and 2: `assertPermission` on 12 governance/export/
  override routes, and the Google SSO invite-required gate for new users.
  This sprint's real contribution: (1) added `MOE_SUPER_ADMIN` and
  `MOE_DISTRICT_ADMIN` to `SessionUser.role`'s TypeScript union in
  `lib/auth.ts` (deliverable 3 — both roles already existed in the Prisma
  `Role` enum and in `lib/permissions.ts`'s `ROLE_PERMISSIONS`, just never
  reflected in the type), which also surfaced and fixed a real downstream
  gap in `lib/ai/trust.ts`'s `TrustAudienceRole`; (2) following the NR-7
  carry-forward instruction to check for missing-auth-entirely (not just
  missing-tenant-scope), audited every `app/api/moe/*` route and found 11
  routes gating on the literal string `role !== "MOE_OFFICIAL"`, silently
  excluding `MOE_SUPER_ADMIN` even though it is a senior/equal MOE role
  (already correctly honored by `requireMoeActor`-backed routes like
  dashboard/counties/districts). Two of those (`submissions`,
  `submissions/[id]/review`) additionally used
  `requireRole("MOE_OFFICIAL", "PLATFORM_ADMIN")` — "PLATFORM_ADMIN" is not
  a value in the Prisma `Role` enum, so that branch could never match any
  real user; a real platform admin's role is "ADMIN" with a separate
  `isPlatformAdmin` flag, making this dead code guaranteed to 403 every
  platform admin. All 11 fixed to use the existing `isMoeSuperRole` helper
  from `lib/moe/rbac.ts`, matching the pattern already used correctly
  elsewhere; (3) hardened the Google SSO `signIn` callback for deliverable
  2's literal wording ("block active session until schoolId assigned") —
  the existing invite gate only covers brand-new users; `User.schoolId` is
  nullable in schema, so an existing TEACHER row could theoretically have
  `schoolId: null` and still receive an active Google-SSO session. Added an
  explicit block (`/login?error=SchoolAssignmentRequired`) for that case.
  No separate self-service "school code" SSO flow was built — none existed
  to extend, and the deliverable's core protective intent (never issue a
  schoolId-less session) is now closed on both the account-creation and
  existing-login paths. Gate: prisma generate PASS, tsc PASS, vitest 4,488
  tests / 543 files PASS (baseline 4,466/542, +22 new), build PASS, zero
  schema changes. Fixing 8 pre-existing test files that mocked the old
  `requireRole` gate (now `requireUser`) was part of reaching a genuinely
  green gate, not scope creep — the mandatory gate requires the full suite
  to pass, and those tests were asserting on the old (buggy) contract.
- **NR-8 merged to `main` (2026-08-01, PR #73, merge commit `757e0191`).**
- **NR-9 — Audit Immutability + Pen Test Remediation: PARTIAL, closed for
  engineering purposes (2026-08-01, docs-only, no branch/PR needed).**
  Deliverable 1 (DB-layer `AuditLog` immutability) was already built by a
  May 22 pre-plan commit (`84da491c`, same day as the NR-7/NR-8 pre-plan
  work). Rather than trust the commit message, independently re-verified it
  live against production Postgres today via direct read-only query
  (`mcp__claude_ai_Supabase__execute_sql` against project
  `bnphuinpvgpmebcsvmsp`): `pg_trigger` confirms both `audit_log_no_update`
  and `audit_log_no_delete` exist on the live `AuditLog` table with
  `tgenabled='O'` (active); `pg_proc` confirms both trigger functions still
  contain the original `RAISE EXCEPTION` body with no silent drift to a
  no-op; `_prisma_migrations` confirms `20260522_000001_audit_immutability`
  has `finished_at` set and `rolled_back_at` null, meaning it was actually
  deployed via `prisma migrate deploy`, not merely present in the repo.
  This is exactly the class of claim this project has been burned by before
  (stale Supabase tier, DATABASE_URL port confusion) — worth the extra
  verification step rather than assuming a prior session's commit message
  was accurate. No code changes were needed. Deliverable 2 (external
  penetration test, CRITICAL/HIGH findings remediated or accepted with MOE
  sign-off) cannot be performed by an engineering session — it requires
  actually engaging a third-party vendor. A scope brief
  (`docs/security/PEN_TEST_BRIEF.md`) was drafted May 22 but no vendor was
  ever engaged, and `docs/MOE_PRODUCTION_CERTIFICATION.md` has no
  remediation table. **User-confirmed 2026-08-01: defer deliverable 2 as a
  standing external-action backlog item (see `CONSOLIDATED_BACKLOG.md`),
  close NR-9 for engineering purposes.**
- **NR-10 — Student Fail-Closed Curriculum Routing: COMPLETE (2026-08-01), not
  yet pushed/merged.** Branch `feat/nr-10-curriculum-routing`, commit
  `83c86dbc`. Investigation found most of this sprint's deliverables already
  existed from a `2026-05-23` pre-plan commit (`775b59bb`, same pattern as the
  May 22 pre-plan work found during NR-7/NR-8/NR-9): the student
  work-detail route (`/api/student/work/[scheduledWorkId]`) already
  fail-closes on content status with an explicit comment and 4 passing
  tests; the lesson catalog (`/api/student/lessons`) already scopes its
  `curriculumContent` query to `{ in: ["published", "APPROVED"] }`; and the
  admin/MOE coverage API (`/api/admin/curriculum/coverage`) already computes
  the full grade x subject matrix, gated by a `CURRICULUM_COVERAGE_VIEW`
  permission held by `ADMIN`/`MOE_OFFICIAL`/`MOE_SUPER_ADMIN`, with real
  dashboard pages at `/admin/curriculum/coverage` and
  `/moe/curriculum/coverage`. The one real gap the pre-plan commit missed:
  `/api/student/today`'s own `scheduledWork.findMany` queries (both the
  current-day and 14-day catch-up windows) never filtered on
  `content.status` at all, so a scheduled lesson backed by DRAFT,
  NEEDS_REVIEW, or pending_approval content would still render as a Today
  card (title/subject/grade visible) even though opening it correctly
  404'd via the already-fixed work-detail route. Fixed by adding
  `content: { status: { in: ["published", "APPROVED"] } }` to both
  `scheduledWork.findMany` where-clauses in
  `app/api/student/today/route.ts`, matching the existing convention used
  by every other student-facing route. Verified live in production via
  direct Postgres query (`mcp__claude_ai_Supabase__execute_sql` against
  project `bnphuinpvgpmebcsvmsp`) that all 5 `CurriculumContent.status`
  values actually in use are `APPROVED` (1052), `published` (37), `DRAFT`
  (10), `pending_approval` (2), `NEEDS_REVIEW` (1) — confirming the fix's
  allow-list matches real data rather than an assumed enum. Added
  regression tests: 2 new tests in `__tests__/timetable/todayEndpoint.test.ts`
  asserting both scheduledWork queries scope to the 2-item approved
  allow-list and that a draft-content row is filtered out of the response
  `items`, plus a new `__tests__/nr10.fail-closed-curriculum-routing.test.ts`
  locking in the lesson catalog's existing filter with the same pattern.
  Gate: prisma generate PASS, tsc PASS, vitest 4,492 tests / 544 files PASS
  (baseline 4,488/543, +4 new), build PASS, zero schema changes.
- **NR-10 merged to `main` (2026-08-02, PR #74, merge commit `ccdcab84`).**
- **NR-11 — MOE Published Backlog Approval Sprint: REFRAMED and PARTIALLY
  COMPLETE (2026-08-02), not yet pushed/merged.** Investigation (user-directed,
  before writing any code) found the plan's premise does not match production
  reality. The plan's "389 published lessons awaiting MOE approval" target
  traces to `docs/PHASE5_2_CURRICULUM_AUDIT_REPORT.md` (2026-04-23), which
  explicitly documented `status = "published"` as a **pre-approval** state at
  that time (389 published + 143 pending_approval, "not served to students
  until approved"). That is no longer true: `/api/admin/curriculum/approve`
  now sets `status: "published"` as the **result** of approval, and every
  student-facing route (including the NR-10 fix) treats `published` and
  `APPROVED` as equivalent, already-approved statuses. Live production counts
  (2026-08-01/02): `APPROVED` 1,052, `published` 37, `DRAFT` 10,
  `pending_approval` 2, `NEEDS_REVIEW` 1 — the genuine awaiting-review backlog
  is 13 rows, already under the plan's own "<50 remaining" gate.
  **Real finding: the original ~389+143 backlog was not resolved by MOE
  review.** Two standalone CLI scripts —
  `scripts/bulk-approve-published.ts` (word-count/content-length/placeholder-
  title heuristics) and `scripts/promote-enriched-lessons.ts` (structural
  quality gate, attributed to `"system:promotion-pass-2b"`) — auto-approved
  it. Direct production query: of 1,089 rows now `APPROVED`/`published`,
  **712 carry no approver identity at all** (`payload.approvedByUserId` is
  null, consistent with the bulk script), only **7 rows** have a real
  human `approvedByUserId`, and `AuditLog` shows only **41 audited approval
  actions** (`curriculum.approve` + `curriculum.review.approve`) in the
  entire project history — against 1,089 rows in an approved-equivalent
  status. Roughly 95%+ of live national curriculum content was approved by
  a script checking word counts and placeholder titles, not reviewed by a
  human or MOE official. This is directly relevant to NR-18 (MOE Dashboard +
  Certification): any national certification claim resting on "content is
  approved" currently means "content passed an automated quality gate,"
  not "MOE reviewed it." `docs/MOE_PRODUCTION_CERTIFICATION.md` already
  disclaims making an MOE-approval claim, so no existing certification
  document is contradicted, but this should stay visible for NR-18 planning.
  **User-directed scope for this sprint (2026-08-02): reframe, don't
  re-review.** Do not attempt to re-review the 1,000+ already-live lessons.
  Instead: (1) document the reality clearly (this entry, plus header
  comments added to both auto-approval scripts) and (2) fix the concrete,
  fixable bug found alongside this investigation — `MOE_OFFICIAL` and
  `MOE_SUPER_ADMIN` already hold `PERMISSIONS.CURRICULUM_APPROVE` in
  `lib/permissions.ts`, but every route that lets a human actually approve
  or reject content hard-required `role === "ADMIN"`
  (`requireRole("ADMIN")`) or `isPlatformAdmin`
  (`requirePlatformAdmin()`), silently locking MOE roles out of approval
  entirely — the same class of bug NR-8 found and fixed across `/api/moe/*`
  routes. Fixed 4 call sites to use `requireUser()` +
  `assertPermission(user, PERMISSIONS.CURRICULUM_APPROVE)` (matching the
  existing coverage-API pattern) instead of a hardcoded role check:
  `app/api/admin/curriculum/approve/route.ts`,
  `app/api/admin/curriculum/reject/route.ts`,
  `app/api/admin/ops/curriculum-review/route.ts` (GET + POST, replacing
  `requirePlatformAdmin()`), and the page-level gate in
  `app/admin/ops/curriculum-review/page.tsx` (replacing an
  `isPlatformAdmin`-only redirect with the same permission check). Added
  20 new regression tests in `__tests__/nr11/moe-approval-access.test.ts`
  proving `ADMIN`/`MOE_OFFICIAL`/`MOE_SUPER_ADMIN` can now use all four
  surfaces and `TEACHER`/`STUDENT` are still denied; updated 2 existing
  test files (`curriculum.feedback.test.ts`,
  `audit-gate-2-patches.test.ts`) whose auth mocks assumed the old
  `requireRole` call. **Known gap, not fixed this sprint (kept small on
  purpose):** `/admin/ops/curriculum-review` is read-only — it lists
  drafts but has no UI buttons wired to the POST approve/reject/bulk_approve
  actions, so a human (MOE or ADMIN) would currently have to call the API
  directly. Building that UI is a real, separable follow-up, not an access
  fix. Gate: prisma generate PASS, tsc PASS, vitest 4,512 tests / 545 files
  PASS (baseline 4,492/544, +20 new), build PASS, zero schema changes.
- **NR-11 merged to `main` (2026-08-03, PR #75, merge commit `7b3f07e2`).**
- **Curriculum risk-triage prerequisite for NR-12: COMPLETE (2026-08-04),
  pending human review/merge.** Branch `feat/curriculum-risk-triage`. Replaced
  silent script-driven curriculum approval with a shared rule-based risk
  scorer and DB-backed `triageAndApprove` path for
  `scripts/bulk-approve-published.ts` and
  `scripts/promote-enriched-lessons.ts`. High-risk candidates are held in
  `NEEDS_REVIEW` under a global rolling seven-day budget of 8; lower-risk or
  budget-excess candidates retain each pipeline's existing approved status
  and approval metadata, while every automated decision is risk-stamped and
  audit-logged. Reviewer email is best-effort and permission-derived, and the
  existing curriculum-review API/page now exposes the live flagged backlog
  count. Human approve/reject routes remain outside automated triage. Zero
  schema changes. A pre-merge review corrected legacy threshold drift: the
  automated approval and audit paths now share a single 3,500-word minimum,
  matching `generateLessonV2.ts`; the previous bulk 400/600/800 and promotion
  1,200 values can no longer publish undersized lessons. Gate:
  `npx prisma generate` PASS; final-tree TypeScript PASS
  with incremental caching disabled after the incremental runner twice hung
  without diagnostics; exact `npx vitest run` PASS (4,542 tests / 550 files);
  `npm run build` PASS. The required production dry run was read-only and
  found one `NEEDS_REVIEW` lesson, G9 MATH, at 3,787 words and risk score 2
  (borderline margin above 3,500). A separate
  read-only production status audit independently
  confirmed exactly one G9 MATH `NEEDS_REVIEW` row and that it exceeds the
  3,500-word approval threshold. Direct Postgres on port 5432 was unreachable
  this session; the independent verification succeeded through the pooled
  port-6543 `DATABASE_URL`, matching the standing carry-forward rule.
- **Next national sprint: NR-12 — Critical Grade Deserts (G2, G9).** Not
  started as of this note. Target per the plan: regen + QA for Grade 2 and
  Grade 9 until >=15 APPROVED per core subject, plus documented factory
  tuning for known low-pass-rate cells (G3 SCIENCE, G5 ENGLISH, G7 CIVICS).
  Given NR-11's finding, re-verify live coverage numbers fresh at NR-12
  start rather than trusting the April audit's grade-desert figures (G2: 3
  lessons, G9: 2 lessons) — both the underlying content population and the
  approval-status semantics have changed materially since that audit.
  The NR-11 review-policy question is now resolved by the risk-triage
  prerequisite above: newly generated Grade 2/9 content must use the shared
  triage path, with the highest-risk subset held for genuine human/MOE review.
- **Follow-up backlog item from NR-7:** school-level AI agent cost/usage
  visibility for school ADMINs is now zero (previously a real cross-school
  leak, correctly closed). If wanted as a real feature, needs a schema
  change (`schoolId` on `AgentInvocation`/`AgentCostAccounting`/etc.) plus
  proper per-school filtering, not a permission relaxation. See
  `CONSOLIDATED_BACKLOG.md`, "Follow-ups found during NR-7."
- **Teaching Runtime v1:** all 16 tasks merged to `main` at `61bc3279`;
  production remains disabled until deliberate release approval and
  real-device Whisper push verification
- **Mobile audit:** validated commit `d8da8453` is in `main`; six later
  follow-up paths failed the required full gate and were explicitly discarded
- **Stale worktrees:** mobile-audit and load-test-validation worktrees were
  removed after their merged/equivalent committed work was verified
- **Unattended loop:** design agreed in principle, driver not built; do not
  imply that pending sprints are running automatically
- **Execution limit:** one sprint per unattended cycle, then stop and report
- **Gate trust:** independently re-derive at least one concrete claim from live
  state at every reported success gate

Pending work outside the NR sprint index:

- confirm Supabase, ElevenLabs, Fal.ai, and curriculum daily-budget status
  before paid generation; ElevenLabs balance and pricing require independent
  verification before audio spend
- ask FA whether the drafted Minister Jarso Jallah outreach was ever sent
- re-verify the production homework and labs pipeline counts before relying on
  the stale readiness brief
- keep managed-device deployment deferred until a real pilot's hardware and IT
  constraints are known
- Curriculum Health / Content Lifecycle Agent remains queued as
  detect-and-propose only, with irreversible actions routed to escalation

Historical detail follows. Use the block above to resume; do not scan the
historical sections to select work.

## AI Teaching Runtime v1 (completed 2026-07-29)
- **Plan:** `docs/superpowers/plans/2026-07-28-teaching-runtime-v1.md`
- **Final report:** `docs/audits/TEACHING_RUNTIME_V1_FINAL_REPORT.md`
- **Branch:** `feat/teaching-runtime-v1`
- **Status:** Tasks 1 through 16 COMPLETE and merged to `main` at `61bc3279`
- **Preview:** `https://liberia-learn-m35foesnv-farquema-siryons-projects.vercel.app`
- **Production flag:** remains disabled
- **Sprint scope:** 41 files covering additive persistence, alignment and
  pacing, the governed agent and tools, atomic turn orchestration, offline
  recovery, four tenant-scoped APIs, ledger generation, cost measurement,
  tests, and final certification
- **Final merge gate:** Prisma PASS; TypeScript PASS with 6144 MB heap; Vitest
  PASS (4,409 tests / 537 files); build PASS
- **Task 15 measured cost:** aligned 50-turn session $0.032309; unaligned
  50-turn session $0.013708
- **Task 16 walkthrough:** aligned 10 turns / 1 deferral / WORKSHEET recovery;
  unaligned 10 turns / 5 deferrals; Whisper tool persisted; both ledgers saved
- **Runtime issue closed:** teaching tool argument aliases are normalized before
  strict validation, exact tool schemas are reinforced in the prompt, and
  fail-closed agent errors return structured 503 responses
- **Final review hardening:** Whisper and out-of-scope tools require the model
  target to match the active invocation's session trace; Whisper also verifies
  facilitator and school before reading or sending. Degraded mode can be
  recorded only while a session is active.
- **Production feature flag check:** Vercel production has no
  `AGENT_TEACHING_RUNTIME_ENABLED` variable, so the runtime remains disabled by
  default.
- **Next step:** keep the production feature flag off pending a deliberate
  release and live push-device verification.

### Mobile audit handoff included with final cycle summary
- Validated commit `d8da8453` is an ancestor of `main`.
- Its recorded gate is TypeScript PASS, Vitest PASS (1,541 tests / 204 files),
  build PASS, and encoding repair PASS.
- Six later follow-up paths were reviewed on current `main`. Focused tests
  passed 10/10 and TypeScript passed, but the required unmodified full suite
  failed on unrelated five-second timeout tests and exceeded the command
  ceiling. The follow-ups were therefore not committed and were explicitly
  discarded. The stale worktree and redundant local branch were removed.

## National Rollout Program (active)
- **Plan:** `docs/roadmaps/NATIONAL_ROLLOUT_EXECUTION_PLAN.md`
- **Current sprint:** NR-2 — ECS Worker Autoscale + Queue SLOs
- **Status:** NR-2 COMPLETE (2026-05-18). Re-verified live against AWS on 2026-07-28 after the sprint index table was found marking it PENDING (a stale table, not a real regression): ECS service `liberia-learn-worker` ACTIVE 1/1, autoscaling target `service/liberia-learn/liberia-learn-worker` min1/max10 with a target-tracking policy on `ApproximateNumberOfMessagesVisible` for `liberialearn-jobs.fifo` at target 50 (scale-out 30s / scale-in 120s), both `liberialearn-jobs.fifo` and its DLQ present. Sprint index table corrected to match.
- **Target:** World-class national rollout (all Liberia) — 22 sprints NR-0 through NR-21
- **Next sprint:** **NR-3 — Load-Test Identity Pool.** NR-9.5 — Child Safety Hardening COMPLETE and merged (PR #62). NR-9.6 — Grading Surface Moderation Audit COMPLETE (2026-07-30). Note: NR-3's line previously read "DATABASE_URL Port Fix + PgBouncer Validation", which does not match any defined NR-3 scope in the plan. That item traced back to a real open finding from NR-0/NR-1 ("DATABASE_URL: port 5432 with pgbouncer=true, MISCONFIGURED, needs 6543 for actual pooling") that had never been confirmed fixed. **Verified 2026-07-30:** production `DATABASE_URL` is pooled (`...pooler.supabase.com:6543`, `pgbouncer=true`), set 2026-05-19 and unmodified since per Vercel's env-var metadata — see `docs/roadmaps/CONSOLIDATED_BACKLOG.md`. NR-1's deliverable is genuinely satisfied; NR-3 is unblocked.

### NR-0 + NR-1 Complete (2026-05-18)
Key findings:
- DB: 311 MB, 315 users, 9 schools, 4,363 approved lessons, 3,900 (89%) without audio
- DATABASE_URL: port 5432 with pgbouncer=true → MISCONFIGURED (needs 6543 for actual pooling)
- Curriculum: 62/96 cells at national gate (≥15); 34 zero-lesson deserts; ENGLISH only G5+G7, CS only G5, ENGINEERING_FOUNDATIONS completely empty
- Upstash hard-fail: DONE (lib/rateLimit.ts throws in prod if env vars absent)
- assertProductionEnv() startup check: DONE (lib/startup-checks.ts + app/instrumentation.ts)
- ECS decision: REBUILD-NR2 — 16+ live SQS callers, no consumer running; enqueueJob() now logs explicitly
- feat/phase-5-intelligence-system: DELETED (0 commits ahead of main)
- Build route conflict fixed: [id]/regenerate-audio merged into [contentId]/regenerate-audio
- Build requires NODE_OPTIONS=--max-old-space-size=6144 locally; Vercel CI builds fine

### NR-2 Complete (2026-05-18) — ECS Worker Autoscale + Queue SLOs
Infrastructure provisioned:
- ECS cluster `liberia-learn`: ACTIVE (us-east-1)
- Task definition `liberia-learn-worker:1`: registered (512 CPU / 1024 MB, FARGATE_SPOT weight 4)
- ECS service `liberia-learn-worker`: RUNNING (1/1 tasks at steady state)
- Autoscaling: min 1 / max 10 tasks, target 50 SQS messages, scale-out 30s / scale-in 120s
- SQS queue: `liberialearn-jobs.fifo` (VisibilityTimeout 300s confirmed)
- SQS DLQ: `liberialearn-jobs-dlq.fifo` (maxReceiveCount 3)
- SSM parameters: DATABASE_URL, DIRECT_URL, OPENAI_API_KEY, SQS_QUEUE_URL, SQS_DLQ_URL
- IAM: ecsTaskExecutionRole + AmazonECSTaskExecutionRolePolicy + ECR read + SSM read
- Flood test: 200 HEALTH_CHECK messages sent; queue drained; scale-out observed
Code changes:
- lib/queue.ts: HEALTH_CHECK enum added
- worker/handlers/index.ts: HEALTH_CHECK handler + safe default + noop for unimplemented types
- scripts/flood-test-queue.ts: created
- infra/ecs/worker-task-definition.json: created
- docs/ops/WORKER_DEPLOYMENT.md: updated with actual NR-2 values
Gate: prisma generate PASS, tsc PASS, vitest PASS (3,093 tests / 383 files), build PASS

NR-3 input:
1. Fix DATABASE_URL in Vercel: change port 5432 → 6543 + confirm pgbouncer=true (connection exhaustion risk at scale)
2. Add remaining SSM parameters (ELEVENLABS_API_KEY, ANTHROPIC_API_KEY, AFRICASTALKING_API_KEY, etc.)
3. Confirm worker drains backlog accumulated during ECS-dark period
4. NR-14: Audio pipeline for 3,900 no-audio lessons (GENERATE_LESSON_AUDIO worker handler)
5. NR-13: ENGLISH (10 deserts), CS (11 deserts), ENGINEERING_FOUNDATIONS (12 deserts)

## Fix 1 — Connection Pool (connection_limit=1)
- `lib/db.ts` now injects `connection_limit=1` into the database URL programmatically if not already present.
- `prisma/schema.prisma` datasource has both `url = env("DATABASE_URL")` and `directUrl = env("DIRECT_URL")`.
- **DATABASE_URL** must be the Supabase PgBouncer pooled URL (port 6543, pgbouncer=true in query string).
- **DIRECT_URL** must be the direct Postgres URL (port 5432, no pgbouncer param) — used by Prisma Migrate.
- `connection_limit=1` prevents connection exhaustion in serverless (each function instance uses 1 connection via PgBouncer).

## Phase 5.1.6 Curriculum Reliability Closure
- Current sprint: Phase 5.1.6 Curriculum Reliability Closure
- Current branch: `feat/phase-5-1-5-production-validation`
- Status: COMPLETE. Long-lesson elite upgrade reliability, platform-authoritative scoring alignment, and stable admin review evidence were closed on the existing curriculum upgrade path.
- Scope: fix only the known Phase 5.1.5 blockers. No new AI route, prompt registry system, curriculum model, or governance workflow was added.
- Root cause closed:
  - long real lessons were sending overly large source payloads into the elite prompt, increasing truncation/invalid JSON risk
  - parser and repair handling allowed malformed output retries but were still too brittle for some truncated long responses
  - review validation relied on brittle browser assertions instead of the stable review and approval surfaces already present
- Closure changes:
  - elite prompt input is now compacted to the curriculum fields needed for upgrade quality
  - elite parsing now requires the full reviewable lesson section set so partial JSON cannot count as success
  - retries and repair are bounded and elite-only, with compact fallback repair instructions for long lessons
  - platform content scoring remains authoritative; model self-scores are preserved as audit metadata only
  - review UI shows score source, model self-score, section improvements, and gold-standard status
  - Playwright validation supports exact lesson selection, stable dashboard waits, and approval fallback through the existing route
- Targeted validation:
  - single long lesson rerun: `math-g12-8-problem-solving-and-review-assessment-and-reflection` PASS
  - focused 10-lesson representative rerun batch: PASS
  - single-lesson admin approval + MOE visibility walkthrough: PASS
- Final gate:
  - `npx prisma generate`: PASS
  - `npx tsc --noEmit`: PASS
  - `npm test`: PASS (1976 tests, 280 files)
  - `npm run build`: PASS
  - `npx playwright test`: PASS (12 tests)

## AI Labs V1 Current State
- Current workstream: AI Labs V1
- Current phase: Phase 5 Batch 4 Earth Science Labs COMPLETE. All 12 labs live.
- Current branch: `main`
- Worktree status: Phase 5 Batch 4 committed, pushed, deployed, and verified on production.
- Last completed phase: AI Labs V1 Phase 5 Batch 4 - Earth Science Labs
- Last commit reference: `ee8dd3f feat(labs): complete phase 5 batch 4 earth science labs`

## AI Labs V1 Phase 2 Validation
- `npx prisma generate`: PASS
- `npx tsc --noEmit`: PASS (0 errors)
- `npm test`: PASS (1843 tests, 256 files)
- `npm run build`: PASS (exit 0)
- Gravity scene dynamic chunks: PASS (`2232...js` 2.3 KB fallback, `7704...js` 3.2 KB scene; both under 200 KB)

## AI Labs V1 Phase 2 Deliverables
| Feature | Route / File | Notes |
|---------|--------------|-------|
| Gravity lab state/actions | `lib/labs/gravity-explorer/` | Typed state, action union, deterministic runtime, validator |
| Lab registry entry | `lib/labs/registry.ts` | `gravity-explorer`, tier 1, Physics Grades 7-9 |
| Runtime dispatch | `lib/labs/runtime/*` | Gravity apply/validate dispatchers wired |
| Canvas scene | `components/labs/gravity-explorer/Scene.tsx` | 2D animation, trail, velocity color, readout, controls |
| Low-end fallback | `components/labs/gravity-explorer/Fallback.tsx` | 2D canvas fallback with height bar and controls |
| Lab page | `/student/labs/gravity-explorer` | Student-only route with lab open telemetry |
| Lesson integration | `/student/lessons/[id]` | Physics Grades 7-9 shows slide-over "Open Gravity Lab" entry point |
| AI loop | `/api/labs/gravity-explorer/plan`, `/api/labs/gravity-explorer/explain` | Planner validates actions, frontend applies runtime state, explainer returns tutor text |
| Tests | `__tests__/labs/` | Gravity runtime and validator coverage added |

## AI Labs V1 Phase 3 Deliverables
| Feature | Route / File | Notes |
|---------|--------------|-------|
| Pendulum Lab partial | `lib/labs/pendulum-lab/` | Typed state/actions/runtime/validator only; tier 1; partial registry entry |
| Molecule Motion partial | `lib/labs/molecule-motion/` | Typed state/actions/runtime/validator only; tier 1; partial registry entry |
| Human Heart Simulator partial | `lib/labs/human-heart/` | Typed state/actions/runtime/validator only; tier 2; partial registry entry |
| Registry count | `lib/labs/registry.ts` | 4 registered labs total: Gravity complete + 3 partial labs |
| Runtime dispatch | `lib/labs/runtime/*` | Apply/validate dispatchers wired for all 4 registered labs |
| Tests | `__tests__/labs/` | Pendulum, Molecule Motion, and Human Heart runtime coverage added |

## AI Labs V1 Phase 4 Deliverables
| Feature | Route / File | Notes |
|---------|--------------|-------|
| Pendulum Lab complete | `/student/labs/pendulum-lab` | 2D canvas pendulum scene, low-end fallback, LabShell AI loop, lesson slide-over entry |
| Molecule Motion complete | `/student/labs/molecule-motion` | 2D particle scene with phase transitions, low-end fallback, LabShell AI loop, lesson slide-over entry |
| Human Heart complete | `/student/labs/human-heart` | 2D heart chamber pulse scene, low-end fallback, LabShell AI loop, lesson slide-over entry |
| Lesson integration | `/student/lessons/[id]` | Physics 7-9: Gravity + Pendulum; Chemistry 9-11: Molecule Motion; Biology 8-10: Human Heart |
| Labs index | `/student/labs` | Registered labs shown as cards with Open Lab actions and coming-soon handling |
| Registry status | `lib/labs/registry.ts` | 4 registered complete labs; no Phase 3 partial flags remain |

## AI Labs V1 Phase 4 Validation
- `npx prisma generate`: PASS
- `npx tsc --noEmit`: PASS (0 errors)
- `npm test`: PASS (1864 tests, 259 files)
- `npm run build`: PASS (exit 0)
- Live production route verification: PASS for `/student/labs/pendulum-lab`, `/student/labs/molecule-motion`, `/student/labs/human-heart`
- Live production AI loop verification: PASS for Pendulum `SET_LENGTH`, Molecule Motion `SET_TEMPERATURE`, Human Heart `SET_EXERCISE_LEVEL`
- Live 375px canvas verification: PASS for all three labs
- Live lesson slide-over integration verification: PASS for Physics/Pendulum, Chemistry/Molecule, Biology/Heart

## AI Labs V1 Phase 5 Batch 1 Deliverables
| Feature | Route / File | Notes |
|---------|--------------|-------|
| Electric Circuit Builder | `/student/labs/electric-circuit` | 2D canvas circuit scene, low-end fallback, LabShell AI loop, registry/runtime/validator wiring, lesson slide-over entry |
| Wave Motion Lab | `/student/labs/wave-motion` | 2D transverse/longitudinal wave scene, low-end fallback, LabShell AI loop, registry/runtime/validator wiring, lesson slide-over entry |
| Lesson integration | `/student/lessons/[id]` | Physics Grades 9-11 shows Open Circuit Lab; Physics Grades 10-12 shows Open Wave Lab |
| Registry status | `lib/labs/registry.ts` | 6 registered complete labs |

## AI Labs V1 Phase 5 Batch 1 Validation
- `npx prisma generate`: PASS
- `npx tsc --noEmit`: PASS (0 errors)
- `npm test`: PASS (1883 tests, 263 files)
- `npm run build`: PASS (exit 0)
- Electric Circuit scene chunk: PASS (`1782...js` 4.3 KB scene; fallback `9453...js` 1.3 KB; both under 200 KB)
- Wave Motion scene chunk: PASS (`7569...js` 4.6 KB scene; fallback `1163...js` 1.5 KB; both under 200 KB)
- Live production route verification: PASS for `/student/labs/electric-circuit` and `/student/labs/wave-motion`
- Live production AI loop verification: PASS for Electric Circuit `SET_VOLTAGE` and Wave Motion `SET_AMPLITUDE`
- Live lesson slide-over integration verification: PASS by lesson mapping for Physics Grades 9-11 Circuit and Grades 10-12 Wave
- Production deploy: PASS, aliased to `https://liberia-learn.vercel.app`
- GitHub Actions on latest main: PASS, all 4 workflows green (`PR Triage`, `Runtime Gate 1`, `Deploy ECS Images`, `CI`)

## AI Labs V1 Phase 5 Batch 2 Deliverables
| Feature | Route / File | Notes |
|---------|--------------|-------|
| Cell Division Explorer | `/student/labs/cell-division` | 2D canvas mitosis stage scene, low-end fallback, LabShell AI loop, registry/runtime/validator wiring, lesson slide-over entry |
| Ecosystem Balance Lab | `/student/labs/ecosystem-balance` | 2D ecosystem terrain, drought overlay, population history graph, stable trophic runtime, low-end fallback, LabShell AI loop, lesson slide-over entry |
| Lesson integration | `/student/lessons/[id]` | Biology Grades 9-11 shows Open Cell Division Lab; Biology Grades 7-9 shows Open Ecosystem Lab |
| Registry status | `lib/labs/registry.ts` | 8 registered complete labs |

## AI Labs V1 Phase 5 Batch 2 Validation
- `npx prisma generate`: PASS
- `npx tsc --noEmit`: PASS (0 errors)
- `npm test`: PASS (1896 tests, 265 files)
- `npm run build`: PASS (exit 0)
- Cell Division route chunk: PASS (`page-90a8436f27732e2e.js` 9.13 KB; under 200 KB)
- Ecosystem Balance route chunk: PASS (`page-9177738ea74b4baa.js` 9.54 KB; under 200 KB)
- Ecosystem stability test: PASS, 200 STEP iterations keep plants, herbivores, and carnivores above zero
- Live production route verification: PASS for `/student/labs/cell-division` and `/student/labs/ecosystem-balance`
- Live production AI loop verification: PASS for Cell Division `ADVANCE_STAGE` to metaphase and Ecosystem Balance `ADD_DROUGHT`
- Live lesson slide-over integration verification: PASS by lesson mapping for Biology Grades 9-11 Cell Division and Grades 7-9 Ecosystem
- Production deploy: PASS, aliased to `https://liberia-learn.vercel.app`
- GitHub Actions on latest main: PASS, all 4 workflows green (`PR Triage`, `Runtime Gate 1`, `Deploy ECS Images`, `CI`)

## AI Labs V1 Phase 5 Batch 3 Deliverables
| Feature | Route / File | Notes |
|---------|--------------|-------|
| Chemical Reaction Lab | `/student/labs/chemical-reaction` | 2D canvas reaction vessel, molecule/collision animation, catalyst and temperature controls, LabShell AI loop, registry/runtime/validator wiring, lesson slide-over entry |
| Periodic Table Explorer | `/student/labs/periodic-table` | 118-element dataset, 2D table/Bohr/properties canvas views, low-end fallback, LabShell AI loop, registry/runtime/validator wiring, lesson slide-over entry |
| Lesson integration | `/student/lessons/[id]` | Chemistry Grades 10-12 shows Open Reaction Lab; Chemistry Grades 9-12 shows Open Periodic Table Lab |
| Registry status | `lib/labs/registry.ts` | 10 registered complete labs |

## AI Labs V1 Phase 5 Batch 3 Validation
- `npx prisma generate`: PASS
- `npx tsc --noEmit`: PASS (0 errors)
- `npm test`: PASS (1912 tests, 268 files)
- `npm run build`: PASS (exit 0)
- Periodic element data accuracy test: PASS, all 118 elements present with required fields and reference checks for H, C, Au, and Og
- Chemical Reaction bundle: PASS (`page-59f173b864b25351.js` 9.25 KB route; `5729...js` 6.02 KB scene; `6503...js` 1.67 KB fallback; all under 200 KB)
- Periodic Table bundle: PASS (`2578...js` 35.91 KB page/data; `5226...js` 6.76 KB scene; `4298...js` 2.28 KB fallback; all under 200 KB)
- Live production route verification: PASS for `/student/labs/chemical-reaction` and `/student/labs/periodic-table`
- Live production AI loop verification: PASS for Chemical Reaction `ADD_CATALYST` and Periodic Table `HIGHLIGHT_CATEGORY`
- Live lesson slide-over integration verification: PASS by lesson mapping for Chemistry Grades 10-12 Reaction and Grades 9-12 Periodic Table
- Production deploy: PASS, aliased to `https://liberia-learn.vercel.app`
- GitHub Actions on latest main: PASS, all 4 workflows green (`PR Triage`, `Runtime Gate 1`, `Deploy ECS Images`, `CI`)

## AI Labs V1 Phase 5 Batch 4 Deliverables
| Feature | Route / File | Notes |
|---------|--------------|-------|
| Weather System Lab | `/student/labs/weather-system` | 2D canvas weather scene, cloud/precipitation animation, wet/dry season controls, LabShell AI loop, registry/runtime/validator wiring, lesson slide-over entry |
| Tectonic Plates Lab | `/student/labs/tectonic-plates` | 2D cross-section plate boundary scene, pressure/risk model, earthquake/eruption events, LabShell AI loop, registry/runtime/validator wiring, lesson slide-over entry |
| Lesson integration | `/student/lessons/[id]` | Earth Science Grades 7-9 shows Open Weather Lab; Earth Science Grades 8-10 shows Open Tectonic Plates Lab |
| Labs index | `/student/labs` | All 12 labs grouped by subject with no coming-soon placeholders |
| Registry status | `lib/labs/registry.ts` | 12 registered complete labs |

## AI Labs V1 Phase 5 Batch 4 Validation
- `npx prisma generate`: PASS
- `npx tsc --noEmit`: PASS (0 errors)
- `npm test`: PASS (1932 tests, 270 files)
- `npm run build`: PASS (exit 0)
- Weather System bundle: PASS (`page-cde9bf16fb09ee4c.js` 8.99 KB route; `7752...js` 6.12 KB scene; `5608...js` 1.17 KB fallback; all under 200 KB)
- Tectonic Plates bundle: PASS (`page-82b23ee6724325a5.js` 9.33 KB route; `6618...js` 6.85 KB scene; `2000...js` 1.54 KB fallback; all under 200 KB)
- Live production route verification: PASS for `/student/labs/weather-system` and `/student/labs/tectonic-plates`
- Live production AI loop verification: PASS for Weather System `SIMULATE_STORM` and Tectonic Plates `SET_BOUNDARY_TYPE`
- Live labs index verification: PASS, `/student/labs` shows all 12 labs grouped by Physics, Biology, Chemistry, and Earth Science with no coming-soon placeholders
- Production deploy: PASS, aliased to `https://liberia-learn.vercel.app`
- GitHub Actions on latest main: PASS, all 4 workflows green (`PR Triage`, `Runtime Gate 1`, `Deploy ECS Images`, `CI`)

## Current workstream
Phase 5 Production Intelligence + Curriculum System

## Current sprint or phase
Phase 5 Phase 6 final gate in progress. Phases 0-5 are implemented and individually gated; Phase 6 integrity audit, generic lesson multimedia parity, and final Playwright coverage are being validated.

## Current branch
feat/phase-5-intelligence-system

## Phase 4.5 Demo Access
- Student: `<E2E_DEMO_STUDENT_EMAIL>` / `<DEMO_PASSWORD>` lands on `/dashboard`; first click `/student/today`; seeded lesson `/student/lessons/cha-demo-student1-multimedia-lesson`.
- Teacher: `<E2E_DEMO_TEACHER_EMAIL>` / `<DEMO_PASSWORD>` lands on `/teacher`; first click curriculum lesson management and video upload.
- Guardian: `<E2E_DEMO_GUARDIAN_EMAIL>` / `<DEMO_PASSWORD>` lands on `/guardian`; sees linked student Fatu Kollie.
- School Admin: `<E2E_DEMO_ADMIN_EMAIL>` / `<DEMO_PASSWORD>` lands on `/admin`; first click curriculum/audio tools and analytics.
- Platform Admin: `platform.admin@liberialearn.org` / `<DEMO_PASSWORD>` lands on `/platform`; sees platform operations surfaces.
- MOE Official: `<E2E_DEMO_MOE_EMAIL>` / `<DEMO_MOE_PASSWORD>` lands on `/moe/dashboard`; sees national analytics.

## Phase 4.5 Seeded Data Summary
- CHA school, Grade 9A Mathematics class, teacher, student, guardian, admin, MOE official, and platform admin are upserted by `npm run seed:cha`.
- Stable lesson: `Ratios in Market Prices`, content id `cha-g9-math-multimedia-demo`, scheduled work id `cha-demo-student1-multimedia-lesson`.
- Student surfaces include `/student/today`, `/student/exams`, `/student/certificates`, and `/student/textbooks`.
- Seed includes a published Grade 9 ratios exam, one lesson certificate, and multimedia learning events for Read, Slides, Listen, audio, and video analytics.

## Phase 4.5 Completion Summary
| Area | Status | Notes |
|------|--------|-------|
| Student navigation | COMPLETE | Exams, certificates, and textbooks routes resolve to real pages; textbooks no longer collides with `/student/[id]`; sidebar uses an accessible book icon. |
| Demo system | COMPLETE | `DEMO_ACCESS.md` documents student, teacher, guardian, school admin, platform admin, and MOE official accounts with first-click guidance. |
| MOE/Admin analytics | COMPLETE | Real aggregation from `LearningEvent`, `LessonAudio`, and `LessonVideo` powers lesson mode usage, engagement, audio usage, video usage, and cost summaries. |
| Audio system | COMPLETE | Admin curriculum page can batch queue approved lessons, process pending jobs, show status, and expose cost/status aggregation. |
| Video system | COMPLETE | Teacher uploads a generated WebM test clip, activates it, and student lesson playback shows the active video in production. Missing Supabase storage config falls back only for playable demo storage; real upload errors still fail. |
| Homepage hero | COMPLETE | Desktop hero layout rebalanced while maintaining 375px mobile quality. |
| Reviewer flow | COMPLETE | Production Playwright verifies student, teacher, admin, MOE, guardian, and platform admin first-click walkthroughs. |
| Cleanup | COMPLETE | `.git-temp-phase1` removed; `.git-temp-sprint2` absent; `.git-temp*`, `node_modules`, and `e2e/screenshots` covered by `.vercelignore`. |

## Phase 4.5 Production Validation
- `npm run seed:cha`: PASS; all six demo accounts upserted in the production-backed database.
- `npx prisma generate`: PASS.
- `npx tsc --noEmit`: PASS (0 errors).
- `npm test`: PASS (1951 tests, 274 files).
- `npm run build`: PASS (208 static pages; existing Sentry/OpenTelemetry warnings only).
- `npx playwright test`: PASS (6 production reviewer-flow tests).
- Production deploy: PASS, aliased to `https://liberia-learn.vercel.app`; deployment `dpl_APMaYiszSzo9V4JCkfuqAwwucQqk`.

## Phase 4.6 Completion Summary
| Area | Status | Notes |
|------|--------|-------|
| Student flow breaks | COMPLETE | Certificates and progress now expose clear `Back to Dashboard` navigation to `/dashboard`; stale `/student/dashboard` links were corrected. |
| Today experience | COMPLETE | `/student/today` is a real daily-flow page with ordered subjects, current/next lesson, completed/remaining counts, and Continue/Quiz/Lab quick actions. |
| Lesson navigation structure | COMPLETE | Today CTAs now land on `/student/today`; My Lessons remains a catalog/library destination only. |
| CTA/route consistency | COMPLETE | Student primary CTAs, dead `href="#"` states, MOE export disabled actions, and legacy student dashboard links were audited and corrected. |
| Homepage upgrade | COMPLETE | Old numeric metric block was replaced with six capability proof blocks: curriculum delivery, AI tutoring, offline-first access, national oversight, teacher tools, and student outcomes. |
| Playwright flow validation | COMPLETE | `e2e/flow-integrity.spec.ts` validates student Today routing, Continue lesson, certificates/progress dashboard return, homepage capability blocks, and 375px no-overflow. |

## Phase 4.6 Production Validation
- `npm run seed:cha`: PASS; all six demo accounts upserted in the production-backed database.
- `npx prisma generate`: PASS.
- `npx tsc --noEmit`: PASS (0 errors).
- `npm test`: PASS (1951 tests, 274 files).
- `npm run build`: PASS (208 static pages; existing Sentry/OpenTelemetry warnings only).
- `npx playwright test` with `PLAYWRIGHT_BASE_URL=https://liberia-learn.vercel.app`: PASS (9 browser tests).
- Production deploy: PASS, aliased to `https://liberia-learn.vercel.app`; deployment `dpl_HtJ2RmoTxbGqtj8wHZaKyWeR95H1`.

## Phase 5 Production Intelligence Summary
| Phase | Status | Notes |
|-------|--------|-------|
| Phase 0 System inventory | COMPLETE | `docs/PHASE5_SYSTEM_INVENTORY.md` maps analytics, mastery, AI routing, curriculum, dashboards, queue, costs, Today, and multimedia paths. |
| Phase 1 Learning intelligence | COMPLETE | Student progress and teacher performance surfaces now expose mastery, weaknesses, recommended actions, struggling students, top performers, low-performing lessons, and interventions. |
| Phase 2 Admin/MOE intelligence | COMPLETE | Existing admin and MOE dashboards include real-data decision support for engagement, performance, teacher effectiveness proxy, district/school comparisons, subject heatmaps, adoption, and readiness. |
| Phase 3 Curriculum ingestion | COMPLETE | Admin curriculum import accepts PDF, DOCX, JSON, and structured text, parses into existing `CurriculumContent` and `CurriculumVersion`, and enters the existing review flow. |
| Phase 4 Elite curriculum upgrade | COMPLETE | Prompt registry and AI router now create governed elite upgrade drafts with quality scoring, original preservation, and side-by-side review UX. |
| Phase 5 Adaptive Today | COMPLETE | `/api/student/today` now returns deterministic `adaptivePlan` prioritizing scheduled work, weak areas, incomplete lessons, and next best actions. |
| Phase 6 Integrity/QA | IN PROGRESS | `docs/PHASE5_DUPLICATION_AUDIT.md` confirms no duplicate systems; generic library lessons now expose Read/Slides/Listen modes from the same multimedia payload fields. |

## Phase 5 Validation To Date
- Phase 0 gate: `npx tsc --noEmit` PASS; `npm test` PASS (1951 tests, 274 files); `npm run build` PASS.
- Phase 1 gate: `npx tsc --noEmit` PASS; `npm test` PASS (1952 tests, 275 files); `npm run build` PASS.
- Phase 2 gate: `npx tsc --noEmit` PASS; `npm test` PASS (1954 tests, 276 files); `npm run build` PASS.
- Phase 3 gate: `npx tsc --noEmit` PASS; `npm test` PASS (1956 tests, 277 files); `npm run build` PASS.
- Phase 4 gate: `npx tsc --noEmit` PASS; `npm test` PASS (1958 tests, 278 files); `npm run build` PASS.
- Phase 5 gate: `npx tsc --noEmit` PASS; `npm test` PASS (1960 tests, 279 files); `npm run build` PASS.
- Final Phase 6 gate: pending full sequence.

## Multimedia Lesson Delivery Sprint seed note
- Seeded student user: `<E2E_DEMO_STUDENT_EMAIL>` / `<DEMO_PASSWORD>`
- Seeded lesson title: `Ratios in Market Prices`
- Seeded lesson content id: `cha-g9-math-multimedia-demo`
- Seeded scheduled work id: `cha-demo-student1-multimedia-lesson`
- Direct student lesson path: `/student/lessons/cha-demo-student1-multimedia-lesson`
- Student surface: `/student/today` shows the lesson for the current UTC day after running `npm run seed:cha`
- Recreate fixture: run `npm run seed:cha`, which upserts the CHA school, teacher, student, enrollment, curriculum content, and scheduled work.

## Worktree status
Phase 5 implementation is complete on `feat/phase-5-intelligence-system`. Final local validation passed. Commit, push to main, production deploy, and GitHub Actions confirmation remain.

## Overall status
Sprints 1-16 + 16B + 16C + 16D + 16E + 16F + Dashboard UX complete. All role portals now share a consistent design system: DashboardTopBar, KPI cards, primary actions above fold, and role accent colours.

## Last completed phase
Phase 5 Production Intelligence + Curriculum System

## Last commit reference
Pending Phase 5 commit

## Last successful validation (Phase 5)
- `npx prisma generate`: PASS
- `npx tsc --noEmit`: PASS
- `npm test`: PASS, 279 files / 1960 tests
- `npm run build`: PASS, 209 app routes generated
- `npx playwright test`: PASS, 11 tests
- Playwright verified seeded lesson `/student/lessons/cha-demo-student1-multimedia-lesson` still exposes Read / Slides / Listen.
- Playwright verified generic library lesson `/student/lesson/cha-g9-math-multimedia-demo` now exposes Read / Slides / Listen.

## Phase 5 Completion Summary
- Phase 0 inventory documented existing analytics, mastery, recommendations, AI routing, curriculum governance, queue, storage, dashboards, Today sequencing, and multimedia delivery in `docs/PHASE5_SYSTEM_INVENTORY.md`.
- Phase 1 extended existing student progress and teacher performance surfaces with learning intelligence, weakness detection, confidence tiers, recommended next actions, and class insight blocks.
- Phase 2 extended existing admin and MOE analytics with real-data decision-support summaries, engagement levels, performance distributions, weak subjects, district/school comparisons, usage trends, and readiness summaries.
- Phase 3 added curriculum import for PDF, DOCX, JSON, and structured text into existing `CurriculumContent` / `CurriculumVersion` records, with validation and audit logging.
- Phase 4 added elite curriculum upgrade prompts through the existing prompt registry and routed AI path, preserving original imported content and producing reviewable upgraded drafts with quality score deltas.
- Phase 5 made `/student/today` adaptive and deterministic by prioritizing scheduled work, weak areas, incomplete lessons, and next best lessons.
- Phase 6 documented duplication audit in `docs/PHASE5_DUPLICATION_AUDIT.md` and extended Playwright coverage for student, teacher, admin, MOE, guardian, platform admin, video, audio, analytics, and multimedia mode flows.

## Sprint 16F Deliverables
| Feature | Route / File | Notes |
|---------|--------------|-------|
| Privacy Policy | `/legal/privacy` | Full policy content, effective April 2026, LiberiaLearn / Republic of Liberia governing entity |
| Terms of Service | `/legal/terms` | Full terms content, K-12 education purpose, acceptable use, governing law |
| Data Handling for Minors | `/legal/data-for-minors` | Guardian rights, no advertising/profiling, contact path for data concerns |
| Contact page | `/contact` | Data requests, school enrollment questions, and technical support contacts |
| Consent acceptance | `components/ConsentGate.tsx`, `/api/legal/accept-policy` | Non-dismissible first-login modal for current policy version `2026-04` |
| Policy acceptance storage | `DataPolicyAcceptance`, `ConsentRecord` | Stores user, version, timestamp, source, and request IP address |
| Portal legal footer | all role portal shells/layouts | Links to privacy, terms, minors data policy, and contact |
| Cookie notice | public pages only | One-time localStorage dismissal; session cookies only, no tracking or advertising cookies |

## Sprint 16B Security Findings
| ID | Severity | File | Fix |
|----|----------|------|-----|
| FINDING-1 | CRITICAL | app/api/auth/login/route.ts | Removed hardcoded JWT_SECRET fallback; throws 500 if unset |
| FINDING-2 | HIGH | app/api/auth/reset-password/route.ts | Removed plaintext token OR fallback; query by tokenHash only |
| FINDING-3 | HIGH | app/api/placement/calculate-grade/route.ts | Added AI_HEAVY rate limiting per user |
| FINDING-4 | HIGH | next.config.js | Added Content-Security-Policy header |
| FINDING-5 | HIGH | app/api/moe/export/district/[district]/route.ts | Added rate limiting (30/hr per user) |
| FINDING-6 | MEDIUM | app/api/admin/governance/exports/ (6 routes) | Documented; protected by role checks |
| FINDING-7 | MEDIUM | Student performance national export | Documented; platform-admin-only export management |
| FINDING-8 | PASS | app/verify/[certificateCode] | First name + course + date only; crypto.randomBytes codes |
| FINDING-9 | PASS | app/api/moe/dashboard | Aggregate only; cohort suppression n<5; no PII drilldown |

## Sprint 16D Email Deliverability Results
| Touchpoint | Status | Notes |
|------------|--------|-------|
| School enrollment confirmation to principal | IMPLEMENTED | Routed through central email helper |
| Admin notification of new pending school | IMPLEMENTED | Routed through central email helper |
| School approval notification | IMPLEMENTED | Routed through central email helper |
| School rejection notification with reason | IMPLEMENTED | Routed through central email helper |
| Teacher invite email | IMPLEMENTED | Best-effort send handling |
| Student welcome email | IMPLEMENTED | Central branded template |
| Guardian welcome email | IMPLEMENTED | Added post-registration welcome send |
| Password reset | IMPLEMENTED | Send failure no longer crashes parent operation |
| Certificate awarded notification | IMPLEMENTED | Added best-effort certificate email |
| Guardian weekly digest | IMPLEMENTED | Email route supports weekly progress digest |
| Assignment due notification | IMPLEMENTED | Added best-effort assignment due email |

Email delivery guardrails: `sendEmail()` returns early in tests, production sends only when credentials are present, all provider sends use plain text fallback, and warnings log email type plus recipient role only.

## Sprint 16E Load Test Results
| Scenario | VUs | Duration | p95 | Error Rate | Result |
|----------|-----|----------|-----|------------|--------|
| Baseline | 100 | 5m | 602ms | 0.00% | PASS |
| AI Load | 50 | 3m | 265ms | 0.00% | PASS |
| Moderate | 1000 | 10m | 8,474ms | 34.74% | FAIL |
| Peak | 5000 | 5m | - | - | NOT RUN |

Root cause (Moderate FAIL): Vercel free tier concurrency cap + single demo credential auth rate limiting. CDN/page layer held at 97-99%. API routes saturated. Proven threshold: **100-VU p95 < 600ms**.

Required before national scale sign-off: Vercel Pro upgrade + seed load-test user pool (100+ unique students).

## Sprint 16C Deliverables
| Feature | Route | Notes |
|---------|-------|-------|
| Student self-registration | POST /api/register/student | School code + DOB + grade; email/phone optional; rate limit 10/hr/IP |
| Guardian self-registration | POST /api/register/guardian | Student match by name+DOB+code; no existence leak on mismatch |
| Student registration page | /register/student | Form with ?code= prefill from shareable link |
| Guardian registration page | /register/guardian | Links to student registration |
| School code on dashboard | /teacher/dashboard | Prominent display + copy-to-clipboard + shareable link |

## Phase status
- Sprints 1-16 + 16B + 16C + 16D + 16E + 16F complete
- Test baseline: 1820 passing tests (250 files)
- Security: OWASP-hardened
- Self-registration: Live at /register/student and /register/guardian
- Email deliverability: Verified and configured through central sendEmail() path
- Load tested: 100-VU baseline PASS; national scale requires Vercel Pro
- Legal/compliance: Privacy, terms, minors data, contact, consent acceptance, footers, and cookie notice complete
- System sign-off: SYSTEM-COMPLETE + SECURITY-HARDENED + LOAD-VALIDATED + SELF-REGISTRATION + EMAIL-VERIFIED + LEGAL-COMPLETE

## Sprint history (all on main target)

| Sprint | Deliverable | Commit | Tests |
|--------|-------------|--------|-------|
| 1-3 | Platform foundation, AI factory, mastery/interventions | pre-2bf49f6 | - |
| 4 | AI Telemetry + Versioning + Offline Sync Integrity | 2bf49f6 | - |
| 5 | Offline lesson delivery, Teacher weekly report, SMS dry-run gate | 6f93bae | 1649 |
| 6 | MOE National Dashboard + Student Learning Passport | 5c14e44 | 1671 |
| 7 | Governance + Anonymized Exports + Analytics APIs | 3c22ed2 | 1714 |
| 8 | Tests + Docs + Final Foundation Hardening | 0743cfc | 1731 |
| 9-15 | Phase 2 product, operations, and delivery hardening | completed before Sprint 16 Phase C sign-off | 1781+ |
| 16 | Final System Audit + Sign-Off | 811d8a2 | 1787 |
| 16B | OWASP Security Hardening Audit | 79a21a1 | 1787 |
| 16C | Student and Guardian Self-Registration | 9d2bf40 | 1805 |
| 16D | Email Deliverability Verification | ce8ec48 | 1805 |
| 16E | Load Test Validation | a0f50ae | 1787 |
| 16F | Legal and Compliance Pages | Pending Sprint 16F commit | 1820 |

## Untracked files (not part of Sprint 16F)
- `.git-temp-sprint2/`
- `e2e/`
- `playwright.config.ts`
- `prisma/migrations/20260416_100000_curriculum_version/`

## Online School Build Program
Full build plan: `docs/roadmaps/ONLINE_SCHOOL_BUILD.md`

| Sprint | Deliverable | Status |
|--------|-------------|--------|
| 1 | Lesson Regeneration Direct Processor | COMPLETE |
| 2 | Assignment Grading + Gradebook | COMPLETE |
| 3 | Term Report Cards | COMPLETE |
| 4 | Push Notifications + PWA Install | COMPLETE |
| 5 | School Events Calendar | COMPLETE |
| 6 | Live Class Sessions (Jitsi) | COMPLETE |
| 7 | Class Discussion Boards | COMPLETE |
| 8 | Guardian Portal Enhancement | COMPLETE |
| 9 | Canva Documents Suite | COMPLETE |
| 10 | Student Portfolio + Capstone | COMPLETE |
| 11 | Mobile PWA + Offline Enhancement | COMPLETE |
| 12 | Two-Way Student↔Teacher Messaging | COMPLETE |
| 13 | Messaging Hardening + Attachments | COMPLETE |
| 14 | Video delivery, analytics, guardian parity, FTS, a11y, gamification | COMPLETE |

## Sprint 1 COMPLETE — 2026-05-12
- `scripts/process-regen-jobs-direct.ts` — SHIPPED (commits 7e20684 + da717ff)
- `scripts/regen-status.ts` — SHIPPED
- `scripts/spot-check-approved.ts` — SHIPPED
- Gate: `npx tsc --noEmit` PASS, `npx vitest run` PASS (2601 tests / 348 files), `npm run build` PASS
- Schema fixes: `LabObservationFieldSchema.choices` .nullish, superRefine "either" → at-least-one
- Factory fix: max_tokens std 3000→6000, block 4000→8000; lessonFormat "either" (9000) for regen
- Processor fix: body_block priority for depth validation
- Validation run (--limit 50 --grade 7): 11 OK / 39 FAILED / 0 SKIPPED
- Spot-check (3 lessons): all PASS (18 slides, 1237–1355 words)
- DB state after validation: 3,852 APPROVED (+13), 1,208 NEEDS_REVIEW, 670 PENDING jobs, 114 APPROVED jobs

## Sprint 1 Known Limitations
- G3 SCIENCE: ~5–8% per-attempt pass rate — AI generates 700–1000 words for Grade 3 simple topics; well below 1200-word gate
- G5 ENGLISH: ~10–20% per-attempt pass rate — AI generates 1000–1150 words; close but below threshold
- G7 CIVICS: ~22% per-attempt pass rate — AI generates 850–1600 words; higher words pass, lower words fail
- Jobs with `status: "failed"` are re-processed on the next run. Multiple overnight runs needed to converge backlog.
- Overnight command: `npx dotenv -e .env.production -- npx tsx scripts/process-regen-jobs-direct.ts`

## Sprint 3 COMPLETE — 2026-05-12
- ReportCard model + migration `20260512_000001_sprint3_report_cards` — SHIPPED (commit b20a15a)
- `lib/reportCards/generateReportCard.ts` — SHIPPED
- `/admin/report-cards`, `/teacher/report-cards`, `/student/report-cards`, `/guardian/report-cards` — SHIPPED
- `/student/report-cards/[id]/print` — A4 print layout, grade table, signatures — SHIPPED
- All 5 APIs (generate, comment, publish, publish-all, listing routes) — SHIPPED
- Dashboard widgets: student Latest Report Card card, guardian Report Card Available banner, teacher nudge — SHIPPED
- Gate: `npx tsc --noEmit` PASS, `npx vitest run` PASS (2655 tests / 351 files), `npm run build` PASS
- 16 new tests in `__tests__/sprint3.reportcards.test.ts`

## Sprint 4 COMPLETE — 2026-05-12
- PushSubscription model + migration `20260512_000002_sprint4_push_subscriptions` — SHIPPED
- `lib/push/sendPush.ts` — `sendPushToUser`, `sendPushToMany`, expired-sub cleanup — SHIPPED
- APIs: `GET /api/notifications/vapid-public-key`, `POST /api/notifications/subscribe`, `DELETE /api/notifications/unsubscribe` — SHIPPED
- `public/sw.js` — push + notificationclick handlers appended — SHIPPED
- `public/manifest.json` — background_color #0a0a0a, theme_color #f5c518 — SHIPPED
- `components/PushPermissionPrompt.tsx` — 30s delay, Turn On/Not Now, 7-day dismiss, VAPID subscribe flow — SHIPPED
- Layout wiring: student, teacher, guardian layouts — SHIPPED
- Push triggers: assignment graded, assignment created (sendPushToMany to class), report card published, guardian message received — SHIPPED
- Pre-existing tsc errors fixed: `incidentTimelineService.ts`, ops notes/replay routes — SHIPPED
- VAPID keys generated for deployment. The original private key was mistakenly
  committed here and is now considered compromised; it must not be reused.
  Store the replacement key pair only in the deployment secret manager. The
  non-secret subject remains `mailto:admin@liberialearn.edu.lr`.
- Gate: `npx tsc --noEmit` PASS (0 errors), `npx vitest run` PASS (2688 tests / 353 files), `npm run build` PASS
- 10 new tests in `__tests__/sprint4.push.test.ts`

## Sprint 6 COMPLETE — 2026-05-12
- Meeting model extended: `jitsiRoomId`, `joinUrl`, `liveStatus`, `startedAt`, `endedAt`, `hostUserId`, `subject`, `periodName`, `attendees` relation — SHIPPED
- `MeetingAttendee` model added + migration `20260512_000006_sprint6_live_sessions` — SHIPPED
- `lib/meetings/jitsiService.ts` — `generateJitsiRoomId` (deterministic, URL-safe, ≤64 chars) + `buildJoinUrl` — SHIPPED
- `lib/push/sendPush.ts` — `sendPushToClass` helper added — SHIPPED
- APIs: `POST /api/teacher/meetings`, `POST /api/teacher/meetings/[id]/start`, `PATCH /api/teacher/meetings/[id]/end` — SHIPPED
- APIs: `POST /api/student/meetings/[id]/join`, `GET /api/student/live-sessions/active` — SHIPPED
- Teacher schedule page: per-timetable-slot Schedule / Start / End session controls, 30s attendee count polling — SHIPPED
- `/student/live/[meetingId]` — full-screen Jitsi iframe, STUDENT-only, back button, handles SCHEDULED/LIVE/ENDED states — SHIPPED
- `components/LiveSessionBanner.tsx` — amber pulsing banner polls 30s, dismiss X, wired into `/student/today` — SHIPPED
- Auto-attendance: PATCH end marks each MeetingAttendee as PRESENT in AttendanceRecord — SHIPPED
- Push on start: `sendPushToClass` fires "Class is Live Now 🔴" to all enrolled students — SHIPPED
- Commit: `75707de`
- Gate: `npx prisma generate` PASS, `npx tsc --noEmit` PASS (0 errors), `npx vitest run` PASS (2734 tests / 357 files), `npm run build` PASS
- 15 new tests in `__tests__/sprint6.livesessions.test.ts`

## Sprint 10 COMPLETE — 2026-05-13
- PortfolioShare model + migration `20260513_000002_sprint10_portfolio_capstone` — SHIPPED
- CapstoneProject extended: description, skills, teacherId, fileUrls, teacherFeedback, submittedAt, reviewedAt, createdAt — SHIPPED
- `lib/portfolio/buildPortfolio.ts` — `buildPortfolioSummary` aggregates badges, certs, lessons, quiz avg, streak, subjects — SHIPPED
- `/student/portfolio` — stats grid, badges, subjects, certs, capstone section, share button + copy URL — SHIPPED
- `/portfolio/[shareCode]` — public page (firstName + grade + school + stats + badges + subjects; no PII beyond first name) — SHIPPED
- `POST /api/student/portfolio/share` — creates/returns PortfolioShare; `GET /api/portfolio/[shareCode]` — 404 if inactive — SHIPPED
- `/student/capstone` — grade-gated G10+, DRAFT/SUBMITTED/APPROVED/REJECTED state machine — SHIPPED
- `/teacher/capstone` — pending/approved/rejected filter, inline review panel — SHIPPED
- All 7 capstone APIs (create, patch, submit, revise, teacher list, teacher review) — auth guarded — SHIPPED
- APPROVED capstone auto-creates PortfolioItem; pushes student on approve/reject — SHIPPED
- StudentSidebar: "My Portfolio" nav link added — SHIPPED
- fix(P1): `agentDecision` queries scoped via `workflowRun.schoolId` (tenant isolation) — SHIPPED
- Commit: `88a5817`
- Gate: `npx tsc --noEmit` PASS (0 errors), `npx vitest run` PASS (2815 tests / 364 files), `npm run build` PASS
- 19 new tests in `__tests__/sprint10.portfolio.test.ts`

## Sprint 11 COMPLETE — 2026-05-13
- `components/PwaInstallPrompt.tsx` — 30s delay, beforeinstallprompt, 14-day dismiss, permanent install flag — SHIPPED
- `components/OfflineReadyBadge.tsx` — Cache API check, green checkmark / download icon, on-click cache trigger — SHIPPED
- `components/DataUsageBar.tsx` — navigator.storage.estimate, colour-coded bar, Low Data Mode toggle (localStorage) — SHIPPED
- `lib/offline/assignmentDraftQueue.ts` — saveDraftOffline / getDraftOffline / removeDraftOffline / listPendingDrafts — SHIPPED
- `lib/lesson-offline-cache.ts` — MAX_CACHED_LESSONS raised to 50 — SHIPPED
- `public/sw.js` — syncAssignmentDrafts + `sync` event handler for `submit-assignment-drafts` tag — SHIPPED
- `public/manifest.json` — screenshots array (home + today), categories, description hardened — SHIPPED
- `public/screenshots/` — home.png + today.png placeholder images — SHIPPED
- Layout wiring: student, teacher, guardian layouts all mount `PwaInstallPrompt` — SHIPPED
- `app/student/assignments/[id]/AssignmentSubmissionClient.tsx` — draft pre-fill banner, keystroke save, offline submit path, removeDraft on success — SHIPPED
- `app/student/today/page.tsx` — `OfflineReadyBadge` wired on each lesson item — SHIPPED
- `app/student/lessons/page.tsx` — `OfflineReadyBadge` wired on each lesson card — SHIPPED
- Commit: `1a94b11`
- Gate: `npx prisma generate` PASS, `npx tsc --noEmit` PASS (0 errors), `npx vitest run` PASS (2844 tests / 365 files), `npm run build` PASS
- 27 new tests in `__tests__/sprint11.pwa.test.ts`

## Sprint 13 COMPLETE — 2026-05-14
- Upstash rate limit already wired (existing `checkRateLimit` auto-selects Upstash when env vars set) — CONFIRMED
- Message pagination: `GET /api/student/messages?threadKey=&before=&take=50` + `nextCursor` — SHIPPED
- 15s active-thread poll in student + teacher messages pages — SHIPPED
- Student soft-delete: `DELETE /api/student/messages/[messageId]` + `deletedBySender` field — SHIPPED
- `[Message retracted]` shown to teacher for soft-deleted messages — SHIPPED
- `lib/messaging/keywordFilter.ts` + auto-flag on POST for both student + teacher routes — SHIPPED
- `GET /api/admin/messages/flags` + `PATCH /api/admin/messages/[id]` flag review — SHIPPED
- `/admin/communications/flags` page: pending/dismissed/actioned tabs + Dismiss/Action Taken workflow — SHIPPED
- `flaggedMessages` stat wired to real DB count in `/api/admin/messages/stats` — SHIPPED
- `POST /api/messages/upload-attachment` (Vercel Blob, 5 MB max, images + PDF) — SHIPPED
- Attachment send/receive in student + teacher message bubbles (inline image / PDF download) — SHIPPED
- `lib/push/sendPush.ts` SMS fallback when no VAPID subscription + user has phone — SHIPPED
- `e2e/messaging.spec.ts` — 5 Playwright tests (skip-guarded on missing env creds) — SHIPPED
- Migration `20260513_000004_sprint13_message_hardening` applied to production — SHIPPED
- Commit: `70b3bff`
- Gate: `npx prisma generate` PASS, `npx tsc --noEmit` PASS (0 errors), `npx vitest run` PASS (2885 tests / 367 files), `npm run build` PASS
- 21 new tests in `__tests__/sprint13.messaging-hardening.test.ts`

## Sprint 12 COMPLETE — 2026-05-13
- `Message` model extended: `senderRole`, `recipientRole`, `threadKey`, `read` fields + `MessageReadReceipt` model — SHIPPED
- Migration `20260513_000003_sprint12_unified_messaging` — SHIPPED
- `GET/POST /api/student/messages` — thread list with unread counts, rate-limited 10/day per teacher — SHIPPED
- `GET /api/student/messages/unread-count` — unread badge count for StudentSidebar polling — SHIPPED
- `GET /api/student/my-teachers` — enrolled teacher list for compose modal — SHIPPED
- `POST /api/teacher/messages/reply` — teacher reply with threadKey validation + push to student — SHIPPED
- `GET /api/teacher/messages/student-threads` — teacher view of student thread list — SHIPPED
- `GET /api/admin/messages/stats` — aggregate counts only, no message bodies (privacy) — SHIPPED
- `app/student/messages/page.tsx` — thread sidebar + chat bubbles + compose modal + read receipts (✓/✓✓) — SHIPPED
- `app/teacher/messages/page.tsx` — tabbed Guardian Messages / Student Messages with unread badge — SHIPPED
- `app/admin/communications/page.tsx` — message volume stats + privacy shield notice — SHIPPED
- `components/StudentSidebar.tsx` — Messages nav link + red unread badge (polls every 60s) — SHIPPED
- `components/admin/AdminNav.tsx` — Communications link added — SHIPPED
- Commit: `adc1b75`
- Gate: `npx prisma generate` PASS, `npx tsc --noEmit` PASS (0 errors), `npx vitest run` PASS (2864 tests / 366 files), `npm run build` PASS
- 20 new tests in `__tests__/sprint12.messaging.test.ts`

## Sprint 14 COMPLETE — 2026-05-14
- LessonVideo upload migrated from Supabase to Vercel Blob (50 MB cap, MP4/WebM) — SHIPPED
- Video tab added to LessonDeliveryClient.tsx (hidden when no active video) — SHIPPED
- `AssessmentAttemptDetail` model + migration `20260514_000001_sprint14_features` — SHIPPED
- Per-question assessment analytics: `GET /api/teacher/analytics/assessment/[contentId]` — SHIPPED
- `/teacher/analytics/assessment/[contentId]` page: Q breakdown, correct rate color codes — SHIPPED
- Guardian push: assignment posted + live session started fire-and-forget — SHIPPED
- `GET /api/guardian/assignments` + `/guardian/assignments` page + GuardianNav link — SHIPPED
- FTS gin indexes on CurriculumContent + SchoolEvent — SHIPPED
- `GET /api/search` role-scoped full-text search — SHIPPED
- `components/GlobalSearch.tsx` command-palette overlay wired to student + teacher layouts — SHIPPED
- Skip nav link in `app/layout.tsx` — SHIPPED
- `role="log" aria-live="polite"` on message feed; `role="grid"` on EventCalendar — SHIPPED
- `StudentStreak` + `WeeklyLeaderboard` schema models — SHIPPED
- `lib/gamification/streakService.ts` + `lib/gamification/leaderboardService.ts` — SHIPPED
- Streak updated fire-and-forget on lesson complete — SHIPPED
- Streak display on Today page (🔥 X day streak, gold glow ≥7, badge ≥30) — SHIPPED
- `/student/leaderboard/[classId]` page: podium, table, opt-out — SHIPPED
- `POST /api/cron/rebuild-leaderboards` daily cron at 0 20 * * * — SHIPPED
- StudentSidebar: Leaderboard nav link added — SHIPPED
- Commit: `fc3bf21`
- Gate: `npx prisma generate` PASS, `npx tsc --noEmit` PASS (0 errors), `npx vitest run` PASS (2904 tests / 368 files), `npm run build` PASS
- 19 new tests in `__tests__/sprint14.features.test.ts`

## Fix Session — 2026-05-14 (post-Sprint-14)
- `lib/db.ts`: `connection_limit=1` now injected programmatically if not in DATABASE_URL — SHIPPED
- `lib/lessons.ts`: `selectLessonBody` accepts `mode` param; slides mode prefers `body_block` — SHIPPED
- `lib/lessons.ts`: `renderSimpleMarkdown` strips `##` heading markers for clean Listen display — SHIPPED
- `app/student/discussion/page.tsx` + `app/teacher/discussion/page.tsx`: `ll-dashboard-shell` + back link — SHIPPED
- Commit: `0a6b314`
- Shell/nav audit: 29 pages audited; 9 needed shell fix; 20 needed back link — all fixed — SHIPPED
- Commit: `1e2a957`
- Gate: `npx tsc --noEmit` PASS, `npx vitest run` PASS (2904 tests / 368 files), `npm run build` PASS

## Sprint 9 COMPLETE — 2026-05-13
- GeneratedDocument model + migration `20260513_000001_sprint9_generated_documents` — SHIPPED
- `lib/canva/templates/`: studentIdCard, enrollmentLetter, teacherAppointment, permissionSlip — SHIPPED
- API routes: `GET /api/admin/documents`, `POST /api/admin/documents/id-cards/generate`, `/enrollment-letter`, `/teacher-appointment`, `/permission-slips` — SHIPPED
- `app/admin/documents/page.tsx` — tabbed admin UI for ID Cards, Enrollment Letters, Teacher Appointments, Permission Slips, Certificates — SHIPPED
- Autonomous OS phase 13–15: productSignalService, signalCoverageService (signal telemetry layer) — SHIPPED
- Predictive intelligence services: institutionalForecastService, trendForecastService, riskTrajectoryService, earlyWarningService, forecastCalibrationDashboardService, predictionReviewService — SHIPPED
- Autonomous OS admin pages: signals, predictions, forecasting, early-warnings, prediction-review, forecast-calibration — SHIPPED
- Signal telemetry wired to: push delivery, report card publish, assignment grade, meeting join, lesson complete, enrollment — SHIPPED
- `app/api/notifications/open` — notification open tracking — SHIPPED
- Commit: `6c50d46`
- Gate: `npx tsc --noEmit` PASS (0 errors), `npx vitest run` PASS (2796 tests / 363 files), `npm run build` PASS
- 11 new tests in `__tests__/sprint9.documents.test.ts`

## Sprint 5 COMPLETE — 2026-05-12
- SchoolEvent model + migration `20260512_000005_sprint5_school_events` — SHIPPED
- `lib/push/sendPush.ts` — `sendPushToSchool` helper added — SHIPPED
- APIs: `GET/POST /api/admin/events`, `PATCH/DELETE /api/admin/events/[id]`, `PATCH /api/admin/events/[id]/publish` — SHIPPED
- `GET /api/events` — role-scoped visibility filter (ALL/STUDENTS/TEACHERS/GUARDIANS) — SHIPPED
- `/admin/events` CRUD page: filter tabs, inline form, draft/publish, edit, delete — SHIPPED
- `components/EventCalendar.tsx` — compact weekly strip + full month grid — SHIPPED
- EventCalendar compact wired into: student Today, teacher dashboard, guardian dashboard, admin dashboard — SHIPPED
- Dedicated events pages: `/student/events`, `/teacher/events`, `/guardian/events` — SHIPPED
- Nav links: StudentSidebar, TeacherNav, GuardianNav — SHIPPED
- `lib/events/eventSmsScheduler.ts` — 24h guardian SMS reminder, EXAM/MEETING only, skips past — SHIPPED
- Commit: `64b98f0`
- Gate: `npx tsc --noEmit` PASS (0 errors), `npx vitest run` PASS (2712 tests / 355 files), `npm run build` PASS
- 9 new tests in `__tests__/sprint5.events.test.ts`
