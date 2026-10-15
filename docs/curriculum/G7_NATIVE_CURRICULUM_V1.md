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

The legacy rows are production database rows with learner history: 18 LearningEvents, 1 ScheduledWork and 1 lesson plan for the math row; 42 ScheduledWork rows and 1 LearningEvent for the essay row. They were not read or modified. Their metadata (pk, revision id, unit, status) comes from the read-only cleanup snapshot (`artifacts/curriculum-cleanup-v1/snapshot.json`, captured 2026-09-26). The authoring session had no database access, so the legacy **body** was not compared. Every scene's instructional decision is in the revision ledger (`lib/curriculum/v2/g7NativeReview.ts`), and comparison against the named legacy revision is a blocking reviewer task. The math lesson preserves, and tracks revisions to, the Student Experience V3 DEMO material (`components/experience/demo/PlaceValueDemo.tsx`).

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

Candidate-side contracts implemented and tested here: the item shape, objective and misconception mapping per item, machine verification of every math key, keyless preview items, and the envelope produced by the preview (all observations raw, mastery responses unscored, every objective evidenced). Writing evidence stays formative (FREE_RESPONSE with a teacher rubric), because Assessment Player V2 has no constructed-response item type. That is recorded as a product gap, not worked around.

## Regenerate and validate

```
npx tsx scripts/build-curriculum-v2-g7-native.ts          # rewrite the review package
npx tsx scripts/build-curriculum-v2-g7-native.ts --check  # fails when stale
npx vitest run __tests__/curriculum-v2/g7-native.test.ts
LAB_REVIEW_HARNESS=1 npx next dev -p 3197
node e2e/g7-native/capture-g7-native.cjs http://localhost:3197 artifacts/g7-native-curriculum-v1
```

Browser evidence (screenshots at 1440 px and 390 px, `flow.json`) is produced by the capture script into `artifacts/g7-native-curriculum-v1/`. It was not captured in the authoring run: the production build was stopped by the host for low memory before the dev preview could be started.

## Next authorized actions

1. Assign a qualified Grade 7 Math reviewer and a qualified Grade 7 English reviewer. Each works through `reviewer-checklist.md` and records APPROVE, REVISE or REJECT through governed curriculum review against the candidate hash.
2. A reviewer with read access compares each candidate with its legacy revision (`cmss8t4hz00unvo54epnfst66`, `cmss94dmc03b7vo54ryf3hqk1`).
3. The curriculum authority decides the objective basis and the essay grade scope, and corrects the Grade 7 English structuring defect through the source-structuring process.
4. After approval, author the Grade 7 template cells and ontology releases through their own governed process, assemble the candidates, and register the releases.
5. Only then, a separate authorized change may replace or repoint the legacy rows. That change must respect the learner history listed above.
