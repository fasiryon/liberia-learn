# Content Factory Readiness V1

Decision date: 2026-10-13. Status: authoritative architecture convergence decision for future implementation. This document supersedes conflicting recommendations in the preserved audits, not their evidence. It is not curriculum approval, lab certification, migration authorization or proof of hosted readiness.

## Basis and preserved inputs

- Branch: `docs/content-factory-readiness-v1`.
- Exact source/base: `f22ccb7bbfb8b7f57ab6ebd3ff7b7ae2f2e445f1`. Local main had moved to `223ed86a2fc5f53b9117d939dca01dc8523a608c`; the shared checkout had unrelated changes. This work uses an isolated worktree at the requested SHA.
- Product audit: [CONTENT_PRODUCT_DELIVERY_AUDIT_V1.md](CONTENT_PRODUCT_DELIVERY_AUDIT_V1.md), preserved byte-for-byte from commit `ed3e2eee2f04d1cb12909b3d7cc0f5390f1649c5`, branch `docs/content-product-delivery-audit-v1`.
- Engine audit: [CONTENT_ENGINE_GOVERNANCE_AUDIT_V1.md](CONTENT_ENGINE_GOVERNANCE_AUDIT_V1.md), preserved byte-for-byte from the uncommitted original in `.task-worktrees/content-engine-governance-audit-v1`. Its branch HEAD is the requested base, not an audit-document commit. Original SHA-256: `66b4f0f1d603000da547375475642b4bdad4e10231a7c19fd1d00518495c7b5c`; the shared copy has the same hash.
- Repository evidence, not hosted evidence. Relevant guidance read: CORE_AGENT_RULES, CONTEXT_ROUTING, ADVISOR_ESCALATION_CONTRACT, FULL_CURRICULUM_RELEASE_PIPELINE_V1 and VERSION_GOVERNANCE. The historical release-pipeline authority-conflict note is superseded by code declaring `LIBERIALEARN_FOUNDER_REVIEW`; MOE approval remains a distinct claim.

No production code/schema change, Prisma execution, hosted mutation, deployment, curriculum publication, mass generation or PR is authorized by this document. Waves below describe future work.

## 1. Architecture decision and reconciliation

ContentBundle V1 is an immutable, strictly typed composition manifest for one grade/subject/unit/objective slice against one exact ontology release. It references governed revisions and policies and carries reviewed ordering/configuration. A course may compose bundle references. Missing required dependencies yield explicit readiness gaps, not generated substitutes.

Confidence measures architecture/evidence confidence, not hosted availability. High means direct repository evidence and established authority boundaries; medium means persistence/scoring design remains open.

| Decision | Product finding | Engine/governance finding | Final architecture decision | Confidence | Follow-up |
| --- | --- | --- | --- | --- | --- |
| ContentBundle role | Single versioned envelope for product surfaces | Typed composition over existing authority | ACCEPT envelope of exact refs/bounded metadata; no second authority | High | Wave 1 validator/hash |
| ScheduledWork convergence | Natural canonical binding; replace redundant attachments | Keep first-class operations and strengthen pins | YES future canonical classroom content-delivery anchor; preserve instance models/history | High | Wave 5 additive design |
| Classwork | No reusable definition | No Classwork model; revision-backed typed definition sufficient | ActivityDefinition CLASSWORK, deployed via Assignment/ScheduledWork | High | Wave 3 |
| Homework | Replace free-text/embedded bodies | Homework/Submission own teacher/SMS/offline workflow | Common definition authority; keep Homework state with exact definition links | High | Compatibility adapters |
| Project | Bundle project plus capstone state | CapstoneProject is student artifact lifecycle | ActivityDefinition PROJECT; specialized CapstoneProject survives | High | Defer milestone/group persistence |
| Assessment item authority | Release items only; retire older banks later | Adapt banks; transport safety is not review | One conceptual governed AssessmentItem identity/version via release bindings; retain historical/adapted stores | High | Wave 4 mapping/key review |
| Quiz/unit assessment/exam | Shared sets and extended handoff | Purpose/evaluator/school exam authority differ | AssessmentDefinition purpose over ordered items; school Exam publication/results remain operational | High | Summative admission policy |
| Lab bindings | Governed links vs standard auto-suggestion | Certification and real release identity required too | Only governed exact link refs in bundle; suggestions authoring-only | High | Certify before learner inclusion |
| Toolkit bindings | Unify identifier vocabulary | Explicit reviewed semantic mapping; immutable old policy | Pin registry mapping/config/policy; no silent spelling or semantic equivalence | High | Waves 1–2 |
| Textbook compilation | Derive four renderings | Current student export leaks keys; others empty | Shared resolved source set, separate audience plans/artifacts | High | Wave 10 |
| Offline packaging | Extend bundle pin/cache | ZIP denylist unsafe; separate cache stronger | One package exact bundle/version/hash and item/asset pins; learner/staff split | High | Wave 8 |
| Learner state | Separate attempts/mastery/progress | Canonical events/SLM vs legacy projections | All state external; governed Progress reads canonical state/decisions | High | Waves 2/7 reader alignment |
| Governance/provenance | Bundle lifecycle/approvals | Existing exact-revision records own authority | Reference existing records; eligibility/lifecycle derived, no local approval boolean | High | Snapshot/review coverage |
| Version identity | Stable bundle/member hash | Mutable legacy labels omit dependencies | Immutable composition, exact child/release/policy pins; changed child needs new composition revision | High | Canonical serialization |

