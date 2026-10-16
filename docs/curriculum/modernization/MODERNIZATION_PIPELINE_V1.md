# Library Modernization Pipeline V1

`lib/curriculum/modernization/pipeline.ts` turns one exact live legacy revision into an immutable, reviewable Curriculum V2 candidate package. It is the smallest pipeline that reuses what exists: the strict V2 parser and validator, deliverability, the learner projection (`toLessonExperience`), the Curriculum Excellence V1 blueprint and automated checks, and the modernization ledger. It adds no second lesson format, rubric or review system.

Run the pilot: `npx tsx scripts/run-library-modernization-pilot.ts [pilot-key ...]` (offline; reads the local read-only extract).

## Stages

| # | Stage | What it does | Refuses when |
|---:|---|---|---|
| 1 | RESOLVE_LEGACY | Binds the exact live revision id and content hash; recomputes the hash | the hash does not recompute (`LEGACY_HASH_MISMATCH`), the live row differs from its revision, or the extract is not the ledger's live revision (`STALE_EXTRACT`) |
| 2 | PRESERVE_LEGACY | Copies the complete legacy revision snapshot into the package | – |
| 3 | LEGACY_MATERIAL | Lists every legacy section with its audit findings and the author's disposition (REUSED / ADAPTED / REPLACED / DISCARDED / MOVED_TO_TEACHER_GUIDE) | a section has no disposition |
| 4 | AUTHORITY | MOE cell, verified structured ids, lexical leads, WAEC status; every relationship is `PROPOSED_UNREVIEWED` | a proposed MOE id does not exist in the structured source |
| 5 | SPECIFICATION | LiberiaLearn-owned spec: objectives by layer (National Foundation / LiberiaLearn Mastery / Global Excellence), **what successful independent performance looks like** per objective, prerequisites, open decisions | the spec was written against another legacy revision (`SPEC_STALE_LEGACY_BINDING`) |
| 6 | AUTHOR | Calls a `CandidateAuthor` for spec, candidate and reviewer-only assessment definitions | budget exhausted, per-lesson attempt cap, or the same input failed twice (`AUTHOR_LOOP_STOPPED`) |
| 7 | VALIDATE | Strict V2 parse (authority/secret keys refused), context validation, spec coherence, age band, deliverability in every runtime scenario | – (failures make the package REVISE_BEFORE_REVIEW) |
| 8 | ASSESSMENT | Excellence blueprint (coverage, prerequisite diagnostics with fallback routes, unscaffolded practice, production, rubric reasoning, selected-response share, ≥7-day retention, NEW-context transfer, optional extension) and automated Excellence checks by an `AUTOMATED` reviewer that takes no AI judgment | – |
| 9 | PROJECTION | Builds the learner projection; checks that no key, rubric, expected observation or fallback route leaks; authority stays `CURRICULUM_V2_DRAFT` | – |
| 10 | EXPERIENCE | Student Experience V3 checks: intro and objectives, words per scene by age band (70 / 140 / 200 / 240), alt text, keyboard and screen-reader paths, offline packageability, 3-20 scenes, no learner-facing mastery claims | – |
| 11 | COMPARISON | Legacy → candidate matrix (`comparison.md`) | – |
| 12 | PACKAGE | Writes the package and a deterministic manifest (file SHA-256s, candidate hash, flags `candidateOnly`, `approved: false`, `published: false`, `scored: false`) | the version exists with a different manifest (`CANDIDATE_VERSION_IMMUTABLE`) |
| 13 | QUEUE | Returns ledger events `WORK_STARTED`, `CANDIDATE_REGISTERED` and, only when every blocking check passes, `REVIEW_REQUESTED` | – |

The pipeline never writes to a database, publishes, replaces a live revision, scores or writes mastery. The furthest it goes is `READY_FOR_INDEPENDENT_REVIEW`.

## Package contents

`curriculum/modernization/v1/pilot/<key>/package/<version>/`: `legacy-revision.json`, `legacy-material.json`, `legacy-audit.json`, `authority.json`, `spec.json`, `candidate.json`, `assessment-definitions.json` (reviewer only), `automated-review.json`, `learner-projection.json`, `readiness.json`, `comparison.md`, `review-package.md`, `manifest.json`. Beside it: `run.json` (stage checkpoints) and `legacy-mapping-plan.json` (proposal).

## Properties

- **Exact versions.** The legacy binding is checked three times: by recomputing the hash, against the ledger's live record, and against the spec. The ledger rechecks it on `CANDIDATE_REGISTERED` and marks a candidate stale if the live revision later changes.
- **Immutable candidates.** A candidate version is written once. Any change needs a new `candidateVersion`, and in the ledger a new version discards earlier reviews.
- **Resumable and idempotent.** `run.json` records each stage's input and output hashes. Re-running with unchanged inputs reuses the package and appends no ledger events. This was verified on all four pilot lessons.
- **Budget-aware.** `PipelineBudget` caps authoring calls, tokens and attempts per lesson. An author that fails twice on identical input is stopped instead of retried.
- **Separate authorities.** Generation (`CandidateAuthor`), automated checks (`AUTOMATED`), independent review (human, in the ledger), release authorization (`CURRICULUM_AUTHORITY`), release (`RELEASE_SYSTEM`) and outcome measurement (`MEASUREMENT_LEAD`) are different actors, and the ledger enforces the separation.

## Authors

`CandidateAuthor` is the only point where content enters.

- **Static author** (pilot): spec, candidate and assessment definitions are files written by an identified author. The pilot files were written by the AI agent `claude-code:library-modernization-v1` (anthropic-claude). That agent may not review them, and the ledger refuses it as a reviewer.
- **Generator author** (scale-out): wraps the existing `generateCurriculumLessonV2` (prompt registry `curriculum.v2.lesson`, routed completion, smart tier) with the legacy extract, audit findings, MOE leads and spec as the brief. It reports metered tokens to the budget. It is not enabled here: paid generation needs explicit authorization, and each generated candidate still needs a human-written or human-checked spec and independent review.

## Assessment integration (Phase 6)

Assessment definitions use the Excellence V1 task shape (`PlannedAssessmentTask` plus prompt, key and rubric). Every package has a prerequisite diagnostic per prerequisite with a fallback route, misconception-targeted formative feedback in scenes, END_OF_LESSON independent demonstration, rubric-scored reasoning or performance, DELAYED retrieval at 7 days or more, a NEW-context transfer task, and an optional extension. Definitions stay `REVIEWER_ONLY` / `GOVERNED_CANDIDATE`: nothing scores them, and the learner projection's assessment hand-off carries `governedItems: []`. Assessment Architecture V2 exists only as an unmerged foundation branch (`feat/assessment-architecture-v2`), so mapping these definitions to governed V2 items is a release-time step. Until then, pilot evidence can only be a raw, teacher-administered observation, never official mastery.

## Fullscreen Slides V2 and Student Experience V3

The experience checks are content-level: density, structure, accessibility and offline behaviour. Fullscreen Slides V2 layout contracts are not on this base (`feat/fullscreen-slides-v2`, stacked on PR #190, is unmerged), so every package records `SX-FULLSCREEN-SLIDES-V2` as not checked. Browser evidence uses Lesson Player V2 (see `PILOT_BATCH_V1.md`).
