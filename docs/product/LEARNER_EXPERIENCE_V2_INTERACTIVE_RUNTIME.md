# Learner Experience V2 / Interactive Learning Runtime

**Status:** APPROVED FUTURE PROGRAM  -  CAPTURED, NOT STARTED. Documentation only.
No runtime code, schema, migration, or production configuration changed to
produce this document.

**Captured:** 2026-08-14. **Interactive simulation runtime capture added:**
2026-08-20.

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

## Interactive Simulation & Virtual Lab Runtime

### Status and core principle

This section is an architecture capture, not an implementation authorization.
It refines the future Learner Experience V2 contract while the current
foundation sequence continues.

> When a concept can meaningfully be learned by doing, LiberiaLearn should
> allow the learner to do it.

The target learning progression is:

`READ -> WATCH -> EXPLORE -> PRACTICE -> DO -> DEMONSTRATE MASTERY`

It must not collapse to `READ -> MULTIPLE CHOICE -> SCORE`. Multiple choice
remains useful when recognition is the appropriate evidence, but it is one
interaction among many. The same authored interactive experience should be
reusable, under different policies, in lessons, guided practice, assignments,
quizzes, exams, remediation, mastery checks, and virtual laboratories.

### One definition, three execution modes

The preferred architecture separates the simulation definition from the
execution policy. One definition should ideally run in all three modes:

| Mode | Guidance and feedback | Attempts | Evidence and integrity |
|---|---|---|---|
| `LEARN` | Guided interaction, demonstrations, explanations, narration where appropriate, hints, Help Me Understand, and contextual tools | Unlimited or configurable | Records useful learning signals without treating exploration as a controlled assessment |
| `PRACTICE` | Reduced guidance with immediate or delayed feedback; optional hints | Configurable | Produces mastery evidence; hint use may lower evidence confidence under a future policy, but no weighting is fixed here |
| `ASSESSMENT` | Controlled environment; no hints unless policy or accommodation permits | Enforced by assessment policy | Captures action history, state transitions, final state, timing only where pedagogically valid, permitted tools, integrity signals, and scoring evidence |

Mode policy must control hints, feedback timing, retry rules, tool permissions,
narration, explanations, solution reveal, state reset, accommodations, event
capture, scoring, and integrity behavior. It must not require three separate
React implementations of the same environment.

### Interaction taxonomy

The future interaction contract must support at least:

- `MULTIPLE_CHOICE`
- `MULTI_SELECT`
- `TRUE_FALSE`
- `FREE_RESPONSE`
- `NUMERIC_RESPONSE`
- `MATCHING`
- `DRAG_DROP`
- `ORDERING`
- `HOTSPOT`
- `DIAGRAM_LABELING`
- `GRAPH_INTERACTION`
- `MEASUREMENT`
- `CODE_EXECUTION`
- `SIMULATION`
- `VIRTUAL_LAB`

Additional primitives found useful during repository and product analysis are
fill-in-the-blank, dropdown completion, categorization, image selection,
timeline ordering, table or grid response, equation or symbolic response,
drawing or construction, voice response, handwriting, file or artifact
submission, branching scenarios, terminal or command-console interaction,
data-table and spreadsheet manipulation, packet or log analysis, and
sensor/time-series interpretation. These are design vocabulary, not an enum
or database migration in this sprint. Phase A must decide which are base
primitives, which are composed experiences, and which require specialized
renderers.

### Simulation execution and evidence model

The conceptual execution loop is:

`Initial State -> Learner Actions -> State Transitions -> Final State -> Validation / Scoring -> Mastery Evidence`

The definition owns allowed objects, controls, actions, transitions, and
validation rules. The execution policy owns mode-specific permissions. The
runtime produces a deterministic event record. A scorer interprets that
record without mutating the simulation itself. Mastery consumes the resulting
evidence without owning rendering or assessment policy.

A simulation may evaluate any relevant subset of:

