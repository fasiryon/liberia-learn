/**
 * MEASUREMENT_TABLE logic (teaching-blocks/1.2.0). The field shape and every refinement are the canonical registry
 * schema (BLOCK_SCHEMAS_1_2.MEASUREMENT_TABLE); this file only adds what the renderer needs: reading a learner's typed
 * entry against its column (number, range, precision) and the derived values the block asks for.
 * MEASURED_BY_LEARNER tables are never pre-filled (the schema forbids it). ILLUSTRATIVE values are shown read-only and
 * always labelled as not real measurements. Nothing is scored, saved or recorded.
 */
import type { z } from "zod";
import { BLOCK_SCHEMAS_1_2 } from "@/lib/learner-experience/teaching/registry-1.2";

export type MeasurementTableData = z.infer<typeof BLOCK_SCHEMAS_1_2.MEASUREMENT_TABLE>;
export type MeasurementColumn = MeasurementTableData["columns"][number];
export type Derived = MeasurementTableData["derived"][number];
export type EntryResult = Readonly<{ ok: true; value: number } | { ok: false; problem: "EMPTY" | "NOT_A_NUMBER" | "OUT_OF_RANGE" | "TOO_PRECISE"; message: string }>;
/** The repository compiles with strict: false, where the union does not narrow on `ok`; read `problem`/`message` through this. */
export const isEntryProblem = (r: EntryResult): r is Extract<EntryResult, { ok: false }> => !r.ok;

/** Strict registry parse; a table that does not validate is not rendered. */
export function validateMeasurementTable(block: unknown): MeasurementTableData {
  const parsed = BLOCK_SCHEMAS_1_2.MEASUREMENT_TABLE.safeParse(block);
  if (!parsed.success) throw Error(`measurement_table_invalid:${parsed.error.issues[0]?.message ?? "schema"}`);
  return parsed.data;
}

const withUnit = (value: number, col: MeasurementColumn) => `${value}${col.unit ? ` ${col.unit}` : ""}`;
const NUMBER = /^-?(\d+(\.\d*)?|\.\d+)$/;

/** A typed cell, read against its column. Plain decimal numbers only; a comma is not a decimal separator here. */
export function readEntry(raw: string, col: MeasurementColumn): EntryResult {
  const s = raw.trim();
  if (!s) return { ok: false, problem: "EMPTY", message: "Not measured yet." };
  if (!NUMBER.test(s)) return { ok: false, problem: "NOT_A_NUMBER", message: "Type a number, for example 12 or 12.5." };
  const value = Number(s), decimals = s.includes(".") ? s.split(".")[1].length : 0;
  if (!Number.isFinite(value)) return { ok: false, problem: "NOT_A_NUMBER", message: "Type a number, for example 12 or 12.5." };
  if (value < col.minimum || value > col.maximum) return { ok: false, problem: "OUT_OF_RANGE", message: `Check this one: it should be from ${withUnit(col.minimum, col)} to ${withUnit(col.maximum, col)}.` };
  if (decimals > col.precision) return { ok: false, problem: "TOO_PRECISE", message: col.precision === 0 ? "Round to a whole number." : `Round to ${col.precision} decimal place${col.precision === 1 ? "" : "s"}.` };
  return { ok: true, value };
}

const round = (value: number, places: number) => Number(value.toFixed(places));

/**
 * A number (not typed text) checked against its column with the same rules as a typed entry: within the column's range
 * and no finer than its precision. Used for values a linked DESIGN_CYCLE feeds, which the cycle itself cannot check
 * against the column (it accepts any measured number for its criterion).
 */
export function checkValue(value: number, col: MeasurementColumn): EntryResult {
  if (!Number.isFinite(value)) return { ok: false, problem: "NOT_A_NUMBER", message: "Type a number, for example 12 or 12.5." };
  if (value < col.minimum || value > col.maximum) return { ok: false, problem: "OUT_OF_RANGE", message: `Check this one: it should be from ${withUnit(col.minimum, col)} to ${withUnit(col.maximum, col)}.` };
  if (round(value, col.precision) !== value) return { ok: false, problem: "TOO_PRECISE", message: col.precision === 0 ? "Round to a whole number." : `Round to ${col.precision} decimal place${col.precision === 1 ? "" : "s"}.` };
  return { ok: true, value };
}

