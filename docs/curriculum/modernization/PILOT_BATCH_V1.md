# Library Modernization Pilot Batch V1

Four live lessons were taken through the full pipeline to show the process is accurate, affordable and safe before any expansion. **Status of every pilot candidate: `AWAITING_INDEPENDENT_REVIEW`.** None is reviewed, approved, released, scored or shown to learners. No learning outcome is claimed.

The Grade 7 v0.3.0 candidates (PR #191) served as the quality reference for structure and assessment design. They are also only candidates awaiting review; they were used as a reference, not as proof of quality.

## Selection

Chosen from the audit baseline (not alphabetically) to cover subject, track and learner history:

| Pilot | Live lesson | Cell | Track | Why |
|---|---|---|---|---|
| `g6-math-decimal-place-value` | `wk_pcs6a_mon_p1` "Decimals: Place Value" | G6 Math | B redesign | Foundational numeracy; progress for 7 learners; answer key shown to learners |
| `g6-literacy-cause-effect` | `wk_pcs6a_wed_p2` "Understanding Cause and Effect…" | G6 Literacy | A targeted repair | Foundational literacy; progress for 7 learners |
| `g7-science-observation-inference` | `science-g7-1-observation-and-scientific-thinking-foundations` | G7 Science | C replacement | Placeholder shell (weak original); 11 learning events |
| `g1-civics-rules-rights-duties` | `civics-g1-1-rules-rights-and-duties-foundations` | G1 Civics | C replacement | Emergent readers; Civics → MOE Social Studies proxy; the same learner text in **5 live rows** carrying 300 progress records and 60 scheduled-work rows |

Every candidate is bound to the exact legacy revision and hash it would replace (see `curriculum/modernization/v1/pilot/<key>/package/0.1.0/manifest.json`), and the ledger records each as `CANDIDATE_REGISTERED` and `REVIEW_REQUESTED`.

## Results

| Pilot | Candidate hash | Scenes | Pipeline | Blueprint (9 rules) | Learner projection | Legacy sections dispositioned |
|---|---|---:|---|---|---|---|
| G6 Math | `da6ab7597315…` | 13 | READY_FOR_INDEPENDENT_REVIEW | all met | no reviewer content | 6/6 |
| G6 Literacy | `af6722bf1c73…` | 12 | READY_FOR_INDEPENDENT_REVIEW | all met | no reviewer content | 17/17 |
| G7 Science | `ba216cc97498…` | 12 | READY_FOR_INDEPENDENT_REVIEW | all met | no reviewer content | 10/10 |
| G1 Civics | `c426bca8c722…` | 12 | READY_FOR_INDEPENDENT_REVIEW | all met | no reviewer content | 13/13 |

Each package has: prerequisite diagnostics with fallback routes, misconception-specific feedback, modelled → guided → unscaffolded practice, an independent end-of-lesson demonstration with protected keys and rubrics, a rubric-scored reasoning or performance task, 7-day retention tasks for every objective, a NEW-context transfer task, an optional extension, and a definition of successful independent performance for every objective.

## What the pilot found in the live lessons

The pilot author found these. The author may not review its own work, so a reviewer must confirm each one. Each is recorded in the package's `comparison.md` and in the spec's open decisions.

- **G6 Math (live, 7 learners):** Example 1 says the 5 in 15.258 is in the tenths place (0.5). It is in the ones place (5), and the second 5 is in the hundredths place (0.05). The "compare decimals" objective is never taught. The answer key is printed under the practice items.
- **G6 Literacy (live, 7 learners):** it teaches that playing football in the rain caused a cold (colds are caused by viruses), an "error correction" that wrongly says more buyers can't raise prices, a "rule" that a cause always produces an effect, an unsupported claim about planting cassava only in the dry season, and practice answers printed next to the problems.
- **G7 Science:** every section is a placeholder ("Model one complete science example…"), and the row is tagged with an unrelated invented code (`LR-SCI-G7_9-01`, acids and bases).
- **G1 Civics:** a template shell that asks 6-year-olds to write, repeats a 126-word teacher-notes section twice, and is published as **five** separate lessons with identical text.

**Calibration lesson for the auditor.** The G1 civics shell first passed as Track B because its sections were written as "should" sentences. The detector was widened, and the re-audit changed 9 lessons, recorded as 18 ledger events. The G6 math factual error cannot be detected mechanically. Both confirm the design rule: mechanical audit narrows the work, and qualified human review is what establishes accuracy.

## Legacy history and transition (Phase 8)

Each pilot has `legacy-mapping-plan.json` (status `PROPOSED_UNAUTHORIZED`). It lists every live row the candidate would stand in for, with dependency counts, and fixes the history policy:

- Existing scheduled work, progress, learning events, submissions, tutor conversations and lesson plans keep pointing at the legacy contentId and revision. Nothing is repointed.
- Report cards and transcripts already published are not recomputed or relabelled.
- Legacy rows are never deleted. On release they leave the catalogue for new assignment only.
- During the pilot, new assignments use a released candidate only when the teacher opts in.
- Release needs human independent acceptance (ACADEMIC and ASSESSMENT) on the exact hash, then `RELEASE_AUTHORIZED` citing the plan digest, then a separately authorized governed migration. None of this has happened.

Two notices are recommended whether or not the candidates are released: the classes that used the live G6 math and G6 literacy lessons should be told about the content errors above.

## Browser evidence (Phase 7)

`e2e/library-modernization/capture-pilot.cjs` played every pilot projection in the existing Lesson Player V2 (dev-only `/lab-review/experience`) at 390, 768, 1440 and 1920 px, revealing steps, answering and writing as a learner would. Evidence: `artifacts/library-modernization-v1/browser/flow.json` (all 16 runs, per-scene metrics) and 48 screenshots (first scene, scene 5 and the exit ticket at each width).

| Measure | Result |
|---|---|
| Runs completed (lesson × width) | 16 / 16; every scene reached; Continue available after each scene's learner action |
| Horizontal overflow | 0 px everywhere |
| Smallest rendered text | 14 px everywhere |
| Longest scene | 2.54 viewport heights at 390 px (G6 math practice, four questions with feedback); ≤ 1.38 at 1920 px |
| Console errors | 0 |
| Content column at 1920 px | 43% of the width (the player's centred layout with lesson map and help panel). A player-level finding for Fullscreen Slides V2, not a candidate defect |

Fullscreen Slides V2 is not on this base, so slideshow pagination was not tested against its layout contracts. The pipeline records this as `SX-FULLSCREEN-SLIDES-V2: not checked`. The player labels GUIDED_EXAMPLE practice scenes "Worked example" (minor, player-level).

## Cost and effort

- Metered generation: **0 tokens**. Candidates were written in-session by the pilot author. No paid generation was run, because none was authorized.
- Pipeline runtime: under 2 seconds per lesson after the extract is loaded. A full idempotent rerun appends no ledger events.
- Author effort was not timed. Each package (12-13 scenes, 9 assessment tasks, and a spec with a disposition for every legacy section) was written in one pass after reading the full legacy lesson. Pass rate was 4/4 on the first pipeline run. Reviewer effort is not measured yet; it is the main unknown for scale-out (see `NATIONAL_SCALE_OUT_PLAN_V1.md`).

## What reviewers must do next

1. Assign a qualified subject reviewer and an assessment reviewer per lesson who did not author it.
2. Review the exact candidate hash using `review-package.md`, `comparison.md` and `assessment-definitions.json`.
3. Record decisions as `REVIEW_RECORDED` ledger events. AI reviews may be added as advisory evidence but never count.
4. Take the open decisions in each `spec.json`: the Civics proxy, the rights-and-duties scope, decimal comparison scope, legacy correction notices and the mapping for duplicates.
