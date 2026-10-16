# Assessment Architecture V2

Status: **foundation (pure domain + adapters).** Nothing in this change publishes, releases,
scores officially, writes grades or writes mastery. No schema migration is included.

Governing principle: *a lesson succeeds when students can independently demonstrate that they
learned, retained and can apply what it taught.* This architecture makes that evidence
trustworthy and auditable. It does not prove that any student has learned anything.

Code: `lib/assessment/v2/` · Tests: `__tests__/assessment-v2/` · Related:
`docs/architecture/content-factory/CONTENT_FACTORY_READINESS_V1.md` §5 (assessment authority
decision), `docs/architecture/STUDENT_LEARNING_MODEL_V1.md`,
`lib/learning-evidence/evidenceContract.ts`.

---

## 1. Phase 0 inventory: what exists versus what is missing

Inspected on `main` at `a1508cea`. PR #190 head `45d86dc5` and PR #191 head `5650c4be` were read and
not modified.

| Area | Exists today | Gap or conflict | V2 disposition |
| --- | --- | --- | --- |
| ContentBundle V1 (`lib/content-bundle/v1`) | `AssessmentReference` with `AssessmentDefinitionRef`/`AssessmentItemRef` "owned by a future assessment authority"; `secured` key/guide resource ids; exact-version hashing | No authority behind the pointers | **V2 is that authority.** `resolveBundleAssessmentReference` resolves exact versions only |
| ActivityDefinition V1 (`lib/activity-definition/v1`) | Hashed activity content; `evidenceIntent` (`FORMATIVE`, `SUMMATIVE_CANDIDATE`); `RubricReference` with learner-visible criteria and a protected scoring guide | Activities are not scored assessments; rubric support stops at a reference | Kept. V2 reuses the same split: learner-visible criteria on the item, scoring guide in `ProtectedScoringSpec` |
| Governed Grade 4 math release (`lib/learning-authority/governedGrade4Math.ts`) | Released items with server keys, construct bindings, evidence/tool policies; single-choice DIAGNOSTIC/PRACTICE → canonical mastery | Single-choice only; the release ontology owns its own items | **Reused.** V2 admitted evidence maps into `GovernedEvidence`. `toCanonicalMasteryEvidence` still decides whether a mastery write is possible |
| Learning evidence contract (`lib/learning-evidence/evidenceContract.ts`) | Provider-neutral append-only envelope, `canonicalMasteryMutation: false`, idempotency dedupe | No tier separation: raw, provisional, verified and admitted evidence share one shape | V2 adds the four-tier envelope upstream. `toGovernedLearningEvidence` emits only from `MASTERY_ADMITTED_EVIDENCE` |
| SLM / mastery writer (`lib/learning-state/*`) | Deterministic reducer, retention model with `RETENTION_PROBE_MIN_INTERVAL_DAYS = 7`, misconception review by an authorized human | Consumes Grade 4 governed evidence only | Unchanged. The SLM consumer port feeds it admitted evidence only |
| School exams (`Exam`, `ExamQuestion`, `ExamAttempt`, `lib/exams/*`) | Teacher/admin exam authoring, `DRAFT→PUBLISHED→CLOSED`, positional grading | **Leak:** the student list and start routes removed `correctIndex` but still sent `explanation` (the worked answer) before submission. Questions were read without `orderBy`, but grading matches answers by position. The list route lacked a `deletedAt: null` filter. `gradeAttempt` ignores `points` and counts unanswered as wrong. Publication has no item review | **Fixed in this PR:** allow-list projection, a stable question order, and the `deletedAt` filter. Exam stays operational; `legacyExamQuestionToCandidate` imports questions as V2 candidates |
| Legacy `Assessment` / Prisma `AssessmentItem` / `PracticeItem` / `Submission` | `PracticeItem.answerKey` JSON, `AssessmentItem` is a **membership row** | No lifecycle or versioning | Not renamed or conflated (Content Factory §5). V2 types are `AssessmentItemV2` etc. |
| `AssessmentAttempt` / `AssessmentAttemptDetail` | Generic attempt rows with `aiAssisted`, `sourceEventId`, `rawResponse` | `correctAnswer` stored on the detail rows; no tier labels | Survives as operational storage. A future adapter writes envelopes that reference it |
| Lesson quiz / `lessonQuizSession` / formative checks | Sealed keys, keyless formative checks | Not reviewed release truth | Unchanged; formative checks stay `PROVISIONAL_FEEDBACK` |
| AI grading (`lib/grading/*`, `lib/ai/staleGradeReleaser.ts`) | AI essay/code/homework grading | **Conflict:** `releaseStaleAIGrades` copies `aiGrade` into the official `score` after 72 hours without teacher approval | Flagged (see §9). V2 types make AI scores non-authoritative. The academic-records evaluator treats auto-released AI scores as not official |
| Answer release (`lib/learning-authority/answerRelease.ts`) | `NEVER` / `AFTER_COMPLETION` / `AFTER_TIME` for students in the same school | No per-item explanation/answer split | Generalised as `FeedbackReleasePolicy` + `learnerDisclosure` |
| G7 v0.3.0 (PR #191) | `curriculum/v2/g7/assessment-definitions/*.json`: `GOVERNED_CANDIDATE`, AI-authored, keys and rubric guides inline, `REVIEWER_ONLY` | No machine-checked separation of keys | `adaptG7CandidateTasks` reads the shape and moves keys and guides into protected specs. Items always come back as `CANDIDATE`, and keyed paper answers are `HUMAN_ONLY` |
| Offline (`lib/offline*`, `HomeworkSubmission.clientSubmissionId`) | Client UUID idempotency, sync batches | Arrival-order replay; last-write semantics vary | V2 replays by device sequence, treats an exact replay as a no-op, and treats a differing payload as a conflict |
| Audit (`lib/audit.ts`) | `logAudit` | — | V2 returns `AssessmentAuditEvent`s for callers to persist |

## 2. Authority boundaries

```
 author (human or AI)        validator           independent reviewer        release authority
  candidate item  ──────▶  integrity + hash  ──▶  checks on EXACT hash  ──▶  CURRICULUM_LEAD /
  + protected spec          (validator.ts)        (lifecycle.ts)              PLATFORM_ADMIN
                                                   AI = recommendation         (release.ts)
                                                                                    │
           ┌──────────────── deny-by-default delivery (resolveDelivery) ◀───────────┘
           ▼
  learner-safe projection ──▶ client capture ──▶ evidence gateway ──▶ server/human scoring
  (projection.ts)              (no scores)        RAW_OBSERVATION      (scoring.ts)
                                                                            │
                     VERIFIED_ASSESSMENT_EVIDENCE ◀─────────────────────────┘
                                 │  admission policy (learning authority)
                                 ▼
                     MASTERY_ADMITTED_EVIDENCE ──▶ consumer ports (consumers.ts; writes disabled)
```

The functions on each arrow are the only way across that boundary, and each one rejects what the
next stage must not receive.

## 3. Contracts (`types.ts`, `hash.ts`, `validator.ts`)

- **AssessmentDefinitionV2**: stable id and version, `purpose` (DIAGNOSTIC, FORMATIVE,
  SUMMATIVE, RETENTION, TRANSFER, EXAMINATION, PERFORMANCE), grade, subject, objectives,
  prerequisite objectives, and `alignment`. Alignment separates `nationalObjectiveIds` from
  LiberiaLearn `extensionObjectiveIds`, and every objective must be in exactly one of the two.
  The definition also carries the time limit, permitted tools, accommodations, attempt policy
  (reported attempt FIRST/LATEST/HIGHEST, never an average) and provenance.
- **AssessmentItemV2**: immutable version, `itemType`, a learner-visible `stimulus`, objectives,
  misconceptions, difficulty 1–5, cognitive demand, `context` (`NEW` = transfer), hints, a
  feedback release policy, provenance and `scoringSpecHash`.
- **ProtectedScoringSpec**: keys (select, numeric with tolerance and units, ordering, matching,
  short-answer list, rubric), max points, hidden explanation, misconception signals and
  moderation notes. Only the server scorer and authorized reviewers read it.
- **AssessmentFormV2**: an ordered list of exact `(itemId, itemVersion, itemHash, points)`, plus
  delivery rules (fixed or randomized by policy, offline `PROHIBITED`/`CAPTURE_ONLY`) and a
  scoring blueprint (total points and objective coverage).
- **AssessmentReviewV2**: the five checks (ACCURACY, ITEM_VALIDITY, ANSWER_VERIFICATION, FAIRNESS,
  ACCESSIBILITY), the actor, and a decision. AI actors can only `RECOMMEND_*`.
- **AssessmentReleaseV2 / ReleaseRevocation**: exact definition, form, item and scoring-spec hashes;
  objectives; the curriculum release; permitted delivery modes; the effective window; school
  scope; who authorized it; and the evidence disposition on revocation.

Hashing uses domain-separated SHA-256 over the curriculum canonical JSON. **The item hash includes
the scoring spec hash**, so editing a key, tolerance or rubric changes the item hash and makes every
earlier approval stale. Attestations are never hashed into the content they attest to.
Validation recomputes every hash. It also rejects protected field names (`correct`, `answerKey`,
`explanation`, …) anywhere in the stimulus or hints, which stops keys being smuggled into options.

## 4. Review and release state machine (`lifecycle.ts`, `release.ts`)

| State | Entered when |
| --- | --- |
| CANDIDATE | content exists, integrity validation fails or has not run |
| VALIDATED | validation passes; no review on the current hash |
| IN_REVIEW | any review/recommendation exists on the current hash, approvals insufficient |
| APPROVED | `minApprovals` distinct authorized humans approved the **current hash** with all checks PASS |
| REJECTED | latest authorized human decision on the current hash is REJECT |
| RETIRED | withdrawn (terminal) |

Status is **derived by replaying attestations**; a stored status string is never trusted.
Rules: AI reviews never count; authors cannot approve or release their own content; only
`ASSESSMENT_REVIEWER`/`CURRICULUM_LEAD`/`PLATFORM_ADMIN` approve; SUMMATIVE and EXAMINATION need
two distinct approvers by default; reviews recorded against a different hash are refused.

Release (`authorizeRelease`) requires the definition, form and every item APPROVED at the exact hash;
a `CURRICULUM_LEAD` or `PLATFORM_ADMIN` who is not an author; national (school-less) releases require
`PLATFORM_ADMIN`. Revocation needs the same authority and a reason, and states whether evidence is
`INVALIDATE`d or `RETAIN_AS_UNOFFICIAL` — evidence is relabelled, never deleted.

Delivery (`resolveDelivery`) is deny-by-default. Unreleased content is reachable **only** as
`REVIEWER_PREVIEW` by reviewer roles, labelled `REVIEWER_PREVIEW_UNRELEASED`, `official: false`. A
release is refused when its hash was altered, it is revoked, outside its window, the mode is not
permitted, the school differs, or the lesson's expected curriculum release differs (stale assessment
after a curriculum update). Only `OFFICIAL` on a valid release yields `official: true`.

