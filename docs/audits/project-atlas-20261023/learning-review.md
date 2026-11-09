# Learning and educational authority review

Source commit `887f23ecc`. Static inspection only. Production activation, student outcome effects and hosted records are unknown.

## Findings

- Published governed ontology registry contains only Grade 4 Math. Other grades need reviewed releases, not inferred curriculum bindings.
- Student Tutor already shares grounded retrieval, moderation, citation validation and budget fallback through the compatibility adapter. Server gate defaults off.
- Content Factory V2 has bounded, auditable eight-role execution and preserves human review. Role names are not proof of eight autonomous live agents.
- Four persisted AI curriculum review agents are advisory. Admin invocation behind P2B flag can enable their records, so flag activation has consequential provisioning behavior.
- Assessment V2 has substantial scoring, protection and evidence foundations; downstream writes remain hardcoded false. Records V2 classifier already protects selected legacy readers, but the complete V2 record lifecycle is unfinished.
- Virtual lab AI suggested scores enter performance telemetry as unassisted; safety fallback zero can become false low performance. Keep gated until score authority/fallback semantics are repaired.
- WAEC practice marking lacks issued-attempt binding, duplicate/replay checks and subject filtering before legacy mastery writes. It also generates bank content on demand outside reviewed factory governance.
- Retention planning exists without wired delayed-check delivery. Kindergarten enrollment contract excludes grade 0; executable locale choices omit Koloqua.
- No inspected evidence demonstrates retained transferable learning. Completion, attractive lessons and model confidence cannot substitute for independently measured outcomes.

## Evidence index

The JSON is the canonical review source; each record includes path, symbol, line range, strength and content fingerprint.

