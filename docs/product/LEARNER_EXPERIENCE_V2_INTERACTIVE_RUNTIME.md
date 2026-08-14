# Learner Experience V2 / Interactive Learning Runtime

**Status:** APPROVED FUTURE PROGRAM  -  CAPTURED, NOT STARTED. Documentation only.
No runtime code, schema, migration, or production configuration changed to
produce this document.

**Captured:** 2026-08-14.

**Do not drop this program during P2/P5 execution.** It is not a duplicate of
Curriculum V2 or Global Pedagogy Intelligence; it is the rendering layer both
of those systems depend on, and its architecture phase is now sequenced
*before* Curriculum V2 (see "Sequencing decision" below).

## Relationship to current execution

Current foundational work stays ahead of this program and is not interrupted
by it:

1. P2-B  -  Qualified review operations (**active now**, see
   `docs/P2B_QUALIFIED_REVIEW_OPERATIONS_FINAL_DESIGN.md`)
2. P2-C  -  Curated WAEC authority (licensing, rights tracking, imports,
   qualified subject review)
3. P5-A  -  Signed offline packs and revocation manifests
4. Remaining actionable P1 operational/external gates (pen test, P1-C/P1-D
   activation)

Full detail on P1-P7 sequencing: `docs/roadmaps/PRIORITIES_1_2_5_6_7_EXECUTION_PROGRAM.md`.
Live status: `docs/roadmaps/CURRENT_EXECUTION_STATE.md`.

## Sequencing decision

The initial capture of this program proposed a strict linear order (Curriculum
V2 -> Global Pedagogy -> Learner Experience V2). That was reconsidered and
**superseded** before this document was finalized, for a specific reason: if
Curriculum V2's generation contract is rebuilt before the runtime that has to
render its output exists, the schema gets designed around whatever the author
happens to imagine (text lessons, MCQs, static activities) and then has to be
redesigned once real rendering requirements surface  -  slides, manipulatives,
interactive diagrams, simulations, tool permissions, narration. That is a
second schema migration on production-live `CurriculumContent`-adjacent
tables, which P2-A's escalation contract already treats as a stop-and-review
event.

**Approved sequence:**

- **Phase A  -  Learner Experience V2 architecture + UX prototype.** Design
  only, plus one small vertical prototype (see Phase A below). Establishes
  the rendering contract: what kinds of scenes, interactions, virtual labs,
  assessments, and tools the runtime is actually capable of executing.
- **Phase B  -  Curriculum V2.** Now designed to generate experiences against a
  known, executable contract instead of an imagined one.
- **Phase C  -  Global Pedagogy Intelligence.** Selects among the experience
  types Phase A defined and Phase B can generate.
- **Phase D  -  Learner Experience V2 full build.** Wires a known
  curriculum/pedagogy output contract into the runtime whose shape was fixed
  in Phase A.
- **Phase E  -  Teacher Experience V2.**
- **Phase F  -  Adaptive mastery / remediation expansion.**

This uses letters A-F, deliberately not the `P1`-`P7` scheme used by
`PRIORITIES_1_2_5_6_7_EXECUTION_PROGRAM.md`, to avoid implying this program is
next in that specific numbered queue. It runs after P2/P5 close, in whatever
priority-numbering scheme is current at that time.

Reasoning in full, preserved verbatim from the approving discussion, is
useful context for whoever scopes Phase A and should not be lost:

> The learner experience should help define what the curriculum system needs
> to generate. Think of it like building a game: the Learner Runtime is the
> game engine, Curriculum V2 creates the levels/content, Global Pedagogy
> decides how the levels should teach. If we don't know what the game engine
> can do, the content generator doesn't know what it's designing for.
>
> Example: Singapore CPA for Grade 2 addition. Without a defined runtime, the
> generator might produce "show the student five apples and ask them to
> count." With the runtime contract defined first, Curriculum V2 can instead
> emit a structured concrete-stage manipulative interaction (drag N apples
> into baskets, `mastery.expectedCount`), followed by a pictorial stage (dot
> arrays), followed by an abstract stage (`3 + 2 = ?`). The runtime renders
> each stage from the contract. The pedagogy is executed by the product, not
> merely mentioned in a prompt.
>
> Same logic applies to labs: define the Virtual Lab specification (objects,
> actions, state, target values) before the curriculum generator has to
> describe "conduct an experiment measuring displacement" in prose.
>
> The distinction that matters: do the *architecture and design* first,
> including a small vertical prototype that proves it end-to-end. Do **not**
> build all the 3D labs, the full question engine, or the full lesson player
> first. Pause after the prototype and do Curriculum V2, then Global
> Pedagogy, then come back and finish the runtime build against a now-known
> contract.

