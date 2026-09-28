# LiberiaLearn New North-Star Architecture Audit

## Audit basis

- Repository snapshot: `3c653519d2a19e316a70632d1c7010e8b2db9a35`
- Live branch observed: `feat/manager-loop-orchestration`
- Method: immutable snapshot, excluding the other Codex's uncommitted `.recovery/` work
- Scope: schema, migrations, services, routes, workers, UI, offline runtime, tests, and canonical execution documents
- No implementation, migrations, commits, production changes, or staging changes were performed
- Roadmap claims were treated as claims until supported by implementation evidence
- The current execution document contains conflicting historical resume targets. That documentation issue does not change this audit's findings

Independent verification: the P7-A, P7-B, and P7-C focused suites passed at the pinned tree: 3 test files, 29 tests.

---

## A. Executive assessment

LiberiaLearn does not need a rewrite.

It already has a substantial national LMS and AI-enabled delivery platform:

- governed curriculum provenance and review
- student, teacher, guardian, and MOE surfaces
- assessments, gradebook, tutoring, practice, homework, exams, and labs
- an append-oriented learning-event envelope
- several mastery and adaptive systems
- misconception and intervention records
- a strong offline synchronization foundation
- AI routing, moderation, cost accounting, audit, and quality operations
- school, district, and national reporting

The missing core is not another feature surface. It is a singular, governed chain of authority:

`curriculum ontology -> admissible evidence -> learner state -> learning decision`

A rough capability-weighted assessment is:

- Foundational architecture exists: approximately 40 to 45 percent
- Functional but partial or conflicting: approximately 35 to 40 percent
- Missing: approximately 20 to 25 percent

That understates the remaining risk. The missing 20 to 25 percent contains the highest-leverage authority boundaries. By readiness to operate the complete north-star loop safely, LiberiaLearn is closer to one-third complete.

The most important uncomfortable findings are:

1. A student placement route currently writes a submitted `estimatedGrade` directly to `Student.currentGrade` before teacher review: `app/api/student/placement/route.ts:18-64`.
2. An AI essay grade described as advisory can update persistent adaptive mastery: `lib/grading/gradeEssay.ts:7-11`, `app/api/grading/essay/route.ts:125-137`.
3. The adaptive submission endpoint accepts client-supplied correct answers and then writes mastery: `app/api/student/adaptive/submit/route.ts:138-211`.
4. Lab completion accepts a client-supplied score and directly updates mastery: `app/api/student/labs/sessions/[sessionId]/route.ts:48-91`.
5. Student-accessible textbook/problem routes can expose answer material without a sufficiently explicit release authority: `lib/ai/textbook/textbookPdf.tsx:162`, `app/api/student/work/[scheduledWorkId]/problem-answer/[problemSetId]/route.ts:46`.
6. There are several incompatible mastery authorities, not one learner model.
7. `LearningEvent` is useful telemetry infrastructure, but cannot safely be called educational evidence. Many critical fields are nullable, status defaults to accepted, dedupe is not database-unique, and logging can fail open by returning `null`: `prisma/schema.prisma:1621-1671`, `lib/events/logLearningEvent.ts:69`.

The constitutional rule is therefore followed in several governance and teacher-review surfaces, but it is not consistently enforced at write boundaries.

---

## B. Current-state architecture

### Real repository implementation

These are implemented, although this audit does not claim every component is deployed or nationally production-certified.

| System | Evidence | Assessment |
|---|---|---|
| Governed curriculum authority | `prisma/schema.prisma:2418-2925`, `lib/curriculum/mutations/*`, `lib/curriculum/provenance/*`, `lib/curriculum/review/*` | Strongest existing authority. Preserve. |
| Standards and skills | `prisma/schema.prisma:652-674` | Real but older, unversioned taxonomy. |
| Curriculum targets and MOE alignment | `prisma/schema.prisma:2635-2925` | Real governed structures with provenance, versions, confidence, and review state. |
| Student runtime | `app/student/*`, including lessons, adaptive practice, exams, homework, tutor, and labs | Broad and reusable, but fragmented. |
| Teacher intelligence | `app/teacher/intelligence/*`, `lib/intelligence/*`, `lib/reporting/teacherWeeklyReport.ts` | Real alerts and interventions, not yet driven by one learner-state authority. |
| Guardian experience | `app/guardian/*`, `app/api/guardian/*`, `lib/notifications/guardianDigest.ts` | Real. Diagnostic disclosure policy is missing. |
| Offline and PWA | `public/sw.js`, `lib/offline/syncProtocol.ts`, `app/api/student/sync/route.ts`, `lib/content-availability-manifest.ts` | Strong foundation with signed content, idempotency, conflicts, and queues. |
| Tutor and teaching runtime | `lib/ai/tutor/studentTutor.ts`, `lib/teaching/runtime.ts`, `lib/agents/agents/teaching-runtime.agent.ts` | Real governed invocation, but not the learning orchestrator. |
| Student toolkit | `lib/toolkit/toolRegistry.ts`, `components/toolkit/*` | Real, with twelve tool components and coarse context routing. |
| Deterministic lab runtime | `lib/labs/types.ts`, `lib/labs/registry.ts`, `lib/labs/runtime/*` | Strong reusable execution kernel. |
| Textbook compiler | `lib/ai/textbook/textbookCompiler.ts`, `lib/ai/textbook/textbookPdf.tsx`, `lib/textbooks/textbookGenerationQueue.ts` | Functional compiler, queue, and PDF generation. |
| Measurement, experiments, quality | `lib/measurement/governedMeasurement.ts`, `lib/experiments/controlledExperiment.ts`, `lib/quality/*` | Real library/runtime foundations; production operating gates remain incomplete. |
| AI provenance and cost | `AIInteraction`, `AgentInvocation`, cost/moderation modules | Strong reusable non-educational execution infrastructure. |
| School/district/national reporting | `lib/reporting/dashboard/*`, `app/api/admin/national/*`, `app/moe/*` | Real aggregation over current data, but concept intelligence is not yet trustworthy. |

### Functional but incomplete