- correct final state;
- correct procedure and required intermediate states;
- sequence of actions;
- unsafe or prohibited actions;
- unnecessary actions;
- number of attempts or resets;
- hint and scaffold usage;
- time only where speed is instructionally relevant;
- successful diagnosis and troubleshooting;
- recovery from mistakes;
- explanation or reasoning after completion; and
- integrity or accommodation context needed to interpret the attempt fairly.

No activity is required to use every dimension. A Grade 1 manipulative, a
chemistry safety procedure, and a network troubleshooting exam need different
evidence policies.

Action capture should eventually distinguish learner intent, accepted or
rejected action, before-state reference, after-state reference, timestamp or
logical sequence, tool use, hint/scaffold context, safety consequence, and
offline synchronization identity. Published definitions and scoring rules
must be version-addressable so an attempt can always be evaluated against the
exact contract the learner received.

### Data-driven authoring preference

The target is a reusable, data-driven engine capable of executing thousands of
authored activities, not a bespoke React application for every question.
Conceptual responsibilities include:

- `InteractiveActivity`: learning objective, mode eligibility, curriculum and
  provenance links, accessibility alternatives, and renderer selection.
- `SimulationDefinition`: environment, objects, controls, starting state,
  valid actions, rendering requirements, and offline requirements.
- `SimulationState`: versioned serializable state with explicit derived versus
  authoritative fields.
- `SimulationAction`: typed learner intent with validation and safety bounds.
- `StateTransition`: deterministic accepted transition or explicit rejection.
- `ValidationRule`: state, procedure, safety, or reasoning condition.
- `ScoringRule`: policy that converts validated evidence into an assessment
  result.
- `FeedbackRule`: mode-aware feedback, hint, explanation, or remediation.
- `MasteryEvidence`: objective-linked evidence emitted after evaluation.

These are conceptual names only. They are not proposed Prisma models. Phase A
must first reconcile them with the existing Zod `SimulationDefinitionSchema`,
the typed `LabDefinition` registry, `VirtualLab`/`LabSession`, assessment
attempt records, P2 provenance, and P5-A package manifests.

Renderer selection must use a governed registry. Arbitrary renderer names or
untrusted executable code from generated content must fail closed. Definitions
may declare objects, controls, starting state, valid actions, transitions,
success and failure conditions, feedback, scoring, accessibility metadata,
offline capability, asset budgets, and rendering requirements. Deterministic
validation must sit between authored data and execution.

### 2D and 3D rendering strategy

Interactive does not mean 3D. Use the least expensive rendering mode that
preserves the learning objective.

2D is normally preferable for BIOS or UEFI screens, operating-system and
cloud-console concepts, command lines, networking configuration, packet or
log analysis, maps, graphs, timelines, code, dashboards, forms, diagrams, and
many assessment interactions. These experiences need faithful state and
procedure more than simulated depth.

Use 3D only when spatial manipulation materially improves learning, such as
laboratory equipment, anatomy, molecules, machinery, engineering systems,
physical assembly, tools, and spatial science concepts. A 3D definition must
also declare device capability and asset requirements plus a meaningful 2D,
guided physical, interactive-diagram, or printable fallback. The current
repository has 3D planning metadata but no 3D renderer or 3D runtime.

### Domain coverage

The same runtime family must generalize across subjects:

- **Computer and IT:** BIOS/UEFI configuration, Secure Boot, TPM or measured
  boot comparison, firmware/bootloader/kernel/configuration-state diagnosis,
  hardware identification, PC assembly, operating-system settings, Windows
  and Linux administration, command-line exercises, networking, IP
  configuration, router/switch configuration, cybersecurity logs, packet
  analysis, troubleshooting, coding, debugging, and governed cloud-console
  concepts. A learner should sometimes work inside a simulated computer and
  be assessed on the actions performed and state achieved.
- **Chemistry:** choose equipment, fill containers, measure liquids, mix
  substances, manipulate temperature, perform titration, observe reactions,
  and follow safety procedure.
- **Physics:** construct circuits, measure voltage/current, explore force and
  motion, optics, machines, electricity, waves, and experimental measurement.
