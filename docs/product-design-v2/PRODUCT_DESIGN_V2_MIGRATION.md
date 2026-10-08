# Product Design V2 bounded migration

Status: recommended future implementation PRs, not authorization to implement or deploy them in this mission. Foundation base `a5d0afd09bf8dd3a3919449022924afb16e69515`; review 8 October 2026. Every PR preserves server authorization, tenant isolation, existing release/assessment/evidence/Tutor policies and the Learning Orchestrator's next-action authority.

## Sequence and seam gates

PR 1 establishes scoped tokens/actions and Student Shell + Today; PR 2 refines discovery without replacing the governed Learn activity. PR 3 releases the lesson presentation **only after** Curriculum V2's owner supplies a reviewed native LessonExperience/scene seam. PR 4 Labs, PR 5 Progress, PR 6 Help follow. Teacher PRs 7–9, Guardian PR 10 and school/admin PR 11 follow validated student primitives. PRs 4–6 can prepare independently while PR 3 waits, but cannot claim scene integration complete before the seam is released.

Each PR is reviewable on its own, with a feature rollout boundary appropriate to the repository. Existing routes remain working until the new contextual entry points pass. No broad style replacement, bulk redirect deletion or shared educational DTO change is part of these PRs. Record missing backend display capabilities and hand them to the owning track instead of introducing a shadow projection. Product review needs real data, empty, stale, denied, error and offline states, not only ideal fixtures.

### PR 1 — Student Shell + Today V2

- Scope: common action/focus/status primitives, scoped V2 semantic token aliases, desktop rail/phone five-item nav, Today hero/ordered plan, compact offline status and meaningful progress preview. Consolidate `/dashboard` and `/student/dashboard` entry behavior toward Today while preserving authorized role routing and old links. Do not put a browse chooser between Today and a ready task.
- Existing routes/files: [dashboard](../../app/dashboard/page.tsx), [student layout](../../app/student/layout.tsx), [Today](../../app/student/today/page.tsx), [legacy dashboard](../../app/student/dashboard/page.tsx), [StudentPrimaryNav](../../components/learner-experience/StudentPrimaryNav.tsx), [studentNavigation](../../lib/learner-experience/studentNavigation.ts), [StudentSidebar](../../components/StudentSidebar.tsx), [globals.css](../../app/globals.css), [PencilButton](../../components/ui/PencilButton.tsx).
- Dependencies: inspect current role redirects and existing next-action payload/actions; no educational contract changes. If a supported next action cannot open in one activation, route the seam gap to its owner. No native scenes needed for the existing governed activity.
- Risk: P1 wrong action identity, failed requests rendered empty, duplicate navigation/prompt overlays, private cache/account switching; P2 desktop rail width and teacher/admin `/dashboard` compatibility. Keep rollback to old entry available without discarding local work.
- Tests: route/active-destination membership, authorized action selection/rendering, one activation, correct fallback/Retry, error versus empty, source freshness, partition switching; regression against [learner-experience route test](../../__tests__/learning-authority/learner-experience-route.test.ts), [offline discovery](../../__tests__/offline-discovery.test.ts), [accent contrast](../../__tests__/a11y.accentContrast.test.ts).
- Browser evidence: Figma Today at 1440, 360/390 phone task video, G1–3/G4–7 variants, keyboard/zoom, loading/offline/storage failure, pending/conflict status. Pass G01–G04, G08, G11–G15 for affected scope.
- Non-goals: new next-action ranking, mastery computations, global token remap, redesigning every linked page, removing assignments/exams/discussion.

### PR 2 — Learn navigation and learning discovery

