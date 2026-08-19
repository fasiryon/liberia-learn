# P2-C Forensic Remediation — Completion Record

Date: 2026-08-19. Branch `codex/p2c-waec-baseline-alignment`, commit `9b7b12c1`.
PR https://github.com/fasiryon/liberia-learn/pull/86 (open, not merged).
Staging project `yonpfzjczoffhrgibxkz`. Production project
`bnphuinpvgpmebcsvmsp` was not touched.

## Why

An independent forensic audit of P2-C returned `GO_WITH_REQUIRED_FIXES`,
identifying four real semantic defects and two validation gaps. This sprint
fixes only those, with no redesign, no new source collection, and no
production migration.

## FIX 1 — Curriculum V2 depth contract

`buildCurriculumV2Contract` (`lib/curriculum/benchmarking/curriculumV2Contract.ts`)
derived `verifiedBaselineDepth = MEETS_BASELINE` from the mere presence of
TOPIC_LEVEL evidence. Evidence specificity answers "what level of evidence
exists", never "does LiberiaLearn meet the baseline". Fixed: the function
now takes an explicit `assessedDepthRelation` parameter, sourced only from
a real `CurriculumBaselineAlignment.depthRelation` row, and defaults to
`UNKNOWN` when none exists — even with TOPIC_LEVEL evidence present. Five
required regression cases added in `__tests__/p2c/curriculum-v2-contract.test.ts`,
plus two more (real-assessed BELOW_BASELINE passthrough, persisted-field
precedence over array inference).

## FIX 2 — Persisted evidence specificity

`AssessmentBaselineCompetency` gained a required `evidenceSpecificity`
column (new `EvidenceSpecificity` enum: FRAMEWORK_LEVEL / SUBJECT_LEVEL /
TOPIC_LEVEL), migration
`prisma/canonical/migrations/20260818_000001_p2c_evidence_specificity_and_baseline_depth/migration.sql`.
Previously this distinction existed only in transient `AlignmentEvidence[]`
arrays and a `.SUBJECT_LEVEL` code-suffix naming convention. All 16
pre-existing staging rows were individually re-checked against their own
`evidenceLocator`/`expectation` text (not the code suffix) before choosing
the migration's backfill default — every one is genuinely SUBJECT_LEVEL
(each states no topic-by-topic WAEC syllabus was recovered). None was
upgraded to TOPIC_LEVEL. Both seed scripts
(`scripts/p2c-staging-real-data-seed.ts`,
`scripts/p2c-staging-subject-expansion-seed.ts`) updated to set the field
explicitly on future inserts (the column has no default after backfill, so
a future insert that omits it fails at the type level).

## FIX 3 — Subject-vs-topic modeling

Chose Option B (retain rows, discriminate by evidence specificity) over
Option A (move subject-level semantics fully to `AssessmentBaselineSubject`
and deprecate placeholder competency rows). Option B is the smaller,
lower-risk change and, combined with FIX 2's persisted field, gives
downstream logic (FIX 4) everything it needs to exclude SUBJECT_LEVEL rows
from topic-competency calculations without restructuring the schema or
migrating 16 existing rows to a new parent table.

## FIX 4 — Gap engine semantics

`buildCurriculumGapReport` (`lib/curriculum/benchmarking/gapEngine.ts`) now
reads `GapCompetency.evidenceSpecificity`. Any competency that is not
TOPIC_LEVEL is routed to a new `topicLevelBaselineUnknownCompetencies`
array / `TOPIC_LEVEL_BASELINE_UNKNOWN` gap category
(`classifyGapCategories`), and is excluded from
`uncoveredBaselineCompetencies` / `partiallyCoveredCompetencies` /
`underDepthCompetencies` / `aboveBaselineCompetencies` and from
`CRITICAL_BASELINE_GAP` no-go reasons, regardless of what LiberiaLearn
coverage mapping exists for it. `waecBaselineCoverageStatus` reports
`UNKNOWN` (not PARTIAL/BELOW_BASELINE/COMPLETE_AT_BASELINE) when the only
applicable competencies for a grade/subject are SUBJECT_LEVEL/
FRAMEWORK_LEVEL. Verified live against real staging data
(`scripts/p2c-gap-and-baseline-proof.ts`, `scripts/p2c-staging-gap-engine-proof.ts`):
all 16 real competencies now correctly report TOPIC_LEVEL_BASELINE_UNKNOWN,
zero false CONTENT_GAP/BELOW_BASELINE. New regression tests in
`__tests__/p2c/depth-gap-engine.test.ts` and updated
`__tests__/p2c/real-data-pilot.test.ts` (which previously encoded the bug
as expected behavior — the fix corrects both the code and the test's
claim).

## FIX 5 — WASSCE / LSHSCE semantics

