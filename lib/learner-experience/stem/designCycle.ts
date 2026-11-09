/**
 * DESIGN_CYCLE logic (teaching-blocks/1.2.0). Field shape and refinements are the canonical registry schema
 * (BLOCK_SCHEMAS_1_2.DESIGN_CYCLE). One iteration is: plan a design, check the safety rules, test it with the test
 * plan, record one measured result per criterion, then see which criteria it meets. The learner improves and tests
 * again, up to maxIterations, also after a design meets every criterion, so designs can be compared (P6-COMPARE-01).
 * maxIterations is a maximum, never a minimum. Results are the learner's own measurements; nothing is pre-filled,
 * scored, saved or recorded. Not meeting a criterion is information for the next design, never a failure grade.
 */
import type { z } from "zod";
import { BLOCK_SCHEMAS_1_3 } from "@/lib/learner-experience/teaching/registry-1.3";
import { isEntryProblem, readEntry, type MeasurementColumn } from "@/lib/learner-experience/stem/measurementTable";

/** The 1.3.0 candidate shape: exactly 1.2.0 plus the optional `measurement` link, so every 1.2.0 block parses unchanged. */
export type DesignCycleData = z.infer<typeof BLOCK_SCHEMAS_1_3.DESIGN_CYCLE>;
export type Criterion = DesignCycleData["criteria"][number];
export type Stage = "PLAN" | "SAFETY" | "TEST" | "EVALUATE";
export const STAGES: readonly Stage[] = ["PLAN", "SAFETY", "TEST", "EVALUATE"];
export const STAGE_LABEL: Record<Stage, string> = { PLAN: "Plan", SAFETY: "Stay safe", TEST: "Test", EVALUATE: "Check and improve" };

export type CriterionResult = Readonly<{ criterionId: string; value: number; met: boolean; gap: number; message: string }>;
export type Iteration = Readonly<{ plan: string; shownToTeacher: boolean; safety: readonly boolean[]; results: Readonly<Record<string, string>>; improvement: string; improvementTold: boolean }>;
export type Trend = "CLOSER" | "FURTHER" | "SAME" | null;

export function validateDesignCycle(block: unknown): DesignCycleData {
  const parsed = BLOCK_SCHEMAS_1_3.DESIGN_CYCLE.safeParse(block);
  if (!parsed.success) throw Error(`design_cycle_invalid:${parsed.error.issues[0]?.message ?? "schema"}`);
  if (new Set(parsed.data.criteria.map((c) => c.id)).size !== parsed.data.criteria.length) throw Error("design_cycle_invalid:duplicate_criterion");
  return parsed.data;
}

export const emptyIteration = (block: DesignCycleData): Iteration => ({ plan: "", shownToTeacher: false, safety: block.safety.map(() => false), results: {}, improvement: "", improvementTold: false });

const unit = (value: number, c: Criterion) => `${value}${c.unit ? ` ${c.unit}` : ""}`;
const NUMBER = /^-?(\d+(\.\d*)?|\.\d+)$/;
export const criterionGoal = (c: Criterion) => `${c.comparison === "AT_LEAST" ? "at least" : "at most"} ${unit(c.target, c)}`;

/** One measured result against its criterion. Null when the entry is not a number yet. */
export function judge(c: Criterion, raw: string): CriterionResult | null {
  const s = raw.trim();
  if (!NUMBER.test(s) || !Number.isFinite(Number(s))) return null;
  const value = Number(s), met = c.comparison === "AT_LEAST" ? value >= c.target : value <= c.target;
  const gap = Math.abs(Number((value - c.target).toFixed(6)));
  const message = met ? `Meets it: ${unit(value, c)} (needed ${criterionGoal(c)}).`
    : `Not yet: ${unit(value, c)}, needed ${criterionGoal(c)}. ${unit(gap, c)} ${c.comparison === "AT_LEAST" ? "short" : "over"}.`;
  return { criterionId: c.id, value, met, gap: met ? 0 : gap, message };
}

/**
 * The table columns a linked cycle feeds, by criterion id (T1-P6-FEED-01). A linked criterion's result is also a table
 * observation, so it must obey that column (range and precision) before the design is evaluated. Empty without a link
 * or before the linked table has published its columns in the same ActivityScope.
 */
export type LinkedColumns = Readonly<Record<string, MeasurementColumn>>;
/** Any ActivityScope snapshot: only a MEASUREMENT_TABLE one carries column definitions. */
export type ScopeSnapshot = Readonly<{ kind: "MEASUREMENT_TABLE"; columns: readonly MeasurementColumn[] }> | Readonly<{ kind: "DESIGN_FEED" }>;
export function linkedColumns(block: DesignCycleData, table: ScopeSnapshot | undefined): LinkedColumns {
  if (!block.measurement || !table || table.kind !== "MEASUREMENT_TABLE") return {};
  const out: Record<string, MeasurementColumn> = {};
  for (const { criterionId, columnId } of block.measurement.criterionColumns) {
    const col = table.columns.find((c) => c.id === columnId);
    if (col) out[criterionId] = col;
  }
  return out;
}

/** The linked column's message for an entry that breaks it (range or precision), or null (no column, empty, or valid). */
export function linkedEntryProblem(criterionId: string, raw: string, columns: LinkedColumns): string | null {
  const col = columns[criterionId];
  if (!col || !raw.trim()) return null;
  const read = readEntry(raw, col);
  return isEntryProblem(read) ? read.message : null;
}

