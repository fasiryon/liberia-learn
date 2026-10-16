// Curriculum Excellence Standard V1: rubric, three layers, subject assessment blueprints,
// misconception error models and the Learning outcome standard classifier.
import { describe, expect, it } from "vitest";
import { P2B_RUBRIC_V1 } from "@/lib/curriculum/review/rubric";
import {
  CURRICULUM_EXCELLENCE_RUBRIC_VERSION, EXCELLENCE_BASIS_REFERENCES, EXCELLENCE_DIMENSIONS, EXCELLENCE_LAYERS, EXCELLENCE_RUBRIC_V1,
  evaluateLayerAttainment, type CriterionRatingRecord,
} from "@/lib/curriculum/excellence/standard";
import { evaluateAssessmentBlueprint, type PlannedAssessmentTask } from "@/lib/curriculum/excellence/assessmentBlueprint";
import { explainDistractor } from "@/lib/curriculum/excellence/misconceptionErrorModels";
import { classifyLessonOutcome, type MeasuredWave } from "@/lib/curriculum/excellence/outcomeClaims";

describe("versioned rubric and three layers", () => {
  it("is versioned and covers every required dimension in every layer it claims", () => {
    expect(CURRICULUM_EXCELLENCE_RUBRIC_VERSION).toMatch(/\/1\.0\.0$/);
    for (const dimension of ["ACCURACY", "INSTRUCTIONAL_PROGRESSION", "CONCEPTUAL_MASTERY", "REASONING", "ASSESSMENT", "ACCESSIBILITY", "RELEVANCE", "ADVANCED_EXTENSION"]) {
      expect(EXCELLENCE_DIMENSIONS).toContain(dimension);
      expect(EXCELLENCE_RUBRIC_V1.some((criterion) => criterion.dimension === dimension), dimension).toBe(true);
    }
    for (const layer of EXCELLENCE_LAYERS) expect(EXCELLENCE_RUBRIC_V1.some((criterion) => criterion.layer === layer && criterion.blocking)).toBe(true);
    expect(new Set(EXCELLENCE_RUBRIC_V1.map((criterion) => criterion.id)).size).toBe(EXCELLENCE_RUBRIC_V1.length);
  });

  it("keeps explicit MOE and WAEC mapping in the National Foundation layer", () => {
    const foundation = EXCELLENCE_RUBRIC_V1.filter((criterion) => criterion.layer === "NATIONAL_FOUNDATION" && criterion.dimension === "ALIGNMENT");
    expect(foundation.map((criterion) => criterion.statement).join(" ")).toMatch(/MOE objective/);
    expect(foundation.map((criterion) => criterion.statement).join(" ")).toMatch(/WAEC baseline.*no WAEC approval claimed/);
  });

  it("maps to the existing P2-B rubric and cites a recorded basis for every criterion", () => {
    for (const criterion of EXCELLENCE_RUBRIC_V1) {
      if (criterion.p2bDimension) expect(P2B_RUBRIC_V1).toContain(criterion.p2bDimension);
      for (const basis of criterion.basis) expect(EXCELLENCE_BASIS_REFERENCES[basis], `${criterion.id}:${basis}`).toBeTruthy();
    }
  });

  const allMet = (ratedBy: CriterionRatingRecord["ratedBy"]): CriterionRatingRecord[] =>
    EXCELLENCE_RUBRIC_V1.map((criterion) => ({ criterionId: criterion.id, rating: "MET", ratedBy: criterion.check === "HUMAN_REQUIRED" ? "HUMAN" : criterion.check === "DETERMINISTIC" ? "DETERMINISTIC" : ratedBy, evidenceRefs: ["ref"] }));

  it("attains layers cumulatively and never as learning evidence", () => {
    expect(evaluateLayerAttainment(allMet("AI")).map((layer) => layer.attained)).toEqual([true, true, true]);
    const missingFoundation = allMet("AI").filter((record) => record.criterionId !== "NF-PRG-1");
    const layers = evaluateLayerAttainment(missingFoundation);
    expect(layers.map((layer) => layer.attained)).toEqual([false, false, false]);
    expect(layers[0].unmetBlocking).toEqual(["NF-PRG-1"]);
    expect(layers.every((layer) => layer.isLearningEvidence === false)).toBe(true);
  });

  it("refuses AI MET ratings on human-required or deterministic criteria, and MET without evidence", () => {
    expect(() => evaluateLayerAttainment([{ criterionId: "NF-ACC-2", rating: "MET", ratedBy: "AI", evidenceRefs: ["x"] }])).toThrowError(/HUMAN_RATING_REQUIRED/);
    expect(() => evaluateLayerAttainment([{ criterionId: "LM-RSN-1", rating: "MET", ratedBy: "AI", evidenceRefs: ["x"] }])).toThrowError(/DETERMINISTIC_CHECK_REQUIRED/);
    expect(() => evaluateLayerAttainment([{ criterionId: "LM-RSN-1", rating: "MET", ratedBy: "DETERMINISTIC", evidenceRefs: [] }])).toThrowError(/MET_WITHOUT_EVIDENCE/);
  });
});

