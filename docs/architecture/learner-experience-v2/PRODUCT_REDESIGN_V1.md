# Product Redesign V1 — Learner Experience architecture (Phase A)

Status: authoritative architecture for the new student product. It refines
`docs/architecture/LEARNER_EXPERIENCE_V2.md`; the learning-authority rules in
that document are unchanged and still govern every decision below.

Base: `origin/main` `efec253f`. Phase A proves the architecture with one
internal vertical prototype (Hydroelectric power → Mount Coffee lab). It does
not release a lesson, release Mount Coffee, activate curriculum, or claim MOE
approval.

## 1. Repository audit

| Capability | Where | Classification | Notes |
| --- | --- | --- | --- |
| Lesson delivery client | `app/student/lessons/[id]/LessonDeliveryClient.tsx` (1,485 lines) | MIGRATE | Read / slides / listen / video modes over one body; exit ticket, tutor, flag, audio, video, offline cache all live in one component. Its modes become scene renderers; it stays the legacy route until lessons have native scenes. |
| Legacy content route | `app/student/lesson/[contentId]` | REUSE (legacy read mode) | Level 4 of the scene hierarchy. |
| Inferred slides | `lib/lessons/parseToSlides.ts` | REPLACE as authority; REUSE as fallback | Post-hoc splitting; a long body with no headings becomes one giant slide (proved in `scene-contract.test.ts`). Now level 3 of the hierarchy and documented as compatibility only. |
| Lesson → lab links | `lib/lessons/labLinks.ts` | REPLACE as authority; DEFER removal | Subject + grade rules (several ids it emits have no registry entry). Marked compatibility only; future links are `LearningExperienceLink`. |
| Lesson lab panel | `components/labs/LessonLabPanel.tsx` | CONSOLIDATE | Legacy labs opened in a modal inside the lesson; becomes the LEGACY_SIMULATION runtime behind the unified Lab Experience. |
| Labs library | `app/student/labs/page.tsx` | REPLACED (this PR) | Was: hard-coded 12-lab grid + assigned practical sessions. Now the unified Labs tab. |
| Legacy AI labs | `lib/labs/registry.ts`, `app/student/labs/<id>/` (12 static routes) | REUSE | Runtime kind `LEGACY_SIMULATION`. Client scores are already contained (lab-score containment). |
| Practical labs | `VirtualLab` + `LabSession`, `app/student/labs/[labId]` | REUSE | Runtime kind `PRACTICAL_GUIDED`. |
| Interactive Lab Runtime V2 | `lib/interactive-labs/v2`, `components/interactive-labs/v2` | REUSE (unchanged authority) | Profiles HIGH → STANDARD → LOW → FALLBACK_2D. Two opt-in host hooks added (`internalPreview`, `onStateChange`); default behaviour unchanged. |
| Interactive lab route | `app/student/interactive-labs/[labId]` | CONSOLIDATE | Now a redirect to `/student/labs/[labId]`, which renders approved V2 labs. |
| Mount Coffee | `lib/interactive-labs/v2/definitions/hydropower.ts` | REUSE, still DRAFT / PENDING / unreleased | Opened only by the dev-only prototype route. |
| Today | `app/student/today` | REUSE → TODAY | Already the action surface. |
| Governed next action | `app/student/learn` + `/api/student/learning-authority/next-action` | REUSE → LEARN | The Learning Orchestrator's next action; the prototype hands off here. |
| Progress | `app/student/progress` | REUSE → PROGRESS | |
| Tutor / help | `app/student/ai-tutor`, `StudentLessonHelpPanel`, lesson flag route | REUSE → HELP | |
| Student nav | `components/StudentSidebar.tsx` | REPLACE (Phase B) | 15+ flat links; no Labs, Learn or Progress entry. Replaced by the 5-destination IA (`lib/learner-experience/studentNavigation.ts`). Phase A mounts the new nav on the Labs tab only. |
| Toolkit | `lib/toolkit/toolRegistry.ts`, `components/toolkit/*` | REUSE | Scenes declare permitted tool ids; the toolkit's server flags still switch tools on. `ToolkitOverlay` is not mounted anywhere today and collides with other fixed controls, so scenes render tools in the context panel instead. |
| Lesson progress / resume | `lib/offline/lessonProgress.ts` (scroll position) | MIGRATE | Scene progress uses the same IndexedDB store pattern and session partition (`progressStore.ts`). |
| Offline lesson cache / queue | `lib/lesson-offline-cache`, `lib/offline-queue`, `SyncManager` | REUSE | No second queue. Scene progress is position only and never syncs evidence. |
| Assessment / quiz | `LessonQuizPanel`, exit ticket in lesson body | DEFER → Assessment Player V2 | Lessons hand off by reference (`ASSESSMENT_HANDOFF`). |
| Accessibility | `StudentAccessibilityControl` (`data-a11y`), reduced motion in labs | REUSE | |
| Evidence / SLM / DecisionModel / Orchestrator | `lib/learning-evidence`, `lib/learning-state`, `lib/learning-authority` | REUSE, unchanged | No file in these directories changes in Phase A. |

