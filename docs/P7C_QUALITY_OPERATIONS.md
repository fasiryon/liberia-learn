# P7-C Quality Operations

`lib/experiments/qualityOperations.ts` is the canonical, read-only P7-C quality gate. It takes a supplied evidence snapshot and produces deterministic readiness, invalidation, reconciliation, statistical, human-review, and audit evidence. It does not start experiments, change assignments, repair source events, query a database, or mutate production or staging.

The randomization and analysis unit is the experiment's SCHOOL or CLASS assignment. Outcomes are one bounded value per assignment unit and metric, never learner rows. Treatment-control intervals use cluster means and a cluster-level Welch variance; Bonferroni critical values are applied when more than one treatment comparison is declared. An interval crossing zero is neutral, never confirmed improvement. Guardrail harm and SRM stop interpretation even if a primary metric improves.

Snapshots are SHA-256 hashed using canonical ordering. Replaying identical governed evidence produces the same hash and report. The evaluator rejects malformed/replayed data, synthetic/internal source evidence, mismatched metric or definition versions, cross-school exposures, unassigned exposures, invalid times, and duplicate cluster outcomes. Missing evidence is reported as missing, never zero.

Sequential checks must occur at predeclared checkpoints and cannot reuse an already evaluated snapshot. SRM remains insufficient below its declared sample threshold. A successful quality state also requires authorized human-review samples for the policy-declared dimensions. Returned audit records are immutable evidence candidates and must be persisted by a future privileged lifecycle surface through the existing AuditLog architecture; this repository capability deliberately provides no such mutation surface.

P7-C repository completion does not close NR-15. NR-15 still requires separately governed operational monitoring, alert delivery, on-call ownership, and a documented incident drill.

## Fixture registry (`lib/quality/fixtureRegistry.ts`)

The registry is an in-memory `Map<fixtureId, Map<version, QualityFixture>>`. It is not a database table; it is populated at process start (or at test setup, via `resetFixtureRegistryForTests()`) by calling loader functions such as `loadRedTeamFixtures()` and `loadRegressionFixtures()`.

A `QualityFixture` carries: `fixtureId`, `version`, `domain` (`red_team` | `regression`), `dimension` (`age`/`subject`/`language`/`safetyCategory`, all optional), `input` (`prompt`/`context`), `expectedBehavior` (`verdict` and `notes`), `severity`, `source`, `owner`, `reviewStatus`, timestamps, an optional `replacesFixtureVersion`, and `tags`.

**Versioning rule:** `registerFixture()` enforces immutability per `(fixtureId, version)` pair. Registering the same `fixtureId`+`version` a second time with a different payload throws `fixture_version_immutable:<id>@<version>`; registering it again with an identical payload is a silent no-op. To change a fixture's expected behavior, the correction must be published under a new `version` number (optionally recording `replacesFixtureVersion`), never by mutating an existing version in place. `getFixture()` and `listFixtures()` default to the latest version per fixture id; `getFixture(id, version)` can still retrieve a specific historical version.

## Red-team fixtures (`lib/quality/fixtures/redTeam.ts`)

Eight seed fixtures cover two age bands (`primary`, `secondary`), two subjects (`mathematics`, `english_language_arts`), and five safety categories: `unsafe_content`, `prompt_injection`, `answer_key_leakage`, `pii_leakage`, `cross_tenant_leakage`. Two of the eight are deliberate control cases (`rt-primary-helpful-baseline`, `rt-secondary-helpful-baseline`) expecting `HELPFUL`, not `REFUSE`, so the set also verifies the gate does not over-block ordinary tutoring requests.

**Language coverage is `en`-only.** Every fixture's `dimension.language` is `"en"`. This is not an oversight; it matches the fact that the learner-facing runtime is English-only in production today. No `kpe`/`bss` red-team coverage exists, and none should be fabricated until the runtime itself serves those languages to learners.

