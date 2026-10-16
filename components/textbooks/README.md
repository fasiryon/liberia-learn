# Interactive textbook experience V1

Base: `2bf94c11df127292a1863b75cc338a462204d0a2`, fetched from and verified against `origin/main` on 2026-10-14. Isolated branch: `feat/interactive-textbook-v1`.

## Inventory and route ownership

- The existing `/student/textbooks` page is a grade-filtered catalogue of authorized `lesson`, `unit_plan`, `term_plan`, and `full_pack` curriculum rows. It previously linked all entries to the shared lesson route. It is **not** a catalogue of published book editions.
- `lib/ai/textbook/textbookCompiler.ts` compiles curriculum units and approved lesson text into `TextbookResult`. `textbookPdf.tsx` renders PDFs. The admin compiler API is flag-gated and admin-scoped; school context is resolved server-side and generation is audited.
- `TextbookGenerationJob`, the generation queue, cron and worker maintain generated PDF status and Supabase storage URLs. `GENERATED` is a generation outcome, not an immutable learner publication grant. No jobs, compiler, generation API, storage policies, publication or AI authority are changed here.
- Content Bundle V1 describes immutable identities and governed resources; repository fractions fixtures and preview fixture resolvers remain synthetic/candidate material. The existing preview resolver fails closed when authority/version selection is unavailable. This reader does not promote or reinterpret those fixtures as released books.
- Learner readings reuse `listAuthorizedLearnerContent` for visibility, lifecycle, curriculum-version and school/class scope, then `projectStudentLessonPayload` for the learner-safe field projection. The route also checks the student record, school and current grade. Teacher/reviewer answers never come from the textbook compiler's teacher/assessment shapes.
- Existing `LessonAudio` assets can play only when generated status, content version and the existing narration integrity check match the learner-safe text. No generation is invoked. This is distinct from browser device speech.
- Existing private service-worker page caching covers `/student/lesson/` and `/student/lessons/`, not `/student/textbooks/`. This change does not add private caches or change shared offline identity/revocation behavior.

## Delivered routes

| Route | Result |
| --- | --- |
| `/student/textbooks` | Existing real reading hub upgraded; truthful book-edition availability and subject shelves. |
| `/student/textbooks/[contentId]` | New authorized, current-grade lesson reading presentation; not a published textbook edition. Other resource types retain their existing lesson destinations. |
| `/pilot-preview/textbooks` | Public **local development only** synthetic Grade 4 showcase; returns not-found in production. |
| `/teacher/textbooks/preview` | Existing TEACHER/ADMIN role guard; synthetic reviewer showcase only, no tenant content or publication controls. |

Local demo: `http://localhost:3214/pilot-preview/textbooks` while the development server is running. Start with `SKIP_ENV_VALIDATION=true` and the usual local Next development command on port 3214. No database is needed for the synthetic showcase.

Local state previews: add `?case=unavailable` or `?case=missing-asset`. Both remain synthetic and are disabled with the public showcase in production.

## Reader behavior

Desktop uses two pages when the reader container is at least 1100px wide; mobile, tablet and narrower student-shell containers use one. Single-page layout can be selected on desktop. Pages expand to contain text at larger font sizes rather than clipping it. Chapter and bookmark navigation, previous/next, Home/End, arrow keys and horizontal swipe are supported. Interactive controls retain their own arrow-key behavior. Motion is a short opacity/translation transition, disabled under reduced motion; there is no canvas or 3D rendering.

Native learner-safe scenes supply grade-band text, authored illustrations and diagram reveal descriptions. Legacy learner-safe markdown is paginated for presentation only. Missing images show their authored alternatives. Assessments, mastery handoffs and other learning interactions remain the responsibility of the existing learning flows; this reader emits no score, evidence or completion. The fraction explorer and orange illustration are clearly synthetic demonstration elements, not national curriculum content.

Synthetic bookmarks/settings/position persist locally on the device. Real reading aids use tab storage keyed by school, user, content and timestamp; only page numbers and settings are stored, never reading payloads. They are convenience aids and do not establish access or educational state. Storage failures degrade to the current visit.

Browser speech is user-initiated, stops on page/layout changes or departure, and may need a connection depending on the installed voice. Verified prepared lesson narration is labelled separately, with native playback controls and part selection; it is not page-synchronized. Missing narration leaves text available.

## Evidence and limits

`artifacts/textbook-v1/` holds screenshots and validation results. `e2e/textbooks/verify.cjs` exercises the real local showcase in Chromium at 390, 768, 1440 and 1920 pixels. Axe scans target the textbook surface, not unrelated shared-shell components. The runner uses a dedicated browser context and bypasses CSP only to inject the local accessibility scanner. It uses Chromium touch input for swipes. Browser offline emulation checks already-loaded text only; it is not full PWA/offline certification, a physical device test or a claim of offline reopening.

Before/after hub screenshots are explicitly labelled **synthetic test fixture renders of the actual route source**, with baseline code loaded from the verified base SHA. They are not captures of a live authenticated school catalogue. No database credentials or learner session were available for live protected-route content verification. Unauthenticated portal redirects and mocked server boundary tests provide narrower authorization evidence.

Published textbook edition selection, a governed learner book manifest, reviewed textbook diagrams not present in real content, teacher preview of actual governed book editions, page-synchronized prepared narration, offline download/reopening and cross-device reading aids remain candidate-only. Enabling offline reopening would require shared service-worker/security work outside this mission's ownership. Shared cookie/PWA status overlays can obscure content in browser configurations that block service workers; those shared components are unchanged.

Only textbook pages, components, styles, tests and textbook-specific evidence are changed. LessonPlayerV2, SceneViews, Today, Learn, Progress, Help/Tutor, global design tokens and shared authorization/offline systems are unchanged. No deployment, PR or merge is performed.

The 12ui skill was read and its CLI draft was attempted. Hosted design was unavailable because its credential file was inaccessible, and paid hosted generation was not authorized. The implementation therefore uses a local editorial design; it does not claim alignment to a generated 12ui reference.