- Placement and teacher review exist, but placement currently crosses the administrative-grade boundary.
- Diagnostics are approximated through placement, baseline mastery, and adaptive attempts, but initial and continuous diagnostic authorities are not separated.
- `StudentMasteryProfile` has baseline confidence, decay, sustainability, and AI reliance fields, but is strand-level and competes with other mastery systems.
- `MasteryRecord` is skill-linked but too small to represent the proposed learner model.
- `AdaptiveMasteryRecord` uses unit-like string keys, EMA scoring, and sticky mastery.
- `MasterySnapshot` and `DerivedStudentProgress` add further projections.
- Misconception categories, tags, interventions, chains, recommendations, and teacher notes exist, but confirmation/rejection/reassessment is not a complete governed lifecycle.
- Assessment attempts store response, evaluation, score, rubric score, AI assistance, and source references, but lack first-class construct and evidence-policy bindings.
- Labs store observations, conclusions, score, AI analysis, and teacher feedback, but not rich action-level learning evidence.
- Tool usage telemetry exists, but no server-enforced per-item tool policy exists.
- Textbooks compile from curriculum content, but lack section-level ontology bindings and complete edition/version authority.
- Retention is partially modeled as historical score stability or observed decline. It is not yet a calibrated forgetting/reassessment model.
- P7 "retention" is learner return behavior, not retained concept knowledge. These constructs must remain separately named.

### Scaffolded

- `lib/curriculum/conceptGraph.ts` defines static concepts and prerequisite relationships, but uses keyword inference and is not governed persisted ontology.
- `LessonPrerequisite` is lesson-to-lesson routing, not concept-level curriculum authority.
- `CurriculumLearningTarget.prerequisiteRefs` and `misconceptionRefs` are JSON.
- `LearningPathQueue`, `StuckEvent`, and `LessonVariant` provide adaptive mechanics but not a canonical orchestrator.
- `lib/schemas/labSimulation.ts` contains pseudo, 2D, and 3D definitions, but multiple competing lab contracts remain.
- `lib/student/learningIntelligence.ts` presents "concept" intelligence, but can derive concept labels from metadata or fall back to subject-level buckets. It is a view, not a concept-state authority.
- Exam tool policy exists in limited JSON form, but is not the universal runtime authority.

### Planned only or operationally incomplete

- Learner Experience V2 is approved in the backlog but not complete.
- Production reviewer roster, sampled traffic, release integration, monitoring, on-call, and incident-drill parts of P7 remain external.
- Production offline signing-key rotation has not been performed.
- Retention/legal enforcement, guardian erasure, accommodation coverage, low-end Android proof, and national rollup scale remain open.
- National load gates NR-4 and NR-5 have not been established as passed.
- A durable child-specific experimentation governance authority is not evident.

### Missing

- A published, singular curriculum ontology release
- A canonical concept entity and governed concept prerequisite graph
- A narrow educational-evidence ledger
- Evidence-strength policy
- One canonical concept-level student learning model
- One mastery writer with reproducible update records
- Strict initial versus continuous diagnostic separation
- Auditable recommendation, policy resolution, and effective-decision records
- Server-enforced item-level tool policy
- Offline learner-model projection protocol
- Full assessment/lab/tutor evidence binding
- One converged lab definition/runtime contract
- Purpose-limited learner-intelligence privacy policy
- A complete first-month confidence ramp
- End-to-end tests for the full educational intelligence loop

---

## C. Vision gap matrix

| Capability | Exists | Partial | Missing | Current implementation | Reusable? | Principal gap | Priority |
|---|---:|---:|---:|---|---|---|---|
| Curriculum ontology | Yes | Yes | Yes | Standard, Skill, targets, MOE objectives, static concept graph | Yes | No singular published ontology or governed concepts/edges | P0/P1 |
| Enrollment and placement | Yes | Yes | No | Enrollment, AcademicEnrollment, PlacementTest | Yes | Placement can mutate current grade before review | P0 |
| Initial diagnostic | Limited | Yes | Yes | Placement and baseline fields | Partial | No diagnostic session authority or provisional model lifecycle | P1 |
| First-month confidence ramp | Limited | Yes | Yes | Day-one content, adaptive practice, confidence fragments | Partial | No explicit Day 0 to Week 4 policy or uncertainty ramp | P1/P2 |
| Student learning model | Yes | Yes | Yes | Four-plus competing mastery/progress projections | Partial | No canonical concept state or revision authority | P2 |
| Learning event/evidence platform | Yes | Yes | Yes | LearningEvent, AssessmentAttempt, performance events | Strong base | Raw telemetry and admissible evidence are conflated | P0/P1 |
| Evidence validity | Limited | Yes | Yes | AI-assisted flags, rubric data, metadata | Partial | No governed evidence strength, independence, tool, or hint policy | P0/P1 |
| Assessment concept binding | Limited | Yes | Yes | PracticeItem links Skill; other bindings indirect/JSON | Yes | Every item does not know exactly what it measures | P1 |
| Mastery engine | Yes | Yes | Yes | Strand reducer, skill record, adaptive EMA | Partial | Multiple writers and incompatible semantics | P0/P2 |
| Knowledge retention | Yes | Yes | Yes | Decay and sustainability calculations | Yes | No proactive reassessment or calibrated forgetting model | P3 |
| Misconception intelligence | Yes | Yes | Yes | Categories, tags, confidence, interventions | Strong base | No complete hypothesis-confirm/reject-reassess lifecycle | P3 |
| Learning orchestrator | Limited | Yes | Yes | Adaptive queue, stuck routing, tutor routing | Partial | No auditable next-learning authority | P4 |
| Specialized capabilities | Yes | Yes | No | Tutor, assessment, practice, curriculum, teacher AI | Yes | Not normalized behind one decision authority | P6 |
| Learner Experience V2 | Yes | Yes | Yes | Broad student shell and activities | Yes | Fragmented state and no orchestrator contract | P5 |
| Student toolkit | Yes | Yes | No | Twelve registered tools | Yes | Policy is coarse and assessment validity is unsafe | P0/P1 |
| Textbooks/content compiler | Yes | Yes | No | Compiler, worker, PDF, student surface | Yes | Weak ontology binding, editions, release and answer-key policy | P5/P6 |
| Instructional experience graph | Limited | Yes | Yes | Curriculum payload strategies and concept graph | Partial | No governed graph joining concepts to experiences/evidence | P5 |
| Labs and simulations | Yes | Yes | No | Typed runtime plus several competing schemas | Yes | Four contracts, coarse evidence, no real 3D runtime proof | P5/P7 |
| Tool/assessment validity | Limited | Yes | Yes | Toolkit contexts and exam policy JSON | Partial | No server-held per-item policy; answer/tool leakage | P0 |
| Teacher intelligence | Yes | Yes | No | Alerts, intervention engine, weekly reports | Yes | Not based on canonical learner revision; review-volume risk | P8 |
| Teacher-authored content | Yes | Yes | No | Generated/edited lessons, versions, shares, assignments | Yes | Stable ontology bindings and national-authority boundary | P5 |
| Guardian experience | Yes | Yes | No | Dashboards, messages, digest, report cards | Yes | Diagnostic minimization and disclosure rules | P8 |
| Educational memory | Yes | Yes | Yes | Tutor conversations, RAG, analytics, learner views | Partial | Conversation, retrieval, and governed state are not formally isolated | P2 |
| Experiments/learning science | Yes | Yes | Yes | P7-B primitives, P7-C review/rollback | Yes | No child-specific approval, consent basis, or enforced stop authority | P9 |
| School/county/national intelligence | Yes | Yes | Yes | District/national aggregators and dashboards | Yes | No trustworthy concept rollup; County is not first-class | P10 |
| Offline learning intelligence | Yes | Yes | Yes | Signed manifests, IndexedDB, sync/conflict policies | Strong base | Device operation called `mastery_event.append`; no bounded state projection | P0/P2 |
| Version provenance | Yes | Yes | Yes | Strong curriculum and AI provenance; event versions | Yes | Incomplete concept, item, rubric, tool, reducer, and decision lineage | P1/P2 |
| Privacy, child safety, governance | Yes | Yes | Yes | RBAC, tenant guards, audit, consent/export models | Strong base | Purpose separation, learner-profile retention, small-cell protection | P0 onward |
| Platform/business value | Yes | Yes | No | National delivery/governance infrastructure | Yes | Defensible value depends on validated outcomes, not data volume | Ongoing |

