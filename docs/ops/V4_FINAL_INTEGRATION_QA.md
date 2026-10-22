# V4 final integration and acceptance (Chief of Staff, independent integration owner)

Date: 2026-10-22. Branch `integration/v4-final`, based on main `887f23ecc` (= origin/main at fetch). Local and unpushed.
This report **separates engineering merge readiness from approval to publish curriculum content**. The missing
academic or governance approvals listed in §7 are release gates, not failing engineering tests.

## 1. Verdicts

| Item | Verdict |
|---|---|
| **R7** (factory lessons on the real Next review route) | **PASS** |
| Engineering merge readiness | **READY FOR PR REVIEW**: CI on the real PR head, then founder merge |
| Geometry `g7-math-area-perimeter` draft.5, instructional review | **PASS** for internal draft review (G-1/G-2/G-3 closed; 3 P3 notes) |
| Civics `g7-civics-counties-capitals` draft.5, instructional review | **PASS** for internal draft review (C-1 closed; MOE map standard now CONTENT_REFERENCE, academic decision open) |
| Other four lessons (draft.4) | No regression: byte-identical and complete on the real route |
| Curriculum publication | **NOT APPROVED**. All packages are reviewer-only DRAFT, `REVISION_REQUIRED`, `learnerDeliverable: false` |

## 2. Provenance: how the branch was built (merges only, nothing rewritten)

```
887f23ecc main
└─ 6ea703fcb integration/v4-cos-qa (fast-forward): T2 198edc566 + T1 ee0c00092 via e780c5f1c, CoS QA driver
   0ac0d77fd merge T1 162d7288d             (browser/a11y evidence)
   a06267838 merge docs 767d76a8c           (coordination + earlier QA)
   f80f64d9f merge T2 d0428bed8             (hash-verified loader, draft.5)
   b4ad20d1c merge T1 aac0dbe3d             (selector, provenance bar, D2/D3)
   75f866065 merge T2 ecc454e58 + T1 1afe3e690 (raw-byte integrity; E1/E2 type fixes)
   d0e434bbc merge T1 71b8af35f             (driver diagnostics)
   4d571a62d merge T1 6a7910967             (driver centring)
   e7d8c6502 merge T2 3df84d1b5             (R7 handoff + hash ledger)
   + CoS commit                             (this report, real-route driver, tamper suite, evidence)
```
Source branch heads are ancestors of the PR head: `feat/interactive-learning-v4` @ `6a7910967`,
`fix/v4-r7-factory-review` @ `3df84d1b5` (which contains `feat/content-factory-v4-pipeline` @ `198edc566`),
`docs/v4-program-coordination` @ `767d76a8c`, `integration/v4-cos-qa` @ `6ea703fcb`. No worktree was removed.

## 3. Candidate versions and hashes

Pins: `curriculum/factory-v4/review-pins.json`. Generation receipt SHA-256:
draft.4 `ba0bacf12e36d3968e442d4bfa50dfc73eb9bcc5e9848d1c166bfa0a91d71e45` (inputs `60883779…aa01a2`),
draft.5 `eea568feea89d043bd01585276d6314ee6aa9db8ac4ba75429bb34a5abce7a2a` (inputs `88b7a18e…323ba5`).