**Category grounding is only partial against the real moderation classifier.** `lib/agents/moderation.ts`'s `ModerationVerdict` is `SAFE | UNSAFE | UNCERTAIN` with no structured category enum; the category vocabulary used here is inferred from prose in the moderation system prompts (`lib/agents/infraPrompts.ts`). Of the five safety categories:
- `unsafe_content`, `pii_leakage`, and `prompt_injection` map to concepts actually named in the moderation prompts' prose.
- `answer_key_leakage` and `cross_tenant_leakage` are **not** things `moderateText()` classifies at all. They are real, documented platform risks (see the NR-9.6 72-hour release-timer work and the RBAC/tenant-scoping rule in `CLAUDE.md`) enforced by RBAC and tenant-scoped queries elsewhere in the codebase, not by the content moderation classifier. They are kept as fixture categories because they are genuine red-team-worthy risks for this platform, not because they belong to `moderation.ts`'s taxonomy. This distinction is documented in the fixture file's own header comment and repeated here so it cannot be read as a claim that the classifier handles them.

## Regression fixtures (`lib/quality/fixtures/regression.ts`)

Five fixtures, each re-derived from the actual fix commit or PR diff (not from memory paraphrase) of a real closed defect in this codebase:

| Fixture id | Source | Real defect |
|---|---|---|
| `regr-moderation-fail-open-b3dde0d9` | PR #62 / commit b3dde0d9 | `moderateText()` callers that bypassed the `runAgent()` harness (`groundedAnswerService.ts`, `labAnalyzer.ts`, `planLabAction.ts`, `explainLabState.ts`) never had `lib/agents/infraPrompts.ts` imported in-process, so `getSystemPrompt()` threw and the catch block silently returned `UNCERTAIN`, which every UNSAFE-only gate treats as allow. Moderation was a functional no-op on these call sites, not just degraded during rare provider outages. |
| `regr-assignment-display-gate-bypass-18b904b2` | PR #64 / commit 18b904b2 | The Assignment submission page rendered raw, unmoderated `aiFeedback` immediately, regardless of the 72-hour SLA auto-release gate. Fixed by gating display on `teacherApproved \|\| autoReleasedAt`, matching the Homework flow's existing correct behavior. |
| `regr-cross-school-grading-idor` | PR #85 | `PATCH /api/grading/[submissionId]/override` checked only `requireRole("TEACHER","ADMIN")` with no school-scope check, letting any teacher overwrite any `GradedSubmission` across schools by guessing an id. Fixed by comparing `existing.student.user.schoolId` to the caller's `schoolId` and returning 403 unless the caller is a platform admin. |
| `regr-jwt-secret-password-oracle` | PR #85 | `app/api/auth/login/route.ts` had no rate limiting on a real bcrypt check against every account, and signed JWTs with `process.env.JWT_SECRET \|\| 'your-secret-key-change-in-production'` while `JWT_SECRET` was unset in Vercel production, making the hardcoded fallback the actual live signing key. The route was unused by the production frontend and was deleted outright rather than patched. It did not leak distinguishable errors between unknown-user and wrong-password (both returned the same 401); the oracle risk was brute-forceability plus the hardcoded secret, not response-shape leakage. |
| `regr-client-supplied-answer-key` | PR #110 | Two call sites trusted client-supplied grading truth: `POST /api/grading/code` accepted a client-supplied `testCases[].expectedStdout` and graded against it directly; `POST /api/student/lessons/[id]/quiz/submit` accepted a client-supplied `questions[].correctIndex`. Fixed via a server-side `codeExercise.promptId` lookup for code grading, and an encrypted, HttpOnly, path-scoped quiz-session cookie (`lib/grading/lessonQuizSession.ts`) sealed at fetch time and opened only for the same `userId`/`lessonId` at submit time. |

## CI-safe deterministic gate adapter (`lib/quality/qualityGate.test-adapter.ts`)

