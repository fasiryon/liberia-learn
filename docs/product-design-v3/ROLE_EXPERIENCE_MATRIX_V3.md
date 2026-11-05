# Role Experience Matrix V3

Audited main: `1e196d9401426c7a252e3605d4d2a972e57cecd2`, 14 October 2026. CODE indicates source inspection, not live use. All actual application screens below are **not visually inspected**. Figma student/teacher references were visually inspected; see [annotation register](UNIFIED_EXPERIENCE_DISCOVERY_V3.md#starting-screenshot-findings-and-annotation-register). Proposed compositions do not grant permissions or introduce routes.

## Real identities, permissions and reachability

[Role enum](../../prisma/schema.prisma) has exactly STUDENT, TEACHER, GUARDIAN, ADMIN, DISTRICT_ADMIN, MOE_OFFICIAL, MOE_SUPER_ADMIN and MOE_DISTRICT_ADMIN. `isPlatformAdmin` is an account capability, not a ninth enum role. Curriculum Author/Reviewer and County are personas/functions, not enum roles. Other actual user surfaces include public certificate verification, credential/portfolio sharing, enrollment/authentication, placement and development lab review; these are not invented profiles.

Provisioning is narrower than the schema: [databaseRoles](../../lib/auth/databaseRoles.ts) explicitly permits persistence of only TEACHER, STUDENT, GUARDIAN, ADMIN, DISTRICT_ADMIN and MOE_OFFICIAL; it rejects other roles as `UNDEPLOYED_DATABASE_ROLE`. Thus MOE_SUPER_ADMIN/MOE_DISTRICT_ADMIN are modeled identities with partial helper/review support, **not verified provisioned production profiles**. The constant's name is repository evidence of the approved persistence policy, not a live database inspection. No login normalization from those aliases to MOE_OFFICIAL was observed in `lib/auth.ts`; JWT/session role comes from the database role. Their target workspace/admission remains proposed pending authority review.

| Identity/persona | Implemented scope and admission | Critical distinction |
| --- | --- | --- |
| STUDENT | `/student` middleware admits STUDENT; pages/APIs generally recheck `requireRole`; own school, enrollment, grade and content eligibility | School/grade missing is a setup or eligibility state, not permission to show all content |
| TEACHER | `/teacher` middleware admits TEACHER/ADMIN; individual pages/APIs have additional class/school checks | ADMIN menu access does not prove every teacher-only endpoint works for ADMIN |
| GUARDIAN | `/guardian` admits GUARDIAN; multiple server flags and linked-child queries | Guardian relationship is record-scoped; possession of a child id or same-school account is insufficient |
| ADMIN (school) | `/admin` admits ADMIN or platform flag; root page itself requires literal ADMIN | Many national/platform actions remain separately gated; school admin is not national admin |
| DISTRICT_ADMIN | Enum and permission sets exist; `roleDefaultPortal` points to `/admin`; `requireMoePortalUser` can admit DISTRICT_ADMIN at service/layout layer | Middleware `/admin` excludes it without platform flag; `/platform` requires platform flag. Current district portal path is inconsistent, not a complete reachable county dashboard |
| MOE_OFFICIAL | `/moe/*` guard admits literal MOE_OFFICIAL or platform flag; portal flag and allowlist apply; national aggregate APIs | Current layout declares national scope and no tenant switcher; redesign cannot add arbitrary student detail |
| MOE_SUPER_ADMIN | Enum, permissions, MOE role helpers and review services recognize it | `isMoeAuthorized` and layout use literal MOE_OFFICIAL/flag; do not infer portal access from `isMoeSuperRole` |
| MOE_DISTRICT_ADMIN | Enum, permission helpers and review scope functions recognize it | `/moe` middleware excludes it absent platform flag; district persona needs authority-owner reconciliation |
| Platform administrator | `/platform` middleware requires `isPlatformAdmin`; layout also uses `requireMoePortalUser`, portal flag and allowlist | Capability alone is not a blanket runtime guarantee: `requireRole` uses exact role membership, without automatic platform bypass |
| Curriculum author | Teacher authoring and admin curriculum functions exist under actual roles | No AUTHOR enum or `/author` route; dedicated author workspace is PROPOSED composition of permitted functions |
| Qualified curriculum reviewer | `/review/queue`, `/review/tasks/[taskId]`, `/review/operations` exist behind P2b flag; scope and qualification services apply | No REVIEWER enum; read scope is not approval qualification. Some recognized MOE roles can use review services independently of broken MOE portal entry |
| County official | County aggregates exist in MOE dashboard and district views | No COUNTY enum and no `/county` portal. A dedicated county persona is PROPOSED; cannot equate county and district authority automatically |
| Public learner/visitor/verifier | Public paths and explicitly shared artifacts; separate registration/login/onboarding | Public sharing must not expose unshared student evidence or turn tokenized artifacts into child search |

Evidence: [middleware](../../middleware.ts), [literal role helper](../../lib/auth.ts), [permissions](../../lib/permissions.ts), [MOE route guard](../../lib/moe/routeGuard.ts), [MOE role aliases](../../lib/moe/rbac.ts), [platform layout gate](../../lib/moeAccess.ts), [review access](../../lib/curriculum/review/access.ts). A navigation visibility rule is never an authorization rule.

## Readiness and current-versus-target scorecard

These are **analyst planning estimates**, not measured production usability scores, release certification, or test results. Rubric: IA/action clarity (I), presentation/responsive/accessibility implementation (P), data/integration completeness (D), authority/state integrity (A); each 0–4, total/16 converted to percent. 0 absent, 1 fragmented/prototype, 2 implemented with material gaps, 3 broadly connected with unverified runtime, 4 demonstrated acceptance. Source alone cannot justify a current 4. A blocked role can have sound service authority but poor route readiness. Target 100% means later demonstrated browser/data acceptance, not a score earned by this document. Confidence Low/Medium concerns evidence coverage.

| Profile/function | I/P/D/A current | Current → target | Confidence | Primary blocker / priority |
| --- | --- | --- | --- | --- |
| Student grades 1–3 | 2/2/2/3 | 56% → 100% | Medium | Younger language/scene visuals and real curriculum availability unverified; P0 |
| Student grades 4–6 | 2/2/2/3 | 56% → 100% | Medium | Rich fractions candidate is not learner delivery; P0 |
| Student grades 7–9 | 2/1/2/3 | 50% → 100% | Medium | Legacy content presentation; no Grade 7 native release in registry; P0 |
| Student grades 10–12 | 2/1/2/3 | 50% → 100% | Low | WAEC/exam and learner record fragmentation; P0/P1 |
| Teacher | 1/1/3/3 | 50% → 100% | Medium | Workflow/nav overload; shell candidate branch only; P1 |
| Guardian | 2/1/2/3 | 50% → 100% | Medium | Multiple flags, child linking and status comprehension; P2 |
| School ADMIN | 1/1/3/3 | 50% → 100% | Medium | Broad operations IA and action-density; P2 |
| DISTRICT_ADMIN | 0/1/2/2 | 31% → 100% | Medium | Portal middleware versus service gates; P3 prerequisite |
| MOE_OFFICIAL | 2/1/3/3 | 56% → 100% | Medium | Dense aggregates, freshness and drill-through usability; P3 |
| MOE_SUPER_ADMIN | 0/1/2/2 | 31% → 100% | Medium | Portal admission inconsistent with helper recognition; P3 prerequisite |
| MOE_DISTRICT_ADMIN | 0/1/2/2 | 31% → 100% | Medium | District scoping/admission parity needs authority review; P3 prerequisite |
| Platform administrator | 2/1/3/3 | 56% → 100% | Low | Layered portal gates, specialized operations complexity; P3 |
| Curriculum author functions | 1/1/2/3 | 44% → 100% | Medium | Separated authoring/review/preview, exact-source readiness; P3 |
| Qualified reviewer functions | 2/1/2/3 | 50% → 100% | Medium | Flag/qualification-dependent workflow and theme inconsistency; P3 |
| County dedicated profile | 0/0/0/0 | 0% → proposed | Medium | No dedicated implemented identity/route; scope decision first |
| Public enrollment/verification | 2/2/2/3 | 56% → 100% | Low | No current runtime inspection; P2/P3 as scoped shared work |

A data score of 3 means substantial code-backed queries exist. It does not mean production is populated, licensed media exists, a feature flag is on, or a query succeeded. Native lesson evidence, real bundle storage and page-flip books are independently incomplete.

## Student profile (all implemented grade bands)

| Audit dimension | Current evidence and target |
| --- | --- |
| Routes/features | Five-destination map in [studentNavigation](../../lib/learner-experience/studentNavigation.ts); Today, Learn, Labs, Progress, Help; lesson/work routes, classes/units/schedule, assignments/homework/exams/adaptive/WAEC, textbooks, offline, records and discussions. Full exact page inventory below |
| UI/visual evidence | R01–R05 reported; F01/F02 inspected design only. Application not visually inspected. Legacy content `max-w-3xl`, Read `prose-sm`; native `.ll-lesson-v2` does not inherit every `.pdv2-shell` token |
| Jobs/workflow | Sign in → privacy/setup/placement if required → Today → exact assigned lesson or governed action → scene/read/activity → existing assessment/lab handoff → exact return → truthful save/finish status → Progress → permitted next action. Browse Learn independently of assigned work |
| Hierarchy/layout/a11y | Target primary action and learning objective first; bounded prose plus larger teaching visual. Grades 1–3: 56px targets, concrete short steps; 4–6: 48px targets and guided manipulation; 7–9: 48px practical tools, clean visual reasoning; 10–12: 48px phone primary, denser exam/study tools. Unknown grade defaults to generous spacing, never guesses curriculum scope |
| IA | Keep Today/Learn/Labs/Progress/Help; textbooks under Learn, offline under Help; progress records under Progress. Focused lesson hides primary navigation and must provide meaningful exit and context |
| States | Today independent request failures/retained history; Learn loading/rows/empty/unavailable/restricted/signed-out; native explicit denial/incompatible/not cached; lab hub generic catch. Target consistent cause+next action, stale timestamps and signed-out handling, without hiding scoped denial details in unsafe contexts |
| Controls | CODE wired: catalog navigation/retry, governed item submit, audio controls, legacy completion, native scene navigation and lab return. Incomplete: native authoritative evidence channel, candidate activity submission, real textbook page-flip. Successful runtime clicks not verified |
| Backend | Today four endpoints; Learn display-only discovery plus separate learning-authority action; progress/adaptive mastery; authorized content eligibility; current labs path links empty. Legacy APIs connected; native release registry only Grade 4. Real native row/deployed flags UNKNOWN |
| Privacy/authority | Own school/enrollment, learner allow-list, withheld answers/teacher notes, server scoring and orchestration; signed learner-partitioned offline cache; reconnect reauthorization. No local Finish→mastery or cached capability→submission |
| Target devices | Desktop scene rail + flexible visual stage + optional context; tablet stage plus scene drawer/support sheet; phone one scene with 56/48px Continue and collapsed support. Today plan beside progress on desktop, stacked on tablet/phone. Detailed specs in design document |
| Reuse/specialize | Shared action/state/section/media components; student-specific scene navigator, manipulatives, progress interpretation and assessment handoff |
| Gap/effort/dependencies | P0 user impact high; presentation 15–25 engineer-days for wave S1/S2 combined, authoritative native content/evidence not included. Needs exact legacy/native fixtures, source assets, content reviewers and browser parity; estimate is planning only |

## Teacher profile

| Audit dimension | Current evidence and target |
| --- | --- |
| Routes/features | Dashboard/overview; schedule/timetable/attendance/class discussions; lesson authoring/sharing/library; curriculum/standards/skills; assignments/homework/grading/gradebook/exams; students/intelligence/placements; reports/labs/training/messages; bundle preview |
| UI/visual evidence | Main [TeacherNav](../../components/teacher/TeacherNav.tsx) has 20 peer links, wrapping pill navigation. [TeacherShell](../../app/teacher/TeacherShell.tsx) adds help/accessibility overlay rather than V2 primary rail. F03 inspected; application not visually inspected |
| Jobs/workflow | Attention signal → scoped student/class → inspect evidence → choose instructional response. Plan → select authorized content → inspect teacher/student preview → schedule to class → deliver/attendance → inspect submissions → review AI recommendation/manual grade → confirm existing approval → report |
| Hierarchy/layout/a11y | Target attention queue first, then today's classes, planning and grading actions; time/class/evidence remain visible. Desktop class list + intelligence; tablet stacked attention and classes; phone one class/task at a time with class context pinned, tables offer labeled row detail |
| IA | Proposed six groups Command Center/Classes/Plan/Assess/Students/Reports over existing destinations. Reuse BRANCH `lib/teacher/navigation.ts` mapping only after parity review; no fabricated `/teacher/classes` or `/teacher/plan` route |
| States | Dashboard/data error distinct from no classes; no school, no schedule, no submissions, flag disabled and preview diagnostics need explicit action. Offline read/print permitted only where supported; scheduling/grading cannot pretend to save online |
| Controls | CODE wired schedule create/delete/deliver/plan binding, lesson assignment, submission approve/grade/bulk-approve. UI not runtime verified. Bundle preview has no publish/assign controls; native/rich activity completion not invented |
| Backend | `/api/teacher/dashboard` school/class queries, teacher class performance/intelligence; schedule and assessment APIs. TEACHER versus ADMIN API parity must be checked; existing aggregated failures/nulls cannot masquerade as positive counts |
| Privacy/authority | Teacher classes and school context, child record scope, AI recommendations distinct from reviewed grades; qualified human review/release authority. Student view from learner projection only, never full bundle with CSS-hidden teacher data |
| Target/reuse | Shared shell, AttentionQueue, task list, filters, detail panes, state notices; role-specific class context, planning sequence, review-and-grade workflow and facilitation panels |
| Gap/effort/dependencies | P1 high impact; 12–20 engineer-days plus 5–8 QA/content days. Depends on teacher-shell branch disposition, stable endpoint contracts, authorized fixtures and workflow parity; excludes schema/authority changes |

## Guardian profile

| Audit dimension | Current evidence and target |
| --- | --- |
| Routes/features | Overview, linked student, attendance, grades, assignments, progress, report cards, events, messages, link/onboarding/settings/phone; flags gate portal/dashboard/progress separately |
| UI/visual evidence | Eight peer navigation pills in [GuardianNav](../../components/guardian/GuardianNav.tsx), multiple overview/progress concepts; dashboard equates an empty alert list with "on track", a stronger claim than that evidence supports. Application not visually inspected; no guardian Figma raster inspected |
| Jobs/workflow | Register/login → verified child linking → choose child → see what needs help today → inspect due/missing work or attendance explanation → message teacher → see reviewed progress/report card. Preserve child selection on return |
| Hierarchy/layout/a11y | Child and school identity first, plain-language family action next; avoid grade/mastery jargon without explanation. Desktop child selector + support digest + records; tablet two areas; phone child picker + 1–3 actions + weekly summary, large labels |
| IA | Proposed Overview/Schoolwork/Progress/Messages with settings/attendance/events contextual; compositions use existing routes and link workflows |
| States | No linked child is currently dashboard API 403; target scoped linking guidance rather than blank data. Disabled flags distinct from broken network, pending review distinct from poor performance; offline never implies current grades |
| Controls | CODE link/messages/settings and route navigation exist; runtime not verified. Scores show pending review unless teacher-scored or permitted AI-reviewed. No grading, curriculum release or safeguarding decisions assigned to guardian UI |
| Backend | [dashboard API](../../app/api/guardian/dashboard/route.ts) loads `StudentGuardian` links before child data; reviewed-grade query and attendance/upcoming work. Missing links and enabled flags materially affect readiness |
| Privacy/authority | Relationship-bound child data only; no global child search or same-school shortcut; respect existing verification/safeguarding flows and score visibility. Shared devices clear child-specific state after logout |
| Target/reuse | Shared state/action/record-summary/message components; guardian-specific linked-child switcher, family digest and explained progress |
| Gap/effort/dependencies | P2 medium/high; 6–10 engineer-days plus 3–5 QA/comprehension days; dependency on linked-child fixtures, flag matrix and approved family language |

## School ADMIN profile

| Audit dimension | Current evidence and target |
| --- | --- |
| Routes/features | Enrollment/invites/import/guardian links/placement; people/classes/timetable/academic year; settings/branding; curriculum/review/coverage; school reporting/operations; communications/media; audit/compliance/support/costs; very large ops subtree |
| UI/visual evidence | Root [admin page](../../app/admin/page.tsx) queries real school counts/classes/attendance/mastery/ScheduledWork/audit data. Broad surface count and mixes of management/intelligence create an IA risk. Not visually inspected |
| Jobs/workflow | School health → identify setup or attendance/data issue → relevant enrollment/people/class record → permitted action → audit/result. Curriculum readiness → inspect gap → route qualified review or deployment owner, not auto-release |
| Hierarchy/layout/a11y | Exceptions with owner/age/status first; counts drill into scoped records. Desktop health + work queues + context; tablet filters and stack; phone critical queue/detail, keep editable tables usable through row drill-in |
| IA | Proposed School Health/Enrollment/People & Classes/Curriculum Deployment/Operations/Governance. Keep specialized ops secondary, separate platform capabilities, retain real route aliases |
| States | Missing school, incomplete onboarding, empty roster/import, restricted export/step-up, failed/stale query, pending review and failed sync must be distinct. Offline admin mutation status cannot show success |
| Controls | CODE many action paths exist; this audit inspected admission, root queries and route inventory, not every specialist mutation. Imports/role changes/exports require their existing service checks; unknown controls explicitly unverified |
| Backend | School-root Prisma queries and permission-controlled APIs; read-only sync diagnostics route exists. A metrics tile is ready only if its query, denominator, freshness and permitted detail destination are ready |
| Privacy/authority | School scoping, platform exception only where real checks allow, step-up for sensitive actions, PII export separately guarded. No cross-school detail inferred from a national count |
| Target/reuse | Shared operational queue/table/filter/detail/state components; admin-specific import preview, enrollment readiness, governance/audit and support diagnostics |
| Gap/effort/dependencies | P2 high operational impact; 10–16 engineer-days plus 5–8 QA days, large ops subtree staged separately. Requires parity coverage and authority-owner review of any navigation reorganization |

## District/County and MOE district-role functions

| Audit dimension | Current evidence and target |
| --- | --- |
| Routes/features | District aggregates and `/moe/districts/[districtId]` exist. No `/district` or `/county` page tree. DISTRICT_ADMIN and MOE_DISTRICT_ADMIN appear in service/permission helpers; portal reachability conflicts documented above |
| UI/visual evidence | Not visually inspected. Existing district detail page and helper source prove functions, not a successfully entered district profile |
| Jobs/workflow | Proposed authorized district scope → schools needing support → suppressed/aggregate evidence → existing report or intervention workflow → follow up. County scope must be defined by existing geography policy, not presumed equivalent to district |
| Hierarchy/layout/a11y | Proposed scope/period/freshness then actionable school queue; accessible table alternative to maps/charts. Desktop scope rail + schools + evidence detail; tablet filter bar + table; phone ranked exceptions + school detail, no student-level drill-in |
| IA | Existing district page composition only; dedicated portal remains PROPOSED. Admit no routes by renaming a menu |
| States/controls | Flag off, inadmissible role, missing district, suppressed cohort, unavailable metrics, stale cache and offline must have distinct explanations. Runtime controls not verified; no authority expansion approved |
| Backend | Permission matrix supports district dashboard; geographic aggregates exist. Role-scope resolution and middleware/layout/API agreement are prerequisites before calling the persona usable |
| Privacy/authority | District scope determined server-side; aggregate suppression and no child PII. County/district/national boundaries and caches must preserve authorized scope |
| Target/reuse | Operational tables, filters, freshness and evidence panels shared with MOE/admin; scope selector and support-priority summary role-specific |
| Gap/effort/dependencies | P3; admission mismatch high severity. After owner resolution, 5–9 engineer-days presentation + 3–5 QA days. Authority reconciliation estimate excluded; no bypass implementation proposed |

## Ministry (MOE_OFFICIAL and MOE_SUPER_ADMIN distinctions)

| Audit dimension | Current evidence and target |
| --- | --- |
| Routes/features | National dashboard, live, districts, policies, curriculum/coverage, approvals, alerts, compliance, exports, submissions, certifications, memory/detectors/optimization and narrative reports. MOE_SUPER_ADMIN is recognized by helpers/review functions but not literal `/moe` portal guard |
| UI/visual evidence | Not visually inspected. [dashboard client](../../app/moe/dashboard/page.tsx) reads dashboard/compliance/impact/placement separately and offers export/report controls; dashboard is not one atomic data source |
| Jobs/workflow | National overview → select valid period/county/district aggregate → interpret evidence quality → inspect school/coverage/compliance exceptions → permitted policy/review/export → track outcome. MOE_SUPER_ADMIN target gated on admission reconciliation |
| Hierarchy/layout/a11y | Decision question, scope and freshness first; priority changes with denominators, not decorative KPI wall. Desktop overview and evidence pane; tablet accessible tables + summaries; phone briefing + exceptions, charts optional |
| IA | Proposed Overview/Coverage & Delivery/Support/Policy & Review/Reports; group existing routes, keep national portal distinct from school context |
| States | Cohort suppression is withheld evidence, not zero; cache age shown; independent source failure does not erase other valid panels. Flag/allowlist/role denial, incomplete curriculum and offline cannot look like a healthy national system |
| Controls | CODE export/report generation buttons and API paths exist; successful action not tested. Review/override/policy controls retain permission, qualification and step-up. No automatic LLM policy decision |
| Backend | [dashboard API](../../app/api/moe/dashboard/route.ts) uses aggregate queries, `MIN_COHORT=5`, Redis 900s cache and synthetic-identity exclusions; actual deploy/cache/data UNKNOWN |
| Privacy/authority | National aggregate only where authorized; suppression retained through filters/export, no student record exposure; scope-aware caching. Existing human release authority preserved |
| Target/reuse | Shared tables/filters/queues/freshness; ministry-specific coverage matrix, geographic summary and policy/evidence decision panels |
| Gap/effort/dependencies | P3; 8–14 engineer-days + 4–7 QA days, with role mismatch and aggregate policy owners prerequisite |

## Curriculum Author/Qualified Reviewer functions

| Audit dimension | Current evidence and target |
| --- | --- |
| Routes/features | Teacher create/edit/share lesson, admin curriculum/review/content-review, `/review/queue`, `/review/tasks/[taskId]`, `/review/operations`, Teacher Preview. No separate author/reviewer enum or portal |
| UI/visual evidence | Not visually inspected. Queue source uses white/slate table inside otherwise dark product; exact revisions, authority and required review count shown. Preview has sequence/content/details layouts and separate student projection |
| Jobs/workflow | Author permitted draft → objective/source binding → exact revision → readiness diagnostics → qualified review queue → inspect rubric/rights/media/learner preview → record authorized decision → existing publication/release owner → eligible delivery. Authoring success is not student eligibility |
| Hierarchy/layout/a11y | Artifact identity/version/state first, next required review task next, source and learner preview alongside; accessible keyboard sequence and readable diffs. Desktop queue/editor + preview + evidence; tablet two areas; phone queue/detail with stacked source/preview, no hidden destructive actions |
| IA | Proposed Authoring/Review/Preview/Readiness workspace groups over existing authorized routes; not a new permission hierarchy |
| States | Flag off 404, no eligible tasks, insufficient qualification, stale exact revision, missing source/media/tool, unreleased candidate and resolver unavailable are separate. Missing release does not get a Publish button through styling |
| Controls | CODE queue links and preview item/mode controls wired; preview no mutations. Exact review APIs are separate authority; runtime and qualifications not exercised. Candidate tap feedback ephemeral, not recorded learner attempts |
| Backend | Review task/profile/credentials/qualification services, immutable revision governance; ActivityDefinition exact resolver. Main default ContentBundle readers null; persistence branch does not close all adapters. Source rights/media/offline closure unresolved |
| Privacy/authority | Read access from `queueSchoolFilter`/`assertReviewReadScope` versus approval qualification; teacher/system resources withheld from learner view; no secrets/answer keys in student DTO; AI may draft, humans approve |
| Target/reuse | Shared queues/state/filter/version header/detail layout; specific exact-revision inspector, source/rights checklist, comparison viewer and teacher/student preview boundary |
| Gap/effort/dependencies | P3; 10–18 engineer-days + 6–10 content/QA days, excludes governance/storage changes. Real immutable compositions, ActivityDefinition records and approved assets owned outside presentation wave |

## Platform administrator and public/supporting surfaces

| Audit dimension | Platform | Public/supporting |
| --- | --- | --- |
| Inventory | `/platform`, ops, schools, audit, reports, security/accept, demo; admin specialized ops where admitted | Auth/recovery/register/enroll/onboarding/help/legal/offline; certificate verify/share, credential token and portfolio share; generic dashboard/classes/assignments/placement/progress aliases; dev lab review |
| Visual status | Not visually inspected; seven platform navigation destinations and layered gates | Not visually inspected; no public screenshot treated as production audit evidence |
| Jobs/workflow | System issue → exact run/tenant context → permitted diagnostics → existing recovery/approval owner → audit result | Enter correct portal; recover access; complete permitted enrollment/placement; verify exactly shared credential; read help/offline fallback |
| Hierarchy/devices | Desktop operational queue/details, tablet stacked panes, phone health and escalation detail; dense consoles remain specialist | Desktop centered form plus short help, tablet/phone full-width form with readable errors; verification presents status/issuer/allowed facts first |
| IA/states | Separate system operations from school health; missing flag/allowlist/role/scope, failed run and stale telemetry visible | Expired token, denied artifact, failed login, pending enrollment, unavailable offline pack; never leak child existence on denied public tokens |
| Controls/data | CODE navigation and services exist; no operational action run in audit. Gate parity and real telemetry unverified | CODE pages inventoried; transitive public artifact guards require future authorized tests; successful flows unverified |
| Constraints | Platform capability, exact-role checks, step-up, audit and explicit tenant context. No production reset in design audit | Consent/privacy and token scope retained; development review harness not publicly enabled in production |
| Shared/specific | Shared queues/tables/states; specialist run/evidence/approval panels | Shared forms/states; specific invite/token/credential verification |
| Severity/effort | P3 specialist follow-on, 5–9 engineer-days + 3–5 QA after platform gate parity | P2/P3 scoped parity work, 3–6 engineer-days + 2–4 QA; do not expand into a public marketing redesign |

## Cross-profile implementation constraints

Browser acceptance covers every profile at 320/390/768/1024/1440/1920 CSS px, keyboard/200% text/400% zoom, reduced motion, loading/empty/503/401/403/stale/offline and cross-tenant/cross-child denial. Not all profiles need the same density or dashboard. Target compositions and exact thresholds are in [design system](VISUAL_DESIGN_SYSTEM_V3.md) and [roadmap](IMPLEMENTATION_ROADMAP_V3.md).

Effort ranges are incremental planning estimates with shared components reused, not a fixed delivery quote. Role-specific ranges overlap wave estimates and must not be summed blindly. Content production, legal/source review, new persistent contracts and deployment are excluded. Current persistence/ScheduledWork, ActivityDefinition, evidence/mastery, release and qualification authorities remain unchanged.

## Exact main page inventory

The generated inventory below reads every tracked `app/**/page.tsx` file at this SHA. It excludes backups and API handlers. The path proves page existence; **namespace grouping does not prove authorization**. Direct guard/data markers are source-search hints only: child components, layouts, middleware and services may own the real checks. Each role's actual admission is explained above. A file without a direct marker is not declared unprotected. All inventory rows are not visually inspected, and specialist controls not covered by deep reads remain runtime-unverified.

<!-- MAIN_PAGE_INVENTORY -->

Source scan: **343 exact page routes**. Namespace counts: admin 126, guardian 16, lab-review 3, moe 19, platform 8, review 3, shared-public-supporting 44, student 61, teacher 63. No route names were invented.

### admin page routes

| Route → source | Direct guard/flag markers | Direct data/control wiring markers |
| --- | --- | --- |
| [`/admin/academic-year`](../../app/admin/academic-year/page.tsx) | delegated / no direct marker | fetch; click handler; disabled states |
| [`/admin/agents/invocations`](../../app/admin/agents/invocations/page.tsx) | delegated / no direct marker | fetch; click handler; disabled states |
| [`/admin/agents`](../../app/admin/agents/page.tsx) | delegated / no direct marker | fetch; click handler |
| [`/admin/ai-costs`](../../app/admin/ai-costs/page.tsx) | isAiCostDashboardEnabled, requireUser | redirect |
| [`/admin/ai-quality`](../../app/admin/ai-quality/page.tsx) | isAiQualityDashboardEnabled, requireUser | redirect |
| [`/admin/analytics`](../../app/admin/analytics/page.tsx) | delegated / no direct marker | fetch; click handler |
| [`/admin/announcements`](../../app/admin/announcements/page.tsx) | delegated / no direct marker | fetch; click handler; disabled states |
| [`/admin/assignments`](../../app/admin/assignments/page.tsx) | delegated / no direct marker | fetch; click handler; disabled states |
| [`/admin/audio-generation`](../../app/admin/audio-generation/page.tsx) | requireUser | redirect |
| [`/admin/audit-log`](../../app/admin/audit-log/page.tsx) | delegated / no direct marker | redirect |
| [`/admin/audit`](../../app/admin/audit/page.tsx) | requireRole | DB: auditLog, user; redirect |
| [`/admin/classes`](../../app/admin/classes/page.tsx) | delegated / no direct marker | fetch; click handler; disabled states |
| [`/admin/communications/flags`](../../app/admin/communications/flags/page.tsx) | delegated / no direct marker | fetch; click handler; disabled states |
| [`/admin/communications`](../../app/admin/communications/page.tsx) | delegated / no direct marker | fetch |
| [`/admin/compliance`](../../app/admin/compliance/page.tsx) | isGovAuditSearchEnabled, requireUser | DB: auditLog, exportRecord; redirect |
| [`/admin/content-media`](../../app/admin/content-media/page.tsx) | delegated / no direct marker | fetch; click handler; disabled states |
| [`/admin/content-review`](../../app/admin/content-review/page.tsx) | delegated / no direct marker | fetch; click handler; disabled states |
| [`/admin/cost-dashboard`](../../app/admin/cost-dashboard/page.tsx) | isCostDashboardEnabled, requireUser | redirect |
| [`/admin/credential-card`](../../app/admin/credential-card/page.tsx) | requireRole | DB: user; redirect |
| [`/admin/credentials`](../../app/admin/credentials/page.tsx) | delegated / no direct marker | fetch; click handler; disabled states |
| [`/admin/curriculum/[contentId]/review`](../../app/admin/curriculum/[contentId]/review/page.tsx) | delegated / no direct marker | fetch; click handler; disabled states |
| [`/admin/curriculum/coverage`](../../app/admin/curriculum/coverage/page.tsx) | delegated / no direct marker | fetch |
| [`/admin/curriculum`](../../app/admin/curriculum/page.tsx) | delegated / no direct marker | fetch; click handler; disabled states |
| [`/admin/curriculum/units`](../../app/admin/curriculum/units/page.tsx) | delegated / no direct marker | fetch; click handler; disabled states |
| [`/admin/curriculum/year-readiness`](../../app/admin/curriculum/year-readiness/page.tsx) | delegated / no direct marker | fetch; click handler; disabled states |
| [`/admin/demo-reset`](../../app/admin/demo-reset/page.tsx) | requireRole | redirect |
| [`/admin/district-updates`](../../app/admin/district-updates/page.tsx) | requireUser | DB: class, school; redirect |
| [`/admin/documents`](../../app/admin/documents/page.tsx) | delegated / no direct marker | fetch; click handler; disabled states |
| [`/admin/enrollment`](../../app/admin/enrollment/page.tsx) | delegated / no direct marker | fetch; disabled states |
| [`/admin/events`](../../app/admin/events/page.tsx) | delegated / no direct marker | fetch; click handler; disabled states |
| [`/admin/exams`](../../app/admin/exams/page.tsx) | isExamSystemEnabled | redirect |
| [`/admin/governance/exports`](../../app/admin/governance/exports/page.tsx) | isGovExportsEnabled, isGovNationalExportEnabled, requireUser | DB: exportRecord; redirect |
| [`/admin/governance`](../../app/admin/governance/page.tsx) | requireUser | redirect |
| [`/admin/guardian-link`](../../app/admin/guardian-link/page.tsx) | delegated / no direct marker | fetch; disabled states |
| [`/admin/homework`](../../app/admin/homework/page.tsx) | delegated / no direct marker | fetch; click handler; disabled states |
| [`/admin/interoperability`](../../app/admin/interoperability/page.tsx) | requireUser | redirect |
| [`/admin/invites`](../../app/admin/invites/page.tsx) | delegated / no direct marker | fetch; disabled states |
| [`/admin/metrics`](../../app/admin/metrics/page.tsx) | requireUser | redirect |
| [`/admin/moe-submissions`](../../app/admin/moe-submissions/page.tsx) | delegated / no direct marker | fetch; click handler; disabled states |
| [`/admin/notifications`](../../app/admin/notifications/page.tsx) | delegated / no direct marker | fetch |
| [`/admin/onboarding/launch-checklist`](../../app/admin/onboarding/launch-checklist/page.tsx) | requireRole | redirect |
| [`/admin/onboarding`](../../app/admin/onboarding/page.tsx) | delegated / no direct marker | fetch; click handler; disabled states |
| [`/admin/onboarding/readiness`](../../app/admin/onboarding/readiness/page.tsx) | isPilotReadinessDashboardEnabled, isPilotReadinessEnabled, notFound | redirect |
| [`/admin/ops/actions/[actionExecutionId]`](../../app/admin/ops/actions/[actionExecutionId]/page.tsx) | notFound, requireUser | redirect |
| [`/admin/ops/approvals/[approvalRequestId]`](../../app/admin/ops/approvals/[approvalRequestId]/page.tsx) | notFound, requireUser | redirect |
| [`/admin/ops/approvals`](../../app/admin/ops/approvals/page.tsx) | requireUser | redirect |
| [`/admin/ops/curriculum-regeneration`](../../app/admin/ops/curriculum-regeneration/page.tsx) | requireUser | redirect |
| [`/admin/ops/curriculum-review`](../../app/admin/ops/curriculum-review/page.tsx) | requireUser | redirect |
| [`/admin/ops/detectors/evidence/[decisionId]`](../../app/admin/ops/detectors/evidence/[decisionId]/page.tsx) | notFound, requireUser | redirect |
| [`/admin/ops/detectors/executions/[workflowRunId]`](../../app/admin/ops/detectors/executions/[workflowRunId]/page.tsx) | notFound, requireUser | redirect |
| [`/admin/ops/detectors`](../../app/admin/ops/detectors/page.tsx) | requireUser | redirect |
| [`/admin/ops/early-warnings`](../../app/admin/ops/early-warnings/page.tsx) | requireUser | redirect |
| [`/admin/ops/effectiveness`](../../app/admin/ops/effectiveness/page.tsx) | requireUser | redirect |
| [`/admin/ops/evaluations`](../../app/admin/ops/evaluations/page.tsx) | requireUser | redirect |
| [`/admin/ops/execution/health`](../../app/admin/ops/execution/health/page.tsx) | requireUser | redirect |
| [`/admin/ops/execution/low-risk`](../../app/admin/ops/execution/low-risk/page.tsx) | requireUser | redirect |
| [`/admin/ops/execution`](../../app/admin/ops/execution/page.tsx) | requireUser | redirect |
| [`/admin/ops/false-positives`](../../app/admin/ops/false-positives/page.tsx) | requireUser | redirect |
| [`/admin/ops/forecast-calibration`](../../app/admin/ops/forecast-calibration/page.tsx) | requireUser | redirect |
| [`/admin/ops/forecasting`](../../app/admin/ops/forecasting/page.tsx) | requireUser | redirect |
| [`/admin/ops/health`](../../app/admin/ops/health/page.tsx) | requireUser | redirect |
| [`/admin/ops/memory/[memoryEventId]`](../../app/admin/ops/memory/[memoryEventId]/page.tsx) | notFound, requireUser | redirect |
| [`/admin/ops/memory`](../../app/admin/ops/memory/page.tsx) | requireUser | redirect |
| [`/admin/ops/optimization/[proposalEventId]`](../../app/admin/ops/optimization/[proposalEventId]/page.tsx) | isImplementationWorkflowEnabled, requireUser | redirect |
| [`/admin/ops/optimization/change-requests/[changeRequestId]/audit`](../../app/admin/ops/optimization/change-requests/[changeRequestId]/audit/page.tsx) | requireUser | redirect |
| [`/admin/ops/optimization/change-requests/[changeRequestId]`](../../app/admin/ops/optimization/change-requests/[changeRequestId]/page.tsx) | isImplementationWorkflowEnabled, requireUser | redirect |
| [`/admin/ops/optimization/change-requests/[changeRequestId]/post-change-eval`](../../app/admin/ops/optimization/change-requests/[changeRequestId]/post-change-eval/page.tsx) | requireUser | redirect |
| [`/admin/ops/optimization/change-requests/[changeRequestId]/rollout`](../../app/admin/ops/optimization/change-requests/[changeRequestId]/rollout/page.tsx) | requireUser | redirect |
| [`/admin/ops/optimization/change-requests/[changeRequestId]/signoff`](../../app/admin/ops/optimization/change-requests/[changeRequestId]/signoff/page.tsx) | delegated / no direct marker | fetch; click handler; disabled states |
| [`/admin/ops/optimization/change-requests`](../../app/admin/ops/optimization/change-requests/page.tsx) | isImplementationWorkflowEnabled, requireUser | redirect |
| [`/admin/ops/optimization/effectiveness`](../../app/admin/ops/optimization/effectiveness/page.tsx) | requireUser | redirect |
| [`/admin/ops/optimization/evaluation-windows`](../../app/admin/ops/optimization/evaluation-windows/page.tsx) | requireUser | redirect |
| [`/admin/ops/optimization/outcomes`](../../app/admin/ops/optimization/outcomes/page.tsx) | requireUser | redirect |
| [`/admin/ops/optimization`](../../app/admin/ops/optimization/page.tsx) | isAutonomousOptimizationEnabled, requireUser | redirect |
| [`/admin/ops/optimization/readiness`](../../app/admin/ops/optimization/readiness/page.tsx) | isAutonomousOptimizationEnabled, requireUser | redirect |
| [`/admin/ops/optimization/rollout`](../../app/admin/ops/optimization/rollout/page.tsx) | isAutonomousOptimizationEnabled, requireUser | redirect |
| [`/admin/ops/optimization/tuning`](../../app/admin/ops/optimization/tuning/page.tsx) | isAutonomousOptimizationEnabled, requireUser | redirect |
| [`/admin/ops`](../../app/admin/ops/page.tsx) | requireUser | redirect |
| [`/admin/ops/prediction-review`](../../app/admin/ops/prediction-review/page.tsx) | requireUser | redirect |
| [`/admin/ops/predictions`](../../app/admin/ops/predictions/page.tsx) | requireUser | redirect |
| [`/admin/ops/readiness`](../../app/admin/ops/readiness/page.tsx) | requireUser | redirect |
| [`/admin/ops/recommendations/[decisionId]`](../../app/admin/ops/recommendations/[decisionId]/page.tsx) | notFound, requireUser | redirect |
| [`/admin/ops/recommendations`](../../app/admin/ops/recommendations/page.tsx) | requireUser | redirect |
| [`/admin/ops/runtime/cron`](../../app/admin/ops/runtime/cron/page.tsx) | isRuntimeDashboardEnabled, requireUser | redirect |
| [`/admin/ops/runtime/dead-letter/[workflowRunId]`](../../app/admin/ops/runtime/dead-letter/[workflowRunId]/page.tsx) | isRuntimeDashboardEnabled, notFound, requireUser | redirect |
| [`/admin/ops/runtime/dead-letter`](../../app/admin/ops/runtime/dead-letter/page.tsx) | isRuntimeDashboardEnabled, requireUser | redirect |
| [`/admin/ops/runtime`](../../app/admin/ops/runtime/page.tsx) | isRuntimeDashboardEnabled, requireUser | redirect |
| [`/admin/ops/runtime/queue`](../../app/admin/ops/runtime/queue/page.tsx) | isRuntimeDashboardEnabled, requireUser | redirect |
| [`/admin/ops/runtime/recovery`](../../app/admin/ops/runtime/recovery/page.tsx) | isRuntimeDashboardEnabled, isWorkflowRecoveryCronEnabled, requireUser | redirect |
| [`/admin/ops/runtime/runs/[runId]`](../../app/admin/ops/runtime/runs/[runId]/page.tsx) | isRuntimeDashboardEnabled, notFound, requirePlatformAdmin | redirect |
| [`/admin/ops/runtime/runs`](../../app/admin/ops/runtime/runs/page.tsx) | isRuntimeDashboardEnabled, requirePlatformAdmin | redirect |
| [`/admin/ops/runtime/smoke`](../../app/admin/ops/runtime/smoke/page.tsx) | isRuntimeDashboardEnabled, requirePlatformAdmin | redirect |
| [`/admin/ops/runtime/workers`](../../app/admin/ops/runtime/workers/page.tsx) | isRuntimeDashboardEnabled, requireUser | redirect |
| [`/admin/ops/signals`](../../app/admin/ops/signals/page.tsx) | requireUser | redirect |
| [`/admin/ops/stale-approvals`](../../app/admin/ops/stale-approvals/page.tsx) | requireUser | redirect |
| [`/admin/ops/workflows/[workflowRunId]`](../../app/admin/ops/workflows/[workflowRunId]/page.tsx) | notFound, requireUser | DB: approvalRequest, executionTrace, workflowRun; redirect |
| [`/admin/ops/workflows/[workflowRunId]/replay`](../../app/admin/ops/workflows/[workflowRunId]/replay/page.tsx) | delegated / no direct marker | fetch; click handler; disabled states |
| [`/admin/ops/workflows`](../../app/admin/ops/workflows/page.tsx) | requireUser | DB: workflowRun; redirect |
| [`/admin`](../../app/admin/page.tsx) | delegated / no direct marker | DB: attendanceRecord, auditLog, class, scheduledWork, school, schoolOnboarding, studentMasteryProfile, user; redirect |
| [`/admin/pilot-readiness`](../../app/admin/pilot-readiness/page.tsx) | isPilotReadinessDashboardEnabled, isPilotReadinessEnabled, notFound | redirect |
| [`/admin/pilot-score`](../../app/admin/pilot-score/page.tsx) | delegated / no direct marker | fetch |
| [`/admin/pipeline-status`](../../app/admin/pipeline-status/page.tsx) | requireUser | redirect |
| [`/admin/placements/[placementId]`](../../app/admin/placements/[placementId]/page.tsx) | delegated / no direct marker | fetch; click handler; disabled states |
| [`/admin/placements`](../../app/admin/placements/page.tsx) | delegated / no direct marker | fetch; click handler |
| [`/admin/rag`](../../app/admin/rag/page.tsx) | isRagTutorEnabled, notFound, requireUser | component/render delegation |
| [`/admin/report-cards`](../../app/admin/report-cards/page.tsx) | delegated / no direct marker | fetch; click handler; disabled states |
| [`/admin/reports`](../../app/admin/reports/page.tsx) | delegated / no direct marker | fetch; click handler; disabled states |
| [`/admin/school-branding`](../../app/admin/school-branding/page.tsx) | delegated / no direct marker | fetch; disabled states |
| [`/admin/school-settings`](../../app/admin/school-settings/page.tsx) | delegated / no direct marker | fetch; click handler; disabled states |
| [`/admin/school`](../../app/admin/school/page.tsx) | delegated / no direct marker | fetch; click handler |
| [`/admin/schools/[id]`](../../app/admin/schools/[id]/page.tsx) | notFound, requireUser | DB: school, user; redirect |
| [`/admin/schools`](../../app/admin/schools/page.tsx) | requireUser | DB: school; redirect |
| [`/admin/schools/pending`](../../app/admin/schools/pending/page.tsx) | delegated / no direct marker | fetch; click handler |
| [`/admin/seed`](../../app/admin/seed/page.tsx) | delegated / no direct marker | fetch; click handler; disabled states |
| [`/admin/settings/canva`](../../app/admin/settings/canva/page.tsx) | delegated / no direct marker | DB: canvaOAuthCredential; redirect; disabled states |
| [`/admin/students/[id]`](../../app/admin/students/[id]/page.tsx) | delegated / no direct marker | fetch |
| [`/admin/students/import`](../../app/admin/students/import/page.tsx) | delegated / no direct marker | fetch; click handler; disabled states |
| [`/admin/students`](../../app/admin/students/page.tsx) | delegated / no direct marker | fetch; click handler; disabled states |
| [`/admin/support/sync-diagnostics/[learnerId]`](../../app/admin/support/sync-diagnostics/[learnerId]/page.tsx) | delegated / no direct marker | fetch |
| [`/admin/support/sync-diagnostics`](../../app/admin/support/sync-diagnostics/page.tsx) | delegated / no direct marker | component/render delegation |
| [`/admin/teachers`](../../app/admin/teachers/page.tsx) | delegated / no direct marker | component/render delegation |
| [`/admin/textbook-generation`](../../app/admin/textbook-generation/page.tsx) | requireUser | redirect |
| [`/admin/timetable`](../../app/admin/timetable/page.tsx) | delegated / no direct marker | fetch; click handler; disabled states |
| [`/admin/training/adoption`](../../app/admin/training/adoption/page.tsx) | isTrainingCenterEnabled, requireUser | redirect |
| [`/admin/video-moderation`](../../app/admin/video-moderation/page.tsx) | delegated / no direct marker | fetch; click handler; disabled states |
| [`/admin/videos/review`](../../app/admin/videos/review/page.tsx) | delegated / no direct marker | redirect |

### guardian page routes

| Route → source | Direct guard/flag markers | Direct data/control wiring markers |
| --- | --- | --- |
| [`/guardian/assignments`](../../app/guardian/assignments/page.tsx) | delegated / no direct marker | fetch |
| [`/guardian/attendance`](../../app/guardian/attendance/page.tsx) | delegated / no direct marker | fetch; click handler |
| [`/guardian/dashboard`](../../app/guardian/dashboard/page.tsx) | isGuardianPortalEnabled | redirect |
| [`/guardian/events`](../../app/guardian/events/page.tsx) | delegated / no direct marker | component/render delegation |
| [`/guardian/grades`](../../app/guardian/grades/page.tsx) | delegated / no direct marker | fetch; click handler |
| [`/guardian/link`](../../app/guardian/link/page.tsx) | delegated / no direct marker | fetch; disabled states |
| [`/guardian/messages`](../../app/guardian/messages/page.tsx) | delegated / no direct marker | fetch; click handler; disabled states |
| [`/guardian/onboarding`](../../app/guardian/onboarding/page.tsx) | delegated / no direct marker | component/render delegation |
| [`/guardian`](../../app/guardian/page.tsx) | isGuardianPortalEnabled | redirect |
| [`/guardian/progress`](../../app/guardian/progress/page.tsx) | isGuardianProgressViewEnabled | redirect |
| [`/guardian/register`](../../app/guardian/register/page.tsx) | delegated / no direct marker | DB: school, student, user |
| [`/guardian/report-cards`](../../app/guardian/report-cards/page.tsx) | delegated / no direct marker | fetch |
| [`/guardian/settings`](../../app/guardian/settings/page.tsx) | requireRole | component/render delegation |
| [`/guardian/settings/phone`](../../app/guardian/settings/phone/page.tsx) | requireRole | component/render delegation |
| [`/guardian/student/[studentId]`](../../app/guardian/student/[studentId]/page.tsx) | delegated / no direct marker | fetch |
| [`/guardian/welcome`](../../app/guardian/welcome/page.tsx) | requireRole | DB: studentGuardian |

### lab-review page routes

| Route → source | Direct guard/flag markers | Direct data/control wiring markers |
| --- | --- | --- |
| [`/lab-review/[labId]`](../../app/lab-review/[labId]/page.tsx) | isLabReviewHarnessEnabled, notFound | component/render delegation |
| [`/lab-review/experience/[experienceId]/lab/[labId]`](../../app/lab-review/experience/[experienceId]/lab/[labId]/page.tsx) | isLearnerExperiencePrototypeEnabled, notFound | component/render delegation |
| [`/lab-review/experience/[experienceId]`](../../app/lab-review/experience/[experienceId]/page.tsx) | isLearnerExperiencePrototypeEnabled, notFound | component/render delegation |

### moe page routes

| Route → source | Direct guard/flag markers | Direct data/control wiring markers |
| --- | --- | --- |
| [`/moe/alerts`](../../app/moe/alerts/page.tsx) | delegated / no direct marker | fetch |
| [`/moe/approvals`](../../app/moe/approvals/page.tsx) | isActionGovernanceEnabled, requireMoePortalUser | component/render delegation |
| [`/moe/certifications/[id]`](../../app/moe/certifications/[id]/page.tsx) | notFound, requireMoeActor | DB: examCertification |
| [`/moe/compliance`](../../app/moe/compliance/page.tsx) | delegated / no direct marker | fetch; click handler; disabled states |
| [`/moe/curriculum/coverage`](../../app/moe/curriculum/coverage/page.tsx) | delegated / no direct marker | fetch |
| [`/moe/curriculum`](../../app/moe/curriculum/page.tsx) | delegated / no direct marker | fetch; click handler; disabled states |
| [`/moe/dashboard`](../../app/moe/dashboard/page.tsx) | delegated / no direct marker | fetch; click handler; disabled states |
| [`/moe/detectors`](../../app/moe/detectors/page.tsx) | isDetectorMoeAggregationEnabled, isNationalTrendAnalysisEnabled, requireMoePortalUser | component/render delegation |
| [`/moe/districts/[districtId]`](../../app/moe/districts/[districtId]/page.tsx) | delegated / no direct marker | fetch |
| [`/moe/districts`](../../app/moe/districts/page.tsx) | delegated / no direct marker | fetch |
| [`/moe/exports`](../../app/moe/exports/page.tsx) | delegated / no direct marker | DB: school; redirect |
| [`/moe/live`](../../app/moe/live/page.tsx) | delegated / no direct marker | redirect |
| [`/moe/login`](../../app/moe/login/page.tsx) | isMoeLoginPortalEnabled | component/render delegation |
| [`/moe/memory`](../../app/moe/memory/page.tsx) | requireUser | redirect |
| [`/moe/onboarding`](../../app/moe/onboarding/page.tsx) | isMoePortalEnabled, requireUser | redirect |
| [`/moe/optimization`](../../app/moe/optimization/page.tsx) | isAutonomousOptimizationEnabled, requireUser | redirect |
| [`/moe/policies`](../../app/moe/policies/page.tsx) | delegated / no direct marker | fetch; click handler; disabled states |
| [`/moe/reports/narrative`](../../app/moe/reports/narrative/page.tsx) | delegated / no direct marker | DB: district, school; redirect |
| [`/moe/submissions`](../../app/moe/submissions/page.tsx) | delegated / no direct marker | fetch; click handler; disabled states |

### platform page routes

| Route → source | Direct guard/flag markers | Direct data/control wiring markers |
| --- | --- | --- |
| [`/platform/audit`](../../app/platform/audit/page.tsx) | notFound, requireMoePlatformAdmin | DB: auditLog; redirect |
| [`/platform/demo`](../../app/platform/demo/page.tsx) | delegated / no direct marker | fetch; click handler; disabled states |
| [`/platform/ops`](../../app/platform/ops/page.tsx) | requireUser | redirect |
| [`/platform`](../../app/platform/page.tsx) | notFound, requireMoePortalUser | DB: auditLog, curriculumContent, curriculumUnit, school, user; redirect |
| [`/platform/reports`](../../app/platform/reports/page.tsx) | notFound, requireMoePlatformAdmin | DB: attendanceRecord, curriculumContent, enrollment, grade, school, user; redirect |
| [`/platform/schools`](../../app/platform/schools/page.tsx) | delegated / no direct marker | fetch; click handler; disabled states |
| [`/platform/security/accept`](../../app/platform/security/accept/page.tsx) | delegated / no direct marker | fetch; click handler; disabled states |
| [`/platform/security`](../../app/platform/security/page.tsx) | notFound, requireMoePlatformAdmin | DB: platformTransferToken, user; redirect |

### review page routes

| Route → source | Direct guard/flag markers | Direct data/control wiring markers |
| --- | --- | --- |
| [`/review/operations`](../../app/review/operations/page.tsx) | assertReviewOperationsAdmin, isP2bReviewOperationsEnabled, notFound, requireUser | DB: reviewCalibrationSession, reviewerProfile |
| [`/review/queue`](../../app/review/queue/page.tsx) | isP2bReviewOperationsEnabled, notFound, queueSchoolFilter, requireUser | component/render delegation |
| [`/review/tasks/[taskId]`](../../app/review/tasks/[taskId]/page.tsx) | isP2bReviewOperationsEnabled, notFound, requireUser | component/render delegation |

### shared-public-supporting page routes

| Route → source | Direct guard/flag markers | Direct data/control wiring markers |
| --- | --- | --- |
| [`/ai-tutor`](../../app/ai-tutor/page.tsx) | delegated / no direct marker | redirect |
| [`/app`](../../app/app/page.tsx) | delegated / no direct marker | redirect |
| [`/assignments/[id]`](../../app/assignments/[id]/page.tsx) | delegated / no direct marker | DB: homework, student; redirect |
| [`/assignments`](../../app/assignments/page.tsx) | delegated / no direct marker | DB: enrollment, student; redirect |
| [`/auth/step-up`](../../app/auth/step-up/page.tsx) | delegated / no direct marker | component/render delegation |
| [`/classes`](../../app/classes/page.tsx) | delegated / no direct marker | DB: student; redirect |
| [`/contact`](../../app/contact/page.tsx) | delegated / no direct marker | component/render delegation |
| [`/credential/[token]`](../../app/credential/[token]/page.tsx) | delegated / no direct marker | DB: portfolioCredential |
| [`/dashboard`](../../app/dashboard/page.tsx) | delegated / no direct marker | DB: chatMessage, reportCard, student; redirect |
| [`/data-policy`](../../app/data-policy/page.tsx) | delegated / no direct marker | redirect |
| [`/enroll`](../../app/enroll/page.tsx) | delegated / no direct marker | fetch; disabled states |
| [`/forgot-password`](../../app/forgot-password/page.tsx) | delegated / no direct marker | fetch; disabled states |
| [`/governance`](../../app/governance/page.tsx) | delegated / no direct marker | fetch |
| [`/help/admin`](../../app/help/admin/page.tsx) | delegated / no direct marker | component/render delegation |
| [`/help/guardian`](../../app/help/guardian/page.tsx) | delegated / no direct marker | component/render delegation |
| [`/help/moe`](../../app/help/moe/page.tsx) | delegated / no direct marker | component/render delegation |
| [`/help`](../../app/help/page.tsx) | delegated / no direct marker | component/render delegation |
| [`/help/student`](../../app/help/student/page.tsx) | delegated / no direct marker | component/render delegation |
| [`/help/teacher`](../../app/help/teacher/page.tsx) | delegated / no direct marker | component/render delegation |
| [`/league/embed`](../../app/league/embed/page.tsx) | delegated / no direct marker | fetch |
| [`/league`](../../app/league/page.tsx) | delegated / no direct marker | fetch; click handler |
| [`/legal/data-for-minors`](../../app/legal/data-for-minors/page.tsx) | delegated / no direct marker | component/render delegation |
| [`/legal/data-retention`](../../app/legal/data-retention/page.tsx) | delegated / no direct marker | component/render delegation |
| [`/legal/privacy`](../../app/legal/privacy/page.tsx) | delegated / no direct marker | component/render delegation |
| [`/legal/procurement-security-packet`](../../app/legal/procurement-security-packet/page.tsx) | delegated / no direct marker | component/render delegation |
| [`/legal/terms`](../../app/legal/terms/page.tsx) | delegated / no direct marker | component/render delegation |
| [`/login`](../../app/login/page.tsx) | delegated / no direct marker | component/render delegation |
| [`/offline`](../../app/offline/page.tsx) | delegated / no direct marker | click handler |
| [`/onboard/accept`](../../app/onboard/accept/page.tsx) | delegated / no direct marker | fetch; disabled states |
| [`/`](../../app/page.tsx) | delegated / no direct marker | DB: curriculumContent |
| [`/pilot-preview`](../../app/pilot-preview/page.tsx) | delegated / no direct marker | component/render delegation |
| [`/placement`](../../app/placement/page.tsx) | delegated / no direct marker | fetch; click handler; disabled states |
| [`/portfolio/[shareCode]`](../../app/portfolio/[shareCode]/page.tsx) | isPortfolioFlagEnabled, notFound | component/render delegation |
| [`/privacy`](../../app/privacy/page.tsx) | delegated / no direct marker | redirect |
| [`/progress`](../../app/progress/page.tsx) | delegated / no direct marker | DB: student; redirect |
| [`/register/guardian`](../../app/register/guardian/page.tsx) | delegated / no direct marker | fetch; disabled states |
| [`/register/student`](../../app/register/student/page.tsx) | delegated / no direct marker | fetch; disabled states |
| [`/reset-password`](../../app/reset-password/page.tsx) | delegated / no direct marker | fetch; disabled states |
| [`/reset-with-code`](../../app/reset-with-code/page.tsx) | delegated / no direct marker | fetch; click handler; disabled states |
| [`/share/certificate/[id]`](../../app/share/certificate/[id]/page.tsx) | notFound | DB: certificate, scheduledWork |
| [`/signout`](../../app/signout/page.tsx) | delegated / no direct marker | click handler; disabled states |
| [`/terms`](../../app/terms/page.tsx) | delegated / no direct marker | redirect |
| [`/unauthorized`](../../app/unauthorized/page.tsx) | delegated / no direct marker | component/render delegation |
| [`/verify/[certificateCode]`](../../app/verify/[certificateCode]/page.tsx) | notFound | component/render delegation |

### student page routes

| Route → source | Direct guard/flag markers | Direct data/control wiring markers |
| --- | --- | --- |
| [`/student/[id]`](../../app/student/[id]/page.tsx) | delegated / no direct marker | fetch |
| [`/student/adaptive`](../../app/student/adaptive/page.tsx) | isAdaptiveEngineEnabled, requireRole | redirect |
| [`/student/ai-tutor`](../../app/student/ai-tutor/page.tsx) | isRagTutorEnabled, requireRole | component/render delegation |
| [`/student/assignments/[id]`](../../app/student/assignments/[id]/page.tsx) | requireRole | DB: assignment, student; redirect |
| [`/student/assignments`](../../app/student/assignments/page.tsx) | delegated / no direct marker | fetch; click handler; disabled states |
| [`/student/capstone`](../../app/student/capstone/page.tsx) | delegated / no direct marker | fetch; click handler; disabled states |
| [`/student/certificates`](../../app/student/certificates/page.tsx) | requireRole | component/render delegation |
| [`/student/certifications`](../../app/student/certifications/page.tsx) | isExamSystemEnabled | redirect |
| [`/student/change-pin`](../../app/student/change-pin/page.tsx) | delegated / no direct marker | fetch; disabled states |
| [`/student/class/[classId]/discussion`](../../app/student/class/[classId]/discussion/page.tsx) | delegated / no direct marker | fetch; click handler; disabled states |
| [`/student/classes/[classId]`](../../app/student/classes/[classId]/page.tsx) | notFound, requireRole | component/render delegation |
| [`/student/classes`](../../app/student/classes/page.tsx) | requireRole | component/render delegation |
| [`/student/dashboard`](../../app/student/dashboard/page.tsx) | delegated / no direct marker | redirect |
| [`/student/discussion`](../../app/student/discussion/page.tsx) | requireRole | DB: discussionLastRead, enrollment; redirect |
| [`/student/events`](../../app/student/events/page.tsx) | delegated / no direct marker | component/render delegation |
| [`/student/exams/[examId]`](../../app/student/exams/[examId]/page.tsx) | isExamSystemEnabled | redirect |
| [`/student/exams`](../../app/student/exams/page.tsx) | delegated / no direct marker | component/render delegation |
| [`/student/homework/[id]`](../../app/student/homework/[id]/page.tsx) | delegated / no direct marker | fetch; click handler; disabled states |
| [`/student/homework`](../../app/student/homework/page.tsx) | delegated / no direct marker | DB: homework, student; redirect |
| [`/student/interactive-labs/[labId]`](../../app/student/interactive-labs/[labId]/page.tsx) | delegated / no direct marker | redirect |
| [`/student/labs/[labId]`](../../app/student/labs/[labId]/page.tsx) | requireRole | component/render delegation |
| [`/student/labs/cell-division`](../../app/student/labs/cell-division/page.tsx) | isAiLabsEnabled, requireRole | component/render delegation |
| [`/student/labs/chemical-reaction`](../../app/student/labs/chemical-reaction/page.tsx) | isAiLabsEnabled, notFound, requireRole | component/render delegation |
| [`/student/labs/ecosystem-balance`](../../app/student/labs/ecosystem-balance/page.tsx) | isAiLabsEnabled, requireRole | component/render delegation |
| [`/student/labs/electric-circuit`](../../app/student/labs/electric-circuit/page.tsx) | isAiLabsEnabled, requireRole | component/render delegation |
| [`/student/labs/gravity-explorer`](../../app/student/labs/gravity-explorer/page.tsx) | isAiLabsEnabled, requireRole | component/render delegation |
| [`/student/labs/human-heart`](../../app/student/labs/human-heart/page.tsx) | isAiLabsEnabled, requireRole | component/render delegation |
| [`/student/labs/molecule-motion`](../../app/student/labs/molecule-motion/page.tsx) | isAiLabsEnabled, requireRole | component/render delegation |
| [`/student/labs`](../../app/student/labs/page.tsx) | isAiLabsEnabled, requireRole | DB: student |
| [`/student/labs/pendulum-lab`](../../app/student/labs/pendulum-lab/page.tsx) | isAiLabsEnabled, requireRole | component/render delegation |
| [`/student/labs/periodic-table`](../../app/student/labs/periodic-table/page.tsx) | isAiLabsEnabled, notFound, requireRole | component/render delegation |
| [`/student/labs/tectonic-plates`](../../app/student/labs/tectonic-plates/page.tsx) | isAiLabsEnabled, notFound, requireRole | component/render delegation |
| [`/student/labs/wave-motion`](../../app/student/labs/wave-motion/page.tsx) | isAiLabsEnabled, requireRole | component/render delegation |
| [`/student/labs/weather-system`](../../app/student/labs/weather-system/page.tsx) | isAiLabsEnabled, notFound, requireRole | component/render delegation |
| [`/student/leaderboard/[classId]`](../../app/student/leaderboard/[classId]/page.tsx) | delegated / no direct marker | fetch; click handler; disabled states |
| [`/student/leaderboard`](../../app/student/leaderboard/page.tsx) | delegated / no direct marker | DB: enrollment; redirect |
| [`/student/learn`](../../app/student/learn/page.tsx) | requireRole | component/render delegation |
| [`/student/lesson/[contentId]`](../../app/student/lesson/[contentId]/page.tsx) | delegated / no direct marker | component/render delegation |
| [`/student/lessons/[id]`](../../app/student/lessons/[id]/page.tsx) | delegated / no direct marker | component/render delegation |
| [`/student/lessons`](../../app/student/lessons/page.tsx) | requireRole | component/render delegation |
| [`/student/live/[meetingId]`](../../app/student/live/[meetingId]/page.tsx) | delegated / no direct marker | fetch |
| [`/student/messages`](../../app/student/messages/page.tsx) | delegated / no direct marker | fetch; click handler; disabled states |
| [`/student/offline-lessons`](../../app/student/offline-lessons/page.tsx) | delegated / no direct marker | click handler; disabled states |
| [`/student/offline-status`](../../app/student/offline-status/page.tsx) | delegated / no direct marker | component/render delegation |
| [`/student/onboarding`](../../app/student/onboarding/page.tsx) | delegated / no direct marker | component/render delegation |
| [`/student/packs`](../../app/student/packs/page.tsx) | delegated / no direct marker | fetch |
| [`/student/passport`](../../app/student/passport/page.tsx) | delegated / no direct marker | fetch |
| [`/student/placement`](../../app/student/placement/page.tsx) | delegated / no direct marker | component/render delegation |
| [`/student/portfolio`](../../app/student/portfolio/page.tsx) | delegated / no direct marker | fetch; click handler; disabled states |
| [`/student/progress`](../../app/student/progress/page.tsx) | requireRole | component/render delegation |
| [`/student/report-cards/[id]/print`](../../app/student/report-cards/[id]/print/page.tsx) | notFound | DB: reportCard, school, student, studentGuardian, user |
| [`/student/report-cards`](../../app/student/report-cards/page.tsx) | delegated / no direct marker | fetch |
| [`/student/schedule`](../../app/student/schedule/page.tsx) | requireRole | component/render delegation |
| [`/student/textbooks`](../../app/student/textbooks/page.tsx) | requireRole | DB: student |
| [`/student/today`](../../app/student/today/page.tsx) | requireRole | component/render delegation |
| [`/student/transcript`](../../app/student/transcript/page.tsx) | delegated / no direct marker | fetch |
| [`/student/units/[unitId]`](../../app/student/units/[unitId]/page.tsx) | requireRole | component/render delegation |
| [`/student/waec/[subject]`](../../app/student/waec/[subject]/page.tsx) | notFound | DB: gradedSubmission, student; redirect |
| [`/student/waec/[subject]/practice`](../../app/student/waec/[subject]/practice/page.tsx) | notFound | DB: student; redirect |
| [`/student/waec`](../../app/student/waec/page.tsx) | delegated / no direct marker | DB: student; redirect |
| [`/student/work/[scheduledWorkId]`](../../app/student/work/[scheduledWorkId]/page.tsx) | delegated / no direct marker | redirect |

### teacher page routes

| Route → source | Direct guard/flag markers | Direct data/control wiring markers |
| --- | --- | --- |
| [`/teacher/alerts`](../../app/teacher/alerts/page.tsx) | delegated / no direct marker | fetch; click handler; disabled states |
| [`/teacher/analytics/assessment/[contentId]`](../../app/teacher/analytics/assessment/[contentId]/page.tsx) | delegated / no direct marker | fetch |
| [`/teacher/approvals`](../../app/teacher/approvals/page.tsx) | requireUser | redirect |
| [`/teacher/assignments/[id]`](../../app/teacher/assignments/[id]/page.tsx) | delegated / no direct marker | fetch; click handler; disabled states |
| [`/teacher/assignments/create`](../../app/teacher/assignments/create/page.tsx) | delegated / no direct marker | fetch; disabled states |
| [`/teacher/assignments/grading`](../../app/teacher/assignments/grading/page.tsx) | delegated / no direct marker | fetch; click handler; disabled states |
| [`/teacher/assignments/new`](../../app/teacher/assignments/new/page.tsx) | requireRole | DB: class |
| [`/teacher/assignments`](../../app/teacher/assignments/page.tsx) | delegated / no direct marker | fetch; click handler; disabled states |
| [`/teacher/attendance`](../../app/teacher/attendance/page.tsx) | delegated / no direct marker | fetch; click handler; disabled states |
| [`/teacher/brief`](../../app/teacher/brief/page.tsx) | delegated / no direct marker | component/render delegation |
| [`/teacher/capstone`](../../app/teacher/capstone/page.tsx) | delegated / no direct marker | fetch; click handler; disabled states |
| [`/teacher/change-password`](../../app/teacher/change-password/page.tsx) | delegated / no direct marker | fetch; disabled states |
| [`/teacher/class/[id]/discussion`](../../app/teacher/class/[id]/discussion/page.tsx) | delegated / no direct marker | fetch; click handler; disabled states |
| [`/teacher/class/[id]/students`](../../app/teacher/class/[id]/students/page.tsx) | delegated / no direct marker | DB: class; redirect |
| [`/teacher/content-bundles/[bundleId]/preview`](../../app/teacher/content-bundles/[bundleId]/preview/page.tsx) | requireRole | redirect |
| [`/teacher/create-lesson`](../../app/teacher/create-lesson/page.tsx) | delegated / no direct marker | fetch; click handler; disabled states |
| [`/teacher/curriculum`](../../app/teacher/curriculum/page.tsx) | delegated / no direct marker | fetch; click handler; disabled states |
| [`/teacher/dashboard`](../../app/teacher/dashboard/page.tsx) | delegated / no direct marker | fetch; click handler; disabled states |
| [`/teacher/delivery-report`](../../app/teacher/delivery-report/page.tsx) | delegated / no direct marker | component/render delegation |
| [`/teacher/differentiation`](../../app/teacher/differentiation/page.tsx) | requireUser | DB: class; redirect |
| [`/teacher/discussion`](../../app/teacher/discussion/page.tsx) | requireRole | DB: class; redirect |
| [`/teacher/events`](../../app/teacher/events/page.tsx) | delegated / no direct marker | component/render delegation |
| [`/teacher/exams/[examId]`](../../app/teacher/exams/[examId]/page.tsx) | isExamSystemEnabled, requireRole | DB: exam; redirect |
| [`/teacher/exams`](../../app/teacher/exams/page.tsx) | isExamSystemEnabled | redirect |
| [`/teacher/gradebook`](../../app/teacher/gradebook/page.tsx) | delegated / no direct marker | fetch; click handler |
| [`/teacher/help`](../../app/teacher/help/page.tsx) | requireRole | component/render delegation |
| [`/teacher/homework/[id]`](../../app/teacher/homework/[id]/page.tsx) | delegated / no direct marker | DB: homework; redirect |
| [`/teacher/homework/new`](../../app/teacher/homework/new/page.tsx) | delegated / no direct marker | DB: class; redirect |
| [`/teacher/homework`](../../app/teacher/homework/page.tsx) | delegated / no direct marker | DB: class, homework; redirect |
| [`/teacher/intelligence/[studentId]`](../../app/teacher/intelligence/[studentId]/page.tsx) | isTeacherIntelligenceDashboardEnabled, notFound | redirect |
| [`/teacher/intelligence`](../../app/teacher/intelligence/page.tsx) | isTeacherIntelligenceDashboardEnabled, notFound | redirect |
| [`/teacher/labs`](../../app/teacher/labs/page.tsx) | requireRole | DB: class, labSession, scheduledWork, virtualLab |
| [`/teacher/labs/sessions/[sessionId]`](../../app/teacher/labs/sessions/[sessionId]/page.tsx) | isVirtualLabsEnabled, notFound, requireRole | DB: labSession, scheduledWork, virtualLab |
| [`/teacher/lesson/[contentId]`](../../app/teacher/lesson/[contentId]/page.tsx) | requireRole | DB: assessmentAttempt, student |
| [`/teacher/lesson/[contentId]/video`](../../app/teacher/lesson/[contentId]/video/page.tsx) | delegated / no direct marker | fetch; click handler; disabled states |
| [`/teacher/lessons/[lessonId]/edit`](../../app/teacher/lessons/[lessonId]/edit/page.tsx) | delegated / no direct marker | fetch; click handler; disabled states |
| [`/teacher/lessons/[lessonId]/share`](../../app/teacher/lessons/[lessonId]/share/page.tsx) | delegated / no direct marker | fetch; disabled states |
| [`/teacher/lessons/create`](../../app/teacher/lessons/create/page.tsx) | delegated / no direct marker | fetch; click handler; disabled states |
| [`/teacher/lessons`](../../app/teacher/lessons/page.tsx) | delegated / no direct marker | fetch; click handler |
| [`/teacher/messages`](../../app/teacher/messages/page.tsx) | delegated / no direct marker | fetch; click handler; disabled states |
| [`/teacher/onboarding`](../../app/teacher/onboarding/page.tsx) | delegated / no direct marker | fetch; click handler; disabled states |
| [`/teacher/packs`](../../app/teacher/packs/page.tsx) | delegated / no direct marker | fetch |
| [`/teacher`](../../app/teacher/page.tsx) | requireUser | redirect |
| [`/teacher/placements/[placementId]`](../../app/teacher/placements/[placementId]/page.tsx) | delegated / no direct marker | fetch; click handler; disabled states |
| [`/teacher/placements`](../../app/teacher/placements/page.tsx) | delegated / no direct marker | fetch |
| [`/teacher/profile`](../../app/teacher/profile/page.tsx) | delegated / no direct marker | redirect |
| [`/teacher/rag`](../../app/teacher/rag/page.tsx) | isRagTutorEnabled, notFound, requireUser | component/render delegation |
| [`/teacher/report-cards`](../../app/teacher/report-cards/page.tsx) | delegated / no direct marker | fetch; click handler; disabled states |
| [`/teacher/schedule`](../../app/teacher/schedule/page.tsx) | delegated / no direct marker | fetch; click handler; disabled states |
| [`/teacher/settings/alerts`](../../app/teacher/settings/alerts/page.tsx) | delegated / no direct marker | fetch; click handler; disabled states |
| [`/teacher/skills`](../../app/teacher/skills/page.tsx) | requireUser | redirect |
| [`/teacher/standards`](../../app/teacher/standards/page.tsx) | delegated / no direct marker | component/render delegation |
| [`/teacher/student/[id]`](../../app/teacher/student/[id]/page.tsx) | delegated / no direct marker | DB: student; redirect |
| [`/teacher/students/[studentId]`](../../app/teacher/students/[studentId]/page.tsx) | delegated / no direct marker | fetch; click handler; disabled states |
| [`/teacher/students`](../../app/teacher/students/page.tsx) | delegated / no direct marker | fetch; click handler |
| [`/teacher/timetable`](../../app/teacher/timetable/page.tsx) | delegated / no direct marker | fetch; click handler; disabled states |
| [`/teacher/training/[moduleId]`](../../app/teacher/training/[moduleId]/page.tsx) | isTrainingCenterEnabled, notFound, requireUser | redirect |
| [`/teacher/training/completion-record`](../../app/teacher/training/completion-record/page.tsx) | isTrainingCenterEnabled, requireUser | redirect |
| [`/teacher/training`](../../app/teacher/training/page.tsx) | isTrainingCenterEnabled, requireUser | DB: trainingProgress; redirect |
| [`/teacher/tutor-analytics`](../../app/teacher/tutor-analytics/page.tsx) | delegated / no direct marker | fetch |
| [`/teacher/video-analytics`](../../app/teacher/video-analytics/page.tsx) | delegated / no direct marker | fetch |
| [`/teacher/weekly-report`](../../app/teacher/weekly-report/page.tsx) | delegated / no direct marker | fetch |
| [`/teacher/welcome`](../../app/teacher/welcome/page.tsx) | delegated / no direct marker | redirect |

### API surface context

Tracked API handlers: **593**. Namespace counts are implementation inventory, not permission grants: adaptive 3, admin 234, announcements 1, attendance 2, auth 4, cache-warm 1, canva 2, certificates 2, certifications 1, cron 26, crons 1, curriculum 2, demo 1, dev 1, discussion 10, district-updates 2, enroll 1, events 1, grading 4, guardian 16, health 4, healthz 1, homework 8, labs 2, league 3, legal 1, messages 1, moe 28, notifications 10, onboard 2, packs 4, placement 2, platform 9, portfolio 1, rag 1, register 2, report-cards 3, reports 2, review 10, rollout 3, search 1, sms 1, student 77, submissions 2, teacher 90, teaching 4, track 1, user 3, webhooks 2.

Deep-read API boundaries: student experience/learn/progress, teacher dashboard, guardian dashboard and MOE dashboard. Client endpoint traces additionally cover Today, assignments, governed learning, schedule/grading, audio/tutor and legacy lesson detail. Specialist handlers outside those traces were not individually runtime-certified.
