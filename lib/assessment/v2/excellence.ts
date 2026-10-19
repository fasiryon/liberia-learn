/**
 * LL-AEP-001 assessment-design contracts: grade-appropriate difficulty and cognitive-demand
 * blueprints, mandatory independent higher-order and transfer evidence where suitable, and
 * authentic-work rubric quality.
 *
 * The blueprint is a DESIGN TARGET, not a quota. A summative form outside target can still be
 * released with a documented exception (reason + an approver who is not an author), because
 * subject appropriateness, age and accessibility can justify a different distribution.
 */
import {
  LL_AUTHENTIC_WORK_DIMENSIONS,
  LL_DEMAND_TIERS,
  LL_DIFFICULTY_BLUEPRINTS,
  type LlDemandTier,
  type LlDifficultyBlueprint,
} from "@/lib/academic-policy/llAep001";
import type { AssessmentDefinitionV2, AssessmentFormV2, AssessmentItemV2, ProtectedScoringSpec } from "./types";

/** Items in a NEW context, and CREATE-level items, are transfer/creation; otherwise by demand. */
export function demandTier(item: Pick<AssessmentItemV2, "cognitiveDemand" | "context">): LlDemandTier {
  if (item.context === "NEW" || item.cognitiveDemand === "CREATE") return "TRANSFER_CREATION";
  if (item.cognitiveDemand === "ANALYZE" || item.cognitiveDemand === "EVALUATE") return "ANALYSIS";
  if (item.cognitiveDemand === "APPLY") return "APPLICATION";
  return "FOUNDATIONAL";
}

export function blueprintForGrade(grade: number): LlDifficultyBlueprint | null {
  return LL_DIFFICULTY_BLUEPRINTS.find((blueprint) => blueprint.grades.includes(grade)) ?? null;
}

export type BlueprintEvaluation = Readonly<{
  blueprintId: string;
  /** Share of form points per tier, in percent. */
  actualPercent: Readonly<Record<LlDemandTier, number>>;
  deviations: readonly Readonly<{ tier: LlDemandTier; target: number; actual: number }>[];
  withinTarget: boolean;
}>;

export function evaluateDifficultyBlueprint(form: AssessmentFormV2, items: ReadonlyMap<string, AssessmentItemV2>, grade: number): BlueprintEvaluation {
  const blueprint = blueprintForGrade(grade);
  if (!blueprint) throw new Error("assessment_blueprint_grade_unsupported");
  const totals: Record<LlDemandTier, number> = { FOUNDATIONAL: 0, APPLICATION: 0, ANALYSIS: 0, TRANSFER_CREATION: 0 };
  let total = 0;
  for (const ref of form.items) {
    const item = items.get(`${ref.itemId}@${ref.itemVersion}`);
    if (!item) throw new Error("assessment_blueprint_item_missing");
    totals[demandTier(item)] += ref.points;
    total += ref.points;
  }
  const actualPercent = Object.fromEntries(LL_DEMAND_TIERS.map((tier) => [tier, total > 0 ? Math.round((1000 * totals[tier]) / total) / 10 : 0])) as Record<LlDemandTier, number>;
  const deviations = LL_DEMAND_TIERS
    .filter((tier) => Math.abs(actualPercent[tier] - blueprint.targetPercent[tier]) > blueprint.tolerancePercent + 1e-9)
    .map((tier) => Object.freeze({ tier, target: blueprint.targetPercent[tier], actual: actualPercent[tier] }));
  return Object.freeze({ blueprintId: blueprint.blueprintId, actualPercent: Object.freeze(actualPercent), deviations: Object.freeze(deviations), withinTarget: deviations.length === 0 });
}

export type BlueprintException = Readonly<{
  reason: string;
  approvedBy: string;
  /** e.g. "foundational literacy unit", "accessibility accommodation", "subject structure". */
  basis: string;
}>;

/** Purposes whose release must satisfy the design gate. */
export const DESIGN_GATED_PURPOSES = ["SUMMATIVE", "EXAMINATION"] as const;

/**
 * Release gate for summative and examination forms:
 *   - the difficulty blueprint is met, or a documented exception approved by a non-author exists;
 *   - Grades 4–12: at least one independent ANALYSIS item and one TRANSFER_CREATION item are
 *     mandatory (higher-order reasoning and transfer cannot be waived by exception).
 * Returns findings; throws only when the gate fails.
 */
export function assertSummativeDesign(input: {
  definition: AssessmentDefinitionV2;
  form: AssessmentFormV2;
  items: ReadonlyMap<string, AssessmentItemV2>;
  exception: BlueprintException | null;
}): BlueprintEvaluation {
  const evaluation = evaluateDifficultyBlueprint(input.form, input.items, input.definition.grade);
  if (input.definition.grade >= 4) {
    const tiers = new Set(input.form.items.map((ref) => demandTier(input.items.get(`${ref.itemId}@${ref.itemVersion}`)!)));
    if (!tiers.has("ANALYSIS")) throw new Error("assessment_summative_requires_analysis_item");
    if (!tiers.has("TRANSFER_CREATION")) throw new Error("assessment_summative_requires_transfer_item");
  }
  if (!evaluation.withinTarget) {
    const exception = input.exception;
    if (!exception || exception.reason.trim().length < 20 || !exception.basis.trim()) throw new Error("assessment_blueprint_outside_target_without_exception");
    if (input.definition.provenance.authors.some((author) => author.id === exception.approvedBy)) throw new Error("assessment_blueprint_exception_requires_non_author");
  }
  return evaluation;
}

/**
 * Authentic work (extended writing, performance tasks and projects) must be judged on reasoning,
 * evidence, accuracy, originality, communication and reflection. Each rubric criterion names the
 * dimension it assesses; all six must be covered.
 */
export function authenticWorkRubricGaps(item: AssessmentItemV2, spec: ProtectedScoringSpec): readonly string[] {
  if (item.itemType !== "EXTENDED_WRITING" && item.itemType !== "PERFORMANCE_TASK") return Object.freeze([]);
  if (spec.key.kind !== "RUBRIC") return Object.freeze(["rubric_required"]);
  const covered = new Set(spec.key.rubric.criteria.map((criterion) => criterion.dimension).filter(Boolean));
  return Object.freeze(LL_AUTHENTIC_WORK_DIMENSIONS.filter((dimension) => !covered.has(dimension)).map((dimension) => `dimension_missing:${dimension}`));
}