- **Biology:** use microscopes, investigate cells and anatomy, model
  ecosystems and genetics, and inspect specimens.
- **Mathematics:** manipulate number lines, rulers, protractors, compasses,
  graphs, coordinate planes, geometry constructions, algebra manipulatives,
  and measurement.
- **Engineering and TVET:** electrical wiring, solar systems, engines, tools,
  construction, plumbing, carpentry, machinery, and fault diagnosis.
- **Geography:** maps, elevation, weather, climate, population, and geographic
  datasets.
- **Social studies and history:** maps, timelines, source and artifact
  investigation, evidence comparison, and historical decision scenarios.

The list describes capability targets, not a commitment to build every domain
in Phase A. Licensing, sandboxing, cybersecurity, and subject-safety review
apply where relevant.

### Age-adaptive experience

Lower grades must not receive a smaller version of a senior-secondary
interface. Grade 1-4 experiences should use large touch targets, strong visual
and icon cues, narration where useful, minimal text where appropriate,
animation with reduced-motion alternatives, direct manipulation, and short,
developmentally appropriate steps. For example, a Grade 1 learner can drag
one object into a group of two and observe the total before seeing `2 + 1` as
abstract notation.

Interaction density, reading load, independence, tool complexity, feedback,
and navigation should increase progressively across early primary, upper
primary, junior secondary, and senior secondary. Age adaptation changes the
experience contract and pedagogy, not only CSS scale.

### Student Toolbelt integration

Reuse `components/toolkit/` and `lib/toolkit/toolRegistry.ts`. The existing
registry already provides calculators, digital ruler, protractor, coordinate
grid, number line, fraction visualizer, multiplication table, periodic table,
unit converter, timer/stopwatch, and dictionary with contextual matching.

Extend that registry, rather than creating a simulation-only toolkit, for
compass, scratchpad, formula/reference sheets, richer graphing, accessibility
tools, lab notebook, balance, thermometer, glossary, text-to-speech, zoom,
and high contrast where required. Assessment policy must explicitly allow,
deny, or configure tools for each activity and mode. Server category flags are
deployment controls, not a substitute for per-assessment permission policy.
Tool availability and relevant tool use must be included in attempt context so
scores remain interpretable.

### Curriculum V2 boundary

Curriculum V2 determines **what** structured experience should exist:
objective, pedagogy intent, interaction opportunity, required objects and
tools, expected observation or response, misconception, accessibility
adaptation, and fallback. Learner Experience V2 determines **how** an approved
definition executes on a learner's device. The assessment runtime determines
mode and integrity policy. The mastery engine determines **what the learner
demonstrated** from evaluated evidence.

Current curriculum code already contains a narrow, deterministic precedent:
`PseudoLabSchema`, `SimulationDefinitionSchema`,
`ThreeDLabDefinitionSchema`, and `generateLessonLabSimulationBundle()` create
approved templates for a few signaled topics. `LessonDeliveryClient.tsx`
renders a small set of hard-coded renderer keys. Curriculum V2 must extend and
govern this seam, not claim it is absent and not treat the current narrow
shape as the final contract. Future generation should be able to request a
simulation opportunity, lab, manipulative, diagram interaction, experiment,
drag/drop activity, guided practice, or assessment simulation without
emitting executable application code.

### Mastery and adaptive learning boundary

Interactive attempts should emit objective-linked mastery evidence. A learner
who configures a network successfully may provide stronger evidence than a
learner who recognizes the correct configuration among four choices, but this
sprint defines no weights. A future evidence policy must distinguish activity
type, mode, assistance, procedure quality, validation confidence, provenance,
and accommodation context before the existing mastery and adaptive engines
consume the result.

Reuse `lib/mastery/masteryService.ts`, `lib/adaptive/updateMastery.ts`, and
`lib/student/adaptiveRecommendations.ts`. Do not let each renderer update
mastery independently. The current assigned-lab path already demonstrates a
coarse score-to-mastery bridge; Phase A must define a common evidence adapter
before expanding it.

### Offline-first strategy