## 5. Learner-safe projection (`projection.ts`)

Allow-list only: a new protected field can never leak by default. Ordering elements and matching
columns are shown in a per-attempt hash order (authored order is often the key). Hint text is not
projected (only a count; serving a hint is recorded as assistance). Disclosure of explanation and
correct answer goes through `learnerDisclosure` and the item's `FeedbackReleasePolicy` only.
Offline packages contain the pre-response projection only and require `CAPTURE_ONLY`; scoring happens
on the server after sync. `assertLearnerSafe` scans payloads for protected field names and for
distinctive protected strings (explanations, rubric descriptors, accepted answers, moderation notes).

## 6. Item types (`itemTypes.ts`, `scoring.ts`)

| Type | Response | Scoring authority | Partial credit | Evidence quality | Offline | Human moderation | V2 status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| SINGLE_SELECT | option id | server key | none | objective keyed | capture → server | no | **implemented** |
| MULTI_SELECT | option ids | server key | none or per-option net | objective keyed | capture → server | no | **implemented** |
| NUMERIC | value + unit | server key | wrong-unit credit | objective keyed | capture → server | no | **implemented** (tolerance, units, ambiguous locale numbers rejected) |
| ORDERING | ordered ids | server key | adjacent pairs | objective keyed | capture → server | no | **implemented** |
| MATCHING | pairs | server key | per pair | objective keyed | capture → server | no | **implemented** |
| SHORT_CONSTRUCTED | text | server only for `EXACT_NORMALIZED` keys; otherwise human | rubric | objective keyed | capture → server | only for non-matches | **implemented**; non-matching answers go to `PENDING_HUMAN_MODERATION`, never 0 |
| EXTENDED_WRITING | text | human moderator | rubric | rubric moderated | capture → human | yes | contract + moderation path |
| WORKED_SOLUTION | text/photo | human moderator | rubric | rubric moderated | capture → human | yes | contract + moderation path |
| PERFORMANCE_TASK | artifact refs | human moderator | rubric | rubric moderated | capture → human | yes | contract + moderation path |

