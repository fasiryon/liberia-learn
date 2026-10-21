# Visual teaching contract handoff

For the Interactive Learning Experience V4 frontend owner and Chief of Staff / independent QA.

Contract path: `lib/content-factory/v4/visualTeachingBlock.ts`.
Version: `visual-teaching-block/4.0.0-draft.1`.
Worktree: `C:/liberia-learn/.worktrees/content-factory-v4`, branch `feat/content-factory-v4-pipeline`.

This proposal extends the factory's metadata, not the renderer's block union. Its exact renderer dependency is frontend commit `1268773a6`, registry `lib/learner-experience/teaching/registry.ts`, version `teaching-blocks/1.1.0`. `BLOCK_SCHEMAS`, `validateBlock`, `blockSemantics` and `generationCatalogue` remain the single source of model types, required fields, interaction inputs and formative feedback. The factory adds a strict sidecar bound to candidate and individual block digests. No frontend component, layout or CSS changes are proposed.

The instruction standard remains `liberialearn-v4-instruction/1.0.0` in `lib/learner-experience/teaching/instruction.ts`. Mathematics follows visualize, demonstrate, guided solving, independent practice, mistake analysis and application. Science follows predict, experiment, observe, explain and apply. Humanities follows explore, investigate, compare, reason and apply, using maps, SEQUENCE timelines and SOURCE_EVIDENCE. Language follows read, understand, analyze, construct and revise, using reading passages, vocabulary, evidence annotation and writing organizers. Interactions must state an objective-linked instructional purpose. Subject/grade fit and model semantics are checked by the existing registry.

Each sidecar block identifies its scene and exact slot/index, objective ids, instructional purpose, misconception ids, text equivalent, keyboard path, non-color cue, reduced-motion alternative, paper response instructions and pinned source bytes with rights/attribution. Learning objectives carry proposed MOE references; source presence never asserts approved alignment. The source pin's authenticity describes the referenced bytes, not an endorsement of the generated lesson. Synthetic passages, examples and data stay labelled as synthetic demonstrations. Unverified rights remain REVIEW_ONLY.

FORMATIVE_ONLY keys may exist in teaching blocks for local practice. They are never protected Assessment V2 scoring specs. NONE and MODEL feedback apply to explanation/exploration; keyed tasks use AFTER_ATTEMPT. Independent scenes contain no hints or worked support. Mastery scenes contain no teaching blocks or keys and use only ASSESSMENT_HANDOFF to Assessment Player V2 with SERVER_AUTHORITY. Offline responses are capture only. No draft can publish, approve, release or mutate mastery.

Candidates use `candidate-lesson-v2/1.1.0`; factory units opt into `unit-blueprint/2.2.0` with the V4 instruction standard. Older 2.0.0/2.1.0 units keep their existing behavior. V0.2.1 packages and protected authored inputs remain immutable and outside generated output.

Shared before dependent generation implementation. This is a proposed contract, with frontend acknowledgment and independent QA still pending. There is no connected Claude messaging channel in this session; the shared-workspace pointer is `C:/liberia-learn/artifacts/content-factory-v4/CONTRACT_HANDOFF.md`. Do not claim this file is evidence that the other session has read or accepted it.