## 2. Student information architecture

Five primary destinations (`STUDENT_PRIMARY_NAV`):

| Destination | Route | Holds | Existing routes mapped in |
| --- | --- | --- | --- |
| Today | `/student/today` | resume, next recommended action, assignments, teacher-required work, review/remediation, unfinished lesson or lab | dashboard, work, assignments, homework |
| Learn | `/student/learn` | subject → unit → lesson → practice; current learning path | lessons, lesson, units, adaptive, exams, waec, textbooks |
| Labs | `/student/labs` | For You, Assigned, Continue, Library, Completed | interactive-labs |
| Progress | `/student/progress` | mastery/evidence summaries, strengths, areas to practise, history | passport, portfolio, certificates, report cards, transcript |
| Help | `/student/ai-tutor` | AI tutor, teacher help/flag, accessibility, offline help | offline-status, offline-lessons, messages |

Phone: bottom bar `Today | Learn | Labs | Progress | Help`. Wider screens: top
bar. Focused lesson and lab players hide the primary nav and keep their own way
back (lesson: ‹ exit; lab: "Back to lesson").

## 3. Lesson Player V2 contract

Types: `lib/learner-experience/types.ts`. Validation:
`lib/learner-experience/sceneContract.ts`.

`LessonExperience`: identity and version, subject, grade, age band, authority
(`APPROVED_RELEASE` | `PROTOTYPE_FIXTURE` | `LEGACY_UNGOVERNED`, candidate
content ids, release id), objectives (id, statement, concept, standards,
skills), ordered scenes, offline packaging.

`Scene`: `id`, `type`, `objectiveIds`, `title`, `content` (body, key points,
per-age-band variants), `interaction`, `media` (alt required; captions or
transcript required for audio/video), `tools` (allowed / prohibited toolkit
ids), `accessibility` (text alternative, keyboard, reduced motion, captions),
`offline` (FULL / DEGRADED / ONLINE_ONLY + fallback), `evidence` contract, and
`completion` rule.

Scene types: INTRO, OBJECTIVE, EXPLANATION, MEDIA, INTERACTIVE_DIAGRAM,
GUIDED_EXAMPLE, PRACTICE, CHECK_UNDERSTANDING, LAB, REFLECTION, REVIEW,
MASTERY_CHECK. Phase A renders text scenes, `DIAGRAM_REVEAL`,
`MULTIPLE_CHOICE` (formative), `LAB_LAUNCH`, `FREE_RESPONSE` and
`ASSESSMENT_HANDOFF`. MEDIA, GUIDED_EXAMPLE and PRACTICE validate but have no
dedicated renderer yet.

Validation rules: at least two scenes; no scene body over 350 words (a scene is
a focused unit, not a page); unique ids; objectives must exist; every scene has
a text alternative; tool ids must exist in the toolkit registry; completion
rule must match the interaction; MASTERY_CHECK must hand off to the assessment
seam and never carries an answer key.

Completion gates Continue (e.g. every diagram stage opened, every check
answered, the lab returned or its walkthrough used). Previous is always
available. The outline (desktop) jumps only to scenes already reached.

## 4. Unified Lab Experience

`lib/learner-experience/labExperience.ts`. One `LabExperience` shape for every
lab: labId, version, title, summary, subject, grade bands, standards, skills,
concepts, objectiveIds, prerequisites, estimated minutes, runtime
(`LEGACY_SIMULATION` | `PRACTICAL_GUIDED` | `INTERACTIVE_V2` + capabilities),
offline/degradation profile, evidence types, release status.