| Version | Lesson | packageHash | manifest SHA-256 | learner projection SHA-256 |
|---|---|---|---|---|
| 4.0.0-draft.5 | g7-math-area-perimeter | `7dedcc121174a439db4e3f3d38e04e3b705ff6362647f4afa59afd30ba2d0770` | `1013cf827d571dc657b2fe25892642b3b94e09449776e2b9205b5ab6323b30ea` | `bb77ab457a3d7f025fc7d2846bf8bcf88a8694872b0782df7d9b3c4e08bf6640` |
| 4.0.0-draft.5 | g7-civics-counties-capitals | `1da85c7ac63953499cf3f6500cc7f3c34691c1e266d9fee71937c490c17074d9` | `cb10937b09ef6c0b0ea5fd194a22645ad4e66c9f63bd0daaaf324dd0faa7871c` | `83fcebd4a715282925669d97e9d58e6d086b72a39a71ecb9db18d659ab3522f7` |
| 4.0.0-draft.4 | g7-math-area-perimeter | `ad195ec26b8e269cf2e2ec9672e3fbc72b3ebf290a8911ad17f71364b7716905` | `b61c37f3d5259a979b57c1fc45b0233501b7fbe62bbc4daff0ad1736152da610` | `a9128cc58cd6e4643f320870bb8f93f17f164f62977ce7bfdd75eb850c136d28` |
| 4.0.0-draft.4 | g7-math-fractions | `61cb2277a93d15edfc84401cc1ad71ca2fada086040b45c83ec6e86fdc9c8f5e` | `d1934517dfa61ee8daeb34a43a044ebdc2bdd631baf46850fc2332316c8db1b4` | `a0765419a9d125b4d2201e0bd8477f1e1df0785222bd9b3048e761212224efa6` |
| 4.0.0-draft.4 | math-multiplication-models | `8cdf4d8b666eaf7e818b403bf48f8a981ba55c2715a2e3b7ce361c0abcb7935c` | `7b63fd7ac0528d6e1317615a6d1bc4a83876f0a0bbe286d2d12d3c76f0036eee` | `e6f99e27f5ee38a3488ee796c4ce13a671c65d29120c3cd6071c86d48a6c89a8` |
| 4.0.0-draft.4 | g7-science-states-of-matter | `928c58752705d571f2d69ef602b4d47562537a0fb97289839b085bf88f5964ef` | `f4231a4e0f14bfc5a31aa1ab541037ef1634f7130b50db4c0255693e849df872` | `f198e443ce4d82cb540fe1de5149e8601b85df4e78ece1bd900124c3176414ff` |
| 4.0.0-draft.4 | g7-civics-counties-capitals | `7d148212fffa9bcc48bb22b11c69671160b0c17c2ca49c4020f9c1d86e7b7c9c` | `6043c320070cbde837765221b9c4ffee748fa61f2b34b54e25aca35aae7d04c8` | `82fb57cc20fc0ba65e6911eea94aefdeb0f544ea7d3f5c73df7df1db378c465e` |
| 4.0.0-draft.4 | g7-english-reading-evidence | `1a7a010de44cd1dcc77ab36bf32b7daa7a54c36f07bfe7a02d250a127470ea3d` | `efd4bc570ac80be974814feed0964e6a56d056edaafe6c58b77cdada58a25a8e` | `bfc3ff58c1c5dd881a2c724e9187dccffcb59e20648996a44f197483e77b086c` |

**draft.4 immutability:** all 49 raw files match the `198edc566` baseline (`artifacts/v4-final/draft4-baseline.sha256`),
and `git diff 198edc566 HEAD -- curriculum/factory-v4/drafts/4.0.0-draft.4` is empty. The draft.4 projections keep their
frozen `version: 4.0.0-draft.1` stamp; draft.5 projections carry `4.0.0-draft.5`. The reviewer bar shows the manifest version.

## 4. R7 evidence: real Next.js route, factory-generated content

- **Loader** (`lib/curriculum/v4/factoryReview.ts`, T2) fails closed. Before parsing it verifies:
  - the pinned receipt hash;
  - the manifest and package hash;
  - every raw file hash, including CRLF and invalid UTF-8;
  - the exact file set, with no path escape and no symlinks;
  - the inputs hash, candidate hash and sidecar block bindings;
  - the artifact and blueprint binding and the factory event hash chain;
  - that the projection equals both the manifest and the shipped `learner-projection.json`.

  The grammar is `factory@4.0.0-draft.[45]@<key>`, with no fallback. Bare keys are the hand-authored reference fixtures.
- **CoS independent tamper suite** (`__tests__/cos-v4-qa/factory-tamper.test.ts`): it flips one byte in each of 5 files × 2 versions ×
  2 lessons on a temporary copy, and every flip is rejected. **25/25 pass** on the PR head.
- **Real route driver** (`e2e/cos-v4-qa/next-route.cjs`) runs `next dev`. The route is dev-only by design (§5).
  - Session: a synthetic MOE_OFFICIAL JWT minted with a throwaway local secret.
  - Database: a throwaway local Postgres (§6).
  - It plays T1's learner driver against `/lab-review/v4-lessons/factory@<version>@<key>`, with no fixture interception and no API stubs.