## Program vision

LiberiaLearn must evolve from a conventional web lesson page into an
interactive digital learning environment. The learner should not merely read
AI-generated content. The learner should see, hear, touch, manipulate,
experiment, answer, construct, measure, practice, receive feedback, and
demonstrate mastery. The experience should adapt to grade, age, subject,
objective, learner mastery, device, connectivity, accessibility needs, and
assessment rules.

## Task 1  -  Repository discovery findings

Investigated before writing this document, so the program consolidates prior
decisions instead of duplicating them. This is not a blank slate: several
workstreams below already have real, shipped implementations that Phase A
must inventory in depth and design around, not replace on day one.

### Already real and shipped

- **Student Toolbelt (Workstream E)  -  substantially exists today.**
  `components/toolkit/` (`ToolkitProvider`, `ToolkitContext`,
  `ToolkitOverlay`, `DraggablePanel`, `toolComponents.tsx`) plus 12 tools
  under `components/toolkit/tools/`: `BasicCalculator`,
  `ScientificCalculator`, `DigitalRuler`, `Protractor`, `CoordinateGrid`,
  `NumberLine`, `FractionVisualizer`, `MultiplicationTable`,
  `PeriodicTable`, `UnitConverter`, `Timer`, `DictionaryTool`. Already has a
  **registry pattern** (`lib/toolkit/toolRegistry.ts`), **context-aware
  matching** by subject/grade-band/lesson-type/strand
  (`useToolkitContext()`), an **offline guarantee** (no external calls,
  bundled datasets, client-local state), documented **accessibility
  standards** (aria-labels, keyboard reachability, focus trap), and
  **category feature flags** (`ENABLE_CLASSROOM_TOOLKIT`,
  `ENABLE_TOOLKIT_CALCULATOR`, `ENABLE_TOOLKIT_SCIENCE_TOOLS`,
  `ENABLE_TOOLKIT_GEO_TOOLS`, `ENABLE_TOOLKIT_TIMER`). Fully documented in
  `docs/product/CLASSROOM_TOOLKIT.md`. Workstream E's job is to define
  *assessment-time tool permission policy* (`calculatorAllowed`,
  `rulerAllowed`, etc. gated by assessment definition) on top of this, and to
  extend the registry with the remaining tools this program lists
  (stopwatch, thermometer, balance, lab notebook, formula sheet,
  scratchpad, glossary, text-to-speech, zoom, high contrast)  -  not to
  rebuild the tool system.
- **Virtual Lab Engine (Workstream F)  -  a real object/action/state model
  already exists**, not just descriptions of experiments.
  `lib/labs/runtime/applyLabAction.ts` and
  `lib/labs/runtime/validateLabAction.ts` implement exactly the
  action-causes-observable-state-change loop Workstream F describes. 16
  subject-specific lab pages exist under `components/labs/`: pendulum,
  molecule motion, human heart, cell division, cell structure, chemical
  reaction, earthquake waves, ecosystem balance, electric circuit, gravity,
  light and shadow, periodic table, simple machines, tectonic plates, water
  cycle, wave motion, weather system. Shared shell/chat/fallback components
  exist (`LabShell.tsx`, `LabChatPanel.tsx`, `LabFallback.tsx`  -  a real
  low-resource-fallback precedent for Workstream O). AI-assisted lab
  narration/guidance exists at `lib/labs/ai/explainLabState.ts` and
  `lib/labs/ai/planLabAction.ts` (the live surfaces, per NR-9.5's
  full-codebase sweep  -  `lib/ai/lab/labAnalyzer.ts` is an older, not-live
  file, kept for reference only). Lesson-embedded lab panels already exist
  (`LessonLabPanel.tsx`, `GravityLessonLabPanel.tsx`), which is a working
  precedent for Workstream A's "Activity/Lab" lesson-structure slot. What
  does **not** exist yet: 3D (Workstream G), a curriculum-generation
  contract that can *specify* a lab in structured form (Workstream I), and
  guided-physical-lab mode (Workstream H).
