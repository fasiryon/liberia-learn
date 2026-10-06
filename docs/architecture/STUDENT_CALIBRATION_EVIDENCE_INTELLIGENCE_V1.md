# Student Calibration & Evidence Intelligence V1

Status: implemented as read projections and versioned policies on top of the
existing learner-intelligence architecture. Every policy value is a
**starting hypothesis that needs educational review** (`status:
STARTING_HYPOTHESIS_REQUIRES_EDUCATIONAL_REVIEW`). None of it is approved
pedagogy.

Base: `e9eecfd2`. Code: `lib/learning-calibration/`. Tests:
`__tests__/learning-calibration/`. Simulator: `scripts/simulate-learner-path.ts`.

## 1. What did not change (authority)

| Authority | Owner | Change in V1 |
|---|---|---|
| Canonical learner state (mastery, confidence, retention, misconception) | Student Learning Model, `lib/learning-state/studentLearningModel.ts` (replay) | **None.** No new fields and no second model. |
| Canonical writes | `lib/learning-state/masteryWriter.ts` (governed writer) | **None.** V1 has no writer. |
| Learning input | Governed evidence contract, `lib/learning-evidence/evidenceContract.ts` | **None.** V1 only reads it. Placement emits records through `createGovernedEvidence`. |
| Next-action ranking | `DecisionModel` interface + `deterministicDecisionModel` | **None.** There is no DecisionModelV2. Model input and output contracts are unchanged. |
| Next-action decision | Learning Orchestrator, `resolveLearningDecision` | Takes an optional calibration snapshot. With one, the early-learning policy chooses **among the candidates the DecisionModel already ranked**. A teacher override still wins. |
| Official enrollment grade | Student record; changes only through human `confirmOfficialPlacement` (PLACEMENT_CONFIRM) | **None.** Every V1 output carries `mayChangeAdministrativeGrade: false`. |

The orchestrator and the calibration projection both read the prerequisite
threshold from `lib/learning-authority/progressionPolicy.ts`, so they cannot
disagree about what counts as "prerequisite met".

Nothing in V1 writes to a database. Every function is pure and
deterministic, takes an explicit `asOf`, and is computed in the cloud.

## 2. Components

### 2.1 Evidence quality policy (`evidenceQualityPolicy.ts`, `evidence-quality-policy/1.0.0`)
Describes each governed evidence record by what can be observed about it:
source type, independence (independent, hinted or assisted), supervision,
recency, declared difficulty, attempts, reliability, directness and provenance
(including offline and prior-record imports). It then assigns an ordinal
**corroboration class**: STRONG, MODERATE, WEAK or EXCLUDED.

- There are no gradebook weights. The output says `isGradebookWeight: false`
  and `mayChangeCanonicalMastery: false`.
- Completion-only records, records with no observable performance, and
  inferred records are EXCLUDED.
- Assisted work (including AI tutor practice), work with three or more
  retries, and unsupervised unassessed work are WEAK.
- Stale records drop one class.

### 2.2 Evidence sufficiency and calibration state (`calibrationState.ts`, `learner-calibration-policy/1.0.0`)
Per competency, sufficiency is one of NONE, INSUFFICIENT, PARTIAL or
SUFFICIENT. It is calculated as follows:

- **Canonical independent occasions.** These come from the SLM.
- **Corroborating occasions.** These are governed records that have no
  canonical mastery adapter, such as homework, labs, teacher records, placement
  and prior history. Each independent occasion counts once, at the best class
  recorded for it. Credit is STRONG 1, MODERATE 0.5, WEAK 0. A record that is
  already canonical is never counted twice.
- **Downgrades.** Contradiction (SLM `conflict.score`), staleness, or
  corroboration that disagrees with the canonical estimate cap the level at
  PARTIAL. Every downgrade is listed in `reasons`.

The learner calibration stage is derived from per-competency sufficiency, never
from elapsed days:

| Stage | Condition |
|---|---|
| INITIAL | No competency has any evidence |
| PROVISIONAL | Every competency is NONE or INSUFFICIENT |
| CALIBRATING | At least one competency is PARTIAL or better, but the SUFFICIENT share is below ⅔ |
| STABLE | The SUFFICIENT share is ⅔ or more |