Disagreements are explicit: product REPLACE recommendations for Assignment/Homework bodies and attachment tables mean replacing definition/reader behavior, not deleting operational records. Engine ADAPT of older banks wins over premature retirement: preserve history until audited compatibility migration. Product-proposed embedded items/rubrics/approval objects become governed references, not duplicate ledgers. A reviewed composition does not approve unreviewed children. Assessment Player V2 remains required future work despite its UI being deferred within the engine audit's scope.

## 2. Locked ContentBundle principles

All five are ACCEPTED:

1. **Composition, not second authority.** CurriculumOntologyRelease owns executable ontology/bindings/policies. Existing provenance/revision history, qualified reviewer governance and release registry own lineage and approval/release. Canonical mastery, SLM, DecisionModel and Learning Orchestrator retain their authority. Bundles resolve their records; no new bundle approval engine.
2. **Version pinning.** Every bundle/member has stable identity/version. Governed classroom delivery pins exact bundle and definition/item versions. Mutable latest contentId remains explicitly legacy compatibility data, never canonical assignment truth. Old release identities remain immutable.
3. **Student state separation.** Attempts, submissions, scores, mastery, progress, attendance, learner decisions, accommodation grants and group membership remain operational. Support metadata describes reviewed capabilities, not diagnoses or computed unlocks.
4. **Derived outputs.** Textbook/workbook/teacher guide/assessment book/print/PDF/offline packages derive from governed dependencies. They neither approve nor redefine content. Output hashes differ from source composition identity.
5. **Generation is not approval.** Factories create candidates only. Generator flags, caller role, quality/moderation, ready labels, elapsed time or citations cannot establish approval, release, certification or learner-visible authority.

## 3. Canonical conceptual contract

This is conceptual, not final TypeScript/Prisma. Initially use bounded typed definitions and existing immutable CurriculumContent revisions; durable composition storage follows explicit snapshot/schema review.

```text
ContentBundle {
  identity { bundleId, version, schemaVersion, contentHash }
  curriculumAuthority { releaseId, releaseIdentity, objectiveIds[], standardIds[], sourceVersionRefs[], conceptRefs[], constructBindingRefs[] }
  sequence { unit { unitId, title, grade, subject }, ordering[], prerequisites[], unlocks[] }
  lessons[]       -> LessonRevisionRef
  activities[]    -> ActivityDefinitionRevisionRef
  assessments[]   -> AssessmentDefinitionRevisionRef + ordered ItemVersionRefs
  labs[]          -> GovernedLearningExperienceBindingRef
  resources[]     -> ApprovedResourceVersionRef
  toolkitBindings { required[], optional[], prohibited[], context, config }
  learnerSupport { remediation[], enrichment[], accommodations[], languageVariants[], presentationVariants[] }
  renderings { textbook, workbook, teacherGuide, assessmentBook }
  offline { manifestPlan, assetHashes[], allowedCapabilities[], reconnectSemantics }
  governance { provenanceRefs[], reviewRefs[], lifecycleReferences[], releaseRefs[] }
}
```

Collections have strict discriminated subtypes, stable member/binding IDs and versions, exact definition version/revision/hash and audience. Sequence entries pin memberId/memberVersion/kind/objectives/requirement/dependencies. Distinguish CurriculumContent database id from logical contentId. Assessment refs pin ordered itemId/itemVersion, construct binding, evaluator/evidence/tool/answer-release policies and reviewed rubric versions. Lab refs pin link revision/hash, definition/runtime/certification/check versions. No embedded private keys or executable untyped config.

Matrix: S stored authored metadata/reference in immutable snapshot; D derived from authoritative records. Versioned means included in or pinned by composition identity. Release required concerns executable learner use, not draft creation. Safe always means allowlisted audience projection. Conditional offline requires pins, rights, capability, expiry/revocation and audience checks.

