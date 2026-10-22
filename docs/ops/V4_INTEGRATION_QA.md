# V4 independent integration QA — 2026-10-21

Chief of Staff. Integration head `6ea703fcb` on local branch `integration/v4-cos-qa`
(`.task-worktrees/v4-integration`):
- `e780c5f1c` = merge of T2 `198edc566` (`feat/content-factory-v4-pipeline`) into T1 `ee0c00092`
  (`feat/interactive-learning-v4`), conflict-free, both on frozen foundation `1268773a6`;
- `6ea703fcb` adds only the CoS QA driver `e2e/cos-v4-qa/run.cjs`.
QA branch only: it is not for merge and has not been pushed. Evidence copies: `artifacts/v4-coordination/qa-e780c5f1/`.

## Verdict

**V4 engineering: READY FOR INTERNAL DRAFT REVIEW. Not ready to merge** until R7 (factory lessons on the
Next review route) and CI on a real PR head. **Academic release: BLOCKED by governance, not code**
(MOE bindings, ontology, human review, governed assessments, source rights).

| Candidate (4.0.0-draft.4) | Engineering | Instructional content | Release |
|---|---|---|---|
| `g7-math-area-perimeter` | PASS | REVISE (G-1, G-2, G-3) | BLOCKED (governance) |
| `g7-math-fractions` | PASS | Not fully reviewed (desktop run + spot capture) | BLOCKED (governance) |
| `math-multiplication-models` | PASS | Not fully reviewed; SYNTHETIC_DEMONSTRATION | BLOCKED (governance) |
| `g7-science-states-of-matter` | PASS | Spot-checked accurate (0 °C / 100 °C at sea level, simplification stated) | BLOCKED (governance) |
| `g7-civics-counties-capitals` | PASS | REVISE (C-1); 15 county/capital pairs consistent with CoS cross-check, attestation still open | BLOCKED (governance) |
| `g7-english-reading-evidence` | PASS | Not fully reviewed; synthetic passage | BLOCKED (governance) |

"Engineering PASS" = every row in the checks table below holds for that candidate.

## Checks performed (independently, not from T2's summary)

| Check | Result |
|---|---|
| Package files | 49 on disk = 6 × (manifest + 7 files) + `generation-receipt.json` |
| File hashes | 42 manifest `files` hashes + 6 manifest hashes in the receipt: 48/48 match; package digests equal receipt |
| Deterministic rerun | Deleted `drafts/4.0.0-draft.4/` and regenerated from an empty tree with T2's script on the integration head: all 49 files byte-identical (`git status` clean) |
| Factory authorship | 0 of 39 scenes and 0 of 43 blocks identical to T1 fixtures; author reads only `lesson.{key,grade,subject,objectives}` metadata; `modelCalls: 0`, deterministic executor (not an LLM) |
| Ownership | T1 since `1268773a6`: 5 frontend files only. T2: factory/curriculum/scripts/docs only. Shared registry and models unchanged by both |
| Contract | All six parse as `candidate-lesson-v2/1.1.0`, validate against `teaching-blocks/1.1.0`; rebuilding each learner experience from `candidate.json` through the frontend's `v4LearnerProjection` equals the shipped `learner-projection.json` (6/6) |
| Governance flags | All manifests DRAFT, unapproved, unpublished, unreleased, not learner-deliverable, REVIEWER_ONLY |
| Protected answers | No answer-key/rubric/teacher/scoring/protected keys in any learner payload; `governedItems: []`; assessment scene shows no items. `formativeKey` values are in the payload by design (formative feedback, never evidence) — a determined learner can read practice answers, not assessment answers |
| Assessment boundary | Mastery scene = ASSESSMENT_HANDOFF only, no teaching blocks; Finish completes with 0 POST/PUT/PATCH/DELETE |
| Browser journey | 11 runs (6 lessons @1440 + geometry @360/390/768/1024/1920): 11/11 finished, 74/74 scenes completed, Continue gated on every block scene, 0 page errors, 0 writes, 0 raw TeX, 0 horizontal overflow; only fixture-harness requests |
| Geometry learner journey | See it (scaled 8×5 grid, 6/4 triangle with right-angle marker) → worked solutions (MathML) → guided (wrong-answer and wrong-unit feedback, explanation after attempt) → independent (no hints; explanation hidden after one wrong attempt) → mistake analysis → transfer (12×6 floor, doorway: 72 m², 34 m) → assessment handoff |
| Geometry arithmetic | Recomputed: 40/26, 12/16 (3-4-5), 36/26, 77/36, 60/36 (5-12-13), 72/34 — all keys correct |
| axe WCAG 2.1 A/AA | 39 scans, 0 violations, 11 incomplete (manual) |
| Focus audit | Every visible control named and focusable; the only `tabindex=-1` is the scene heading focus target (intended) |
| `tsc --noEmit` | exit 0 (integration head) |
| Vitest | learning-v4, content-factory-v4, curriculum-v2, content-factory, learner-experience, assessment-v2: 44 files passed / 1 skipped; 1341 tests passed / 17 skipped |
| `next build` | exit 0; `/lab-review/v4-lessons` and `/[key]` built as dynamic routes (prototype-gated). Run without `prisma generate` (shared client, no schema change) |
| Fullscreen Slides regression | 7 viewports incl. 390×844 wide-font pass: exact text/order, no clipping, stable pagination, Read unchanged |
| Historical data | No `prisma/**`, `review-packages/**`, `curriculum/excellence/**`, first-three/first-ten or V0.2.1 paths changed vs main |

