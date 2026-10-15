# Grade 7 Native Curriculum and Teaching Experience V1

Status: **candidate packages ready for qualified human review. Not approved, not released, publication disabled.**

This record covers the first two native Grade 7 lesson candidates:

| Lesson | Candidate | Replaces (later, if approved) |
| --- | --- | --- |
| Number Sense and Place Value: Millions to Thousandths | `curriculum/v2/g7/candidates/math-number-sense-place-value.json` | `math-g7-1-number-sense-and-place-value-foundations` |
| Understanding Essay Writing: Structure and Argument | `curriculum/v2/g7/candidates/literacy-essay-structure-argument.json` | `hero-literacy-g7-essay-writing-structure-and-argumentation` |

Reviewer packages: `curriculum/review/g7-native-v1/` (generated; see its README).

## What was reused, not rebuilt

- **Lesson contract**: `CandidateLessonV2` (`lib/curriculum/v2/contract.ts`), the strict parser, the deterministic validator and the deliverability matrix, all unchanged in behaviour.
- **Learner projection**: `toLessonExperience` (`lib/curriculum/v2/compat.ts`). Its input type was widened to the fields it already read, so a candidate with no release (`releaseId: null`) can be projected. The validator's context type was widened the same way. Neither change alters existing behaviour (the G4 package regenerates byte-identically).
- **Player and preview**: Lesson Player V2 in the existing dev-only route `/lab-review/experience/[experienceId]` (404 in production builds and on Vercel; requires `LAB_REVIEW_HARNESS=1`).
- **Review package format**: the scene renderer from `reviewPackage.ts`, extracted as `sceneDetailLines` and shared.
- **Release rules**: `validateReleaseManifest` and `validateOntologyRelease` (`lib/learning-authority`).
- **Item shape**: candidate exit-ticket items use `GovernedItem`, so a future release can bind them unchanged.

No new lesson engine, curriculum authority, scorer, mastery writer or completion authority was introduced.

## Why the candidates are not assembled into `curriculum-lesson-v2`

Assembly requires a pinned authoring context: structured MOE objective → governed template cell → ontology release. For these lessons none exists:

1. **No MOE Grade 7 objective.** The structured MOE source has no Grade 7 Math objective on place value. The closest are Grade 4 numeration objectives (built on) and the Grade 7 decimals, percents and fractions objectives (which depend on this lesson). For Grade 7 English, paragraph writing appears in the MOE source (English 7-9 p.4), but the structuring parser filed it as ACTIVITY items under period I. Argumentative composition ("develop and defend a point of view") is a Grade 9 MOE objective (p.32).
2. **No Grade 7 template cell** (`lib/learning-authority/cells` holds Grade 4 Math only).
3. **No Grade 7 ontology release** (`curriculum/releases/k12-scope.json` registers only the Grade 4 fractions release).

Inventing any of these would be fabricated authority. Instead, each lesson carries provisional LiberiaLearn objectives (`basis: LIBERIALEARN_CANDIDATE`), exact MOE relationships (BUILDS_ON / PREREQUISITE_FOR / SOURCE_TEXT_UNSTRUCTURED / LATER_GRADE_SCOPE, each quoting verbatim source text), and BLOCKING review gaps that name what must be supplied.

## Legacy provenance

The legacy rows are production database rows with learner history: 18 LearningEvents, 1 ScheduledWork and 1 lesson plan for the math row; 42 ScheduledWork rows and 1 LearningEvent for the essay row. They were never modified. Their metadata (pk, revision id, unit, status) comes from the read-only cleanup snapshot (`artifacts/curriculum-cleanup-v1/snapshot.json`, captured 2026-09-26). Every scene's instructional decision is in the revision ledger (`lib/curriculum/v2/g7NativeReview.ts`). The math lesson preserves, and tracks revisions to, the Student Experience V3 DEMO material (`components/experience/demo/PlaceValueDemo.tsx`).

### Legacy body comparison (2026-10-15)