| Property | Source of truth | Stored or derived | Versioned? | Release required? | Learner safe? | Offline eligible? |
| --- | --- | --- | --- | --- | --- | --- |
| identity.bundleId | Content/revision namespace, allocated composition ID | S | Stable across revisions | For delivery | Scoped ID | Yes |
| identity.version | Immutable composition revision | S | Yes | For delivery | Yes | Yes |
| identity.schemaVersion | Bundle contract registry | S | Yes | Compatible contract for delivery | Yes | Compatible client |
| identity.contentHash | Canonical complete manifest excluding self hash | D, persisted digest | Yes | Verify at delivery | Yes | Required |
| curriculumAuthority.releaseId | Published ontology registry | S ref | Yes | Yes | Yes | Yes |
| curriculumAuthority.releaseIdentity | deterministicReleaseIdentity | S pin, D verify | Yes | Yes | Yes | Yes |
| curriculumAuthority.objectiveIds | Verified source/version/objective plus explicit cell/release mapping | S refs | Yes source version | Yes mapping | Approved wording/IDs | Yes |
| curriculumAuthority.standardIds | Namespaced source standards/construct bindings | S refs | Yes source version | Yes mapping | Yes | Yes |
| sourceVersionRefs/conceptRefs/constructBindingRefs | Source rights/verification, ontology revisions/bindings | S refs | Yes | Yes | Minimal labels/credits | Scoped |
| sequence.unit | Reviewed composition plan/unit namespace | S | Yes | Membership released | Yes | Yes |
| sequence.ordering | Reviewed ordered member/version refs | S | Yes order significant | All required refs | Authorized members | Closure |
| sequence.prerequisites | Release concept graph/reviewed bundle dependencies | S refs, D validation | Yes edges/endpoints | Yes | Definitions, not mastery | Definitions only |
| sequence.unlocks | Reviewed successor dependencies | S refs, D external eligibility | Yes | Successor before execution | Refs, not learner decisions | Refs, not unlock authority |
| lessons | CurriculumLessonV2 + immutable curriculum revision | S exact refs | Yes revision/hash | Approved revision and binding | Learner delivery DTO | Conditional fallback/capabilities |
| activities | ActivityDefinition in existing revision system | S exact refs | Yes | Yes governed use | Instructions/materials/public criteria | Conditional |
| assessments | Reviewed definitions/item authority | S refs/order | Yes items/policies | Yes | Keyless DTO only | Practice/prompts by policy; secure scoring deferred |
| labs | Governed link + exact definition/certification registry | S refs, D eligibility | Yes all identities | Yes plus certification/access | Authorized launch/instructions | Certified capability/fallback only |
| resources | Approved resource/media records and rights/license | S refs | Yes digest/revision | Source eligibility | Learner audience only | Rights/assets |
| toolkitBindings.required | Registry and reviewed mapping/policy | S refs, D availability | Yes | Context policy | IDs/reasons | Supported tool/fallback |
| toolkitBindings.optional | Registry and reviewed mapping/policy | S refs, D availability | Yes | Context policy | IDs/reasons | Supported tool |
| toolkitBindings.prohibited | Governing tool/assessment policy | S refs, D effective bans | Yes | Yes | Public reason | Must enforce offline |
| toolkitBindings.context | Reviewed objective/member/scene/grade/subject context | S | Yes | Yes | Public context, no grants/PII | Yes |
| toolkitBindings.config | Bounded tool-specific schema/registry revision | S | Yes digest | Reviewed policy/config | No keys/scripts/secrets | Supported schema |
| learnerSupport.remediation | Reviewed remedial definition refs | S refs, D selection | Yes | Yes | Authorized variant | Conditional |
| learnerSupport.enrichment | Reviewed extension refs, scope explicit | S refs, D selection | Yes | Yes | Authorized variant | Conditional |
| learnerSupport.accommodations | Reviewed adaptations; server grants external | S capability, D permission | Yes | Policy | Selected adaptation, no learner record | Bans preserved |
| learnerSupport.languageVariants | Reviewed translations, not UI locale list | S refs | Yes | Exact variant review | Yes | Conditional assets |
| learnerSupport.presentationVariants | Reviewed accessible scene/media/fallback | S refs | Yes | Yes | Yes | Validated capabilities |
| renderings.textbook | Approved section plan + learner projection | S plan, D output | Plan/compiler/digest | Sources released | Yes | Rights/size |
| renderings.workbook | Reviewed tasks/items/workspace plan | S plan, D output | Yes | Sources released | Keyless, public practice disclosure only | Conditional |
| renderings.teacherGuide | Reviewed staff pedagogy/private key refs | S plan, D output | Yes | Sources approved/released for use | NO | Staff package only |
| renderings.assessmentBook | Approved form/section plan | S plan, D output | Yes | Sources released | Learner question form only | Policy-dependent, no private keys |
| offline.manifestPlan | Dependency graph/availability policies | S plan, D signed manifest | Protocol/bundle/items/projection | Yes | No staff refs/assets | Yes |
| offline.assetHashes | Exact approved resource bytes | S pins, D verification | Yes | Source eligibility | Learner assets only | Required verification |
| offline.allowedCapabilities | Reviewed scene/response/tool/offline policies | S refs, D intersection | Yes | Yes | Public modes | Only supported modes |
| offline.reconnectSemantics | Versioned sync/admission/revocation protocol | S refs, D server action | Yes | Reauthorize on sync | No authority assertions | Queue responses, server adjudicates |
| governance.provenanceRefs | Existing source/provenance/revision/evidence writers | S refs | Yes revision | Required evidence | Minimal credits, no reviewer PII | Approved credits |
| governance.reviewRefs | Qualified exact-revision decisions/credentials | S refs, D validity | Yes | Yes | NO raw review/keys | Staff policy only |
| governance.lifecycleReferences | Existing governance/revocation events | S refs, D status | Snapshot pins/live checks | Yes | Safe availability/reason | Signed expiry/revocation constraints |
| governance.releaseRefs | Existing registry/manifest/authority records | S refs, D eligibility | Yes | Yes | Identity/authority label | Manifest pins |

Hash invariant: SHA-256 over versioned canonical serialization of complete composition, ordering, all exact child/release/source/policy/registry/config/section/offline-plan pins. Canonicalize object keys and unordered sets; preserve sequence/item order. Exclude self hash/signatures/derived artifact bytes and mutable operations to avoid cycles. Projection/package hashes separately bind audience, compiler/projection version and actual asset bytes to composition hash. Reject duplicate IDs, unresolved/cross-scope refs, stale hashes, dependency cycles, unknown tools/policies and unsupported kinds. A child change requires new composition revision/review. Existing snapshot schemas must explicitly cover new fields, never silently omit them. Child approval is independent; live revocation overrides historical executable eligibility.

## 4. ActivityDefinition decision

