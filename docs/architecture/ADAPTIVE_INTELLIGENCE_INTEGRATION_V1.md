# Adaptive intelligence integration V1

This is a source-verified boundary record for the adaptive-intelligence
integration. It does not alter curriculum source data or release authority.

## Existing production path

The certified path is:

`learner action -> governed admission -> LearningEvent -> replayStudentConceptState -> DecisionModel -> Learning Orchestrator`

- `lib/learning-authority/governedGrade4Math.ts` owns the published ontology,
  item/binding identity, evidence policy, tool policy, tenant/student admission,
  and version checks.
- `lib/learning-authority/learningOrchestrator.ts` is the sole next-action
  handoff. It generates candidates from a validated published release, supplies
  the canonical learner state to the `DecisionModel`, validates model output,
  supports an authorized teacher override, and records recommendation,
  resolution, and decision separately.
- `lib/learning-state/masteryWriter.ts` is the canonical append-only writer.
  It validates student membership, writes `LearningEvent`, treats the event id
  as an idempotent key, and replays the concept state.
- `lib/learning-state/studentLearningModel.ts` is the persistent state
  projection. It combines governed evidence with existing mastery, retention,
  misconception, conflict, confidence, recency, and teacher explanation.
  The reducer versions and retention estimate remain unchanged by this mission.
- `prisma.schema.prisma` model `LearningEvent` is the append-only storage
  entity used by the certified writer. Its school, student, user, occurred-at,
  client-event, dedupe, curriculum-version, calculation-version, and metadata
  fields preserve tenant and replay context.

## Canonical evidence contract

`lib/learning-evidence/evidenceContract.ts` adds the single provider-neutral
`governed-learning-evidence/1.0.0` envelope. It covers lesson completion,
classwork, homework, practice, quiz, diagnostic, exam/test, project, practical,
lab, and simulation evidence. It carries learner/tenant/objective/activity and
version identity, attempt and idempotency identity, timestamp, performance,
provenance, modality, offline/sync identity, and descriptive evidence-strength
metadata. Metadata is deliberately not a weighting policy.

`toCanonicalMasteryEvidence` is the only V1 adapter into the existing mastery
reducer. It admits released, server-scored diagnostic/practice/quiz-shaped
items only. Lab and interactive evidence can be recorded in the same contract,
including manipulated state, prediction, observation, procedure outcome,
misconception signals, checks, retries, hints, completion, and explanation in
`performance.payload`/`signals`; it cannot directly write canonical mastery.

`deduplicateGovernedEvidence` rejects conflicting replays for one idempotency
identity. Canonical reducer deduplication still remains the final replay guard.

## Current gaps and duplicate paths

- `lib/adaptive/updateMastery.ts` writes `AdaptiveMasteryRecord` using a
  separate EMA/streak formula. Repository search found only its unit tests as
  callers; it is a legacy compatibility/read-display path and must not be used
  as the next-action authority.
- `lib/mastery/masteryService.ts` writes `StudentMasteryProfile` using the
  older strand/grade-band scoring model. It is still called by
  `lib/waec/practice.ts` and `lib/student/completeScheduledLesson.ts`, so it is
  an active legacy compatibility path, not the canonical source for the
  governed DecisionModel. New governed evidence must not be routed through it.
- `lib/adaptive/practiceGenerator.ts` can generate AI practice questions. Those
  generated questions are not governed inventory and therefore are outside the
  certified orchestrator handoff until they are released and bound. The new
  orchestrator does not call this generator.
- The prior orchestrator threw when inventory was empty. V1 now returns an
  explicit `NO_VALID_RESOURCE` decision with `action: null`, preserving safe
  intervention/escalation behavior rather than fabricating content.

## Decision and oversight boundary

The `DecisionModel` may rank only server-supplied candidates. The orchestrator
validates every returned id against the release inventory, falls back to the
deterministic baseline on provider failure/uncertainty, and exposes teacher or
admin overrides as an explicit governed resolution. Recommendations have
learner-state revision and release identity for traceability; neither model
output nor recommendation can write canonical mastery or administrative grades.

No Manager/Master/Mission Loop implementation was found on `origin/main` in
the inspected `scripts/manager-loop` path. Existing `lib/agents/*` operational
agents are bounded to detection, preparation, validation, and workflow work.
They are not educational authority: they cannot approve curriculum, set
mastery, place learners, or make consequential student decisions.

## Proof and remaining integration

The focused contract fixture proves released objective/activity -> governed
evidence -> existing mastery/SLM replay -> DecisionModel -> orchestrator. It
uses the repository's published compatibility fixture only. Once the MOE Grade
4 Math mission merges, its released objective/activity inventory should replace
that fixture as the first real curriculum proof cell; no code dependency on
Claude's worktree is introduced here.