- A learner with prior history (imported reviewed records) can be STABLE on
  day 1.
- A learner with sparse evidence stays PROVISIONAL however many days pass.
  Tests cover this case.

### 2.3 Competency estimate (`competencyEstimate.ts`)
This is a read-only view of each competency. It covers:

- mastery estimate and level
- retention estimate, status and latest probe
- **confidence**: the SLM's certainty of the estimate, not learner ability
- evidence count and independent evidence count
- last evidence timestamp
- prerequisite status: NONE_REQUIRED, MET, UNMET or UNKNOWN
- misconception state
- sufficiency

Every SLM field is copied verbatim and traced back by `inputDigest` and
`reducerVersion`.

### 2.4 Placement orchestration (`placementReadiness.ts`)
- **Enrollment grade is not instructional readiness.**
- `placementToGovernedEvidence` turns placement responses into governed
  DIAGNOSTIC evidence only for items with a reviewer-approved binding to a
  released concept. Such evidence is marked INDIRECT, so it is MODERATE at best
  and never canonical. One placement sitting counts as one occasion.
- Unbound items are returned as `unboundItemKeys`. They are never mapped by
  title or difficulty.
- `deriveInstructionalReadiness` reports subject readiness (placement-indicated
  grade compared with enrollment) and competency readiness (READY_AT_GRADE,
  PREREQUISITE_GAP, PREREQUISITE_UNKNOWN, NOT_YET_EVIDENCED, NEEDS_PRACTICE or
  EXTENSION_READY). A competency whose prerequisite has no evidence is
  PREREQUISITE_UNKNOWN, never ready, matching the orchestrator.
  It always returns `officialGradeChange: "REQUIRES_HUMAN_PLACEMENT_CONFIRMATION"`.

### 2.5 Early-calibration learning policy (`earlyLearningPolicy.ts`, `early-learning-policy/1.0.0`)
The policy is configurable data with a mix for each stage:

- **GRADE_LEVEL**
- **PREREQUISITE_REMEDIATION**
- **EVIDENCE_SEEKING**

Each stage also has a cap on how much may be deferred to the DecisionModel
ranking ("personalized"). The personalization share is `min(stage cap,
sufficient share)`, so it grows as evidence improves: 0 at INITIAL, rising to 1
at STABLE.

The PROVISIONAL and CALIBRATING mixes start at 0.7/0.2/0.1 only as a starting
hypothesis. The policy is validated and versioned, and replacing it needs no
code change.

The selection is deterministic: a hash of the learner revision, the request
idempotency key and the policy version. If the intended category has no
eligible candidate, the policy falls back in a fixed order. It can only pick a
governed candidate that is already ranked. The choice is recorded in
`LearningPolicyResolution.earlyLearning`.

### 2.6 Participation signals (`participationSignals.ts`)
These are observable signals only:

- attendance rate
- inactivity (governed evidence counts as activity)
- assignment completion
- abandoned sessions
- repeated rapid incorrect responses
- help requests
- retries
- time since last evidence

Observations are de-duplicated by identity, so offline resends are safe.
Missing data is reported as null and is not flagged. The module has no words
for motivation, frustration, learning style or similar labels. Tests assert
that no such term appears.

### 2.7 Teacher intervention engine (`teacherInterventions.ts`)
Candidate kinds:

- PREREQUISITE_GAP
- REPEATED_MISCONCEPTION
- RETENTION_DECLINE
- INSUFFICIENT_EVIDENCE (contradiction or disagreement for one competency, or a learner who is INITIAL or PROVISIONAL)
- INACTIVITY
- READY_FOR_EXTENSION

Every candidate carries:

- **Triggering evidence**: evidence ids, signal codes and observation ids.
- **Reason**: a plain-language explanation.
- **Confidence**: the certainty of the trigger, not a judgement of the learner.
- **Recommended action**: may point only at a governed orchestrator candidate.
- **Teacher response**: ACCEPT, MODIFY or OVERRIDE.

