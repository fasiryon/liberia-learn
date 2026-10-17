# First Ten Lessons: Lesson Acceptance Rubric V1

Rubric `liberialearn-first-ten-acceptance-rubric/0.1.0` · contract [`FIRST_TEN_MODERNIZATION_SPEC_V1.md`](FIRST_TEN_MODERNIZATION_SPEC_V1.md) · source [`curriculum/modernization/v1/first-ten/spec.json`](../../../curriculum/modernization/v1/first-ten/spec.json) · status **PROPOSED_NOT_AGREED**

This rubric decides whether a modernised candidate for one of the ten lessons may be **accepted for release consideration**. Acceptance is not release, and it is not proof of learning. Release still needs `RELEASE_AUTHORIZED` under a mapping plan. A claim that the lesson works needs the Pilot Measurement Plan (`docs/curriculum/excellence/PILOT_MEASUREMENT_PLAN_V1.md`).

The rubric refines Curriculum Excellence Standard V1. Every dimension names the criteria it rates, so that ratings stay comparable with `EXCELLENCE_RUBRIC_V1` and with legacy P2-B review. Where this rubric is stricter, the stricter rule applies to these ten lessons only.

## 1. Who may rate

| Rule | Detail |
|---|---|
| Exact revision | Every rating names the candidate id, version and **candidate hash**. Any change to the candidate voids the rating. |
| Independence | The author of a candidate, or of its specification, may not rate it. An AI reviewer's rating is advisory, is recorded with `AI_REVIEW_ADVISORY`, and never counts. |
| Qualification | ACADEMIC: a subject expert for the grade band. ASSESSMENT: an assessment reviewer. ACCESSIBILITY: an accessibility reviewer. LOCALIZATION: a reviewer with Liberian context expertise. One person may hold two scopes, but never ACADEMIC and ASSESSMENT for the same lesson. |
| Second expert | Civics/history lessons (ft01–ft03) and every Global Excellence task need a second independent subject check (GE-ACC-1). |
| Recording | One ledger `REVIEW_RECORDED` event per scope, with decision `ACCEPT`, `CHANGES_REQUESTED` or `REJECT` and a `reportDigest` equal to the SHA-256 of the completed rubric record (section 5). Release consideration requires human ACCEPT on both ACADEMIC and ASSESSMENT (`REQUIRED_ACCEPTANCE_SCOPES`); this rubric also requires ACCESSIBILITY and LOCALIZATION. |

## 2. Gates (in order; a lesson stops at the first failed gate)

1. **Identity.** The candidate binds to the exact `contentId`, `revisionId` and `contentHash` in `spec.json`, and the lesson's legacy record still matches the inventory (`__tests__/library-modernization/first-ten-spec.test.ts`). Every legacy section has a disposition. *Deterministic.*
2. **Correction.** Every BLOCKING and MAJOR defect listed for the lesson in `spec.json` is resolved, and the reviewer records how they confirmed each one (source cited, or computation re-run). A defect the reviewer disputes is recorded with reasons, never silently dropped.
3. **Accuracy.** No new factual, mathematical or scientific error. Every keyed answer is recomputed, every Liberian fact is sourced, and invented data is labelled as invented.
4. **Rubric.** Section 3 thresholds are met.
5. **Lesson-specific checks.** Every check in section 4 for this lesson passes.

## 3. Dimensions

Scores: **0** absent or wrong · **1** present but deficient · **2** meets the requirement with minor issues · **3** fully meets the requirement with evidence. `NOT_EVALUATED` never counts as met.

**Decision rule.** ACCEPT for a scope only if every *blocking* dimension in that scope scores 3 and every other dimension in that scope scores at least 2. Any 0 means REJECT (rebuild). Anything else means CHANGES_REQUESTED, listing each dimension below threshold.