describe("subject assessment blueprints require more than selected response", () => {
  const objectives = ["obj-a", "obj-b"];
  const task = (id: string, kind: PlannedAssessmentTask["kind"], extra: Partial<PlannedAssessmentTask> = {}): PlannedAssessmentTask => ({
    id, kind, objectiveIds: objectives, scaffold: "NONE", timing: "END_OF_LESSON", context: "REHEARSED",
    scoring: kind === "SELECTED_RESPONSE" ? "KEYED" : "ANALYTIC_RUBRIC", source: "EXCELLENCE_PLAN", ref: id, ...extra,
  });
  const selectedOnly = [1, 2, 3, 4].map((n) => task(`sr-${n}`, "SELECTED_RESPONSE"));

  it("fails a math lesson evidenced only by selected response", () => {
    const result = evaluateAssessmentBlueprint({ subject: "MATH", objectiveIds: objectives, prerequisiteCount: 0, tasks: selectedOnly });
    expect(result.blockingGaps).toEqual(expect.arrayContaining(["BP-PRODUCTION", "BP-REASONING", "BP-SELECTED-SHARE"]));
    expect(result.selectedResponseShareOfMastery).toBe(1);
  });

  it("fails a literacy lesson whose writing is scaffolded or unscored", () => {
    const tasks = [...selectedOnly, task("w-scaffolded", "ORIGINAL_WRITING", { scaffold: "PARTIAL" }), task("w-unscored", "ORIGINAL_WRITING", { scoring: "NOT_SCORED" })];
    const result = evaluateAssessmentBlueprint({ subject: "LITERACY", objectiveIds: objectives, prerequisiteCount: 0, tasks });
    expect(result.blockingGaps).toContain("BP-PRODUCTION");
  });

  it("does not accept short constructed answers as literacy production", () => {
    const tasks = [task("short", "SHORT_CONSTRUCTED_RESPONSE"), task("reason", "EXTENDED_REASONING")];
    expect(evaluateAssessmentBlueprint({ subject: "ENGLISH", objectiveIds: objectives, prerequisiteCount: 0, tasks }).blockingGaps).toContain("BP-PRODUCTION");
  });

  it("passes a complete plan: diagnostics, production, reasoning, retention, transfer, optional extension", () => {
    const tasks = [
      ...selectedOnly.slice(0, 2),
      task("d0", "PREREQUISITE_DIAGNOSTIC", { timing: "PRE_LESSON", prerequisiteIndex: 0, fallbackRoute: "reteach" }),
      task("practice", "SHORT_CONSTRUCTED_RESPONSE", { timing: "IN_LESSON" }),
      task("produce", "SHORT_CONSTRUCTED_RESPONSE"),
      task("reason", "EXTENDED_REASONING"),
      task("retain", "DELAYED_RETRIEVAL", { timing: "DELAYED", delayDays: 7 }),
      task("transfer", "TRANSFER_TASK", { context: "NEW" }),
      task("extend", "EXTENSION", { optional: true, context: "NEW" }),
    ];
    const result = evaluateAssessmentBlueprint({ subject: "MATH", objectiveIds: objectives, prerequisiteCount: 1, tasks });
    expect(result.blockingGaps).toEqual([]);
  });

  it("rejects a diagnostic without a fallback route and retrieval sooner than 7 days", () => {
    const tasks = [
      task("d0", "PREREQUISITE_DIAGNOSTIC", { timing: "PRE_LESSON", prerequisiteIndex: 0 }),
      task("retain", "DELAYED_RETRIEVAL", { timing: "DELAYED", delayDays: 2 }),
    ];
    const result = evaluateAssessmentBlueprint({ subject: "MATH", objectiveIds: objectives, prerequisiteCount: 1, tasks });
    expect(result.blockingGaps).toEqual(expect.arrayContaining(["BP-PREREQUISITE-DIAGNOSTIC", "BP-RETENTION"]));
  });

  it("does not count an optional extension or a scaffolded task as mastery", () => {
    const tasks = [task("extend", "EXTENDED_REASONING", { optional: true }), task("scaffolded", "EXTENDED_REASONING", { scaffold: "MINIMAL" })];
    expect(evaluateAssessmentBlueprint({ subject: "MATH", objectiveIds: objectives, prerequisiteCount: 0, tasks }).blockingGaps).toContain("BP-COVERAGE");
  });
});