- **Offline infrastructure (Workstream N) is substantial**, not a green
  field: `lib/lesson-offline-cache.ts`, `lib/offline-cache.ts`,
  `lib/offline/offlineQueue.ts`, `lib/offline-queue.ts`,
  `lib/offline-quiz-attempts.ts`, `lib/offline-session.ts`,
  `lib/offline-sync/`, `lib/content-availability-manifest.ts` /
  `.server.ts`, plus student-facing surfaces
  (`app/student/offline-lessons`, `app/student/offline-status`,
  `OfflineBanner.tsx`, `SaveForOfflineButton.tsx`,
  `OfflineReadyBadge.tsx`). P1-B already added RSA-signed availability
  manifests with lesson ID/version verification and revocation-triggered
  cache eviction  -  this is a working precedent for exactly the "signed
  packs / revocation manifest" model P5-A is building at platform scale and
  this program's Workstream N must integrate with. Do not design a second,
  parallel offline model; extend P5-A's manifest format to cover
  interaction/assessment/lab state.
- **Mastery/adaptive foundation (Workstream M) exists in narrow form**:
  `lib/mastery/masteryService.ts`, `lib/adaptive/updateMastery.ts`,
  `lib/curriculum/adaptiveConcurrency.ts`,
  `lib/student/adaptiveRecommendations.ts`. Sprint 6.7 already built a
  deterministic, explainable next-best-action ranking for
  `/student/today`. What is missing is the richer per-interaction mastery
  event (hints, attempts, time, misconception, scaffold level, tool usage,
  simulation observation) this program's Workstream M specifies  -  today's
  mastery signal is coarser than that.
- **Slide/scene parsing exists in an early form**: `lib/lessons/parseToSlides.ts`
  (147 lines) already turns lesson bodies into slide-like units, and
  `LessonAudioPlayer.tsx` already provides narration playback. Workstream A
  and K should treat this as a starting seam, not a green field, when
  designing the full Scene/Slide contract.
- **"Help Me Understand"** is already built (`StudentLessonHelpPanel.tsx`,
  spec in `docs/roadmaps/MASTER_EXECUTION_PLAN.md`): a session-safe grounded
  AI help panel with suggested questions, prompt-registry-injected lesson
  context, typing animation, mobile-first layout. This is a real precedent
  for "guided example" / "check understanding" interactions and should be
  treated as an existing interaction type Phase A's schema must be able to
  express, not rebuilt.
- **Age/grade-responsive UX precedent exists, but only on the teacher
  side.** `docs/product/UX_LOW_LITERACY.md` documents a real, shipped
  progressive-disclosure system (Basic/Standard/Advanced density, one
  codebase, large-font accessibility CSS mode, guided onboarding overlay)  - 
  but it targets teachers, not students. Per standing memory
  (`project_visual_redesign_queue`, Doc B item B7), `AccessibilityToggle` is
  **not mounted in the student experience at all**, and Grades 1-4 have real
  outsider feedback that the current student UI is not kid-friendly. This is
  the single clearest, already-diagnosed gap Workstream B (age-adaptive
  experience) exists to close. Phase A should treat the low-literacy
  progressive-disclosure pattern as reusable infrastructure to extend to
  students by age band, not a separate design problem.

### Exists only as a single, fixed shape (the real gap)

- **Question/assessment engine is single-choice MCQ only, today.**
  `lib/ai/lessonQuiz.ts` defines exactly one question shape: `{ id,
  question, options: string[], correctIndex: number, explanation }`,
  always exactly 5 AI-generated questions per lesson
  (`components/student/LessonQuizPanel.tsx`, `lib/offline-quiz-attempts.ts`
  for offline attempt queuing). `LessonGapAnalysis` (missed concepts +
  reread suggestion) is a real, working remediation-on-failure precedent
  worth preserving in the V2 interaction/mastery contract. There is no
  dedicated assessment-runtime component (numbered navigation,
  answered/flagged/review state, autosave/recovery) anywhere in the
  codebase  -  Workstream C (Assessment Player V2) and D (Question/Interaction
  Engine) are genuinely new work, not a re-architecture of something that
  already handles multiple question types.