ACCEPT a common ActivityDefinition with typed kind: CLASSWORK, HOMEWORK, PROJECT, INVESTIGATION, PRACTICAL, GROUP_WORK. PRACTICE may use the same definition protocol as an item-set wrapper. Kind describes purpose, not a separate authority engine. GROUP_WORK also declares grouping capabilities; actual members remain operational. A reviewed paper PRACTICAL does not certify an executable lab.

Definition contains identity/version/revision/hash, objective/source/release bindings, learner instructions, resources/materials, response/expected-artifact schema, grouping capability, reviewed rubric/item refs, duration, accessibility/offline policy, evidence intent and bounded adaptation permissions. Material instructional changes require reviewed adaptation revisions. Due dates/rosters belong to instances. Adaptation cannot change authoritative keys/objectives/tool bans/evidence policy arbitrarily.

Assignment and Homework survive as class deployment records with targeting/due dates/SMS/reporting/submissions/grading, linked to exact definitions and ScheduledWork anchors. CapstoneProject remains specialized for sustained student artifacts/mentor/submission/review/PortfolioItem, referencing a PROJECT definition where applicable. No new Classwork or generic Project table is required for V1. Group/milestone persistence is deferred until operational needs justify it. Rubric-backed submission is not automatically canonical concept evidence; reviewed server/human admission adapters are required.

## 5. Assessment authority decision

Conceptual AssessmentItem means governed question/response/scoring definition. Existing Prisma AssessmentItem is a membership row: do not conflate or rename it without migration design.

| Current store/path | Current authority/gap | Future disposition and survivors |
| --- | --- | --- |
| Lesson Experience/V2 formative checks | formativeKey permits local feedback, not canonical scoring | Retain reviewed formative instruction; separate disclosed checks from withheld assessment |
| GovernedItem/release construct bindings | Stable item/version/server key/admission; single-choice DIAGNOSTIC/PRACTICE | REUSE executable V1 authority; extend by reviewed release versions |
| ExamQuestion/Exam | Server positional grading, unversioned review/order, explanation leakage | ADAPT item mapping; Exam/ExamAttempt/ExamCertification/publication/results survive |
| PracticeItem/Assessment/Prisma AssessmentItem | Keys/rubrics/skill refs, incomplete lifecycle/version, nullable item membership | ADAPT immutable mappings; membership/Assessment adapter survive; Submission/Grade remain state |
| AI lesson quiz/preauthored lessonQuiz | Sealed keys and pre-submit projection, not reviewed release truth | Replace governed runtime generation with reviewed refs; session pattern and AssessmentAttempt/Detail survive |
| Adaptive practice | Generated sealed items, legacy mastery, no item review | Candidate-only production; reviewed items for canonical flow; state/session adapter retained |
| WAEC/WaecPracticeItem | Learner-demand ensureBank/moderation, weak version/reviewer authority | ADAPT reviewed source/item mappings, preserve IDs/history; no automatic governed publication |
| Generic helper/factory/unit/full-pack questions | Placeholder A keys, prose lists, weak identity | REPLACE governed production; review/quality gate before any migration |
| CodeExercise/AILiteracyExercise/specialized checks | Specialized modalities not admitted by current single-choice path | Preserve definitions/state; DEFER canonical scoring pending reviewed adapters |

Future separation:

- **AssessmentItem:** immutable ID/version, reviewed prompt/options/media/response schema/objective bindings; private key or rubric revision; evaluator/version; classified hints/explanations; answer-release policy. Public rubric criteria are distinct from private scoring guides. Rubric support in contract does not imply implemented canonical scorer.
- **AssessmentDefinition:** ordered exact item refs, purpose CHECK/QUIZ/UNIT_ASSESSMENT/EXAM_SECTION, scoring/evidence/tool/assistance/retry/disclosure policies and timing. Purpose differs from evaluator. An operational Exam composes sections and retains school publication/results authority.
- **AssessmentAssignment/delivery:** targeting/window, ScheduledWork anchor, bundle/member/definition/item pins, frozen order and authorized adaptations. Concept only, not mandated new table.
- **AssessmentAttempt:** server session, scoped identity, responses/idempotency/timestamps, exact items/order/policy/evaluator, assistance/independence/results. AssessmentAttempt/Detail, Submission and ExamAttempt survive through explicit adapters. Translate Student.id/User.id; never prematurely serialize raw details/keys.
- **Evidence:** admitted server-computed GovernedEvidence tied to release/item/version/binding/policy/deployment/attempt. Existing canonical mastery writer/SLM owns consequences. CurriculumEvidence remains source/review provenance, not learner performance.

Assessment Player V2 consumes one keyless session/delivery contract: supported interaction, prompt/choice IDs, order/item versions, accessibility/media/policies, response envelope. Server rechecks tenant/enrollment/exact revision/release/revocation on start/resume/submit, scores pinned private keys and admits evidence once. Deny client correctness, altered order/unknown items and unsupported scoring. Existing canonical conversion supports scored single-choice PRACTICE/QUIZ/DIAGNOSTIC mappings; EXAM_TEST/rubric/project/numeric/multi-select/free-response extensions need review. School exam grade does not automatically become mastery. Summative items cannot reuse disclosed formative keys. No bank migration/retirement now.

## 6. ScheduledWork decision and phases

