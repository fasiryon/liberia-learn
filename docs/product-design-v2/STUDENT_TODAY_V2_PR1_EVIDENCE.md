# Student shell and Today V2 — PR 1 evidence

Exact base: `d10f93130f4acf09f1f739ab0d1cf1d258e41916`, main immediately after #175 merged. Isolated branch: `feat/product-design-v2-student-today`.

## Implementation

The former dashboard led with features and summary cards. Today now leads with the authorized next action, followed by critical due work, assigned work, concise completion and help/offline status. Primary navigation is Today / Learn / Labs / Progress / Help, with a desktop rail and mobile bottom navigation.

The next-action source remains `/api/student/learning-authority/next-action`. Ready decisions enter the existing governed Learn component directly. Existing server Today focus is used only when the governed seam explicitly reports unavailable. The UI does not calculate educational recommendations, mastery or placement. Stale/error/unavailable responses never become a cheerful empty state. Today API changes expose freshness/degradation, not new educational authority.

Assignments remain one direct action away. Contextual destinations preserve discussions, exams, certificates, messages, portfolio, textbooks, events, downloads and account utilities; existing routes are retained. Tutor links enter the existing grounded tutor. Curriculum generator, projection, provenance, release/review authority and native LessonExperience are untouched.

Grades 1–3 receive 56px intended controls, stronger depth, shorter action copy and three initially visible plan items. Grades 4–7 receive 48px controls and five initial items. Charcoal, Liberia gold, paper and restrained green follow the approved Figma Student Today anchor. Unsupported Figma example mastery/estimates are omitted.

Offline copy uses the existing authenticated cache partition and outbox. Saved labels require verified local lesson resources; pending and sending work await server confirmation. AI and governed practice require connectivity. Unknown verification, stale server state and failures are shown explicitly.

## Browser evidence and limits

`node e2e/product-design-v2/run.mjs` runs actual Chromium against production shell/Today components with explicitly intercepted synthetic APIs. Both age bands are checked at 320, 360, 390, 768 and 1440 CSS px. The harness exercises the actual existing governed Learn component for one-action resume and return. Other destination placeholders establish link routing only. Screenshots and `browser-results.json` are under `artifacts/product-design-v2/`.

The intercepted fixture harness does not certify authenticated destination flows. The separate real-session certification below uses the existing CHA synthetic student against a canonically initialized, disposable local PostgreSQL database. Real devices, assistive technology and user studies remain unmeasured; neither harness establishes competitor superiority.

## Authenticated local certification (2026-10-09)

The earlier infrastructure TRUE STOP is superseded. Docker Desktop 4.94.0 supplies a working Linux Docker Engine 29.8.2. The approved image is `pgvector/pgvector:0.8.0-pg17`, digest `sha256:40b404964359299eefdd5f8518facf1886c562848cf4de13b6eaf91cb70c2b87`.

Bootstrap command: `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/verify-full-canonical-bootstrap.ps1`. All 21 canonical migrations applied. Windows PowerShell 5.1 then treated the deliberately failing second concurrent claimant's stderr as terminating. A temporary local copy set `ErrorActionPreference = Continue` only around that expected negative invocation, captured its exit code, and immediately restored `Stop`. No migration bytes or tracked bootstrap code changed. That complete verification passed: 237/237 tables with RLS, zero P2-C anonymous/authenticated grants, overlapping claimant/stale-writer invariants, seed idempotency and pinned PostgreSQL manifest/schema authority comparison. Its disposable container was removed. Evidence: `artifacts/full-canonical/verification/verification-evidence.json`.

Retained local setup: container `liberialearn-pr177-test`, database `liberialearn_pr177_test`, loopback bind `127.0.0.1:55439`. A temporary local script reused the verifier's transactional prefix, exact concurrent-index execution, Prisma resolve, and remaining `prisma/canonical` migrations. PostgreSQL 17 and vector 0.8.0 are available. No schema push, legacy root, remote/shared DB or production/staging mutation was used. Credentials are disposable and excluded from this evidence and commits.

The existing `.env.local` was found in the tutor worktree. Required auth/seed configuration was checked for presence only, then loaded through Next's supported `@next/env` mechanism. DATABASE_URL and DIRECT_URL were overridden only in the test processes. NEXTAUTH_URL was local; remote Redis was disabled. The source env file was neither copied nor edited. Repository preparation order was `npm run seed:cha`, then `npm run e2e:prepare-day1`; both passed. The latter generated ignored `.env.e2e.local` without printing values. The existing `student1@cha.edu.lr` account was verified as STUDENT in CHA, enrolled in `cha-class-grade9a`, with confirmed scheduled work and the APPROVED `cha-g9-math-multimedia-demo` lesson. No new seed users were invented.

The normal Next app ran against this database on `127.0.0.1:3100`. Real Chromium signed in through the credentials UI and completed the existing policy/privacy acceptance prompts. No session, API response, or destination was mocked. Flow A passed: Today primary action opened the real Ratios lesson body directly, without an extra Start screen, returned through Back to today, and exposed Continue after server-backed progress. Flow B passed through the scheduled/assigned lesson row to the same real destination. CHA has no open due assignment; no due-assignment pass is claimed. Flow C passed Today / Learn / Labs / Progress / Help, retaining the authenticated session. A-C ran at both 1440x900 and 390x844.