| Path and lines | Symbol | Claim |
|---|---|---|
| `lib/learning-authority/publishedReleases.ts:1-25` | `publishedReleases` | The executable published ontology registry contains only Grade 4 Math; other grades/subjects do not receive a governed release by inference. |
| `app/api/student/learning-authority/next-action/route.ts:1-161` | `POST` | Authenticated server entry resolves published release, persists decisions, seals diagnostic sessions and server scores answers. |
| `lib/learning-state/masteryWriter.ts:54-120` | `readCanonicalStudentConceptState/createGovernedMasteryEvidence` | Canonical state reads require learner membership; writes validate governed evidence identity and released bindings rather than trusting client mastery. |
| `lib/learning-state/studentLearningModel.ts:1-24` | `replayStudentConceptState` | Versioned mastery reducer models confidence, retention and misconception state; this is an implemented state model, not proof of educational validity. |
| `lib/learning-authority/learningOrchestrator.ts:135-154` | `deterministicDecisionModel` | Default ranking is deterministic and considers evidence sufficiency/conflicts/retention. It is not an LLM agent. |
| `lib/learning-calibration/earlyLearningPolicy.ts:8-53` | `EARLY_LEARNING_POLICY_V1` | Early personalization mixes are explicitly a STARTING_HYPOTHESIS_REQUIRES_EDUCATIONAL_REVIEW, not validated outcomes. |
| `app/api/student/tutor/route.ts:33-73` | `POST` | AI_TUTOR_ENABLED and Edge Config both gate tutor; STUDENT role, rate limit and server-resolved context precede generation. |
| `lib/ai/tutor/studentTutor.ts:1-29` | `getStudentTutorResponse` | Student tutor is a compatibility adapter to the shared groundedAnswerService, so counting it as an independent orchestration engine would double count. |
| `lib/ai/rag/groundedAnswerService.ts:457-632` | `answerGroundedQuestion` | Grounded answer generation moderates input/output, uses a bounded regeneration, validates citations, handles weak grounding and budget block, and tells the model sources are untrusted. |
| `lib/ai/tutor/tutorContext.ts:56-72` | `isUsableLesson` | Tutor context rejects assessment content and recognizable protected answer/teacher fields. Regex checks alone are not a general prompt-injection proof. |
| `lib/content-factory/v2/manager.ts:6-124` | `runFactory/ROLE_DEPENDENCIES` | Eight role stages run injected executors in fixed dependencies, bounded attempts 1-5, hash-linked events and self-review checks. The workflow lacks approval/official writers and ends awaiting human review. |
| `lib/content-factory/v2/runtimeBindings.ts:35-64` | `resolveAuthoredRuntime` | Exact source hash and DRAFT/PENDING runtime binding preserve first-three authoring provenance; returned bindings remain studentEligible:false, approved:false, released:false. |
| `lib/curriculum/review/aiReview.ts:27-56` | `AGENT_DEFINITIONS/ensureAgent` | Four persisted AI review identities use router/configured-provider and prompt fingerprints, minimum confidence 70, provisioned enabled:false unless explicitly enabled. |
| `app/api/admin/review-operations/ai/run/route.ts:9-17` | `POST` | Flag-gated platform-admin route requires idempotency key then provisions review agents with enable:true. Changing gate can activate records on invocation; not purely a read flag. |
| `lib/curriculum/review/aiReview.ts:100-183` | `runAIReviewTask/finalizeAIReviewTask` | Subject/pedagogy reviewers run, optional WAEC and disagreement adjudicator follow. CRITICAL tasks blocked, stale revisions rejected, final result advisory only with required audit. |
| `lib/assessment/v2/consumers.ts:1-26` | `ASSESSMENT_V2_DOWNSTREAM_WRITES_ENABLED` | V2 consumers are pure readers and downstream writes are hardcoded false. This architecture is deliberately not an activated official record pipeline. |
| `lib/assessment/v2/projection.ts:1-105` | `projectItemForLearner/hintAccessFor` | Learner allow-list projection keeps protected scoring fields out; independent delivery cannot be downgraded and hint access is blocked. |
| `docs/architecture/assessment/ASSESSMENT_ARCHITECTURE_V2.md:232-270` | `Not implemented` | Documented V2 omissions include persistence, API routes, player UI and moderation queue. Existing runtime adopts selected safe adapters and candidate review, not full production V2 lifecycle. |
| `lib/assessment/v2/retention.ts:36-60` | `LL_RETENTION_PILOT_POLICY` | 7/21-day retention policy and opportunity planner exist; policy comments explicitly say scheduler, delivery and evidence writes are not wired. |
| `lib/academic-records/v2/assessmentEvidence.ts:45-84` | `toGradeEntry` | Official grades reject raw/provisional/unofficial/revoked/unauthorized scores; assisted or unknown independence requires moderation rather than automatic official points. |
| `lib/academic-records/v2/gradeCalculation.ts:240-250` | `legacyAssignmentScoreAuthority` | Legacy classifier distinguishes teacher approval/regrading from AI auto-release/unmoderated suggestions. |
| `app/api/teacher/gradebook/route.ts:78-106` | `GET` | Teacher gradebook reader exposes official score/feedback only for classifier result TEACHER. |
| `app/api/student/assignments/route.ts:94-104` | `GET` | Student assignment reader suppresses score unless classifier result TEACHER. |
| `lib/reportCards/generateReportCard.ts:70-80` | `generateReportCard` | Report card generation skips submissions without TEACHER score authority. |
| `lib/curriculum/excellence/outcomeClaims.ts:57-102` | `classifyLessonOutcome` | Learning success requires unassisted matched learners, retained/transfer gain and independent comparable evidence; delivery/completion alone never demonstrates learning success. |
| `lib/placementAuthority/items.ts:148-185` | `generatePlacementItem` | Current AI placement issuance is hardcoded mathematics with server fallback bank. No multi-subject calibrated diagnostic coverage or psychometric reliability evidence established. |
| `lib/records/systemOfRecord.ts:36-44` | `createAcademicEnrollmentSchema` | Academic enrollment input accepts grades 1-12, which does not provide a Kindergarten grade path. |
| `i18n.ts:1-14` | `SUPPORTED` | Supported request locales are en, kpe and bss; Koloqua is absent from this executable locale registry. |
| `components/LanguageSelector.tsx:5-9` | `LANGUAGES` | Visible language options are English, Kpelle, Bassa; absence of Koloqua corroborates locale registry gap. |
| `app/api/student/labs/[labId]/session/route.ts:89-141` | `POST` | AI suggestedScore is stored as LabSession.score and sent to StudentPerformanceEvent with aiAssistUsed:false. This establishes scoring provenance ambiguity, not a proven official-grade write. |
| `lib/ai/lab/labAnalyzer.ts:28-34` | `safeFallbackAnalysis` | Moderation fallback has suggestedScore zero, so fallback can look like actual low performance to the completion writer. |
| `lib/intelligence/recordPerformanceEvent.ts:48-77` | `recordPerformanceEvent` | Performance event persistence feeds confusion detection by queue or direct scheduler, making advisory scoring provenance operationally consequential. |
| `lib/interactive-labs/v2/governance.ts:45-54` | `adaptLabEvidence` | Without an explicit governed mapping, lab events remain RAW_OBSERVATION or PROVISIONAL; only approved published mapped evidence can become canonical. |
| `app/api/labs/[labId]/plan/route.ts:19-71` | `POST` | AI lab planner is default-off flag-gated, STUDENT-authenticated and rate-limited; returned proposed actions run deterministic validateLabAction. |
| `app/api/labs/[labId]/explain/route.ts:14-44` | `POST` | AI lab explainer is flag/role-gated but unlike planner route lacks route-level checkAiRateLimit. Central provider budget is not a per-user throttle. |
| `app/api/teacher/lesson-plan/route.ts:64-99` | `POST` | One endpoint has a weekly-class planning branch using lib/teacher/lessonPlanner while its other branch uses lib/ai/teacher/lessonPlanner; overlapping planning families should share contracts. |
| `lib/ai/homeworkGrader.ts:28-52` | `gradeHomework` | Moderation-blocked grading returns synthetic grade 50 with teacher-review message, so callers must never treat all returned numeric grades as achieved performance. |
| `lib/serverFlags.ts:132-142` | `isAiTutorEnabled/isVirtualLabsEnabled/isAiGradingAssistEnabled` | Tutor and teacher assist default off. Additional reviewed flag sections show adaptive/intervention/planning/grading defaults on, virtual labs/AI labs default off. Production values unknown. |
| `lib/waec/practice.ts:126-168` | `gradePracticeSession` | Submitted IDs are fetched globally without issued-session, subject or grade binding. Replays and duplicate IDs are not rejected before updateMasteryProfile records unassisted legacy mastery. This is not evidence of canonical SLM mutation. |
| `app/api/student/waec/[subject]/practice/route.ts:23-56` | `GET/POST` | GET may generate missing practice bank content; POST has no issued attempt/idempotency and chooses first enrollment school. No route AI request throttling is present. |
| `lib/waec/practice.ts:41-82` | `ensureBank/generateForTopic` | LLM-generated questions pass moderation and shape checks then enter practice bank directly, outside Content Factory/independent academic review. Each underfilled topic can trigger a provider call. |
| `lib/curriculum/eliteUpgrade.ts:1047-1072` | `createEliteUpgradeDraft` | Existing curriculum upgrade loads persisted source lesson and drafts enriched content. Separate generator has bounded generation/repair call paths with 10000-14000 output token limits earlier in module. |
| `lib/curriculum/benchmarking/aiWaecAlignment.ts:139-179` | `assessWaecBaselineAlignment` | Standalone AI alignment assessor uses versioned prompt and authoritative source evidence; separate persisted review WAEC SME validates through this module but is a distinct caller. |
| `lib/curriculum/benchmarking/aiWaecAlignment.ts:21-83` | `AiWaecAlignmentSchema/hasTopicLevelWaecEvidence` | Output must label AI_ASSESSED_ALIGNMENT with externalApprovalClaimed:false, and definite depth/direct alignment needs topic-level WAEC evidence. |
| `lib/ai/lessonQuiz.ts:163-174` | `generateLessonQuiz/generateLessonGapAnalysis` | Quiz generation and gap analysis are separate functions in one lesson assessment service, invoked from learner quiz routes. This is an on-demand service, not a scheduled autonomous agent. |

