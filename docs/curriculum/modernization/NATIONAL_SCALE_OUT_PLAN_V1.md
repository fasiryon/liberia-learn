# Library Modernization: National Scale-Out Plan V1

This plan covers progressive modernization of the whole live catalog. **Counts** come from the committed baseline (`curriculum/modernization/v1/`, extract of 2026-10-16). **Effort and cost figures are planning assumptions**, labelled as such. Replace them with measured values after the first human reviews of the pilot.

Four things are reported separately and never merged into one "modernized" number:

1. **Candidates produced** (pipeline status READY_FOR_INDEPENDENT_REVIEW)
2. **Academically accepted** (human independent ACCEPT on the exact hash)
3. **Released** (RELEASE_AUTHORIZED, then RELEASED, under a mapping plan)
4. **Learning demonstrated** (`LEARNING_SUCCESS_DEMONSTRATED` under Pilot Measurement Plan V1)

## What the inventory found

1,105 live lessons across grades 1-12 and 10 catalogue subjects. Every current revision verifies, and none has any learning-outcome evidence.

| Subject | A repair | B redesign | C replace | D hold | Total | With learner history |
|---|---:|---:|---:|---:|---:|---:|
| English | 139 | 50 | 0 | 0 | 189 | 98 |
| Computer Science | 0 | 0 | 0 | 177 | 177 | 1 |
| Engineering Foundations | 0 | 0 | 0 | 163 | 163 | 1 |
| Civics | 33 | 90 | 9 | 1 | 133 | 105 |
| Science | 46 | 80 | 1 | 1 | 128 | 88 |
| Literacy | 74 | 34 | 1 | 1 | 110 | 82 |
| Math | 54 | 40 | 1 | 6 | 101 | 66 |
| Social Studies | 10 | 51 | 0 | 0 | 61 | 48 |
| History | 0 | 0 | 39 | 0 | 39 | 0 |
| Engineering | 0 | 0 | 0 | 4 | 4 | 1 |
| **Total** | **356** | **345** | **51** | **353** | **1,105** | **490** |

| Grade band | A | B | C | D | Total |
|---|---:|---:|---:|---:|---:|
| 1-3 | 0 | 50 | 9 | 74 | 133 |
| 4-6 | 88 | 73 | 0 | 85 | 246 |
| 7-9 | 236 | 170 | 3 | 72 | 481 |
| 10-12 | 32 | 52 | 39 | 122 | 245 |

Of the 353 held lessons, the track each takes once its hold is resolved is A 255, B 81 and C 17. Hold reasons (some lessons have more than one): no MOE source for the subject (Computer Science, Engineering) 344; demo or test fixture in the catalogue 10; revoked 1; teacher-owned 1.

Foundational literacy and numeracy (Math, English, Literacy): 400 lessons, 393 of them schedulable now.

## Readiness gates

| Gate | What it needs | Unblocks | Owner |
|---|---|---|---|
| **G0 Governance decisions** | Scope decision for Computer Science and Engineering (adopt as LiberiaLearn-owned enrichment with owned objectives, or retire); adopt MOE Social Studies as Civics authority; retire or label the 10 demo/smoke rows; register the official WAEC syllabi (the repository map is aggregator-sourced); confirm the reviewer roster and qualifications | 344 held lessons, 133 Civics release decisions, WAEC claims at grades 7-12 | Founder / curriculum owner |
| **G1 Pilot review** | Independent human review of the 4 pilot and 2 Grade 7 candidates; measured review minutes, change rate and defect categories | Calibrated effort model, auditor calibration | Curriculum reviewers |
| **G2 Generation authorization** | Paid generation budget for the generator author (`generateCurriculumLessonV2` behind `PipelineBudget`); generator quality compared with pilot candidates on 10 lessons | Candidate throughput beyond hand authoring | Founder (spend) |
| **G3 Assessment governance** | Assessment Architecture V2 merged; candidate definitions turned into governed, released items | Any official scored evidence | Assessment owner |
| **G4 Release mechanics** | Fullscreen Slides V2 merged and checked; ledger moved to an append-only DB table with authenticated decisions; a migration that changes catalogue visibility per mapping plan, authorized under the migration runbook | Any learner-facing release | Engineering + curriculum authority |
| **G5 Learning measurement** | School pilot per Pilot Measurement Plan V1: baseline, immediate, ≥14-day retention, transfer and external anchor, ≥30 matched learners, unassisted, blind scoring | Any claim that a lesson works | Measurement lead |