YES: future canonical classroom content-delivery anchor. It already owns class/date/period/A-B pairing/delivery tracking and Today/lesson/progress flows. Current schema requires contentId FK to mutable CurriculumContent with no revision pin. Nonlesson delivery requires additive design and eventual compatibility change to that lesson-only relation; no exact Prisma columns are prescribed.

Future concepts: bundleId/bundleVersion/hash, releaseId/releaseIdentity, memberId/memberVersion/itemKind, definition revision/version/hash, assessment itemId/itemVersion set/order where applicable. Member identity differs from question identity. Keep tenant/class/enrollment/dates/pairing/completion/adaptations/source mappings operational. One anchor delivers a member; multi-member sessions need explicit bindings, not overloaded scalar itemId. Cardinality/relations remain implementation follow-up.

| Association | Migration requirement |
| --- | --- |
| Assignment/Submission | Keep responses/grading/targeting/SMS; exact activity/anchor mapping and Today deduplication |
| Homework/Submission | Preserve due dates/question-rubric history/offline/reporting/idempotency; quarantine ambiguous mutable bodies |
| TeacherLessonAssignment | Preserve date/null-date semantics, teacher/class scope and edited-revision approval/source ID |
| TimetableAssignment/Timetable | Converge content attachment only; retain recurring calendar/date/title/instructions |
| CurriculumUnit/Week/LessonPlan | Keep planning distinct from delivery; resolve exact members |
| VirtualLab arrays/suggestedLabs/LabSession | Suggestions authoring-only; exact governed certified delivery link; sessions remain state |
| Exam/Assessment deployment | Preserve school publication/results/integrity; pin definitions/sections/anchor |
| CapstoneProject/other soft associations | Preserve artifacts/history; map reviewed briefs explicitly |
| TeacherAssignment/roster | Keep teacher-class-subject allocation; not content delivery |

Phases: 0 inventory readers/writers/identity/tenant/historical ambiguity and review runbook/advisor plan; 1 additive nullable links/mappings plus shadow resolver; 2 audited restartable backfill of provable pins, quarantine unresolved rows, no latest guesses; 3 new governed writes require pins, dual-read precedence/deduplication/telemetry, dual-write only with designed consistency; 4 reader switch after parity/enrollment/revocation/rollback proof; 5 stop legacy new writes after at least one MINOR compatibility period where feasible; 6 separately authorized cleanup after usage/retention evidence. Old attempts retain original identity; unresolved history stays explicitly legacy. No table deletion authorized.

## 7. Lab and toolkit authority

Two lab paths: governed lesson LearningExperienceLink, and teacher scheduling triggerStandardCodes/suggestedLabs (`app/api/teacher/schedule/route.ts`). Bundle labs reference only exact approved governed links/equivalent bindings. Standard/title matching remains authoring assistance and grants no learner access/evidence authority. VirtualLab survives as practical runtime source; LabSession remains state.

Execution requires approved lesson/release/link, exact objective/prerequisite/check/evidence mapping, real release identity, exact definition/runtime, renderer/assets/accessibility/offline certification, certified student version and tenant/enrollment/deployment. Approval labels alone are insufficient. Certified registry is empty at this base. Showcase identity/access remains entirely separate; no showcase observations promoted to canonical evidence. First vertical excludes labs. Required uncertified labs block execution unless a separately reviewed objective-preserving fallback satisfies release requirements.

Toolkit authority is reviewed policy, not UI context/defaultOpen/usage logs. Pin semantic-to-runtime map/registry/config/policy versions. `templateCell.ts::CertificationInput.releaseToolKeyMap` anticipates mapping, not universal runtime enforcement. fraction_strips -> fraction-visualizer requires pedagogical equivalence review; calculator must map explicit basic/scientific IDs or reviewed prohibition group. Preserve old policy identities. Registry/context/flags/policy/accommodations intersect; prohibition wins. Required unavailable tool needs reviewed fallback or blocked state. No scripts, keys or client overrides in config.

## 8. Factory disposition and guardrails

| Generator | Disposition | Guardrails before governed reuse |
| --- | --- | --- |
| factoryExpansion | ADAPT seeds; REPLACE approval-like behavior | Remove self-approved pseudo-labs/ready authority; verified objectives/canonical revisions; private keys; candidate-only output |
| nationalFactory | ADAPT orchestration/coverage/cost controls | V2 candidate/provenance protocol; SUBMITTED is not APPROVED; generated totals/status strings not release coverage |
| V2 pipeline/compat/migration | REUSE draft boundary; ADAPT component coverage | Reject authority injection; tracked revisions; preserve omissions; conversion never inherits approval |
| generationEngine/NR12/NR13/legacy AI lessons | ADAPT pedagogical helpers | Source/objective pins, teacher/learner prose split, variant review and prompt/provider/schema metadata |
| unitAssembler/generate-full-pack | REPLACE inline generation approval; ADAPT sequence planning | Remove role/school/admin generation approval; exact revision substantive qualified review; typed composition |
| Generic assessment/mastery helpers | REPLACE | No always-A/Correct answer placeholders; reviewed key/rubric/objective/item versions |
| Assignment drafts/homework rubrics | ADAPT; REUSE assistant draft boundary | Common candidate definition, class/tenant/content eligibility, rubric review |
| examGenerator | ADAPT | Key correctness review beyond structural validation, frozen item order, separate school publish, allowlisted DTO |
| lessonQuiz/adaptive/WAEC ensureBank | ADAPT candidate generation; REPLACE governed direct serving | Sealing/moderation not approval; reviewed release items only; canonical admission separate |
| labSimulation/pseudo-lab/3D stubs | REPLACE approval-like flags; ADAPT practical recipes | Real runtime/check/link/certification gates; honest practical vs executable lab labels |
| Media/textbook compiler/queue | ADAPT derived production | Exact source/rights/accessibility/audience; no answer-bearing learner prose; output status not approval |
| staleGradeReleaser | REPLACE automatic authority promotion | AI suggestion remains advisory; 72-hour timeout not teacher grade/mastery authority |
| National expansion/uncertified labs/unsupported scorers | DEFER | Reviewed vertical/certification/scoring gates first |

