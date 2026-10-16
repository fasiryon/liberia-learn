# LiberiaLearn Unified Experience Discovery V3

Status: documentation-only discovery and proposed redesign blueprint, 14 October 2026. No implementation or release approval.

## Audit identity and evidence limits

Audited main: **`1e196d9401426c7a252e3605d4d2a972e57cecd2`** (Merge PR #186). `git fetch origin main`, `git ls-remote origin refs/heads/main`, and `git rev-parse origin/main` agreed before inspection. Worktree: `C:\liberia-learn\.task-worktrees\product-design-v3`; branch: `docs/unified-experience-discovery-v3`. The shared checkout's unrelated modifications were excluded. This is a fixed-SHA audit; later main changes do not silently change its conclusions.

Read [core rules](../agents/CORE_AGENT_RULES.md) and [context routing](../agents/CONTEXT_ROUTING.md). Product Design audit and Git workflow skills informed evidence handling and isolation; the user's requested repository discovery takes precedence over the audit skill's screenshot-only workflow. No authenticated application, production database, deployed build metadata, or production role session was available or used. No browser tests were executed in this run. Historical test claims below are identified as repository records, not rerun results.

Evidence labels throughout:

| Label | Meaning |
| --- | --- |
| CODE | Read at the exact audited main SHA; proves implementation/selection, not deployed behavior or live data |
| FIGMA | Three desktop raster exports retrieved and visually inspected in this run; design references, not production screens |
| REPORTED | Symptoms supplied in the prompt; screenshot pixels, viewport, URL, account, timestamp and build not supplied |
| RECORD | Existing documentation or test source; historical claim, not independently rerun |
| BRANCH | Inspected local branch ref/diff; not main and not deployment proof |
| PROPOSED | Target design, estimate or acceptance threshold; not implemented |
| UNKNOWN | Required evidence unavailable; no inference of success or failure |

Deliverable map: [role inventory, readiness and workflows](ROLE_EXPERIENCE_MATRIX_V3.md), [design system and wireframes](VISUAL_DESIGN_SYSTEM_V3.md), [waves, dependencies and browser acceptance](IMPLEMENTATION_ROADMAP_V3.md). All application source links refer to main unless explicitly marked BRANCH. Route existence is separate from role admission, feature enablement, useful data, and successful end-to-end execution.

## Starting screenshot findings and annotation register

The five reported defects are the starting hypotheses. **The user-provided production screenshots themselves were not attached in this session.** No production raster is claimed inspected or annotated. These references preserve the symptoms without inventing a filename or crop coordinate.

| Reference | Reported region and finding | Source corroboration on main | Annotation and measurable target |
| --- | --- | --- | --- |
| R01, production lesson card | Narrow centered teaching content | Content viewer uses `max-w-3xl` at [LessonViewerClient](../../app/student/lesson/[contentId]/LessonViewerClient.tsx); assigned viewer has a different `max-w-5xl` shell | Widen the teaching stage independently of prose measure; at 1440px, stage has at least 640px when support is open |
| R02, Slides/Read | Walls of text | Legacy Slides and Markdown Read are separate render paths; [parseToSlides](../../lib/lessons/parseToSlides.ts) adapts legacy structure; native [SceneViews](../../components/learner-experience/SceneViews.tsx) still renders paragraph/key-point lists | One learning move per authored scene; prose 45–70ch, diagram/manipulative plus question; no automatic invention of scenes from prose |
| R03, unused surface | Large black area | Focused lesson screens use full-height dark canvas; Figma lesson also has a substantial lower empty region | Content-height sections and useful stage/context distribution; no fixed-height blank placeholder; blank area must not push the next action below the fold |
| R04, Today/Learn | Inconsistent empty states | They read different sources; Today has four independent requests, Learn reads discovery and governed action separately | Distinguish no work, no enrollment, no released resource, failure, stale and denial; show a permitted recovery action for each |
| R05, Progress | Fragmented views | `/progress`, `/student/progress`, passport, portfolio, certificates, report cards and transcript coexist | One Progress entry with skill evidence, coursework and records sections; preserve backend distinctions and existing URLs |

### Visually inspected design references

Exports were saved outside the commit at `C:\liberia-learn\.task-evidence\product-design-v3\figma-{today,lesson,teacher}.png` and opened with the image viewer. Each exported raster is 1024×729 representing a 1440×1024 desktop frame. Coordinates below are approximate in the inspected raster, not DOM measurements. Stable Figma links replace expiring export URLs. These are annotated references in text; no screenshot overlay or app implementation was created.

| Reference | Stable frame | Inspected annotation |
| --- | --- | --- |
| F01 | [Today, 1:2](https://www.figma.com/design/PoHohwJe6ZrVdsIziuDKlK?node-id=1-2) | Left rail x0–170; hero x192–1001/y74–245; plan below x192–682. Strong next-action hierarchy and five destinations. Goal text clips at the right of its panel. Four metric cards compete for height; sample mastery/attendance numbers are illustrative. Target keeps the hero and plan, makes evidence-linked progress secondary, and wraps text. |
| F02 | [Lesson, 1:123](https://www.figma.com/design/PoHohwJe6ZrVdsIziuDKlK?node-id=1-123) | Rail x0–177; teaching stage x202–701; tutor x735–1011. Task is visible above the lower empty region, roughly y560–728. Tutor examples and long copy clip at the right; timer/scene pills are small. Market task establishes Liberian context but is a price list, not a mathematical manipulative. Target allows the stage to expand when tutor closes, uses a real money/quantity representation when instruction requires it, and avoids an always-open empty chat column. |
| F03 | [Teacher, 1:220](https://www.figma.com/design/PoHohwJe6ZrVdsIziuDKlK?node-id=1-220) | Rail x0–160; attention strip x181–1003/y73–152; class list and intelligence dominate left. Clear attention-to-action structure and bottom planning/grading actions. Teacher AI heading and context text clip at the right. Sample student counts and class mastery are design content, not evidence of available production fields. |

No mobile/tablet Figma frame was inspected. [V2 baseline and interaction-language references](../product-design-v2/PRODUCT_DESIGN_V2.md) include node `5:26`; its prior node-property inspection is RECORD, not a new raster review. Current student/teacher/guardian/admin/MOE/review application UI: **not visually inspected**. Contrast, focus visibility, actual scroll behavior, screen-reader announcements and working controls require browser verification; source inspection cannot certify them.

## Main, branch, candidate and deployment ledger

Local refs were compared with `git rev-list --left-right --count origin/main...<branch>` and source diffs. Zero branch-only commits means the ref is contained in main. Nonzero counts require file inspection: they do not imply an entire feature is absent from main.

| Capability/ref | Exact local ref inspected | Branch-only commits | Classification at audited main |
| --- | --- | ---: | --- |
| Product Design V2 foundation | `a9da24554ca30446357f9c33d0ea6fda812beb76` | 0 | Specification on main, including Figma anchors and scorecard |
| Student Today V2 | `e006ce557a556f9edbcdeda8b230cac4bef0c07d` | 0 | Shell, Today component and API integrations on main |
| Student Learn UI | `73b31ea0d1cf61ca90bc424c5c7e2e20cc64bf14` | 0 | Learn V2 and catalog on main |
| Learn discovery | `b0fc4ab0cee554edb8a848558f840789719244f3` | 0 | Bounded server discovery on main |
| Learn data ref | `f6c860bfbbd0d9bbf4378d4624489c5deefc8860` | 0 | Committed ref contained; shared checkout's uncommitted lab/read-model changes are excluded |
| Teacher shell V2 | `58f88a051cf29e3795d2da96f9d05d0c65ed151e` | 1 | BRANCH: TeacherShellV2, assistant dock, six-group navigation, shell tests/docs; main still uses older TeacherShell and TeacherNav |
| Lesson V2 authority/runtime refs | `71f56969846256d45d86d333ece17c591827765b` / `f73866570d44897036617a7655d7da68d7fb5168` | 0 / 0 | Delivery seam and renderer on main |
| Lesson V2 convergence | `1b47301ef7e3743c240a39d8f6c9735508554382` | 0 | Both real lesson routes select native/legacy on main |
| ContentBundle foundation | `7f515f68f62302b3a745373d2a8aa5c5abfc24f7` | 2 | Branch diverges; foundation contracts exist on main. Do not treat branch tip as main's implementation |
| Resolver / Teacher Preview refs | `48cf8501ac4fb0a1aff978f38422050a4900e4b2` / `f99134ded0a181ffffcf71c1ca0369999f134c95` | 1 / 1 | Individual refs diverge; integrated Wave 2 implementation is on main |
| ContentBundle Wave 2 | `4001669c28fbcab8241cccf3e4ae42db3a02bf89` | 0 | Integrated resolver/preview on main; default real storage dependencies still null |
| Content persistence/ScheduledWork pins | `1d2cbf50605f5d543fc4b57edac950d0b3c50bdd` | 2 | BRANCH: immutable record repository, additive pins and delivery wiring; absent from audited main. Preserve this contract when implementing later |
| ActivityDefinition | `48e45f635ea82bd0d2b4a6d4206ebba6b9ce245f` | 0 | Authority contract/resolver on main; not proof of durable reviewed records |
| Grade 4 fractions experiences | `15b6040c63005070b6b957cbf195f46b55997738` | 0 | Four synthetic candidate previews on main; not released student activities |
| Activity Wave convergence | `6c482f6d760ca0b92684baece3ce3d09f34a49da` | 0 | Integrated on main in PR #186; first-class `experience`, not `extensions.experience` |
| Production build, flags and database content | No authoritative build-to-SHA evidence available | — | UNKNOWN. Prompt describes older Grade 7 UI; cannot establish deployed SHA, native payload presence, release rows or enabled flags |
| V3 shell, reader page-flip and new teaching scenes | This blueprint only | — | PROPOSED |

The persistence branch's contract path `docs/architecture/content-factory/CONTENT_PERSISTENCE_SCHEDULEDWORK_V1.md` does **not** exist on this main snapshot; inspect it with `git show feat/content-persistence-scheduledwork-v1:docs/architecture/content-factory/CONTENT_PERSISTENCE_SCHEDULEDWORK_V1.md`. Do not create that file to make it appear implemented. Likewise teacher shell foundation is a branch document, not main. Historical V2 evidence describes local synthetic harnesses and prior test/build runs, not current production delivery.

## Verified explanation: old versus new lesson delivery

The older Grade 7 UI has not been universally replaced because the routes deliberately retain legacy delivery and the native release admission is much narrower than the existence of a player. This explanation is CODE for main. Its application to a particular production screenshot remains UNKNOWN without that deployed build and lesson response.

```text
Learn/library content link                    Today/assigned ScheduledWork link
/student/lesson/{contentId}                    /student/lessons/{scheduledWorkId}
  LessonViewerClient                            LessonDeliveryClient
                GET /api/student/lessons/{id}/experience?kind=CONTENT|SCHEDULED_WORK
                    requireRole(STUDENT), private no-store, RepeatableRead transaction
                    scoped content/enrollment lookup -> learner-safe projection
                    native contract? exact approved revision + published release checks
                NATIVE_V2              LEGACY_COMPATIBLE           native denial
                NativeLessonRuntime    existing legacy detail      LessonUnavailable
                -> LessonPlayerV2      -> Read/Slides/Listen        no legacy fallback
```

1. [Route identity](../../lib/learner-experience/lessonRoute.ts) preserves content versus ScheduledWork identity, and exact scene return from a lab. Similar titles and grade labels do not select a renderer.
2. [Delivery API](../../app/api/student/lessons/[id]/experience/route.ts) and [server resolver](../../lib/lessons/lessonExperienceDelivery.ts) require STUDENT, school, authorized metadata, learner scope, LESSON content type, published/APPROVED status, admissible lifecycle and `studentReady`. Assigned work additionally requires matching school and class enrollment. Format/lifecycle detail is withheld until scope checks pass.
3. Native payload detection uses [Curriculum V2 contract](../../lib/curriculum/v2/contract.ts), followed by strict scene validation and exact id/version/grade/subject matching. The current approved revision must match its snapshot hash; latest revision and latest lifecycle event must agree, with permitted approval event, human/reviewer authority and qualification. A client flag cannot grant admission.
4. The native experience must name a published, approved release with matching deterministic identity and exact lesson version/content binding, optional payload hash, and governed objective/concept inventory. [Published release registry](../../lib/learning-authority/publishedReleases.ts) contains **only `GRADE4_MATH_ONTOLOGY_RELEASE`**, whose grade is 4. There is no registered Grade 7 release in this registry on main. Therefore a Grade 7 native lesson cannot satisfy this path on this snapshot. Grade 4 registration also does not prove a qualifying native row exists in a production database.
5. [Browser loader](../../lib/learner-experience/lessonRuntimeClient.ts) checks delivery contract/route identity. [Runtime adapter](../../lib/learner-experience/lessonRuntime.ts) returns LEGACY for `LEGACY_COMPATIBLE`; native delivery requires release identity and keyless scenes. [Content viewer](../../app/student/lesson/[contentId]/LessonViewerClient.tsx) and [assigned viewer](../../app/student/lessons/[id]/LessonDeliveryClient.tsx) mount `NativeLessonRuntimeView` only for NATIVE. Eligible legacy lessons retain their existing detail APIs, media and completion paths.
6. An indistinguishable 404 can consult historical legacy detail; an explicit native denial, incompatibility, forbidden response or server failure cannot silently fall back to legacy. The content viewer also passes historical/cached payloads through `resolveLessonRuntime`, which denies malformed/unreleased native content. This prevents the redesign from bypassing authority.
7. Legacy content's own slide array versus `parseToSlides` adaptation is distinct from native authored scenes. Repackaging text into slides does not make it a scene-based released lesson. Native `DiagramReveal` currently reveals labeled text stages; actual visual media appears only when supported authored same-origin assets exist. V2 alone does not supply richer teaching content.
8. [Native runtime](../../components/learner-experience/LessonRuntimeV2.tsx) defaults to `PRESENTATION_ONLY_EVIDENCE`. Delivery states `authoritativeSubmission: false`, `masteryMutation: false`, and `submissionEndpoint: null`. Finish and local scene progress are not a new score, accepted evidence or ScheduledWork completion writer. Existing server completion may be displayed. This is an integration dependency, not permission for a UI to invent an evidence endpoint.

### Why fractions activity previews do not replace Grade 7 lessons

These are different authorities, content kinds, age/subject bindings and routes. [Activity Wave V1](../architecture/content-factory/ACTIVITY_WAVE_V1.md) supersedes the older Wave 3B `extensions.experience` wording: activity experience is now a first-class field in ActivityDefinition content. The bundle stores exact `activityReferences`. [Preview hydration](../../lib/content-bundle/preview/activityAuthority.ts) restores candidate content with `requireReleased: false` and separately reports the release gate's outcome. Production resolution uses `requireReleased: true`; pending candidates fail `ACTIVITY_NOT_APPROVED`, and approval without a release binding fails `ACTIVITY_NOT_RELEASED`.

The four experiences are guided practice, independent practice, pair classwork and paper homework. [Learner renderer](../../components/teacher/content-bundle-preview/activity/LearnerActivityExperience.tsx), [fraction visuals](../../components/teacher/content-bundle-preview/activity/FractionVisuals.tsx) and [feedback](../../lib/content-bundle/preview/fractionFeedback.ts) implement tap/stepper representations and explanatory ephemeral feedback. They make no API call, submission, ScheduledWork assignment, evidence or mastery write. Their fixture identities and real alignment references are not approvals.

The real [Teacher Preview route](../../app/teacher/content-bundles/[bundleId]/preview/page.tsx) is TEACHER/ADMIN and school-bound. `view=student` changes projection, not the authenticated role. [Default server dependencies](../../lib/content-bundle/preview/server.ts) supply null composition/exact revision/source/resource/media adapters, require exact bundle version, and deny fixtures in production. [Repository readiness](../../lib/content-bundle/v1/repositoryAuthority.ts) lists composition, revision, assessment, activity, toolkit, media and offline gaps. The persistence branch can supply immutable composition storage later; its contract explicitly does not close all these authority gaps. No `/student/activities` route exists on audited main. The current governed DIAGNOSTIC/PRACTICE card on Learn is a separate working API-backed experience, not these candidate fraction previews.

To identify a specific production Grade 7 case, the handoff needs read-only deployed artifact SHA plus authorized, sanitized lesson identity/compatibility/denial metadata. Do not export child records, credentials, answer keys or full teacher payloads. This audit provides the verified selection explanation now; it does not request a second audit.

## Student surface deep dive and current-versus-target decisions

All rows are CODE unless explicitly noted; current application visuals and successful runtime behavior are not visually inspected.

| Surface | Actual implementation/readiness | Target and severity |
| --- | --- | --- |
| Lesson Player | Native and legacy coexist on both routes; native is presentation-only and authority-gated | P0: consistent chrome, broad stage, exact content/work identity, local-versus-server status and one clear exit/continue |
| Slides | Legacy content slides/adaptation; native authored scenes have a different contract | P0: shared viewing affordances, not shared authority. Improve legacy presentation immediately without manufacturing native releases |
| Read | Legacy Markdown/HTML reading path and small prose styling in content viewer | P0: navigable headings, readable 45–70ch text, diagram aligned to paragraph, scalable type, section resume and keyboard scrolling |
| Listen | Generated audio status and `LessonAudioPlayer`; assigned viewer has audio-generation request path | P0/P1: playback never depends on unapproved media; transcript, chapter controls, named playback state, retry and unavailable reason; no automatic generation/spend |
| Discussion | Content viewer's discussion affordance and student class/discussion routes | P0/P1: lesson/class context and safe exit, clearly say if discussion cannot load; student-safe moderation remains server-owned |
| Today | `TodayV2` reads today, governed next-action, assignments, teacher lessons independently | P0: one primary governed action, due-work urgency and school plan, each with its own freshness; no false inference that missing recommendation means no work |
| Learn | `LearnV2`, governed activity, `/api/student/learn`, catalog and enrollment-derived units/classes | P0: curriculum browsing separated from assigned work; group duplicate lesson/work identities for display only; do not merge distinct records or decisions |
| Labs | Real lab routes, sessions, practical/AI registries and showcase gating; For You passes `pathLinks: []` on main | P1: preserve Library/Assigned/Continue; explain unavailable For You without implying absent library. Approved lesson links and certification required for curriculum continuity |
| Activities | Governed DIAGNOSTIC/PRACTICE API flow on Learn; separate ActivityDefinition candidate preview | P0/P1: typed card labels, interaction hints and feedback states; preview remains explicitly unrecorded until existing authority owners supply authorized delivery |
| Assessments | Assignments, homework, exams, adaptive/WAEC, legacy quiz panel and native assessment handoff coexist | P0/P1: purpose, required resources, save/submit status and expected time before starting; preserve server scoring and teacher approval |
| Progress | `StudentProgressDashboard` reads student progress and adaptive mastery; `/progress` separately queries grades/homework | P0: skill evidence first, coursework next, official records last; failed mastery load is Unknown, never zero mastery; actionable accepted next steps |
| Tutor | Student tutor and lesson help panels/API-backed help; tool policy and online dependency | P1: contextual, collapsible support with visible scope; pause/reset stale scene context; static authorized help offline; AI cannot grade or release |
| Textbooks | Grade-filtered authorized entries (lesson/unit_plan/term_plan/full_pack), subject grouping, 36-row fetch/8 shown per subject; links all entries to lesson viewer | P1: actual type-aware reading navigation, complete authorized catalog/pagination, book/page model only when real assets exist; current hub is not a paginated textbook viewer |
| Offline | SyncManager, queue, offline lessons/status, signed/partitioned cache and native read-only cache admission | P0: saved-on-device versus queued versus accepted versus incompatible labels; reconnect reauthorization and access-loss purge; no promise that every visible card is cached |

The Today and Learn divergence is partly legitimate: Today combines school schedule and assignments with a governed recommendation; Learn displays curriculum discovery and an independently governed practice action. Their endpoints must not become interchangeable. Common presentation state vocabulary and contextual recovery remove confusion without changing decision authority.

## Highest-impact defects

Severity concerns user impact, not authorization to change authority. P0 means foundational to the first student wave; A denotes an authority-owner dependency. No screenshot-derived issue is mislabeled as a measured production defect.

| ID | Evidence | Defect/impact | Severity | Remedy/dependency |
| --- | --- | --- | --- | --- |
| UX01 | REPORTED + CODE | Narrow content and long text can waste desktop width and conceal the learning task | P0 | Broader stage; readable prose inside it; both legacy and native parity |
| UX02 | CODE | Native player availability is easily confused with national native curriculum availability | P0/A | Honest compatibility labels in support tooling; expand governed content through existing review/release owners |
| UX03 | CODE | Native local Finish is not authoritative completion/evidence | P0/A | Device/server status copy; existing evidence adapter dependency before claiming integrated finish |
| UX04 | REPORTED + CODE | Multiple sources yield apparently conflicting no-work statements | P0 | Per-section freshness and cause; shared recovery component; preserve endpoint semantics |
| UX05 | CODE | Progress categories and duplicate `/progress` entry obscure grades versus mastery | P0 | Canonical presentation hub and contextual legacy links; no evidence recomputation |
| UX06 | FIGMA | Always-open support column and empty lower lesson canvas waste attention | P0 | Collapsible support, content-height regions and wider visual stage |
| UX07 | CODE + BRANCH | Teacher primary nav exposes 20 links; six-group replacement is branch-only | P1 | Evaluate/reuse branch navigation mappings and parity before redesigning workflows |
| UX08 | CODE | District and MOE role aliases conflict with literal portal guards | P2/P3/A | Security owner reconciles admitted roles/scopes first; no new permission inferred from a menu |
| UX09 | CODE | Textbook hub sends multiple non-lesson types to a lesson-only native delivery gate | P1 | Type-aware destination contract; do not promise page-flip over arbitrary content rows |
| UX10 | CODE | Real bundle preview is gated by missing stored dependencies; fixture interaction can appear more mature than delivery | P1/A | Preview status and diagnostics; durable exact adapters and approved content before learner promotion |
| UX11 | CODE | `--ll-success` is pink globally but green within `.pdv2-shell`; focused lesson styles do not inherit the whole V2 token scope | P0 | Consolidate scoped semantic aliases with contrast checks, avoid blind global recoloring |
| UX12 | CODE | Labs For You is empty by construction at this SHA; broad catch returns generic load notice | P1 | Distinguish no approved links from unavailable sessions/catalog; keep library recovery |
| UX13 | CODE | GuardianDashboardClient says "Your child is on track!" when interventionAlerts is empty; lack of alerts is not positive learning evidence | P2 | Say "No active alerts returned" and keep freshness/evidence context; derive positive learning claims only from the existing accepted evidence contract |
| UX14 | CODE | TeacherNav and GuardianNav map failed unread-count reads to zero, presenting unknown notification state as confirmed none | P1/P2 | Shared unknown/unavailable badge state with retry; preserve existing message APIs and scope |

## Public competitive benchmark

Research date: 14 October 2026. Public official guides, vendor screenshots embedded in public articles and published interface explanations only; no private accounts, paywall bypass, copied assets or proprietary layouts. This is **public pattern research**, not a firsthand authenticated competitor flow audit. Historical guide screenshots may not match current apps. Decisions below are LiberiaLearn design judgments, not vendor efficacy claims.

| Product / observable source pattern | Decision | LiberiaLearn translation / boundary |
| --- | --- | --- |
| Khan Academy: course/unit mastery and skill-level progress documented in [Mastery system guide](https://support.khanacademy.org/hc/en-us/articles/360030753412-What-is-the-Mastery-System) and [student/teacher feature article](https://blog.khanacademy.org/new-content-features-for-students-teachers/) | ADOPT | Explain skill progress separately from assignment completion; the guide search extract was available but direct guide open failed. Use only corroborated public descriptions; no new scoring model |
| Khan Academy: [activity overview report](https://www.khanacademy.org/khan-for-educators/k4e-us-demo/xb78db74671c953a7%3Ausing-course-mastery-on-khan-academy-gr/xb78db74671c953a7%3Amonitoring-progress-towards-mastery/a/using-khan-academy-s-activity-overview-report) connects teacher filters to learner evidence | IMPROVE | Bring attention groups and existing next actions forward; preserve class scope and minimum useful evidence rather than decorate dashboard with averages |
| IXL: [Diagnostic Action Plan](https://blog.ixl.com/2021/08/17/what-is-ixls-diagnostic-action-plan/) presents known skill levels and recommended practice; article notes renamed diagnostics | ADOPT / IMPROVE | State why a next action is suggested and whether underlying evidence is current; improve accessibility of plain-language labels; do not adopt vendor numeric grade-level scales |
| ALEKS: [public K–12 module guide](https://www.aleks.com/k12/New_ALEKS_Student_Module_Reference_Guide.pdf) and [Pie report](https://www.mheducation.com/unitas/school/explore/sites/aleks/reports-pie-report.pdf) distinguish learned/mastered/remaining and ready-to-learn topics | REIMAGINE | Use accessible skill rows and evidence timelines with a next action instead of requiring a pie to interpret readiness; maintain LiberiaLearn's canonical mastery model |
| Duolingo: [path explanation](https://blog.duolingo.com/new-duolingo-home-screen-design/) emphasizes a clear next lesson and integrated review | ADOPT | One Continue action and bounded teaching scene, with permitted alternate learning and teacher work kept reachable |
| Duolingo: [current Practice tab guide](https://blog.duolingo.com/guide-to-duolingo-practice-hub/) offers targeted skill/mistake/listening practice | IMPROVE | Offer purposeful practice destinations only when server-authorized resources exist; name online/offline requirements |
| Duolingo: [2025 shareholder letter](https://investors.duolingo.com/static-files/0b55110c-2eb9-466d-8549-5459e0851290) documents Energy replacing mistake-based Hearts | REJECT | Reject learning rationing and shame-based streak presentation as LiberiaLearn design choices. Do not describe the old Hearts interface as universally current |
| Canvas: [dashboard grades guide](https://community.instructure.com/en/kb/articles/662816-how-do-i-view-grades-for-all-courses-in-the-card-view-dashboard) gives course averages, included-student count and gradebook drill-through; [gradebook indicator guide](https://community.instructure.com/en/kb/articles/660840-how-do-i-use-the-icons-and-colors-in-the-gradebook) explains status indicators | ADOPT / IMPROVE | Actionable aggregate-to-detail navigation and explicit pending/reviewed states; no color-only grading status; no university-density grid forced onto younger learners |
| Google Classroom: [guardian summaries guide](https://support.google.com/edu/classroom/answer/6388136) separates missing/upcoming work and class activity; summaries omit grades | ADOPT / DIFFERENTIATE | A small family action digest, linked-child privacy and accessible explanations. LiberiaLearn may show authorized reviewed grades through its own existing contract, not copied Classroom permissions |
| Cross-product online-centric patterns | DIFFERENTIATE | Liberian context, household manipulatives, printable homework, low-bandwidth media, explicit sync trust and shared-device isolation. These are target priorities, not claims competitors lack all offline support |

## Decisions ready for implementation planning

Use one semantic design foundation and shared state vocabulary with distinct role compositions. Keep student five-destination IA; pursue teacher six workflow groups; use guardian child-first navigation and school/county/national scope-specific summaries. Preserve V2 visual identity while tightening width, text, accessible controls and purposeful space. Create no dashboards for invented roles.

Immediate student presentation work can improve legacy experiences without waiting for native curriculum rollout. Rich native content, activity delivery, real textbook assets, approved labs and authoritative finish each have separate dependencies. [Roadmap](IMPLEMENTATION_ROADMAP_V3.md) makes these gates explicit and leaves persistence/ScheduledWork, ActivityDefinition, governance, evidence/mastery and release authority unchanged.

Completion boundary: all four requested documents, route inventory, code-traced selection, inspected Figma annotations, role readiness estimates, wireframes, component decisions and public benchmark are provided. Production screenshots, deployed build identity, real role runtime tests and content store population remain named evidence blockers, not a reason to request another audit. The next handoff is bounded implementation against the acceptance criteria, with authorized owners supplying the missing facts.