/**
 * Each criterion judged once, in block order; null until every criterion has a number that also obeys its linked
 * column, so an invalid observation never evaluates, never meets a criterion and never completes the cycle.
 */
export function evaluate(block: DesignCycleData, iteration: Iteration, columns: LinkedColumns = {}): readonly CriterionResult[] | null {
  const results = block.criteria.map((c) => {
    const raw = iteration.results[c.id] ?? "";
    return linkedEntryProblem(c.id, raw, columns) === null ? judge(c, raw) : null;
  });
  return results.every(Boolean) ? (results as CriterionResult[]) : null;
}

/** How far a result moved relative to the previous iteration: closer to (or past) the target, further, or the same. */
export function trend(current: CriterionResult, previous: CriterionResult | undefined): Trend {
  if (!previous) return null;
  if (current.gap < previous.gap) return "CLOSER";
  if (current.gap > previous.gap) return "FURTHER";
  return "SAME";
}

/** A stage can open only when the one before it is finished. */
export function stageReady(block: DesignCycleData, iteration: Iteration, stage: Stage, columns: LinkedColumns = {}): boolean {
  const planned = iteration.plan.trim().length > 0 || iteration.shownToTeacher;
  const safe = iteration.safety.length === block.safety.length && iteration.safety.every(Boolean);
  switch (stage) {
    case "PLAN": return true;
    case "SAFETY": return planned;
    case "TEST": return planned && safe;
    case "EVALUATE": return planned && safe && evaluate(block, iteration, columns) !== null;
  }
}

/** The next design needs a stated change: written, or told to the teacher (young or non-typing learners). */
export const improvementReady = (iteration: Iteration) => iteration.improvement.trim().length > 0 || iteration.improvementTold;

export type CycleStatus = "IN_PROGRESS" | "ALL_CRITERIA_MET" | "OUT_OF_ITERATIONS";
/** Over the finished iterations (those with results for every criterion). */
export function cycleStatus(block: DesignCycleData, finished: readonly (readonly CriterionResult[])[]): CycleStatus {
  if (finished.some((r) => r.every((x) => x.met))) return "ALL_CRITERIA_MET";
  return finished.length >= block.maxIterations ? "OUT_OF_ITERATIONS" : "IN_PROGRESS";
}

export function cycleFeedback(block: DesignCycleData, results: readonly CriterionResult[], status: CycleStatus, iterationNumber: number): string {
  const missed = results.filter((r) => !r.met).map((r) => block.criteria.find((c) => c.id === r.criterionId)!.description);
  if (status === "ALL_CRITERIA_MET") return `Design ${iterationNumber} meets every criterion. Explain which change made the difference.`;
  if (status === "OUT_OF_ITERATIONS") return `You used all ${block.maxIterations} tries. Not yet met: ${missed.join("; ")}. Write what you would change next and why: engineers learn from every test.`;
  return `Not yet met: ${missed.join("; ")}. Decide one change to try, write why, then test design ${iterationNumber + 1}.`;
}

/** Another design may be tested while capacity remains, even after one meets every criterion (designs are compared). */
export const canTestAnotherDesign = (block: DesignCycleData, designsSoFar: number) => designsSoFar < block.maxIterations;

/**
 * Feedback on the design just tested (the last of `evaluated`, one entry per design): its own results first, never an
 * earlier design's. An earlier success is named for comparison; remaining capacity is offered, never required.
 */
export function designFeedback(block: DesignCycleData, evaluated: readonly (readonly CriterionResult[] | null)[]): string {
  const n = evaluated.length, current = evaluated[n - 1];
  if (!current) return "";
  const more = canTestAnotherDesign(block, n);
  if (current.every((r) => r.met)) {
    if (n === 1) return more ? `Design 1 meets every criterion. You can still test design 2 to compare: change one thing, say why, and see how the results move.` : "Design 1 meets every criterion.";
    return `Design ${n} meets every criterion. Explain which change made the difference.${more ? ` You can test design ${n + 1} to compare, or stop here.` : ""}`;
  }
  const earlier = evaluated.slice(0, -1).findIndex((r) => r !== null && r.every((x) => x.met));
  if (earlier >= 0) {
    const missed = current.filter((r) => !r.met).map((r) => block.criteria.find((c) => c.id === r.criterionId)!.description);
    return `Not yet met: ${missed.join("; ")}. Design ${earlier + 1} met every criterion: compare the two designs and explain what made the difference.${more ? ` You can test design ${n + 1}.` : ""}`;
  }
  const finished = evaluated.filter((r): r is readonly CriterionResult[] => r !== null);
  return cycleFeedback(block, current, cycleStatus(block, finished), n);
}

/**
 * With a `measurement` link: what the cycle feeds its table. Row i is design i+1, filled only once that design is fully
 * tested (every criterion has a number); later designs stay empty. Undefined without a link.
 */
export function designFeed(block: DesignCycleData, evaluated: readonly (readonly CriterionResult[] | null)[]) {
  const link = block.measurement;
  if (!link) return undefined;
  return { kind: "DESIGN_FEED" as const, tableId: link.tableId, columns: link.criterionColumns.map((m) => m.columnId),
    rows: evaluated.map((results) => Object.fromEntries(link.criterionColumns.map((m) => [m.columnId, results?.find((r) => r.criterionId === m.criterionId)?.value ?? null]))) };
}