`resolveTeacherInterventionResponse` turns a response into the orchestrator's
existing `TeacherOverride`. MODIFY and OVERRIDE require a reason, and an
ungoverned candidate is rejected. Candidates are advisory only, with
`llmGenerated: false`.

### 2.8 Offline model (`offlineCalibrationProjection.ts`)
- **Cloud canonical.** Calibration is computed only on the server.
- **Signed cached projection.** The projection is learner-safe, expiring and
  signed. Signing uses an injected signer and verifier, so the existing server
  key custody (RSA-SHA256, as in the content manifest) is kept. The device
  classifies a projection as TRUSTED, EXPIRED, INVALID_SIGNATURE or
  STALE_REVISION.
- **Queued observations.** `reconcileOfflineObservations` admits queued
  governed evidence with these rules:
  - It verifies the projection's signature before using its scope as the
    admission boundary (expiry does not block, since a queue can outlive the
    cached projection).
  - It re-admits every record: device-asserted server scoring, human
    verification and reliability are discarded, teacher provenance is refused,
    and a record the release can score is re-scored against the governed item
    (a disagreeing device result is rejected).
  - It requires offline sync identity.
  - It rejects records from another learner or another release.
  - It rejects conflicting duplicates.
  - Replays are idempotent.
  - It returns *evidence to replay*, never a mastery value.
  - After admission, the server recomputes calibration, and the result is the
    same as if the evidence had arrived online. Tests cover this.
- **No device mastery writes.** The projection is marked `deviceMayWrite:
  false` and there is no writer anywhere in V1.

### 2.9 Learner-path simulator (`learnerPathSimulator.ts`, `scripts/simulate-learner-path.ts`)
The simulator is deterministic and pure, and it refuses any scenario not
labelled `SYNTHETIC — NOT A REAL LEARNER`. These inputs can be controlled:

- enrollment grade
- placement
- released-item diagnostic and practice (canonical)
- homework, classwork and quiz
- AI tutor practice (always assisted, so WEAK)
- lab
- teacher evidence
- prior history
- misconception reviews
- participation
- teacher overrides

It runs the real chain unchanged: SLM replay → calibration and confidence →
mastery, retention and misconception → DecisionModel → Learning Orchestrator →
next action → intervention candidates. It then prints each stage.

## 3. Known limits (found, not hidden)
- The only executable release (`lr-moe-g4-math-fractions-2026.1`) binds
  **one item per concept**. The SLM caps confidence at 0.45 when a concept is
  covered by a single item, so SECURE mastery cannot be reached in this
  release. Sufficiency can still reach SUFFICIENT through independent
  occasions. READY_FOR_EXTENSION is tested directly against a SECURE estimate
  and will start appearing in real use once a release with item diversity is
  published.
- Placement items are not yet bound to released concepts. Until reviewers
  approve `PlacementConceptBinding`s, placement contributes subject-level
  readiness only.
- V1 is a library and is not wired into live routes or persistence. Exposing
  calibration or interventions in the teacher dashboard, persisting
  calibration snapshots, and delivering signed projections to devices are
  follow-on integration steps. Each one needs its own route review.
- All thresholds need educational review before any learner-facing
  activation. Examples: ⅔ stable share, 14/60-day recency, 3-second rapid
  response, 7-day inactivity, and the per-stage mixes.

## 4. Invariants enforced by tests
- No LLM, AI tutor or DecisionModel output can change canonical mastery. A
  hostile model falls back to the deterministic baseline.
- Calibration never changes the enrollment grade, and readiness requires human
  placement confirmation for any official change.
- Duplicate evidence never inflates sufficiency, and conflicting duplicates
  fail closed.
- A stale calibration is rejected by the early-learning policy: the canonical
  revision must match, and so must `inputRevision`, a digest of every
  calibration input (canonical revision, as-of time, full corroborating
  evidence, policy). The orchestrator requires `currentCalibrationRevision`
  whenever a calibration is supplied.
- A teacher override bypasses the early-learning policy and is still limited
  to governed candidates.