- **No lesson player / lesson viewer as a distinct architectural
  component.** What exists is page-level composition
  (`app/student/lessons/[id]/LessonDeliveryClient.tsx`,
  `app/student/lesson/[contentId]/page.tsx`,
  `components/lesson/{LessonBody,LessonFullscreenButton,LessonImage}.tsx`),
  not a first-class Lesson Player with scene/slide navigation, persistent
  progress, resume, or a collapsible outline. Workstream A is real,
  substantial new architecture, not a cosmetic refresh  -  consistent with
  the program's own framing.
- **No 3D anywhere in the codebase.** Workstream G is entirely new.
- **No structured curriculum-generation contract for interactions/labs.**
  Curriculum generation today produces lesson bodies and (separately) the 5
  AI-generated quiz questions above; it does not emit the structured
  objective/interaction/objects/actions/mastery contract Workstream I
  describes. This is the exact gap Phase A exists to close before Curriculum
  V2 is rebuilt.
- **No pedagogy-strategy layer.** `docs/curriculum-framework.md` (26 lines)
  and `docs/MASTERY_AND_RETENTION.md` (30 lines) contain no pedagogy-strategy
  content (Singapore CPA, retrieval practice, worked examples, inquiry, and
  so on do not appear anywhere in `docs/`). Global Pedagogy Intelligence
  (Phase C) is genuinely new, not a rename of an existing system. Note that
  `docs/P2B_QUALIFIED_REVIEW_OPERATIONS_FINAL_DESIGN.md` already explicitly
  disclaims this: "P2-B does not implement Curriculum V2 or Global Pedagogy
  Intelligence. More advanced pedagogy dimensions can be added as a new
  rubric version."  -  P2-B's review rubric is a documented, forward-compatible
  extension point Phase C should reuse rather than replace.

### Historical/superseded docs checked for conflicts

- `docs/vision/NATIONAL_PHASES.md` ("National Phases V1") is a historical,
  superseded phase scheme (`PHASE 1`-`PHASE 4`, numeric, no letter suffix).
  Its "PHASE 2  -  AI Curriculum & Instruction Engine" and "PHASE 2.5  - 
  National Adoption & Digital Literacy Infrastructure" cover *some* of the
  same conceptual ground (curriculum synthesis, progressive-disclosure UI,
  accessibility) but predate and do not conflict with this program's `P1`-`P7`
  or `Phase A`-`F` naming  -  different scheme entirely, correctly marked
  superseded by `CLAUDE.md`'s canonical reading order. No renumbering
  needed.
- `docs/roadmaps/MASTER_EXECUTION_PLAN.md` and `rules.md`/`SPEC.md` were
  checked and are historical references per `CLAUDE.md`; nothing in them
  contradicts this program beyond the already-implemented "Help Me
  Understand" spec noted above.
- No existing document already uses the names "Learner Experience V2",
  "Interactive Learning Runtime", "Global Pedagogy Intelligence", or
  "Curriculum V2" as a program title. This document is the first canonical
  capture of all four.

## Program order (approved)

### Phase A  -  Learner Experience V2 architecture + UX prototype

Design only, plus one small vertical prototype to prove the architecture.
Deliverables:

- Lesson Player design (scene/slide contract, navigation, outline, resume)
- Assessment runtime design (Workstream C)
- Interaction schema (Workstream D)  -  covering the full type list below
- Toolbelt extension design on top of the existing `components/toolkit/`
  registry (assessment-time tool permission policy)
- Virtual Lab specification (objects/actions/state/target/mastery),
  extending the existing `applyLabAction`/`validateLabAction` model
- 3D object/action/state model (design only  -  no 3D implementation)
- Age bands and their interaction-density rules (Workstream B)
- Course navigation design (Workstream L)
- Offline fallback rules, integrated with P5-A's signed-manifest model
  (Workstream N)
- Mastery-event contract (Workstream M), extending the existing
  `masteryService`/`updateMastery` foundation
- Accessibility requirements integrated from the start (Workstream P),
  extending `AccessibilityToggle`/`accessibilityMode.ts` and the
  `UX_LOW_LITERACY.md` progressive-disclosure pattern to students