An LLM is never a scoring authority. `AiScoringSuggestion` has no points field and is typed
`AI_SUGGESTION_NON_AUTHORITATIVE`. Only `recordModeratedScore` can turn a pending outcome into a score,
and it requires a human moderator in a permitted role, the attempt's school, a versioned
`ModerationPolicy`, and valid rubric levels. Whether an AI suggestion was consulted is recorded.

## 7. Evidence envelope (`evidence.ts`)

`assessment-evidence/1.0.0`: scope (tenant, school, student, user, enrollment, class); exact pins
(definition, form, item, scoring spec, release, curriculum); attempt/session/response sequence;
objectives; response **reference** (id + digest, not the body); delivery context (mode, official,
purpose, item context, runtime, accommodations, allowed tools); assistance exposure; independence;
capture provenance (online/offline, device, client event, device sequence, sync batch); scoring record
(status, scorer authority, points, scoring version, spec hash, moderation); admission record;
recorder; evidence hash.

| Tier | Produced only by | Meaning |
| --- | --- | --- |
| RAW_OBSERVATION | `acceptClientObservation` | learner answered; identity from the server session; client scores/tiers/independence rejected |
| PROVISIONAL_FEEDBACK | `createProvisionalFeedback` | non-authoritative check (client or AI); cannot be promoted |
| VERIFIED_ASSESSMENT_EVIDENCE | `verifyObservation` | SCORED outcome by server key or human moderator, under a valid, unrevoked release whose item/spec/form hashes match |
| MASTERY_ADMITTED_EVIDENCE | `admitToMastery` | verified + INDEPENDENT + admissible purpose + (by policy) official + objective governed by a versioned admission policy |