Simulations must declare offline capability and asset tiers. Lightweight 2D
activities should be fully packageable. Downloaded definitions, renderer
assets, starting state, action logs, checkpoints, answers, and submission
identity should support offline execution and later idempotent synchronization.
The exact definition and scoring revision used offline must remain verifiable.

Extend the existing offline queue, IndexedDB patterns, lesson cache, signed
availability manifests, revocation behavior, and P5-A signed package model.
Do not create a second simulation-only sync stack. Large 3D assets may use
optional downloadable packs; when unavailable or revoked, the runtime should
select the declared lower-resource equivalent without silently changing the
learning objective or assessment conditions.

### Accessibility and equivalent mastery paths

Accessibility is definition-time and renderer-time work. Each experience must
consider keyboard operation, programmatic names and state, screen-reader
semantics where possible, non-color-only indication, captions, narration,
reduced motion, touch and motor accessibility, low-literacy support,
alternative controls, and assessment accommodations.

Where the primary simulation cannot be made fully accessible, provide an
equivalent mastery path that measures the same objective rather than an easier
or unrelated task. Accommodation policy must be recorded with the attempt and
must not be confused with integrity failure. Extend the existing accessibility
mode, tool accessibility patterns, audio player, and low-literacy design
precedents; the student experience still needs a coherent mounted control and
simulation-specific standards.

### Teacher Experience V2 connection

Teacher Experience V2 should eventually let an authorized teacher assign and
preview approved simulations, choose learn/practice/assessment mode, configure
permitted tools and retry/feedback policy within governance bounds, inspect
attempts and relevant action histories, understand procedure or misconception
failures, assign remediation, and inspect mastery evidence. Action histories
must be role-scoped, tenant-scoped, age-appropriate, and limited to legitimate
educational need. No teacher UI is implemented in this sprint.

### Authoring, AI safety, and governance

Valid JSON is not trusted assessment content. AI-generated or imported
definitions require:

- schema validation and a permitted renderer/action registry;
- deterministic transition, scoring, safety, and resource-budget validation;
- curriculum objective, standard, source, rights, and provenance linkage;
- age, subject, accessibility, offline, and assessment-correctness review;
- adversarial and impossible-state testing;
- qualified review through P2-B-compatible workflows;
- P2-C-compatible authority and evidence boundaries;
- versioned drafts, immutable published revisions, supersession, revocation,
  and audit evidence; and
- a reproducible link from every attempt to the exact published definition,
  scoring policy, runtime version, and accommodation policy used.

Reuse P2-A provenance/version integrity, P2-B qualified review, P2-C authority
boundaries, existing audit logging, tenant isolation, RBAC, and P5-A
signed/revocable packages. Do not invent parallel governance. Generated
definitions remain drafts until the appropriate deterministic and human gates
approve them.

### Repository reconciliation and disposition

