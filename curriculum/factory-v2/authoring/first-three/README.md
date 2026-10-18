# First three authoring input templates

These are empty authoring inputs, not lessons or candidate outputs. Every resource payload and author identity is null. They stay DRAFT, REVIEWER_ONLY, unapproved, unpublished and unreleased. Work continues on the existing `feat/content-factory-ten-candidates` branch and worktree.

| Source lesson | Subject | Template |
| --- | --- | --- |
| `wk_mca7a_fri_p4` | G7 CIVICS | [wk_mca7a_fri_p4.input-template.json](wk_mca7a_fri_p4.input-template.json) |
| `wk_mca7a_fri_p3` | G7 SCIENCE | [wk_mca7a_fri_p3.input-template.json](wk_mca7a_fri_p3.input-template.json) |
| `lesson_mca_1` | G7 MATH | [lesson_mca_1.input-template.json](lesson_mca_1.input-template.json) |

The baseline is `9628d97f6932ae4c0c399ec15455230e3f76607e`, spec SHA-256 `9b0128d725b83dc8ca6aaad818530b35c0649297fa7564b8fae8fb53a6d00964`. Source IDs, revision IDs, revision numbers, snapshot hashes and subjects are fixed. Civics stays distinct. `requirements.json` copies the required misconception IDs, media descriptions, retention prompts and end-of-lesson task definitions from that exact specification. It contains no newly authored teaching content. Changes from Curriculum Excellence's current work need a separately versioned requirements update, not a silent repin.

## Fill the authored copy

Copy a template into restricted authoring storage before adding protected keys, rubrics or source material. Do not commit those completed restricted copies as public learner content.

1. Set `inputState` to `AUTHORED_DRAFT`. Leave the DRAFT/reviewer-only and false approval/publication/release fields unchanged.
2. Fill `authors` for roles that own resources with real author agent/session/model-family identities. Keep `INDEPENDENT_QUALITY_REVIEWER` and `GOVERNANCE_RELEASE` null. This is the existing AI-author interface; human review is a separate governed step.
3. Fill each `resources[].payload` using the existing owner contracts below. Preserve resource IDs, versions and roles, or deliberately update the blueprint and input resource set together. The input version must match `blueprint.version`.
4. Complete `misconceptionBindings`, add the corresponding `blueprint.misconceptions` entries, and bind each to an actual lesson scene, objective and protected assessment item/signal. All original misconception IDs are required.
5. Complete every `rubricBindings` entry against an actual protected rubric scoring spec. Preserve the original independent task IDs, kinds, scoring, objectives and unassisted end-of-lesson timing. Item identities in the blueprint must resolve to actual items; planning item IDs are not keys or authored items.
6. Complete every `mediaSpecifications` entry with scene/resource references, implementation mode, alt text, keyboard path, offline fallback, provenance and license. Static media also need `mediaId`, MIME type and matching actual `assets` bytes/hash/provenance. Audio/video specifications require transcripts. Specifying an interaction does not create a governed runtime or grant access to one.
7. Map each numbered `retentionChecks.items[]` requirement to real items in the RETENTION assessment resource. Keep assistance NONE, a matching delayed-retrieval task and at least the required seven-day delay. Include the separate NEW-context transfer task and optional extension already planned in the blueprint.
8. After editing the blueprint, recompute its hash. Use owner hash/seal functions for changed assessments and activities. Hashing records content identity; it grants no approval.

## Payloads and protected fields

| Resource kind | Exact payload wrapper | Owner contract / validation |
| --- | --- | --- |
| LESSON | `{ "kind": "LESSON", "candidate": CandidateLessonV2 }` | `lib/curriculum/v2/contract.ts`, `parse.ts`. Scenes include instructional content, interactions, formative feedback, hints, scaffolding, accessibility, offline behavior and misconception references. Approval fields, summative keys and rubrics are forbidden inside lesson candidates. |
| QUIZ, SUMMATIVE, RETENTION, TRANSFER | `{ "kind": "ASSESSMENT", "definition": ..., "form": ..., "items": [...], "specs": [...] }` | `lib/assessment/v2/parse.ts`, `types.ts`, `validator.ts`. `specs` is protected reviewer-only material. Put keyed answers and analytic rubric criteria/levels here, not in lesson scenes or learner previews. |
| CLASSWORK and other activities | `{ "kind": "ACTIVITY", "definition": ActivityDefinitionV1 }` | `lib/activity-definition/v1/types.ts`, `validator.ts`, `hash.ts`. |
| DESIGN_NOTE, WORKSHEET, ANSWER_KEY, RUBRIC, EXTENSION and other documents | `{ "kind": "DOCUMENT", "title": ..., "sections": [{ "heading": ..., "text": ... }], "textAlternative": ..., "keyboardPath": ..., "offlineInstructions": ..., "references": [...] }` | `lib/content-factory/v2/quality.ts`. References must be planned hash dependencies. ANSWER_KEY and RUBRIC resources remain REVIEWER_ONLY. These indexes do not replace the protected assessment scoring specs. |