Independence: any hint, AI tutor use, explanation or answer seen before responding, prohibited tool
or peer collaboration makes evidence `ASSISTED`. Accommodations are recorded separately and do not.
Assisted evidence may be verified (it is a true record) but is never admitted.

The ledger (`appendEvidence`) is append-only: exact replays are no-ops, a different payload under the
same idempotency key is a conflict, tampered hashes are rejected, and derived envelopes must reference
a parent of the right tier already in the ledger without altering inherited scope, pins, assistance,
capture or (for admission) scoring. Offline replay orders by device sequence (`orderForReplay`) and
reports conflicting responses instead of last-write-wins. `effectiveStanding` applies revocations.

## 8. Retention, transfer and blueprints (`retention.ts`)

- No universal timetable. `RetentionSchedulePolicy` is versioned and scoped to grade and subject.
  `PROPOSED_RETENTION_POLICY` (7 and 21 days) is labelled `PROPOSED` and plans nothing until an
  approved policy exists for that grade and subject.
- `planRetentionOpportunities` returns `EvidenceOpportunity` records with `isEvidence: false`.
- `classifyRetentionEvidence` counts a response only when it is verified, independent, delivered
  as `RETENTION`, on a matching objective, and made at least `minimumDelayDays` after instruction.
- `classifyTransferEvidence` requires a verified, independent response to an item in a `NEW`
  context.
- `blueprintGaps` checks a lesson against the Curriculum Excellence Standard. It looks for a
  diagnostic per prerequisite, an independent end-of-lesson check per objective, a delayed
  retention check with a resolved policy, a transfer item in a NEW context, a higher-order item
  (ANALYZE and above), an original product where the outcomes call for one, and remediation for
  every mapped misconception. It reports gaps only and never certifies a lesson.