Do not overstate findings: nationalFactory does not itself APPROVE. Expansion --publish is misleading, but enabled maintenance writers downgrade to draft/submission and nonauthoritative repository writer rejects published when writers are off; not a demonstrated direct bypass at this SHA.

Shared prerequisites: trusted source/right/scope context, strict bounded candidate schema, immutable revision/hash/generator metadata, cost/idempotency/audit controls, independent qualified human exact-revision key/content/rubric review, registry validation, common safe preview/export, lifecycle/revocation checks and separation of generation/release. Reuse existing writers, never factory-specific approval ledgers.

## 9. Textbook and offline decisions

Direction locked: ContentBundle -> Student Textbook -> Workbook -> Teacher Guide -> Assessment Book -> Print/PDF/offline variants. Renderings are sibling audience/section outputs from the same approved dependencies, not an approval chain. Student text is instruction, workbook tasks/workspace, teacher guide staff pedagogy/private keys, assessment book learner forms with separate protected staff keys. Pin source/item/asset/release/bundle identities, section order, compiler/projection version, audience, output digest, rights and expiry.

Teacher-only keys/scoring guides/resources and policy-restricted explanations NEVER enter learner DTO/PDF/textbook/workbook/media scripts/offline packages. Approved local formative feedback is separate and cannot be reused for secure assessment. Use allowlists and reviewed prose separation; a field denylist cannot remove Markdown answers. Staff artifacts need separate asset closure/storage/cache partition and staff/tenant authorization.

Current textbookCompiler/PDF streams/renders payload.answerKey; only student format has substantive content, other formats return empty results. GENERATED job status does not prove workbook/guide/book support. Retain job/compiler seam, replace source selection/projection and latest-row/heuristic fallback.

Offline invariant: ONE package identifies ONE bundleId/version/hash/release identity and exact member/definition/item versions/assets. Weekly transport may contain multiple independently pinned packages, never an unpinned mixed lesson ZIP labelled one governed bundle. Learner/teacher signed manifests and closures are separate. Include protocol/projection version, capabilities, expiry/min-client/revocation sequence, byte budget/fallbacks and reconnect policy. Reject corrupt/incomplete/stale/wrong-audience/expired packages; atomically activate validated closure. Required asset failure blocks readiness, not silent omission.

Queue scoped responses/observations with pinned session/deployment and idempotency, not canonical scores/mastery. Server reauthorizes and rescores/admit-once on reconnect. Explicit stale/conflict/revocation disposition; never remap to latest. Secure offline summative scoring deferred. Reuse signed cache/availability/sync protections; version protocol and support previous protocol for one MINOR where feasible.

## 10. Three inference verifications

| Inference | Result | Exact readers/evidence | Limits/consequence |
| --- | --- | --- | --- |
| A Progress uses old sources for governed learners | VERIFIED | app/student/progress/page.tsx -> components/student/StudentProgressDashboard.tsx fetches BOTH /api/student/progress and /api/adaptive/mastery. Adaptive GET reads prisma.adaptiveMasteryRecord by Student.id without governed selection. Progress GET invokes lib/student/progressSummary.ts and learningIntelligence.ts: ScheduledWork, StudentProgress (User.id), AssessmentAttempt source student.lesson.quiz.submit, DerivedStudentProgress; intelligence also misconceptionTag/interventionRecommendation. Badge/readiness builders read StudentMasteryProfile/progress/exam attempts. No canonical SLM/orchestrator branch in these readers | Static code proof, not live data. Governed mastery/next action must use canonical replay/decisions; completion remains operational; ordinary schoolwork keeps labelled legacy analytics |
| B Weekly pack can mix lesson versions | VERIFIED | lib/packs/generatePack.ts reads date/status ScheduledWork payloads, edit-approved TeacherLessonAssignment and school-wide content in separate queries; no revision/version/release selection or common composition pin. Manifest/folders use contentId. Audio takes latest GENERATED by generatedAt, not content revision | Possibility verified, no hosted mixed pack claimed. Different lesson versions are valid if explicitly pinned; defect is missing exact composition/item manifest and contentId dedupe/overwrite ambiguity, not proof ZIP preserves two same-ID revisions |
| C Toolkit identifiers/configuration differ | VERIFIED | governedGrade4Math policies: fraction_strips/number_line/calculator and INSTRUCTION/PRACTICE/DIAGNOSTIC/CONTROLLED_ASSESSMENT. toolRegistry: fraction-visualizer/number-line/basic-calculator/scientific-calculator, lesson/practice/assessment/lab plus grade/subject/strand/flags. curriculum/v2/tools.ts validates runtime IDs/context/bans/accommodations. templateCell.ts releaseToolKeyMap is explicit certification mapping seam | Existing seam means difference is not proof every delivery fails; mapping/config/context must be reviewed/versioned, no spelling normalization |

