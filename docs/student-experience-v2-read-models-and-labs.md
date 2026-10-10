# Student Experience V2: read models and lab eligibility

Preservation base HEAD: `ebb5a7faa3de43f5f4c81ec70f11a775d8d7cd2c` (current main specified by the owner). Only uncommitted server/lab work was transferred; no old Learn-data branch commits were included.
Changes are preserved on `feat/student-authority-lab-safeguards` and remain unmerged. No deployment, database mutation or lab approval is part of this handoff.

## Class API contract

`GET /api/student/classes` returns `{ classes: StudentClass[] }`.
`GET /api/student/classes/[classId]` returns `{ class: StudentClass }`.

`StudentClass` contains only `classId`, `className`, `subject`, nullable `grade`, nullable teacher display name, and school display name. It contains no roster, teacher identifiers/contact details, grading information or inferred current unit/assignment counts. Teacher names are omitted when the referenced teacher belongs to another school.

Both routes require STUDENT authentication. Anonymous callers receive 401 and other roles receive 403. Detail returns the same 404 for foreign-school, same-school unenrolled, stale and unknown classes. Storage failures return 503 with a generic message.

Authority is an exact `Enrollment` roster row, an undeleted student, matching current user school and matching class school. When academic enrollment records exist, an ACTIVE own-school academic enrollment in an active year spanning the current date is also required. Grade and subject never grant access. Existing roster-only schools remain supported: `Enrollment` has no status, expiry or academic-year field, so deleting its row is the only available class-specific revocation authority. A historical roster row cannot independently be identified as stale without academic records; no status is invented.

## Schedule API contract

`GET /api/student/schedule` requires STUDENT authentication and returns schema version `student-schedule/1`.

The response contains `availability`, `freshness`, `generatedAt`, the bounded `window`, `periods`, `scheduledWork` and `limits`.

- `availability`: `configured`, `no_schedule_configured`, or `unavailable`.
- `freshness`: `current` for a successful database read; `unavailable` for a 503. There is no cache or stored schedule freshness marker, so no unsupported stale classification is synthesized.
- `periods`: existing recurring Timetable records projected to `id`, `classId`, `dayOfWeek`, `periodLabel`, `startTime`, `endTime`, `room`.
- `scheduledWork`: existing confirmed or legacy null-status ScheduledWork records within seven days before/after generation, projected to `scheduledWorkId`, `classId`, `scheduledDate`, `startTime`, `endTime`, `periodNumber`, `action`.
- `action`: null unless existing content approval, lifecycle, learner visibility, curriculum version and school scope gates all pass; otherwise `{ kind: "lesson", href: "/student/work/<scheduledWorkId>" }`.
- `limits`: 200 records per source; one extra row detects `truncated`.

Recurring periods cover the learner's current enrolled classes. Suggested/dismissed work is excluded. No new scheduling store, progress write or assignment action is created. TimetableAssignment records do not receive direct lesson actions; no parallel timetable assignment delivery authority is inferred. `no_schedule_configured` means no recurring periods and no dated work in the reported window. Historical dated work outside the window is not a schedule configuration signal.

## Static lab inventory

The full `listLabExperiences()` inventory has 16 definitions. The larger `LAB_IDS` constant also contains names without registered definitions; it is not the discoverable inventory.

| Lab ID | Classification | Learner discovery |
| --- | --- | --- |
| gravity-explorer | LEGACY_UNCERTIFIED | Hidden |
| pendulum-lab | LEGACY_UNCERTIFIED | Hidden |
| molecule-motion | LEGACY_UNCERTIFIED | Hidden |
| human-heart | LEGACY_UNCERTIFIED | Hidden |
| electric-circuit | LEGACY_UNCERTIFIED | Hidden |
| wave-motion | LEGACY_UNCERTIFIED | Hidden |
| cell-division | LEGACY_UNCERTIFIED | Hidden |
| ecosystem-balance | LEGACY_UNCERTIFIED | Hidden |
| chemical-reaction | LEGACY_UNCERTIFIED | Hidden |
| periodic-table | LEGACY_UNCERTIFIED | Hidden |
| weather-system | LEGACY_UNCERTIFIED | Hidden |
| tectonic-plates | LEGACY_UNCERTIFIED | Hidden |
| g4-solid-figures | UNRELEASED: IN_REVIEW / PENDING, pending release identity | Hidden |
| fixture-lever | UNRELEASED: DRAFT / PENDING, fixture release | Hidden |
| fixture-simple-circuit | UNRELEASED: DRAFT / PENDING, fixture release | Hidden |
| mount-coffee-hydropower | UNRELEASED: DRAFT / PENDING, fixture release, DO_NOT_SHIP | Hidden |

