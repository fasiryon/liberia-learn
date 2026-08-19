# P2-C Blocker Closure — Completion Record

Date: 2026-08-19. Branch `codex/p2c-waec-baseline-alignment`, on top of commit
`a2311bee` (the prior forensic-remediation completion commit). PR
https://github.com/fasiryon/liberia-learn/pull/86 (open, not merged).
Staging project `yonpfzjczoffhrgibxkz`. Production project
`bnphuinpvgpmebcsvmsp` was not touched.

## Why

An independent confirmation audit of the P2-C forensic remediation found the
semantic fixes sound, but identified real, separate blockers to close before
production authorization: an AI-telemetry double-write/reconciliation gap,
a platform-dependent legacy migration manifest, `git diff --check` failures,
and stale documentation claims. This record closes what could honestly be
closed and reports, without touching, what could not.

## Closed

### Telemetry double-write and dedup

`routedCompletion()` (`lib/ai/routedCompletion.ts`) logs internally via
`logAIInteraction()` whenever `feature === "curriculum" &&
provenanceWritersEnabled()` (durable/awaited) or otherwise fire-and-forget.
`scripts/p2c-live-ai-sme-proof.ts` additionally called `logAIInteraction()`
itself, durably, using the same `generationCorrelationId`, as a defensive
measure against the fire-and-forget path. Neither call had any dedup guard,
so every real invocation was persisted twice in `AIInteraction` and twice in
`AiInteractionLog`.