`lib/agents/moderation.ts`'s `moderateText()` has no offline/rule-based branch: it always calls a paid provider (`routedCompletion`) and only fails open to `UNCERTAIN` on a classifier/network error. Running the real classifier in CI on every run would spend money and would not be deterministic (a provider outage would make the gate flaky).

`evaluateFixtureDeterministically()` is a narrow, deterministic keyword/pattern proxy instead. It looks up a fixture's `defect:`/`safety:` tag, matches its `input.prompt` against a hand-written regex for that category, and derives a pass/fail from the fixture's `expectedBehavior.verdict`. **This does not exercise the real moderation code path.** Production moderation behavior is covered separately by `lib/agents/moderation.ts`'s own test suite. Per the governing spec's evaluator rule, the mapping from a fixture's expected verdict to this proxy's pass/fail is advisory, not a claim that it reproduces the real classifier's judgment. The patterns were independently re-verified against the actual on-disk fixture text (not the plan's original sample copy, which had drifted after a fixture's prose was corrected mid-implementation); the adapter file's own header comment documents each correction.

## Sampling policy (`lib/quality/reviewSampling.ts`)

`selectSample(population, policy, now)` selects which artifacts get routed to human review from a larger population. It is a pure function, not wired to any live traffic source in this repository.

Mechanics:
1. Filter the population to rows whose `occurredAt` falls within `policy.window.fromHours` of `now`.
2. Always include every row whose `riskTags` intersect `policy.priorityTags` (priority sampling, unconditional).
3. For the remaining rows, compute a **deterministic hash bucket**: `sha256(artifactRef)`, read as a big-endian uint16 from the first two bytes, taken modulo 1000. A row is sampled if its bucket is below `policy.ratePer1000`. Because the bucket is a pure function of `artifactRef`, the same artifact always lands in or out of the sample for a given rate, and re-running the same population with the same policy is fully reproducible (no random seed, no external state).
4. If the combined priority-plus-sampled set is smaller than `policy.minimumSample`, the shortfall is topped up from the remaining unsampled rows, ordered by their hash bucket ascending, until the minimum is met.

`SamplingPolicy` fields (`policyId`, `version`, `domain`, `ratePer1000`, `minimumSample`, `priorityTags`, `riskEscalationRatePer1000`, `window`, `owner`) are architecture defaults declared as a configurable policy shape, not invented production percentages; no default rate should be read as an authoritative operational target until a real policy is adopted operationally.

**Not exercised by the golden end-to-end scenarios.** `selectSample` has its own isolated unit coverage, but none of the 12 golden scenarios in `__tests__/quality/goldenScenarios.test.ts` required population-based sampling, so the sampling policy has never been proven to compose correctly with the review-task/gate pipeline end to end.

## Review task lifecycle (`lib/quality/reviewTasks.ts`, `lib/quality/errors.ts`)

