# Student Experience V3 — P1 lesson visual and instructional record

Branch `feat/student-lesson-visual-v3`, based on main `2bf94c11df127292a1863b75cc338a462204d0a2` (includes P0, PR #189). Scope: the two student lesson routes, the native Lesson Player V2 and its scene views, lesson-specific `components/experience/*`, lesson-scoped CSS, the in-lesson tutor hand-off and the tutor page's back link. Today, Learn, Progress and teacher surfaces are untouched. Presentation only.

## Authority boundary (unchanged)

- Native/legacy selection, the delivery seam, release checks, assessment secrecy, completion, evidence, mastery and tenant authorization are unchanged. No API route, Prisma, ScheduledWork, allocation, flag, deployment or production-data change.
- Read position is a reading position: it lives in `?section=` and in `sessionStorage` for the current tab only. It is never sent, never counted as completion and never inferred as mastery.
- Legacy text is re-presented, never written: section roles and audiences come only from authored headings; run-in labels ("Worked Example 1:") are split, not reworded; the place-value tool on Mathematics slides is built only from numbers already in that slide and is labelled as a tool.
- Teaching lessons (`lib/learner-experience/teaching/contract.ts`) are a presentation contract. Their status comes from the published-release registry (`availability.ts`, server side): a lesson that only *claims* `APPROVED_RELEASE` without a matching registered release for its grade and subject is shown as CANDIDATE. In this change, teaching lessons are mounted only on the dev-only `/design-preview/*` routes (404 in production builds unless `STUDENT_DESIGN_PREVIEW=1`).
- Formative checks in teaching blocks are on-device feedback only; the contract cannot author assessment items. The assigned route's existing assessment hand-off now appears with the final reading section and still goes to the existing exit ticket.

## Content status inventory

| Status | What | Shown to students? |
| --- | --- | --- |
| Released (native) | The published registry contains only the Grade 4 MATH release (`lib/learning-authority/publishedReleases.ts`) | Yes, through the delivery seam (unchanged) |
| Candidate | Grade 4 fractions activities (ActivityDefinition fixtures); any teaching lesson naming an unregistered release | No |
| Demo | Grade 7 Place value (7 scenes), Grade 5 Water cycle, Grade 4 Nouns/verbs/adjectives, Grade 6 Reading a timeline — `lib/learner-experience/teaching/demoLessons.ts` | No — dev-only preview, labelled DEMO on every screen |
| Legacy | Hosted lessons without a native release, including Grade 7 Number Sense and Place Value and Grade 7 Literacy | Yes, through legacy Read / Slides (presentation improved here) |

The demo Social Studies timeline uses widely documented dates (1822, 26 July 1847, 1945, 2006); a curriculum reviewer must still check every fact before any demo text is adapted into reviewed content.

## Routes

| Route | Change |
| --- | --- |
| `/student/lesson/[contentId]` (legacy) | Read is a playlist (one section on the stage; bounded contents rail with its own scroll; phone/tablet Contents drawer; Previous/Next pager; deep link, Back/Forward, refresh, tab resume). Slides: teacher/family notes labelled from headings and skippable, multi-paragraph slides as reading cards using the slide width, authored run-in labels as card headings, place-value tool on Mathematics slides with numbers. Objectives shown once (help rail), not duplicated in Read. Tutor opens beside the lesson. |
| `/student/lessons/[id]` (legacy, assigned) | Same playlist and slides. "Go to assessment" appears with the final section and reaches the existing exit ticket. |
| Native `LessonPlayerV2` (both routes) | Outline rail bounded to the viewport with its own scroll; phone/tablet Contents drawer; help rail bounded above the fixed footer; DIAGRAM_REVEAL as a connected flow (left-to-right on a wide stage, stacked with connectors on a phone); formative checks with lettered options and verdict styling (authored feedback verbatim); tutor opens beside the lesson. |
| `/design-preview/grade-7-place-value` | Rebuilt on the teaching contract: grouped number, place-value chart, ×10 shift, number builder, worked steps that drive the chart, digit cards (whole numbers) with misconception feedback (reversed, zero placeholder, wrong place), choice questions with per-option feedback and hints, review. `?scene=` opens a scene. |
| `/design-preview/lessons`, `/design-preview/lessons/[slug]` | NEW, dev-only: gallery with the content-status inventory; Science process cycle, English sort, Social Studies sequence + timeline. |
| `/student/ai-tutor` | Back link goes to Today (was the generic dashboard) with a 44px target. |

## Components

| Component | File | Notes |
| --- | --- | --- |
| `LegacyReading` (playlist) | `components/experience/LegacyLesson.tsx` | All sections stay mounted (hidden), so switching never loses input |
| `LegacySlides`, `LegacySlideScene`, `NumberLens`, `ReadingCards` | same | Skip-notes navigation keeps real slide numbers |
| `ContentsDrawer` | `components/experience/ContentsDrawer.tsx` | Modal sheet, focus kept inside, Escape/backdrop close, focus returns, page scroll locked while open |
| `LearningStage` contents drawer | `components/experience/FocusedLearning.tsx` | Any outline becomes a drawer below 1024px |
| `AskTutorButton` | `components/experience/AskTutorButton.tsx` | Dispatches `liberialearn:open-tutor`; the grounded tutor shell opens in place where it is shown, otherwise the tutor page |
| `TeachingLessonPlayer`, `TeachingBlocks`, `ReadAloud`, `PreviewGallery` | `components/experience/teaching/` | Reusable blocks: GROUPED_NUMBER, PLACE_VALUE_CHART, TEN_TIMES, NUMBER_BUILDER, DIGIT_CARDS, STEP_REVEAL, CHOICE_CHECK, PROCESS_CYCLE, SORT, SEQUENCE, CALLOUT |
| Lesson-scoped CSS | `components/experience/lesson.css` | Only `ll4-` classes or selectors under lesson roots; no shared/global token changed. `app/learning-v3.css` untouched |

## Evidence

- `node e2e/product-design-v2/validate-v3-p1.mjs` (new): 22-section lesson at 390/768/1440/1920 — one section shown, no horizontal overflow, rail ≤ viewport with its own scroll at desktop, drawer at phone/tablet, document < 3 viewports; section 17 opened by deep link, rail and drawer; Enter on Next/Previous, ArrowDown in the rail, Back, Forward, refresh; hiding help widens the stage; drawer scrolls itself and locks the page; Escape returns focus; 19-section hosted-shape Grade 7 Literacy lesson; assigned route hand-off only in the final section and no writes; slides notes/cards/number tool; native flow diagram, bounded outline, phone drawer; Science/English/Social Studies demos with zero API calls and zero storage; 14 axe scans with zero serious/critical.
- `node e2e/product-design-v2/validate-v3.mjs` (P0, updated for the playlist rail and the digit-card scene): 36 layouts, geometry, slides keyboard, truthful completion, demo walk with zero API calls/storage, 7 axe scans.
- `node e2e/product-design-v2/run.mjs`: Today, Learn/shell, Classes, Labs and Lesson runtime validators pass unchanged.
- Vitest: `__tests__/learner-experience/teaching-scenes-p1.test.ts`, `lesson-playlist-p1.test.tsx` (new) plus all learner-experience, tutor-shell, lesson-route and fullscreen suites.
- Before/after screenshots: `artifacts/student-experience-v3-p1/before` (main) and `after` (this branch), same fixtures, 390 and 1440 (stress lesson also 768/1920); `capture.json` lists document heights (22-section Read: 29,615 → ~2,380 px at 390; 18,344 → ~1,420 px at 1440).
- Fixtures: `e2e/product-design-v2/generatedLessonFixture.ts` produces hosted-shape bodies with the repository's own enricher (Grade 7 MATH Number Sense and Place Value; Grade 7 LITERACY 45+90 minute bodies, 19 sections) and a synthetic 22-section stress fixture.

Evidence limits: fixture harness with production components and mocked API answers. The founder's production screenshots were not available in this workspace, so the hosted Grade 7 shape was reproduced from the repository's generator rather than the hosted record. Not server authorization, production content, real phones/tablets, screen-reader user testing or a learner comprehension study.

## Remaining content dependencies

- Real Grade 7 native lessons need reviewed content and a registered release; until then Grade 7 stays legacy and much of its generated text is teacher guidance (now labelled and skippable, not rewritten).
- Reviewed diagrams/visuals for legacy lessons remain a content dependency; the teaching contract is ready to carry them once reviewed and released through the existing owners.
- Wiring teaching lessons into a student route requires a release binding from the existing authority; this change only renders them in the dev preview.
- Native Finish/evidence integration remains owner-held (`PRESENTATION_ONLY_EVIDENCE`).