---

## D. Reuse analysis

| Classification | Systems |
|---|---|
| **PRESERVE** | P2-A curriculum provenance/governance, MOE authority sources and versions, existing `Skill` and `Standard` identities, `CurriculumContent`, learner/teacher/guardian shells, tenant guards, RBAC, audit logging, `AssessmentAttempt`, signed offline manifests, IndexedDB outbox, deterministic lab validate/apply kernel, AI moderation/cost/provenance, P7 quality primitives |
| **EXTEND** | `AssessmentItem`, `LearningEvent` ingestion, `CurriculumLearningTarget`, misconception category/tag lifecycle, interventions, textbook compiler, toolkit registry, teacher intelligence, lab sessions, offline content projection, curriculum factory |
| **REFACTOR** | Multiple mastery writers, student-learning intelligence aggregations, lesson prerequisite routing, learner runtime activity adapters, analytics consumers, lab schemas, teaching-runtime integration |
| **REPLACE SELECTIVELY** | Client-controlled answer/score authority, direct raw-score-to-mastery routes, client-only tool restrictions, JSON-only consequential curriculum bindings, ungoverned answer-key release |
| **RETIRE AFTER CUTOVER** | Direct writes to legacy mastery tables, `mastery_event.append` from devices, heuristic concept mappings used as authoritative, duplicate lab definition paths, any use of RAG/chat as learner-state truth |

Specific decisions:

- Do not add another `Skill` table.
- Do not add another generic event bus.
- Do not create a parallel misconception or intervention system.
- Do not create a separate textbook curriculum.
- Do not create a fourth simulation contract.
- Do not reuse repository-development workflow agents as educational decision makers.
- Reuse agent cost, moderation, invocation logging, versioning, and tool allowlisting only.

---

## E. Canonical authority map

| Domain | Current source of truth | Recommended future source of truth |
|---|---|---|
| Administrative enrollment/grade | `AcademicEnrollment`, promotion workflow, plus duplicated `Student.currentGrade` | Authorized enrollment/promotion command; `Student.currentGrade` becomes derived compatibility data |
| Curriculum | `CurriculumAuthoritySource`, source version, MOE objective, revision/governance records | Same authority, unchanged |
| Ontology | Split among Standard, Skill, targets, strands, JSON, static graph | Published `CurriculumOntologyRelease` pinning governed revisions and crosswalks |
| Concepts | Static `conceptGraph.ts` metadata | Governed atomic `Concept` revisions inside ontology release |
| Prerequisites | Static graph, JSON target refs, `LessonPrerequisite` | Versioned concept prerequisite edges inside ontology release |
| Assessment definitions | Assessment, AssessmentItem, PracticeItem, exams, assignments | Existing structures with immutable item version and construct/evidence/tool bindings |
| Raw observations | LearningEvent plus activity-specific tables | LearningEvent-compatible ingestion envelope, never mastery evidence by default |
| Accepted evidence | Fragmented and sometimes implicit | One narrow append-only `LearningEvidence` authority |
| Student mastery | Multiple profiles, records, snapshots, and EMA writer | One deterministic concept-state reducer and versioned update ledger |
| Misconceptions | MisconceptionCategory, MisconceptionTag | Same system extended with hypothesis and confirmation lifecycle |
| Diagnostics | Placement and assessment fragments | DiagnosticSession using governed items, with no grade-write permission |
| Orchestration | Adaptive routing, queues, tutor routing | Governed recommendation, policy-resolution, and effective-decision service |
| Textbooks | Compiled CurriculumContent | Approved, versioned representation of the ontology/curriculum release |
| Tool policy | Toolkit contexts, flags, limited exam JSON | Server-enforced versioned ToolPolicy bound to item/activity and signed offline |
| Labs/simulations | Typed lab runtime plus competing schemas | Typed validate/apply kernel plus one governed versioned lab-definition contract |
| Teacher override | Placement review, TeacherAction, intervention workflows | Existing human-action/audit authority extended to learning decisions |
| Experiments | P7-B library primitives | Durable reviewed experiment authority built on P7-B, introduced late |
| Analytics | P7-A and several reporting projections | Approved derived projections only; never a learner-state writer |
| Learning decisions | No complete record | Versioned effective LearningDecision referencing state revision and evidence |