Legacy labs have dedicated feature-flagged routes and simulation code, but no release/runtime certification evidence. Previously their catalog release flag advertised them independently of that flag and certification. The twelve dedicated routes now require the same certification as discovery, so enabling AI labs cannot bypass this boundary. These labs are classified UNCERTIFIED; this report does not assert that every legacy renderer is broken.

Certified released labs: **none** at the audited head. The explicit version certification registry is empty. Toggling a release status alone does not certify a lab. Library remains empty until a released version gains real route, renderer, asset/runtime evidence and certification. For You remains empty because no approved current-path links are supplied.

## Assigned practical labs

Database-defined VirtualLab records are ASSIGNED-ONLY when all conditions pass:

1. Virtual labs runtime flag is enabled.
2. Session belongs to the authenticated user and current school.
3. Session references existing confirmed/null-status scheduled work in an exactly enrolled current class in that school.
4. Definition is published and platform-wide or belongs to the same school.
5. Definition uses the implemented `guided_walkthrough` renderer with a nonempty student-safe procedure and instruction for every step.
6. Its ID does not collide with a static legacy or interactive route.

Discovery, detail, start/submission and session update use one shared eligibility helper. Continue and Completed use the same owner/tenant checks. Missing assignments, revoked enrollment, unpublished/foreign definitions, missing runtime, malformed procedures and namespace collisions are hidden. Only the newest 200 owned session records are considered; older history is intentionally bounded. No live database inventory or production learner session was accessed.

Practical payload projection strips teacher notes, expected answers and grading instructions. Session responses contain only `id`, `labId`, `startedAt`, `completedAt`. Stored AI analysis, scores, teacher feedback and governance flags remain server-side, including offline conflict responses. Offline lab writes use the same eligibility guard. Interactive event requests cannot use student-supplied PREVIEW to bypass certification.

Continue/Completed cards carry the exact owned session ID through detail and start/submission; multiple sessions for a lab do not silently resolve to the newest session when a card names another one. `startedAt` defaults to assignment creation in the existing schema, so Continue means authorized unfinished sessions, not proof of an explicit learner start.

## Governed binding disposition

The owner explicitly instructed that all currently uncertified interactive labs remain unreleased and that no replacement bindings or approval evidence be invented.

The [production workflow](architecture/INTERACTIVE_LAB_PRODUCTION_TEAM.md) says: "A missing or ungoverned objective blocks the pedagogy stage (`BLOCKED_ON_AUTHORITY`)." The [lab production command](../.claude/commands/lab-production.md) resumes from the first unrecorded gate. Hydropower's [production record](labs/mount-coffee-hydropower/production.json) explicitly has `governedObjective: false`; its [review log](labs/mount-coffee-hydropower/REVIEW_LOG.md) retains product DO_NOT_SHIP and unverified device evidence. Solids has a pending binding and no production record in this tree. Lever and circuit use fixture bindings. Therefore no approval state or release identity was fabricated.

Solids retains its legitimate governed objective `moe-math-g4-s2-p6-geometry-and-statistics-obj5`; its pending release identity and REVIEW_BLOCKED curriculum proof require governance/curriculum closure. Lever and circuit lack approved replacements for their fixture bindings. Hydropower lacks an approved Grade 8 Science release and exact governed objective/lesson binding, and retains DO_NOT_SHIP. No lab definition, objective reference, review state, approval state or release binding was changed.

Future release requires completed governance and runtime certification. That work is outside this mission. The student Library says: "No released labs are available for your classes yet." Student-visible static labs after filtering: none. Eligible database-defined practical labs are ASSIGNED_ONLY; no live database inventory is claimed.

## Validation and limits

Authorization tests cover anonymous/wrong role, exact enrollment, foreign school, same-school unenrolled, unknown, deleted/stale students, academic statuses/year dates and list/detail parity. Schedule tests cover real period projection, empty/unavailable states, tenant queries, bounds and content-authorized actions. Lab tests enumerate all 16 static definitions and twelve actual static routes, verify assigned/continue/completed host parity, runtime exclusions, ownership query boundaries, tenant isolation, PREVIEW denial and payload/session minimization. Existing runtime, challenge/profile parity, production-record, audit/offline and concurrency tests are also exercised.