## Priorities

| Priority | Action | Acceptance |
|---|---|---|
| P1 | Keep virtual lab activation gated until AI score provenance and refusal handling are repaired | Moderation fallback creates pending review without numeric attainment; AI score stored as provisional; performance detector receives explicit scorer/provenance and excludes unverified marks; regression tests cover unsafe input and repeat submission. |
| P1 | Deliver one approved assessment V2 persistence-to-moderation-to-official-reader vertical slice before expanding official writes | One class can attempt a released form; protected fields stay server-side; retries idempotent; assistance disqualifies independence; second marking and revocation propagate; teacher publishes final records; downstream write constant remains unchanged until explicit authorization. |
| P1 | Publish one complete coherent schoolday pilot with explicit curriculum coverage and governance ledger | Every scheduled period has approved released lesson/activity/assessment, teacher materials and offline fallback; dry-run shows no draft or unsupported launch; coverage gaps visible rather than substituted silently. |
| P2 | Expand governed releases one subject/grade unit at a time using existing learning state/orchestrator | Next scope has reviewed prerequisite graph, independent diagnostic items, scored bindings and misconception policies; unsupported scope returns explicit gaps; replay/tenant/idempotency tests pass. |
| P2 | Run measured pilot before claiming instructional effectiveness | Pre-register baseline/post/delayed/transfer measures, retain revision/learner linkage and comparison assumptions; report uncertainty and exclusions with classifyLessonOutcome; no claim of demonstrated success from completion counts. |
| P2 | Wire a controlled 7/21-day retention workflow for an approved unit | One learner receives due opportunities exactly once, with independent/no-tutor status, missed-day handling, offline capture and teacher visibility; due state does not itself imply lost mastery. |
| P2 | Define Kindergarten and Koloqua pilot contracts | Kindergarten enrollment/curriculum/reporting flows have explicit grade-band policy; Koloqua reviewed sample module, language preference and English equivalent preserve meaning and assessment validity. |
| P3 | Consolidate teacher planner/grading contracts while preserving useful task modes | All current callers use one versioned planner contract and one advisory grading contract with task mode; same limits/provenance, no endpoint removed until callers migrate and parity verified. |
| P1 | Bind WAEC practice marking to a server-issued immutable attempt before admitting mastery | Server-issued attempt pins student, school, subject, grade and question IDs; scoring exactly once rejects duplicates/unissued/cross-subject IDs and replay; assistance provenance retained; question generation requires rate/budget bounds and reviewed provisional content status. |

