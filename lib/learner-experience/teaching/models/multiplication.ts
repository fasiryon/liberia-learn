/** Interactive Learning V4 — multiplication models: equal groups, arrays, repeated addition and the area model. */

export function repeatedAddition(groups: number, size: number): string {
  return Array.from({ length: groups }, () => String(size)).join(" + ");
}

/** Place-value split of a whole number: 47 → [40, 7]; 305 → [300, 5]. Zero parts are dropped. */
export function placeValueParts(value: number): number[] {
  const digits = String(Math.trunc(Math.abs(value))).split("").map(Number);
  return digits.map((digit, index) => digit * 10 ** (digits.length - 1 - index)).filter((part) => part !== 0);
}

export type AreaModel = Readonly<{ rows: readonly number[]; columns: readonly number[]; cells: readonly (readonly number[])[]; total: number }>;

/** Partial products of a split × split area model; the total always equals the product of the sums. */
export function areaModel(rowParts: readonly number[], columnParts: readonly number[]): AreaModel {
  const cells = rowParts.map((row) => columnParts.map((column) => row * column));
  return { rows: rowParts, columns: columnParts, cells, total: cells.flat().reduce((sum, value) => sum + value, 0) };
}

export function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

export type PartialDiagnosis = Readonly<{ kind: "CORRECT" | "EMPTY" | "PLACE_VALUE_DROPPED" | "ADDED_INSTEAD" | "NOT_YET" }>;

/** One partial-product cell: names "4 × 30 written as 4 × 3" and "added instead of multiplied". */
export function diagnosePartial(row: number, column: number, entered: number | null): PartialDiagnosis {
  if (entered === null) return { kind: "EMPTY" };
  const product = row * column;
  if (entered === product) return { kind: "CORRECT" };
  const strip = (value: number) => Number(String(value).replace(/0+$/, "")) || value;
  if (entered === strip(row) * strip(column)) return { kind: "PLACE_VALUE_DROPPED" };
  if (entered === row + column) return { kind: "ADDED_INSTEAD" };
  return { kind: "NOT_YET" };
}