Offline details verified: generatePack student stripStudentKeys is recursive denylist for answerKey/correctAnswer/correctIndex/teacherNotes/presenterNotes/scoringRubric/modelAnswer. It misses expectedAnswer/teacherGuide/native formativeKey.expectedOptionId and prose. No class filter when pack.classId absent; request scope needs enforcement. ZIP has no per-item version/hash/signed bundle manifest. Separately content-availability-manifest hashes content/version/data, validates signatures/sequence/expiry/min-client; lesson-offline-cache checks metadata.version/hash/complete pack/manifest sequence, with weaker legacy compatibility; syncProtocol carries contentVersion/contentHash/manifestSequence. These stronger per-lesson protections do not prove weekly ZIP safety.

## 11. First governed vertical: Grade 4 Math — Fractions

First objective `moe-math-g4-s1-p3-number-theory-and-fraction-obj4` (parts of a set), starting concept `g4-fractions-equal-parts`. Current release `lr-moe-g4-math-fractions-2026.1`, founder-reviewed/MOE NOT_CLAIMED; lesson `ll-g4-math-fractions-equal-parts-2026.1` version `1.0.0`. Proposed bundle ID g4-math-fractions; version/hash only after reviewed dependencies. NO LAB in initial scope.

| Chain piece | Existing | Missing/minimum future work |
| --- | --- | --- |
| Objective | Structured source/objective/cell/release constructs | Verify source/version/rights and explicit parts-of-set alignment; whole-only diagnostic insufficient |
| Approved lesson | Registered binding; V2 review/resolver | Confirm real stored approved exact revision/hash; 2026.1 binding lacks payload hash |
| Practice/formative check | Three published MCQs/local formative scenes; 2026.2 candidate set/whole material | Review set-specific practice/feedback; retain bottle-cap/set modality where required; candidate not released |
| Assessment | Governed key/admission/handoff | Independent withheld reviewed set item/definition, frozen session/order, Player V2 and safe disclosure |
| Evidence | admitEvidence/conversion/adapters | Exact activity/deployment/item/policy mapping and replay; supported single-choice only initially |
| Mastery/SLM | masteryWriter/LearningEvent canonical replay/studentLearningModel | Real persistence/replay; update does not automatically certify mastery |
| Orchestrator/next lesson | Persisted DecisionModel/store/orchestrator/prerequisites | Actual reviewed successor objective/lesson (equivalence only after authoritative mapping); only one current lesson binding |
| Delivery | Lesson resolver/enrollment/scheduling seams | Waves 1–6 exact contracts/projections/pins/session and governed Progress |

Final proof: governed objective -> exact approved set-specific lesson -> reviewed practice -> formative check -> independent assessment -> server-admitted evidence -> canonical mastery update/replay -> SLM -> persisted Learning Orchestrator decision -> real reviewed next lesson. 2026.2 is review input only; never mutate 2026.1 or register candidate by convenience. Until reviewed next content exists return NO_VALID_RESOURCE.

Validation: correct/wrong answers, insufficient/assisted evidence, prerequisite/confidence/independence/retention gates, duplicate submit/sync produces one event, altered order/item/client score denied, stale revision/release/decision blocked, tenant/enrollment denied correctly, revocation start/resume/submit policy, no private keys in learner projections, Progress matches canonical replay, real next lesson resolves. Online final proof precedes Wave 8; offline operational proof follows packaging.

Must NOT be mocked in final operational proof: source/reviewer/exact revision approval, release registry/identity, reviewed key correctness, server scoring/admission, actual canonical persistence/replay, SLM/DecisionModel/orchestrator, tenant/enrollment and reviewed next lesson. Local mocked/pure tests do not establish hosted readiness. Environment access/review/publication requires future authorization; none attempted here.

## 12. Implementation waves and governance gates

Keep requested order. Draft contracts may overlap but executable delivery cannot skip gates. Wave 9 guardrails apply to any generator used earlier; Wave 9 scales/integrates them, not delays safety.

P = Prisma migration; R = applicable migration runbook; A = human advisor escalation; H = separately authorized hosted data migration/change; C = compatibility; D = destructive cleanup; Q = curriculum review. Conditional gates apply only when storage/authority changes, not pure contracts.

