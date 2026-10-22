# V4 program coordination — Interactive Learning V4 + Content Factory V4

Owner: Chief of Staff session. Opened 2026-10-21. Baseline main `887f23eccbe5b194c2e7ff93c0b09c843549a9eb`.
Live status lives in `V4_PROGRAM_STATUS.md`; this file holds the rules that change rarely.

## 1. Workstreams

| Terminal | Workstream | Branch | Worktree |
|---|---|---|---|
| T1 Claude | Interactive Learning Experience V4 | `feat/interactive-learning-v4` | `.worktrees/learning-v4` |
| T2 Codex | Content Factory V4 | `feat/content-factory-v4-pipeline` | `.worktrees/content-factory-v4` |
| Chief of Staff | Coordination, QA, release readiness | `docs/v4-program-coordination` | `.worktrees/v4-coordination` (QA: `.task-worktrees/v4-qa`, detached) |

T2 starts from T1's foundation commit (`1268773a6`), not from main, so there is one
registry, one standard and one candidate set. One V4 release PR is assembled from
both branches; neither owner merges the other's branch.

## 2. Ownership boundaries (path-level)

An owner edits only its own paths. A change needed in another owner's path is a
change request recorded in the status doc, not a direct edit.

**T1 — frontend (render and interaction)**
- `components/experience/**` (incl. `teaching/v4/**`, `lesson.css`, `MathText.tsx`)
- `components/learner-experience/**` (Lesson Player V2, `SceneViews.tsx`)
- `lib/learner-experience/**` (math notation, teaching models, `progress.ts`, `sceneContract.ts`)
- `app/lab-review/v4-lessons/**`, `e2e/learning-v4/**`, `e2e/product-design-v2/**`
- Tests: `__tests__/learning-v4/{math-notation,teaching-models,v4-blocks-render}*`, `__tests__/learner-experience/**`

**T2 — factory (generation, validation, provenance)**
- `lib/content-factory/**` (blueprints, quality, batches)
- `lib/curriculum/v2/**` (contract, parse, validate, pipeline, compat)
- `lib/curriculum/v4/**` (`standard.ts`, `candidates.ts`, `preview.ts` data side)
- `lib/ai/prompts/**` (incl. `archive/curriculum.v2.lesson/1.1.0.ts`)
- `curriculum/v4/**`, `curriculum/review/v4-candidates/**`, `scripts/build-v4-review-manifest.ts`
- Tests: `__tests__/learning-v4/{v4-candidates,content-factory-v4}*`, `__tests__/curriculum-v2/**`, `__tests__/content-factory/**`

**Shared — registry contract (both must acknowledge every change)**
- `lib/learner-experience/teaching/registry.ts` and `lib/learner-experience/teaching/contract.ts`,
  `instruction.ts`, `models/*.ts` where a model's semantics feed `blockSemantics`.
- Editor of record: T1 (it renders the blocks). T2 proposes; T1 implements; both acknowledge.
- Test: `__tests__/learning-v4/registry-and-standard.test.ts` (either may add cases, neither removes).

**Never edited by either owner in V4**
- Content Factory V0.2.1 packages and every historical review package / candidate hash
  (`review-packages/**`, first-three / first-ten frozen artifacts, `curriculum/excellence/**` baselines).
- `prisma/**` schema and migrations; learner records; production or preview data.

### Transfer at the foundation commit
`1268773a6` was authored by T1 and includes factory-side work (curriculum V2 contract 1.1.0,
V4 standard, prompt 1.1.0, six candidates, manifest). From that commit forward those paths
belong to T2 per the table above.

**Collision C1 (open, 2026-10-21 17:3x):** both T1 (uncommitted, `.worktrees/learning-v4`) and T2
(uncommitted, `.worktrees/content-factory-v4`) are editing `lib/content-factory/v2/{blueprint,quality}.ts`
for the same `unit-blueprint/2.2.0` change. Resolution, per the boundaries above:
- T2 is the single implementer of `unit-blueprint/2.2.0`.
- T1 does not commit its `lib/content-factory/**` edits or `__tests__/learning-v4/content-factory-v4.test.ts`.
  Both are preserved byte-for-byte for T2 to reuse:
  `artifacts/v4-coordination/t1-unit-blueprint-2.2.0.patch` (sha256 `5e5250e1…68fc`) and
  `artifacts/v4-coordination/t1-content-factory-v4.test.ts` (sha256 `5b315032…5e35`).
  T1 then restores those two files to `1268773a6` in its worktree and removes the untracked test.
