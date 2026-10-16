# Pilot measurement plan V1

Version `liberialearn-pilot-measurement/1.0.0` · classifier `lib/curriculum/excellence/outcomeClaims.ts`

## Rule

LiberiaLearn does not consider a lesson successful because it has been generated, beautifully presented, or completed. A lesson succeeds when students can independently demonstrate that they learned, retained and can apply what it taught.

This plan sets out how to measure that. It does not authorize a pilot. A pilot needs governed approval of the exact lesson revisions, explicit authorization, school and guardian consent, and the child-data protections below. The Grade 7 candidates are not approved and must not reach students before then.

## Questions

1. **Growth.** Do learners score higher right after the lesson than they did at baseline, and higher than comparable learners who did not get it?
2. **Retention.** Is the gain still present at least 14 days later?
3. **Transfer.** Can learners use it in a context, representation or genre the lesson did not rehearse?
4. **Independent comparability.** Does the gain show up on an independently developed instrument, scored blind, against a comparison group?

## Claims allowed by the evidence

`classifyLessonOutcome` enforces this ladder. Reports and dashboards may use only the status the evidence supports.

| Status | Requires | Allowed wording |
| --- | --- | --- |
| `NO_EVIDENCE` | nothing | none |
| `DELIVERED` | Delivery evidence only: generated, validated, reviewed, published, presented, viewed or completed. Also any learning evidence that was excluded. | "built", "reviewed", "delivered to N learners" |
| `LEARNING_OBSERVED` | Baseline plus an immediate-post gain whose 95% CI lower bound is above 0 | "learners improved immediately after the lesson" |
| `LEARNING_RETAINED` | The above, plus a retained gain at ≥ 14 days | "the gain was retained after N days" |
| `LEARNING_SUCCESS_DEMONSTRATED` | The above, plus a transfer gain, plus a blind-scored external-anchor gain against a comparison or randomized group | "the lesson succeeded" |

Evidence is excluded, and listed as excluded, when it is assisted (hints, AI help, answer exposure or teacher prompting), comes from fewer than 30 matched learners, or is retention measured sooner than 14 days. An effect whose interval includes zero is not a gain.

## Design

- **Units.** Randomize classes, or schools where classes share teachers, to the lesson or to a waitlist comparison. Comparison classes receive the lesson after the delayed wave, so no learner is denied it.
- **Stratification.** Stratify randomization by county, urban or rural setting, school type (public, private, mission, community), and baseline class mean.
- **Teaching.** Both arms use the same time allocation. Comparison classes teach the topic with their usual approach, which is recorded.
- **Pre-registration.** Before baseline, freeze the hypotheses, primary outcome, instruments, scoring rubrics, analysis model, exclusions and minimum detectable effect. Report any deviation.

## Measurement waves

| Wave | Timing | Instrument | Notes |
| --- | --- | --- | --- |
| `BASELINE` | ≤ 5 school days before | Prerequisite diagnostic + pre-test form A or B (counterbalanced) | Uses the lesson's prerequisite diagnostics, so baseline also routes learners who need prerequisite support. |
| `IMMEDIATE_POST` | ≤ 2 school days after | The other parallel form | Selected response plus constructed response, in the same blueprint proportions as the lesson. |
| `DELAYED_RETENTION` | 14 to 21 days after (primary outcome); optional 42 days | Third parallel form | No review in between beyond normal classwork, which is logged. |
| `TRANSFER` | With the delayed wave | Tasks in an unrehearsed context | Math: a new representation, such as the number line in `pm-t1`. Literacy: a new genre and audience, such as the letter in `pl-t1`. |
| `EXTERNAL_ANCHOR` | With the delayed wave | Independently developed instrument | Chosen and frozen by someone independent of the lesson authors before baseline. |

Parallel forms are built from the blueprint with matched cognitive demand and are equated on a common-item set. Items are original LiberiaLearn items. No WAEC past-paper text is used (`lib/curriculum/benchmarking/rightsPolicy.ts`), and no WAEC approval or equivalence is claimed.

External anchors:

- **Math.** Released items from an independently developed assessment whose licence permits this use (for example, released TIMSS Grade 8 number items, subject to IEA terms), or an independently written place-value and decimal instrument.
- **Literacy.** A common argumentative writing prompt scored with an analytic rubric that was developed independently of the lesson's rubric.

## Independence of evidence

- All pilot waves are taken unassisted. Hints, worked examples, AI help and answer feedback are switched off, and calculators follow each item's tool policy.
- Any assistance is recorded in governed evidence metadata (`assistanceUsed`, `hintCount`; see `lib/learning-evidence/evidenceContract.ts`). Assisted responses count as formative evidence only and are excluded from the outcome analysis.
- Two trained scorers score every constructed response independently, without knowing the learner's group or wave. Quadratic weighted kappa must be at least 0.70 on a calibration set before live scoring. Disagreements of more than one rubric point go to a third scorer.
- AI may pre-sort or flag responses for scorers. It is never a scorer of record, and AI-assisted scores are not outcome evidence.

## Analysis

- **Primary outcome.** The delayed-retention score, standardized against the comparison group.
- **Model.** Multilevel regression (learners in classes in schools), with the baseline score and stratification variables as covariates. Report Hedges' g with 95% intervals. Run immediate, transfer and anchor outcomes with the same model.
- **Equity.** Report effects by gender, county, urban or rural setting, school type and baseline tercile, so the gain does not depend on learners who were already ahead.
- **Missing data.** Report attrition and baseline equivalence by arm. Run the analysis on all available matched learners and as a sensitivity check under multiple imputation. Do not switch outcomes.
- **Fidelity.** Record lesson completion, time on task and teacher logs as delivery evidence. They help explain results and are never an outcome.

## Sample size (planning estimate)

These assumptions are to be confirmed in pre-registration:

- intraclass correlation 0.20;
- about 30 learners per class;
- the baseline covariate explains about 50% of variance;
- 80% power at α = 0.05.

Under them, 40 classes (20 per arm) give a minimum detectable effect of about 0.30 SD on the primary outcome. A smaller pilot can still estimate effects and test the instruments, but its results are reported as feasibility findings, not as success claims. The classifier's floor of 30 matched learners per wave is a minimum for counting a wave, not a power target.

## Child data and safety

- Collect only what the analysis needs, under pseudonymous learner IDs. Keep the identity key separate and access-controlled.
- Obtain consent from the school and from guardians, and assent from learners. Learners can stop at any time without consequence.
- Pilot scores never change administrative grades or canonical mastery. They are research evidence.
- Nothing in this plan writes to production data. Running a pilot needs its own authorization and data-protection review.

## Grade 7 instruments drafted so far

The candidate assessment plans in `curriculum/excellence/g7-v0.2.0/*/assessment-plan.json` supply the following, all unreviewed and CANDIDATE ONLY:

- the prerequisite diagnostics for baseline;
- the constructed and reasoning tasks for the post forms;
- delayed retrieval tasks;
- the transfer tasks.

Before they become instruments they need independent human review, a second parallel form for each, and an independently chosen external anchor.
