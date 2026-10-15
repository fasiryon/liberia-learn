# Release-binding preparation — Grade 7 native V1

Publication: **DISABLED**. Registered in k12-scope: **no**. Executable release: **no**.

Candidate release manifests carry no ontology release. They validate under releaseManifests.ts as content-gap-only manifests and cannot execute, publish or score anything.

## math-number-sense-place-value

- Candidate manifest `lr-candidate-g7-math-number-sense-2026.1`: authority UNKNOWN, MOE approval NOT_CLAIMED
- validateReleaseManifest: ok=true, errors none, warnings release_not_attached_content_gap_only, coverage_gaps_present; identity `ee0ac39aaa463f567670592831fa1d5dfdc99c119c18460e0743bdd43435c0b5`
- Content binding (proposed): `cv2-cand-g7-math-number-sense-place-value@0.1.0`, candidate `5817d80911154bceb61fe117e0916ad64d0b7ae5c6afd2a2c6028b9cdc972ffb`
- Construct bindings (proposed): `g7-pv-exit-1@candidate-0.1.0`, `g7-pv-exit-2@candidate-0.1.0`, `g7-pv-exit-3@candidate-0.1.0`, `g7-pv-exit-4@candidate-0.1.0`, `g7-pv-exit-5@candidate-0.1.0`, `g7-pv-exit-6@candidate-0.1.0`

Required from the qualified reviewer:
- HUMAN_REVIEW of the exact candidate hash by an identified, qualified curriculum reviewer (lib/curriculum/v2/governance.ts).
- Objective basis decision: accept the LiberiaLearn candidate objectives with their MOE relationships, or rebind to MOE objectives.
- Confirmation of the recorded legacy comparison (legacy-comparison.md) and a decision on each restoration and revision recommendation.
- Approval, revision or rejection of each candidate exit-ticket item and its key.

Required from curriculum authority:
- A governed Grade 7 MATH template cell (lib/learning-authority/cells) placing the objectives in a unit with interaction classifications.
- A Grade 7 MATH ontology release (status PUBLISHED, reviewStatus APPROVED, a named authority) with concepts, standard/skill bindings, the approved items, an evidence policy and the tool policies.
- Registration of that release in curriculum/releases/k12-scope.json (absent today; this package does not register anything).
- Assembly of the candidate into CurriculumLessonV2 against the new authoring context, producing the hash that a content binding pins.

## literacy-essay-structure-argument

- Candidate manifest `lr-candidate-g7-literacy-essay-writing-2026.1`: authority UNKNOWN, MOE approval NOT_CLAIMED
- validateReleaseManifest: ok=true, errors none, warnings release_not_attached_content_gap_only, coverage_gaps_present; identity `070bb2b110948b3705aa0715116a7bd92a3b7f57951f181113f2b8e230fd03d2`
- Content binding (proposed): `cv2-cand-g7-literacy-essay-structure-argument@0.1.0`, candidate `e875feab4d8d9742f421ba98c4c8c59f753e613a3d67526a77409cdd6019f786`
- Construct bindings (proposed): `g7-essay-exit-1@candidate-0.1.0`, `g7-essay-exit-2@candidate-0.1.0`, `g7-essay-exit-3@candidate-0.1.0`, `g7-essay-exit-4@candidate-0.1.0`, `g7-essay-exit-5@candidate-0.1.0`, `g7-essay-exit-6@candidate-0.1.0`

Required from the qualified reviewer:
- HUMAN_REVIEW of the exact candidate hash by an identified, qualified curriculum reviewer (lib/curriculum/v2/governance.ts).
- Objective basis decision: accept the LiberiaLearn candidate objectives with their MOE relationships, or rebind to MOE objectives.
- Grade-scope decision for argumentative writing (MOE Grade 9, p.32).
- Correction of the Grade 7 English paragraph-writing structuring defect through the source-structuring process.
- Confirmation of the recorded legacy comparison (legacy-comparison.md) and a decision on each restoration and revision recommendation.
- Approval, revision or rejection of each candidate exit-ticket item and its key.

Required from curriculum authority:
- A governed Grade 7 LITERACY template cell (lib/learning-authority/cells) placing the objectives in a unit with interaction classifications.
- A Grade 7 LITERACY ontology release (status PUBLISHED, reviewStatus APPROVED, a named authority) with concepts, standard/skill bindings, the approved items, an evidence policy and the tool policies.
- Registration of that release in curriculum/releases/k12-scope.json (absent today; this package does not register anything).
- Assembly of the candidate into CurriculumLessonV2 against the new authoring context, producing the hash that a content binding pins.