Route/runtime tests use local mocked database fixtures and actual server route/React rendering. They do not constitute live database, browser/device, production or national rollout certification. The deliberate empty Library is not a claim that labs were released. No merge was performed.

Prior old-base validation (historical evidence; rerun results on the preservation base are recorded below): `npm run validate:changed` passed, including typecheck: 64 related test files passed, one skipped; 1,224 related tests passed, six skipped. The changed-file suite passed 12 files / 227 tests. The final compatibility-link/sync/runtime focused run passed four files / 63 tests. Final lint, route-policy audit and `git diff --check` passed. The final production build (`node node_modules/next/dist/bin/next build`, after Prisma generation) exited 0 and generated all 385 static pages; the three new APIs are dynamic routes. Build evidence is in `artifacts/student-v2-build-stable.log`. Existing environment/configuration warnings remain, including absent DATABASE_URL during caught static-page reads; this build is not live-database validation. Typecheck and build use an 8 GB heap. TypeScript excludes pre-existing `artifacts` copied worktrees and `.npm-cache` generated files; their contents are preserved.

## Changed files

- New APIs: `app/api/student/classes/route.ts`, `app/api/student/classes/[classId]/route.ts`, `app/api/student/schedule/route.ts`.
- New server helpers: `lib/student/enrollmentReadModel.ts`, `scheduleReadModel.ts`, `labEligibility.ts`, `labRouteCertification.ts`.
- Lab mutation routes: `app/api/student/labs/[labId]/session/route.ts`, `app/api/student/labs/sessions/[sessionId]/route.ts`, `app/api/student/interactive-labs/[labId]/events/route.ts`, `app/api/student/sync/route.ts` (lab eligibility and minimized lab conflict state).
- Lab server hosts: `app/student/labs/page.tsx`, `[labId]/page.tsx`, and the twelve static lab `page.tsx` routes listed in the inventory above.
- Exact session navigation/start: `components/learner-experience/LabExperienceCard.tsx`, `app/student/labs/LabSessionClient.tsx`.
- Eligibility contracts: `lib/learner-experience/labExperience.ts`, `labsTab.ts`, `links.ts`, `lib/lessons/labLinks.ts` (legacy grade/subject recommendations fail closed).
- New tests: `__tests__/student-read-models.test.ts`, `__tests__/student-lab-eligibility.test.tsx`.
- Updated tests: `__tests__/audit-gate-2-patches.test.ts`, `e2e/workflow-validation.test.ts`, `learner-experience/lab-routes.test.tsx`, `learner-experience/labs-tab.test.ts`, `learning-authority/lab-score-containment.test.ts`, `load/concurrencyGuards.test.ts`, `load/nationalScaleSmoke.test.ts`, `offline/queue-wiring.test.ts`, `virtual-labs.test.ts`, `student-sync.conflict.test.ts`.
- Tooling/report: `tsconfig.json`, this report.
## Preservation validation on current main

Base: `ebb5a7faa3de43f5f4c81ec70f11a775d8d7cd2c`; branch: `feat/student-authority-lab-safeguards`. An isolated worktree preserves the original working tree and excludes unrelated artifacts/cache and old Learn-data commits. The 45 changed files are the intended APIs, eligibility helpers, lab routes/discovery/session links, related tests, TypeScript exclusions and this report.

Focused class/schedule/lab and regression validation: 12 files / 227 tests passed. `validate:changed --no-types` passed: 64 files passed, one skipped; 1,224 tests passed and six skipped. Typecheck was run separately and exited 0. Lint, route-policy audit and diff whitespace checks passed; existing lint/configuration warnings remain.

`npm run build` completed with exit 0 and generated 385 static pages. Windows sandbox standalone tracing logged symlink EPERM warnings; an additional unsandboxed packaging check was started. Local evidence is under `C:/liberia-learn/.task-evidence/`. No live database, deployment or release certification is claimed. Lab definitions, governed bindings, release approvals and Mount Coffee DO_NOT_SHIP were unchanged.

This branch does not incorporate PR #179. Its three API route paths overlap PR #179 but use different response contracts; integrating the branches requires deliberate contract reconciliation. The separate exact-head PR #179 review found foreign-teacher projection, refresh/denial retention, ambiguous period matching and failed CI. This preservation commit does not fix or approve Claude's UI branch.
