# LiberiaLearn Curriculum Excellence Standard V1

Version `liberialearn-curriculum-excellence/1.0.0` · rubric `liberialearn-curriculum-excellence-rubric/1.0.0` · blueprint `liberialearn-assessment-blueprint/1.0.0`

## Why this standard exists

LiberiaLearn does not consider a lesson successful because it has been generated, beautifully presented, or completed. A lesson succeeds when students can independently demonstrate that they learned, retained and can apply what it taught.

Meeting the Liberian national curriculum is the minimum. This standard defines what LiberiaLearn requires above that minimum. Every lesson still maps explicitly to Liberian MOE objectives, and to the applicable WAEC examination baseline (LJHSCE, WASSCE). This standard extends those mappings and never replaces them.

The standard governs **design quality**. It cannot show that a lesson works. Only the pilot measurement plan ([PILOT_MEASUREMENT_PLAN_V1.md](PILOT_MEASUREMENT_PLAN_V1.md), `lib/curriculum/excellence/outcomeClaims.ts`) can show that.

## Three layers

The layers are cumulative. A lesson attains a layer only when every blocking criterion of that layer, and of every layer below it, is rated MET with evidence. NOT_EVALUATED never counts as MET. Implemented in `lib/curriculum/excellence/standard.ts` (`evaluateLayerAttainment`).

| Layer | Question it answers | Authority |
| --- | --- | --- |
| **National Foundation** | Is the lesson correct, accessible and explicitly mapped to MOE objectives and, where an exam applies, the WAEC baseline? | MOE is the curriculum authority. WAEC is a baseline, never a ceiling, and approval is never claimed. |
| **LiberiaLearn Mastery** | Would passing this lesson mean the learner independently understands, reasons with and retains the content? | LiberiaLearn standard |
| **Global Excellence** | Does it reach the reasoning, transfer and extension of strong international frameworks? Is performance independently comparable? | LiberiaLearn standard, with external reference points (e.g. TIMSS cognitive domains) |

## Rubric (23 criteria)

There are nine dimensions: ALIGNMENT, ACCURACY, INSTRUCTIONAL_PROGRESSION, CONCEPTUAL_MASTERY, REASONING, ASSESSMENT, ACCESSIBILITY, RELEVANCE and ADVANCED_EXTENSION. Every criterion records:

- its layer;
- whether it blocks attainment;
- the evidence required to rate it MET;
- the existing P2-B review dimension it refines (`lib/curriculum/review/rubric.ts`), so ratings stay comparable with legacy review;
- its research basis.

Each criterion also has one of three check types. Only the check type decides who may rate the criterion MET:

| Check | May be rated MET by |
| --- | --- |
| `DETERMINISTIC` | A deterministic check (for example, a blueprint rule) only. AI judgment cannot rate it MET. |
| `AI_JUDGMENT_ADVISORY` | Nobody yet. AI findings can mark it NOT_MET or PARTIALLY_MET, but no rule rates it MET until a governed rating path exists. |
| `HUMAN_REQUIRED` | An identified human only. Any other MET rating is refused (`HUMAN_RATING_REQUIRED`). |

The criteria are listed in full in `EXCELLENCE_RUBRIC_V1`. Highlights:

- **Foundation**:
  - Every objective is bound to an MOE objective, or is a named scope extension a curriculum owner has decided.
  - Exam relevance is mapped to the WAEC baseline with its evidence specificity stated.
  - Above-scope content is optional.
  - Keys are verified mechanically where possible.
  - Every prerequisite is diagnosed and has a fallback route.
  - Every objective is assessed.
  - Accessibility and offline fallbacks preserve the objective.
- **Mastery**:
  - Support fades to unscaffolded practice.
  - Every misconception is both taught against and diagnosable through a *correctly* mapped distractor.
  - The learner must produce reasoning wherever reasoning is central.
  - The subject blueprint is satisfied.
  - Mastery evidence is independent: hints, worked examples and AI help are withheld, and any assistance is recorded.
  - Delayed retrieval happens at least 7 days after the lesson.
- **Global**:
  - A non-routine reasoning task is included.
  - Transfer is tested in a context the lesson did not rehearse.
  - An optional, non-gating extension is offered.
  - Performance is independently comparable.
  - A second independent subject expert reviews the reasoning and extension tasks.

Research basis (recorded in `EXCELLENCE_BASIS_REFERENCES`):

- retrieval practice (Roediger & Karpicke 2006) and spacing (Cepeda et al. 2006);
- worked-example fading (Sweller & Cooper 1985; Renkl & Atkinson 2003) and gradual release (Pearson & Gallagher 1983);
- diagnostic distractors (Sadler 1998) and item-writing guidelines (Haladyna et al. 2002);
- the proficiency strands in Adding It Up (NRC 2001) and Webb's depth of knowledge;
- transfer (Barnett & Ceci 2002);
- writing instruction (Graham & Perin 2007);
- structured pedagogy and teaching at the right level in low- and middle-income systems (Piper et al. 2018; Banerjee et al. 2017; GEEAP 2023);
- UDL (CAST).