- Scope: clearly separate current governed task from subject/unit/lesson discovery; expose assigned work, checks and resources as secondary sections. Preserve existing diagnostic/practice task interaction at `/student/learn` and old lesson entry paths; use the existing route rather than creating a second authority landing page.
- Files: [Learn](../../app/student/learn/page.tsx), [lessons index](../../app/student/lessons/page.tsx), [unit detail](../../app/student/units/[unitId]/page.tsx), [ThisWeeksUnits](../../components/student/ThisWeeksUnits.tsx), [UnitSequenceSidebar](../../components/student/UnitSequenceSidebar.tsx), [textbooks](../../app/student/textbooks/page.tsx), [assignments](../../app/student/assignments/page.tsx).
- Dependencies: PR 1 navigation and existing authorized discovery data; educational payload unchanged. Assessment/exam/WAEC eligibility remains intact.
- Risk: P1 current Learn is an actual governed activity, not merely a library; wrapping it in discovery could add a second Start or permit stale/offline submission. P2 unit browsing depth and long titles.
- Tests: direct activity availability, unknown/no-plan/error states, assignment and resource findability, locked/restricted item behavior, existing [learner-experience end-to-end authority test](../../__tests__/learning-authority/learner-experience-e2e.test.ts).
- Evidence: normal/empty/stale catalog, long unit names, phone browse and direct task activation traces; G01–G04, G08, G12–G15.
- Non-goals: Curriculum V2 authoring/projection, new recommendation engine, assessment rewrite or changes to learning authority.

### PR 3 — Lesson Experience V2 production presentation (seam gated)

- Scope: extend Phase A's player with approved tactile stage/eraser Back, age variants, visible hint/explain/AI context controls, scene progress and preserved lab/reflection continuity. Keep legacy read delivery for content without a released native seam.
- Files: [LessonPlayerV2](../../components/learner-experience/LessonPlayerV2.tsx), [SceneViews](../../components/learner-experience/SceneViews.tsx), [LabScene](../../components/learner-experience/LabScene.tsx), [StudentLessonHelpPanel](../../components/student/StudentLessonHelpPanel.tsx), [LessonDeliveryClient](../../app/student/lessons/[id]/LessonDeliveryClient.tsx), [legacy content page](../../app/student/lesson/[contentId]/page.tsx). Read, do not modify ownership of [types](../../lib/learner-experience/types.ts), [scene contract](../../lib/learner-experience/sceneContract.ts), [evidence adapter](../../lib/learner-experience/evidenceAdapter.ts) and [progress store](../../lib/learner-experience/progressStore.ts).
- Mandatory dependency evidence from Claude/authority owners: released learner-safe native LessonExperience with stable lesson/version/scene/objective identities; authorized production route adapter; release visibility and provenance preserved; approved lab links/return targets; assessment reference without private answer keys; correct evidence disposition/accepted handoff; compatibility behavior for legacy lessons; offline capability/trust/version behavior. If absent, this PR remains presentation preparation and cannot release production scenes. Do not fabricate the seam in UI code.
- Risk: P1 prototype finish currently does not send or score evidence, prototype is not production; scene change can leave stale help identity; media/practice need actual supported renderers; assessment content secrecy and local persistence. P2 younger-grade comprehension and mobile support layout.
- Tests: [scene-contract](../../__tests__/learner-experience/scene-contract.test.ts), [lesson-player](../../__tests__/learner-experience/lesson-player-v2.test.tsx), [lab-continuity](../../__tests__/learner-experience/lab-continuity.test.ts), [evidence-authority](../../__tests__/learner-experience/evidence-authority.test.ts), [tutor grounding](../../__tests__/tutor.grounding-v2.test.ts), plus focused scene-change/help and eraser return checks. Owners run seam-specific authority tests on their track.
- Evidence: approved learning anchor desktop comparison, phone lesson → lab → reflection → handoff video, keyboard focus/scene traversal, offline/degraded paths, no-context Tutor refusal, completed versus mastered copy. G01/G02, G05–G08, G11–G15.
- Non-goals: generator/schema/projection/provenance changes, new evidence writer, client grading/mastery, inferred canonical scenes, Orchestrator/SLM/DecisionModel or Tutor retrieval changes.

### PR 4 — Labs V2 presentation

