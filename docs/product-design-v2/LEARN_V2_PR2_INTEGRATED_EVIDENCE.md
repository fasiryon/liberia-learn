# Product Design V2 PR 2 — Learn navigation and learning discovery: integrated evidence

Status: draft convergence branch `feat/product-design-v2-learn-discovery`, created from `main` @ `c24e79e159c34310304a1ae8a1529e4d21ee20ef`. Not merged.

| Input | Exact head | How it entered |
| --- | --- | --- |
| Claude UI `feat/product-design-v2-learn-ui` | `73b31ea0d1cf61ca90bc424c5c7e2e20cc64bf14` | `git merge --no-ff` (no conflicts) |
| Codex data `feat/product-design-v2-learn-data` | `f6c860bfbbd0d9bbf4378d4624489c5deefc8860` | `git merge --no-ff` (no conflicts) |

Neither source branch was rebased, reset or force-pushed. The integration commit only adapts the Claude-owned presentation layer, its tests and the fixture harness to Codex's contract (`LEARN_DISCOVERY_PR2B_CONTRACT.md`). Server authority is unchanged. Earlier per-branch records: `LEARN_V2_PR2_EVIDENCE.md` (UI) and `LEARN_DISCOVERY_PR2B_CONTRACT.md` (data).

## Final API contract consumed

- `GET /api/student/learning-authority/next-action` (GET/POST): canonical governed activity, unchanged. Learn does not route it through discovery and adds no second Start/Continue.
- `GET /api/student/learn` → `learn-discovery/2`: subjects, subject completion, lessons (`availability`, final eligible `total`, items), active units (`availability` + `eligibility: eligible | not_enrolled | unavailable`), assigned work, bounded checks summary (with server `reason`), readings and destinations (`compiledBooks: "deferred"`), `search: deferred`. Each row carries server `state`, `locked`, `href` and an optional learner-safe `reason`. `private, no-store`; 401/403 for anonymous/wrong role; 503 + all-unavailable on failure/deadline.
- `GET /api/student/lessons?page=N`: paged catalog with `availability: current | unavailable`, final eligible `total` and per-row `href`.
- `GET /api/student/units/active`: `{ availability, eligibility, generatedAt, items }` envelope (consumed by `ThisWeeksUnits`).

The UI validates the schema, uses server values directly and infers no availability, authorization, lock, subject access, enrollment, eligibility, check or resource state. One presentation safeguard remains: a server `href` is linked only if it is a same-origin learner route (`/student/{lesson,lessons,units,exams}/<id>`, `/student/assignments`, `/student/textbooks`). Anything else renders "Unavailable" and is never linked.

## Gap closure in the UI

| # | Gap | UI result |
| --- | --- | --- |
| 1 | Lesson availability | `current` + 0 items → "No lessons are published…"; `unavailable` (200 or 503) → "Unavailable … does not mean you have none". The old `studentId` heuristic is removed. |
| 2 | Authorized count | Learn and the lessons page show the server `total` ("N lessons available to you"). Real session: Learn total 1 = lessons API total 1. |
| 3 | Subjects | Rendered from server `subjects` (enrolled classes, independent of schedules); completion counts come from `subjectCompletion` only when that subject's total > 0. |
| 4 | Checks | Rendered from the bounded `checks` summary. Learn never calls `/api/student/exams` for discovery. Completed checks show the server reason with no link. Disabled checks show "Unavailable" + "Checks are not available" (real session). |
| 5 | Resources | Readings come only from server `resources.items`; destinations only from server `resources.destinations` (Textbooks). The static resource descriptions are removed. Practice/WAEC/Projects/Offline lessons stay as a plain "More in Learn" link row that makes no availability claim; each route enforces its own access, and WAEC keeps the shell's existing grade rule. Compiled books remain deferred. |
| 6 | Units | `eligible` + empty → "No units are scheduled…"; `not_enrolled` → "You are not enrolled in a class yet…"; `unavailable` → unavailable. Same rules in `ThisWeeksUnits` through the new envelope. |
| 7 | Restricted/locked | Rows with `state: unavailable` or `locked: true` show the server's `reason` and a "Locked"/"Unavailable" label, never a link. Whole-response 401/403 → "Signed out"/"Restricted", with no rows. The unit page keeps the existing prerequisite lock display. |
| 8 | Search | Deferred. No search input or role exists on Learn (asserted in unit and browser tests). |

Stale handling: a failed refresh keeps the last model marked "Last loaded"; a later 401/403 drops the rows instead of replaying them. The governed offline cache stays per learner and is never shown after 401/403/404.

## Auth and tenant results