| Existing system | Evidence | Disposition | Learner Experience V2 direction |
|---|---|---|---|
| Typed virtual-lab runtime | `lib/labs/runtime/`, `lib/labs/registry.ts`, subject action/state/validator modules | **EXTEND** | Preserve deterministic actions and transitions; adapt to a versioned definition/event/scoring contract |
| Existing interactive lab components | `components/labs/`, `LabShell`, subject scenes and fallbacks | **REUSE** | Keep as reference renderers and migrate through adapters; do not rewrite all labs before the contract is proven |
| Lesson simulation schema and renderer | `lib/schemas/labSimulation.ts`, `lib/curriculum/labSimulation.ts`, `LessonDeliveryClient.tsx` | **EXTEND** | Generalize the narrow schema and replace hard-coded renderer branching with a governed registry over time |
| Assigned practical-lab system | `VirtualLab`, `LabSession`, `LabSessionClient`, student/teacher lab APIs | **EXTEND** | Preserve guided physical lab, observations, teacher review, offline draft, audit, and coarse mastery seams; unify identity and evidence contracts later |
| Student Toolbelt | `components/toolkit/`, `lib/toolkit/toolRegistry.ts` | **REUSE** | Add missing tools and per-activity assessment policy in the existing registry |
| Lesson viewer and slide parsing | `LessonDeliveryClient.tsx`, lesson pages, `parseToSlides.ts`, `LessonAudioPlayer.tsx` | **EXTEND** | Extract a first-class player and scene contract without building a parallel lesson product |
| Lesson quiz, exams, and adaptive practice | `lessonQuiz.ts`, `LessonQuizPanel`, `ExamQuestion`, WAEC/adaptive practice | **EXTEND** | Preserve working MCQ and remediation flows as one interaction adapter inside a broader assessment player |
| Essay and code grading | `app/api/grading/essay`, `app/api/grading/code`, `GradedSubmission` | **REUSE** | Integrate as specialized free-response and code-execution evidence adapters; keep sandbox and advisory-grade controls |
| Generic assessment persistence | `Assessment`, `AssessmentItem`, `Submission`, `AssessmentAttempt` | **EXTEND** | Reconcile overlapping attempt shapes during Phase A; do not add another attempt store by default |
| Mastery engine | `lib/mastery/`, `lib/adaptive/updateMastery.ts` | **EXTEND** | Accept a governed evidence-strength contract instead of renderer-specific direct writes |
| Adaptive recommendation engine | `lib/student/adaptiveRecommendations.ts`, adaptive practice routes | **EXTEND** | Consume simulation evidence for remediation later; do not invent weighting now |
| Offline and signed availability infrastructure | lesson cache, offline queues, IndexedDB drafts, content manifests, P5-A direction | **REUSE** | Extend package and sync envelopes to definitions, assets, action logs, and scored submissions |
| Accessibility and low-literacy foundations | `AccessibilityToggle`, `accessibilityMode.ts`, toolkit semantics, `UX_LOW_LITERACY.md` | **EXTEND** | Mount a coherent student experience and define renderer-level equivalents and accommodations |
| Help Me Understand | `StudentLessonHelpPanel.tsx` and grounded tutor routes | **EXTEND** | Expose it through learn/practice policy with simulation state context; disable unless assessment policy permits |
| Legacy/historical roadmaps and demo simulators | Superseded plans and platform demo activity routes | **UNRELATED** | Do not use them as the Learner V2 runtime contract |

No currently reviewed subsystem is marked **REPLACE** or **DEPRECATE** in this
capture. Phase A should prove migration adapters before making either decision.

### Architectural conflicts and convergence requirements

Repository discovery found real overlap that must be resolved before a full
build:

1. `LabId` lists 19 identifiers while the typed registry exposes 12. Seven
   page-specific or legacy identifiers are not registered, including singular
   and plural naming variants. A canonical identity and alias strategy is
   required.
2. Interactive labs, lesson `SimulationDefinition`, and database-backed
   `VirtualLab`/`LabSession` are three related but separate contracts. They
   must converge through adapters rather than a fourth runtime.
3. The lesson simulation renderer is data-fed but still branches on a few
   hard-coded `rendererKey` values inside `LessonDeliveryClient.tsx`; this
   cannot safely scale to thousands of authored activities.
4. The typed lab runtime is deterministic but its general `LabSession` type is
   not the durable action-event record described here. Database `LabSession`
   stores observations, conclusions, score, and analysis, not full state
   transitions.
5. Main lesson quiz, exam, WAEC, and adaptive practice experiences are MCQ
   shaped, while essay and code grading exist as separate specialized paths.
   There is no unified multi-interaction assessment player.
6. Several overlapping assessment/attempt persistence models exist. Phase A
   must map ownership and migration before proposing schema changes.
7. Current curriculum lab templates can be stamped `approved: true` by
   deterministic generation/factory code. That narrow legacy behavior must
   not become the trust model for AI-authored assessment simulations.
8. Toolbelt category flags and contextual matching exist, but a durable
   per-assessment permission policy does not.
9. Offline practical-lab drafts and submissions exist, but interactive action
   histories and definition-version pinning are not yet covered by one signed
   synchronization contract.