Reusable hashing helpers are `sealBlueprint` in `blueprint.ts`, `sealDefinition`, `sealItem(item, protectedSpec)` and `sealForm` in `lib/assessment/v2/hash.ts`, and `hashActivityDefinition` in the activity owner. No second lesson, assessment or rubric format is introduced. The new envelope only adds transport and requirement bindings around the existing canonical payloads.

## Exact validation commands

Run from the existing factory worktree. These commands read inputs and print results. They do not call an author, invoke a provider, write a package, grade, approve or publish. No factory execution flag is needed for validation-only reads.

```powershell
Set-Location C:\liberia-learn\.task-worktrees\content-factory-ten

# Bundle the read-only validator using the already-installed esbuild.
# This also avoids the known local Windows tsx user-info startup error.
node -e "require('esbuild').buildSync({entryPoints:['scripts/content-factory-v2-validate-authoring.ts'],bundle:true,platform:'node',format:'cjs',packages:'external',outfile:'artifacts/content-factory-v2/ten-validate-authoring.cjs'});"

$authoringTemplates = @(
  'curriculum/factory-v2/authoring/first-three/wk_mca7a_fri_p4.input-template.json'
  'curriculum/factory-v2/authoring/first-three/wk_mca7a_fri_p3.input-template.json'
  'curriculum/factory-v2/authoring/first-three/lesson_mca_1.input-template.json'
)
node artifacts/content-factory-v2/ten-validate-authoring.cjs --template @authoringTemplates

# Run on a completed restricted authoring copy, not on the empty template.
node artifacts/content-factory-v2/ten-validate-authoring.cjs --blueprint-hash <authored-input.json>
# Paste the printed blueprintContentHash into blueprint.contentHash after deliberate plan edits.
node artifacts/content-factory-v2/ten-validate-authoring.cjs --authored <authored-input.json>
```

`--template` validates the schema, exact source bindings, resource/requirement sets, original independent-task contract, and retention delay. It also lists unfilled authoring slots. Passing template validation does not mean content is authored. `--authored` requires completed slots and reuses strict owner parsing, artifact/package hashes, protected-item/form/key/rubric closure, independent assessment checks, misconception bindings, retention items, actual asset hashes, accessibility and delivery checks. Empty templates intentionally exit 1 in authored mode.

After authored validation passes, this read-only conversion prints the existing `staticBatchExecutors` role map. It copies authored content; it does not create academic content or release it:

```powershell
node artifacts/content-factory-v2/ten-validate-authoring.cjs --generation-json <authored-input.json>
```

The output includes protected scoring specs. Save it only in restricted storage using UTF-8 without BOM, then compute the exact file hash for the eventual batch generation pin. A template or invalid authoring package cannot be converted. The remaining source/media/blueprint/actor metadata must also be bound into the existing batch contract; generation JSON alone is not a runnable or approved batch. The [governed partial-batch runner](../../../../docs/architecture/content-factory/CONTENT_FACTORY_PARTIAL_BATCH.md) can now consume completed authoring envelopes directly, without a separate generation-JSON export.

## Verified coverage and missing requirements

The schemas support the required lesson content, protected Assessment V2 forms/items/scoring specs, analytic rubrics, explicit misconception teaching/probe bindings, retention checks, media specifications, accessibility/fallback declarations and actual currently supported asset bytes. No academic lesson, assessment answer, rubric descriptor, visual asset or production candidate was authored to prepare these templates.

Outstanding content is deliberately null: lesson/resource payloads, real author identities, protected assessment items and scoring specs, rubric bindings, misconception bindings, retention item bindings, and media implementations/assets/provenance/licensing. Curriculum Excellence owns that content.

Execution limits remain separate:

- The original full-batch runner still requires ten lessons. The governed partial-batch runner accepts an explicit authored subset of that same unchanged manifest; it does not create an alternate cohort or placeholders for the remaining lessons.
- The partial-batch draft-review path verifies pinned local export integrity while retaining missing production/acceptance attestations as release blockers. Accepted production-inventory and later independent/qualified review gates remain. Current blueprint inventory pins describe the raw local export.
- The Civics spec requests SVG. Media specifications can record `image/svg+xml`, but the existing executable asset contract accepts only PNG, JPEG, WebP and text. SVG byte ingestion/rendering still needs an adapter and review. No silent raster substitution is authorized here.
- The requested particle simulation, fraction manipulatives and other interactive media need governed runtime bindings or an owner-reviewed fallback implementation. A media specification is not an executable lab. Fallback-only delivery does not silently waive primary-media requirements.
- This author interface uses existing AI actor identities; it does not record qualified human approval. Review-role identities and approval assertions are rejected from authoring submissions.

Every result reports `generatedCandidates: 0`, `readyForFactoryExecution: false`, `approved: false` and `released: false`. Even a valid authored draft remains unpublished.

Validation performed: 172 factory/assessment/excellence integration tests passed; all 14 final authoring-input regressions and focused TypeScript compilation passed. `validate:changed --no-types` passed its policy audit, 14 direct tests and 39 related tests, with existing unrelated graph-inspection warnings. The CLI accepted all three templates, refused authored submission and generation conversion for each, and left their file hashes unchanged. No academic payloads or production candidates were generated.