## Manual accessibility — not covered by automated axe (open)
- 11 axe "incomplete" results need human review (mostly colour contrast over images/gradients).
- No screen-reader pass yet (NVDA/Narrator, VoiceOver): MathML speech, map tiles, live feedback regions.
- Reduced motion verified only by emulation; no physical phone/tablet; no cold-offline or reconnect run.

## Findings

| ID | Sev | Owner | Finding |
|---|---|---|---|
| R7 | P1 | T2 (loader) + T1 (route) | The Next review route `/lab-review/v4-lessons` serves only T1's hand-authored fixtures. The factory packages render only in the Vite fixture harness. Required: T2 adds a factory-package source to `lib/curriculum/v4/preview.ts` that verifies the manifest hash before loading `candidate.json`; T1 labels rows "Factory-generated 4.0.0-draft.4" vs "Hand-authored fixture" in `app/lab-review/v4-lessons/**` |
| F1 | P2 | T2 | `scripts/content-factory-v4-browser.cjs` hash-pins T1's driver at `1268773a6`; T1 changed it in `5ab80a3ad`, so it throws `frontend_driver_changed_review_adapter` on the integrated head. Re-pin, or depend on a stable driver export from T1 |
| G-1 | P2 | T2 | Guided triangle (base 6, height 4, sides 5/5) is identical to the worked example just above it, so guided practice copies worked answers |
| G-2 | P2 | T2 | Numeric prompts say "Explain why their units differ", but the block has no explanation field |
| G-3 | P2 | T2 | Boilerplate `learnerAction` on 5/7 scenes; one generic misconception id for every item; mistake-analysis distractor ("method already matches") is trivially wrong |
| G-4 | P3 | T1+T2 | Renderer shows its model-derived numeric feedback, not the authored `misconceptions[].feedback` text. Both are correct; confirm which is intended |
| C-1 | P2 | T2 (content) | Civics objective says "locate each county on an outline map", but the visual is a tile schematic labelled "not a survey map". Shared with T1's fixture |

## Reproduce
From `.task-worktrees/v4-integration` (node_modules junctioned):
`node e2e/cos-v4-qa/run.cjs` (port 3211 → `artifacts/cos-v4/browser/`), `npx tsc --noEmit`,
`npx vitest run <suites above>`, `npx next build`, `node e2e/fullscreen-slides-v2/run.mjs`.
