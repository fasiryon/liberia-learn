# Interactive textbook V1 handoff

Branch: `feat/interactive-textbook-v1`.
Verified base: `2bf94c11df127292a1863b75cc338a462204d0a2`.
Local demo: http://localhost:3214/pilot-preview/textbooks (development only).

## Outcome and real routes

Existing `/student/textbooks` is upgraded. New `/student/textbooks/[contentId]` presents eligible current-grade lesson readings as a book, retaining shared learner authorization and safe projection. No published textbook editions were verified or upgraded. Compiler/PDF generation, queue storage and publication authority are unchanged.

`/pilot-preview/textbooks` is a clearly labelled synthetic design showcase and is unavailable in production. `/teacher/textbooks/preview` is a TEACHER/ADMIN-gated synthetic reviewer showcase, not a governed book-edition preview.

Two-page spreads, responsive single pages, chapter navigation, bookmarks, scoped reading aids, three font sizes, layout selection, keyboard and Chromium touch input, authored diagram reveals, missing-asset alternatives and reduced-motion presentation are implemented. Browser speech and verified existing lesson narration are distinct. No educational evidence, grade, mastery or completion is written.

## Validation

- Focused textbook/compiler/generation regression suite: 37 tests passed in 9 files.
- Shared learner eligibility parity regression: 31 tests passed.
- Final changed-file and related tests: 15 textbook tests passed; full TypeScript and API-policy audit passed in `validate-changed.log`.
- Full lint passed with existing shared warnings. Final focused textbook lint passed without warnings or errors.
- Browser matrix passed at 390, 768, 1440 and 1920 pixels; zero Axe violations on the reader surface, no uncaught page errors in that matrix. Keyboard, control arrow-key isolation, font/layout controls, bookmarks and reading position across reload, page boundaries, reduced motion and mobile/tablet Chromium touch input passed.
- Empty reading, missing illustration, narrow student-shell-style container and browser-speech lifecycle checks passed. Speech lifecycle uses a synthetic adapter; actual device voice playback is not certified.
- Next production build: passed (exit 0), including compilation, type checking, static generation and runtime tracing; existing shared warnings remain in `build.log`.

## Visual evidence

- `reader-390.png`, `reader-768.png`, `reader-1440.png`, `reader-1920.png`.
- `hub-before-fixture-{390,768,1440,1920}.png` and matching `hub-after-fixture-*.png` are visibly labelled synthetic catalogue fixtures rendered from the real route sources. They are not live authenticated school captures.
- `browser-results.json` and `browser.log` describe the browser checks.

## Limits and handoff

Only already-loaded text is checked under browser offline emulation. Offline reopening/downloads are not implemented or certified. Shared service-worker and security work would be needed to support those safely. Real reading aids use browser-tab storage; synthetic aids use local device storage. They store positions/settings, not content or learning state.

No live database, school session, prepared audio asset or physical mobile device was available for end-to-end verification. The reader presents projected text, the first illustration per native scene and authored diagram reveals; other lesson interactions remain in existing lesson flows. Governed published book selection and real-edition reviewer preview remain candidate-only. Teacher preview here is synthetic. Prepared narration is for the full reading and is not synchronized to individual pages.

Build validation uses placeholder local configuration and the existing generated Prisma client (the unchanged schema matches the base), without regenerating shared dependencies. It is not deployment certification. No deploy, PR or merge is initiated. Next step: review this textbook-only branch; any governed-book or shared offline integration needs a separate scoped change.

## Exact source/test file changes
- `__tests__/textbook-hub-visual-fixtures.test.tsx`
- `__tests__/textbook-narration.test.ts`
- `__tests__/textbook-reader-routes.test.tsx`
- `__tests__/textbook-reader.test.ts`
- `app/pilot-preview/textbooks/page.tsx`
- `app/student/textbooks/[contentId]/not-found.tsx`
- `app/student/textbooks/[contentId]/page.tsx`
- `app/student/textbooks/error.tsx`
- `app/student/textbooks/loading.tsx`
- `app/student/textbooks/page.tsx`
- `app/teacher/textbooks/preview/page.tsx`
- `components/textbooks/README.md`
- `components/textbooks/TextbookReader.tsx`
- `components/textbooks/demoBook.ts`
- `components/textbooks/model.ts`
- `components/textbooks/narration.server.ts`
- `components/textbooks/textbooks.module.css`
- `e2e/textbooks/verify.cjs`

Textbook-specific screenshots, fixture HTML and validation logs are retained under artifacts/textbook-v1/. Inventory details are in components/textbooks/README.md.