## 9. Downstream consumers (`consumers.ts`)

`ASSESSMENT_V2_DOWNSTREAM_WRITES_ENABLED = false`, and a test pins it.

- **SLM**: `evidenceForStudentLearningModel` passes admitted, unrevoked evidence only.
  `toGovernedLearningEvidence` maps it to the existing contract, and the result passes
  `validateGovernedEvidence`.
- **Learning Orchestrator**: `signalsForOrchestrator` may use raw and diagnostic observations for
  recommendations. Every signal carries `masteryClaim: false`.
- **Gradebook**: `gradebookEligibility` requires an approved grading policy for the evidence's
  school, verified or admitted evidence, official delivery, an unrevoked release, and a server or
  human scorer. A missing policy makes evidence ineligible; nothing defaults.
- **Missing evidence**: `summarizeObjectiveEvidence` returns `NO_EVIDENCE` or `ONLY_UNVERIFIED`,
  never zero.
- **Report cards and promotion** consume finalized academic records (Academic Records &
  Promotion V2), not assessment evidence directly. Academic grades and skill mastery stay separate
  fields.

## 10. Proposed persistence (not applied)

No migration is needed for this foundation. When the player is built, an **additive** design (to be
drafted with a runbook under `docs/ops/` and reviewed per `ADVISOR_ESCALATION_CONTRACT.md`) would
add: `AssessmentItemVersion` (content JSON + hash), `AssessmentScoringSpec` (server-only, separate
table/permissions), `AssessmentFormVersion`, `AssessmentReviewAttestation`, `AssessmentReleaseRecord`
+ revocation, and `AssessmentEvidenceEntry` (append-only, unique `idempotencyKey`, tier column,
`derivedFromEvidenceId` FK). Existing `Exam*`, `AssessmentAttempt*`, `Submission` rows survive and are
referenced, not migrated in place.

## 11. Assessment Player V2 — staged plan

1. **Read-only preview** — reviewer `REVIEWER_PREVIEW` of candidate forms using `projectFormForLearner`;
   G7 v0.3.0 candidates loaded through `adaptG7CandidateTasks`. No learner access.
2. **Persistence + review UI** — additive tables (§10) behind a flag; record reviews/releases with audit.
3. **Practice delivery** — `PRACTICE_UNOFFICIAL` for released objective types; gateway writes
   RAW/VERIFIED envelopes; hint and tutor exposure captured by the player.
4. **Moderation queue** — teachers score `PENDING_HUMAN_MODERATION` responses; AI suggestions shown
   as drafts only.
5. **Admission** — approved admission policy per grade/subject connects admitted evidence to the SLM
   through `toGovernedLearningEvidence` → `toCanonicalMasteryEvidence` (separately authorized).
6. **Official delivery + gradebook** — after a school grading policy is approved and Academic Records
   V2 is wired. Offline `CAPTURE_ONLY` packages.
7. **Retention scheduling** — after a per-grade/subject retention policy is approved.

## 12. Tested and not yet implemented

Tested (`__tests__/assessment-v2`, 58 tests, including two route-level tests for the legacy exam leak). The tests cover:

- hash mismatch and tampering;
- a stale approval after an edit, including an edit to the key alone;
- protected fields smuggled into a stimulus;
- AI approval refused, author self-approval refused, roles enforced, and dual approval for exams;
- candidate content never delivered to learners;
- delivery denied for a revoked, expired or not-yet-effective release, the wrong school, the wrong
  mode, the wrong curriculum version, or an altered release hash;
- key leakage through learner and offline projections, and leakage detection itself;
- the disclosure policy;
- scoring of every implemented type, including partial credit, tolerance, units and ambiguous
  numbers;
