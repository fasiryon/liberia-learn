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

**This does not certify authenticated end-to-end destination flows.** No configured local database or student login is available. Actual authenticated Today → assignment/Labs/Progress/Help, server-backed stale/deleted targets, real devices and assistive technology require separate validation. Do not treat fixture evidence as that validation or as competitor superiority evidence.

## Scorecard

| Gate | Result |
| --- | --- |
| G01 Time to next action | NOT MEASURED — requires user study; next action precedes all summaries |
| G02 Clicks to resume | One primary action in production-component fixture; authenticated flow not measured |
| G03 Understand Today | NOT MEASURED — requires user study |
| G04 Assignment depth | Direct assignment CTA from Today; contextual Assignments link from Learn |
| G08 Mobile quality | Ten fixture layouts checked; real-device/cohort validation NOT MEASURED |
| G11 Offline resilience | Existing cache/outbox reused; explicit unknown/error/pending/connectivity; authenticated offline flow not measured |
| G12 Accessibility | Native controls, landmarks, focus, forced colors/reduced motion; fixture axe check; manual assistive-technology checks not measured |
| G13 Cognitive load | One dominant action, progressive plan disclosure; user-study outcome NOT MEASURED |
| G14 Visual hierarchy | Approved Figma comparison and browser evidence; user-study outcome NOT MEASURED |
| G15 Age appropriateness | Two production age variants tested; child usability study NOT MEASURED |

## Competitive disposition

ADOPT: familiar To Do/agenda, Resume and conventional due dates. IMPROVE: direct due/assigned links, subject context, phone hierarchy and honest connectivity. REIMAGINE: action-oriented home replaces feature/KPI emphasis. DIFFERENTIATE: authorized governed action is surfaced without UI-generated learning decisions. No marketing superiority claim is made.

## Independent review

Read-only review covered student hierarchy, responsive structure, accessibility, authority/auth, offline truthfulness, legacy preservation, competitive disposition and Curriculum V2 overlap. Four initial P1s (notifications, announcements, teacher content and malformed partial-data crashes) and follow-up nested-text validation findings were fixed. Final review found no remaining P0/P1 in the diff.

P2: pinned school updates remain collapsed; resource verification can lag its bounded polling interval; real-device, assistive-technology and user-study results remain unmeasured. Authenticated browser validation is a completion blocker, not a claimed pass.

## Validation record

Focused Today/UI and route tests: 41 passed. Full suite before final small follow-ups: 720 files passed, one skipped; 6002 tests passed, two skipped. Related suite: 226 passed before the three added authorization/degradation cases. Final typecheck, lint, production build and changed validation passed; lint reports existing warnings. Exact-head hosted CI results must be assessed against the PR head; prior runs alone do not certify completion.

12ui: the user approved a $0.55 ceiling. Automatic approval review blocked repository access. The safer command omits `--repo` and supplies no source files; one target conversion was dispatched (`57303640-1773-4a9c-bea7-3bf59a83b92c`). Its unattended browser capture shows the API-unavailable fixture state, so any selector coverage result cannot certify the ready-action state. The local kit is excluded from version control; no repeat conversion is authorized.
