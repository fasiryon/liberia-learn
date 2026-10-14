# Student Experience V3 — P0 implementation record

Branch `feat/student-experience-v3-p0`, based on main `1e196d9401426c7a252e3605d4d2a972e57cecd2`. Design source: the V3 blueprint at commit `dd825e30aa2d1f4ebf9851d1a3521d54450db3d1` (PR #187: `UNIFIED_EXPERIENCE_DISCOVERY_V3.md`, `ROLE_EXPERIENCE_MATRIX_V3.md`, `VISUAL_DESIGN_SYSTEM_V3.md`, `IMPLEMENTATION_ROADMAP_V3.md`). This change implements roadmap waves S0 (shared primitives), S1 (Lesson Player, Slides, Read) and the Progress/Today part of S2. It is presentation only.

## Authority boundary (unchanged)

- Lesson Experience V2 selection is untouched: both lesson routes still call the delivery seam first; NATIVE renders `LessonPlayerV2`, an explicit denial renders `LessonUnavailable` with no legacy fallback, and only an indistinguishable 404 or offline cache reaches the legacy renderer.
- No new API route, Prisma change, migration, release, flag or evidence/mastery writer. Native Finish is still `PRESENTATION_ONLY_EVIDENCE`.
- Legacy completion is now truthful: a library lesson's "Mark as finished" says it is kept on this device (it never had a writer); a teacher-created lesson awaits the existing `POST /api/student/teacher-lessons/:id/complete` and says "Recorded" only on a 2xx. The assigned route keeps its existing exit-ticket completion and offline queue unchanged.
- Legacy text is re-presented, never generated: `lib/learner-experience/lessonText.ts` parses headings, paragraphs, lists, tables and images in authored order. Section roles (Worked example, Your turn, Review) come only from authored headings. Images load only from same-origin or https paths; links only from same-origin or http(s); everything renders as React nodes (no HTML injection). HTML bodies keep the existing DOMPurify sanitizer.
- The Grade 7 demo is synthetic, labelled DEMO on every scene, not delivered by the seam, makes zero API requests and zero storage writes (asserted in the browser), and is reachable only in non-production builds or with `STUDENT_DESIGN_PREVIEW=1`.

## Routes

| Route | Status | What changed |
| --- | --- | --- |
| `/student/lesson/[contentId]` legacy | UPGRADED | Focused header (Back to Learn, grade/subject), 1440px stage with closable tools rail, mode switch, Read layout (contents + 68ch column + structured sections, real tables), Slides as teaching scenes, honest Listen availability, truthful finish |
| `/student/lessons/[id]` legacy (assigned) | UPGRADED | Same chrome (Back to Today, position bar), help rail with section list/goals/tutor/labs, Read layout, Slides as teaching scenes ending at the existing assessment hand-off, compact one-row section navigation |
| `/student/lesson/[contentId]` and `/student/lessons/[id]` native | UPGRADED | `LessonPlayerV2` on the shared stage: outline rail, wide stage, closable help rail (width returns to the stage), teaching-scene headings, key points as numbered teaching points, real same-origin pictures in a visual column, Previous/position/Next footer with scene dots |
| `/student/progress` | UPGRADED | Next step; Skill learning (evidence, confidence, practice results — a failed read shows Unknown, not zero); Schoolwork (completion is labelled as not mastery); Official records |
| `/student/today` | UPGRADED (partial) | Hero side panel shows real counts from the existing sources ("—" = unknown, never zero) instead of generic copy; three disclosures in one compact row |
| `/design-preview/grade-7-place-value` | NEW, dev-only | Grade 7 Number Sense demo (below) |
| `/student/learn` | UNCHANGED | Already on V2 cause-specific states; shares the shell. V3 primitives are ready for it but it was not re-laid out in this PR |
| Lesson catalog, units, classes, schedule, labs, textbooks, assignments, homework, exams, WAEC, `/progress`, records sub-pages | LEGACY / V2 | Out of P0 scope; no visual change. `/progress` stays reachable until a reviewed retirement |
| Inside the assigned route: objectives, code/AI-literacy exercises, lab activity, simulations, exit ticket, quiz panel | V2-era cards | Behaviour and endpoints unchanged; they inherit the new tokens only |

## Shared components (role-neutral)

`app/learning-v3.css` (imported by `globals.css`) adds layout tokens (`--ll-gutter`, `--ll-dashboard-max` 1280, `--ll-stage-max` 1440, `--ll-measure` 68ch, rail/support widths) and scopes the V2 colour aliases to focused learning (`.ll-lesson-v2`, `.ll3-scope`), which also fixes UX11 (focused lessons no longer use the global pink "success").

| Component | File | Reuse by other profiles |
| --- | --- | --- |
| `PageFrame`, `PageHeader`, `Panel`, `Chip`, `Meter` | `components/experience/Frame.tsx` | Teacher/Guardian/School/Ministry/Author dashboards: 1280 frame, header with actions, sectioned panels |
| `StateNotice` | `components/experience/StateNotice.tsx` | One vocabulary: loading, empty, error, denied, offline, stale, unknown, preview |
| `FocusedHeader`, `LearningStage`, `StageFooter` | `components/experience/FocusedLearning.tsx` | Author/reviewer learner preview, teacher lesson preview, guardian homework view |
| `TeachingScene`, `TeachingPoints`, `WorkedExample`, `LearnerTask`, `Figure` | `components/experience/TeachingScene.tsx` | Author preview of authored scenes |
| `InlineText`, `LessonBlocks`, `LessonTable` | `components/experience/LessonText.tsx` | Any safe lesson-text rendering |
| `LegacyReading`, `LegacySlides` | `components/experience/LegacyLesson.tsx` | Teacher lesson view (`TeacherLessonViewClient`) can adopt next |

Future layout requirements per profile (from the role matrix, not built here): Teacher — six-group rail + attention queue in `.ll3-split` with the assistant as a closable support rail; Guardian — child picker in `PageHeader` actions and ≤4 panels; School admin — `RecordTable`/detail pane (not yet built) inside `PageFrame`; Ministry/District — scope/period/freshness header and suppressed aggregate tables; Author/Reviewer — `FocusedHeader` with exact revision identity plus `LearningStage` for learner preview. Each must keep its own authority logic outside these components.

## Grade 7 demo

`components/experience/demo/PlaceValueDemo.tsx`, route `app/design-preview/grade-7-place-value/page.tsx`. Six scenes: introduction (one number in three groups), visual explanation (place-value chart: table when wide, labelled list when narrow), interactive number breakdown (+/− per place with keyboard/touch, expanded form and words, presets, reset), guided example (three revealed steps with the chart highlighting the digit), practice (three questions checked on this device with misconception-specific feedback, labelled demo-only), review. Read-aloud uses the browser's own speech only when available, never autoplays and stops on scene change. Local preview: `npm run dev` then open `http://localhost:3000/design-preview/grade-7-place-value` (no sign-in in development), or the harness at `http://127.0.0.1:3191/design-preview/grade-7-place-value` via `npx vite --config e2e/product-design-v2/vite.config.ts`.

## Validation

- `node e2e/product-design-v2/validate-v3.mjs`: 36 surface/width layouts at 320/390/768/1024/1440/1920 with no page overflow and no primary target under 44px; at 1440×900 the stage is ≥640px with help open and widens when it closes, focus moves to the Show control; reading measure ≤70ch; slides keyboard (arrows ignored while typing an answer); library finish makes no write; demo keyboard walk with zero API calls and zero storage; Progress unknown-not-zero; 7 axe scans with zero serious/critical findings.
- Existing Product Design V2 suite (`node e2e/product-design-v2/run.mjs`): Today, Learn/shell, Classes, Labs and Lesson runtime validators all pass unchanged.
- `npx vitest run __tests__/learner-experience …` and `npm run validate:changed`: pass. `npx tsc --noEmit`: clean. ESLint on changed files: clean. `npm run build`: see the handoff report.
- Screenshots: `artifacts/student-experience-v3/before` (main) and `artifacts/student-experience-v3/after` (this branch), same fixtures and widths; `capture-v3.mjs <label>` regenerates them.

Evidence limits: fixture harness with production components and mocked API answers. Not server authorization, production content, real phones/tablets, screen-reader user testing or a learner comprehension study.

## Remaining blockers

- Grade 7 native release: the published release registry still contains only the Grade 4 release, so Grade 7 stays legacy (now presented better). Real native Grade 7 needs reviewed content and a registered release through the existing owners.
- Real visuals: legacy lessons show pictures and diagrams only when the lesson supplies a safe image or table. Most legacy bodies are text, so their slides remain text-led teaching scenes; authored, reviewed diagrams are a content dependency.
- Audio/narration: Listen shows prepared audio only; most lessons will show "not ready" plus the transcript. No generation is triggered by this change (the assigned route's existing request path is unchanged).
- Evidence/finish integration for native lessons remains an owner dependency (`submissionEndpoint: null`).
- Learn, Labs, catalog and the remaining student pages still need their V3 pass; teacher/guardian/admin/official profiles are documented above, not redesigned.
