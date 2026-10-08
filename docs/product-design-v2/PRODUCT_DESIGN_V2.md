# Product Design V2 foundation

Status: authoritative product implementation blueprint; documentation only. Audited 8 October 2026 against `a5d0afd09bf8dd3a3919449022924afb16e69515` (main, including Tutor Grounding V2 PR #174). This is not a certification that V2 is implemented or that LiberiaLearn already outperforms competitors.

## North star and scope

LiberiaLearn says: **Here is what you should do next, why it matters, and help is available right here.** It must be easier to understand than Canvas, more engaging than Blackboard, more adaptive than either, better for learning rather than course administration, usable with weak connectivity, appropriate for children and older learners, and teacher-first without an administrative maze. A course dashboard recolored dark fails this bar.

Product decisions here govern presentation, navigation and interaction. Existing educational, authorization and offline contracts govern data and actions. Completion is not mastery. No UI, AI response, local cache or device score may manufacture mastery, evidence acceptance, curriculum approval or a next-action decision.

This mission changes only this directory. It does not authorize runtime redesign, deployment, curriculum generation/schema/projection/provenance changes, or modifications to SLM, DecisionModel, Learning Orchestrator, Tutor, assessment or learner-evidence authority. Curriculum V2 remains Claude's track. Read references to those seams; do not take ownership of them.

## Reading and decision precedence

| Contract | Use |
| --- | --- |
| [Competitive benchmark](COMPETITIVE_UX_BENCHMARK.md) | Public evidence, inferred opportunities and journey targets |
| [Current inventory](CURRENT_SURFACE_INVENTORY.md) | Existing routes/components, source findings, dispositions and coverage |
| [Design system](DESIGN_SYSTEM_V2_CONTRACT.md) | Tokens, component reuse, ages, states and accessibility |
| [Migration](PRODUCT_DESIGN_V2_MIGRATION.md) | Bounded PRs, seam dependencies and evidence requirements |
| [Scorecard](PRODUCT_DESIGN_V2_SCORECARD.md) | Hard budgets and release blockers |

Educational authority rules outrank product presentation. Explicit user-approved visual direction outranks legacy styling. This contract refines Phase A's presentation and IA without superseding its authority contracts. Existing [Phase A architecture](../architecture/learner-experience-v2/PRODUCT_REDESIGN_V1.md) and [learner experience architecture](../architecture/LEARNER_EXPERIENCE_V2.md) remain the integration baseline. If a presentation cannot satisfy the scorecard with the existing seam, record the missing capability and route it to the owner; do not patch authority from a UI PR.

## Approved Figma baseline

[Product Design V2](https://www.figma.com/design/PoHohwJe6ZrVdsIziuDKlK) is the approved visual baseline, not a competitor design to imitate. Read-only metadata and node-property inspection on 8 October confirmed page `0:1`, named `01 — Product Redesign V2`, and the following anchors:

| Anchor | Node | Confirmed structure |
| --- | --- | --- |
| [Student Today V2](https://www.figma.com/design/PoHohwJe6ZrVdsIziuDKlK?node-id=1-2) | `1:2` | Five-destination rail, next-action hero, today's plan, progress preview |
| [Student Learning Experience V2](https://www.figma.com/design/PoHohwJe6ZrVdsIziuDKlK?node-id=1-123) | `1:123` | Scene rail, learning stage, support context; eraser Back at `5:18` |
| [Teacher Command Center V2](https://www.figma.com/design/PoHohwJe6ZrVdsIziuDKlK?node-id=1-220) | `1:220` | Attention first, today's classes, class intelligence, planning/grading actions |
| [Grades 1–7 Interaction Language](https://www.figma.com/design/PoHohwJe6ZrVdsIziuDKlK?node-id=5-26) | `5:26` | Tactile younger controls; cleaner older controls; default, hover, press and focus cues |
| Approval note | `8:2` | Approved 8 October; charcoal, Liberia gold, restrained green and role-first hierarchy |

The three anchor screens are 1440×1024 desktop frames. No phone anchor or local variable collection was returned by inspection. Mobile layouts below are implementation proposals governed by the scorecard. Screenshot export returned a hosted asset, but its local download produced no usable image; no raster visual review is claimed. Frame properties and text were inspected directly. Before implementation signoff, compare rendered desktop screenshots to the linked nodes and obtain mobile browser evidence. Fixture names, sample counts, mastery growth percentages and attendance metrics are illustrative, never production data requirements.

## Product principles and major decisions

1. One dominant next learning action. Server authority supplies it; presentation explains its reason and preserves identity. Required teacher work and due dates remain visible without silently replacing a governed action.
2. Show an ordered plan rather than a menu of everything. Course browsing remains available when the learner has no usable assigned action.
3. Keep task, goal and assistance together. Scene identity and objective scope survive help and lab transitions. AI is contextual and bounded, with a teacher path when unavailable.
4. Show learning meaning. Separate activity completion, accepted evidence, confidence, mastery and formal grades. Use strengths and next practice, not leaderboard or streak pressure, to explain progress.
5. Visible affordance is mandatory. A border, raised surface, action verb and direction cue make controls recognizable before interaction. Static insight panels must not masquerade as buttons.
6. Charcoal is the foundation, gold the primary action accent, green the restrained progress/success accent. Pink may remain an eraser material detail, not the success semantic.
7. Mobile is its own composition. Reflow stages, support and navigation; do not shrink a desktop three-column view. Focused lesson/lab screens have Back and task controls instead of competing global navigation.
8. Offline capability is per resource and operation. Saved locally, queued, acknowledged and accepted are different states. Network failures must not become empty work, zero mastery or a false success.
9. Preserve functionality while consolidating entry points. Route aliases can remain; remove duplicate navigation only after contextual access and deep-link compatibility pass.
10. Common primitives with age/density variants, not parallel design systems for every role or grade.

## Competitive strategy: ADOPT / IMPROVE / REIMAGINE / DIFFERENTIATE

This is the authoritative decision framework. Apply it to a capability and user job, not to a competitor's entire product or visual style. The [capability matrix](COMPETITIVE_UX_BENCHMARK.md#competitive-capability-matrix) owns the individual decisions; the [migration contract](PRODUCT_DESIGN_V2_MIGRATION.md#competitive-disposition-required-for-every-implementation-pr) makes them implementable; the [scorecard](PRODUCT_DESIGN_V2_SCORECARD.md#competitive-strategy-review-gate) determines whether the result merits release or a competitive claim.

| Disposition | Decision and rationale | Required proof |
| --- | --- | --- |
| ADOPT | A competitor effectively solves the underlying problem. Preserve the useful interaction/product concept while adapting it to LiberiaLearn's users, visual system, accessibility and connectivity environment | Familiar task behavior and capability parity survive; no visual copying or unnecessary relearning |
| IMPROVE | The concept is useful but avoidable friction remains. Keep it and improve speed, clarity, context, mobile use, accessibility, offline behavior or learning usefulness | Identify the friction, record the baseline and demonstrate the specified improvement |
| REIMAGINE | The conventional workflow organizes course administration rather than the learning/teaching goal. Change the experience around that goal instead of carrying forward the legacy workflow | The same user task becomes objectively easier or more useful, with preserved necessary capabilities; looking different is insufficient |
| DIFFERENTIATE | Existing LiberiaLearn architecture enables a materially different learning capability, beyond a prettier conventional feature | Name the real authorized seam, its current limitations and a successful end-to-end demonstration; no invented authority or unsupported exclusivity claim |

A capability may carry **ADOPT + IMPROVE** or **REIMAGINE + DIFFERENTIATE** when both rationales apply. ADOPT identifies what must survive; IMPROVE identifies what must change. REIMAGINE is a workflow choice; DIFFERENTIATE is an architecture-backed capability, so neither implies the other. A composite screen can contain several dispositions: Today reimagines the home workflow while adopting/improving agenda and Continue controls. These are separate capability decisions, not contradictory screen labels. Inventory migration dispositions (REUSE/REFINE/etc.) describe changes to existing code and are independent of competitive dispositions.

Public feature documentation demonstrates available concepts, not universal usability excellence. An ADOPT decision expresses our judgment that the underlying idea is useful; its usefulness and LiberiaLearn's improvement still require task testing. Do not manufacture differentiation where an established pattern works. Novelty is not the goal; better learning UX is the goal.

1. **DO NOT REINVENT SOLVED PROBLEMS.** Reuse understandable, effective patterns from mature learning products instead of creating new interaction conventions for ordinary tasks.
2. **DO NOT COPY PRODUCT DEBT.** Do not inherit confusing hierarchy, module hunting, clutter or course-administration-first interaction simply because it is conventional. These are risks to test, not assertions about every competitor installation.
3. **FAMILIAR WHERE FAMILIARITY HELPS.** Calendars behave like calendars; messages like messages; due dates look like due dates; Back returns without deleting work.
4. **INNOVATE WHERE LEARNING BENEFITS.** Spend novelty on learning flow, contextual Tutor, authorized adaptive progression, mastery understanding, labs, teacher intervention, offline learning and age-banded interaction.
5. **BETTER BEFORE DIFFERENT.** A changed workflow must demonstrate lower friction or better learning/task outcomes. Preserve grades, communication, records and other school-required capabilities.
6. **NO FALSE COMPETITIVE CLAIMS.** Do not claim superiority until measured. The matrix describes strategy; the scorecard establishes evidence. Architecture-backed differentiation is not proof of better learning outcomes or unique market ownership.

## Role-specific experience model and IA

### Student

Primary navigation is exactly **Today · Learn · Labs · Progress · Help**. Preserve the existing destination IDs in [studentNavigation.ts](../../lib/learner-experience/studentNavigation.ts); extend route membership in a later UI PR. Today is the canonical landing surface. Help initially keeps the existing tutor URL as a compatibility address while becoming a support hub. Do not invent a new help route simply to match a label.

| Destination | User job | Existing features placed contextually |
| --- | --- | --- |
| Today | Begin/resume the correct task and understand the day | Assigned work, homework, due exams, required discussions, upcoming events and live classes; catch-up work and offline state |
| Learn | Understand and follow a learning path | Subject → unit → lesson, practice/adaptive activities, exams/WAEC where eligible, textbooks as resources; full assigned-work list as a named secondary section |
| Labs | Explore and continue approved practical learning | Existing unified For You, Assigned, Continue, Library, Completed sections; preserve lesson → lab → lesson continuity |
| Progress | Understand strengths, support needs and evidence | Skill/mastery summaries, history, portfolio, passport, certificates/certifications, report cards and transcript under records |
| Help | Get assistance and resolve access/connectivity issues | Current-context tutor, teacher flag, messages, accessibility/language preferences, downloads/packs, offline lessons and sync status |

Assignments remain accessible from Today and Learn; details stay deep-linkable. Discussion belongs inside the relevant class/learning task, with required replies on Today and general conversation through Help. Exams belong to Learn's checks/assessment section and due work on Today; UI retains assessment policy. Certificates and portfolio belong to Progress records. Messages belong to Help with a global unread entry. Textbooks belong to Learn resources. Events belong to Today calendar. Live meetings launch from their scheduled task and clearly require connectivity. Placement/onboarding are setup flows reached when authorized/needed, not permanent primary destinations. Capstone is a Learn project. Leaderboards are deferred optional Progress activities pending evidence of age-appropriate benefit; no functionality deletion is authorized.

Account/PIN, language, privacy and sign-out use profile/support utilities. WAEC and older-learner surfaces retain eligibility gates; Grades 1–7 styling does not force childish metaphors on older/adult learners. Complete route membership is in the inventory; Phase A currently omits some of these memberships.

### Teacher

Canonical landing: existing teacher dashboard becomes **Command Center**. Primary destinations follow the Figma anchor: **Command Center · Classes · Plan · Assess · Students · Reports** (six). Messages, search, notifications, help and profile are utilities with text labels/accessible names, not more competing primary tabs.

Command Center immediately answers: What do I need to do today? Which students need me? What am I teaching next? How is my class learning? Attention is based on existing authorized signals, with reason, freshness, class and a concrete review action. Connectivity-related missing activity must not be framed as proven disengagement.

| Destination | Secondary work |
| --- | --- |
| Command Center | Morning brief and alerts as sections; urgent grading/attendance work; next class and next lesson shortcuts |
| Classes | Class overview, attendance, roster, schedule/timetable, discussion, events, live/lab sessions |
| Plan | Curriculum browsing, standards, skills, lessons/edit/share, differentiation, labs, packs; governed publication/approval remains intact |
| Assess | Assignments/homework/exams, grading and gradebook; report-card drafting with authorized review |
| Students | Learner support detail, intelligence, placements, intervention history and teacher notes |
| Reports | Class performance, delivery/weekly reports, tutor insights and video analytics; drilldowns return to an actionable class/learner |

Training, onboarding, capstone and profile/settings are professional support utilities. Consolidate duplicate lesson creation, assignment creation, schedule and learner-detail entry points only after comparing payload and authorization contracts. AI drafts explanations, differentiation or plans in context and always shows a review step; it cannot publish, grade, approve interventions or make safeguarding decisions.

### Guardian

Primary proposal: **Child · Learning · Attendance · Messages**. Child switcher persists in every view and must never show another child's data while switching. Child overview leads with a plain-language strength, support need, upcoming work and one suggested family action. Learning groups progress, assignments, grades and report cards with explanations of confidence and evidence. Attendance includes events/calendar. Messages include teacher contact with the child/class already scoped. Linking, phone settings, privacy and onboarding are utilities. Do not equate a percentage with a child's ability or use technical mastery labels without explanation.

### School/admin and governance

School primary proposal: **School Health · Enrollment · People & Classes · Curriculum Deployment · Operations · Governance**. Health explains actionable school issues; enrollment groups invites/import/linking/placements; people groups teachers, classes and timetables; deployment shows approved coverage/readiness and review state without changing authority; operations groups communications/media/support/costs; governance groups audit, compliance, exports and access controls. Specialist operational tools remain secondary and permission-gated. MOE and platform scopes retain separate shells and tenant boundaries, with only role-relevant reports shown. Do not inject admin factory/agent/runtime vocabulary into teacher or student navigation.

## Anchor implementation behavior

### A. Student Today

Visual order: identity/date and compact connectivity status → dominant next action → today plan/assigned work → meaningful progress preview → secondary calendar/resources. On phones the next action and its reason must be visible in the first viewport (excluding mandatory consent). Desktop may use a rail and a secondary progress column. No row of generic KPIs ahead of the action. Figma's illustrative four metrics are subordinate to the product hierarchy; omit/relegate them if they breach density budgets.

The hero names the task, why it matters, progress within it and remaining work/time only when supported; unknown duration says “Time varies.” A primary activation reaches the server-selected task directly, including an existing governed practice/check if that is the decision. No intermediate chooser or duplicate Start is allowed. Read-only resume position cannot select a different canonical action. Show conflict between an unavailable governed action and teacher-required work explicitly; fallback may link to authorized assigned work/browsing but must not claim to be the governed recommendation.

Loading reserves space, error says the plan could not load with Retry, true empty state says no assigned work. Never show “No lessons scheduled” or zero work merely because fetch failed. Freshness labels reflect the last successful response, not the last attempt. Offline mode shows only verified available tasks and pending work; unavailable actions explain how to reconnect/download. Tutor entry names its context; no context means choose an authorized lesson or ask a teacher.

### B. Student Learning Experience

Preserve **Lesson → Scene → Objective** from the authorized payload. Display the current task and learning goal, “Scene n of m,” reachable scene navigation, and a single Continue/Finish action. Reuse Phase A's player, scene renderers, completion gates, progress storage and approved link seam. Presentation must not redefine the scene contract or infer new canonical scenes from prose.

Desktop: scene outline, central learning stage, goal/tools/help panel. Phone: central stage, compact scene selector and reachable help control; goal and hint cannot be buried exclusively in a collapsed tools section. Previous and eraser Back have distinct labels: previous scene versus leave/return. Eraser Back never means erase answers. Its accessible name says the destination (“Back to Learn” or “Back to lesson”); preserve the authorized return path, never trust an arbitrary external URL.

Hint, Explain Differently and Ask AI use the current server-resolved lesson/scene/objective; changing scene invalidates stale chat context or clearly labels old answers. Show teacher-approved/static help offline; live AI is unavailable. Tool policy and assessment restrictions remain authoritative, including disabled reason. Lab launch preserves originating experience/version/scene/objectives; return resumes the declared post-lab scene and reflection. Do not turn lab scores or local completion into mastery.

Reflection and formative checks retain responses across supported save/reload paths. Finish names actual status: “Lesson finished,” “Work saved on this device,” or “Evidence received” only when true. A mastery check uses the existing assessment handoff. “Mastered” requires canonical accepted mastery state, never Finish. Phase A's prototype finish currently constructs observations without sending/scoring them; production requires an owner-provided approved seam, not a UI-created writer.

### C. Teacher Command Center

Order: priority attention with concrete reasons/actions → today's classes and next teaching action → class learning changes → planning/grading/support. Deduplicate a learner with several signals but preserve all reasons in detail. Show missing/stale data as unknown, with timestamp and coverage. Review a learner before messaging or taking action. Numbers and AI summaries cannot invent a priority or intervention.

Initial view includes at most three priority issues and a clearly labeled total/See all. Today's class row links directly to the next lesson/planning action and attendance. ClassPulse explains a skill/misconception with evidence coverage and freshness; completion rates and average quiz scores cannot stand in for mastery. TeacherInsightCard supports one action, with supporting detail progressively disclosed. Phone/tablet turn rows into readable tasks; grading and specialist reports can remain full-screen secondary work. Bounded AI appears beside the planning/support job, not as an empty omnipotent chatbot hero.

## Product risks and handoff

P1: native authorized Curriculum V2 lesson/scene payload and production evidence handoff are prerequisites for player release; context continuity is not complete in the prototype; existing Today errors can masquerade as empty work; offline cache/queue policies vary by operation; contrast/focus and modal behavior need real browser verification. These block affected implementation releases, not this documentation mission.

P2: Figma has no inspected mobile anchors or token variables; age-band comprehension and metaphor effectiveness need child usability evidence; teacher navigation consolidation needs workflow parity review; guardian explanations need local-language comprehension checks; legacy aliases and optional competition features require usage evidence before retirement. [Migration](PRODUCT_DESIGN_V2_MIGRATION.md) assigns each risk to a bounded review.