- T2 imports `V4_INSTRUCTION_STANDARD` from `lib/learner-experience/teaching/instruction.ts` instead of
  repeating the string literal (T1's patch also redefined it as `V4_INSTRUCTION_STANDARD_ID`; one constant only).

## 3. Versioned interface (the handshake)

Implementation that depends on the interface waits until both acknowledgements below are filled in.

| Contract | Version | Source of truth | Status |
|---|---|---|---|
| Visual Teaching Block Registry | `teaching-blocks/1.1.0` | `lib/learner-experience/teaching/registry.ts` @ `1268773a6` | FROZEN for V4 work |
| Candidate lesson | `candidate-lesson-v2/1.1.0` (1.0.0 unchanged) | `lib/curriculum/v2/contract.ts` @ `1268773a6` | FROZEN |
| Instruction standard | `liberialearn-v4-instruction/1.0.0` | `lib/curriculum/v4/standard.ts` @ `1268773a6` | FROZEN (T2 owns future revisions) |
| Generation prompt | `curriculum.v2.lesson@1.1.0` | `lib/ai/prompts/archive/curriculum.v2.lesson/1.1.0.ts` | FROZEN (archive is immutable) |
| Unit blueprint | `unit-blueprint/2.2.0` | T2 worktree, uncommitted (see C1) | IN PROGRESS — T2 only |
| Factory sidecar | `visual-teaching-block/4.0.0-draft.1` | `lib/content-factory/v4/visualTeachingBlock.ts` @ `db1790ad1` (T2) | PROPOSED — needs T1 ack |

The sidecar is factory-side metadata bound to block digests; it imports `BLOCK_SCHEMAS` and does
not add block types, so it is not a second registry. Points T1 must confirm when acknowledging:
- `feedback.reveal` (`NONE`/`MODEL`/`AFTER_ATTEMPT`) is a second feedback vocabulary next to the
  registry's `feedback` (`NONE`/`AUTHORED`/`MISCONCEPTION_LINKED`/`DERIVED_FROM_MODEL`). Either map one
  onto the other in the sidecar validator, or state that the sidecar value is reviewer-only and the
  renderer reads only the registry.
- `offline.mode` is fixed at `TEXT_PAPER_CAPTURE_ONLY` while the registry says every block renders
  from the cached lesson. Confirm the sidecar describes the paper fallback, not the online behaviour.
- T2's handoff names branch `feat/content-factory-v4-pipeline`; the real branch is `feat/content-factory-v4`.

What 1.1.0 fixes, so both sides read it the same way:
- 30 block types across MATHEMATICS / SCIENCE / HUMANITIES / LANGUAGE; each entry declares schema,
  semantic checks, subject/grade fit, accessibility (`textAlternative`, keyboard/touch), offline
  (renders from cached lesson only), feedback kind and provenance (`origin` for text sources).
- Every block is `FORMATIVE_ONLY`. No block scores, writes evidence or mastery. Mastery scenes carry
  no teaching blocks and hand off through `ASSESSMENT_HANDOFF` to Assessment Player V2.
- No `answer` / `solution` / `correct*` keys; formative expectations are `formativeKey`. The strict
  parser rejects generated `provenance` keys.
- `generationCatalogue(context)` is the only catalogue the factory brief may present to a model.

### Change rule
- Additive changes (new block type, new optional field) → `teaching-blocks/1.2.0`. T2 writes the
  proposal in the status doc (type, purpose, schema sketch, semantics, a11y, offline, feedback);
  T1 implements schema + renderer + tests; both acknowledge; then T2 generates against it.
- Breaking changes → `2.0.0` and need a founder decision.
- Known 1.2.0 candidates from T2's brief: `TIMELINE` (civics/history), reading annotation,
  vocabulary, and writing revision blocks. Until 1.2.0 is acknowledged, generate with existing
  types (`SOURCE_EVIDENCE`, `SEQUENCE`, `READING_PASSAGE`, `SENTENCE_BUILDER`, `WRITING_ORGANIZER`).

### Acknowledgements
Each owner appends one line: terminal, contract versions, commit read, date.

- T1: _pending_
- T2 Codex: teaching-blocks/1.1.0, candidate-lesson-v2/1.1.0, liberialearn-v4-instruction/1.0.0 and curriculum.v2.lesson@1.1.0 acknowledged unchanged at 1268773a649fd3d570450ec15c8d5c9eb93d0cf2; read T1-ACK-FRONTEND-CONTRACT.md including feedback mapping and paper-fallback distinction. Sidecar visual-teaching-block/4.0.0-draft.1 remains reviewer-only. Sole implementer of unit-blueprint/2.2.0; importing the shared V4_INSTRUCTION_STANDARD. Actual active branch is feat/content-factory-v4-pipeline in .worktrees/content-factory-v4, contract checkpoint db1790ad1; feat/content-factory-v4 is the unused initial branch at baseline. Both acknowledgments are now present. 2026-10-21.

## 4. Shared evidence checklist (per reference lesson)

A lesson is READY only when every row has evidence (test name, capture path or reviewer note).

| # | Area | Evidence required | Owner |
|---|---|---|---|
| E1 | Academic accuracy | Facts, definitions and examples checked against the pinned source or flagged `SYNTHETIC_DEMONSTRATION`; Liberia-specific facts (counties, capitals) checked against an authoritative list | T2 + CoS review |
| E2 | Mathematical correctness | Registry semantics pass (`blockSemantics`); every worked solution and `formativeKey` recomputed by the model functions; notation renders as MathML, not raw TeX | T2 (data), T1 (render) |
| E3 | Instructional design | V4 standard passes with no ERROR/BLOCKING; worked → guided → independent → transfer present; retention item scheduled; no decorative interaction | T2 |
| E4 | Visual quality | Desktop 1440, tablet 1024, phone 390 captures; no overflow/clipping; tools drawer behaviour below 1280px | T1 |
| E5 | Interaction | Keyboard-only, touch and pointer paths complete each block; feedback shown for right, wrong and misconception answers; Continue gated by position state only | T1 |
| E6 | Accessibility | axe clean on each scene; screen-reader text equivalent for each block; MathML speaks; reduced-motion honoured | T1 + CoS |
| E7 | Protected answers | Learner projection contains no `formativeKey`/assessment keys beyond what the block needs to give formative feedback; assessment items never in the learner payload; `learnerProjectionSha256` stable | T2 + CoS |
| E8 | Assessment/mastery boundary | No block writes evidence or mastery; mastery scene handoff to Assessment Player V2 only; no consequential academic writes | T1 + T2 + CoS |
| E9 | Provenance | Source lineage stated (`FIRST_TEN_BOUND` / `SOURCE_ROW_ONLY` / `SYNTHETIC_DEMONSTRATION`); text sources carry `origin`; V0.2.1 hashes untouched | T2 |
| E10 | Generated, not hand-staged | The lesson QA'd is the factory output (or a byte-identical reproducible build of it), not a frontend-only fixture | T2 + CoS |
| E11 | Build compatibility | focused vitest, `tsc --noEmit`, `next build` on the integrated branch; GitHub CI green on the PR head | CoS |

## 5. Release governance

- Decisions: READY TO MERGE / REVISE / BLOCKED, each with commit SHA and evidence links.
- No merge without founder authorization; no merge of another agent's branch by anyone else.
- Review route `/lab-review/v4-lessons` stays behind the learner-experience prototype flag; no V4 content is
  published, approved or learner-deliverable (manifest `governance` block stays DRAFT/false).
- Preview deployments share the production database (founder decision, 2026-10-21) — browser QA runs
  locally against non-production data only; no QA writes through previews.
- Pushes: GitHub writes from agent sessions have returned 403; the founder pushes or opens PRs when needed.