Flow D used local synthetic school/class/work fixtures with the existing CHA users and lesson: foreign-school work 403; same-school unenrolled-class work 403; missing target 404; temporarily unapproved lesson 404; student access to admin students 403; anonymous Today API 401. Real browser denial pages displayed Forbidden or Lesson not found or not yet approved. The lesson status was restored to APPROVED. No authorized lesson body appeared in denied destinations. Only the retained disposable DB received fixture changes; PR #176 and Curriculum V2 code were not changed.

Authenticated screenshots and a credential-free result summary are in `artifacts/product-design-v2/authenticated/`. Today checks at 1440, 390, 320, 360 and 768 CSS pixels found no horizontal overflow and an uncovered primary CTA. Native Tab/Shift+Tab verified primary-control focus and its visible outline. The 200% text check doubled every computed text size, including text sized in pixels, then verified no horizontal overflow and an uncovered primary CTA; its screenshot was visually inspected. Grade 9 used the middle presentation with 48px controls. A temporary grade-2 synthetic fixture verified the young presentation and 56px primary control, then restored the original grade. Reduced motion and forced colors were emulated. The 320px viewport establishes the reflow-width equivalent of 1280px at 400%; actual browser zoom, real devices and assistive technology remain unmeasured.

Validation: 16 focused Today/learner/auth/PWA unit files, 172 tests passed; four additional auth/tenant files, 25 tests passed; typecheck passed; lint passed with existing warnings; production build exited 0; all 14 production PWA Chromium tests passed (desktop and mobile). Windows standalone tracing reports a symlink EPERM even outside the sandbox; the normal local `npm run start` server booted and served the production PWA tests. Production credentials auth intentionally requires distributed Redis, so authenticated certification uses the normal development app with the repository's local in-memory limiter. No shared Redis was enabled and no production auth guard was weakened. New exact-head hosted CI must be checked after the evidence commit; its result is reported in the final handoff. Old run `37955275640` does not certify a new head. PR #177 remains draft; no merge is authorized.

## Scorecard

| Gate | Result |
| --- | --- |
| G01 Time to next action | NOT MEASURED — requires user study; next action precedes all summaries |
| G02 Clicks to resume | PASS in authenticated Chromium: one primary action opens the existing lesson body, with return to Today and server-backed Continue |
| G03 Understand Today | NOT MEASURED — requires user study |
| G04 Assignment depth | Direct assignment CTA from Today; contextual Assignments link from Learn |
| G08 Mobile quality | Authenticated desktop/phone flows and 320/360/390/768/1440 layouts passed; real-device/cohort validation NOT MEASURED |
| G11 Offline resilience | Existing cache/outbox reused; explicit unknown/error/pending/connectivity; authenticated offline flow not measured |
| G12 Accessibility | Authenticated visible keyboard focus, actual 200% text enlargement, forced colors/reduced motion, young/middle controls and reflow-width checks passed; manual assistive technology and actual browser zoom NOT MEASURED |
| G13 Cognitive load | One dominant action, progressive plan disclosure; user-study outcome NOT MEASURED |
| G14 Visual hierarchy | Approved Figma comparison and browser evidence; user-study outcome NOT MEASURED |
| G15 Age appropriateness | Authenticated middle and temporary young synthetic fixture presentations checked; child usability study NOT MEASURED |

## Competitive disposition

ADOPT: familiar To Do/agenda, Resume and conventional due dates. IMPROVE: direct due/assigned links, subject context, phone hierarchy and honest connectivity. REIMAGINE: action-oriented home replaces feature/KPI emphasis. DIFFERENTIATE: authorized governed action is surfaced without UI-generated learning decisions. No marketing superiority claim is made.

## Independent review

Read-only review covered student hierarchy, responsive structure, accessibility, authority/auth, offline truthfulness, legacy preservation, competitive disposition and Curriculum V2 overlap. Four initial P1s (notifications, announcements, teacher content and malformed partial-data crashes) and follow-up nested-text validation findings were fixed. Final review found no remaining P0/P1 in the diff.

P2: pinned school updates remain collapsed; resource verification can lag its bounded polling interval; real-device, assistive-technology and user-study results remain unmeasured. Authenticated flows A-D now have separate real-session evidence; due assignments and authenticated offline submission/replay remain unmeasured in the CHA fixture.

## Validation record

Focused Today/UI and route tests: 41 passed. Full suite before final small follow-ups: 720 files passed, one skipped; 6002 tests passed, two skipped. Related suite: 226 passed before the three added authorization/degradation cases. Final typecheck, lint, production build and changed validation passed; lint reports existing warnings. Exact-head hosted CI results must be assessed against the PR head; prior runs alone do not certify completion.

12ui: the user approved a $0.55 ceiling. Automatic approval review blocked repository access. The safer command omits `--repo` and supplies no source files; one target conversion was dispatched (`57303640-1773-4a9c-bea7-3bf59a83b92c`). Its unattended browser capture shows the API-unavailable fixture state, so any selector coverage result cannot certify the ready-action state. The local kit is excluded from version control; no repeat conversion is authorized.