## Validation and limits

Parsed JSON and checked cited source file existence/fingerprints. No runtime tests or provider calls executed. Every reviewed source path was read only. Broad school/teacher/guardian capabilities are route inventory evidence; critical learner authority paths received targeted code inspection. Live deployment, learning gains, device performance and actual school operations require external verification. Avoid printing protected keys or personal learner records.

## Frozen quality baseline

The 2026-10-16 automated baseline covers 1,105 catalog revisions: zero pass mechanical checks, 701 need revision, 51 rebuild and 353 are blocked by source or authority. Every revision awaits qualified independent review; the artifact states there is no learning-outcome evidence. This is a frozen repository snapshot, not a current live database assertion. Source: `docs/curriculum/modernization/LIBRARY_QUALITY_BASELINE_V1.md:3-22`. Educational quality assurance and released coverage are therefore among the largest strategic gaps.

Upgrade writer verification: `lib/curriculum/eliteUpgrade.ts:1180-1228` uses governed mutation persistence, pending_approval status and prompt/model/correlation provenance; it does not bypass human approval.

Review totals: 23 canonical capability agent/workflow groups, 47 cached source evidence records, 26 capability rows, 9 prioritized actions. See JSON for exact inspected file list. Type counts and production activation should be reconciled by the root audit registry.

Additional positive control: lesson quiz projects learner-safe fields, seals score/session data, checks exact question sets and client-attempt idempotency. WAEC can reuse these established mechanisms. Placeholder generated quiz content is rejected explicitly. See appended JSON evidence. Updated evidence count 50; inspected source count follows JSON.