Learners only ever see "Lab". Interactive labs degrade
HIGH → STANDARD → LOW → FALLBACK_2D → STATIC_TEACHER_GUIDED without changing the
objective; the runtime chooses the tier. Only `RELEASED` labs are student
accessible; an interactive lab is released only when its definition is
APPROVED/APPROVED **and** its release binding is real. Mount Coffee is
`DRAFT_UNRELEASED` (asserted in tests).

Canonical learner URL for every lab: `/student/labs/[labId]`.

## 5. Lesson ↔ lab linkage

`LearningExperienceLink` (`lib/learner-experience/links.ts`): link id, status
(`APPROVED` | `PROTOTYPE_INTERNAL` | `CANDIDATE`), authority basis and approval
provenance, lesson identity/version, objective ids, experience (kind, lab id,
lab version), placement scene, requirement (REQUIRED / RECOMMENDED / OPTIONAL),
pre-lab scenes, post-lab reflection and check scenes, evidence mapping (lab
check → objective → disposition).

A link validates only if every objective is in the lesson **and** claimed by
the lab — no attachment by subject or grade. An APPROVED link needs approver
and date. A link is student-visible only when the link is APPROVED, the lesson
is an APPROVED_RELEASE and the lab is RELEASED. Creating a link never creates
curriculum approval. The prototype link is `PROTOTYPE_INTERNAL`.

## 6. Lab launch and return

`lib/learner-experience/labLaunch.ts`. The launch carries lesson id/version,
scene, objective ids, activity and link. The lab route validates the context
against the lesson's links and rebuilds the return URL from a server-chosen
base path plus validated ids — the query string never supplies a URL (no open
redirect). The lab host reports a presentation-only summary (checks finished,
trip seen, reset seen, profile, minutes) through a per-lesson sessionStorage
slot; the lesson restores the originating scene. Browser Back works the same
way. A reload of an old return URL does not pull the learner back.

## 7. Labs tab

`lib/learner-experience/labsTab.ts`, `app/student/labs/page.tsx`. Sections:
For You (approved governed links on the learner's path — empty until links are
approved), Assigned (sessions with `scheduledWorkId`), Continue (unfinished
sessions), Library (released, grade-appropriate legacy + interactive labs),
Completed. One `LabExperienceCard` for all runtimes. Sections are `?tab=` links,
so they work without JavaScript and on any phone.

## 8. Route migration

| Route | Phase A | Later |
| --- | --- | --- |
| `/student/labs` | Unified Labs tab | — |
| `/student/labs/[labId]` | Approved V2 labs render here; otherwise existing practical-lab behaviour | Lesson launch context accepted here once lessons are released |
| `/student/labs/<legacy-id>` (12 static) | Unchanged | Fold into `[labId]` behind the LEGACY_SIMULATION runtime |
| `/student/interactive-labs/[labId]` | Redirect to `/student/labs/[labId]` | Remove after links age out |
| `/student/lessons/[id]` | Unchanged legacy player | Renders Lesson Player V2 when the lesson has native scenes |
| `/lab-review/experience/...` | Dev-only internal prototype | Retire once a released lesson exists |

## 9. Slide → scene migration

`resolveLessonScenes` walks, in order: (1) native scenes, (2) governed NR-13
learner sections (`studentMaterials`: learner material, guided items,
independent items, mastery task), (3) `parseToSlides` fallback, (4) legacy read
mode. `parseToSlides` is not the future canonical lesson structure. Native
scenes are divided by instructional boundaries (hook, goal, explanation,
interaction, check, lab, reflection, review, mastery), never every N words.
Phase A did not need to change `parseToSlides`.

## 10. Mobile-first architecture

Desktop: `[outline] [current scene] [goal / tools / help]`. Phone: lesson title,
"Scene X of Y", one focused scene, a "Tools, goal and help" disclosure, and a
fixed `Previous | Continue` bar. Touch targets ≥ 44 px (primary 48 px). The lab
keeps its own phone bottom sheet and picks its fidelity independently; the
lesson context stays visible in the lab's "Back to lesson" bar. Captured at
1440×900 and 390×844: zero horizontal overflow at every step.

Finding fixed in Phase A: the global PWA status toast (`PwaLifecycleStatus`)
sat on top of fixed bottom bars. It now offsets by `--ll-fixed-footer`, which
the lesson player and lab host set.

## 11. Age adaptation

