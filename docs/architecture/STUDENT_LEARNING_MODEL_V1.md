# Student Learning Model V1

## Authority and scope

Student Learning Model V1 is the canonical, replayable learning-state authority
for the governed Grade 4 mathematics slice. It consumes only evidence admitted
by the published `lr-moe-g4-math-fractions-2026.1` release. The client, an
offline device, legacy mastery services, and LLM output cannot write this state.

The single persistence boundary is
`lib/learning-state/masteryWriter.ts`. It writes the reserved
`learning.canonical.mastery_update.v1` event type directly to the existing
append-only `LearningEvent` stream and fails closed if persistence is
unavailable. The deterministic primary key, not the non-unique `dedupeKey`, is
the idempotency authority. A primary-key collision is accepted as a duplicate
only after the stored canonical envelope is validated.

No database schema or migration is introduced. Historical
`learning.evidence_admission.recorded` telemetry, `StudentMasteryProfile`,
`MasteryRecord`, `AdaptiveMasteryRecord`, and `MisconceptionTag` records are
never replay inputs.

## Versioned semantics

| Contract | Version | Meaning |
|---|---|---|
| Student state | `student-learning-model/1.0.0` | Output shape and authority declaration |
| Mastery reducer | `mastery-reducer/1.0.0` | Evidence validation, ordering, weighting, confidence, conflict, and explanation rules |
| Retention | `exponential-half-life/1.0.0` | Explicit as-of projection with a 30-day policy half-life |
| Misconception signals | `misconception-signal-policy/1.0.0` | Platform-governed, exact distractor interpretations without mutating the published MOE release |
| Misconception review | `misconception-review/1.0.0` | Teacher/Admin confirmation or rejection tied to governed evidence |
| DecisionModel input | `decision-model-learner-state/1.0.0` | Provider-neutral handoff contract; action selection is deliberately absent |

Replay validates every event, rejects unsupported versions and scope mismatch,
deduplicates byte-equivalent event IDs, rejects conflicting duplicates, and
sorts by trusted server occurrence time followed by stable event ID. `asOf` is
always explicit; replay does not read the wall clock.

## Interpretable state

Mastery and confidence are separate:

- observed mastery is the context-weighted correct share (`DIAGNOSTIC` 1.0,
  `TEACHER_OBSERVATION` 0.9, `PRACTICE` 0.7);
- confidence describes evidence sufficiency, diversity, independence, and
  contradiction, not correctness;
- no evidence produces unknown mastery rather than zero mastery;
- one released item can never exceed 0.45 confidence, even after repetition;
- positive and negative evidence IDs and strengths remain visible alongside
  the aggregate score.

These weights and thresholds are transparent V1 policy heuristics. They are
not claimed to be empirically validated probabilities.

Retention is a projection, not a mutation. Observed mastery remains unchanged
as time passes. The retained-mastery estimate decays from the latest governed
correct response at the pinned 30-day half-life, and the state reports
`FRESH`, `DUE`, or `AT_RISK`. A response is a retention probe only when a
prior independent same-concept success exists at least seven days earlier;
the writer derives this and callers cannot assert it. Administrative grade is absent from reducer inputs and
the output permanently declares `mayChangeAdministrativeGrade: false`.

## Misconception authority

The separately versioned LiberiaLearn educational-policy overlay contains one
exact known distractor mapping: choosing `4/3` when asked for three equal parts
out of four may signal numerator / denominator reversal. The immutable
published MOE ontology release and item versions are unchanged, and the learner
response never receives the overlay. The student route uses an explicit
learner-safe projection that also omits canonical evidence IDs, human reviews,
teacher explanations, and the internal DecisionModel handoff.

One governed wrong answer creates only `SUSPECTED`. Confirmation or rejection
uses the authenticated teacher/admin endpoint and requires a same-tenant human
review referencing the exact canonical evidence ID. Both decisions are
preserved; conflicting human reviews produce `CONFLICTED`. Generic wrong
answers, legacy tags, AI gap analysis, and mutable taxonomy labels cannot
confirm or reject canonical misconception state.

Teachers obtain those opaque identifiers from the same endpoint's scoped GET,
which limits teachers to students enrolled in their own same-school classes
(and Admins to their school) and returns suspected signals with their canonical
evidence IDs. A client-supplied identifier is
still revalidated against canonical replay before any review is appended.

## DecisionModel handoff

`toDecisionModelLearnerState` exposes:

- `authoritativeLearnerState`;
- an empty `validCandidateActions` list;
- evidence-based `decisionIntelligence`;
- pinned `governedPolicyResolution` metadata.

The empty candidate set and `NOT_IMPLEMENTED_IN_THIS_MISSION` action-policy
status are intentional. The next mission may resolve valid actions and policy
without making a provider, LLM, or orchestration layer authoritative over
learner state.

## Calibration evidence and limitations

Deterministic fixtures cover empty, sparse, negative, repeated-item,
contradictory, context-weighted, stale, retention-probe, shuffled, duplicate,
future-dated, cross-tenant, forged-authority, misconception review,
DecisionModel, legacy projection, and teacher-explanation cases. Route and
writer tests cover mandatory persistence, exact-binding derivation, individual
client authority claims, concurrent duplicate recovery, and hostile raw-event
ID collisions.

This is fixture-calibrated behavior only. The repository contains no learner
outcome study validating the V1 confidence formula, mastery thresholds, or
30-day half-life. The governed slice has only one item per concept, so V1
correctly keeps confidence conservative. Empirical calibration requires a
separate governed study and human educational-policy review.