| Run (head `d0e434bbc`, identical app code to PR head) | Runs finished | Scenes | axe WCAG 2.1 AA | Page errors | Writes | Overflow | Payload canaries |
|---|---|---|---|---|---|---|---|
| `4.0.0-draft.5` (geometry at 360/390/768/1024/1440/1920, civics at 1440) | 7/7 | 48 | 0 | 0 | 0 | 0 | 0 |
| `4.0.0-draft.4` (all six; geometry at six widths) | 11/11 | 74 | 0 | 0 | 0 | 0 | 0 |

- Gallery at 390 and 1440 px shows both labels, "Factory-generated DRAFT" and "Hand-authored reference fixture". 20 selectable links: 8 factory + 6 reference, plus version chips.
- Rejections: `factory@latest@…`, `factory@4.0.0-draft.99@…`, traversal `…@../…` and unknown keys all render the "Selection rejected" page. No player and no fallback.
- No session returns 404 (middleware).
- Browser hosts: `127.0.0.1:3215` only.
- **Disclosed test accommodation:** the app-wide PWA lifecycle toast (`components/PwaLifecycleStatus.tsx`: fixed, z-50, no dismiss) is hidden by one CSS rule. At widths ≤1024 it covered controls just above the fixed footer and intercepted clicks (finding D4, outside V4). Service workers stay enabled. There are no force-clicks and no weakened assertions.
- Evidence: `artifacts/cos-v4/next-route/<version>/` (evidence.json, gate.json, db-audit.json, gallery shots).

## 5. Gates and readiness (engineering)

| Gate | Result | Evidence |
|---|---|---|
| Full `tsc --noEmit` | exit 0 at `75f866065` (0 errors); later merges add only docs and an `.mjs` driver | `artifacts/v4-final/tsc-75f866065.log` |
| Earlier join `b4ad20d1c` | FAILED: E1 (route narrowing under `strict: false`), E2 (test typing). Fixed by T1 `d8711e5fa` and T2 `ecc454e58` | `tsc-b4ad20d1c.log` |
| Full vitest | **820 files passed (2 skipped); 8,395 tests passed, 19 skipped; exit 0** at `d0e434bbc` | `vitest-full-d0e434bbc.log` |
| Production build | `npm run build` exit 0 at `75f866065` (T2 run, separate worktree, no env file, unreachable DB). Build inputs are identical to the PR head (`git diff 75f866065` touches only docs and `e2e/learning-v4/next-route.mjs`) | T2: `.task-worktrees/v4-r7-build/artifacts-r7-production-build.log` |
| Production gating | `next start` with `NODE_ENV=production` and `LAB_REVIEW_HARNESS=1`: index and the draft.5 lesson both return **404** with and without a reviewer cookie | T2: `artifacts-r7-production-404.json` |
| CoS independent build | **Not completed.** Claude Code stopped it for low host memory (not a build failure). Not restarted, per policy | `next-build-4d571a62d.log` (partial) |
| Fullscreen Slides V2 regression | exit 0. 390, 390 wide, 768, 1440×720/900 and 1920×720/900 viewports: exact text and order, no clipping, controls, keyboard and Back all pass; assigned lesson exits to an unchanged assessment | `fullscreen-slides.log`, `fullscreen-slides-results.json` |
| Real-route browser and responsiveness | §4 | |
| CI on the PR head | **Pending.** Runs when the founder authorises a push | |

## 6. Student payload and database isolation

- **Payload:**
  - learner projections contain only contract-allowed `formativeKey` (FORMATIVE_ONLY practice);
  - the assessment handoff is `items: []` with `scoring: SERVER_AUTHORITY`;
  - no rubric, answer key, teacher-only, receipt, manifest, blueprint, sidecar, `assessmentRequests`, `labProposals` or `releaseBlockers` data reaches the player's HTML/RSC (0 canary hits on 18 runs);
  - provenance and hashes render only in `<aside data-v4-review-bar>`, outside `LessonPlayerV2`.