The same scene renders per age band through `content.ageVariants`
(`EARLY_PRIMARY`, `UPPER_PRIMARY`, `JUNIOR_SECONDARY`, `SENIOR_SECONDARY`).
Objective, interaction, evidence and completion never vary by band. Phase A
renders JUNIOR_SECONDARY and carries one UPPER_PRIMARY variant to prove the
seam. Further seams for Phase B: key-point density, interaction size, audio-first
for early primary, tool sets per band.

## 12. Tool permissions

Scenes list `tools.allowed` / `tools.prohibited` by toolkit registry id;
unknown ids fail validation. The server resolves each permitted tool against
the toolkit's own flags (`enabledToolIds`), and the player renders the existing
tool components (`TOOL_COMPONENTS`). Mastery scenes can prohibit tools. Nothing
was rebuilt.

## 13. Evidence authority

Invariant: **a lab or lesson never writes mastery.**

`buildEvidenceEnvelope` turns scene responses into observations (formative,
lab, reflection, mastery response). The envelope carries
`masteryMutation: false` and `nextActionAuthority: "LEARNING_ORCHESTRATOR"`.
Disposition is set by governance, not the client: anything from a non-released
lesson or unapproved link is `RAW_OBSERVATION`; mastery responses go to the
assessment authority unscored (no answer key on the device). The server
adapter (`evidenceAdapter.ts`) builds `GovernedEvidence` with the existing
contract and runs lab checks through the existing `adaptLabEvidence`; it never
calls the mastery writer (asserted with a mocked writer). The lesson's
"See my next step" goes to `/student/learn`, where the existing Orchestrator
decides. Phase A persists nothing. SLM, DecisionModel and Orchestrator code is
untouched.

## 14. Offline and fallback

Scenes declare FULL / DEGRADED / ONLINE_ONLY with a fallback. The prototype
lesson is FULL except the lab and mastery scenes (DEGRADED). The lab degrades
through its profiles to a text walkthrough on the lesson page; using the
walkthrough satisfies the scene without changing the objective. Scene progress
reuses the IndexedDB + session-partition pattern; no second queue or cache.
Mastery answers would wait for reconnect and are never scored offline.

## 15. Accessibility

Focus moves to each new scene heading; "Scene X of Y" is a polite live region;
the progress bar has ARIA values; diagram stages are buttons with
`aria-expanded`; checks are fieldsets of radios with a status line; reflections
are labelled textareas with hints; every scene has a text alternative and the
lab has a non-3D walkthrough. Reduced motion: only `motion-safe:` transitions.
Zoom: no fixed widths, no horizontal scroll. High contrast: existing
`data-a11y` mode applies. The lab keeps its own keyboard, reduced-motion and
2D paths.

## 16. Assessment Player V2 seam

MASTERY_CHECK scenes reference an assessment (`assessmentId`, version, item
refs, `scoring: SERVER_AUTHORITY`). Phase A renders a bounded response
collector. A later Assessment Player V2 replaces that renderer without changing
the lesson contract.

## 17. Phase A prototype and findings

Route (dev only, `LAB_REVIEW_HARNESS=1`, 404 in production and on Vercel):
`/lab-review/experience/proto-g8-hydroelectric-power`. Flow: intro → goal →
explanation → energy-chain diagram → quick check → Explore in Lab → Mount
Coffee lab (LOW profile, own bottom sheet) → Back to lesson (same scene,
summary) → reflection ("What caused the plant to trip?" / "What had to change
before reset?") → review → mastery handoff → "See my next step" (existing
authority). Evidence: `phase-a-evidence/` (20 screenshots +
`capture-report.json`).

Findings:

- `parseToSlides` produces a >350-word slide from a heading-less body; native
  scenes avoid it.
- `labLinks.ts` emits lab ids with no registry or page; it must not be used for
  new links.
- The legacy sidebar has no Labs/Learn/Progress entry.
- `ToolkitOverlay` is mounted nowhere and would collide with fixed controls.
- Fixed global toasts covered fixed bottom bars (fixed).
- A stale return URL could move a learner backwards on reload (fixed, tested).

## 18. Remaining boundaries

Not done in Phase A: real-student release of any scene lesson; Mount Coffee
release; the new nav across all student pages (Labs tab only); Today/Learn/
Progress/Help page redesign; persistence of the evidence envelope; Assessment
Player V2; MEDIA/GUIDED_EXAMPLE/PRACTICE renderers; final art; physical-device
certification.

Phase B contract: `CURRICULUM_V2_HANDOFF.md`.