- Scope: refine existing unified discovery and task-oriented cards, capability labels and objective/return controls; consolidate legacy entry affordances. Preserve For You/Assigned/Continue/Library/Completed and existing released-only filtering. For You can truthfully be empty until approved path links exist.
- Files: [labs index](../../app/student/labs/page.tsx), [canonical lab detail](../../app/student/labs/[labId]/page.tsx), [LabExperienceCard](../../components/learner-experience/LabExperienceCard.tsx), [LabExperienceHost](../../components/learner-experience/LabExperienceHost.tsx), [interactive-lab alias](../../app/student/interactive-labs/[labId]/page.tsx). Registry, links, launch and runtime authority stay owned by their existing systems.
- Dependencies: PR 1 primitives; PR 3 released scene integration to certify full continuity. Standalone released labs can be tested before PR 3.
- Risk: P1 draft lab exposure, lesson/objective mismatch, renderer performance and wrong return scene; P2 fifth secondary tab discoverability. UI does not choose capability tier by appearance.
- Tests: [labs-tab](../../__tests__/learner-experience/labs-tab.test.ts), [lab-routes](../../__tests__/learner-experience/lab-routes.test.tsx), existing continuity/evidence tests; cross-device local state/capability checks.
- Evidence: assigned/empty/unavailable cases and phone/desktop degraded runtime video with return identity; G05/G08/G11–G15.
- Non-goals: new lab engine, release/approval changes, runtime fidelity work, lab-score/mastery authority.

### PR 5 — Progress V2

- Scope: strengths/support needs/evidence confidence first, activity and formal records secondary. Consolidate certificate/portfolio/passport/report-card entry points while preserving all records and share/print permission behavior.
- Files: [progress](../../app/student/progress/page.tsx), [StudentProgressDashboard](../../components/student/StudentProgressDashboard.tsx), [MasteryBadge](../../components/adaptive/MasteryBadge.tsx), [WeeklyProgressChart](../../components/student/WeeklyProgressChart.tsx), [portfolio](../../app/student/portfolio/page.tsx), [certificates](../../app/student/certificates/page.tsx), [passport](../../app/student/passport/page.tsx).
- Dependencies: PR 1; existing authoritative mastery/evidence display payload. Missing confidence or freshness is unknown, not calculated by UI.
- Risk: P1 percentage/grade/completion confused with mastery, cached data implied current; P2 chart accessibility and child comprehension.
- Tests: API-to-display fixture tests for known/unknown/limited/conflicting evidence, records authorization/deep links, text equivalents and print/share parity.
- Evidence: grade-versus-mastery comprehension sessions, phone and screen-reader progress/records, stale/offline cases; G07/G08/G11–G15.
- Non-goals: new mastery scale, grade recalculation, evidence mutation, automatic certificate awards or public rankings.

### PR 6 — Help and contextual assistance V2

- Scope: Help hub behind compatible tutor URL; consolidate contextual AI, teacher flag/messages, static hints and access/connectivity recovery. One active assistance owner per task; fix dialog focus/Escape/restoration and keyboard/safe-area layout. Keep scene context work from PR 3 intact.
- Files: [AI tutor page](../../app/student/ai-tutor/page.tsx), [GlobalAssistantShell](../../components/rag/GlobalAssistantShell.tsx), [GlobalAssistantMount](../../components/rag/GlobalAssistantMount.tsx), [StudentLessonHelpPanel](../../components/student/StudentLessonHelpPanel.tsx), [messages](../../app/student/messages/page.tsx), [offline status](../../app/student/offline-status/page.tsx), [offline lessons](../../app/student/offline-lessons/page.tsx), [student help](../../app/help/student/page.tsx).
- Dependencies: PR 1 shell; PR 3 for native scene context; existing Tutor Grounding V2 API and teacher communication policies. No live AI offline queue.
- Risk: P1 stale/weak tutor identity, disconnected consent/safety controls, duplicate floating panels, incorrect unread-zero states; P2 help hub overload.
- Tests: existing grounding tests, missing/foreign/stale identity and disabled-AI UI cases, teacher message scope, modal focus, offline/static-help fallback; [offline sync browser test](../../e2e/offline-sync.spec.ts) and [hardening browser test](../../e2e/p5e-offline-hardening.spec.ts) when offline presentation changes.
- Evidence: one-action help from active scene, explain/hint/teacher path videos at phone/desktop; G06/G08/G11–G13/G16.
- Non-goals: new Tutor/provider/retrieval logic, child-data telemetry, autonomous teacher decisions, changing sync policy.

### PR 7 — Teacher Command Center + shell