---

## Learning-data and evidence inventory

| Source | Stored today | Construct binding | Current output | Safe for learner-state update? | Offline | Teacher confirmation |
|---|---|---|---|---|---|---|
| Placement | grade estimate, raw score, questions, answers, details, AI analysis | Skill is used in some seeds | Estimate/score | No, current grade mutation is unsafe | Limited | Required before administrative action |
| Initial diagnostic | No distinct authority | None consistently | Placement/baseline fragments | No | No complete lifecycle | Policy dependent |
| Lessons | completion, sessions, exit scores, events | Content/unit/strand, sometimes metadata concepts | Completion/score | Only through governed evidence policy | Yes | Usually no |
| Practice | attempts, score, difficulty, hints | PracticeItem can link Skill | Score/correctness | Potentially, after server validation | Partial/yes | Usually no |
| Classwork/assignments | responses, rubric, grading fields | Standard codes and content, often JSON | Score/grade/free text | Not uniformly | Conflict-review sync | AI grading may require confirmation |
| Homework | responses, generated questions, submissions | Standard codes/content | Score/grade | Lower evidence strength; assistance context required | Conflict-review sync | Often appropriate |
| Quizzes | answers, score, attempt details | Inconsistent item binding | Score | Unsafe where client supplies answer authority | Yes/partial | Not normally |
| Exams | questions, attempts, certification | Exam profile/subject | Controlled score | Yes only with strong tool/identity policy | Limited | Human-controlled release |
| Projects | capstone and portfolio artifacts | Weak/inconsistent | Rubric/grade/artifact | Teacher-confirmed only initially | Limited | Yes |
| Labs | observations, conclusions, client score, AI analysis | Standard codes/content | Score plus JSON | Not from current client score | Yes, mergeable | Rich evidence may require validation |
| Simulations | runtime actions mostly in component state | Lab IDs, weak construct binding | Interaction state | Not yet | Some runtime availability | Depends on evidence type |
| Tutor | conversation, teaching turns, AI interaction provenance | Lesson/subject/strand context | Free text/helpfulness | Recommendation or provisional evidence only | AI unavailable offline | Consequential use requires policy |
| Teacher observation | TeacherAction, notes, misconception/intervention data | Sometimes concept/lesson | Professional judgment | Yes as explicitly labeled evidence | Limited | It is the confirmation |
| Rubrics | JSON across items/submissions | Not versioned consistently | Rubric score | Only when rubric/version/actor are known | Partial | Often |
| Gradebook | percent, letter, reports | Class/term, not concept | Grade | No direct concept mastery inference | Cached views possible | Teacher authority |
| Historical imports | transcript, report card, import batch | Grade/subject/term | Historical record | Context/prior only | Import is online | Administrative verification |
| Attendance | attendance records and events | No learning construct | Context only | Never direct mastery evidence | Supported with conflict policy | Administrative |
| Tool use | telemetry and scheduled-work JSON | Coarse context | Usage events | Interpretation context only | Partial | Accommodation overrides may require approval |

---

## F. Recommended target architecture

Use a modular monolith first. The repository does not yet justify a graph database, per-student agent process, or separate mastery microservice.

### Synchronous learner path

```text
Authenticated learner + tenant + enrollment
                |
      approved activity/item version
                |
 server-held answer/rubric/tool policy
                |
       raw LearningObservation
                |
        Evidence Acceptance
 validate tenant, identity, item, policy,
 tool use, hints, AI assistance, version,
 idempotency, independence, provenance
                |
 accepted / provisional / rejected evidence
                |
 transactional deterministic reducer
 Evidence + MasteryUpdate + state revision + outbox
                |
     governed policy resolution
                |
 recommendation -> authority check -> effective decision
                |
 lesson / practice / diagnostic / tutor / lab
```

Properties:

- No LLM call is required in the critical path.
- LLM output is a proposal, explanation, or provisional evidence input.
- Correct answers, rubrics, scores, and policies remain server-held or signed.
- State updates use optimistic concurrency or per-learner serialization.
- Evidence acceptance, mastery update, learner revision, and outbox insertion commit atomically.
- A duplicate event cannot update state twice.
- Every effective decision references an exact learner-state revision.
- Routine low-risk choices may execute automatically.
- Grade placement, summative grading, accommodations, disciplinary consequences, and major path changes require human authorization.

### Asynchronous path

The outbox feeds:

- teacher summaries and review queues
- knowledge-retention reassessment scheduling
- misconception hypothesis analysis
- intervention-effectiveness calculation
- P7 quality sampling
- controlled experiment exposure/outcome processing
- school, county, and national aggregation
- content-quality feedback
- cost and latency analytics

Heavy AI analysis, graph generation, national aggregation, and experiment statistics do not belong in the synchronous learner path.

### Student Learning Model lifecycle

1. Day 0 loads enrollment, official grade, curriculum assignment, language, accommodations, and verified history.
2. Day 1 serves approved grade-level instruction regardless of model uncertainty.
3. Initial diagnostic creates a provisional concept-state revision.
4. Week 1 combines normal curriculum with bounded micro-diagnostics and targeted prerequisite support.
5. Weeks 2 to 4 improve confidence using independent evidence from multiple contexts.
6. Later revisions add observed retention, response to intervention, misconceptions, and learning velocity.
7. Low confidence never means "nothing to teach."
8. Weak prerequisites may change remediation, not official grade.

### Offline authority

Devices may cache:

- signed curriculum/ontology release subset
- signed activity and item definitions
- tool policies
- accommodations needed for delivery
- expiry-bounded learner projection
- pending raw observations
- last accepted server revision

Devices may not assert canonical mastery or mutate official grade.

Rename `mastery_event.append` to `learning_observation.append`. Local recommendations must be marked provisional/stale and fall back to normal grade-level curriculum when personalization is unavailable.

### Privacy and safety boundaries

Required prohibitions:

- No sale of identifiable or re-identifiable learner data
- No punitive "AI reliance" or behavioral-surveillance scoring
- No raw chat transcript in the canonical learner model
- No national or county learner drill-down
- No small-cell reporting that allows re-identification
- No experimentation on high-stakes grading, placement, safeguarding, or accommodations
- No LLM-only mastery or misconception update
- No indefinite retention of detailed child interaction history
- No cross-enrollment access after a teacher or school relationship ends
- No silent model replay that rewrites historical learner state without versioned migration policy

---

## G. Proposed data-model changes

These are proposals only. No schema or migration was created.

### Reuse or extend existing entities

- `Standard`
- `Skill`
- `CurriculumLearningTarget`
- `MoeCurriculumObjective`
- `AssessmentItem`
- `LearningEvent`
- `AssessmentAttempt`
- `MisconceptionCategory`
- `MisconceptionTag`
- `Intervention`
- `InterventionChain`
- `TeacherAction`
- `CurriculumContent`
- `CurriculumContentRevision`
- `CurriculumVersion`
- `VirtualLab`
- `LabSession`
- `AIInteraction`

### Justified new entities

| Entity | Ownership and relationships |
|---|---|
| `CurriculumOntologyRelease` | Pins exact MOE source, objective, standard, skill, concept, edge, policy, and curriculum revisions; only approved releases are executable |
| `Concept` or `ConceptRevision` | Atomic instructional construct; mapped to existing Skill and CurriculumLearningTarget rather than replacing them |
| `ConceptPrerequisiteEdge` | From/to concept revision, strength, rationale/evidence, status, authority, version; cycle-validated |
| `CurriculumConstructBinding` | Queryable mapping among targets, concepts, skills, standards, content revisions, and role/coverage |
| `AssessmentItemVersion` | Immutable item content, answer/rubric reference, difficulty, activity version, release policy |
| `AssessmentConstructBinding` | Item-to-concept/skill/objective mapping, weight, misconception possibilities, evidence and mastery policies |
| `EvidencePolicy` | Defines admissibility and evidence strength by context, independence, hints, AI/tool use, validation, and confirmation |
| `ToolPolicy` | Defines allowed/prohibited tools, context, item overrides, accommodation and teacher overrides |
| `LearningEvidence` | Narrow append-only ledger referencing raw event/attempt, tenant, learner, item/activity versions, bindings, context, tool/hint/AI use, acceptance outcome, policy version, and unique idempotency key |
| `DiagnosticSession` | Initial or continuous type, target concepts, item sequence, start/end, policy, learner-state revision, and no administrative-grade relation |
| `StudentConceptState` | Current materialized projection keyed by tenant, learner, ontology release, and concept; includes probability, confidence, uncertainty, attempts, practice/mastery dates, retention, gaps, and revision |
| `MasteryUpdate` | Append-only reducer output linking prior/new state revision, evidence IDs, algorithm/policy version, deltas, rationale, and supersession |
| `LearningRecommendation` | Proposed next objective/activity with source revision and rationale |
| `LearningPolicyResolution` | Shows constraints, alternatives, and why a recommendation is or is not executable |
| `LearningDecision` | Effective action, actor/authority class, source revision, evidence, recommendation, policy and model provenance |
| `LearningDecisionOverride` | Only if existing TeacherAction cannot hold reason, scope, expiry, affected decision, and professional-judgment semantics |
| `OutboxEvent` | Only if existing durable workflow/event infrastructure cannot atomically publish state transitions |

### Do not create initially

- A second `Skill`
- A second generic `LearningEvent`
- A parallel `Misconception`
- A parallel `TeacherIntervention`
- A dedicated `SimulationEvidence` table
- A separate `RetentionSignal` authority
- A separate table for every learner-model version
- A graph database
- A new general-purpose event bus

Simulation evidence should be a registered `LearningEvidence` subtype. Retention should initially be a versioned derived measurement in mastery updates. Textbook bindings should use the generic curriculum/content construct mapping.

---

## H. Phased build plan

The repository evidence supports changing the starting hypothesis. P0 containment must precede broad ontology work, and the first four proposed layers should be proven as one narrow vertical slice rather than built nationally in isolation.

### P0 - Constitutional and assessment-validity containment

- Objective: stop unsafe educational writes and document every authority/writer/reader.
- Dependencies: none.
- Reuse: tenant guards, AuditLog, existing grading and placement review.
- New components: authority ADR, source-consumer matrix, evidence-admission seam.
- Proposed schema: minimal policy/version records only if required.
- APIs: harden placement, adaptive submission, lab completion, answer release, essay grading.
- Jobs: none.
- UI: preserve grade; explain provisional placement and teacher review.
- Tests/evals: forged answer, forged score, answer-key denial, LLM non-authority, grade invariance, tenant mismatch.
- Safety: mandatory.
- Offline: rename device mastery claim to raw observation.
- Completion: no client or LLM can directly change administrative grade or canonical mastery.

### P1 - One governed Grade 4 mathematics slice

- Objective: publish one reviewed ontology release and bind a small sequence of diagnostic and instructional items.
- Dependencies: P0.
- Reuse: P2-A governance, Standard, Skill, targets, static concept identifiers.
- New components: ontology release, concepts, prerequisite edges, construct bindings, evidence/tool policy.
- Proposed schema: ontology and binding entities.
- APIs: approved-release read API and admin review API.
- Jobs: mapping validation and cycle detection.
- UI: curriculum reviewer crosswalk screen.
- Tests/evals: no cycles, immutable published release, draft heuristic mappings cannot execute.
- Safety: curriculum human approval.
- Offline: signed ontology/tool-policy subset.
- Completion: every selected item/activity has an approved construct and policy binding.

### P2 - Diagnostic, evidence, and canonical slice cutover

- Objective: run one simulated learner through initial diagnostic, evidence acceptance, concept-state projection, and decision records.
- Dependencies: P1.
- Reuse: LearningEvent ingestion, AssessmentAttempt, offline idempotency.
- New components: LearningEvidence, DiagnosticSession, reducer, state revision, recommendation/resolution/decision.
- Proposed schema: evidence, state, update, and decision entities.
- APIs: diagnostic session, evidence submission, learner-state read, decision read/override.
- Jobs: outbox processing and replay verification.
- UI: provisional confidence and teacher decision view.
- Tests/evals: deterministic replay, concurrency, duplicate/out-of-order sync, override audit.
- Safety: consequential decisions require human actor.
- Offline: raw observations plus stale signed projection.
- Completion: shadow comparison passes, then controlled slice cutover with legacy projections one-way only.

