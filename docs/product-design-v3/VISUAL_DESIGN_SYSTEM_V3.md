# Visual Design System V3

PROPOSED responsive specification, grounded in main `1e196d9401426c7a252e3605d4d2a972e57cecd2` and the approved [Figma V2 baseline](https://www.figma.com/design/PoHohwJe6ZrVdsIziuDKlK). This file changes no tokens, components, routes or educational authority. [Discovery](UNIFIED_EXPERIENCE_DISCOVERY_V3.md) identifies current code, branch candidates and inspected reference limits. [Role matrix](ROLE_EXPERIENCE_MATRIX_V3.md) supplies actual profile admission; [roadmap](IMPLEMENTATION_ROADMAP_V3.md) supplies implementation gates.

## Foundation decisions

Preserve warm graphite, readable paper text, gold primary action and green accepted progress. Use shared semantic tokens, accessible actions and state components; compose different workspaces for each role. Gold identifies the next useful action rather than every card/metric. A lesson needs space to teach; a teacher needs tasks and class context; a guardian needs a child and a helpful explanation; an official needs scope and reliable evidence.

Current [global theme](../../app/globals.css) has `--ll-bg #1a1a18`, surface `#242420` and `--ll-success` pointing to pink. Current `.pdv2-shell` overrides background/surface/raised to `#0e100e/#161815/#1c1e1b`, text/muted to `#f4f2eb/#b8b8ab`, gold to `#efb540`, success to `#73c99a`, border to `#85887c`, targets to 48px/56px for young. Focused `.ll-lesson-v2` adds target/focus rules but not this whole theme. V2 [design contract](../product-design-v2/DESIGN_SYSTEM_V2_CONTRACT.md) is a specification; several aliases now exist in main. Do not mistake its older "not runtime implementation" heading for the current shell state.

| Semantic contract | V3 value / rule | Decision and evidence |
| --- | --- | --- |
| Canvas / surface / raised | `#0e100e` / `#161815` / `#1c1e1b` | RETAIN V2 scoped runtime and inspected Figma direction; surface elevation communicates grouping, no nested shadow boxes |
| Text / secondary | `#f4f2eb` / `#b8b8ab` | RETAIN scoped V2; secondary still must pass contrast in actual use. No essential faint gray text |
| Action / on-action | `#efb540` / `#0e100e` | RETAIN; one dominant action per task region, avoid gold paragraph text everywhere |
| Accepted progress / success | `#73c99a` plus label/icon | RETAIN V2 scoped green; replace global pink success only through staged theme adoption and regression evidence |
| Warning / failure | Gold + warning label; candidate `#ff8a95` + failure label | Warning color reused deliberately; failure value PROPOSED pending contrast. Never color alone |
| Informational / unknown | Secondary text and explicit label | Unknown/not assessed/not refreshed are not failure, zero or mastery |
| Control border | `#85887c` initial alias | RETAIN V2 control rim; measure 3:1 for actual adjacent surfaces or equivalent clear affordance |
| Focus | 3px opaque gold + 2–3px offset + dark halo where needed | RETAIN direction; system Highlight in forced colors; test gold-on-gold controls, dialogs, clips and sticky panels |
| Radius | Controls 10–12px; sections 16–20px; pills only for short status | RETAIN V2/Figma geometry; avoid using pills for every teacher destination |
| Spacing | 4/8/12/16/24/32/48px | RETAIN V2 scale; phone gutter 16px, tablet 24px, desktop 24–32px; 8px between primary touch targets |
| Typography | Existing local Geist/system runtime initially; body 16–18px/1.5–1.7, young 18–20px; headings 24/32/40px | Figma Inter is reference, not mandate to add remote font. Labels ≥14px for meaningful metadata; no tiny all-caps paragraphs |
| Motion | Feedback 100–150ms; pane 150–200ms; optional page turn ≤250ms | PROPOSED ceilings consistent with V2 direction; reduce motion to instant state change; never animate a necessary instruction away |
| Print | White paper, dark text, visible objective/version/page context | Preserve actual printable homework; remove shell/chat controls and keep semantic headings |

Text contrast acceptance: ≥4.5:1 normal text, ≥3:1 qualifying large text; meaningful control/graphics ≥3:1. This document does not claim WCAG compliance. Standards references for future validation: [WCAG 2.2](https://www.w3.org/TR/WCAG22/), particularly reflow, text contrast, non-text contrast, focus, target size and status messages. V3's 48/56px target policy intentionally exceeds minimum target guidance.

Theme adoption uses existing semantic aliases in `globals.css`/Tailwind, scoped consistently to shared shells and focused learning. No second token registry or role-specific copies of GoldButton. A paper reading surface is a PROPOSED user preference using corresponding dark text/border/focus semantics, not a global redesign to white. Maintain large-text, low-bandwidth, print and forced-color support.

## Responsive geometry and whitespace

Breakpoints follow current Tailwind: base <640, sm 640–767, md 768–1023, lg ≥1024, xl ≥1280. Test 320/390/768/1024/1440/1920 CSS px and zoomed equivalents. General dashboard content max 1280px; specialist working stage may reach 1440px on a 1920px viewport when useful. Reading text remains 45–70ch inside the wider working stage.

| Viewport | Shell and working region | Required behavior |
| --- | --- | --- |
| Desktop ≥1280 | Student rail 208–240px; lesson scene rail 192–224px; optional support 280–320px; remaining flexible stage | At 1440px with support open, lesson stage ≥640px; if geometry cannot fit, support becomes sheet. Closed support returns width to stage; no reserved blank chat column |
| Compact desktop 1024–1279 | Compact rail/drawer; stage prioritized; context moves below or opens as sheet | Never squeeze diagram to preserve three columns. Controls wrap, no clipped headings |
| Tablet 768–1023 | Compact navigation, stage and one optional contextual area; collapsible scene list | Portrait one main teaching area; landscape two columns only if targets/text fit |
| Phone 320–767 | One task column, 16px gutter; student five-destination bottom nav outside focused lesson | Focused lesson has contextual Back, scene count and measured footer; reserve safe area/footer height; keyboard/focused field never covered |

Whitespace is purposeful when it separates tasks or reduces overload. It is wasteful when a narrow fixed card leaves both sides unused, when an empty support panel claims a third of the page, or when a viewport-height section pushes real controls down. Do not fill empty space with invented metrics. Panels use content-driven height; current lesson task and Continue should be visible together at 1440×900 for short scenes. Longer content may scroll normally; no arbitrary clipping to satisfy a screenshot. Read mode may center its text measure while illustrations occupy a broader adjacent region.

## Age-specific student language

The current V2 shell distinguishes young versus other, and native contract has age bands. V3 adds presentation presets, not new grade or learning authority.

| Grade band | Learning composition and tone | Controls / pacing |
| --- | --- | --- |
| 1–3 | One concrete goal, spoken and written instruction, familiar objects, visually clear selections; adult help reachable | ≥56×56 targets, 8px spacing, 18–20px body; one or two actions; no compulsory timer, public rank or abstract percent hero |
| 4–6 | Show whole/set/number line; guided example → learner manipulation → explain reasoning; partner roles when authored | ≥48×48, 17–18px body; 2–4 bounded steps, hint ladder and reset; feedback names the misconception without dumping answer keys |
| 7–9 | Mature appearance, purposeful diagrams, contextual tools and real-world investigation; clarify revision/assessment status | ≥48px primary/touch targets, 16–18px body; expandable explanation and readable practice workspace |
| 10–12 | Study, exam and pathway support with evidence sources; more independent scene/section navigation | ≥48px phone primary, ≥44px secondary desktop, 16–18px body; time estimate only when real, exam restrictions explicit |
| Unknown | Generous middle spacing and neutral language; setup instruction | Never infer enrollment/release from age styling; no curriculum unlock based on client preset |

Preserve grade 4–7 tactile interaction direction from Figma node `5:26` where appropriate. The proposed 4–6/7–9 split refines composition for older primary versus early secondary; it does not change native payload age-band values. Test local comprehension with educators/authorized participants during implementation validation.

## Visual teaching scene standard

Every rich scene has an authored objective and exact content identity. V3's quality standard is a curriculum authoring acceptance proposal, not runtime generation or a new scene contract:

1. State one learning move with a meaningful title and learner goal. Keep introductory visible explanation ≤60 words for grades 1–3, ≤100 for 4–6, ≤140 for 7–12 as editorial targets; transcripts/readings can be longer in Read. Split only through an authorized content revision.
2. When a concept needs a visual, use an accurate reviewed diagram, object set, number line, table, map or manipulative. Do not label a set of prose cards an interactive diagram. Asset rendering and authored reveal text can coexist; no decorative illustration substituted for mathematical meaning.
3. Place a specific learner task alongside/below the representation, then a short optional hint. Reveal steps and prompts remain those in the authorized payload; presentation cannot manufacture canonical scenes or assessment items.
4. Provide text description, screen-reader semantics and keyboard equivalents. Diagram labels remain legible at 320px/200% text; pan/zoom is optional and has buttons plus reset. Touch/drag interactions also support select/move/stepper operations.
5. Feedback states: incomplete, try again with explanation, locally checked practice, pending server check, accepted server result and unavailable. The UI labels the source honestly. Native server-required questions never use hidden client correctness keys.
6. Keep authorized tools contextual and collapse unused ones. Exact tool prohibition, assessment rules and lab certification stay on the server. The tutoring context includes current authorized scene/objective and invalidates stale answers on change.

Examples grounded in actual candidate material:

| Concept | Useful representation | Interaction and accessible fallback |
| --- | --- | --- |
| Fractions of a whole | Equal and deliberately unequal strips with hatch/tick state | Toggle labeled part buttons; keyboard selection; text names part sizes. Eight segments must not become narrow unlabeled independent targets at 320px: offer enlarged selected-piece controls/list alternative |
| Fraction of a set | Real bottle-cap/mango/stone set, clear whole count, optional equal group boundaries | Toggle selected objects, count summary, numerator/denominator stepper; list alternative with identical whole and selection meaning |
| Market arithmetic | Reviewed quantity/price table and money/quantity representation where the goal requires it | Compare subtotal/whole budget and explain reasoning; numerical table remains accessible without visual asset |
| Science process | Authored labeled diagram/approved simulation with sequential evidence | Reveal phase, observe, record/reflection; static annotated sequence and text walkthrough when WebGL/network unavailable |

Reuse [FractionVisuals](../../components/teacher/content-bundle-preview/activity/FractionVisuals.tsx) and [LearnerActivityExperience](../../components/teacher/content-bundle-preview/activity/LearnerActivityExperience.tsx) patterns only within their authority context. Educational SVG/HTML representations are functional diagrams; they require domain review, not decorative AI imagery. Existing components are preview code, not a released tool mapping or student scoring seam.

## Read, Listen and textbook specification

Read: top title/objective; table of contents with current section; 45–70ch body; inline meaningful diagrams; heading anchor navigation; visible text size, read-aloud, print/save availability and back-to-task. Main body 17–18px/1.6; no `prose-sm` for primary reading. Preserve supported section resume by learner/content/version. Switching presentation must not erase supported responses or upgrade completion.

Listen/read-aloud: labeled Play/Pause, previous/next chapter, seek range with accessible value, speed control where media permits, text transcript and available status. Do not autoplay. Stop/pause on scene change unless user chooses continuation. If timestamps exist, highlight corresponding text without stealing focus; otherwise show transcript without pretending to track words. If audio is absent, explain availability and keep Read usable. Media download requires authorized asset/version/rights and offline integrity; no automatic generation or unapproved spend. Browser speech fallback is PROPOSED and must declare device/voice availability, provide text, and respect privacy/offline policy; it is not assumed implemented.

Textbooks: current hub is a list of authorized curriculum readings, not a true textbook book/page model. Target requires exact book/resource/version/page identity, permitted asset rights, section/page labels, ordered page content, accessible text and authorized offline assets. Keep existing hub truthful until that contract is supplied. Do not route unit/term/full-pack rows to a lesson-only gate without a supported viewer contract.

Page-flip is a PROPOSED enhancement over the semantic reader. Desktop can show a two-page spread if each page remains readable; tablet portrait/phone use one page or continuous text. Provide Previous/Next buttons, page number input with validation, contents and keyboard navigation. Optional swipe is never the only operation. Reduced-motion/low-bandwidth/assistive mode uses instant page replacement or continuous reading, same location and controls, no canvas-only text. Focus moves to page heading on requested turn, announces page n of m politely, never turns from an arrow key while a text input/slider is active. A missing page provides Retry/Contents and preserves prior page; offline missing assets distinguish saved pages from the whole book. This adds no local mastery or progress authority.

## Text wireframes and current-versus-target compositions

All wireframes are content/region specifications, not working controls, invented metrics or new route names. Parenthesized destinations are existing routes. Labels such as Plan denote navigation groups, not `/plan` URLs.

### Student Today / Learn / Progress

```text
Desktop Today:  [rail Today/Learn/Labs/Progress/Help] [greeting + connection/freshness]
                                                     [next permitted action | goal]
                                                     [due work + school plan | skill evidence preview]
                                                     [teacher work, collapsed | offline/help]
Tablet Today:   [compact nav] [next action] [plan] [progress preview] [support]
Phone Today:   [name + status] [Continue/action or cause+recovery] [due work] [plan]
               [progress link] [5-destination bottom nav, reserved height]

Desktop Learn: [rail] [current authorized learning action] [classes + units]
                      [lesson library rows | assigned work + checks] [readings/resources]
Tablet Learn:  [current action] [classes/units] [library] [assignments/checks] [resources]
Phone Learn:   [current action] [class picker] [units] [lessons] [work/checks] [5-nav]

Desktop Progress: [rail] [Skill learning | Coursework | Records] [period + freshness]
                        [skill + evidence status + next allowed action | detail]
Tablet Progress:  [sections] [skill list] [selected evidence below] [record links]
Phone Progress:   [sections, wrapping] [skill rows] [evidence detail] [next action]
```

Current → target: four-source Today and discovery Learn retain source separation but share state semantics; multiple progress surfaces become contextual records under one presentation entry. No client average replaces canonical mastery. Empty plans use permitted catalog/help, missing grade/enrollment names school setup, no valid released practice says so, request failure offers retry, and offline indicates last-known state.

### Lesson / Read / Listen / Discussion / assessment / Labs

```text
Desktop Lesson: [Back + title + scene n/m + actual save state]
                [scene rail] [goal + real visual/representation + learner task] [optional support]
                             [hint / feedback / Continue]
Tablet Lesson:  [Back/title/status] [scene drawer] [visual + task] [Continue] [support sheet]
Phone Lesson:   [Back/title] [scene n/m + status] [one visual/task] [hint/feedback]
                [measured Continue footer] [support below/sheet; no primary nav]

Desktop Read:   [contents] [readable text column + aligned diagram] [read tools, optional]
Tablet/Phone:   [title + contents disclosure] [text/diagram] [read tools + task return]
Listen:         same reading context + labeled media controls + transcript + availability
Discussion:     current lesson/class + permitted conversation + input state + return
Assessment:     purpose/resources/rules -> questions -> saved/pending/received status
Labs desktop:  [real sections: For You/Assigned/Continue/Library/Completed]
               [eligible lab rows] [selected context, requirements, launch/denial]
Labs phone:    [section picker] [eligible rows] [requirements] [launch or recovery]
```

Target support can close completely; diagram/task expands into available width. Current native DiagramReveal, legacy slides and activity preview remain distinct adapters. Lab launch keeps exact lesson/work/scene context, returns to the permitted scene and uses a text fallback where authored. Assessments retain their existing server handoff and restrictions. Video, Listen, discussion and tutor controls show unavailable state if required endpoint/asset is absent; no decorative dead control.

### Teacher

```text
Desktop: [six-group rail] [class/school context + utilities]
                          [attention queue -> scoped student/class]
                          [today's classes | evidence/intelligence]
                          [Plan lesson / Grade work / Report] [assistant collapsed]
Tablet:  [group navigation] [attention] [classes] [planning/grading entry] [evidence]
Phone:   [group menu + class] [highest attention task] [classes] [Plan/Assess links]
Plan:    class/date -> authorized content -> teacher/student preview -> schedule status
Assess:  queue -> submission + permitted scoring context -> review -> existing confirm
```

Current → target: 20 peers become six groups, preserving all permitted routes, pending work and teacher-only endpoints. F03's sample class metrics do not become required backend fields. Assistant is contextual support, not a primary task queue replacement.

### Guardian and school administration

```text
Guardian desktop: [child picker] [today's family actions | weekly explained progress]
                                [work/attendance links | reviewed records] [message teacher]
Guardian tablet:  [child/context] [actions] [progress + schoolwork] [messages]
Guardian phone:   [child/context] [1–3 support actions] [weekly summary] [message/records]

School desktop:   [six-group rail] [school + period + freshness]
                                  [health exceptions | enrollment/people queue]
                                  [curriculum readiness | operations] [audit/detail]
School tablet:    [group menu] [exceptions] [queue/table] [detail below]
School phone:     [school/context] [priority exception list] [record detail + permitted action]
```

Current → target: guardian linked-child permissions stay intact; empty linking/review states become comprehensible. Admin numerical counts lead to scoped tasks, while complex ops move into specialist navigation rather than dominate school health.

### District/County, Ministry, author/reviewer and platform

```text
District desktop: [authorized scope + period] [school support queue | aggregate evidence]
District tablet:  [scope] [exceptions/table] [evidence detail]
District phone:   [scope] [priority school rows] [suppressed or allowed detail]
  Admission reconciliation first; County dedicated shell is PROPOSED, no existing /county.

MOE desktop:      [national groups] [scope/period/freshness] [decision questions]
                                   [coverage/delivery exceptions | evidence quality]
MOE tablet:       [scope/period] [briefing] [aggregate table] [evidence]
MOE phone:        [scope/period] [briefing] [exception rows] [permitted report]

Author desktop:   [work queue] [exact revision editor/inspect] [learner preview + sources]
Reviewer desktop: [eligible queue] [revision/rubric] [source evidence + permitted decision]
Tablet:           [queue/context] [revision + preview tabs] [sources/decision below]
Phone:            [queue] [revision identity] [stacked artifact/source/preview] [gated decision]

Platform desktop: [ops groups] [environment + explicit tenant] [run queue | evidence/detail]
Platform tablet:  [context] [health/queue] [run detail]
Platform phone:   [context] [critical status] [diagnostic/escalation detail]
Public desktop:   [task title] [auth/enroll/verification form | contextual help]
Public tablet/phone: [task title] [form/status] [short help] [permitted next step]
```

Current → target: reconcile real scope admission before showing an official a workspace; preserve aggregate suppression. Curriculum preview and approval remain separate. Operational authority lives in existing services, not in shared visual components.

## Shared component inventory and ownership

Names in the Target column are PROPOSED contracts unless identical existing source is explicitly named. Shared components accept display models and permitted actions; they do not query all tenants, compute grades or perform release decisions.

| Target component | Existing source to reuse/adapt | Common contract and states | Role-specific boundary |
| --- | --- | --- | --- |
| RoleShell / PrimaryNav | [StudentShellV2](../../components/student/StudentShellV2.tsx), [StudentPrimaryNav](../../components/learner-experience/StudentPrimaryNav.tsx); teacher shell BRANCH | Capability-filtered destination data, utility slots, focused mode, responsive rail/drawer/bottom nav | Different student/teacher/admin compositions; no shared universal dashboard or route authority |
| ActionButton | [InteractiveButton](../../components/ui/InteractiveButton.tsx) | Link/button semantics; loading/disabled reason, target/focus/motion; one dominant action | Never disable with color alone; no permission from `href` |
| SectionState / FreshnessNotice | Today/Learn state patterns | loading/empty/error/denied/signed-out/stale/offline/incompatible; label, explanation, valid recovery | Adapters preserve source-specific meaning; no cross-tenant stale cache |
| TaskList / AttentionQueue | Today plan rows; teacher/admin attention data | title, exact task identity, due/state/source/freshness, permitted action | Lesson/work/practice/review task identities stay separate |
| ContextHeader / ScopeFilter | DashboardTopBar, role headers, current filter controls | Name/scope/period/version/status, label and optional actions | Child/class/district/tenant selectors obey server scope; no free-form arbitrary ids |
| ContentCard / CatalogRow | LessonCatalog, LearnV2, LabExperienceCard | content type/title/availability/reason/requirements + actual destination | No lesson-only link for arbitrary book/pack/activity without supported adapter |
| TeachingStage / SceneNavigator | [LessonPlayerV2](../../components/learner-experience/LessonPlayerV2.tsx), SceneViews | Authorized scene/body/media/interaction, exact return, current status; legacy adapter separate | Renderer never grants release, mastery or evidence |
| MediaReadControls | [LessonAudioPlayer](../../components/student/LessonAudioPlayer.tsx), LessonImage, legacy read/slide controls | media status, transcript, captions/alt, controls, rights/version/offline status | Audio generation, external media and authorized download separate from playback |
| ManipulativeHost | FractionVisuals, FractionVisualizer, NumberLine | Authored representation, keyboard/touch actions, reset, local/remote feedback source | Reviewed toolkit mapping and exact activity authority required for learner rollout |
| ProgressSummary / EvidenceRows | [StudentProgressDashboard](../../components/student/StudentProgressDashboard.tsx) | canonical status, provenance/freshness/denominator, allowed next action | Skill mastery, coursework grade, completion and credential never conflated |
| RecordTable / DetailPane | Current role tables, review queue | labeled headers/sort/filter, keyboard links, row detail on small screens, empty/error | Sensitive column visibility enforced in DTO, not CSS |
| ContextualHelpDock | StudentLessonHelpPanel; GlobalAssistantShell; teacher assistant BRANCH | current scene/class/context, network status, history scope, close/return | Existing policy, child safety and model cost controls preserved |
| VersionReadinessHeader | ContentBundlePreview parts/diagnostics | exact id/version/hash/source/readiness and dependency diagnostics | Preview source cannot infer release; student model omits teacher governance detail |
| BookReader / PageControls | No true page-based reader identified on main | PROPOSED book/page/contents model; instant/reduced-motion turn, text/transcript, missing-page retry | Blocked on real licensed/reviewed pages and authorized asset contract |
| OfflineStatus / SaveReceipt | OfflineBanner, SyncManager, offline status and queue components | saved locally/queued/accepted/rejected/incompatible + count/freshness | Signed partitioned cache; no local event→canonical success; no private payload in diagnostics |

Role-specific components remain: teacher planning/grade approval/class intelligence, guardian linked-child/family digest, admin import/enrollment/readiness, MOE suppressed aggregate/coverage/policy evidence, reviewer exact-revision/qualification/source evidence, platform run/approval diagnostics. Share accessible table and notice primitives, not their authority logic.

## States and control acceptance

| State | Visible content and action | Forbidden implication |
| --- | --- | --- |
| Loading | Named section, stable layout, `aria-busy`, no looping inaccessible shimmer | Empty data before request resolves |
| True empty | What is empty, source/time context, permitted Browse/Setup/Help | No assignment because recommendation is missing |
| Error | Which source failed, retry, retain only safely permitted history labeled stale | Zero learners, zero progress or no content |
| Denied/withdrawn | Scope-safe explanation and Back/sign-in/help as appropriate | Record existence disclosure before authorization; fallback to unsafe content |
| Offline | What is saved/last checked/queued, reconnect action, supported read/print fallback | Current authorization or received server evidence |
| Version mismatch | Saved copy unusable/current reauthorization needed; preserve safe exit | Reinterpret cached scenes using different content version |
| Unrecorded preview | Explicit candidate/local-only label and resettable interaction | Submitted, graded, released, mastered or assigned |
| Accepted result | Server receipt/status from the actual contract | CSS green check or local Finish as accepted outcome |

Every primary control must either perform its declared action, show a truthful gated reason or be omitted. Navigation-only fixture links are not proof of route runtime. Implementation acceptance must enumerate controls at each role/viewport, check the destination/action and keyboard operation, and assert no placeholder/no-op in the primary workflow. Browser-test criteria and authority-negative scenarios are specified in the roadmap.