- Scope: six destinations matching approved anchor; attention/today/learning/planning hierarchy; consolidate brief/alerts as initial-view sections; bounded contextual AI entry and utility messages.
- Files: [dashboard](../../app/teacher/dashboard/page.tsx), [teacher entry redirect](../../app/teacher/page.tsx), [TeacherNav](../../components/teacher/TeacherNav.tsx), [TeacherShell](../../app/teacher/TeacherShell.tsx), [TeacherMorningBrief](../../components/teacher/TeacherMorningBrief.tsx), [AlertBell](../../components/teacher/AlertBell.tsx), [brief](../../app/teacher/brief/page.tsx).
- Dependencies: validated shared primitives, existing authorized class/attention signals; no new risk ranking. Teacher test cohort required.
- Risk: P1 missing/stale evidence presented as learner failure; P2 hiding less common workflows during 20-to-6 navigation consolidation.
- Tests: destination parity for all 62 teacher pages, class/learner scope, missing-data/attention deduplication, notification routes; no writes triggered by AI summary.
- Evidence: approved teacher anchor comparison, initial-view prioritization, phone/tablet next lesson and support-detail trace; G09/G10/G12–G16 plus applicable G08/G11.
- Non-goals: new early-warning model, automated interventions, grading engine, admin navigation redesign.

### PR 8 — Teacher Plan and Classes

- Scope: consolidate lesson creation aliases, class/roster/attendance/schedule/discussion paths; next lesson and planning with standards/skills/differentiation secondary. Preserve distinctions in payload and authorization until proven equivalent.
- Files: [lessons](../../app/teacher/lessons/page.tsx), [lesson create](../../app/teacher/lessons/create/page.tsx), [create-lesson](../../app/teacher/create-lesson/page.tsx), [curriculum](../../app/teacher/curriculum/page.tsx), [schedule](../../app/teacher/schedule/page.tsx), [timetable](../../app/teacher/timetable/page.tsx), [class roster](../../app/teacher/class/[id]/students/page.tsx), [attendance](../../app/teacher/attendance/page.tsx), [differentiation](../../app/teacher/differentiation/page.tsx).
- Dependencies: PR 7; authoring/publication owner contracts, including Curriculum V2 if displayed. AI drafts require human review.
- Risk: P1 accidental publish/attendance mutation from consolidation; P2 aliases are potentially different workflows, not proven redundant implementations.
- Tests: draft/save/review flow, class scope, deep links, scheduling/attendance current policy and permission parity. Browser: class → next lesson → plan → review, phone/tablet, error/offline. G09/G10/G12–G16.
- Non-goals: curriculum writing authority, automated publish, timetable or attendance rules.

### PR 9 — Teacher Assess, Students and Reports

- Scope: unified grading/work queue, learner support detail and explainable class reports. Combine homework/assignment entry points, keep separate assessment schemas/endpoints; investigate duplicate learner detail and intelligence pages before redirects.
- Files: [assignments](../../app/teacher/assignments/page.tsx), [grading](../../app/teacher/assignments/grading/page.tsx), [homework](../../app/teacher/homework/page.tsx), [gradebook](../../app/teacher/gradebook/page.tsx), [students](../../app/teacher/students/page.tsx), [student detail](../../app/teacher/students/[studentId]/page.tsx), [intelligence](../../app/teacher/intelligence/page.tsx), [delivery report](../../app/teacher/delivery-report/page.tsx).
- Dependencies: PR 7/8; existing grade/evidence/report authority. Preserve intervention review and messaging permissions.
- Risk: P1 mixing formal grades with mastery, wrong learner work or absent-data risk; P2 dense tables/mobile grading. Tests: reviewer/learner scope, draft/review/publish boundaries, signal-to-message context, old detail routes. Evidence: one learner support workflow and grading with errors, keyboard, tablet and readable phone fallback; G07/G09/G12–G16 plus affected G08/G11.
- Non-goals: new assessment model, AI grading authority, replacing analytics backend.

### PR 10 — Guardian child-first experience