### P3 - Evidence-source expansion

- Objective: route lessons, practice, assignments, homework, quizzes, labs, tutor, and teacher observations through the same evidence authority.
- Dependencies: P2.
- Reuse: activity-specific tables and routes.
- New components: source adapters and evidence schemas.
- Proposed schema: few changes beyond source-version references.
- APIs: shared evidence adapter interface.
- Jobs: validation/reconciliation reports.
- UI: evidence trace viewer for authorized staff.
- Tests/evals: source-specific validity and incomplete-provenance rejection.
- Safety: context-specific evidence strength.
- Offline: adapters preserve event identity and assistance context.
- Completion: no selected source writes canonical state directly.

### P4 - Mastery, retention, and misconception calibration

- Objective: calibrate interpretable mastery, uncertainty, retention, and misconception lifecycle.
- Dependencies: sufficient P2/P3 evidence.
- Reuse: deterministic mastery compute, misconception tags, interventions.
- New components: calibrated reducer versions and confirm/reject/reassess workflow.
- Proposed schema: extend existing misconception status/evidence as needed.
- APIs: teacher validation and reassessment scheduling.
- Jobs: retention scheduling and calibration analysis.
- UI: uncertainty and evidence explanation.
- Tests/evals: calibration, false-positive misconceptions, sparse evidence, decay and recovery.
- Safety: no punitive or deterministic child labeling.
- Offline: reassessments available in signed packs.
- Completion: replayable versioned estimates with documented calibration limits.

### P5 - Minimal learning orchestrator and Learner Experience V2

- Objective: make auditable next-learning decisions and execute them through the existing student shell.
- Dependencies: P2, then P4 enhancements.
- Reuse: lesson player, practice, labs, tutor, toolkit, adaptive queue.
- New components: bounded decision policy and capability adapter.
- Proposed schema: decision policy version if not already covered.
- APIs: next-action and fallback endpoints.
- Jobs: async recommendation enrichment only.
- UI: next objective, reason, confidence, teacher-adjusted path.
- Tests/evals: no-state fallback, provider outage, latency, policy constraints.
- Safety: routine versus consequential classification.
- Offline: normal grade-level fallback always available.
- Completion: no learner is blocked because personalization is uncertain or offline.

### P6 - Curriculum V2, textbooks, and instructional graph

- Objective: bind approved instructional strategies, textbooks, teacher content, and assessment hooks to the same ontology.
- Dependencies: P1/P3.
- Reuse: CurriculumContent, revisions, compiler, generation factory.
- New components: instructional-representation bindings and edition policy.
- Proposed schema: generic content construct bindings, not a second textbook curriculum.
- APIs: approved representation resolution.
- Jobs: compile student, teacher, print, lightweight, and language variants.
- UI: provenance and edition labels.
- Tests/evals: no cross-version mixing, answer-key separation, curriculum drift.
- Safety: teacher content cannot self-promote national authority.
- Offline: signed lightweight editions and version invalidation.
- Completion: every generated representation resolves to the same approved ontology release.

### P7 - Converged labs and simulations

- Objective: adapt all lab definitions to one governed contract and emit rich evidence.
- Dependencies: P3/P6.
- Reuse: `lib/labs` validate/apply kernel and existing lab UI.
- New components: canonical versioned lab definition and action-level evidence adapter.
- Proposed schema: extend VirtualLab/LabSession or add a version entity; no fourth contract.
- APIs: server-validated action and completion endpoints.
- Jobs: optional offline-pack compilation.
- UI: hypothesis, prediction, observations, corrections, conclusions, and transfer.
- Tests/evals: action tampering, deterministic state, evidence reconstruction, low-end device behavior.
- Safety: physical safety notes and age policy remain governed.
- Offline: deterministic runtime and signed definition.
- Completion: client scores cannot become evidence; server derives evidence from validated actions.

### P8 - Specialized capabilities and teacher/guardian intelligence

- Objective: expose tutor, practice, language, assessment, and teacher capabilities through the orchestrator.
- Dependencies: P5.
- Reuse: current tutor/agents, teacher alerts, reports, guardian surfaces.
- New components: specialist input/output contracts and disclosure policy.
- Proposed schema: generally none.
- APIs: capability invocation with decision reference.
- Jobs: teacher summaries and guardian-safe digests.
- UI: prioritized intervention queues and limited guardian summaries.
- Tests/evals: teacher workload, explanation quality, disclosure and override.
- Safety: LLM recommendation-only and guardian minimization.
- Offline: non-AI fallbacks and cached teacher summaries.
- Completion: specialists cannot write learner state or bypass policy.

### P9 - Governed educational experimentation

- Objective: adapt P7-B only after the learning loop is trustworthy.
- Dependencies: P4/P5 and legal review.
- Reuse: deterministic assignment, SRM, quality stop signals, rollback.
- New components: ethics approval, permitted-variable policy, consent/legal basis, enforced kill switch.
- Proposed schema: durable experiment approvals, assignments, exposures, and stop events.
- APIs: reviewed activation and stop.
- Jobs: exposure/outcome processing.
- UI: teacher visibility and opt-out where required.
- Tests/evals: automatic stop enforcement, exclusion of high-stakes outcomes.
- Safety: highest priority.
- Offline: exposure identity is immutable and sync-safe.
- Completion: no child-facing experiment runs without independent approval and enforceable stop conditions.

### P10 - School, county, and national intelligence

- Objective: aggregate validated concept and intervention signals.
- Dependencies: calibrated individual authority.
- Reuse: existing district/national aggregation.
- New components: privacy-preserving aggregate projections.
- Proposed schema: first-class County only if governance and query needs justify it.
- APIs: aggregate-only reporting.
- Jobs: asynchronous rollups.
- UI: bottlenecks, connectivity, intervention effectiveness, and teacher-support needs.
- Tests/evals: small-cell suppression, no learner drill-down, aggregation accuracy.
- Safety: no surveillance or ranking of individual children.
- Offline: school summaries may cache; raw learner data does not propagate upward.
- Completion: aggregation is privacy-safe and reconstructible from approved measures.