10. 3D planning schemas exist without a 3D renderer, dependency, device-budget
    policy, or accessible equivalent contract.

### Architectural dependencies

Implementation remains dependent on:

- closure of the active foundation sequence and explicit authorization to
  begin Phase A;
- P2-A provenance and immutable revision semantics;
- P2-B qualified review and reviewer authority;
- P2-C source/authority boundaries where curriculum and assessment claims are
  involved;
- P5-A signed packs, revocation, asset budgets, and offline synchronization;
- stable RBAC, tenant isolation, audit, safeguarding, and AI cost controls;
- a reviewed assessment integrity and accommodations policy;
- renderer sandbox, licensing, and security decisions for code, operating
  system, network, packet, and cloud simulations; and
- device performance budgets for low-end Android hardware and optional 3D.

### Recommended future implementation phases

These phases refine, and do not reorder, the approved major program:

1. **Phase A0, contract convergence:** inventory all three current simulation
   contracts and overlapping attempt stores; decide canonical identities,
   definition/version/event envelopes, renderer registry, execution policy,
   scoring boundary, accessibility metadata, and P5-A package extension.
2. **Phase A1, one vertical prototype:** prove one definition across learn,
   practice, and assessment modes with 2D rendering, tool policy, offline
   action capture, deterministic scoring, accessibility alternative, and
   mastery-evidence output. Use adapters to current systems. Do not ship a
   broad lab catalog.
3. **Pause for Phase B Curriculum V2:** make curriculum authoring target the
   proven contract and governance flow.
4. **Phase C Global Pedagogy Intelligence:** select and sequence approved
   experience types without owning their renderers.
5. **Phase D runtime build:** expand interaction primitives, assessment player,
   2D simulation library, computer/IT environments, STEM/TVET labs, and only
   then justified 3D renderers, each with offline and accessibility gates.
6. **Phase E Teacher Experience V2:** assignment, preview, policy, attempt
   review, remediation, and evidence views.
7. **Phase F adaptive expansion:** calibrate evidence strength and use it for
   remediation, enrichment, and progression after fairness and validity
   review.

### Explicit non-goals for this capture sprint

This sprint does not create runtime code, components, APIs, schemas, enums,
migrations, database rows, feature flags, deployments, generated activities,
mastery weights, scoring weights, teacher UI, 3D assets, Curriculum V2, or a
Learner Experience V2 implementation. It does not mutate staging or
production. It does not alter current P2-A/B/C remediation work or the
foundation sequence. The sole deliverable is canonical architecture and
roadmap documentation.

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
  (compass, thermometer, balance, lab notebook, formula sheet,
  scratchpad, glossary, text-to-speech, zoom, high contrast)  -  not to
  rebuild the tool system.
- **Virtual Lab Engine (Workstream F)  -  a real object/action/state model
  already exists**, not just descriptions of experiments.
  `lib/labs/runtime/applyLabAction.ts` and
  `lib/labs/runtime/validateLabAction.ts` implement exactly the
  action-causes-observable-state-change loop Workstream F describes. The
  public `LabId` union contains 19 identifiers, while 12 are wired through
  the typed `labRegistry`; additional page-specific labs and singular/plural
  aliases exist outside that registry. Subject pages cover pendulum, molecule
  motion, human heart, cell division, cell structure, chemical reaction,
  earthquake waves, ecosystem balance, electric circuit, gravity, light and
  shadow, periodic table, simple machines, tectonic plates, water cycle, wave
  motion, and weather system. Shared shell/chat/fallback components exist
  (`LabShell.tsx`, `LabChatPanel.tsx`, `LabFallback.tsx`  -  a real
  low-resource-fallback precedent for Workstream O). AI-assisted lab
  narration/guidance exists at `lib/labs/ai/explainLabState.ts` and
  `lib/labs/ai/planLabAction.ts`. A separate assigned-practical-lab route uses
  `lib/ai/lab/labAnalyzer.ts` to score submitted observations when that
  feature path is enabled. Lesson-embedded lab panels already exist
  (`LessonLabPanel.tsx`, `GravityLessonLabPanel.tsx`), which is a working
  precedent for Workstream A's "Activity/Lab" lesson-structure slot. What
  does **not** exist yet: 3D rendering (Workstream G), a generalized and
  governed curriculum-generation contract for arbitrary interactions
  (Workstream I), or one unified evidence contract across interactive and
  guided-physical labs (Workstream H).