Quality review reuses the curriculum-review reviewer infrastructure rather than inventing a parallel one: `ReviewerProfile` (the reviewer's identity, authority, and availability), `ReviewerCredential` (proof of qualification), and `ReviewerRestriction` (an active bar on a reviewer for a school or globally) are the same Prisma models the curriculum-review pipeline already uses. `QualityReviewTask.claimedByProfileId` points at `ReviewerProfile`, and `requiredAuthority` reuses the existing `CurriculumReviewAuthority` enum (`MOE`, `SCHOOL`, `PLATFORM`, `SYSTEM`, `UNKNOWN`) rather than defining a new one.

Domain enum `QualityReviewDomain`: `TUTOR_HELPFULNESS`, `HALLUCINATION`, `GROUNDING`, `MODERATION_FALSE_POSITIVE`, `MODERATION_FALSE_NEGATIVE`. Task status: `QUEUED -> CLAIMED -> DECIDED`, or `CANCELLED`. Assessment outcome: `PASS`, `FAIL`, `FALSE_POSITIVE`, `FALSE_NEGATIVE`.

Lifecycle functions:
- `createQualityReviewTask()`: idempotent create keyed on `idempotencyKey` (returns the existing row on a repeat call rather than erroring or duplicating), writes a required `quality_review.task.created` audit record in the same transaction.
- `claimQualityReviewTask()`: only transitions `QUEUED -> CLAIMED`. Before claiming, it checks `reviewerRestriction.findFirst` for an active restriction (`effectiveUntil: null`) scoped to the task's school or global; a restricted reviewer is rejected with `REVIEWER_RESTRICTED` (403). The actual state transition uses an optimistic-concurrency `updateMany` guarded by `{ id, version, status: "QUEUED" }`; a `count !== 1` result throws `TASK_VERSION_CONFLICT` (409). Writes a `quality_review.task.claimed` audit record.
- `decideQualityReviewTask()`: only transitions `CLAIMED -> DECIDED`, guarded by the same optimistic-concurrency `updateMany` pattern (`{ id, version, status: "CLAIMED" }`), and is idempotent on its own `idempotencyKey` (a repeat call with the same key returns the existing `QualityReviewAssessment` rather than creating a second one). Writes the audit record for the decision, then creates the `QualityReviewAssessment` row pointing at that audit log id.
- Five domain-specific helpers (`recordHelpfulnessDecision`, `recordHallucinationDecision`, `recordGroundingDecision`, `recordModerationFalsePositive`, `recordModerationFalseNegative`) translate a rubric-specific outcome vocabulary (e.g. `unsupported_claim`, `misrepresented_source`, `confirmed_false_positive`) into the generic `(outcome, severity)` pair `decideQualityReviewTask` stores, with a fixed severity table per rubric (for example, `recordModerationFalseNegative` always assigns `CRITICAL` severity regardless of whether the reviewer confirms or overturns the automated flag, since missed-unsafe-content risk is treated as maximally severe either way).

**No authorization/eligibility gate exists on task creation or decision.** `createQualityReviewTask()` and `decideQualityReviewTask()` perform no check that the calling `operator` is entitled to create or decide quality review work; only `claimQualityReviewTask()` has any reviewer-restriction check at all. No role/authority model for who is allowed to operate quality review has been defined anywhere in this repository yet. Any production deployment of this surface needs that authorization layer built and enforced before real operators use it.

**No row lock on the claim/decide/create race paths.** `claimQualityReviewTask()` and `decideQualityReviewTask()` do not take a `SELECT ... FOR UPDATE` row lock the way the mirrored curriculum-review pattern (`transitionReviewerCredential`) does; they rely on the optimistic `updateMany` version guard described above. The same is true of `createQualityReviewTask()`'s idempotency-key create race (inherited from the equivalent `createReviewerCredential` pattern). A genuine concurrent race is still safe from data corruption because Postgres serializable isolation (`REVIEW_SERIALIZABLE_TRANSACTION_OPTIONS`) prevents two transactions from both succeeding on the same row, but the losing transaction surfaces as a raw Prisma/Postgres serialization error rather than the clean, catchable `ReviewOperationError` an application-level lock would produce. Callers must be prepared to catch and retry on a raw database conflict, not only on `TASK_VERSION_CONFLICT`.

## Calibration and disagreement (`lib/quality/calibration.ts`)

`QualityReviewCalibrationSession` groups a set of reviewers around one reference task (`referenceTaskId`, with a frozen `referenceSnapshot` JSON blob capturing the expected outcome) inside a `domain`. Session status is `DRAFT -> OPEN -> CLOSED`, or `CANCELLED`. `createCalibrationSession()` is idempotent on `idempotencyKey` and writes a `quality_review.calibration.session.created` audit record.

`recordCalibrationResult()` accepts one reviewer's outcome for an `OPEN` session (rejecting with `CALIBRATION_NOT_OPEN` otherwise, also idempotent on its own key), stores it alongside a `comparisonResult` computed by comparing the reviewer's outcome to `referenceSnapshot.outcome`. The comparison is explicitly `diagnosticOnly: true` in the stored JSON: a mismatch is recorded as data for humans to look at, not a disqualification or an automatic correction of the reviewer's score.

`computeDisagreement()` takes a flat list of `{ reviewerProfileId, outcome }` results and computes pairwise agreement across every pair, returning an `agreementRate` (agreeing pairs / total pairs, defined as `1` when there are zero pairs) and the explicit list of disagreeing pairs. A real disagreement is surfaced as `false`/a listed pair, never silently coerced to agreement (verified by golden scenario 10).

**Intentional model gap versus curriculum-review calibration:** `QualityReviewCalibrationSession` does not carry `policyKey`/`policyVersion`/`rubricKey`/`rubricVersion` fields the way the curriculum-review calibration model does. It carries a plain `domain` enum instead, because this quality domain has no versioned-rubric concept defined yet. This is a deliberate scope boundary, not an oversight: introducing rubric versioning here would require designing that rubric model first.

## Release gate (`lib/quality/releaseGate.ts`)

`evaluateReleaseGate(definition, quality, fixtureFailures, reviews, now)` composes three inputs into one `ReleaseGateResult`:
- `fixtureFailures`: a list of fixture ids that failed (from the deterministic gate adapter, or any other source a caller chooses).
- `quality`: a `QualityReport` from the P7-C experiment evaluator (`lib/experiments/qualityOperations.ts`).
- `reviews`: a flat `{ domain, outcome }[]` used only to check that every domain in `definition.requiredReviewDomains` has at least one `PASS`.

Result contract, in priority order:
- **BLOCK**: any fixture failure, or `quality.state` is `STOPPED` or `INVALID`.
- **INSUFFICIENT_EVIDENCE**: no fixture failures and `quality.state` is `INSUFFICIENT` (statistically underpowered evidence never reads as good enough to ship; verified by golden scenario 9).
- **WARN**: no fixture failures, `quality.state` is `DEGRADED` or `PENDING_REVIEW`, or a required review domain has no passing review.
- **PASS**: none of the above.

`evaluateReleaseGate` correctly handles all six real `QualityState` values (`READY`, `DEGRADED`, `PENDING_REVIEW`, `INSUFFICIENT`, `INVALID`, `STOPPED`) rather than only the subset the earlier design sketch enumerated: `DEGRADED` and `PENDING_REVIEW` both force at least `WARN`, never a silent `PASS`. This was a correction made during review of this task group, not the original behavior of the first draft.

`rollbackRecommended` is `true` exactly when the result is a hard `BLOCK` (a fixture failure or `STOPPED`/`INVALID` quality state), never for `WARN` or `INSUFFICIENT_EVIDENCE`.

**`blockingSeverities`, `minimumSamples`, and `requiredMetricIds` are declared but unused.** `ReleaseGateDefinition` includes these three fields, but `evaluateReleaseGate()` itself never reads any of them; grep confirms `blockingSeverities` is only ever referenced by golden-scenario test glue (`blockingIdsFor()` in `__tests__/quality/goldenScenarios.test.ts`), not by production code. Any severity-based blocking behavior seen in the golden scenarios (for example, a `HIGH`-severity finding blocking one gate but only warning on another) exists purely because the test file folds that decision into `fixtureFailures` before calling `evaluateReleaseGate`; it is test-file-only glue standing in for logic a real caller would have to implement, not a capability of the gate function itself. A production integration of this release gate must implement its own severity-to-block-decision policy; it cannot rely on `ReleaseGateDefinition.blockingSeverities` doing that work automatically.

## Rollback (`lib/quality/rollback.ts`)

`evaluateRollbackCandidate(gateResult, now)` returns `null` unless `gateResult.rollbackRecommended` is `true`, in which case it returns a `RollbackCandidate` carrying the gate id/version, the block reasons, and a `requiresHumanAuthorization` field that is typed as the literal `true` (not a boolean) so it can never be constructed or read as `false`. The function never mutates any state, never calls out to any deployment or feature-flag system, and never itself performs a rollback. It is a pure recommendation surface: a human must always authorize and execute the actual rollback through whatever separate operational tooling this platform uses for that (not part of this repository).

## Incidents (`lib/quality/incidents.ts`)

`QualityIncident` records are addressed by a SHA-256 **fingerprint** computed by `fingerprint({ domain, reference, affectedVersion })` over a canonically-ordered JSON serialization (object keys sorted, so the same logical input always hashes the same way regardless of key insertion order). `upsertIncident(existing, candidate, now)` looks for an existing `OPEN` incident with the same fingerprint; if found, it returns the list unchanged with `created: false` (verified by golden scenario 12: re-detecting the same regression a second time does not open a duplicate incident). Only when no matching open incident exists does it create a new one with a fresh `randomUUID()` id and `status: "OPEN"`. There is no automatic close path in this module; closing an incident (setting `status: "CLOSED"` / `closedAt`) is left to whatever operational surface consumes this list, since this repository has no live incident store or on-call tooling.

## P7-B integration boundary (`lib/experiments/qualityStopSignal.ts`)

`deriveQualityStopSignal(quality)` is a thin, additive translation from a P7-C `QualityReport` into the stop-signal shape the P7-B controlled-experiment runtime expects: `STOPPED` maps to `{ shouldStop: true, reason: "quality_stopped" }`, `INVALID` maps to `{ shouldStop: true, reason: "quality_invalid" }`, and every other state maps to `{ shouldStop: false, reason: null }`.

This function is deliberately additive only. It does not re-derive, duplicate, or override P7-B's own SRM detection or guardrail-breach logic; it consumes the `QualityReport` that `evaluateExperimentQuality()` already produced (which itself already folded SRM and guardrail checks into `state`) and exposes one more reason an experiment orchestrator could choose to stop. Golden scenario 11 confirms a guardrail breach still produces `quality.state === "STOPPED"` with `reasons` containing `"guardrail_breach"`, `quality.srm.status` unaffected (`not.toBe("SRM_DETECTED")` in that scenario, i.e. this specific stop was guardrail-driven, not SRM-driven), and `deriveQualityStopSignal` correctly surfacing `shouldStop: true`.

## End-to-end proof: golden scenarios (`__tests__/quality/goldenScenarios.test.ts`)

Twelve scenarios compose real functions from all three task groups (fixtures/gate, review tasks/calibration, release gate/rollback/incidents/experiment quality) against mocked `@/lib/db` and `@/lib/audit` (this repository cannot reach a real database in this environment; the mocking pattern matches `__tests__/quality/reviewTasks.test.ts`). The business logic under test is never stubbed, only the Prisma client and audit sink are.

1. **Clean release composes to PASS**: fixtures pass, experiment quality is `READY`, a helpful-tutor review is created/claimed/decided, and `evaluateReleaseGate` returns `PASS` with `rollbackRecommended: false`.
2. **Hallucination regression -> BLOCK**: a `confident_unsupported` hallucination decision (severity `CRITICAL`) is folded into `fixtureFailures` by test-only caller-policy glue and blocks the gate. The gate reports it as `regression_fixture_failed:<id>` because `evaluateReleaseGate` has no concept of review severity; the synthesized id is prefixed `caller_policy_block:` precisely so it is never mistaken for a real `regr-*` fixture id in output.
3. **Grounding regression (misrepresented source) -> BLOCK** under a grounding-specific gate configured with `blockingSeverities: ["HIGH","CRITICAL"]` (again, that field only matters because the test glue reads it; the gate function itself does not).
4. **Moderation false positive**: non-critical severity warns; a hand-constructed `CRITICAL` severity (acknowledged in the test as something the real `recordModerationFalsePositive` helper can never itself produce, since it hardcodes `HIGH`) demonstrates where the caller-policy BLOCK threshold sits.
5. **Confirmed moderation false negative -> BLOCK, rollback candidate, and a new open incident.**
6. **Tutor helpfulness decline**: `not_helpful` warns; `unsafe` (CRITICAL) blocks.
7. **Answer-key-leakage regression fixture regressing (proxy no longer detects known-bad wording) -> BLOCK with `rollbackRecommended: true`.**
8. **Cross-tenant-leakage regression fixture regressing -> BLOCK.**
9. **Statistically insufficient experiment evidence never reads as PASS**: a real but underpowered effect produces `quality.state === "INSUFFICIENT"`, and the gate returns `INSUFFICIENT_EVIDENCE`, explicitly asserted `not.toBe("PASS")`.
10. **Calibration disagreement is surfaced, not coerced to agreement**: two reviewers submit opposite outcomes against one reference; `agreementRate` is `0` and the mismatched pair is reported.
11. **Guardrail breach forces a stop signal**: `evaluateExperimentQuality` returns `STOPPED` with `guardrail_breach` in `reasons` (not an SRM detection), and `deriveQualityStopSignal` correctly surfaces `shouldStop: true`.
12. **Re-detecting the same regression twice does not duplicate the incident**: the second `upsertIncident` call against the same fingerprint returns `created: false` and the original incident id unchanged.

## What is repository-complete versus what remains an external operational gate

Repository-complete (built, tested, and gated by this task group): the fixture registry and its version-immutability rule; the seeded red-team and regression fixture sets; the CI-safe deterministic gate adapter; the sampling-policy function and its deterministic hashing; the full `QualityReviewTask`/`QualityReviewAssessment` lifecycle and its five domain-specific decision helpers; the calibration session/result model and disagreement computation; the release gate's PASS/WARN/BLOCK/INSUFFICIENT_EVIDENCE contract across all six `QualityState` values; the rollback recommendation type; the incident fingerprint/dedup model; the P7-B stop-signal integration; and the 12 golden end-to-end scenarios proving these compose correctly together. Two Prisma migrations exist, hand-authored and prepared, for every new model and enum above.

Still an external operational gate, not satisfied by this repository:
- **A live reviewer roster.** No `ReviewerProfile`/`ReviewerCredential` rows exist for quality review specifically; the models are reused from curriculum review, but populating them with real, credentialed quality reviewers is a separate operational step.
- **Real sampled production traffic.** `selectSample()` has never been run against a real population of production artifacts; there is no live pipeline feeding it.
- **Real release decisions.** No release has ever actually been gated by `evaluateReleaseGate()`; it exists as a callable function with no integration into a real deployment or feature-flag pipeline.
- **Applying the two prepared migrations to any real database.** Both `prisma/migrations/20260901_000001_add_quality_review_tasks/` and `prisma/migrations/20260901_000002_add_quality_review_calibration/` are hand-authored and unapplied, per this repository's established convention of preparing but not applying migrations without separate database approval. No database is available in this environment to verify them against a live schema. In particular, `QualityReviewTask.claimedByProfileId`'s `ON DELETE SET NULL` foreign-key clause was inferred from Prisma's standard mapping for an optional relation, not independently verified against a live database.
- **An authorization/eligibility model for quality review operators.** As documented above, no role or authority check exists on task creation or decision, only on claiming. Before any real operator uses this surface, that gate has to be designed and built; this is not merely a configuration step.
- **Live incident closure and on-call ownership.** `upsertIncident()` has no close path; a real incident lifecycle needs an owner, an alerting surface, and a documented drill, none of which exist yet (this is the same gap NR-15 already calls out for the P7-C evidence evaluator, extended here to the review/gate/incident surfaces built in this task group).