| # | Dimension | Scope | Blocking | Rates (Excellence V1) | Score 3 requires | Typical 0 or 1 |
|---:|---|---|:-:|---|---|---|
| R1 | Identity, provenance and legacy disposition | ACADEMIC | yes | — (gate 1) | Exact hash binding; every legacy section ADOPTED, ADAPTED, REPLACED or REMOVED with a reason; a mapping plan for every live row and variant (e.g. ft09 `body`/`bodyBlock`) | Unbound candidate; a legacy section silently dropped |
| R2 | Subject accuracy | ACADEMIC | yes | NF-ACC-1, NF-ACC-2, GE-ACC-1 | Every listed defect corrected; no new error; every fact cited; every numeric answer recomputed by the reviewer; results physically and mathematically possible | Any false fact, wrong key or impossible result |
| R3 | Objectives and alignment | ACADEMIC | yes | NF-ALN-1, NF-ALN-2, NF-ALN-3 | 2–4 measurable, grade-appropriate objectives; each bound to a reviewed MOE objective, or recorded as a named scope extension; exam relevance stated with evidence specificity; nothing above scope is required | Unverified legacy codes carried forward; objectives untaught |
| R4 | Conceptual depth and instructional progression | ACADEMIC | yes | NF-PRG-1, LM-PRG-1, LM-CON-2 | The spec's progression is realised: concrete → representational → abstract where relevant; a worked example precedes practice; support fades to scaffold NONE; each objective is evidenced in two forms | Practice unrelated to the objective (ft02, ft05 legacy); no fading |
| R5 | Academic vocabulary and language load | ACCESSIBILITY | yes | LM-ACS-1 | Every vocabulary term in the spec is taught in context and used again in practice; readability is in the grade band (G1–3: 1,200 learner words or fewer, narrated); one idea per scene; demand is not lowered | Flesch-Kincaid well above grade; dense scenes |
| R6 | Liberian relevance and evidence | LOCALIZATION | yes | NF-REL-1, LM-REL-1 | Contexts are accurate, current and respectful; no stereotypes; diverse Liberian names; invented data labelled; at least one authentic Liberian application per objective | Unsourced claims as fact; foreign imagery presented as local (ft10 legacy) |
| R7 | Visual and interactive teaching | ACCESSIBILITY | yes | NF-ACS-1 | Every visual in the spec exists, carries meaning (not decoration), has a text alternative and a keyboard path, and has the stated offline fallback with the objective intact | Decorative images; interaction with no fallback |
| R8 | Prerequisite diagnosis | ASSESSMENT | yes | NF-PRG-1 | Every prerequisite has a diagnostic item before instruction depends on it, and a stated fallback route | Warm-up questions with printed answers |
| R9 | Guided and independent practice | ASSESSMENT | yes | LM-PRG-1 | Guided items carry partial support and feedback; independent practice at scaffold NONE for every objective; keys hidden from learners | Answers printed under items |
| R10 | Misconception detection and feedback | ASSESSMENT | yes | LM-CON-1 | Every misconception in the spec is taught against and diagnosable; each distractor maps to exactly one misconception, *correctly* (the reviewer checks the error actually produces that distractor); feedback is cause-specific | Generic 'try again'; mismapped distractors |
| R11 | Mastery assessment validity | ASSESSMENT | yes | NF-ASM-1, LM-ASM-1, LM-ASM-2, LM-RSN-1 | Every objective assessed at end of lesson; selected response ≤ 60% (≤ 50% for ft09/ft10); a rubric-scored reasoning or writing task with anchored score levels; assistance withheld and recorded; exactly one defensible answer per keyed item | Unkeyed exit ticket; 'one thing you learned' |
| R12 | Retention and transfer | ASSESSMENT | yes | LM-ASM-3, GE-TRN-1, GE-RSN-1 | Retrieval at least 7 days later for every objective; a transfer task in a context, representation or genre not rehearsed; a non-routine reasoning task | Transfer that repeats a lesson example |
| R13 | Optional extension | ACADEMIC | no | GE-EXT-1 | Labelled beyond grade scope, non-gating, connected to the objective | Extension required for progress |
| R14 | Teacher usability and correction notice | LOCALIZATION | no | — | A teacher view with the protected keys, rubric anchors, timing, materials and an offline run sheet; the correction notice drafted where the spec recommends one | Teacher prose inside learner text (ft08 legacy) |
| R15 | Neutrality and sensitivity | LOCALIZATION | yes for ft01–ft03, otherwise no | NF-REL-1 | Civics and history content is politically neutral, represents settler and Indigenous perspectives fairly, and names no living politician or party favourably or unfavourably | One-sided history; partisan framing |
| R16 | Comparability (planned) | ASSESSMENT | no | GE-ASM-1 | At least one outcome measure scorable blind, or anchored to an external instrument, in the measurement plan | No comparable measure planned |

**MOE and WAEC compatibility is a floor, not a ceiling.** R3 requires the mapping. No dimension may lower demand to match an exam's recall level, and no candidate may claim MOE or WAEC approval.