- **A narrow data-driven lesson simulation seam already exists.**
  `lib/schemas/labSimulation.ts` defines `PseudoLabSchema`,
  `SimulationDefinitionSchema`, and a 3D planning shape;
  `lib/curriculum/labSimulation.ts` deterministically emits a few topic-bound
  templates; and `LessonDeliveryClient.tsx` renders their range, toggle,
  choice, step, and ordering inputs. This is important prior art, but the
  renderer still hard-codes a few `rendererKey` branches and does not provide
  the general action-event, mode-policy, scoring, or mastery contract captured
  in this section.
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

### Exists only as narrow or disconnected shapes (the real gap)

- **The main learner quiz/exam/practice players are single-choice MCQ shaped.**
  `lib/ai/lessonQuiz.ts` defines exactly one question shape: `{ id,
  question, options: string[], correctIndex: number, explanation }`,
  always exactly 5 AI-generated questions per lesson
  (`components/student/LessonQuizPanel.tsx`, `lib/offline-quiz-attempts.ts`
  for offline attempt queuing). `LessonGapAnalysis` (missed concepts +
  reread suggestion) is a real, working remediation-on-failure precedent
  worth preserving in the V2 interaction/mastery contract. Separate essay
  and sandboxed code-grading APIs exist, and generic assessment submissions
  accept JSON, but those are not integrated into one multi-interaction
  learner player. There is no dedicated assessment-runtime component
  (numbered navigation,
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
- **No 3D rendering runtime exists.** Planning metadata exists in
  `ThreeDLabDefinitionSchema`, but Workstream G implementation is entirely
  new.
- **The structured curriculum-generation contract is narrow, not absent.**
  Current curriculum code can emit pseudo labs and a few deterministic
  `SimulationDefinition` templates, but it does not express the generalized
  objective/mode/objects/actions/transitions/scoring/mastery contract
  Workstream I describes. This is the exact seam Phase A must stabilize
  before Curriculum V2 is rebuilt.
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

Today's main lesson quiz, exam, and adaptive-practice players support
single-choice MCQ (`lib/ai/lessonQuiz.ts` and related flows), while separate
essay and sandboxed code grading paths are not yet unified into the player.
Minimum future type set: single-choice MCQ,
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
work: extend the registry with compass, thermometer, balance, lab
notebook, formula sheet, scratchpad, glossary, text-to-speech, zoom, high
contrast, translation/language support; and define assessment-level tool
permission policy (conceptual shape:
`calculatorAllowed`/`calculatorMode`/`rulerAllowed`/`protractorAllowed`/
`referenceSheetAllowed`/`scratchpadAllowed`) so a practice activity and a
WAEC-style exam can permit different tools from the same registry.

### Workstream F  -  Virtual Lab Engine

**Foundation already built**  -  see discovery findings above
(`lib/labs/runtime/applyLabAction.ts`,
`lib/labs/runtime/validateLabAction.ts`, 12 typed registry entries plus
additional page-specific lab implementations). Students
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
virtually -> perform physically -> record/analyze digitally. The
database-backed `VirtualLab`/`LabSession` path and `LabSessionClient` already
provide a narrow guided-practical foundation with materials, safety notes,
steps, observations, analysis questions, offline drafts, and teacher review.
Extend that foundation and reconcile it with the interactive runtime;
`LabFallback.tsx` is a separate low-resource rendering precedent.

### Workstream I  -  Curriculum-generated interactions

Curriculum V2 (Phase B) must generalize the existing narrow lab/simulation
seam so it specifies learning experiences, not just text or a few hand-coded
templates.
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
