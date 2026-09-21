# Learning Orchestrator and Decision Intelligence V1

## Authority

The governed Grade 4 mathematics slice uses `learningOrchestrator.ts` to select
the next action. It extends the certified Student Learning Model handoff in
`studentLearningModel.ts`; it does not create a new mastery reducer. Canonical
state still comes only from `masteryWriter.ts`. Administrative grade and the
published ontology remain under their existing authorities.

The student next-action endpoint accepts no candidate list, model output, or
learner-state claim. The teacher override endpoint accepts an exact candidate ID,
reason, and request key after tenant and class authorization. Policy checks the
ID against candidates derived on the server from the pinned published release.

## Decision sequence

1. Replay all three concept states for the authenticated Grade 4 learner and
   derive a revision from their canonical event digests.
2. Validate the published ontology and derive finite candidates from exact item
   bindings, contexts, tool policies, and hard prerequisite edges.
3. Pass the structured states and finite set to the provider-neutral
   `DecisionModel` interface. The active production path uses only the
   deterministic baseline. A future Jev, structured LLM, or local adapter may
   implement the interface; no such provider is configured here.
4. Validate ranked IDs, probabilities, confidence, and policy eligibility.
   Model errors or uncertainty fall back to the deterministic baseline.
   Shadow output is stored with the recommendation and never selects the action.
5. Resolve a teacher override only when its candidate is still eligible.
   Persist recommendation, policy resolution, and effective decision as three
   linked LearningEvent facts in a serializable transaction. Recheck canonical
   event count before commit. A new canonical event requires recomputation.

The effective decision records the exact state revision and ontology release
identity. No decision path writes canonical mastery, grade, curriculum, or
teacher authority. A same-revision authorized teacher override is returned to
the learner as the effective decision, with its reason visible in the student
projection. Replayed request keys return the stored decision.

V1 prerequisite progression uses an observed score of at least 0.8 on every
predecessor concept. This permits only a published instructional or diagnostic
next action; it does not label the predecessor mastered or change grade. The
threshold is a transparent policy heuristic for this bounded release, not an
empirical outcome claim. Low-confidence and conflicting evidence remain visible
to the ranking and favor diagnostic support.

## Fallback and scope

The pure resolver runs without a provider. Its offline mode skips provider and
shadow calls and selects from the pinned published Grade 4 set. A device cannot
submit offline decisions as canonical state. Server persistence still requires
the authenticated tenant and canonical state store. With no trusted cached
state, `offlineGrade4CurriculumFallback` exposes the pinned published entry
diagnostic as read-only grade-level instruction and makes no mastery claim.

Legacy Today scheduling and subject-level adaptive hints continue for content
outside this published three-concept slice. They are not inputs to this
orchestrator and cannot introduce actions into its candidate set. The existing
diagnostic session endpoint remains an assessment delivery boundary; the
next-action endpoint owns the selection decision for this governed slice.
