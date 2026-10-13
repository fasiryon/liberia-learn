# Content Architecture V1 — Product + Delivery Surface Audit

Status: AUDIT / PROPOSAL. Not a schema, not an authority change, not a release.
Base: `main` @ `f22ccb7bbfb8b7f57ab6ebd3ff7b7ae2f2e445f1` (Merge PR #183, Lesson Experience V2 authority + runtime).
Scope: product/delivery perspective only. No Prisma, no deployment, no hosted data, no curriculum publication.

This audit asks one question:

> What does every LiberiaLearn surface need to know about a governed unit of
> learning without reaching into unrelated tables?

Every claim below cites the file it was read from on the base SHA. Where a
behaviour was inferred rather than traced end to end it is marked *(inferred)*.

---

## 0. Executive summary

LiberiaLearn already has the **parts** of a governed content bundle, but they
live in four disconnected places:

1. **Executable authority** — `CurriculumOntologyRelease`
   (`lib/learning-authority/governedGrade4Math.ts`): concepts, prerequisites,
   governed items, construct bindings, content bindings
   (`LESSON | TEXTBOOK | LAB | SIMULATION`), evidence policies, tool policies,
   deterministic identity. Only one is published (`publishedReleases.ts`:
   Grade 4 Math).
2. **Authored lesson artifact** — `CurriculumLessonV2`
   (`lib/curriculum/v2/contract.ts`): identity, objectives, prerequisites,
   misconceptions, scenes, assessment handoffs, lab links, provenance,
   governance (`DRAFT` only), review gaps. Stored inside
   `CurriculumContent.payload.curriculumV2`.
3. **Learner delivery projection** — `LessonExperienceDelivery`
   (`lib/lessons/lessonExperienceDelivery.ts`, contract
   `lesson-experience-delivery/1.1.0`): exact-revision, release-pinned,
   keyless formative, authorized lab links, assessment refs, offline policy,
   provenance.
4. **Classroom operation** — at least **six** independent tables that each
   "attach content to a class": `ScheduledWork`, `TeacherLessonAssignment`,
   `TimetableAssignment`, `CurriculumLessonPlan`, `Assignment`, `Homework`
   (+ `Exam`, `VirtualLab`/`LabSession`, `CapstoneProject`, `OfflinePack`).

The lesson is the only content type that flows through 1 → 2 → 3. Every other
learning object (classwork, homework, quiz, exam, project, lab, textbook,
offline pack) is either free text on a classroom table, AI-generated at request
time, or a separate registry with its own identity. **The ContentBundle should
be the version-pinned envelope that joins (1) and (2) for a unit/objective
cluster, and the single thing classroom tables (4) reference.**

---

## 1. Learner content surface inventory

Primary IA (`lib/learner-experience/studentNavigation.ts`): **Today · Learn ·
Labs · Progress · Help**. Every legacy route is mapped into one of the five.

| Surface | Route / source | Content object consumed | Identity / version | Authority expected | Learner state needed | Evidence emitted | Offline | Known gaps |
|---|---|---|---|---|---|---|---|---|
| **Today** | `app/student/today` → `components/student/TodayV2.tsx` → `GET /api/student/today` | `ScheduledWork` + `Assignment` rows joined to `CurriculumContent` | `contentId` only (no version, no release) | `status ∈ {published, APPROVED}`; `learnerExperienceAuthority()` picks `GOVERNED` (orchestrator) vs `ORDINARY_SCHOOLWORK` by grade/subject release lookup | enrollment scope, timetable, `StudentProgress.completedAt`, assignment submission state | none directly (navigates) | none (online read model, Redis cached) | No `Homework`, `Exam`, `TeacherLessonAssignment` or `TimetableAssignment` items; `quizHref` is a hash into the lesson page; `lab` comes from `getLessonLabLinks()` which now always returns `[]` (correct fail-closed, but means Today never shows a lab) |
| **Learn** | `app/student/learn` → `LearnV2` → `GET /api/student/learn` → `lib/student/learnDiscovery.server.ts` | `CurriculumContent` via `listAuthorizedLearnerContent`, scheduled work, assignments, checks (`checkDiscovery.server.ts`), unit sequence | `contentId`; unit derived via `deriveUnitName` / `CurriculumContent.unitId` soft link | `learnerVisibilityWhere` / `learnerScopeAllows` (`lib/curriculum/learnerEligibility.ts`) | scope (school, classes), progress | none | none | Unit is a soft string link (`unitId`), two unit models exist (`Unit`, `CurriculumUnit`) and neither is release-bound |
| **Lesson Experience V2** | `/student/lessons/[id]` (`LessonDeliveryClient`, 1.5k lines) and `/student/lesson/[contentId]` (`LessonViewerClient`) → `GET /api/student/lessons/:id/experience` | `LessonExperienceDelivery` (native) or `legacyPayload` (`projectStudentLessonPayload`) | `lessonId`, `lessonVersion`, `releaseId`, `releaseIdentity`, `revisionId` | Native: approved provenance + exact revision hash + native approval event + published release + content binding sha256 + inventory objective/concept match. Legacy: status + lifecycle | `serverCompletion`, cached delivery identity | `OBSERVATION_ONLY` via existing governed evidence adapter; no mastery mutation; `submissionEndpoint: null` | `READ_ONLY_AFTER_AUTHORIZED_CACHE`; `reauthorizeOnReconnect`; `purgeOnAccessLoss`; version mismatch → `INCOMPATIBLE_VERSION` | Two lesson routes with different legacy fallbacks (`/api/student/work/:id` vs `/api/curriculum/:id`) and different completion endpoints (`/lessons/:id/complete` vs `/teacher-lessons/:id/complete`) |
| **Lesson quiz** (legacy) | `POST /api/student/lessons/:id/quiz` + `/quiz/submit` | Quiz **generated by AI at request time** (`generateLessonQuiz`) from lesson body + `lessonQuizQuestions`; sealed session (`lib/grading/lessonQuizSession.ts`) | `assessmentVersion: "sprint11.lesson_quiz.v1"` (generator version, not item version) | none on items — items are not governed | scheduled lesson context | quiz attempt (server-sealed) | `offline-quiz-attempts.ts` queue | Parallel assessment representation to V2 `ASSESSMENT_HANDOFF` governed items |
| **Labs** | `app/student/labs`, `/labs/[labId]`, 12 hard-coded legacy pages, `/interactive-labs/[labId]` | `LabExperience` (`lib/learner-experience/labExperience.ts`) adapted from three runtimes: `LEGACY_SIMULATION` (`lib/labs/*`, 12), `PRACTICAL_GUIDED` (`VirtualLab` DB rows), `INTERACTIVE_V2` (`lib/interactive-labs/v2/definitions`: circuit, hydropower, lever, solids) | `labId` + `version` | `CERTIFIED_STUDENT_LAB_VERSIONS` (empty on main) + `LearningExperienceLink` status `APPROVED`; showcase labs via `lib/student/showcaseLabs.ts` | lab session, grade band | `LAB_OBSERVATION`, mapped to objectives through `link.evidenceMapping` (lab never writes mastery) | per-lab degradation `HIGH→…→FALLBACK_2D→STATIC_TEACHER_GUIDED`, `maxPackageBytes` | Three runtimes, three identities; `VirtualLab` has its own `moeStandardCodes`/`primaryContentIds` not tied to a release |
| **Progress** | `app/student/progress` → `StudentProgressDashboard` → `/api/student/progress` + `/api/adaptive/mastery` | progress summary, learning intelligence, badges, exam readiness; `AdaptiveMasteryRecord` | none content-versioned | none release-aware *(inferred from route imports)* | all learner history | none | none | For governed learners, Today's next action comes from the Learning Orchestrator while Progress reads legacy adaptive mastery → two sources of truth on one learner |
| **Help** | `/student/ai-tutor`, `StudentLessonHelpPanel`, `StuckHelper` | tutor context (`lib/ai/tutor/contextContract.ts`: `lessonId`, `contentId`, `releaseId` optional) | optional ids | tutor is advisory | lesson context | tutor conversation, help flag | none | Tutor context is not bound to the bundle's misconceptions / remediation, so help cannot cite the authored response |
| **Classes / Schedule** | `app/student/classes`, `/schedule` → `lib/student/classes.server.ts`, `scheduleReadModel.ts` | class roster, timetable, scheduled work | `classId`, `contentId` | enrollment read model | enrollment | none | none | Schedule shows slots, not bundle position (which lesson of which unit) |
| **Assignments** | `/student/assignments`, `/assignments/[id]` | `Assignment` (`title`, `description`, `contentId?`, `moeStandardCodes[]`) + targeting (`lib/assignments/targeting.ts`) | assignment id; content link optional | none on assignment content | submission state | `AssignmentSubmission`; offline `assignment.submit` (`REQUIRES_CONFLICT_REVIEW`) | draft queue `LAST_WRITER_SAFE` | Assignment body is free text; AI-generated "classwork / homework / quiz" all land here (`/api/teacher/assignments/generate` `validTypes`) |
| **Homework** | `/student/homework`, `/homework/[id]` → `/api/homework/:id` | `Homework` (`instructions`, `questions Json`, `rubricJson`, `contentId?`) | homework id | none | submission | `HomeworkSubmission`; offline `homework.submit` (`REQUIRES_CONFLICT_REVIEW`) via `submitWithQueue` | queued submission | `POST /api/homework/create` sets **no** `contentId`/standards; homework is invisible to Today |
| **Exams** | `/student/exams`, `/exams/[examId]` | `Exam` + `ExamQuestion` (`prompt`, `options`, `correctIndex`, `moeCode`) — often AI-generated (`/api/admin/exams/generate`) | exam id; no item version | `status: PUBLISHED`; keys stripped on read (`stripQuestionAnswers`) | attempt | `ExamAttempt` | none | Third item representation (after governed items and lesson-quiz items) |
| **Practice / checks** | `/api/student/practice/generate`, `checkDiscovery.server.ts`, `/student/waec/*` (`WaecPracticeItem`), `/student/adaptive` | generated practice, `PracticeItem`, `WaecPracticeItem`, governed `PRACTICE` items in the release | mixed | governed items only in release | mastery/diagnostic | `PRACTICE`, `DIAGNOSTIC` | partial | Four practice item stores |
| **Projects** | `/student/capstone` → `CapstoneProject` | student-created project (title, description, files) | project id | teacher review only | portfolio | none governed (`PROJECT` evidence type exists but no producer) | none | No teacher-authored project brief, rubric, or objective binding |
| **Textbooks** | `/student/textbooks` | **Lists lessons** (`contentType ∈ lesson, unit_plan, term_plan, full_pack`) grouped by subject | `contentId` | learner eligibility | none | none | none | Not a textbook; generated PDFs (`TextbookGenerationJob`, keyed grade/subject/format/version) are not surfaced and not release-bound |
| **Offline** | `/student/offline-lessons`, `/offline-status`, `/packs` | `lesson-offline-cache.ts` (signed availability manifest, 50 lessons), `OfflinePack` weekly zip (`lib/packs/generatePack.ts`, `stripStudentKeys`) | `contentId` + `version` + manifest hash; pack keyed by week/class | signed manifest TTL 7d (`content-availability-manifest.ts`) | partition per learner session | queued ops (`lib/offline/syncProtocol.ts`) | — | Pack = week of lessons; no unit/bundle package, no asset closure for labs/media |
| **Media** | `LessonAudio` (per `contentVersion`), `LessonVideo` (teacher upload, approval), `heroImageUrl`, `inlineIllustrations`, V2 `SceneMedia` | lesson-scoped | audio pinned to version; video not | video approval workflow | watch events | `VideoWatchEvent` | audio cacheable | Media identity scattered across columns, JSON and tables; only V2 scenes require `alt`/transcript |
| **Toolkit** | `lib/toolkit/toolRegistry.ts` (13 tools), server flags → `enabledToolIds` | scene `tools.allowed/prohibited`, release `ToolPolicy` per context | tool id | release tool policy (`accommodationOverrideRoles`) | accommodations | `toolUsageLog` on ScheduledWork | tools are local | Tool ids differ between registry (`fraction-visualizer`, `number-line`) and release policy (`fraction_strips`, `number_line`) — no shared vocabulary *(verify mapping before binding)* |

**Accessibility today.** V2 scenes carry `SceneAccessibility` (text alternative,
keyboard path, reduced-motion, captions) and required media `alt`; age bands
(`EARLY_PRIMARY…SENIOR_SECONDARY`) via `ageVariants`. Global modes:
`lib/accessibilityMode.ts`, `lib/lowBandwidthMode.ts`. Locales: `messages/en`,
`kpe`, `bss` (UI strings only — no content-language variants). `LessonVariant`
(`scaffold | simplified | enrichment`) is free text attached to
`CurriculumContent.id`, used by adaptive scaffolding, not governed.

---

## 2. Teacher content surface inventory

Current teacher IA (`components/teacher/TeacherNav.tsx`) is a flat list of 21
links. Product Design V2 (`docs/product-design-v2/PRODUCT_DESIGN_V2.md` §94–103)
targets **Command Center · Classes · Plan · Assess · Students · Reports**;
**Plan** and **Assess** do not exist on main as surfaces yet.

| Capability | Where it happens today | What it writes | Governance check at write time | Gap |
|---|---|---|---|---|
| Browse / preview lessons | `/teacher/lesson/[contentId]` → `/api/curriculum/:id` + `parseToSlides` | — | — | **Teachers cannot preview the V2 scene experience a student receives**; preview renders legacy body as slides. No teacher delivery seam (resolver is `STUDENT`-only). |
| Assign lesson to class | `POST /api/teacher/lessons/:id/assign` | `TeacherLessonAssignment` (unique contentId+classId) | `editReviewStatus` APPROVED (teacher-created content) | Read by `teacher-lessons` + packs + eligibility, **not by Today** |
| Schedule lesson | `POST /api/teacher/schedule` | `ScheduledWork` (+ A/B pairs, `suggestedLabs`, `AssignmentSuggestion`) | **No content status check at write**; student side filters later | Labs auto-suggested by `VirtualLab.triggerStandardCodes ∩ moeAlignments` — bypasses `LearningExperienceLink` governance |
| Timetable slot | `POST /api/teacher/timetable/:id/assign` | `TimetableAssignment` (title, instructions, optional content) | none | Fourth lesson→class binding; read only by `/api/student/work/:id` |
| Unit / week plan | `/api/teacher/curriculum/units`, `/lesson-plan`, `/lesson-plan/bind` | `CurriculumUnit` → `CurriculumWeek` → `CurriculumLessonPlan` | — | `CurriculumLessonPlan.curriculumContentId` is `@unique` → a lesson can live in only one plan, platform-wide |
| Classwork | `POST /api/teacher/assignments/generate` (`classwork | homework | quiz`) | `Assignment` | none on generated items | No first-class classwork; also flattened into lesson body by `studentLessonProjection.ts` (`## Classwork`) |
| Homework | `/teacher/homework/new` → `POST /api/homework/create` | `Homework` (title/description only) | class ownership | No content, objective, or standard link; rubric optional JSON |
| Exams | `/teacher/exams` → `/api/admin/exams/generate`, `/api/teacher/exams` | `Exam`, `ExamQuestion` | status lifecycle | Items not governed or reusable; `moeCode` string |
| Labs | `/teacher/labs`, `POST /api/teacher/schedule/:id/lab`, session review | `LabSession` (createMany per enrollee), `teacherFeedback` | `VirtualLab.status published` | Assigning a lab is a scheduled-work side effect, not a bundle binding |
| Differentiate | `/teacher/differentiation`, `/api/teacher/classes/:id/differentiation` | — | — | Not bound to authored remediation/enrichment |
| Grade / review | `/teacher/assignments/grading`, `gradebook`, `labs/sessions/:id`, `/api/grading/assist` | submissions, grades | AI assist is advisory | Rubrics live per row (`rubricJson`, `AssessmentItem.rubric`) |
| Reuse / fork / share | `/api/teacher/lessons/:id/{fork,share,versions}` | `CurriculumContent` fork (`derivedFromContentId`), `LessonShare`, `LessonVersion` | `editReviewStatus` | Fork copies payload; no bundle-level reuse |
| Export / print | `/api/teacher/assignments/:id/export`, `gradebook/export`, report-card print | CSV / print | — | No printable lesson, worksheet or assessment booklet from content |
| Offline (teacher) | `OfflinePack audience: "teacher"` | weekly zip | approved statuses | Teacher pack = lesson payloads; no teacher guide/answer key split by role |
| Toolkit | `PATCH /api/teacher/schedule/:id/tools` | `ScheduledWork.toolUsageLog` | none | Teacher tool override is not reconciled with release `ToolPolicy.accommodationOverrideRoles` |

**What a teacher must be able to do with one bundle** (requirements for the contract):

| Need | Bundle must expose |
|---|---|
| Preview | The same learner projection a student gets (per age band, per offline mode), plus teacher-only notes and answer keys |
| Assign | Stable `bundleId@version` + addressable members (`lessonId`, `activityId`, `assessmentId`, `labLinkId`) |
| Schedule | Suggested sequence, durations, A/B split points, prerequisites, required vs optional members |
| Adapt | Which fields are teacher-adaptable (instructions, due dates, item order, optional members) vs locked (objectives, governed items, keys) |
| Differentiate | Authored remediation / enrichment / accommodation variants keyed by objective |
| Assess | Governed item refs, rubrics, scoring authority, evidence type per activity |
| Review | Evidence mapping (what each activity's response means for which objective) |
| Reuse | Lineage (`derivedFrom`), school-scoped adaptations that never mutate the governed source |
| Export / print | Print-safe renderings: student section, workbook, teacher guide, assessment booklet |
| Work offline | Role-split package (learner vs teacher), with keys only in teacher package |

---

## 3. Product content flows

### Flow A — Today → lesson → practice → lab → lesson → assessment → completion → Progress

| Step | Working today | Missing handoff | Duplication | Dangerous inconsistency |
|---|---|---|---|---|
| Today → lesson | `TodayWorkItem.lessonHref = /student/lessons/{contentId}` | Today has no `releaseId`/`version`, so it cannot tell the player which version it promised | Two lesson routes | Today links by `contentId`; delivery may return `INCOMPATIBLE_VERSION` or `NOT_RELEASED` after the learner clicks |
| Lesson → practice | V2 `MULTIPLE_CHOICE` keyless formative (server feedback) | No practice set beyond in-scene items; legacy quiz is AI-generated | Governed items vs `generateLessonQuiz` vs `PracticeItem` vs WAEC items | Same objective can be "checked" by ungoverned generated items on the legacy path |
| Practice → lab | `LAB_LAUNCH` scene → `AuthorizedLabLink` with `returnTarget` / `launchContext` | Certified lab allowlist empty → scene degrades to `NONE/VIEWED` | 3 lab runtimes | Teacher-side `suggestedLabs` (standard-code match) can put a lab in front of a class that the lesson's governed link would not authorize |
| Lab → lesson | `returnTarget`, `authorizeLabReturn.ts` | — | — | — |
| Lesson → assessment | `ASSESSMENT_HANDOFF` resolves every item against the published release | Assessment Player V2 is a bounded collector; no unit assessment exists | `Exam`, `Assessment`, lesson quiz | — |
| → completion | `serverCompletion` from `StudentProgress`; three completion endpoints | No single "bundle member complete" notion | `/lessons/:id/complete`, `/teacher-lessons/:id/complete`, scheduled completion | Completion of the same content can be recorded via different paths with different eligibility |
| → Progress | Progress dashboard | Progress is not release-aware | `AdaptiveMasteryRecord` vs governed SLM/decision store | Governed learner sees orchestrator next action on Today and legacy mastery on Progress |

### Flow B — Teacher Plan → assign bundle → schedule → student Today → teacher review

| Step | Working | Missing | Duplication | Danger |
|---|---|---|---|---|
| Plan | `CurriculumUnit/Week/LessonPlan` | No bundle to plan from; Plan surface not built | `Unit` vs `CurriculumUnit` | `CurriculumLessonPlan.curriculumContentId @unique` blocks two schools planning the same lesson |
| Assign | `TeacherLessonAssignment` | Assign whole bundle / member set | 6 binding tables | — |
| Schedule | `ScheduledWork` | Version pin at schedule time | `TimetableAssignment` parallel | Scheduling writes don't check status; a revoked/unreleased lesson can be scheduled and silently disappear from Today |
| Student Today | reads `ScheduledWork` + `Assignment` | Reads `TeacherLessonAssignment`, `TimetableAssignment`, `Homework`, `Exam` | — | Teacher assigns via one path, student sees via another → "I assigned it, they don't see it" |
| Review | gradebook, lab session review, submissions | Review by objective across activities | per-table grading | — |

### Flow C — Objective → lesson sequence → classwork → homework → quiz → unit assessment

| Step | Working | Missing |
|---|---|---|
| Objective | `MoeCurriculumObjective`, `CurriculumLearningTarget`, release concepts/bindings, `ResolvedObjective` in V2 | One objective id vocabulary across MOE code, learning target code, concept id and V2 objective id |
| Lesson sequence | `orderInUnit`, `LessonPrerequisite`, unit sequence (`lib/student/unitSequence.ts`), release `prerequisites` (concept edges) | Sequence pinned to a release |
| Classwork | legacy payload `materials.classwork` flattened into text; generated `Assignment` | First-class activity with objective + evidence type `CLASSWORK` |
| Homework | `Homework` free text | Objective-bound homework activity, evidence type `HOMEWORK` |
| Quiz | V2 `ASSESSMENT_HANDOFF` (governed); legacy AI quiz | Reusable quiz object across lessons |
| Unit assessment | — | Does not exist. `Assessment.unitId` (legacy `Unit`) unused by V2; `Exam` is class-scoped and ungoverned |

### Flow D — Offline learner → cached bundle → read-only / in-progress → reconnect → governed submission

| Step | Working | Missing | Danger |
|---|---|---|---|
| Cache | Signed availability manifest, per-lesson cache with version/hash check, weekly `OfflinePack` zip, audio by `contentVersion` | Bundle-level manifest with asset closure (media, lab packages, tools) and byte budget | Pack zip is generated per week, not per version — two packs can contain different versions of the same lesson *(inferred)* |
| Read-only | `READ_ONLY_AFTER_AUTHORIZED_CACHE`, `purgeOnAccessLoss` | — | — |
| In progress | Queued ops with `contentId/contentVersion/contentHash/manifestSequence` (`syncProtocol.ts`) | `bundleId@version` on every op so the server can re-resolve the whole context | — |
| Reconnect | `deliveryTrustDisposition` → `INCOMPATIBLE_VERSION` | Learner-facing story for "your offline work belongs to an older version" | — |
| Submission | Per-resource write policies; `mastery_event` `NOT_SUPPORTED_OFFLINE` | Policy per bundle activity (which activities may be done offline and with what write policy) | Homework/assignment offline submit is conflict-review, but nothing tells the learner up front |

---

## 4. Product experience gaps

### BLOCKING (prevent a coherent governed unit from reaching learners/teachers)

| # | Gap | Evidence |
|---|---|---|
| B1 | **Classroom binding fragmentation** — six tables attach content to a class; Today reads two of them. | `ScheduledWork`, `TeacherLessonAssignment`, `TimetableAssignment`, `CurriculumLessonPlan`, `Assignment`, `Homework`; `app/api/student/today/route.ts` |
| B2 | **No version/release pin on any classroom binding.** All bind by `contentId` only; the governed delivery pins `lessonVersion + releaseIdentity + revisionId`. | schema models above vs `DeliveryIdentity` |
| B3 | **Teachers cannot preview what learners get.** No teacher projection of `LessonExperienceDelivery`; teacher preview uses `parseToSlides`. | `app/teacher/lesson/[contentId]`, `resolveLessonDelivery` rejects non-STUDENT |
| B4 | **Four ungoverned assessment/item stores beside the governed release items** (lesson-quiz AI generation, `ExamQuestion`, `PracticeItem`/`AssessmentItem`, `WaecPracticeItem`), and no unit assessment. | `api/student/lessons/[id]/quiz`, `Exam*`, legacy models |
| B5 | **Classwork, homework and projects are not first-class content**: free text on classroom rows, no objective/evidence binding, although `GovernedEvidenceType` already lists `CLASSWORK`, `HOMEWORK`, `PROJECT`, `PRACTICAL`. | `lib/learning-evidence/evidenceContract.ts`, `Homework`, `CapstoneProject` |

### IMPORTANT

| # | Gap |
|---|---|
| I1 | Lab binding has two authorities: governed `LearningExperienceLink` (lesson side) vs `VirtualLab.triggerStandardCodes` auto-suggest (teacher scheduling side). Three lab runtimes with separate identities. |
| I2 | Progress reads legacy `AdaptiveMasteryRecord` while Today uses the Learning Orchestrator for governed learners. |
| I3 | Teacher scheduling does not validate content status/lifecycle at write time. |
| I4 | Offline package is week-scoped, lesson-only; no bundle manifest with asset closure, byte budget, or role split (learner vs teacher keys). |
| I5 | Two lesson routes + three completion endpoints. |
| I6 | Unit identity duplicated (`Unit`, `CurriculumUnit`, `CurriculumContent.unitId` soft link, `CurriculumLessonV2.identity.unitId`); `CurriculumLessonPlan` uniqueness blocks cross-school planning. |
| I7 | Textbook surface lists lessons; generated textbooks (`TextbookGenerationJob`) are not release-bound or surfaced, despite `TEXTBOOK` being a release content-binding type. |
| I8 | Tool vocabulary mismatch between `toolRegistry.ts` ids and release `ToolPolicy` ids. |

### QUALITY

| # | Gap |
|---|---|
| Q1 | Media identity scattered (hero/inline JSON columns, `LessonAudio`, `LessonVideo`, scene media); only V2 enforces `alt`/transcript. |
| Q2 | `LessonVariant` remediation/enrichment is free text, not objective-keyed or reviewed. |
| Q3 | No content-language variants (Kpelle/Bassa exist for UI strings only). |
| Q4 | Help/tutor context not bound to authored misconceptions and responses. |
| Q5 | Today's `quizHref` is a page anchor rather than an assessment reference. |

### LATER

| # | Gap |
|---|---|
| L1 | Print/export of lesson, workbook, teacher guide, assessment booklet. |
| L2 | Group work / investigation modelling beyond single-learner submissions. |
| L3 | SMS delivery (`Assignment.smsEnabled`) mapped to bundle activities. |
| L4 | Cross-school reuse marketplace of adaptations. |

---

## 5. Proposed Product ContentBundle contract (conceptual, not schema)

A **ContentBundle** is one governed learning unit / objective cluster at one
version, pinned to one ontology release. It is **an envelope of references plus
the minimum product metadata surfaces need**. It does not copy authority it can
reference: items stay in the release, lessons stay `CurriculumLessonV2`, labs
stay `LabExperience`. Fields marked † are optional until a surface needs them.

```ts
type ContentBundle = Readonly<{
  contractVersion: "content-bundle/0.1.0";

  // IDENTITY
  identity: {
    bundleId: string; version: string;                 // immutable pair
    grade: number; subject: string;
    unit: { unitId: string; title: string; order: number };
    bundleIdentity: string;                            // deterministic hash of everything below (like deterministicReleaseIdentity)
  };

  // CURRICULUM (references the release; never re-declares it)
  curriculum: {
    releaseId: string; releaseIdentity: string;
    objectiveIds: string[];                             // V2 objective ids, each resolvable in the release inventory
    conceptIds: string[]; skillIds: string[]; standardCodes: string[];
    prerequisites: { conceptIds: string[]; bundleRefs: BundleRef[] };
    unlocks: BundleRef[];
  };

  // INSTRUCTION
  sequence: Array<{                                     // the ordered plan; every member is addressable
    memberId: string;
    kind: "LESSON" | "ACTIVITY" | "ASSESSMENT" | "LAB" | "PROJECT" | "RESOURCE";
    ref: MemberRef;                                     // see below
    requirement: "REQUIRED" | "RECOMMENDED" | "OPTIONAL";
    objectiveIds: string[];
    estimatedMinutes: number;
    dependsOn: string[];                                // memberIds
    deliveryMoment: "INSTRUCTION" | "CLASSWORK" | "HOMEWORK" | "PRACTICE" | "ASSESSMENT";
  }>;
  lessons: Array<{ lessonId: string; lessonVersion: string; contentSha256: string; revisionId: string }>;  // CurriculumLessonV2 refs

  // PRACTICE + PROJECTS (new first-class activity; replaces free-text classwork/homework bodies)
  activities: Array<{
    activityId: string; activityVersion: string;
    kind: "GUIDED_PRACTICE" | "INDEPENDENT_PRACTICE" | "CLASSWORK" | "HOMEWORK" | "PROJECT" | "INVESTIGATION" | "PRACTICAL_TASK";
    evidenceType: GovernedEvidenceType;                 // CLASSWORK | HOMEWORK | PRACTICE | PROJECT | PRACTICAL
    objectiveIds: string[];
    instructions: LocalizedText;                        // learner-facing
    itemRefs: ItemRef[];                                // governed release items only
    rubricRef?: string;                                 // † for open responses/projects
    grouping: "INDIVIDUAL" | "PAIR" | "GROUP";          // †
    offline: OfflineActivityPolicy;
    teacherAdaptable: Array<"instructions" | "dueDate" | "itemOrder" | "grouping">;
  }>;

  // ASSESSMENT (by reference; keys never leave the server/teacher view)
  assessments: Array<{
    assessmentId: string; assessmentVersion: string;
    kind: "CHECK" | "QUIZ" | "UNIT_ASSESSMENT" | "EXAM_SECTION";
    objectiveIds: string[]; itemRefs: ItemRef[];        // ItemRef = { itemId, itemVersion } resolvable in release.items
    scoring: "SERVER_AUTHORITY"; evidencePolicyId: string; toolPolicyId: string;
    rubricRefs: string[];
  }>;
  rubrics: Array<{ rubricId: string; version: string; criteria: Array<{ objectiveId: string; levels: string[] }> }>; // †

  // LABS (governed links only)
  labs: Array<{ linkId: string; labId: string; labVersion: string; runtime: LabRuntimeKind;
                requirement: "REQUIRED" | "RECOMMENDED" | "OPTIONAL"; placement: { lessonId: string; sceneId: string };
                evidenceMapping: LearningExperienceLink["evidenceMapping"]; fallback: "STATIC_TEACHER_GUIDED" | "PAPER_ACTIVITY" }>;

  // RESOURCES
  assets: Array<{ assetId: string; sha256: string; kind: MediaKind | "READING" | "TEACHER_RESOURCE";
                  bytes: number; alt: string; transcript?: string; captionsRef?: string;
                  audience: "LEARNER" | "TEACHER"; license: string; requirement: MediaRequirement }>;

  // TOOLKIT
  tools: { byContext: Record<"INSTRUCTION" | "PRACTICE" | "CONTROLLED_ASSESSMENT", { toolPolicyId: string }> }; // resolves to release ToolPolicy; registry ids must match

  // TEXTBOOK (renderings of the same members, never separately authored copies)
  textbook: {                                           // †
    studentSection: RenderingRef; workbookSection: RenderingRef;
    teacherGuideSection: RenderingRef; assessmentBookSection: RenderingRef;
  };

  // LEARNER SUPPORT
  support: {
    misconceptions: Array<{ id: string; objectiveId: string; response: string }>; // from CurriculumLessonV2
    remediation: Array<{ objectiveId: string; memberRefs: string[] }>;
    enrichment: Array<{ objectiveId: string; memberRefs: string[] }>;
    accommodations: Array<{ code: string; toolOverrides?: string[]; timeMultiplier?: number }>;
    languages: string[];                                // content languages actually reviewed (not UI locales)
    ageBands: AgeBand[];
  };

  // OFFLINE
  offline: {
    learnerPackage: { memberIds: string[]; assetIds: string[]; maxBytes: number };
    teacherPackage: { memberIds: string[]; assetIds: string[]; includesKeys: true };
    writes: Array<{ memberId: string; resourceType: OfflineResourceType; policy: OfflineWritePolicy }>;
    ttlDays: number;
  };

  // GOVERNANCE
  governance: {
    lifecycle: "DRAFT" | "IN_REVIEW" | "APPROVED" | "RELEASED" | "REVOKED";
    authority: CurriculumOntologyRelease["authority"];
    moeApprovalState: "NOT_CLAIMED" | "PENDING" | "APPROVED";
    approvals: Array<{ eventId: string; reviewAuthority: string; at: string }>;
    provenance: { sourceRefs: string[]; generator?: { name: string; version: string } };
    supersedes?: { bundleId: string; version: string };
  };
}>;
```

Fields intentionally **not** forced: per-scene detail (stays in
`CurriculumLessonV2`), item content and keys (stay in the release), learner
state (never in content), class/schedule data (lives on the binding row).

### Views (projections of the same bundle)

| View | Who | Includes | Excludes | Seam to reuse |
|---|---|---|---|---|
| **AUTHORING** | content factory, reviewers | everything, plus review gaps, provenance, draft members | — | `CurriculumLessonV2`, `validateReleaseManifest`, provenance workflow |
| **TEACHER** | teachers, school admins | identity, curriculum, sequence, all members with titles/objectives/durations, rubrics, answer keys, teacher assets, adaptable fields, learner preview per age band and offline mode | authoring internals (prompts, candidate hashes) | New teacher projection mirroring `resolveLessonDelivery` (role `TEACHER`, scope = own classes) |
| **LEARNER** | students | identity, members the learner is authorized for, keyless items, authorized lab links, learner assets, support variants for their accommodations/age band, completion state from server | keys, rubrics' scoring guides, teacher assets, unreleased members | `LessonExperienceDelivery` generalised to bundle members |
| **OFFLINE** | device cache | `offline.learnerPackage` closure, signed manifest with `bundleIdentity`, write policies | everything not in the package; keys | `content-availability-manifest`, `lesson-offline-cache`, `syncProtocol` (add `bundleId@version`) |
| **ASSESSMENT** | Assessment Player V2 + scoring authority | assessment members, item refs resolved in release, evidence + tool policy, rubric refs | lesson body | `AssessmentHandoff` / `ResolvedAssessmentHandoff`, `admitEvidence` |

### Classroom binding (the operational side)

Classroom tables should reference a bundle member rather than raw content:

```ts
type ClassroomBinding = { classId: string; bundleId: string; bundleVersion: string;
                          memberIds: string[]; deliveryMoment: string; scheduledFor?: string; dueAt?: string;
                          teacherAdaptation?: Record<string, unknown> /* only fields in teacherAdaptable */ };
```

Today, Learn, Schedule, Assignments and Homework then read **one** binding
shape, and every link the learner clicks already carries `bundleId@version`.

---

## 6. REUSE / ADAPT / REPLACE / DEFER

| Existing surface / contract | Decision | Why |
|---|---|---|
| `CurriculumOntologyRelease` + `validateOntologyRelease` + `deterministicReleaseIdentity` | **REUSE** | Already the executable authority for items, concepts, prerequisites, evidence and tool policies; bundle references it |
| `ReleaseManifest` / `validateReleaseManifest` / `k12-scope.json` | **REUSE** | Scope + coverage-gap reporting is exactly what bundle coverage needs |
| `CurriculumLessonV2` (authoring artifact) | **REUSE** | Lesson member of the bundle; already carries objectives, misconceptions, handoffs, lab links, provenance |
| `LessonExperience` / scene contract (`types.ts`, `sceneContract.ts`) | **REUSE** | Learner presentation, accessibility, offline per scene |
| `resolveLessonDelivery` / `LessonExperienceDelivery` | **ADAPT** | Generalise from "one lesson" to "bundle member"; add a TEACHER projection; carry `bundleIdentity` |
| `LearningExperienceLink` + `LabExperience` | **REUSE** | Governed lab binding with evidence mapping; bundle `labs[]` is a list of these |
| `AssessmentHandoff` (Assessment Player V2 seam) | **ADAPT** | Extend from in-lesson check to quiz / unit assessment members |
| Evidence adapter, `GovernedEvidenceType`, Learning Orchestrator | **REUSE** | Bundle activities declare evidence type; authority unchanged |
| `syncProtocol.ts` write policies + signed availability manifest | **ADAPT** | Add `bundleId@version` + asset closure; keep policies |
| `lesson-offline-cache.ts` | **ADAPT** | Cache by bundle package, keep version/hash checks |
| `OfflinePack` weekly zip | **ADAPT** | Build from bundle packages; split learner/teacher by role |
| Today read model (`/api/student/today`) | **ADAPT** | Read unified classroom bindings; keep fail-closed filters and authority mode |
| Learn discovery read model | **ADAPT** | Group by bundle/unit rather than soft `unitId` |
| `ScheduledWork` | **ADAPT** | Becomes the canonical classroom binding (already has period, delivery tracking, A/B pairing); add bundle/member/version pin |
| `TeacherLessonAssignment`, `TimetableAssignment` | **REPLACE** | Redundant lesson→class bindings; fold into the canonical binding |
| `Assignment` / `Homework` free-text bodies | **REPLACE** (body) / **ADAPT** (row) | Body comes from bundle `activities`; row keeps due date, targeting, submissions |
| Lesson quiz AI generation (`generateLessonQuiz`) | **REPLACE** for governed scope | Governed bundles use release items; keep only as ungoverned fallback outside released scope |
| `Exam` / `ExamQuestion` | **ADAPT → REPLACE** | Short-term: `EXAM_SECTION` members referencing governed items; long-term retire ungoverned questions |
| `Assessment` / `AssessmentItem` / `PracticeItem` / `Unit` / `Lesson` / `Standard` (legacy) | **DEFER** (then retire) | Not on the V2 path; do not extend |
| `CurriculumUnit` / `Week` / `LessonPlan` | **ADAPT** | Planning calendar referencing bundles; drop global `@unique` on content |
| `VirtualLab` auto-suggest by standard codes | **REPLACE** | Must go through governed links; `VirtualLab` rows survive as `PRACTICAL_GUIDED` runtime source |
| Legacy 12 lab pages / `lib/labs/*` | **DEFER** | Keep as `LEGACY_SIMULATION` runtime; certify individually |
| `CapstoneProject` | **ADAPT** | Keep student submission/portfolio; add bundle `PROJECT` activity as the brief + rubric |
| `/student/textbooks` page | **REPLACE** | Should render bundle `textbook` renderings, not a lesson list |
| `TextbookGenerationJob` | **ADAPT** | Key by `bundleIdentity` / release instead of grade/subject/format/"v1" |
| `LessonAudio` | **REUSE** | Already version-pinned; becomes a bundle asset |
| `LessonVideo`, hero/inline image columns | **ADAPT** | Register as bundle assets with alt/transcript/license |
| `LessonVariant` | **REPLACE** | Objective-keyed, reviewed `support.remediation/enrichment` |
| Toolkit registry + release `ToolPolicy` | **ADAPT** | Unify tool id vocabulary; bundle references policy ids |
| Teacher lesson preview (`parseToSlides`) | **REPLACE** | Teacher projection of learner delivery |
| Two student lesson routes | **ADAPT** | Converge on one route over one delivery seam |
| Progress (`AdaptiveMasteryRecord`) | **ADAPT** | Governed learners read the governed learning state; legacy elsewhere |
| Tutor context contract | **ADAPT** (QUALITY) | Pass `bundleId` + misconception refs |

---

## 7. Top blocking gaps (ranked)

1. **B1 + B2 — Fragmented, unpinned classroom bindings.** Six tables, all `contentId`-only, and Today reads two of them. No surface can promise a learner a specific governed version.
2. **B3 — No teacher preview of learner delivery.** Teachers assign what they cannot see; native V2 lessons show as parsed slides.
3. **B4 — Parallel ungoverned assessment stores and no unit assessment.** Governed release items are used only inside V2 lessons.
4. **B5 — Classwork / homework / projects lack a content model** even though the evidence vocabulary already expects them.
5. **I1 — Two lab binding authorities.** Governed links on the lesson side, standard-code auto-suggest on the teacher scheduling side (promote to blocking before any lab certification ships to students).

## 8. Strongest reuse opportunities

- `CurriculumOntologyRelease` already behaves like a bundle's **authority core**: items, concepts, prerequisites, content bindings (`LESSON | TEXTBOOK | LAB | SIMULATION`), evidence and tool policies, deterministic identity.
- `CurriculumLessonV2` + `LessonExperienceDelivery` are a complete authored → governed → learner projection pipeline for one member type; generalising that pipeline is cheaper than designing a new one.
- `LearningExperienceLink` is already a governed, versioned, evidence-mapped member binding: copy its shape for activities and assessments.
- `syncProtocol.ts` already carries `contentId/contentVersion/contentHash/manifestSequence` and per-resource write policies; adding `bundleId@version` is additive.
- `ScheduledWork` already has the richest classroom metadata (period, A/B pairing, delivery tracking, tool log), so it is the natural canonical binding.

## 9. Recommended implementation order

Each step is independently shippable and does not change existing authority.

1. **Contract only.** `lib/content/bundle/contract.ts` types + a pure `validateContentBundle` that resolves every ref against an existing published release and `CurriculumLessonV2` artifacts; plus `deterministicBundleIdentity`. Fixture: wrap the existing Grade 4 Math release (fractions) as bundle `g4-math-fractions@2026.x`. No DB. *(Gate: contract review.)*
2. **Read-only bundle projection.** A server resolver that returns LEARNER / TEACHER / ASSESSMENT views for the fixture, built on `resolveLessonDelivery` internals. Teacher preview page renders the learner view (closes B3).
3. **Canonical classroom binding.** Design (with migration runbook + advisor escalation) a bundle/member/version pin on `ScheduledWork`; Today/Learn read it; dual-read the legacy tables. Write-time lifecycle check on scheduling (I3).
4. **Activities.** First-class `CLASSWORK` / `HOMEWORK` / `PRACTICE` / `PROJECT` members referencing governed items; `Assignment`/`Homework` rows point at members (B5).
5. **Assessments.** `QUIZ` and `UNIT_ASSESSMENT` members via Assessment Player V2; stop generating quiz items inside governed scope (B4).
6. **Labs.** Retire `VirtualLab.triggerStandardCodes` auto-suggest in favour of bundle `labs[]` links; certify labs per version (I1).
7. **Offline bundle package.** Bundle manifest with asset closure, byte budget, learner/teacher split; queue ops carry `bundleId@version` (I4).
8. **Progress + Help alignment.** Governed learners read governed learning state; tutor receives bundle misconceptions (I2, Q4).
9. **Textbook renderings + print/export.** Generate student/workbook/teacher-guide/assessment-book renderings from bundle members; replace `/student/textbooks` (I7, L1).
10. **Retire** `TeacherLessonAssignment`, `TimetableAssignment` content binding, legacy `Assessment/PracticeItem/Unit/Lesson`, `LessonVariant` once read traffic has moved.

Steps 3, 4 and 7 require schema work and therefore the schema/migration route
(`docs/ops/` runbook + `docs/agents/ADVISOR_ESCALATION_CONTRACT.md`) before
implementation.

---

## Appendix — evidence index

| Area | Files read on base SHA |
|---|---|
| Authority | `lib/learning-authority/{governedGrade4Math,publishedReleases,releaseManifests,governedInventoryRuntime}.ts`, `docs/architecture/FULL_CURRICULUM_RELEASE_PIPELINE_V1.md` |
| Authoring | `lib/curriculum/v2/contract.ts` |
| Delivery | `lib/lessons/lessonExperienceDelivery.ts`, `lib/learner-experience/{types,links,labExperience,studentNavigation}.ts`, `lib/student/learnerExperienceAuthority.ts` |
| Student surfaces | `app/student/**/page.tsx`, `app/student/lessons/[id]/LessonDeliveryClient.tsx`, `app/student/lesson/[contentId]/LessonViewerClient.tsx`, `app/api/student/{today,learn,progress,exams,lessons/[id]/quiz}/route.ts`, `lib/student/learnDiscovery.server.ts`, `app/student/textbooks/page.tsx` |
| Teacher surfaces | `components/teacher/TeacherNav.tsx`, `app/api/teacher/{schedule,lessons/[contentId]/assign,timetable/[timetableId]/assign,assignments,assignments/generate}/route.ts`, `app/api/homework/create/route.ts`, `app/teacher/lesson/[contentId]/page.tsx`, `docs/product-design-v2/PRODUCT_DESIGN_V2.md` |
| Data | `prisma/schema.prisma` models: `CurriculumContent`, `CurriculumVersion`, `MoeCurriculumObjective`, `CurriculumLearningTarget`, `ScheduledWork`, `TeacherLessonAssignment`, `TimetableAssignment`, `CurriculumUnit`, `CurriculumLessonPlan`, `Assignment`, `Homework`, `Exam`, `ExamQuestion`, `Standard`, `Unit`, `Lesson`, `PracticeItem`, `Assessment`, `AssessmentItem`, `AssessmentAttempt`, `VirtualLab`, `LabSession`, `CapstoneProject`, `LessonAudio`, `LessonVideo`, `LessonVariant`, `LessonPrerequisite`, `TextbookGenerationJob`, `OfflinePack` |
| Offline / tools / evidence | `lib/offline/syncProtocol.ts`, `lib/lesson-offline-cache.ts`, `lib/content-availability-manifest.ts`, `lib/packs/generatePack.ts`, `lib/toolkit/toolRegistry.ts`, `lib/learning-evidence/evidenceContract.ts`, `lib/textbooks/textbookGenerationQueue.ts` |

Items marked *(inferred)* were not traced end to end and should be verified
before they drive implementation.