| Wave | Deliverable/acceptance gate | Dependencies | P | R | A | H | C | D | Q |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | TS bundle contract/pure validator/deterministic hash/gap fixture; reject unresolved/cyclic/stale refs | Existing release/revision contracts | No | No | If authority conflict | No | Contract version | No | Reviewed mapping/fixture, not draft types |
| 2 | Read-only audience resolver/teacher learner preview; exact safe refs/tenant/revocation | 1 + lesson resolver | No | No | If authority changes | No | DTO compatibility | No | Approved refs/variants |
| 3 | ActivityDefinition contract/candidate review/adapters for six kinds | 1; executable views use 2 | Conditional storage | If P | If P/authority | Later backfill if needed | Legacy bodies | No | Definitions/rubrics |
| 4 | Item/AssessmentDefinition/session contract, bank/key/order migration design | 1/3 + current admission | Conditional storage | If P | Scoring/authority review | Later bank migration | Item/session history | No | Keys/items/policies |
| 5 | Additive ScheduledWork pins/mappings/shadow/backfill/dual-read parity/rollback | 1–4/cardinality design | Yes | Yes | Yes | Later authorized backfill | Yes | No | Approved content pins |
| 6 | Assessment Player V2, server sessions/scoring/admission/feedback/replay | 2/4/5; 3 activities | Conditional session storage | If P | Authority/scorer changes | Conditional | Old sessions/attempts | No | Policies/items/scorers |
| 7 | Real Grade 4 fractions vertical, canonical Progress and next lesson | 1–6 plus real review/source/persistence | Conditional gaps | If P | Release/authority gates | Authorized operational changes, not necessarily bulk migration | Old release retained | No | Mandatory exact-revision review |
| 8 | Signed separate offline bundle closure/cache/reconnect/revocation | 1–7 safe projections/evidence + sync | Conditional metadata | If P | Protocol/authority gates | Conditional pack/state migration | Previous protocol window | No | Offline rights/capability/feedback |
| 9 | Guarded candidate-only factory adapters/batches/cost/audit/coverage gaps | 1/3/4 + proven 7; 8 for offline claims | Conditional batch storage | If P | Approval boundary changes | Conditional candidate storage | Factory callers | No | Candidate review before release |
| 10 | Four safe renderings/PDF/print/offline, separate keys and dependency manifests | 1–4/7; 8 offline; 9 optional authoring | Conditional job metadata | If P | Schema/authority conflicts | Conditional regeneration/mapping | Export/cache consumers | No | Sources/section plans/staff keys |

Before schema implementation load the applicable docs/ops runbook and ADVISOR_ESCALATION_CONTRACT. P2A_STAGING_MIGRATION_RUNBOOK exists but applicability to new bundle schema must be established, not assumed. Require additive plan, referential-integrity/cardinality decisions, backup/rollback, reconciliation/telemetry and recorded human decision. Hosted changes need separate authorization. Destructive cleanup is a separate future project after adoption/compatibility/retention proof with advisor/backup/rollback gates; no wave authorizes deletion here. Qualified human scope-matched review is exact-revision; founder/platform authority cannot be relabelled MOE approval.

## 13. Readiness scores

Repository implementation judgments, not deployed coverage. 9/10 requires demonstrated coherent governed operation and safe supported workflows with only bounded noncritical gaps. Overall factory score is bottleneck-based, not an average.

| Area | Score /10 | Strength | Blocks 9/10 |
| --- | --- | --- | --- |
| Lesson content | 7 | Native V2 authoring/review/delivery/accessibility | Narrow release scope, objective/next lesson coverage, teacher preview and mutable legacy readers |
| Activity content | 3 | Embedded tasks and real deployment/state | No common governed reusable definition/version; group/rubric/modality adapters |
| Assessment architecture | 4 | Governed single-choice/server admission/sessions | Fragmented banks, unreviewed generated items, explanation leakage, order/review gaps, no Player V2 |
| Lab integration | 3 | Versioned kernels/links/evidence seams | Empty certification, provisional mappings, suggestion ambiguity |
| Classroom delivery | 5 | Rich ScheduledWork/enrollment/tracking | Fragmented attachments, no exact pins, cardinality/teacher parity |
| Offline | 5 | Signed per-lesson cache/hash/sequence/expiry/sync | ZIP denylist/unpinned sources/audio, closure/tenant/audience/reconnect gaps |
| Textbook generation | 2 | Compiler/PDF/jobs | Student key leakage, mutable fallback, empty nonstudent formats, no dependency manifest |
| Governance | 7 | Immutable provenance/qualified native review/registry/canonical state | Legacy role/AI-timeout approval, weak item lineage/export bypasses; hosted enforcement unverified |
| Content Factory readiness | 4 | Candidate-only V2 and reusable governed chain | No complete bundle/activity/item/delivery/output convergence or real complete vertical; unsafe legacy generators |

## 14. Unresolved decisions and handoff

Locked: composition-only bundle, exact pins, shared ActivityDefinition, one conceptual item/assessment authority, ScheduledWork future anchor, governed certified lab links, candidate-only factories, separate staff/learner outputs and no first-vertical lab.

Follow-up: durable composition/member/item storage and ScheduledWork cardinality/lesson-FK transition; structured/DB objective identity mapping; reviewed toolkit semantic/config mapping; bank ID/order/history/retry migration; summative/rubric/unsupported-scoring admission; group/milestone persistence; real reviewed parts-of-set assessment/successor lesson; package expiry/revocation/retention/stale reconnect policy; authorized operational environment and stored source/reviewer/revision evidence; corrected reviewed release version. None allows latest-reference guesses or fabricated approval.

This mission explicitly authorizes architectural reconciliation. Future production-used schema, hosted mutation, unresolved authority conflict, compatibility break or destructive action requires its recorded human/advisor decision. No such action taken here.

## 15. Validation

Exact-base HEAD checked; targeted source traces verify all three inferences, pack/hash/cache/sync distinctions, toolkit mapping, assessment/ScheduledWork schema, lab certification and release/lesson identity. Audit hashes/blob equality, local Markdown links, required decision coverage and git whitespace/scope checks performed. Documentation only: no application tests/full build/Prisma/hosted validation needed or claimed. Prior audit tests remain attributed to that audit and were not rerun.

Files added: this decision and both unchanged input audits. Handoff: review decision, then scope Wave 1 contract implementation and subsequent named gates. No PR opened.
