# V4 Instruction-Quality Audit V1 (draft.6 and schoolday.1)

Chief of Staff, 2026-10-23. Part A covers the six sealed draft.6 lessons. Part B covers Codex's full-day batch `4.0.0-schoolday.1-draft.2` (11 lessons, uncommitted). Both batches now share one track, the full STEM day.

## Part A: draft.6

This audit asks **"does it teach well?"**, separately from "does it pass tests?". Draft.6 passes its technical gates: the sealed receipt, 8,444 unit tests, the renderer gate and the authenticated browser run reported in `T2-DRAFT6-PILOT-DONE.md`. Those results say nothing about instruction. This audit read the learner-facing scenes in `review/complete-academic-packet.md` and measured them with `scripts/cos-stem/audit-draft6-instruction.cjs`. The pinned output is `curriculum/program/stem-v1/draft6-instruction-audit.json`.

Source: Codex branch `fix/v4-pilot-security-release` @5f3348b30, draft.6 sealed at 36d2ca665. Read-only. No package byte was changed.

## Measurements

| Lesson | Scenes | Body words | CHECK items (2-option) | Scenes with hints | Distinct misconception ids | Generic learner actions |
| --- | ---: | ---: | --- | ---: | ---: | ---: |
| g7-math-fractions | 7 | 246 | 5 (5) | 0 | 1 | 2 |
| g7-math-area-perimeter | 7 | 194 | 1 (0) | 0 | 1 | 0 |
| math-multiplication-models (G5) | 7 | 221 | 2 (2) | 0 | 1 | 5 |
| g7-science-states-of-matter | 6 | 301 | 8 (8) | 0 | 1 | 2 |
| g7-civics-counties-capitals | 6 | 248 | 3 (3) | 0 | 1 | 0 |
| g7-english-reading-evidence | 6 | 243 | 1 (1) | 0 | 1 | 2 |
| **Total** | **39** | | **20 (19)** | **0** | **6 (one per lesson)** | **11** |

## Findings

Severity: **ACADEMIC** means a concrete instructional-design defect that weakens learning. **PRESENTATION** means visible to learners but fixable without changing the teaching.

| Id | Severity | Finding | Evidence | Disposition |
| --- | --- | --- | --- | --- |
| Q1 | PRESENTATION | Every learner-facing title starts with "Generated:" (e.g. "Generated: One whole, equal units"). | `learner-projection.json` `title` in all six | Decision D2: strip in the pilot-derived view (T2, no package change) or fix in a future draft |
| Q2 | ACADEMIC | Each lesson declares one placeholder misconception id (`generated-<subject>-misconception`) and attaches it to every item. Misconception-linked feedback cannot tell one error from another. This breaks the V4 rule that every declared misconception is taught against and diagnosable. | `misconceptionIds` and `CHECK.items[].misconceptionId` | Factory recipe defect (T2). The feedback text is often good; the diagnostic structure is missing. |
| Q3 | ACADEMIC | Zero of 39 scenes has a hint, including every SOLVE_WITH_SUPPORT scene. "Guided" practice gives feedback only after an answer, never support before one. | `hints: []` everywhere | Factory recipe defect (T2) |
| Q4 | ACADEMIC | 19 of 20 check items have exactly two options, so guessing succeeds 50% of the time. Option ids are always `reason` (correct) and `other`, which exposes the key pattern in the DOM. | `CHECK.items[].options` | Factory recipe defect (T2). Formative only, so not a grading risk, but weak as diagnosis. |
| Q5 | ACADEMIC | Fractions scene "Rename before combining" shows learners the answer policy ("Only a question explicitly requesting rounding accepts 0.83…"). That is reviewer/teacher material, not teaching. | `generated-2.content.body` | Factory (T2) |
| Q6 | ACADEMIC | The only science lesson does not use the registry's simulation blocks (`PARTICLE_MODEL`, `PREDICT_OBSERVE`), which exist for exactly this topic. Its EXPERIMENT phase is a paper check; the learner never collects or handles data. Six CHECK blocks and one static DATA_PLOT carry the lesson. It does not meet the investigation commitment for a STEM-excellence platform. | `blocks` tally: CHECK 6, DATA_PLOT 1, WRITING_ORGANIZER 1 | Strongest candidate for a concrete-defect draft.7 (founder decision D1) |
| Q7 | ACADEMIC | Civics gives the full county-capital key as a reading passage before any spatial reasoning: memorization first. Inside the sealed package the spatial reasoning depends on T1's map attachment; without it the lesson is text plus 2-option checks. | `READING_PASSAGE` "County-capital key…"; `T1-DRAFT6-CIVICS-IN-PILOT.md` | Keep map attachment mandatory for Civics delivery (gate G5). Reorder in a future draft. |
| Q8 | ACADEMIC | 5 of 7 multiplication scenes give the learner action "Use the model, complete its task, and explain what the representation shows." This tells the learner nothing specific. | `learnerAction` | Factory (T2) |
| Q9 | UNVERIFIED | Each lesson claims `estimatedMinutes: 45` with 194-301 words of scene text plus blocks. Whether that fills a 45-minute period is unmeasured. | `estimatedMinutes` | Gate G6 timed rehearsal |