- ambiguous constructed responses held for moderation instead of scored zero;
- AI scoring refused, and moderation requiring a policy, a permitted role and the right school;
- client-forged scores, tiers and mastery;
- student and school ID substitution, and attempts owned by another student;
- independence classification;
- unreleased or revoked evidence refused for verification;
- duplicate and replayed events, and idempotency conflicts;
- forged admitted evidence, inflated points and a raw observation relabelled as verified;
- offline reordering and conflicts;
- relabelling of evidence after a revocation;
- the SLM, orchestrator and gradebook boundaries, including a missing or unapproved grading policy;
- missing evidence never counted as zero;
- the retention proposal not auto-applying, delivery alone not counting as retention, and the
  transfer and blueprint rules;
- the G7, legacy-exam and ContentBundle adapters.

The existing exam suites still pass.

Not implemented: persistence, API routes for V2, the player UI, a moderation queue, randomization
policy execution (forms can declare it; the projection orders by hash), second-marker workflow
enforcement (recorded only), an admission policy registry, and activation of any downstream write.

Open decisions for owners:

- whether `releaseStaleAIGrades` (an AI score becoming the official score after 72 hours) is
  retired or kept as unofficial feedback only;
- school-exam `gradeAttempt` ignores `points` and treats unanswered questions as wrong. Weighting
  and missing-answer policy need an owner;
- review quorum per purpose (default 1, or 2 for summative and examination);
- retention intervals per grade and subject;
- the admission policy per grade and subject.

---

## 13. LL-AEP-001 review and repair (PR #193)

LiberiaLearn is the primary academic authority. MOE and WAEC requirements are compatibility and
examination-coverage inputs, not the limit of difficulty. `lib/academic-policy/llAep001.ts` is
byte-identical in PR #194.

| Severity | Defect | Repair |
| --- | --- | --- |
| P0 | The legacy exam client submitted every blank as option 0 (`answer < 0 ? 0 : answer`), so a timed auto-submit could earn credit for unanswered questions. | Blanks are sent as `-1` and scored BLANK. |
| P1 | `gradeAttempt` ignored approved `points` (score was correct answers / number of questions). | Score is earned points / total approved points. |
| P1 | Answers were matched to questions by array position only, and out-of-range indexes counted as wrong. | The client echoes `questionIds` and the server returns 409 if the order differs. Invalid indexes are refused (400), distinct from blanks. |
| P1 | High-stakes second marking was recorded but never enforced. | `recordSecondMark` requires an independent marker and agreement within tolerance (10% of the item maximum); otherwise `reconcileMarks` requires an independent EXAMINER. SUMMATIVE and EXAMINATION purposes always require second marking. `verifyObservation` refuses SINGLE-marked high-stakes scores and forged "not required" flags. |
| P1 | There was no independent-assessment rule for the AI Tutor or hints. | `tutorAccessFor` returns BLOCKED for OFFICIAL deliveries and independent purposes. Projections offer no hints, and explanations are deferred until the attempt closes. Tutor or hint use is recorded in `integrityFlags`, and those responses are kept out of the gradebook. |
| P1 | Blank and invalid responses were conflated, and attempts had no total. | There is an explicit `BLANK` outcome: 0 points, server-keyed, verifiable. `scoreAttemptForm` uses the form's approved points; after submission an unanswered item counts as 0, and any invalid response blocks the total. |
| P2 | The evidence gateway accepted responses after submission and capture times in the future. | Responses arriving after submission are refused unless they were captured before it (the offline queue). Capture times more than 5 minutes ahead of server receipt are refused. |
| P2 | Assessment difficulty was not designed by grade. | `excellence.ts` sets a blueprint of 20/35/30/15 for Grades 4–12, with a separate Grades 1–3 variant. It is enforced at release for SUMMATIVE and EXAMINATION forms; a deviation needs an exception documented by a non-author. Analysis and transfer items are mandatory for Grades 4–12 summative forms. |
| P2 | Authentic-work rubrics were unconstrained. | EXTENDED_WRITING and PERFORMANCE_TASK rubrics must cover REASONING, EVIDENCE, ACCURACY, ORIGINALITY, COMMUNICATION and REFLECTION before release. |
| P2 | Retention intervals existed only as a proposal. | `LL_RETENTION_PILOT_POLICY` is an APPROVED 7/21-day institutional default with documented exceptions. It only plans opportunities, and a scheduled check is never evidence. |

Nothing here activates official delivery, releases content, writes mastery or migrates data.