- Scope: four destinations, persistent child context, understandable strengths/support and work/attendance/messages; grouped records/settings.
- Files: [GuardianNav](../../components/guardian/GuardianNav.tsx), [GuardianDashboardClient](../../app/guardian/GuardianDashboardClient.tsx), [progress](../../app/guardian/progress/page.tsx), [GuardianProgressClient](../../app/guardian/progress/GuardianProgressClient.tsx), [assignments](../../app/guardian/assignments/page.tsx), [attendance](../../app/guardian/attendance/page.tsx), [messages](../../app/guardian/messages/page.tsx).
- Dependencies: validated progress primitives; child-link authorization and existing feature flags. Risk: P1 stale/wrong child on switch; P2 literacy/local-language understanding.
- Tests: unlinked/multiple children, rapid child switch, denied records/message recipients, loading/error/freshness; evidence: guardian cohort comprehension and phone/screen-reader walkthrough. G07/G08/G11–G16 as applicable.
- Non-goals: new guardian rights, family AI authority, public child records, deployment.

### PR 11 — School/admin shell and role-first discovery

- Scope: six school job groups and gated specialist secondary tools; school health first. Keep MOE/platform separate. Split individual operations screens into follow-up PRs, not a 127-page rewrite.
- Files: [admin entry](../../app/admin/page.tsx), [admin layout](../../app/admin/layout.tsx), [AdminSidebar](../../components/admin/AdminSidebar.tsx), [AdminNav](../../components/admin/AdminNav.tsx), [enrollment](../../app/admin/enrollment/page.tsx), [classes](../../app/admin/classes/page.tsx), [school settings](../../app/admin/school-settings/page.tsx), [ops entry](../../app/admin/ops/page.tsx).
- Dependencies: prior shared primitives and admin workflow review. Risk: P1 permission leakage or misplaced governance actions; P2 large specialist route count. Tests: permission-filtered navigation and deep links for school/platform/MOE roles, scope/no-data/error states; browser: school health → enrollment/people/support task, mobile readable summary. G08/G11–G16 as applicable.
- Non-goals: governance/security policy decisions, changing curriculum deployment authority, pipeline/runtime logic, enabling paid resources, production/staging changes.

## Common implementation review evidence

Use existing focused tests listed above plus meaningful checks for new behavior. Run repository-required changed-code validation when code is involved; this foundation has none. Capture screenshots at 1440 and phone width for each affected anchor, and videos/traces for resume, context help, lab return and teacher intervention. State/head evidence must match the PR's exact commit. Add accessibility and degraded-network evidence; a pretty screenshot is insufficient. Apply the [scorecard](PRODUCT_DESIGN_V2_SCORECARD.md) by scope and keep unmeasured gates open.

Route retirement is a separate final cleanup only after inbound-link/usage audit, preserved capability, canonical destination coverage, permissions, deep links and back/return paths pass. REMOVE means duplicate entry affordance unless a separately reviewed cleanup establishes unused code; do not delete educational functionality for density targets. Rollback reverts presentation/entry changes and must not delete learner local work or alter canonical evidence.

## Foundation audit validation and ownership

This PR creates exactly six Markdown contracts under `docs/product-design-v2/`. Route/component reference existence, page coverage, current navigation definitions, responsive structure, theme, accessibility, offline/PWA, Tutor and Phase A seams were inspected at the exact base. No runtime/config/scripts/tests are changed. Browser/usability gates are future work, not falsely claimed validation here.

Visible active Curriculum V2 branch at initial and final audit: `feat/curriculum-v2`, head `51fb47d791d60b2cc8baab65741c02a0ab15c279`. Its 53 changed files include curriculum candidates/review artifacts, generator/pipeline/projection/provenance, authority tests and learner-experience types/evidence adapter. The foundation uses an isolated worktree on the exact requested main SHA and has zero changed-file intersection, including with the existing Phase A architecture doc that Claude also changes. GitHub connector searches for the exact Curriculum V2 head branch and matching remote branch returned no visible match; no claim of reviewing an unavailable PR is made. Recheck ownership at every later implementation handoff. Branch movement never authorizes taking ownership of a seam.

Final foundation reference audit: 981 local Markdown links resolve; all referenced literal route patterns resolve to existing pages/API handlers; the inventory covers 339 unique page routes exactly once. Counts: student 58, teacher 62, guardian 16, admin 126, MOE 19, platform 8, shared/public/auth/review 50. Navigation definitions and the single Phase A StudentPrimaryNav page mount were checked. Exactly six Markdown files are created; no runtime, script, config or authority files are changed. Whitespace/staged-diff checks are required before committing. This evidence does not certify browser or usability gates.