The legacy bodies were read once from production with `scripts/extract-g7-legacy-revisions.ts`: a single transaction opened `SET TRANSACTION READ ONLY` (the script aborts unless Postgres reports `transaction_read_only = on`), selecting lesson content, provenance and revision columns only. User, author, editor and school identifiers were not selected. Nothing was written. The extracts are pinned in `artifacts/g7-native-curriculum-v1/legacy/`.

| Legacy row | Revision | Result |
| --- | --- | --- |
| `math-g7-1-number-sense-and-place-value-foundations` | `cmss8t4hz00unvo54epnfst66` (only revision, current, BACKFILL_SNAPSHOT) | Found. Stored hash `93cc9003…` recomputes exactly; the live row still equals the revision. |
| `hero-literacy-g7-essay-writing-structure-and-argumentation` | `cmss94dmc03b7vo54ryf3hqk1` (only revision, current, BACKFILL_SNAPSHOT) | Found. Stored hash `3809f982…` recomputes exactly; the live row still equals the revision. |

The comparison is in `lib/curriculum/v2/g7NativeLegacy.ts` (reviewer only) and is rendered per lesson as `legacy-comparison.md` / `.json` in the review package: evidence table, section-by-section matrix, objective and assessment differences, concerns in both lessons, corrective recommendations, the open alignment decision with options, and sign-off fields. The blocking gap `LEGACY_BODY_NOT_COMPARED` is replaced by `LEGACY_COMPARISON_SIGNOFF`: a qualified reviewer confirms the comparison and decides each recommendation.

Main findings:

- **Math**: the legacy body is a template shell with no mathematics (no numbers, examples, questions or answers) and is aligned to an unrelated standard (Pythagorean theorem). Its only concrete material, an offline lab using cassava, leaves and stones as hundreds, tens and ones, stops at hundreds and uses non-proportional tokens. Nothing from the body needs restoring; the lab's hands-on intent and the home connection are offered as adapted restorations. The repository's MOE math text never mentions millions at any grade, so the candidate's millions range is a LiberiaLearn extension (decision A-M1).
- **Literacy**: the legacy lesson is long and above Grade 7 reading level, and contains teaching errors (thesis and topic sentence given to one paragraph, a wrong error-analysis rule about relevance, a model conclusion that adds new points) and unsourced figures presented as evidence. None of that is restored. Sound legacy methods (brainstorm before writing, peer review, writing introductions and conclusions) are offered as adapted restorations. The comparison also found a candidate problem (model evidence written as the learner's own real experience in a lesson that forbids invented evidence) and recommends a revision. The Grade 7 MOE paragraph objectives sit on p.4 as period II and are misfiled as ACTIVITY items under period I; argumentative writing is Grade 9 (decision A-L1).
- Two recommendations were applied because they touch reviewer-facing text only: an unsourced claim about PEEL was removed from the revision ledger, and the Grade 7 paragraph reference now names the misfiled structured item. Candidate lessons, learner projections and their hashes are unchanged.

To refresh the evidence (read-only, needs `DATABASE_URL`): `npx tsx scripts/extract-g7-legacy-revisions.ts`, then regenerate the package.

### Instructional refinement V2 (candidate v0.2.0)

The candidates were revised to apply the comparison's recommendations. The production extracts and the comparison baseline (candidate hashes at commit `4fdd897c`, recorded in `G7_LEGACY_COMPARISON_BASELINE`) are unchanged. Each `legacy-comparison.md` shows both the baseline hash and the current hash.

| Lesson | Change | Recommendation |
| --- | --- | --- |
| Math | New `counter-chart` (after `build-number`): pairs use identical counters in labelled columns from millions to thousandths, exchange ten for one, build 2,050,316.47 and read each other's numbers. Tally marks replace counters when none are available. | R-M1 |
| Math | New `home-practice` (last scene, REFLECTION): a device-free task to find a large number and a decimal, chart them, and explain digit values to a family member. It works even when the family member does not read. | R-M2 |
| Math | The millions range is recorded as `ext-g7-math-whole-numbers-millions` (PROPOSED_LIBERIALEARN_EXTENSION, PENDING_CURRICULUM_OWNER). The new blocking gap `SCOPE_EXTENSION_UNAPPROVED` lists the scenes and exit items that use it, and its fallback if it is not approved. | C-M1, A-M1 |
| Literacy | Illustrative evidence is attributed to Musu's school, which the `evidence` scene says is a made-up practice school (not facts). This changes `peel`, `evidence`, `evidence-check`, `order-paragraph` and `write-argument`. Exit item `g7-essay-exit-3` moves to `candidate-0.2.0`. | R-L1 |
| Literacy | New `plan-argument` before `write-argument`: brainstorm, choose two reasons, and attach real evidence and its source to each. `write-argument` now writes from the plan. | R-L2 |
| Literacy | New `write-conclusion` on the model garden plan, which must add no new reasons. | R-L3 |
| Literacy | New `peer-review`: four PEEL questions, one strength and one next step; learners working alone review their own paragraph. | R-L4 |
| Literacy | A paragraph-centred alternative (A-L1 option A) is **prepared, not applied**. It covers objectives, the impact on each scene and each exit item, and the binding path, and it is listed in `legacy-comparison.md`. The candidate keeps its objectives and grade scope until the authority decides. | A-L1 |

The existing decimal, comparison and number-building scenes are unchanged. The browser walkthrough at 1440 px and 390 px gave these results:
- 16/16 math scenes and 17/17 literacy scenes completed;
- Continue was gated on every interactive scene;
- no horizontal overflow and zero console errors;
- every finish recorded RAW_OBSERVATION evidence only.

Captures are in `artifacts/g7-native-curriculum-v1/screenshots/`, with `flow.json`.

### Curriculum Excellence V1 corrections (candidate v0.3.0)

The v0.2.0 candidates were reviewed against Curriculum Excellence Standard V1 (`docs/curriculum/excellence/`). That AI review is advisory, and it is not independent, because the reviewer shares a model family with the author. Its report is kept, pinned to commit `1ad2e9ec`, in `curriculum/excellence/g7-v0.2.0/`. The corrections below were then applied to the candidate sources.

The same agent wrote these corrections, so it may not review them. On v0.3.0 only the deterministic checks run (`curriculum/excellence/g7-v0.3.0/`), and its AI judgment review is recorded as refused (`SELF_REVIEW_PROHIBITED`). Every correction waits for an independent qualified reviewer.

| Lesson | Correction | v0.2.0 finding |
| --- | --- | --- |
| Math | Catalogue adds `mc-place-shift`, `mc-shorter-decimal-bigger` and `mc-compare-by-digits`, taught in `ten-times`, `misconceptions` and `compare-strategy`. Remapped: exit-1 options 0/1/3, exit-2 options 1/2 and exit-4 option 1 to place shift; exit-6 option 0 to compare-by-digits. Exit-5 option 2 is replaced with "0.307, 0.37, 0.3" (shorter-is-greater; item `candidate-0.3.0`), and exit-5 option 0 and exit-6 option 2 are unmapped. Every mapping with a machine verification now matches its error model. | 10 mapping findings, ai-m2, ai-m3 |
| Math | `warm-up` is now a readiness check, with one item per prerequisite (adds 7 × 1,000; 5,384 → 45,384) and a teacher route for learners who miss one. | prerequisite findings, ai-m5 |
| Math | New `reason-it-out`: two unscaffolded written explanations with no hints. | ai-m1, BP-REASONING |
| Math | New optional `challenge` (the digits closest to 4) placed before the review, plus a progression key idea in `review` (decimals → fractions and percents). R-M3 is applied as a candidate. | GE-EXT-1 |
| Literacy | Catalogue adds `mc-explain-restates-evidence`, taught in `peel`, with exit-5 option 3 remapped to it. Exit-1 option 3 is unmapped. | ai-l3, ai-l4 |
| Literacy | New `readiness-writing`: the paragraph and two-sides prerequisites are diagnosed by production, with routes. | ai-l5 |
| Literacy | New `write-independently`: an unscaffolded second thesis and PEEL paragraph. New optional `challenge`: a five-paragraph essay. | BP-INDEPENDENT-PRACTICE, GE-EXT-1 |
| Literacy | Exit items 1, 4 and 5 are diagnostic-only (still asked, not mastery evidence). The candidate rubric adds a counterargument criterion and an Explain-restates-evidence descriptor. R-L6 is applied as a candidate. | ai-l1, ai-l2 |
| Both | Candidate assessment definitions (`curriculum/v2/g7/assessment-definitions/`, reviewer only) cover prerequisite diagnostics with fallback routes; constructed, reasoning and original-writing mastery tasks with keys or scoring guides; delayed retrieval at 7 and 21 days; a transfer task in a new representation or genre; and an optional extension. They are listed in `assessment-review.md`. Nothing scores them or writes mastery from them; they are teacher-administered until reviewed and released. | BP-PRODUCTION, BP-RETENTION, BP-TRANSFER, BP-SELECTED-SHARE |

Automated checks on v0.3.0:

- No blocking or major findings.
- All nine blueprint rules are met in both lessons. Selected response is 55% of Math and 43% of Literacy end-of-lesson mastery evidence.
- Every blocking or major deterministic v0.2.0 finding no longer fires.

What remains open:

- Minor items: unmapped distractors where no catalogued error produces the option, and hints and worked examples carried on exit items, which must be withheld until after the scored response.
- The millions scope decision, A-M1 (`ai-m4`, OPEN_CURRICULUM_OWNER_DECISION).
- The Literacy grade scope, A-L1.
- The structuring defect in the MOE source.
- The authority gaps listed above.

No layer of the standard is attained, because judgment and human criteria have not been rated.

## Learner and reviewer separation

- `g7Native.ts` (learner-safe): registry, objectives, provenance, validation, learner projection. It never imports reviewer material.
- `g7NativeReview.ts` (**reviewer only**): exit-ticket keys, hints and worked examples, the writing rubric, the revision ledger.
- `g7NativePreview.ts` (dev preview, server only): shows exit-ticket prompts and options with every key stripped.
- A test checks that no `app/` or `components/` file, and no learner-facing module, imports the reviewer or preview modules.
- In production the delivery seam (`lib/lessons/lessonExperienceDelivery.ts`) also strips formative keys (`feedbackAuthority: SERVER_REQUIRED`). The local formative keys in the learner projection follow the Phase A player design for previews.

## Evidence integration handoff (Phase 5)

How an approved exit ticket will reach the canonical evidence pipeline, all through existing code:

1. **Release**: a qualified reviewer approves the items in `assessment-review.json`. A Grade 7 ontology release binds them (`CurriculumConstructBinding`: item id + version → concept, skill, standard, evidence policy, tool policy). `release-binding.json` lists the proposed shapes, with every authority-only field marked `REQUIRED_FROM_AUTHORITY`.
2. **Assembly**: with a cell and release, `assembleCurriculumLessonV2` resolves `governedItems` for the `ASSESSMENT_HANDOFF` scene. The learner projection then carries learner-safe item refs (prompt and options, no keys).
3. **Delivery**: `GET /api/student/lessons/:id/experience` serves the projection. The mastery scene is `ASSESSMENT_PLAYER_V2` with `scoring: SERVER_AUTHORITY`.
4. **Collection**: Lesson Player V2 builds an `experience-evidence-envelope/1.0.0`. Mastery responses carry `selectedAnswerIndex` only, with `masteryMutation: false` and `nextActionAuthority: LEARNING_ORCHESTRATOR`.
5. **Admission**: `adaptEnvelope` (`lib/learner-experience/evidenceAdapter.ts`) recomputes authority, disposition and objectives from the server's copy. A MASTERY_RESPONSE becomes `SUBMIT_TO_ASSESSMENT_AUTHORITY` only for an APPROVED_RELEASE lesson. Until then every observation is `RAW_OBSERVATION`.

Candidate-side contracts implemented and tested here: the item shape, objective and misconception mapping per item, machine verification of every math key, keyless preview items, and the envelope produced by the preview (all observations raw, mastery responses unscored, every objective evidenced). In-lesson writing stays formative (FREE_RESPONSE with a teacher rubric), because Assessment Player V2 has no constructed-response item type. That is recorded as a product gap, not worked around. From v0.3.0, the end-of-lesson writing and reasoning tasks are reviewer-only candidate assessment definitions with a candidate rubric. A teacher scores them on paper. No platform scorer, mastery writer or release reads them, and a test checks that only the reviewer module and the package generator do.

## Regenerate and validate

```
npx tsx scripts/build-curriculum-v2-g7-native.ts          # rewrite the review package
npx tsx scripts/build-curriculum-v2-g7-native.ts --check  # fails when stale
npx vitest run __tests__/curriculum-v2/g7-native.test.ts
LAB_REVIEW_HARNESS=1 npx next dev -p 3197
node e2e/g7-native/capture-g7-native.cjs http://localhost:3197 artifacts/g7-native-curriculum-v1
```

Browser evidence is in `artifacts/g7-native-curriculum-v1/`: 82 screenshots and `flow.json` (recaptured for candidate v0.3.0). Both lessons were walked end to end in Lesson Player V2 at 1440 px and 390 px. Results:

- all scenes completed (18 math, 20 literacy); every interactive scene kept Continue disabled until the learner acted;
- all 8 diagrams rendered;
- no horizontal overflow at 390 px (also checked at 320 px);
- zero console errors;
- every finish recorded only `RAW_OBSERVATION` evidence.

The capture blocks service workers, so the dev-only "app update" toast cannot cover lesson controls. Blocking them also makes the shell show an "Offline support could not start" toast. From v0.3.0 the capture hides that toast, because it covered the last answer choice of the four-item misconceptions scene. Full-page phone captures repeat the fixed header and footer part-way down; that is a screenshot artifact.

### Player and preview fixes found by the walkthrough

- **Outline overflow (all lessons, desktop)**: `.ll3-outline-list` was a grid with an auto-sized column, so long scene titles grew past the 208 px outline and covered lesson content and answer choices. Fix: `grid-template-columns: minmax(0, 1fr)` in `app/learning-v3.css`.
- **Footer wrapping (lessons with 10 or more scenes, phone)**: "Scene 1 of 14" squeezed the footer until the Previous and Continue labels broke mid-word. Fix: footer buttons do not shrink or wrap, so the counter takes the space instead.
- **Candidate diagrams behind sign-in (dev preview)**: middleware sent unauthenticated requests for `/curriculum-candidates/*` to `/login`. Fix: added a dev-only public path, on its own line beside `/lab-review` and `/design-preview`. A test asserts production still redirects to sign-in.

## Next authorized actions

0. Have an independent reviewer (not the agent that wrote them, and ideally not its model family) review the v0.3.0 Curriculum Excellence corrections and candidate assessment definitions. Use `curriculum/excellence/g7-v0.3.0/` and the excellence section of each `reviewer-checklist.md`.
1. Assign a qualified Grade 7 Math reviewer and a qualified Grade 7 English reviewer. Each works through `reviewer-checklist.md` and records APPROVE, REVISE or REJECT through governed curriculum review against the candidate hash.
2. Each reviewer confirms the recorded legacy comparison (`legacy-comparison.md`, revisions `cmss8t4hz00unvo54epnfst66` and `cmss94dmc03b7vo54ryf3hqk1`) and decides every recommendation. Accepted candidate revisions (for example R-L1) are made in the candidate and the package is regenerated with new hashes.
3. The curriculum authority decides alignment decisions A-M1 (place-value scope) and A-L1 (essay grade scope), and corrects the Grade 7 English structuring defect through the source-structuring process.
4. After approval, author the Grade 7 template cells and ontology releases through their own governed process, assemble the candidates, and register the releases.
5. Only then, a separate authorized change may replace or repoint the legacy rows. That change must respect the learner history listed above.
