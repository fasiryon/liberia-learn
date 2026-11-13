/**
 * GRAPH_BUILDER logic (teaching-blocks/1.2.0). Field shape is the canonical registry schema; the same-package rule that
 * `sourceBlockId` names a MEASUREMENT_TABLE with both axis columns is validateBlockReferences_1_2. The learner picks a
 * graph kind from `allowedKinds` and puts columns on the axes; feedback is derived by comparing the choice with
 * `axisRules`. Points come only from the source table's values (given, or the learner's valid entries). Nothing is scored.
 */
import type { z } from "zod";
import { BLOCK_SCHEMAS_1_2 } from "@/lib/learner-experience/teaching/registry-1.2";

export type GraphBuilderData = z.infer<typeof BLOCK_SCHEMAS_1_2.GRAPH_BUILDER>;
export type GraphKind = GraphBuilderData["allowedKinds"][number];
type Column = Readonly<{ id: string; label: string; unit: string }>;
export type GraphPoint = Readonly<{ trial: number; x: number; y: number }>;
export type AxisCheck = Readonly<{ state: "INCOMPLETE" | "CORRECT" | "SWAPPED" | "WRONG"; message: string }>;

export function validateGraphBuilder(block: unknown): GraphBuilderData {
  const parsed = BLOCK_SCHEMAS_1_2.GRAPH_BUILDER.safeParse(block);
  if (!parsed.success) throw Error(`graph_builder_invalid:${parsed.error.issues[0]?.message ?? "schema"}`);
  if (parsed.data.axisRules.xColumn === parsed.data.axisRules.yColumn) throw Error("graph_builder_invalid:same_axis_column");
  return parsed.data;
}

export const KIND_LABEL: Record<GraphKind, string> = { BAR: "Bar graph", LINE: "Line graph", SCATTER: "Scatter plot" };
const name = (c: Column | undefined) => (c ? `${c.label}${c.unit ? ` (${c.unit})` : ""}` : "");

/** Trials with a number in both chosen columns, in trial order. */
export function graphPoints(rows: ReadonlyArray<Readonly<Record<string, number | null>>>, xColumn: string, yColumn: string): GraphPoint[] {
  return rows.flatMap((row, trial) => (typeof row[xColumn] === "number" && typeof row[yColumn] === "number" ? [{ trial: trial + 1, x: row[xColumn] as number, y: row[yColumn] as number }] : []));
}

/** Compares the learner's axes with the block's rule and says what to change. */
export function checkAxes(block: GraphBuilderData, columns: readonly Column[], x: string, y: string): AxisCheck {
  const want = { x: columns.find((c) => c.id === block.axisRules.xColumn), y: columns.find((c) => c.id === block.axisRules.yColumn) };
  if (!x || !y) return { state: "INCOMPLETE", message: "Choose what goes along the bottom and what goes up the side." };
  if (x === block.axisRules.xColumn && y === block.axisRules.yColumn) return { state: "CORRECT", message: `Good: ${name(want.x)} along the bottom, ${name(want.y)} up the side.` };
  if (x === block.axisRules.yColumn && y === block.axisRules.xColumn) return { state: "SWAPPED", message: `Swap them: ${name(want.x)} is what you chose or changed, so it goes along the bottom. ${name(want.y)} is what you measured, so it goes up the side.` };
  return { state: "WRONG", message: `For this question, put ${name(want.x)} along the bottom and ${name(want.y)} up the side.` };
}

/** A readable axis: about four steps of 1, 2 or 5 times a power of ten. With a zero baseline the axis starts at 0. */
export function niceScale(values: readonly number[], zeroBaseline: boolean): Readonly<{ min: number; max: number; ticks: readonly number[] }> {
  let lo = Math.min(...values), hi = Math.max(...values);
  if (zeroBaseline) { lo = Math.min(0, lo); hi = Math.max(0, hi); }
  if (lo === hi) { hi = lo + 1; if (!zeroBaseline) lo = lo - 1; }
  const raw = (hi - lo) / 4, power = 10 ** Math.floor(Math.log10(raw)), step = [1, 2, 5, 10].map((m) => m * power).find((s) => s >= raw)!;
  const min = Math.floor(lo / step) * step, max = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let t = min; t <= max + step / 2; t += step) ticks.push(Number(t.toFixed(10)));
  return { min, max, ticks };
}

/** One sentence a screen reader can use in place of the picture. */
export function graphSummary(kind: GraphKind, points: readonly GraphPoint[], x: Column, y: Column): string {
  if (!points.length) return "No points yet.";
  const highest = points.reduce((a, b) => (b.y > a.y ? b : a)), lowest = points.reduce((a, b) => (b.y < a.y ? b : a));
  return `${KIND_LABEL[kind]} of ${name(y)} against ${name(x)}, ${points.length} point${points.length === 1 ? "" : "s"}. Highest: ${highest.y} at ${highest.x}. Lowest: ${lowest.y} at ${lowest.x}.`;
}