## 4. Lesson-specific must-pass checks

Each of these is in addition to section 3. A reviewer marks each PASS or FAIL with the evidence used.

| Lesson | Must pass |
|---|---|
| ft01 Counties and capitals (`wk_mca7a_fri_p4`) | All 15 county–capital pairs match a cited current official source; Nimba = Sanniquellie everywhere; Montserrado's county seat settled per `OD-FT01-MONTSERRADO`; Maryland–Sinoe adjacency corrected; the map is assessed (not only lists); no unsourced economic claims |
| ft02 Founding of Liberia (`wk_mca7a_wed_p4`) | Roberts, Cuffe, Sherbro/Mesurado and 1822/1824/1847 corrected and cited; no off-objective arithmetic; at least two sources, one presenting Indigenous perspectives; 'civilization' taught correctly; a second history expert has reviewed it |
| ft03 Democracy and representation (`hero-civics-g7-…`) | No statement that Liberia uses proportional representation; Senate 2 per county and House by district stated and cited; elected and appointed offices distinguished; every apportionment example sums correctly; false etymologies removed; neutrality confirmed |
| ft04 States of matter (`wk_mca7a_fri_p3`) | No calculated result outside physical bounds; latent-heat calculation only in the optional extension; evaporation and boiling distinguished; melting not described as a reaction; demonstration safety note present |
| ft05 Photosynthesis (`science-g5-plants`) | No invented quantity presented as fact; the 'food from soil' misconception is confronted and diagnosed; energy described as transformed, not made; all 10 linked video supplements dispositioned in the mapping plan |
| ft06 Area and perimeter (`hero-math-g7-…`) | 90 × 45 = 4,050 everywhere; no unsolved or generator-residue item; every key matches its prompt; units on every answer; realistic dimensions; the fixed-perimeter objective taught and assessed |
| ft07 Fractions (`lesson_mca_1`) | The fraction definition includes fractions ≥ 1; no correct method labelled an error; every fraction names its whole; comparison taught and assessed; units for palm oil consistent |
| ft08 Place value G2 (`hero-math-g2-…`) | 1,200 learner words or fewer, every scene narrated, pictures carry meaning; two-digit scope only (hundreds only in the labelled extension); every item has exactly one answer; non-reading response modes available |
| ft09 Main idea (`wk_mca7a_mon_p2`) | A single learner text; both legacy variants recorded in the mapping plan; every key's details support its main idea; every passage sourced or labelled authored; implied main idea assessed |
| ft10 Vocabulary in context (`hero-english-g7-…`) | Authentic or reviewed West African texts with licensing recorded; no tigers, foxes or European imagery presented as West African; no authoring markers in learner text; every example sentence supports its target meaning |

## 5. Review record (what `reportDigest` covers)

A completed record is a JSON document with these fields. Its SHA-256 over canonical JSON is the `reportDigest` in the ledger event.

```json
{
  "rubricVersion": "liberialearn-first-ten-acceptance-rubric/0.1.0",
  "lessonKey": "ft01-g7-civics-counties-capitals",
  "contentId": "wk_mca7a_fri_p4",
  "candidate": { "id": "…", "version": "…", "hash": "<64 hex>" },
  "scope": "ACADEMIC",
  "reviewer": { "id": "…", "qualification": "…", "independentOfAuthor": true },
  "defectConfirmations": [{ "defectId": "D1", "status": "CONFIRMED | DISPUTED | NOT_APPLICABLE", "evidence": "source or computation" }],
  "scores": [{ "dimension": "R2", "score": 3, "evidence": "…" }],
  "lessonChecks": [{ "check": "Nimba = Sanniquellie everywhere", "result": "PASS", "evidence": "…" }],
  "decision": "ACCEPT | CHANGES_REQUESTED | REJECT",
  "requiredChanges": ["…"],
  "minutesSpent": 0
}
```

`minutesSpent` feeds the measured effort model (scale-out gate G1). Reviewer time is the main unknown for national scale-out.

## 6. What acceptance does not mean

- It does not release the lesson, change what is assigned, or repoint any historical record.
- It does not show that learners learned. That requires baseline, immediate, ≥14-day retention and transfer measures under the Pilot Measurement Plan.
- It does not certify MOE or WAEC alignment.

## Changing this rubric

Any change to a dimension, threshold or check creates a new version. Records carry the rubric version that produced them.