### P11 - Advanced personalization and scale optimization

- Objective: improve policy only after sufficient calibrated evidence.
- Dependencies: P4, P9, P10.
- Reuse: learner revisions, evaluations, intervention outcomes.
- New components: only evidence-justified models.
- Proposed schema: model registry/versioning if current AI provenance is insufficient.
- APIs: model-agnostic scoring interface.
- Jobs: offline evaluation and controlled replay.
- UI: unchanged authority and explanation surfaces.
- Tests/evals: bias, calibration drift, subgroup performance, cost, latency.
- Safety: deterministic fallback and human authority.
- Offline: bounded projections and non-model fallback.
- Completion: advanced model measurably improves governed outcomes without reducing safety or explainability.

---

## I. First major milestone

The proposed milestone is sound after tightening its authority boundaries.

Use one synthetic Grade 4 mathematics learner and one small, founder-approved subject sequence. Fractions is a reasonable candidate, but repository content approval must be verified before final selection.

Completion requires:

1. The learner is administratively enrolled and the official grade remains unchanged throughout.
2. Unknown learner state still yields approved grade-level instruction.
3. The initial diagnostic creates provisional concept states with confidence and uncertainty.
4. Diagnostic scoring is server-held.
5. At least three independent evidence sources pass through one gateway: diagnostic item, lesson/practice interaction, and teacher observation, controlled assessment, or validated lab action.
6. Every evidence record has tenant, learner, source, context, construct, activity version, policy version, tool/hint/AI metadata, timestamp, and idempotency identity.
7. Repeated weak performance can trigger a micro-diagnostic and prerequisite support without changing official grade.
8. One misconception hypothesis is explicitly confirmed or rejected.
9. Every state revision is reproducible from accepted evidence.
10. Recommendation, policy resolution, effective decision, actor, and override are separately recorded.
11. Teacher can inspect and override the instructional decision.
12. A provider outage produces approved non-AI instruction.
13. Duplicate, delayed, out-of-order, and conflicting offline observations do not double-count.
14. Stale local state is visibly provisional.
15. Cross-tenant and Student/User identity-confusion tests fail closed.
16. Tool restrictions and accommodations work online and offline.
17. Synthetic evidence is excluded from production P7 metrics and experiments.
18. The complete repository gate passes before the implementation sprint is accepted.

---

## J. Scale path

| Scale | Must prove |
|---|---|
| 1 learner | Correct authority, provenance, deterministic replay, grade invariance, no client score authority |
| 10 learners | Different evidence patterns, accommodations, languages, offline timing, sparse-state behavior |
| 100 learners | Concurrent reducer serialization, queue replay, policy-version transitions, teacher review load |
| Classroom | Actionable grouping, bounded teacher alerts, instructional latency, shared-device/offline behavior |
| School | Tenant isolation, enrollment-window access, school connectivity, queue backpressure, support workflow |
| 100 schools | Partition/index behavior, reviewer operations, regional connectivity, cost budgets, recovery |
| 5,000 schools | National queue capacity, archive/retention, disaster recovery, key rotation, small-cell privacy |
| Hundreds of thousands | Partitioned append-only evidence/update tables, asynchronous aggregates, provider independence, measured SLOs |

Must scale correctly now:

- tenant identity
- idempotency
- learner revision concurrency
- bounded payloads
- version lineage
- query/index design
- outbox/backpressure
- server-held scoring
- offline conflict semantics
- privacy purpose separation

Defer:

- microservices
- graph database
- per-student agents
- neural mastery models
- widespread 3D
- national real-time dashboards
- model training on learner data
- multi-country ontology abstraction

NR-4 and NR-5 load gates must be passed before national production readiness is claimed.

---

## K. Ranked risks

1. Invalid learner-state inference from forged, weak, AI-generated, or context-invalid evidence
2. Administrative-grade mutation by diagnostic or placement flows
3. Duplicate mastery, curriculum, identity, and lab authorities
4. Answer-key and tool leakage that invalidates assessments
5. Privacy purpose creep and child profiling
6. Offline double counting or split-brain learner state
7. Curriculum drift from heuristic concept mappings or generated content
8. Teacher displacement through automatic effective decisions
9. Misconception false positives becoming durable labels
10. Experiment abuse or stop recommendations that are not enforced
11. Cross-tenant access caused by inconsistent nullable tenant fields
12. Confusion between `Student.id` and student-role `User.id`
13. Retention of raw conversations and unnecessary behavioral detail
14. Teacher review overload and alert fatigue
15. National aggregation before learner-state validity
16. Latency amplification from synchronous graph, AI, or analytics work
17. Provider and AI cost escalation
18. Premature graph-database, microservice, agent, or neural-model complexity
19. Accessibility, low-end device, and language inequity
20. Overstating production readiness based on local certification or roadmap text

---

## L. Business and moat analysis

### Defensible value

- A reviewed Liberia-specific curriculum ontology and versioned crosswalk
- Longitudinal continuity produced from governed evidence
- A localized misconception taxonomy validated by educators
- Measured intervention effectiveness
- Trusted teacher workflows and decision history
- Offline delivery and synchronization under real connectivity constraints
- Curriculum, textbook, toolkit, and lab representations tied to one authority
- Government integration and national operating capability
- Privacy-safe aggregate system insight
- Governed evaluation assets and model benchmarks
- Local-language and culturally grounded pedagogy
- Replicable governance/runtime contracts for other countries

### Valuable but highly sensitive

Longitudinal learner state is valuable for continuity and instruction, but it is entrusted child data. It must not be treated as a saleable asset or unrestricted training corpus.

### Not a moat

- Raw student data
- Raw event volume
- A generic chatbot
- A static knowledge graph
- A list of agents
- Generated textbooks without authority or measured effectiveness
- Commodity RAG
- Unvalidated mastery percentages
- One-off custom simulations
- Generic dashboards
- Model-provider access