Fixed in `lib/ai/interactionLog.ts`: `logAIInteraction()` now looks up an
existing `AIInteraction` row by `generationCorrelationId` (via the existing
`@@index([generationCorrelationId, createdAt])` index -- no schema change)
before creating one, and only writes the legacy `AiInteractionLog` row when
it is actually creating a new canonical `AIInteraction` row. A find-then-
create check alone was not race-safe: when the internal write is
fire-and-forget, a caller's own immediately-following durable call can start
its own lookup before the internal write's `create()` has committed, and
both see "not found" -- **verified live against staging while building this
fix** (see `docs/ops/P2C_LIVE_DEDUP_PROOF.json`'s first, failing attempt). An
in-process mutex keyed by correlation id (`inFlightInteractionRowsByCorrelationId`
in `lib/ai/interactionLog.ts`) closes this: it serializes concurrent
`resolveInteractionRow()` calls for the same id within one process, which is
where the actual duplicate calls originate. No DB-level unique constraint
was added: doing so would require resolving the 24 pre-existing duplicate
rows first, which means mutating historical audit evidence -- explicitly out
of scope. New regression coverage in `__tests__/ai.interactionLog.test.ts`
(a `logAIInteraction dedup by generationCorrelationId` describe block, 8
tests, including one genuinely concurrent `Promise.all` race test that
reproduces the exact failure mode found live). Live post-fix proof against
real staging telemetry: `scripts/p2c-live-dedup-proof.ts`, real spend
$0.0000054 (cap was $1), result **PASS** -- one canonical row per invocation,
a duplicate persistence attempt correctly suppressed, a genuinely new call
stayed distinct, zero curriculum acceptance-table rows touched.

### Durable AI proof reconciliation

Re-derived, not hardcoded: `scripts/p2c-reconcile-ai-proof-telemetry.ts`
queried staging read-only and found **12 distinct real provider invocations**
across **3 script runs** (2026-08-18 19:35 UTC, 2026-08-19 15:16 UTC, and the
committed 2026-08-19 15:20 UTC run), **24 raw `AIInteraction` rows and 24 raw
`AiInteractionLog` rows** (every invocation double-persisted, per the bug
above), and **$0.00395115 total real spend**. `docs/ops/P2C_LIVE_AI_SME_PROOF.json`
was updated in place with a `reconciliation` block carrying these numbers,
a `duplicationMechanism` explanation, and per-run attribution -- the 8
invocations from the two earlier debugging runs are honestly labeled as not
part of the file's own 4 documented cases, not deleted or hidden.
Interestingly, the original remediation report's "~12 calls / ~$0.004" figure
turns out to have been accurate for the *whole* session; a separate
independent confirmation audit's "8 invocations / $0.0052" figure was itself
an artifact of querying only a ~10-minute window that missed the earliest
run. Neither number was trusted here -- both were independently re-queried.

Also corrected in the same artifact: **Case C's characterization**. Cases A,
B, and D genuinely overreached on depth (`DIRECT`/`MEETS_BASELINE` from
SUBJECT_LEVEL-only evidence). Case C did not -- it returned the honest,
cautious `PARTIAL`/`UNKNOWN` result and was rejected for a different reason,
`TITLE_ONLY_OR_UNGROUNDED_OBJECTIVE_MATCH` (grade mismatch). The aggregate
verdicts are unchanged (`AI_MODEL_JUDGMENT=NEEDS_IMPROVEMENT`,
`DETERMINISTIC_GUARDRAIL=PASS`), but the artifact no longer implies "all four
models overreached identically." **Case D's durable-evidence limit** is also
now disclosed: the injected adversarial excerpt text is not present in the
committed JSON (only `id`/`authorityType`/`evidenceSpecificity`/`locator`
are), so the only durable evidence the injection was genuinely sent is the
committed script source itself (`scripts/p2c-live-ai-sme-proof.ts`, the
`adversarialEvidence` constant), not the JSON artifact alone. No new paid
call was made to strengthen this narrative.

### `git diff --check`

Fixed genuinely accidental whitespace: a doubled trailing space in
`docs/product/LEARNER_EXPERIENCE_V2_INTERACTIVE_RUNTIME.md` (two prose
lines) and an extra blank line at EOF in `docs/ops/P2A_PRODUCTION_CUTOVER_RECORD.md`.

Left unchanged, and exempted via `.gitattributes` instead: `docs/P2B_QUALIFIED_REVIEW_OPERATIONS_FINAL_DESIGN.md`
and `docs/ops/P2A_PRODUCTION_CUTOVER_RECORD.md`'s metadata header blocks use
the standard Markdown hard-line-break convention (two trailing spaces) --
real, intentional formatting, not accidental whitespace; stripping it would
merge those lines into one paragraph when rendered. And
`prisma/canonical/migrations/20260817_000001_p2c_waec_baseline_alignment/migration.sql`'s
blank line at EOF was **not** touched: that migration is already applied to
staging and its checksum is recorded in the `_prisma_migrations` ledger --
editing its bytes would drift that checksum, which the closure prompt
explicitly treats as a hard stop. `git diff --check main...HEAD` is now
clean once this pass's commits land.

## Explicitly NOT closed -- stopped per hard-stop rule, reported instead

### Legacy migration manifest: platform-dependence is NOT isolated to one file

`scripts/verify-legacy-manifest-canonical-bytes.ts` (new, read-only,
committed) compares every one of the 128 `prisma/legacy-migration-manifest.json`
entries against the **canonical git blob** for its path (via `git cat-file`,
never the checked-out worktree file, so identical on any OS) and writes a
full report to `docs/ops/P2C_LEGACY_MANIFEST_PLATFORM_AUDIT.json`.

Result: **38 of 128 entries are platform-dependent**, not the 1
(`20260220_180000_training_reporting`) the confirmation audit found. Every
one of the 38 has a correct `gitBlobSha` (no wrong-reference drift) but a
`fileBytes`/`sha256` pair captured from a Windows/CRLF checkout rather than
the canonical LF git blob -- the same root cause as the single file already
found, now shown to be systemic across the manifest, not isolated.

Per this closure pass's own explicit instruction -- "if multiple entries are
platform-dependent, STOP before bulk rewrite and report" -- **this manifest
was not modified**, and neither was the failing test
(`__tests__/pre-p2a.canonical-baseline.test.ts`). Correcting 38 entries of
what this repository treats as frozen security-audit evidence needs its own
explicit, isolated, human-reviewed change -- not a decision made unilaterally
inside this closure pass. `docs/ops/P2C_LEGACY_MANIFEST_PLATFORM_AUDIT.json`
carries the full list of affected migrations, their recorded vs. canonical
byte counts and hashes, and the required-human-decision note.

**Direct consequence: CI does not go green in this pass.** Both
`__tests__/pre-p2a.canonical-baseline.test.ts` (in `ci.yml`'s full Vitest
run) and the `clean-bootstrap-pg17` workflow (which runs the same test) will
continue to fail on this specific assertion until a human makes the
manifest-correction decision above and a follow-up commit applies it.

## Staging health

RLS invariant, P2-A/P2-B state, and staging telemetry outside the fixed
double-write bug are all unaffected by this pass. No destructive statement
was run. No production project was written to; a single read-only
confirmation query was run against production to verify the P2-C schema
still does not exist there (see the independent confirmation audit for that
detail -- unchanged by this pass).

## Production GO / NO-GO recommendation

**Still NO-GO.** This pass closes the telemetry-integrity and
`git diff --check` blockers and produces an honest, reconciled AI proof
artifact, but CI remains red for a real, disclosed, pre-existing reason this
pass correctly declined to paper over. Before an explicit production
authorization decision: (1) a human decision on the legacy-manifest
correction (see `docs/ops/P2C_LEGACY_MANIFEST_PLATFORM_AUDIT.json`), in its
own isolated, reviewed commit; (2) a fresh CI run against the resulting HEAD
showing both `CI`/`build` and `clean-bootstrap-pg17` green; (3) human review
of PR #86, which remains the cumulative, unmerged P2-A + P2-B + P2-C delivery
(not just this pass's commits).