## What is good and should be kept

- **Mathematics models are real:** bar and number-line fractions, area models with partial products, shape models for area versus perimeter, and mistake analysis with corrections.
- **Feedback text is usually specific.** For example, "You changed the size of the pieces…" for 5/16.
- **Science content is accurate:** the plateau during melting and evaporation below 100 °C, with an explicit safety boundary (paper model, no heating).
- **English uses an original passage.** It separates direct evidence from consequences and makes the learner write and revise.
- **Every lesson follows its subject's V4 phase pattern** and ends in an independent assessment handoff, not a formative key.

## Recommendation

Draft.6 is suitable for an **ungraded, observed rehearsal** of the day journey. It is not suitable as evidence of STEM excellence. The recipe-level defects Q2-Q5 and Q8 recur in every lesson, so they belong in the next factory recipe, not in hand edits. Q6 is a concrete academic defect. The founder decides whether it justifies a science draft.7 (D1). No draft.7 has been produced or requested by this audit.

## Part B: schoolday.1-draft.2 (Codex full-day batch)

Source: Codex worktree `C:/liberia-learn/.worktrees/content-factory-draft6`, branch `feat/content-factory-schoolday`, `curriculum/factory-v4/drafts/4.0.0-schoolday.1-draft.2`. The batch is **uncommitted**, read 2026-10-23, read-only. Measurements are pinned in `curriculum/program/stem-v1/schoolday-instruction-audit.json`. Its receipt baseline pins the same six draft.6 hashes as the CoS pins.

### What improved over draft.6

- **No two-option checks and no generic learner actions** (Q4 and Q8 fixed). Responses are traced values, numeric answers, mistake analysis and structured writing.
- **Computational thinking is real.** In `g7-computing-water-monitor-algorithms` the learner traces a loop over readings, distinguishes `>` from `>=` at the boundary value, finds a substituted bug, writes pseudocode with three tests (equality, above, empty list) and designs input validation.
- **Investigations are honest.** Data is labelled illustrative, practicals are supervised room-temperature activities, and nothing is claimed as a simulator or approved lab.

### Findings

| Id | Severity | Finding | Evidence | Disposition |
| --- | --- | --- | --- | --- |
| S1 | PRESENTATION (blocking for learners) | Mojibake in 10 of 11 packages: "â€”" appears where an em-dash or en-dash is meant ("Illustrative analysis data â€” not class observations", "Write a 45â€”70 word paragraph"). The bytes are in the generator sources, so every regeneration repeats it. | `lib/content-factory/v4/schoolday/curriculum.ts` and `lessonAuthor.ts` contain the mis-decoded sequence | T2: fix the source encoding, use "–" for ranges, add a test that rejects `\u00e2\u20ac` in any package |
| S2 | ACADEMIC | 32 of 77 scenes show learners system or policy text, or a template body, instead of teaching. Examples: "not an executable coding sandbox", "independent responses are not automatically judged for academic correctness", "Work independently with the source information and data", and a whole ASSESS scene saying no graded assessment is supplied. | scene `content.body` | T2: move policy text to the teacher projection; write lesson-specific bodies |
| S3 | ACADEMIC | Still one misconception id per lesson, and 0 of 77 scenes has a hint (same as Q2 and Q3). | `misconceptionIds`, `hints` | T2 recipe |
| S4 | ACADEMIC | Computing and engineering lessons are recorded as subject SCIENCE and use the science phase pattern (PREDICT > EXPERIMENT > ORIENT > OBSERVE > EXPLAIN > APPLY). There is no DEFINE/DESIGN/TEST/REFINE or DECOMPOSE/DEBUG structure. 9 of 11 lessons share one block set (DATA_PLOT, NUMERIC_RESPONSE, MISTAKE_ANALYSIS, WRITING_ORGANIZER), so the engineering and computing periods look like science periods. | manifests `subject`; phases; block tally | Root cause: V4 has no Engineering or Computing family. T1 instruction 1.1.0 plus T2 subject codes (COMPUTER_SCIENCE, ENGINEERING_FOUNDATIONS). The CoS binds these lessons to the Computing and Engineering courses meanwhile. |
| S5 | UNVERIFIED | Timing is unmeasured (295-315 body words plus blocks per lesson) | — | Gate G6 |

### Recommendation

The batch fills the full day with substantive lessons and is the right content to rehearse. S1 must be fixed before any learner sees it. S2 and S3 are next-recipe fixes. S4 needs the coordinated T1 and T2 change. The CoS will repeat this audit when Codex commits and seals the batch, and will re-pin hashes then.