These are cited so reviewers can check the reasoning. They are not authority.

## Subject assessment blueprint

`lib/curriculum/excellence/assessmentBlueprint.ts`. Selected response is allowed, and it is useful for diagnosing misconceptions. Where productive reasoning or performance is central, it can never be the only mastery evidence.

Only END_OF_LESSON or DELAYED tasks at scaffold NONE count as mastery evidence. In-lesson practice is formative, and optional extensions never gate progress.

| Rule | Math | Literacy (writing objectives) | Other subjects |
| --- | --- | --- | --- |
| Objective coverage at end of lesson | required | required | required |
| Prerequisite diagnostic + fallback route, per prerequisite | required | required | required |
| Unscaffolded practice per objective before mastery | required | required | required |
| Production evidence per objective | produced answer or justification | **original unscaffolded writing scored with an analytic rubric** | constructed response or performance |
| Rubric-scored reasoning task | required | required (original writing counts) | required |
| Selected-response share of end-of-lesson mastery evidence | ≤ 60% | ≤ 50% | ≤ 60% |
| Delayed retrieval ≥ 7 days per objective | required | required | required |
| Transfer task in a NEW context | required (Global) | required (Global) | required (Global) |
| Optional extension | required (Global) | required (Global) | required (Global) |

The Curriculum V2 candidate contract has no fields for prerequisite links, delayed retrieval or transfer. Those tasks are therefore planned in a separate **assessment plan** bound to the exact candidate hash, so the generator contract does not change. Candidate-derived tasks and plan tasks are evaluated together.

## Independent AI instructional reviewer

`lib/curriculum/excellence/instructionalReviewer.ts`. It produces evidence-backed findings against one exact content revision.

- **Exact revision.** The candidate, assessment document and plan are hashed with the same canonical JSON hash as Curriculum V2 assembly. A supplied expected hash must match. `assertReportMatchesRevision` voids a report after any change to the revision and detects edits to the report itself.
- **Evidence.** Every finding cites RFC 6901 pointers into the reviewed documents and records the hash of each cited value. AI judgment findings must quote the content they rely on. A quote that is not in the revision is rejected (`EVIDENCE_QUOTE_NOT_IN_REVISION`).
- **Deterministic checks**:
  - blueprint gaps;
  - undiagnosed prerequisites;
  - misconceptions that are not taught, or not diagnosable;
  - unmapped distractors;
  - assistance carried on mastery items;
  - **misconception-mapping consistency**: `misconceptionErrorModels.ts` computes which errors actually produce each distractor (face value, place shift, dropped zero placeholder, longer-is-greater, shorter-is-greater, reversed order).
- **No authority.** The reviewer's only outcomes are `REVISE_BEFORE_HUMAN_REVIEW` and `READY_FOR_QUALIFIED_HUMAN_REVIEW`. Every report declares `ADVISORY_ONLY`, `mayApprove: false`, `mayPublish: false`, `humanQualificationClaimed: false` and `officialApprovalClaimed: false`. Statements that claim approval, certification, MOE/WAEC endorsement, publication readiness, human qualification or lesson effectiveness are refused (`PROHIBITED_CLAIM`).
- **Independence.**
  - A reviewer may not review a revision it authored. This covers the same agent, the same session, and fixes it proposed inside the revision; violations fail with `SELF_REVIEW_PROHIBITED`.
  - Unknown authorship is refused.
  - Same-model-family review is allowed as advice, but it is recorded as `countsAsIndependentReview: false`.
  - A plan the reviewer wrote is reported as `UNREVIEWED_REQUIRES_INDEPENDENT_REVIEW`. Coverage of that plan is shown as a mechanical projection, not a review.
- **Governed publication is untouched.** Native Curriculum V2 approval still requires an identified, qualified human reviewing the exact revision (`lib/curriculum/v2/governance.ts`). The excellence modules import no database, governance writer, release or publication code. Tests assert this.

## Grade 7 gap reports

[`curriculum/excellence/g7-v0.2.0/`](../../../curriculum/excellence/g7-v0.2.0/README.md) applies the standard to the v0.2.0 Math and Literacy candidates on PR #191 (`1ad2e9ec`).

- The candidates are read with `git show`, never copied or modified.
- Run `npx tsx scripts/build-curriculum-excellence-g7-gap-reports.ts` to regenerate the reports, or add `--check` to verify they are current.
- Each report records:
  - findings, each with its evidence;
  - criterion status by layer;
  - blueprint coverage as is;
  - a proposed assessment plan: prerequisite diagnostics, reasoning tasks, original writing evidence, retention, transfer and extension;
  - misconception-mapping corrections, each mechanically checked.

All of it is CANDIDATE ONLY. Nothing is published, merged into the candidates, deployed, or written to any database.

## Changing this standard

Changing a criterion, threshold or check type creates a new version. Bump the version constant, record the change here, and regenerate the gap reports. Reports carry the version that produced them, so earlier reports stay interpretable.