Server-side matrix (Codex `__tests__/student/learn.discovery.route.test.ts`, run in this branch): anonymous 401 and wrong role 403 before any DB access; foreign-school, unenrolled class-only, teacher-only, teacher audience, pending, rejected, revoked, pending lifecycle, inactive version and unreleased Curriculum V2 content are excluded from every section and denied on detail; foreign learner/class/school assignments excluded; assignment audience failures fail closed (503); missing/deleted/changed-school student context unavailable; no stale authorization replay; authorized legacy content listed and opening with 200. These tests assert that every listed lesson, reading and unit lesson opens through the real detail route (LIST ⊆ DETAIL), with no writes.

Real session (disposable local PostgreSQL `liberialearn-pr177-test`, seeded CHA synthetic fixture, convergence `next dev`, real Chromium sign-in, nothing mocked) — `artifacts/product-design-v2/learn/authenticated/results.json`:

| Probe | Result |
| --- | --- |
| Anonymous `/api/student/learn`, `/lessons`, `/units/active` | 401, 401, 401 |
| Anonymous `/student/learn` page | Redirected to `/login` |
| Teacher (wrong role) `/api/student/learn`, `/lessons` | 403, 403 |
| Student `/api/student/learn` | 200, `private, no-store`, `learn-discovery/2`, search deferred, no `payload`/`provenance`/`teacherCreated`/`answerKey`/`correctIndex`/`questions` keys |
| Every openable lesson/reading in the model | Page 200 and `/api/curriculum/{id}` 200 |
| Foreign-school / unenrolled-class scheduled work (PR 1 disposable fixtures) | Not listed; `/api/student/work/{id}` 403 / 403 |
| Unknown unit | 404 |
| Lessons list/detail parity | Learn `total` 1 = `/api/student/lessons` `total` 1, `availability: current` |

The CHA fixture has no governed release for grade 9 (governed state "none"), no active units, no assignments and the exam system disabled. Those real states rendered as "No activity is ready right now", "No units are scheduled…", "No assignments right now." and "Checks are not available". Populated governed/assignment/check/lock states are covered by fixtures only.

## Responsive and accessibility evidence

- Real session: `/student/learn` at 1920, 1440, 768, 390, 360 and 320 had no horizontal overflow and kept the governed section before discovery. Desktop rail Sign out (≥768) and phone Account menu (<768) were visible. Screenshots: `artifacts/product-design-v2/learn/authenticated/`.
- Fixture harness (`node e2e/product-design-v2/run.mjs`, production components, `learn-discovery/2`-shaped mocks):
  - Today regression.
  - Shell at 1280–1920 with a 24–40px rail gutter (1920: 233px before → 40px after).
  - Phone Account menu with ≥44px summary and 48px nav items.
  - Learn at 320–1440 for grades 2 and 6 (56px/48px option and submit targets).
  - Integrated rows: checks summary, server locks/reasons, server total, a single Textbooks destination, no search.
  - Keyboard skip/focus order with visible focus, reduced motion, forced colors, 640/320 reflow.
  - States: loading, none, no-resource, empty, not-enrolled, lessons-unavailable, error (503), signed-out (401), cross-tenant (403), long titles, stale + offline, offline governed read-only, lessons-empty, unit locked/unavailable.
  - axe WCAG 2.2 A/AA on four surfaces: 0 violations.
- Shell regressions held: left-aligned wide composition, visible desktop Sign out to `/signout`, phone Account menu, five-item nav, offline note visible on phones, no duplicate Learn resource links or optional prompts on Learn.

## Validation

- Full `npx vitest run`: 732 files passed, 2 skipped; 6,706 tests passed, 8 skipped. This includes the Learn UI (37), Codex discovery, units, eligibility parity/secrecy, learning-authority, assignments, offline discovery, Today/shell and route-policy suites.
- `npx tsc --noEmit`: pass. ESLint on changed paths: pass. `npm run audit:api-routes`: PASS (73 changed routes declared). `npm run build`: exit 0. `git diff --check`: clean.

## Competitive disposition

REIMAGINE learner navigation around the path; ADOPT + IMPROVE assignment, check, resource and module-style discovery; DIFFERENTIATE only through the existing governed next action, which stays a separate canonical request. Cards and browsing are not claimed as differentiated.

## Known limitations

- Assigned-work rows from discovery carry no submission/overdue state and link to the assignment list rather than detail. Submitted work is therefore not filtered and overdue is not flagged on Learn (Today still does both through `/api/student/assignments`). Requested from the read-model owner: `submittedAt`/`isOverdue` and a detail `href`.
- Discovery units carry no completion counts, so Learn shows unit names without progress bars; `/api/student/units/active` keeps counts for `ThisWeeksUnits`.
- Unit totals reflect the ±7-day scheduled window plus the bounded catalog, not a full syllabus.
- The real session used one synthetic school with sparse data. Populated governed, assignment, check, lock and multi-unit states were verified by fixtures, not live data.
- No real phones, screen readers or user studies. 200% text was checked as reflow width, not true text-only zoom.
- Older pages that centre their own content inside the shell (for example Labs) are unchanged.
