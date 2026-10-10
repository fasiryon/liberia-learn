# Product Design V2 PR 2A — Learn UI and shell polish evidence

Status: presentation branch `feat/product-design-v2-learn-ui` from `main` @ `c24e79e1`. Not merged. Server/read-model work is owned by the parallel `feat/product-design-v2-learn-data` branch.

## Learn composition

`/student/learn` remains the governed DIAGNOSTIC/PRACTICE activity and renders it first, inline and answerable (no chooser, no second Start). Discovery follows as secondary sections:

1. **Current learning** — the existing next-action GET/POST, unchanged in authority. Submission sends exactly `decisionId, sessionId, itemId, itemVersion, answerIndex, toolsUsed`. States: loading, ready, none (`available:false`), `NO_VALID_RESOURCE`, signed-out (401), restricted (403), error, offline read-only review.
2. **Your learning path** — active units (`/api/student/units/active`), subject lesson completion and the first catalog lessons (`/api/student/lessons`), with "Browse all lessons".
3. **Assigned work** — unsubmitted rows from `/api/student/assignments` in server order; links to all assignments and Exams and checks.
4. **Books and resources** — existing authorized destinations (Textbooks, Practice, WAEC by the shell's existing grade rule, Projects, Offline lessons). Each route enforces its own access.

Presentation tightening on the governed activity: the offline review cache is partitioned by school + learner (the old unpartitioned key is deleted on load) and is used only after network/5xx failures, never after 401/403/404.

`/student/lessons` is the paged, subject-grouped catalog; `/student/units/[unitId]` is the ordered lesson list with server locks shown as text ("Locked · finish earlier lessons first"), not links. `UnitSequenceSidebar` gained accessible step names, 44px targets and an explicit unavailable message.

Competitive disposition: REIMAGINE learner navigation around the path; ADOPT + IMPROVE assignment/resource/module-style discovery; DIFFERENTIATE only through the existing governed next action. Cards and browsing are not claimed as differentiated.

## Shell polish

- Wide screens: page containers inside the shell start 24–40px after the rail and are bounded at 1440px, left-aligned, instead of centring a 1280px island in the remaining viewport.
- Sign out: visible quiet control at the bottom of the desktop rail and inside an "Account" menu in the phone top bar. Both use the existing safe-logout page `/signout` (`useSafeLogout`: sync/unsynced-work warning before NextAuth sign-out). The previous link went straight to `/api/auth/signout`, bypassing that check. Account and preferences keeps Change PIN, Placement, Getting started and Sign out.
- On `/student/learn` the shell suppresses its duplicate "Learning resources" links (the page provides them) and optional prompts, as it already did on Today.

| Width | Gap rail→content before | after | Right space after |
| --- | --- | --- | --- |
| 1280 | 32 | 32 | 32 |
| 1440 | 32 | 36 | 36 |
| 1600 | 73 | 40 | 40 |
| 1920 | 233 | 40 | 282 |

"Before" is measured by re-applying the old container CSS in the same fixture (`artifacts/product-design-v2/learn/learn-results.json`).

## Evidence

- `__tests__/learner-experience/learn-v2.test.tsx` (27 tests): contract validators, governed-first order, exact submit identity, discovery links, no-plan/no-valid-resource, confirmed empty, failure/unconfirmed never empty, restricted, stale, offline partitioned cache, cross-learner cache isolation, 403 not replaced by cache, age bands, grade-less resources, nav active state, sign-out links, catalog paging, unit locks and 404/403/500.
- `e2e/product-design-v2/validate-learn.mjs` (runs after the Today harness in `run.mjs`): shell at 1280/1440/1600/1920 for Today and Learn, phone account menu at 390/360/320, Learn at 320/360/390/768/1440 for grades 2 and 6 with target sizes, Today → Learn answer in place, keyboard skip/focus order and visible focus, reduced motion, forced colors, 640/320px reflow (200%/400% zoom of 1280), loading/none/no-resource/empty/error/restricted/long/stale/offline states, unit lock/unavailable, lessons page, axe WCAG 2.2 A/AA on four surfaces (0 violations).
- Screenshots: `artifacts/product-design-v2/learn/`.

Caveat: production components in a fixture harness with mocked APIs. No server authorization, real-device, screen-reader or user-study certification.

## Display contract requested from the read-model owner

The UI currently consumes existing endpoints. These gaps are presented honestly, not patched client-side:

1. `GET /api/student/lessons` answers its 1.3s timeout shield with an empty 200 that has no `studentId`. The UI shows "could not be confirmed" for that shape. Requested: an explicit `availability: "current" | "stale" | "unavailable"` field.
2. Lesson `total` counts rows before the ≥300-character quality filter, so the UI does not show a lesson count. Requested: a displayable count, if one is wanted.
3. `subjectCompletion` is only present for enrolled learners with scheduled work; there is no authorized "subjects for this learner" list. Requested if subjects should show without scheduled work.
4. Checks/exams: `/api/student/exams` returns full question payloads and a readiness recommendation, so Learn links to it rather than fetching it. Requested: a light, already-authorized checks summary (`id, title, subject, status, dueAt?`).
5. Resources: no JSON seam for textbooks/resources; Learn lists destinations only. Requested if items should appear inline: `resources: Array<{ id, title, kind, href, availability }>` with each `href` a same-origin student route.
6. `/api/student/units/active` does not distinguish "no enrollment" from "no units this week"; both are `[]` and shown as "No units are scheduled for your class this week."
7. Locked/restricted: the UI shows `locked:true` and 403 as-is and never unlocks or infers access. Any new discovery payload should carry an explicit `locked`/`restricted` flag plus a learner-safe reason.

No search was added: no existing authorized scoped search seam is available.

## Limitations

- Legacy pages that render their own `mx-auto max-w-*` containers inside the shell (for example Labs) are still centered. The shell rule covers the V2 containers only.
- The governed task's look at 1920px leaves empty space to the right of the 70ch task column. This is intentional for reading width.
- Grade 1–3 language is simplified only where copy was changed here. Curriculum text is unchanged.