describe("misconception error models", () => {
  it("separates face value from a place shift", () => {
    const item = { kind: "DIGIT_VALUE", number: "3,462,105", digit: "6" } as const;
    expect(explainDistractor(item, "6")).toEqual(["DIGIT_INSTEAD_OF_VALUE"]);
    expect(explainDistractor(item, "6,000")).toEqual(["PLACE_SHIFT"]);
    expect(explainDistractor(item, "600,000")).toEqual(["PLACE_SHIFT"]);
    expect(explainDistractor(item, "60,000")).toEqual([]);
    expect(explainDistractor({ kind: "DIGIT_VALUE", number: "24.068", digit: "8" }, "0.08")).toEqual(["PLACE_SHIFT"]);
  });

  it("recognises dropped zero placeholders", () => {
    expect(explainDistractor({ kind: "WORD_FORM", number: 7305040 }, "730,540")).toEqual(["ZERO_PLACEHOLDER_OMITTED"]);
    expect(explainDistractor({ kind: "EXPANDED_FORM", number: "5.307" }, "5 + 0.3 + 0.07")).toEqual(["ZERO_PLACEHOLDER_OMITTED"]);
    expect(explainDistractor({ kind: "EXPANDED_FORM", number: "5.307" }, "5 + 0.03 + 0.007")).toEqual(["PLACE_SHIFT"]);
    expect(explainDistractor({ kind: "EXPANDED_FORM", number: "5.307" }, "5 + 3 + 7")).toContain("DIGIT_INSTEAD_OF_VALUE");
  });

  it("distinguishes longer-is-greater, shorter-is-greater and reversed order", () => {
    const item = { kind: "ORDER_ASCENDING", values: ["0.3", "0.307", "0.37"] } as const;
    expect(explainDistractor(item, "0.3, 0.37, 0.307")).toEqual(["LONGER_DECIMAL_GREATER"]);
    expect(explainDistractor(item, "0.307, 0.37, 0.3")).toEqual(["SHORTER_DECIMAL_GREATER"]);
    expect(explainDistractor(item, "0.37, 0.307, 0.3")).toEqual(["ORDER_REVERSED"]);
    expect(explainDistractor(item, "0.307, 0.3, 0.37")).toEqual([]);
  });

  it("does not apply decimal misconceptions to whole-number comparisons", () => {
    expect(explainDistractor({ kind: "GREATEST", values: ["6009999", "6010000"] }, "6,009,999")).toEqual([]);
    expect(explainDistractor({ kind: "GREATEST", values: ["0.5", "0.45"] }, "0.45")).toEqual(["LONGER_DECIMAL_GREATER"]);
  });
});

describe("Learning outcome standard: delivery is not success", () => {
  const wave = (wave: MeasuredWave["wave"], extra: Partial<MeasuredWave> = {}): MeasuredWave => ({
    kind: "MEASURED", wave, matchedLearners: 120, unassisted: true, blindScored: true, comparison: "BASELINE_ONLY",
    effect: wave === "BASELINE" ? null : { estimate: 0.4, ciLower95: 0.15 }, ...extra,
  });

  it("never lets generation, presentation or completion claim success", () => {
    const result = classifyLessonOutcome(["GENERATED", "VALIDATED", "REVIEWED", "PUBLISHED", "PRESENTED", "VIEWED", "COMPLETED"].map((kind) => ({ kind }) as never));
    expect(result).toMatchObject({ status: "DELIVERED", maySayLessonSucceeded: false });
  });

  it("requires baseline, immediate gain, retention, transfer and an independently comparable gain", () => {
    const full = [
      wave("BASELINE"), wave("IMMEDIATE_POST"), wave("DELAYED_RETENTION", { delayDays: 28 }), wave("TRANSFER"),
      wave("EXTERNAL_ANCHOR", { comparison: "COMPARISON_GROUP" }),
    ];
    expect(classifyLessonOutcome(full)).toMatchObject({ status: "LEARNING_SUCCESS_DEMONSTRATED", maySayLessonSucceeded: true, missing: [] });
    expect(classifyLessonOutcome(full.slice(0, 2)).status).toBe("LEARNING_OBSERVED");
    expect(classifyLessonOutcome(full.slice(0, 3)).status).toBe("LEARNING_RETAINED");
    expect(classifyLessonOutcome(full.slice(0, 4)).maySayLessonSucceeded).toBe(false);
  });

  it("excludes assisted, underpowered, too-early and unblinded evidence", () => {
    const result = classifyLessonOutcome([
      wave("BASELINE"), wave("IMMEDIATE_POST", { unassisted: false }), wave("DELAYED_RETENTION", { delayDays: 3 }),
      wave("TRANSFER", { matchedLearners: 12 }), wave("EXTERNAL_ANCHOR", { comparison: "COMPARISON_GROUP", blindScored: false }),
    ]);
    expect(result.status).toBe("DELIVERED");
    expect(result.excluded).toEqual(["IMMEDIATE_POST:ASSISTED", "DELAYED_RETENTION:DELAY_UNDER_14_DAYS", "TRANSFER:UNDER_30_LEARNERS"]);
    expect(result.missing).toContain("INDEPENDENTLY_COMPARABLE_GAIN");
  });

  it("does not count a gain whose interval includes zero", () => {
    const result = classifyLessonOutcome([wave("BASELINE"), wave("IMMEDIATE_POST", { effect: { estimate: 0.2, ciLower95: -0.05 } })]);
    expect(result.status).toBe("DELIVERED");
  });
});