/** The derived values the block lists, over the valid values of one column. Empty when nothing is measured yet. */
export function deriveColumn(values: readonly number[], col: MeasurementColumn, derived: readonly Derived[]): ReadonlyArray<Readonly<{ kind: Derived; value: number; text: string }>> {
  if (!values.length) return [];
  const min = Math.min(...values), max = Math.max(...values);
  // The mean keeps one more decimal place than the readings, so a mean of whole numbers is not falsely rounded.
  const calc: Record<Derived, number> = { MEAN: round(values.reduce((a, b) => a + b, 0) / values.length, col.precision + 1), MINIMUM: min, MAXIMUM: max, RANGE: round(max - min, col.precision) };
  return derived.map((kind) => ({ kind, value: calc[kind], text: withUnit(calc[kind], col) }));
}

export const DERIVED_LABEL: Record<Derived, string> = { MEAN: "Mean (average)", MINIMUM: "Smallest", MAXIMUM: "Largest", RANGE: "Range (largest minus smallest)" };

/**
 * Columns a linked DESIGN_CYCLE fills (teaching-blocks/1.3.0 candidate): row t is design t+1's tested result. Those cells
 * have one source, the design cycle, so they are never typed in the table; an untested design's cell stays empty.
 */
export type TableFeed = Readonly<{ columns: readonly string[]; rows: ReadonlyArray<Readonly<Record<string, number | null>>> }>;
export const isFed = (feed: TableFeed | undefined, colId: string) => Boolean(feed?.columns.includes(colId));
export const fedValue = (feed: TableFeed | undefined, trial: number, colId: string): number | null => (isFed(feed, colId) ? feed!.rows[trial]?.[colId] ?? null : null);

/** Cells the learner fills in: every cell of a learner table, and only the blank cells of an illustrative one; never a fed cell. */
export const isEditable = (table: MeasurementTableData, trial: number, colId: string, feed?: TableFeed) => table.trials[trial]?.[colId] === null && !isFed(feed, colId);

/** Every editable cell holds a valid entry. A table with no editable cell is complete when read. */
export function tableComplete(table: MeasurementTableData, entries: Readonly<Record<string, string>>, feed?: TableFeed): boolean {
  return table.trials.every((row, t) => table.columns.every((col) => !isEditable(table, t, col.id, feed) || readEntry(entries[cellKey(t, col.id)] ?? "", col).ok));
}
export const cellKey = (trial: number, colId: string) => `${trial}:${colId}`;

/** One cell's usable value: given, fed by the linked design and valid for the column, or a valid learner entry. */
export function cellValue(table: MeasurementTableData, trial: number, col: MeasurementColumn, entries: Readonly<Record<string, string>>, feed?: TableFeed): number | null {
  const given = table.trials[trial]?.[col.id];
  if (given !== null && given !== undefined) return given;
  if (isFed(feed, col.id)) {
    // A fed result obeys the column exactly like a typed entry; one outside its rules is not a usable observation.
    const fed = fedValue(feed, trial, col.id);
    if (fed === null) return null;
    const checked = checkValue(fed, col);
    return checked.ok ? checked.value : null;
  }
  const read = readEntry(entries[cellKey(trial, col.id)] ?? "", col);
  return read.ok ? read.value : null;
}

/** The column's usable values: given illustrative values, fed design results and valid learner entries. */
export function columnValues(table: MeasurementTableData, col: MeasurementColumn, entries: Readonly<Record<string, string>>, feed?: TableFeed): number[] {
  return table.trials.flatMap((_, t) => { const v = cellValue(table, t, col, entries, feed); return v === null ? [] : [v]; });
}

export const originText = (table: MeasurementTableData) =>
  table.origin === "ILLUSTRATIVE" ? `Illustrative numbers, not real measurements. ${table.originNote}` : `Your own measurements. ${table.originNote}`;