- Visual prototypes
- **One small vertical prototype**: Grade 3 lesson -> interactive slide ->
  drag/drop question -> calculator/ruler (from the existing toolkit) ->
  simple water-volume simulation (extending the existing lab-runtime
  action/state model). The prototype's job is to prove the architecture end
  to end, not to ship a feature.

Then **pause** runtime implementation. Do not proceed to a full build.

### Phase B  -  Curriculum V2

Redesign the curriculum-generation contract to emit structured experiences
(objective, pedagogy strategy, interaction type, objects/tools, actions,
expected observation/response, hint, feedback, misconception, mastery
evidence, accessibility adaptation, offline fallback) against the schema
Phase A fixed  -  not against an imagined one.

### Phase C  -  Global Pedagogy Intelligence

Selects among the experience types Phase A defined and Phase B can generate
(Singapore CPA concrete->pictorial->abstract staging, Japanese structured
problem solving, retrieval practice, worked-example fading, inquiry-based
sequencing, and so on). Renders the selected pedagogy through the runtime
rather than only mentioning it in a prompt.

### Phase D  -  Learner Experience V2 full build

Full implementation of Workstreams A-Q against the now-known Curriculum
V2 / Global Pedagogy output contract.

### Phase E  -  Teacher Experience V2

Not scoped in this document. Tracked here as a placeholder so it is not
dropped from the sequence.

### Phase F  -  Adaptive mastery / remediation expansion

Extends the mastery-event contract from Phase A/D into remediation,
enrichment, retry, alternate-explanation, and spaced-retrieval decisions.
Not reduced to quiz percentage alone.

## Workstream detail

### Workstream A  -  Lesson Player V2

Re-architect, do not cosmetically refresh, the current page-level lesson
composition (`LessonDeliveryClient.tsx` et al.) into a first-class player.
Target capabilities: full-page immersive mode; slide/page/scene presentation
where appropriate; next/previous and section navigation; persistent progress
and resume; collapsible course/unit/lesson navigation and outline; embedded
checks for understanding; guided examples; practice; reflection; review;
media; activities; simulations; labs; accessibility controls.

Potential lesson structure (not a fixed template for every subject/age):
Introduction, Objective, Explore, Explain, Worked Example, Guided Practice,
Independent Practice, Check Understanding, Activity/Lab, Review, Mastery
Check.

### Workstream B  -  Age-adaptive experience

A Grade 1 learner should not receive a simplified Grade 11 interface.
Design principle: **show before tell.**

- **Early primary:** large visuals, minimal text, narration, icons,
  animation, touch interactions, manipulatives, picture choices, guided
  pacing, immediate positive feedback. Math: drag physical-looking objects
  before abstract notation. Reading: picture + narration + highlighted
  words. Science: visual cause-and-effect interactions.
- **Upper primary / junior secondary:** structured text, diagrams,
  interactive examples, independent practice, note-taking, tools,
  simulations.
- **Senior secondary:** richer navigation, dense reference information, exam
  modes, notes, formulas, extended responses, advanced simulations,
  WAEC-style assessment workflows.

Reuse the `UX_LOW_LITERACY.md` progressive-disclosure pattern (currently
teacher-only) as the starting infrastructure for this, rather than a new
design system.

### Workstream C  -  Assessment Player V2

A dedicated assessment runtime, not a generic form renderer. Reference
interaction patterns (LiberiaLearn-native, not copying another product's
branding): one focused question at a time; numbered navigation;
answered/unanswered/flagged/review state; progress; skip; previous/next;
controlled submit; section navigation; time information where applicable;
autosave; recovery after connectivity loss.

### Workstream D  -  Interaction / Question Engine

Today's engine supports exactly one type (single-choice MCQ,
`lib/ai/lessonQuiz.ts`). Minimum future type set: single-choice MCQ,
multi-select, true/false, short typed response, numeric response, long
response, fill-in-the-blank, dropdown completion, matching, drag-and-drop,
ordering/sequencing, categorization, image selection, hotspot/click-region,
timeline ordering, table/grid response, diagram labeling, graph interaction,
equation/math response. Future-compatible: voice response, handwriting, code
execution, drawing, interactive geometry, simulation-derived answers.
Question-type selection must be instructionally meaningful, not decorative.

### Workstream E  -  Student Toolbelt