## Effort model (planning assumptions)

| Activity | Assumption per lesson | Basis |
|---|---|---|
| Candidate authoring (generator) | ~25k input + ~20k output tokens per attempt; 1.5 attempts on average | Pilot packages are 55-75 KB of JSON (≈15-20k tokens) plus the brief and legacy text |
| AI advisory review (optional; never counts) | ~30k input + ~5k output tokens | Excellence reviewer inputs |
| Human subject + assessment review | A 60 min, B 90 min, C 120 min, plus 20 min accessibility and localization | **Assumption** to replace with G1 measurements |
| Rework | 30% of candidates need one revision; re-review at half time | **Assumption** |
| Browser QA | Automated: about 2 machine-minutes per lesson (4 widths); human spot-check of 10% at 10 min | Pilot capture runs |

Totals across all 1,105 lessons, if every held lesson is modernized:

- **Tokens:** about 41M input and 33M output for authoring (1,105 × 1.5 attempts), plus about 33M input and 6M output if AI advisory review runs. Cost is these totals × the routed model's price at execution time. No price is assumed here, and no spend has been incurred.
- **Human review:** 752 schedulable lessons ≈ 1,226 hours + 184 hours rework ≈ **1,410 reviewer-hours**. Held lessons once released add ≈ 528 + 79 ≈ **607 hours**. Total ≈ **2,000 reviewer-hours**.
- **Calendar time (review-bound):** 6 reviewers × 12 h/week (72 h) gives ≈ 20 weeks for the schedulable set; 20 reviewers (240 h/week) give ≈ 6 weeks. Human review, not generation, is the constraint.
- **Browser QA:** ≈ 37 machine-hours (parallelizable) and ≈ 18 human hours.

## Waves

`waves.json` orders the 752 schedulable lessons into 19 waves of 40 by priority. Each wave first takes the top lesson of every grade/subject cell not yet covered, then fills by score. Composition (A/B/C): wave 1 31/5/4; waves 1-4 have 108 A, 40 B and 12 C; History's template-shell replacements fall to waves 17-19 because they carry no learner history.

| Milestone | Scope | Exit criterion |
|---|---|---|
| M-0 (weeks 0-2) | G0 decisions; reviewer roster; review the 6 existing candidates (G1) | Measured review time; decisions recorded in the ledger |
| M-1 (weeks 2-6) | Revise pilot; authorize 1-2 releases to teacher-opt-in pilot classes; start measurement baseline | `RELEASED` with a mapping plan; baseline wave collected |
| M-2 (weeks 4-12) | Waves 1-4 (160 lessons, foundational-heavy) | Each lesson accepted, revised or rejected in the ledger |
| M-3 (weeks 8-14) | First retention and transfer waves for pilot lessons | Outcome classification per lesson (most will be `DELIVERED` or `LEARNING_OBSERVED`) |
| M-4 (review-bound) | Remaining waves; held subjects after G0 | Ledger shows every lesson's stage |

## Throughput and quality indicators

Reported weekly from the ledger and packages, each as its own line:

- Candidates produced, first-pass pipeline readiness rate, attempts per candidate, tokens per candidate
- Reviews completed, first-round acceptance rate, changes-requested categories (accuracy, assessment, accessibility, localization), median time from candidate to decision
- Releases authorized and performed; legacy rows superseded for new assignment; history pins intact (dependency counts never decrease)
- Post-release corrections (defect escape rate)
- Lessons by outcome status, with effect sizes and confidence intervals from measured waves

## Legacy transition dependencies

- 490 lessons carry learner history and 139 have scheduled work. Every release follows the PRESERVE_HISTORICAL_PINS policy (`PILOT_BATCH_V1.md`).
- Duplicates: 8 lessons share byte-identical learner text with another lesson, and Cleanup Plan V1 groups 25 title-duplicate sets. A candidate replaces a whole group through one mapping plan. Cleanup Plan V1 remains unapplied and needs its own authorization.
- `unitId` is also the adaptive mastery grouping key (Cleanup Plan V1). Modernized lessons keep the legacy unit key until governed units exist.

## What this plan does not claim

No lesson has been modernized in the sense of accepted, released and shown to work. Generator output, pipeline readiness and publication are delivery evidence only. The library is "modernized" lesson by lesson, only when the ledger shows independent acceptance, release under a mapping plan and, for the success claim, demonstrated learning.