The strongest network effect is not "more child data." It is a governed cycle in which teachers and approved learning activities generate trustworthy evidence, that evidence improves validated interventions, and those interventions improve curriculum delivery without surrendering human authority.

---

## Hostile architecture audit outcome

The requested Sol High review returned a conditional go and required these corrections, all incorporated above:

- P0 constitutional containment precedes ontology expansion.
- The first mission must include real write-boundary containment, not merely ADRs.
- Client-supplied answers and lab scores cannot be evidence authority.
- Answer-key release and tool policy must be server-controlled.
- `LearningEvent` remains raw telemetry; it is not the evidence ledger.
- The ontology requires one published release rather than coequal Standard, Skill, target, and concept authorities.
- Legacy mastery tables become one-way compatibility projections, never dual-written authorities.
- Recommendation, policy resolution, and effective decision are distinct facts.
- Offline clients append observations, not mastery.
- New learner data requires purpose classification, retention limits, RLS, guardian minimization, and small-cell suppression.
- P7-B is reusable infrastructure, not proof of a child-safe experimentation authority.
- `lib/labs` validate/apply semantics become the convergence kernel.
- The synchronous learner path excludes LLM calls and heavy analytics.

The corrected architecture is viable without rebuilding from scratch.

---

## Plain answer: what should LiberiaLearn build next?

Build constitutional containment plus one complete governed Grade 4 mathematics learning slice.

Do not begin with a nationwide knowledge graph. Do not begin with Learner Experience V2 alone. Do not add another mastery service. Do not add more agents.

The order should be:

1. Stop unsafe grade, score, answer-key, tool, and direct-mastery paths.
2. Publish one small governed ontology release using existing curriculum authorities and `Skill`.
3. Bind selected diagnostic and instructional items to concepts, objectives, evidence policy, and tool policy.
4. Create one narrow evidence authority.
5. Create one deterministic concept-state reducer and cut over the selected slice.
6. Persist recommendation, policy resolution, effective decision, and teacher override.
7. Prove offline replay and day-one fallback.
8. Expand evidence sources and curriculum coverage.
9. Add calibrated retention and misconception logic.
10. Extend the learner experience and orchestrator.
11. Converge textbooks and labs.
12. Add specialist AI, teacher intelligence, experiments, and national aggregation only after the foundation is trustworthy.

Why: the repository already contains most delivery surfaces. The failure mode is inconsistent authority, not absent features. Building broader UX, graphs, agents, or analytics before fixing evidence and state authority would amplify incorrect learner decisions.

---

## Recommended first implementation mission

**Mission name:** Governed Learning Authority and Grade 4 Mathematics Vertical Slice

**Goal:** Make authority executable at write boundaries and prove one safe, auditable evidence-to-decision loop without changing administrative grade.

### Scope

- placement/diagnostic separation
- removal of client answer and score authority
- answer-key release containment
- context-specific tool policy
- one reviewed ontology release
- one initial diagnostic
- diagnostic, lesson/practice, and teacher-observation evidence adapters
- deterministic concept-state projection
- auditable recommendation, resolution, decision, and override
- offline raw-observation replay
- legacy mastery compatibility projections

### Dependencies

- founder approval of the bounded domain
- curriculum-authority reviewer
- schema-change approval because student learning tables are production-sensitive
- explicit Student versus User identity contract
- approved assessment and tool policies
- agreement on the official enrollment/grade authority

### Authority boundaries

- MOE curriculum governance remains canonical
- diagnostics cannot write official grade
- clients cannot assert correct answers or scores
- LLMs cannot accept evidence or update mastery
- only the evidence gateway admits evidence
- only the deterministic reducer writes canonical learner state
- only the decision authority creates effective path changes
- teachers retain consequential authority
- devices cannot assert canonical mastery
- textbooks and labs remain curriculum representations

### Deliverables

- authority ADR and complete writer/reader matrix
- corrected placement and grading boundaries
- one approved ontology release and legacy crosswalk
- item construct, evidence, and tool bindings
- evidence ledger and acceptance service
- diagnostic session lifecycle
- canonical state, update, and decision records
- shadow/reconcile/cohort-cutover/retire plan for legacy mastery
- teacher inspection and override surface
- signed offline projection and raw-observation protocol
- provenance reconstruction tool/report
- operational latency and privacy gates

### Tests and evaluations

- placement grade invariance
- forged answer and forged score rejection
- answer-key denial before policy release
- tool-policy enforcement
- accommodation override authorization
- LLM non-authority
- tenant and identity mismatch rejection
- duplicate, delayed, conflicting, and out-of-order replay
- reducer concurrency serialization
- deterministic reconstruction
- curriculum-version invalidation
- teacher override visibility
- stale offline fallback
- RLS and purpose-access checks
- misconception uncertainty
- provider outage fallback
- bounded synchronous latency
- full required repository gate

### Safety requirements

- no raw conversation in canonical learner state
- no punitive AI reliance score
- no high-stakes automated decision
- no cross-school learner history without authorized enrollment relationship
- no synthetic evidence in production metrics
- no experiment in this mission

### Offline requirements

- signed ontology, activity, and tool-policy versions
- expiry-bounded learner projection
- raw observations only
- deterministic idempotent replay
- visible staleness
- grade-level fallback curriculum
- no official-grade or canonical-mastery mutation

### Completion gate

One simulated learner completes the full milestone described in Section I; every state and path change is reproducible; official grade is unchanged; teacher authority is visible; all hostile, tenant, offline, privacy, and validity tests pass; then the complete Rule 7 gate passes.

This mission has not been executed.

---

## Audit status

- Sprint: New North-Star Architecture Audit
- Status: Complete, audit only
- Files changed during audit: None
- Validation: P7-A/B/C focused verification passed, 3 files and 29 tests; `git diff --check` clean; full Rule 7 gate was not run because no code changed and another Codex was active in the repository
- Next step: Founder approval or rejection of the recommended first implementation mission

LIBERIALEARN NEW NORTH-STAR ARCHITECTURE AUDIT COMPLETE  CURRENT REPOSITORY MAPPED  TARGET LEARNING-INTELLIGENCE ARCHITECTURE DEFINED  FIRST IMPLEMENTATION MISSION READY FOR FOUNDER APPROVAL