**Largely built already**  -  see discovery findings above
(`components/toolkit/`, `docs/product/CLASSROOM_TOOLKIT.md`). Remaining
work: extend the registry with stopwatch, thermometer, balance, lab
notebook, formula sheet, scratchpad, glossary, text-to-speech, zoom, high
contrast, translation/language support; and define assessment-level tool
permission policy (conceptual shape:
`calculatorAllowed`/`calculatorMode`/`rulerAllowed`/`protractorAllowed`/
`referenceSheetAllowed`/`scratchpadAllowed`) so a practice activity and a
WAEC-style exam can permit different tools from the same registry.

### Workstream F  -  Virtual Lab Engine

**Foundation already built**  -  see discovery findings above
(`lib/labs/runtime/applyLabAction.ts`,
`lib/labs/runtime/validateLabAction.ts`, 16 subject lab pages). Students
already perform simulated experiments with observable state changes caused
by learner actions (e.g. the existing water/displacement-style pendulum and
chemistry labs). Remaining work is generalizing this into a reusable engine
driven by the Phase B curriculum contract, rather than one bespoke component
per lab.

### Workstream G  -  3D interactive labs

Entirely new. Use 3D only when spatial manipulation materially improves
learning, not for novelty. Candidate domains: chemistry (beakers, flasks,
mixing, heating, indicators, pH, reactions, concentration), biology (cells,
organs, anatomy, microscopes, DNA, ecosystems, age-appropriate dissection
simulations), physics (circuits, forces, ramps, pendulums, optics, waves,
magnets, motion), earth science/geography (terrain, erosion, rainfall,
water cycle, tectonics, climate), engineering/computing (circuits, mechanical
assembly, robotics, logic gates, code-controlled systems).

### Workstream H  -  Guided Physical Lab mode

Virtual labs complement, not replace, physical science where facilities
exist. LiberiaLearn provides materials/safety instructions, steps, timers,
measurement prompts, observation forms, photos, data entry, calculations,
questions, teacher verification. Enables: learn virtually -> practice
virtually -> perform physically -> record/analyze digitally. Entirely new;
`LabFallback.tsx` is a useful low-resource-fallback precedent but does not
cover physical-lab guidance.

### Workstream I  -  Curriculum-generated interactions

Curriculum V2 (Phase B) must specify learning experiences, not just text.
Conceptual generation contract: learning objective, pedagogy strategy,
interaction type, learner action, required objects/tools, instructions,
expected observation, expected response, hint, feedback, misconception,
mastery evidence, accessibility adaptation, offline fallback. The
curriculum/pedagogy system decides *what* experience is appropriate; the
learner runtime decides *how* it executes; the mastery system determines
*what* the learner demonstrated.

### Workstream J  -  Global Pedagogy connection (Phase C)

Must be compatible with the future Global Pedagogy Intelligence Engine:
Singapore CPA (concrete -> pictorial -> abstract), Japanese structured
problem solving (problem -> attempt -> comparison -> reflection), retrieval
practice (strategically timed recall), worked examples (guided steps with
progressively removed scaffolding), inquiry (experimentation before formal
explanation). The UI/runtime renders the pedagogy the curriculum engine
selects rather than forcing every strategy into one template.

### Workstream K  -  Multimedia

Lesson-native diagrams, illustrations, photographs, animations, audio,
narration, video, interactive models, charts, maps, timelines,
slide/deck experiences. `LessonAudioPlayer.tsx` and `parseToSlides.ts`
are existing seams to extend, not replace. Preserve/expand the existing
presentation/PowerPoint-compatible lesson direction where supported by
current architecture.

### Workstream L  -  Navigation

Course -> Subject -> Unit -> Lesson -> Lesson Sections -> Practice ->
Activity/Lab -> Assessment. Show current/completed/incomplete/locked/
optional/mastery status. Desktop: persistent/collapsible left rail.
Mobile/tablet: adapt without losing course context.

### Workstream M  -  Mastery + feedback

Every meaningful interaction should be able to produce mastery evidence:
objective, skill, response, correctness, attempts, hints, time,
misconception, tool usage where educationally relevant, simulation
observation, scaffold level. Extends the existing
`lib/mastery/masteryService.ts` / `lib/adaptive/updateMastery.ts` /
`lib/student/adaptiveRecommendations.ts` foundation and Sprint 6.7's
next-best-action ranking, not a replacement for them. Future adaptive
systems use this for remediation, enrichment, retry, alternate explanation,
spaced retrieval, next activity, next lesson. Do not reduce mastery to quiz
percentage alone.