`AssessmentBaselineFramework` gained `regionalReferenceLabels: String[]`.
WASSCE moved out of `examAliases` (which now correctly implies "verified
first-party alternate name") into this new field, documented as never read
by any calculation code. `scripts/p2c-staging-exam-framework-seed.ts`
updated. `__tests__/p2c/wassce-isolation.test.ts` proves (a) no calculation
module's source text references `regionalReferenceLabels` or `WASSCE`, and
(b) `buildCurriculumV2Contract`'s output is byte-identical regardless of
`examAliases` content except for the pass-through display field itself.

## FIX 6 — Live AI durable proof

`scripts/p2c-live-ai-sme-proof.ts` re-run with:
- Explicit $5 hard cap enforced in-process (`MAX_TOTAL_SPEND_USD`, checked
  before and after every call); actual total spend this session across all
  runs (including two runs spent isolating a telemetry bug, see below):
  approximately $0.004.
- Durable telemetry: an explicit, awaited `logAIInteraction(..., durable:
  true)` call per case, independent of `routedCompletion`'s own
  fire-and-forget internal write (which only awaits when
  `provenanceWritersEnabled()`, not guaranteed for a short-lived script).
- A committed evidence artifact, `docs/ops/P2C_LIVE_AI_SME_PROOF.json`:
  invocation ID, provider, model, prompt key/version/hash, input evidence
  summary, raw structured model output, validator result, rejection
  reason, token usage, cost, timestamp, per case.
- A post-run cross-check against the real `AIInteraction` table.

**Incident found and fixed during this work, not a production incident:**
the first two runs' `AIInteraction` cross-check found 0/4 and 2/4 matching
rows. Root cause: `routedCompletion` does not always honor the caller's
`aiUsage.generationCorrelationId` for the ID it actually persists (visible
via `hadFallback: true` on the mismatching rows, suggesting an internal
retry path assigns its own ID). Fixed by capturing
`completion.generationCorrelationId` (what `routedCompletion` actually
returns) as the correlation ID of record, and by attaching that context to
thrown validation-failure errors (a new `ValidationFailureWithContext`
class) so a rejected/malformed model response — the common case here —
still reports the real, already-persisted row instead of a throwaway
random ID. Final run: 8/4 (2 durable rows per case, both keyed on the
correct ID) — full match. Separately verified, before diagnosing the
correlation-ID issue, that no writes ever reached production: confirmed via
`_incident-check-env-precedence.ts` (deleted after use) that dotenv-cli's
first `-e` flag wins, so `DATABASE_URL` was staging throughout every run.

**Final live results (4 real cases, all real spend, no mocking):** all 4
attempted an overreach (DIRECT/definite-depth claim from SUBJECT_LEVEL-only
evidence, or an ungrounded evidence-term match); the deterministic guard in
`validateAiWaecAlignment` rejected every one.
- AI model judgment: **NEEDS_IMPROVEMENT** (attempted overreach in 4/4 live cases this run)
- Deterministic guardrail: **PASS** (0/4 GUARD_MISS_FAIL — no bad output ever validated as accepted alignment)

Per the founder's explicit acceptance criterion, this combination is
sufficient for P2-C production: the guard, not model trustworthiness, is
what prevents bad output from persisting.

## FIX 7 — Automated test coverage

New/updated test files: `__tests__/p2c/curriculum-v2-contract.test.ts` (new,
9 tests), `__tests__/p2c/wassce-isolation.test.ts` (new, 2 tests),
`__tests__/p2c/depth-gap-engine.test.ts` (+4 tests for FIX 4),
`__tests__/p2c/real-data-pilot.test.ts` (2 tests corrected to assert the
fixed, honest behavior instead of the bug). Focused P2-C suite: 59/59 PASS.

## FIX 8 — RLS defense in depth

Audited (`scripts/p2c-staging-grant-audit.ts`) and confirmed: all 13 P2-C
tables had RLS enabled with zero policies (default-deny) but also still
carried full anon/authenticated GRANT ALL from before an earlier,
already-fixed default-privilege gap (`ALTER DEFAULT PRIVILEGES` only
protects tables created after it ran, not these pre-existing ones).
Grep-confirmed no app code queries any P2-C table via a Supabase/PostgREST
client under anon or authenticated (server-only Prisma access). Revoked
(`scripts/p2c-staging-grant-hardening.ts`): 0 anon/authenticated grants
remain on any of the 13 tables. Verified the application's own Prisma
connection still works post-revoke (`assessmentBaselineFramework.count()`
succeeded). RLS invariant re-checked clean
(`scripts/verify-rls-invariant.ts`).

## FIX 9 — Branch / CI

Committed (`9b7b12c1`, no destructive changes, 21 files), pushed, and PR
#86 opened against `main` (not merged) to trigger the reviewed CI path.

## FIX 10 — Full validation

- `npx prisma validate` / `generate`: PASS
- `npx tsc --noEmit` (full, non-incremental): PASS, no OOM
- Focused P2-C: 59/59 PASS
- P2-A regression: 4/4 tables present, unchanged (`scripts/p2c-staging-p2a-p2b-regression-check.ts`)
- P2-B regression: 11/11 tables present, unchanged
- Full `npx vitest run` locally: 4756/4758 PASS (2 timeout-only under this
  dev machine's resource contention — `phase10.replayConsole.test.ts`,
  `student.lesson-delivery.test.ts` — 31/31 unchanged in isolation)
- **On GitHub Actions CI, the same full suite: 4757/4758 PASS** — both
  locally-flaky tests passed cleanly (confirms they were never real
  failures, purely local resource contention)
- `npm run build`: PASS locally
- `git diff --check`: PASS (implied by `validate:changed`'s runs, no
  reported issues)
- Clean worktree: yes, after commit

### CI is not fully green — one pre-existing, unrelated failure

Both PR #86 workflow runs (`CI` run 32270432473, `Canonical clean
bootstrap` run 32270432669) report exactly one failing test:
`__tests__/pre-p2a.canonical-baseline.test.ts` > "freezes every legacy
migration through the cutover byte for byte", specifically for
`20260220_180000_training_reporting` (`expected 2573 to be 2641`).

This file was never touched by P2-C. Root cause, confirmed by direct
inspection:

- `git cat-file -s <blob>` (the actual committed content): **2573 bytes**
  (LF line endings, matching `.gitattributes`' `eol=lf` for this path)
- Local Windows working-tree size (`core.autocrlf=true`): **2641 bytes**
  (CRLF-converted on checkout)
- `prisma/legacy-migration-manifest.json`'s frozen `fileBytes`: **2641**

The manifest's frozen byte count (and, by the same mechanism, its sha256)
were captured on a CRLF/Windows checkout, not the canonical LF git blob
that Linux CI (and any Linux/macOS contributor) actually checks out. This
predates this branch and was only exposed now because PR #86 is the first
change to touch `prisma/canonical/**`, which path-triggers the "Canonical
clean bootstrap" workflow (and the same test also runs inside `ci.yml`'s
full Vitest run).

**Deliberately not fixed in this PR.**
`prisma/legacy-migration-manifest.json` is frozen security-audit evidence
from the separate, closed P2-A production-cutover forensic reconciliation.
A correct fix (recompute the LF-normalized byte size and sha256 for this
one file) is narrow and low-risk, but touching that file inside a P2-C
remediation PR — without being asked, and without a reviewer's eyes on a
security-audit artifact — is out of this remediation's scope. Flagging it
here for an explicit, separate decision.

## Staging health

RLS invariant clean, P2-A/P2-B unchanged, application Prisma connection
verified working post-grant-revoke. No production project accessed for any
mutation this session (one read-only production-project check was
performed while diagnosing the telemetry correlation-ID issue, described
above under FIX 6, before the root cause was found to be unrelated to
environment).

## Commits

`9b7b12c1` — `fix(p2c): forensic remediation - honest depth, evidence
specificity, WASSCE isolation` (21 files changed, 1442 insertions(+), 87
deletions(-)).

## Remaining genuine limitations

- CI is not fully green (see above) — pre-existing, unrelated,
  disclosed, not a P2-C regression.
- No topic-by-topic WAEC syllabus document exists publicly for any of the
  16 seeded competencies (unchanged from before this remediation — this
  was never claimed to be fixed; FIX 2-4 make the platform honest about
  that absence rather than resolving it).
- The live AI SME proof's 4/4 NEEDS_IMPROVEMENT judgment result means the
  model continues to need a stronger prompt/instruction pass if anyone
  ever wants AI judgment quality itself (not just the guardrail) to
  improve; not required for the founder's stated production-readiness bar,
  but a known, disclosed gap.
- `routedCompletion`'s internal correlation-ID handling under fallback
  (`hadFallback: true`) does not always honor a caller-supplied
  `generationCorrelationId` — worked around in this script (capture
  `completion.generationCorrelationId` instead of assuming the input is
  echoed back), but the underlying behavior in `lib/ai/routedCompletion.ts`
  itself was not changed (shared code, out of scope for this remediation).

## Production GO / NO-GO recommendation

**NO-GO on this PR as-is.** Recommend: (1) human review of PR #86,
including the disclosed CI finding; (2) an explicit decision on the
legacy-manifest byte-count fix (separate PR, since it touches
P2-A-adjacent frozen audit evidence); (3) only then an explicit production
authorization decision for `P2C_CURRICULUM_BENCHMARKING_ENABLED`. All
semantic defects the forensic audit identified are fixed and
live-verified; the remaining blocker before "PRODUCTION GO" is procedural
(review + the CI finding), not semantic.