- **Database:**
  - V4 loader and route are file-only.
  - **Finding D1:** the root `app/layout.tsx` → `ConsentGate` runs `prisma.dataPolicyAcceptance.findFirst` for any signed-in user, including on `/lab-review/**`. With the usual `.env.local`, which points at production Supabase, a real-route review would *read* production.
  - All CoS, T1 and T2 real-route runs therefore used a throwaway Docker Postgres (`cos-v4-qa-pg`, 127.0.0.1:55439): one table, one synthetic consent row, `log_statement=all`.
  - Statement log: only `SELECT … DataPolicyAcceptance` and `SELECT 1` from the app, and **zero write statements**. There were 0 Supabase references.
  - Builds used unreachable DB URLs. **No production Supabase access and no data mutation occurred during review testing.**

## 7. Content decisions and remaining requirements

**Geometry draft.5: PASS (internal draft review).**
- G-1: the guided triangle is now base 8 / height 3 / sides 5, which is geometrically consistent (√(4²+3²)=5) and distinct from the 6/4/5 worked example.
- G-2: "Choose the unit", plus a units CHECK, plus a written FREE_RESPONSE.
- G-3: scene-specific learner actions, per-item misconception ids with correct diagnostic values (24 surrounding rectangle, 20 slant-as-height, 16 height-in-perimeter), and a plausible mistake-analysis distractor.
- All answers were verified (36/26, 12/18, 77/36, 60/36, 72/34).
- P3 notes:
  - the guided-triangle *area* (12) equals the worked example's area;
  - the transfer problem has no misconception feedback;
  - the mistake analysis still uses the generic misconception id.

**Civics draft.5: PASS (internal draft review).**
- C-1 is resolved by honest rewording: a name register replaces the schematic "map", and the objectives no longer claim location on an outline map.
- All 15 county/capital pairs match the CoS reference (Bensonville for Montserrado, Sanniquellie for Nimba; the Monrovia and Ganta distractors are correct).
- **Academic decision open:** the MOE relation dropped from ALIGNS_WITH to CONTENT_REFERENCE, so this lesson no longer covers "Draw the map of Liberia…". A curriculum reviewer must decide whether a map lesson with rights-cleared cartography is still required.

**Other four (draft.4, unchanged):** complete on the real route with no regression. The earlier instructional status is unchanged: fractions, multiplication and English not fully reviewed; science spot-checked accurate.

**Remaining academic and governance requirements. These block publication, not the merge.** Every package carries:
- MOE objective binding (`MOE_OBJECTIVE_UNBOUND`, `OBJECTIVE_MAPPING_PROPOSED:*`);
- an ontology release (`ONTOLOGY_RELEASE_MISSING`);
- named subject-expert human review of the exact revision (`V4_HUMAN_REVIEW_REQUIRED`, `EXACT_REVISION_HUMAN_REVIEW_REQUIRED`);
- governed Assessment V2 items and protected-key reconciliation (`ASSESSMENT_ITEMS_PENDING`, `PROTECTED_ASSESSMENT_RECONCILIATION_REQUIRED`, `RESTRICTED_KEY_COMPARISON_PENDING`);
- the excellence blueprint gates (`excellence:BP-*`);
- source and rights review (`AUTHENTIC_SOURCE_COMPARISON_AND_RIGHTS_REVIEW_REQUIRED`), plus legacy comparison or V0.2.1 reconciliation;
- retention policy approval;
- manual accessibility and offline runtime QA;
- explicit release authorisation.

**Accessibility that needs a human tester or a physical device (not performed):**
- screen-reader output, in particular MathML reading, live-region feedback and the county register, with NVDA+Firefox/Chrome, JAWS, VoiceOver (macOS/iOS) and TalkBack;
- switch access and voice control;
- browser zoom to 200% and 400% on real browsers;
- Windows High Contrast / forced colours;
- low-end Android phones on 2G/3G and fully offline after install;
- colour-vision review of the diagram palettes;
- cognitive-load and reading-level review with Grade 7 learners in Liberia.

Automated axe reports 0 violations; its incomplete checks are listed in the evidence for human follow-up. The CoS scripted keyboard, reflow and text-spacing pass was **not run** because host memory was exhausted.

## 8. Known issues carried in the PR (not V4 blockers)
- D1: the root `ConsentGate` reads the database on review routes. Never run the review routes against `.env.local` production settings.
- D4: the PWA lifecycle toast can cover controls above the fixed footer at ≤1024 px and has no dismiss control (app-wide UX, P2).
- The Windows `next build` standalone copy hits EPERM on junctioned `node_modules` (local environment only; T2 noted it).