### Workstream N  -  Offline

Integrates with P5-A signed offline delivery and the existing offline
infrastructure listed in discovery findings above (do not build a second,
parallel offline model). Design for: offline lesson assets, offline
assessment interactions, local progress, local answers, reconnect/sync,
signed packs, version awareness, revoked-content invalidation, offline-safe
simulations. Complex 3D may require tiered asset packs or lightweight
fallbacks. Do not assume continuous broadband.

### Workstream O  -  Low-resource fallbacks

Every premium interaction should define a fallback where practical, e.g.
3D displacement lab -> 2D simulation -> interactive diagram -> teacher-guided
physical activity -> printable/text fallback. `LabFallback.tsx` is a real,
shipped precedent for this pattern. Degrade gracefully without losing the
learning objective.

### Workstream P  -  Accessibility

Keyboard navigation, screen readers, captions, text-to-speech, reduced
motion, high contrast, zoom, alternative descriptions, motor-accessible
controls, audio instructions, simplified interaction alternatives. Cannot
be added only after visual design is finished. Extends
`components/AccessibilityToggle.tsx` / `lib/accessibilityMode.ts`, which
today is not mounted in the student experience (`project_visual_redesign_queue`
in session memory, Doc B item B7)  -  Phase A should treat mounting and
extending this for students as in-scope design work, not a separate ticket.

### Workstream Q  -  Platform contract

Keep these responsibilities distinct, using shared contracts rather than one
giant component:

- **Curriculum / Pedagogy Engine**  -  determines what the learner should
  experience.
- **Lesson Player**  -  renders instructional flow.
- **Interaction Engine**  -  executes learner interactions.
- **Assessment Player**  -  runs controlled assessments.
- **Student Toolbelt**  -  provides authorized learning tools (already exists
  as `components/toolkit/`).
- **Virtual Lab Engine**  -  runs simulations and experiments (foundation
  already exists as `lib/labs/runtime/`).
- **Mastery Engine**  -  interprets learner performance (foundation already
  exists as `lib/mastery/`, `lib/adaptive/`).
- **Offline Runtime**  -  packages and synchronizes experiences (foundation
  already exists, integrates with P5-A).

## Future discovery requirement

When implementation time arrives (start of Phase A), do **not** immediately
rewrite the lesson viewer. First run a dedicated repo-first architecture
sprint that goes deeper than this document's discovery pass: inspect the
existing `LessonDeliveryClient.tsx`/lesson pages in full, the quiz/question
schema (`lib/ai/lessonQuiz.ts`), the lab runtime and all 16 lab components,
the toolkit registry, offline packs and manifest code, mastery tracking,
lesson JSON/content storage shape, curriculum generator contracts, student
route architecture, mobile behavior, and current accessibility state. Design
migration, not a second parallel platform.

## Non-goals for the current sprint

Do not, in this sprint:

- Implement 3D
- Replace the lesson viewer
- Build the question engine
- Change the curriculum schema
- Alter the assessment runtime
- Add student tools
- Redesign UI
- Change production
- Change current P2-B/P2-C/P5-A sequencing

This sprint is documentation only, and this document is the deliverable.

## Roadmap integration

Added to `docs/roadmaps/CONSOLIDATED_BACKLOG.md` and
`docs/roadmaps/PRIORITIES_1_2_5_6_7_EXECUTION_PROGRAM.md` (see those files
for the live pointer entries). Cross-referenced from:
`docs/P2B_QUALIFIED_REVIEW_OPERATIONS_FINAL_DESIGN.md` (rubric-versioning
extension point for Phase C), `docs/product/CLASSROOM_TOOLKIT.md`
(Workstream E foundation), `docs/product/UX_LOW_LITERACY.md` (Workstream B
starting pattern), `docs/roadmaps/PRIORITIES_1_2_5_6_7_EXECUTION_PROGRAM.md`
(P2-A/P2-B/P2-C, P5-A/P5-B/P5-C dependencies).

**LEARNER EXPERIENCE V2 PROGRAM CAPTURED  -  IMPLEMENTATION DEFERRED UNTIL
FOUNDATION SEQUENCE COMPLETES.**
