# Fullscreen Slides V2

Fullscreen Slides uses the integrated Student Experience V3 palette, lesson blocks, fullscreen API and shared student lesson routes. Embedded Slides, Read, lesson delivery, assessments and release/eligibility checks keep their existing implementations.

## Actual regression lesson

The fixture was retrieved from the existing Supabase `CurriculumContent` catalog on 15 October 2026. The lookup ran inside a transaction with `transaction_read_only = on` and a statement timeout. It matched Grade 7 content containing Boima, Fatu and Gbarnga, then verified the opening story and objectives. No catalog content was written or regenerated.

- Content ID: `hero-civics-g7-democracy-and-representation-in-liberia`
- Title: **Understanding Democracy and Representation in Liberia**
- Catalog version: `2.0.0`; `lessonVersion`: `1`
- Current governed revision: `cmss94h3z03bzvo54hj7c7z8t`, sequence `1`, lifecycle `APPROVED`
- Revision content hash: `cca4566947348a5dca3bf3fb2bf221c74eb6d81999c8b2677b367d24d52e24ef`
- Catalog last update: `2026-07-25T06:05:55.023Z`
- Learner body SHA-256: `62564d43e7e952124d097f8e7a7499e2344efc53333e8e67d21f724083707c69`

[`civics-lesson.json`](../../e2e/fullscreen-slides-v2/civics-lesson.json) contains the actual lesson after the existing `projectStudentLessonPayload` filter. It is not synthetic lesson text. The identity, API transport and absence of a native release are local browser fixtures, not evidence of a live authenticated session. Teacher/answer-bearing text excluded by the production filter is not added back. The existing compatibility adapter produces the reported 17 source slides, including Hook, Learning Objectives, Prior Knowledge Activation and Core Concept.

## Composition rules

Entering fullscreen creates a presentation viewport with persistent Previous, Next, position and Exit fullscreen controls. The stage uses balanced available width. Body text is 20px on small screens and 28.8–32px at the tested desktop widths; fitting never reduces typography.

Source paragraphs and list items are split into ordered fragments, retaining their original characters and whitespace. Splits prefer sentence boundaries; oversized sentences continue at word boundaries. Inline Markdown spans stay together where possible. Lists retain their item numbers. Tables retain rows and repeat column headings as continuation context. Existing source images use the existing safe image renderer; no diagrams or curriculum are generated. Paragraph fragments that fit together are rejoined when displayed.

Chromium measures fragments at the actual presentation width and font size. It packs them against available height after reserving space for the source heading and navigation. Source boundaries stay intact. A long section becomes several presentation pages with a visible part count. Resizing measures again, retaining a source-fragment reading position. A shorter viewport can split passages further instead of introducing internal scrolling or shrinking text.

Story, objectives, explanation, worked-example, list, practice and discussion presentations use authored order and semantic headings/lists. New labels identify the presentation's purpose; lesson wording is never rewritten. Authored visual blocks remain source content.

Arrow keys change presentation pages unless focus is in an editable control. Navigation puts focus on the new heading, announces the position and records a `slide` reading position in browser history. Back/Forward restores that position. This is presentation state, not completion, assessment or mastery evidence. Exiting fullscreen returns to the corresponding source slide. The existing fullscreen button/API handles exit; reduced motion needs no slide animation.

## Verification

Run from this checkout:

```text
node e2e/fullscreen-slides-v2/run.mjs
node node_modules/vitest/vitest.mjs run __tests__/learner-experience/fullscreen-presentation.test.ts
npm run validate:changed
```

The browser runner mounts the actual student components. At 390×844, 768×900, 1440×720, 1440×900, 1920×720 and 1920×900, it traverses every resulting page, compares all displayed text and order with the original learner-visible 17-slide deck, checks content bounds, balanced width, typography, overflow and controls, and captures the four reported opening sections. It also checks keyboard navigation, browser Back, Read content equality, accessibility and absence of educational writes. `--baseline` captures the old layout and deliberately fails its typography/scrolling assertion when run against the original implementation.

The existing CI entry point, `node e2e/product-design-v2/run.mjs`, also runs this regression after closing the historical fixture server. The runner verifies the existing synthetic assigned-work fixture separately to confirm that the final fullscreen page still exits to the original assessment without submitting it. This compatibility case is labelled separately from the actual Civics lesson.

Artifacts live under `artifacts/fullscreen-slides-v2/`. Baseline captures reproduce 17px body text and controls below the viewport. Separate existing tests continue to cover assessment hand-off, answer secrecy, release restrictions, fullscreen API fallbacks and the Read playlist. No production mutation, content-candidate edit, merge or deployment belongs to this change.

### Recorded local results

The final real-component browser run passed all six sizes, traversing 307 presentation pages. Each size preserved the exact learner-visible text and order of all 17 source slides. Every page passed typography, width, bounds, overflow and persistent-control checks. Six axe scans reported zero violations; no page errors or educational writes occurred. Browser Back/Forward also restored the opening source fragment after fullscreen was reopened from a later section, even when entry reflow changed its page number.

| Viewport | Presentation pages |
| --- | ---: |
| 390 × 844 | 58 |
| 768 × 900 | 34 |
| 1440 × 720 | 59 |
| 1440 × 900 | 42 |
| 1920 × 720 | 68 |
| 1920 × 900 | 46 |

Representative captures: [desktop before](../../artifacts/fullscreen-slides-v2/before/hook-1920-900.png), [desktop Hook](../../artifacts/fullscreen-slides-v2/after/section-1-1920-900.png), [mobile objectives](../../artifacts/fullscreen-slides-v2/after/section-2-390-844.png), [Prior Knowledge](../../artifacts/fullscreen-slides-v2/after/section-3-1440-720.png), [Core Concept](../../artifacts/fullscreen-slides-v2/after/section-4-1920-900.png). The adjacent `after/results.json` records every page's geometry and the six text-preservation flows.

The full Vitest suite passed 7,485 tests across 769 files, with 8 tests in 2 files skipped. `validate:changed` passed the API audit, focused tests, related tests and TypeScript validation. The fixture test includes exact character reconstruction before rendering; browser comparisons verify visible wording and order after the existing Markdown renderer.

Both integrated Student V3 runners also passed: 36 layout checks and four navigation flows with 32 axe scans, then eight lesson-detail checks with four axe scans. All scans reported zero violations and both runners reported zero page errors. Their machine-readable results are copied into `artifacts/fullscreen-slides-v2/compatibility/`. The local copies used port 3203 because another checkout already owned the default 3197; production components and assertions were unchanged.

`node node_modules/next/dist/bin/next build` exited 0 after compilation, lint, type validation and generation of all 391 static pages. It used placeholder build environment values, not hosted credentials. Existing lint/instrumentation/environment warnings remained. Windows also denied Next's attempt to reproduce this checkout's shared dependency junction inside `.next/standalone` (`EPERM`, symlink); the local standalone packaging is therefore not deployment certification. No build configuration or application behavior was changed to suppress that warning.

The exact CI browser entry point also exited 0: all five historical validators (dashboard, Learn, Classes, Labs and Lessons), followed by a second successful six-size Civics run. The final `validate:changed` run passed its API audit, five focused tests, 69 related tests, JavaScript syntax checks and TypeScript validation. This branch stays local for review; it has not been merged, pushed or deployed.
