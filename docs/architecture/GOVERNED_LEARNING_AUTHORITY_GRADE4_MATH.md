# Governed Learning Authority: Grade 4 Mathematics Slice

## Authority rule

LLMs and clients may recommend or report observations. Only server-governed,
versioned policy may admit educational evidence. Administrative grade remains
under human enrollment, promotion, and placement-review authority.

## P0 containment

| Surface | Containment |
|---|---|
| Student placement | Persists a diagnostic recommendation but never writes `Student.currentGrade`. The existing tenant-checked teacher review and academic promotion paths remain the authorized administrative writers. |
| Adaptive practice | The generated answer key is encrypted in an HttpOnly, learner-bound server session. The learner projection omits correct answers. Legacy `correctAnswers` request data is ignored. The route returns a server-scored `PROVISIONAL_UNBOUND` result and does not write assessment attempts, performance events, mastery, derived progress, or misconception state. |
| Essay grading | AI score, rubric analysis, and feedback remain advisory. The route no longer calls `recordAnswer` or another mastery writer. |
| Lab completion | Client score is bounded and stored only as a provisional observation. Completion never sets `masteryUpdated` or calls the mastery service. |
| Problem answer release | Default is deny. Release requires student role, matching school, enrollment, and an explicit `AFTER_COMPLETION` or `AFTER_TIME` server-held problem-set policy. |
| Offline synchronization | New devices use `learning_observation.append`. The legacy `mastery_event.append` operation is retained only as a rejected compatibility shape. Raw observations are logged as telemetry with `evidenceAdmission: NOT_AUTOMATIC`. |

## P1 governed slice

`lib/learning-authority/governedGrade4Math.ts` is the executable bounded
release. It pins release `lr-moe-g4-math-fractions-2026.1` to the existing MOE
standard `LR-MATH-G4_6-02` and existing skill
`placement-skill-MATH-G4_6`. It does not create a second Skill authority.

`/api/student/learning-authority/grade4-math` is the live server boundary. Its
GET response issues one sealed, tenant-bound diagnostic session and projects
one exact released item without its answer key. The server derives Initial or
Continuous kind and fixes a bounded attempt identity. POST rejects client
scoring, policy-context, accommodation, idempotency, or session-authority
claims; scores the sealed item on the server; applies exact binding, evidence,
and tool policy; and records a tenant-bound admission audit. The LearningEvent
remains an audit envelope and explicitly declares that it is not canonical
evidence.

The release contains three revisioned concepts in an acyclic prerequisite
sequence, three exact item bindings, three evidence policies, and four tool
policies. Only `PUBLISHED` plus `APPROVED` releases with Liberia MOE provenance
execute. Static keyword inference from `conceptGraph.ts` is not consulted.

Evidence admission distinguishes `ACCEPTED`, `PROVISIONAL`, and `REJECTED`.
It fails closed on tenant or Student/User mismatch, missing binding, invalid
item version, absent server scoring, missing human authority, prohibited tool
use, and client mastery claims. Hints and AI assistance are provisional.
Duplicate observation keys are idempotent.

Diagnostic results support `INITIAL` and `CONTINUOUS` kinds, include confidence
and uncertainty, and permanently expose `mayChangeAdministrativeGrade: false`.

## Legacy compatibility

This mission does not delete legacy mastery tables. Affected unsafe writers
remain stopped and existing mastery readers continue to serve historical
compatibility data. The evidence admission result still sets
`legacyMasteryProjectionAllowed: false`, so admission itself never performs a
dual write.

Student Learning Model V1 now supplies the single canonical writer for this
governed slice in `lib/learning-state/masteryWriter.ts`. It persists only the
reserved versioned canonical event and derives state by deterministic replay.
Legacy stores are excluded from replay inputs. The optional compatibility
projection in `studentLearningModel.ts` is one-way and read-only; it does not
write legacy tables. See `STUDENT_LEARNING_MODEL_V1.md` for reducer,
retention, misconception, calibration, and DecisionModel contracts.

Current compatibility writers remain in `lib/mastery/masteryService.ts`,
`lib/adaptive/updateMastery.ts`, scheduled lesson completion, WAEC practice,
lesson quiz submit, code grading, and AI-literacy grading. Their existing
readers remain unchanged. The affected placement, adaptive submission, essay,
lab, offline observation, and governed Grade 4 Math routes do not call those
writers. In particular, no completed adaptive AssessmentAttempt or performance
event is emitted for an unbound generated practice set, because outcome and
decision-support readers treat those records as consequential inputs.

## Privacy and operations

The bounded authority uses minimum necessary identifiers and never copies tutor
conversation into evidence. Tenant, authenticated User, and Student identities
must agree. Raw LearningEvent telemetry is not accepted evidence. Only the
reserved canonical event written after governed admission is replayed. No production
or staging mutation, live migration, deployment, or Vercel certification is
part of this mission.

## Hostile proof matrix

| # | Hostile claim | Proof boundary |
|---:|---|---|
| 1 | Submitted estimated grade changes official grade | Placement route test proves no Student update. |
| 2 | Placement crosses tenant | Placement lookup binds User and school. |
| 3 | Student ID is confused with User ID | Placement, admission, answer release, and sync tests use both identities explicitly. |
| 4 | Client answer key forces correctness | Adaptive tests prove legacy `correctAnswers` is ignored. |
| 5 | Client score forces mastery | Governed route rejects client score and mastery fields. |
| 6 | Forged lab score creates mastery | Online and offline lab tests require provisional state and `masteryUpdated: false`. |
| 7 | AI essay score writes mastery | Essay tests prove the mastery writer is never called. |
| 8 | Known answer route reveals unreleased answer | Answer-release route test proves default deny. |
| 9 | Released answer ignores policy | Completion and time policies are tested. |
| 10 | Client enables prohibited calculator | The server-issued session offers no calculator and rejects client policy-context claims. |
| 11 | Student grants accommodation override | Admission tests accept only Teacher or Admin authority. |
| 12 | Unpublished ontology executes | Release validation rejects Draft and In Review states. |
| 13 | Cyclic prerequisites execute | Cycle validation test rejects the release. |
| 14 | Published release mutates | Runtime release and nested objects are frozen. |
| 15 | Heuristic mapping becomes canonical | Executable route uses exact release bindings only. |
| 16 | Unbound item produces accepted evidence | Admission rejects missing binding. |
| 17 | Stale item version is accepted | Unit and live route tests reject invalid versions. |
| 18 | Duplicate observation admits twice | Admission ledger and server-derived live event identity are idempotent. |
| 19 | Offline replay admits twice | Sync replay test uses the exact raw-observation event type. |
| 20 | Offline device asserts mastery | Protocol and route reject legacy mastery operations and mastery claims. |
| 21 | Cross-tenant evidence is accepted | Live and offline routes bind authenticated school and learner. |
| 22 | LearningEvent becomes evidence automatically | Event metadata states `learningEventIsCanonicalEvidence: false` or `NOT_AUTOMATIC`. |
| 23 | Machine event impersonates teacher observation | Teacher evidence requires a human Teacher or Admin actor. |
| 24 | Diagnostic changes administrative grade | Live session result and placement route both expose false authority flags. |
| 25 | LLM-only affected write remains | Essay mastery writes and adaptive decision-state writes are absent and tested. |
