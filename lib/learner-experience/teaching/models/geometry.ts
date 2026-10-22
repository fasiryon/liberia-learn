/**
 * Interactive Learning V4 — exact geometry for the shape blocks and their formative feedback.
 *
 * Every number a shape block shows, and every value a learner's answer is compared with, comes from these
 * functions, never from an authored figure, so a diagram and its key cannot disagree.
 */

export type RectangleShape = Readonly<{ kind: "RECTANGLE"; length: number; width: number; unit: string }>;
/** Base along the bottom; the apex sits `apexOffset` along the base from the left corner, `height` above it. */
export type TriangleShape = Readonly<{ kind: "TRIANGLE"; base: number; height: number; apexOffset: number; unit: string; sideLabels?: readonly [number, number] }>;
/** Whole-unit rectangles on a grid that touch but do not overlap (an L-shape, a room plan). */
export type CompositeShape = Readonly<{ kind: "COMPOSITE"; rects: readonly Readonly<{ x: number; y: number; w: number; h: number }>[]; unit: string }>;
export type ShapeSpec = RectangleShape | TriangleShape | CompositeShape;

export const SHAPE_VIEWS = ["GRID", "AREA", "PERIMETER", "HEIGHT"] as const;
export type ShapeView = (typeof SHAPE_VIEWS)[number];

const round = (value: number, places = 4) => Math.round(value * 10 ** places) / 10 ** places;

export function rectangleArea(length: number, width: number): number { return round(length * width); }
export function rectanglePerimeter(length: number, width: number): number { return round(2 * (length + width)); }
export function triangleArea(base: number, height: number): number { return round((base * height) / 2); }
export function trianglePerimeter(a: number, b: number, c: number): number { return round(a + b + c); }
export function isTriangle(a: number, b: number, c: number): boolean { return a > 0 && b > 0 && c > 0 && a + b > c && a + c > b && b + c > a; }

/** The two slanted sides of a triangle from its base, height and apex position (exact, before any rounding for labels). */
export function triangleSides(shape: TriangleShape): [number, number] {
  return [Math.hypot(shape.apexOffset, shape.height), Math.hypot(shape.base - shape.apexOffset, shape.height)];
}

function compositeCells(shape: CompositeShape): Set<string> {
  const cells = new Set<string>();
  for (const rect of shape.rects) for (let x = rect.x; x < rect.x + rect.w; x++) for (let y = rect.y; y < rect.y + rect.h; y++) cells.add(`${x},${y}`);
  return cells;
}

export function compositeOverlaps(shape: CompositeShape): boolean {
  const total = shape.rects.reduce((sum, rect) => sum + rect.w * rect.h, 0);
  return compositeCells(shape).size !== total;
}

/** Edges of unit cells that are not shared with another cell: exactly the length of the boundary. */
export function compositePerimeter(shape: CompositeShape): number {
  const cells = compositeCells(shape);
  let edges = 0;
  for (const cell of cells) {
    const [x, y] = cell.split(",").map(Number);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!cells.has(`${x + dx},${y + dy}`)) edges++;
  }
  return edges;
}

export function shapeArea(shape: ShapeSpec): number {
  if (shape.kind === "RECTANGLE") return rectangleArea(shape.length, shape.width);
  if (shape.kind === "TRIANGLE") return triangleArea(shape.base, shape.height);
  return compositeCells(shape).size;
}

/** Perimeter, or null for a triangle whose slanted sides are not whole labelled lengths. */
export function shapePerimeter(shape: ShapeSpec): number | null {
  if (shape.kind === "RECTANGLE") return rectanglePerimeter(shape.length, shape.width);
  if (shape.kind === "COMPOSITE") return compositePerimeter(shape);
  if (!shape.sideLabels) return null;
  return trianglePerimeter(shape.base, shape.sideLabels[0], shape.sideLabels[1]);
}

/** Problems with a shape spec (empty = valid). Labelled triangle sides must match the drawn geometry. */
export function shapeProblems(shape: ShapeSpec): string[] {
  const problems: string[] = [];
  const positive = (value: number) => Number.isFinite(value) && value > 0;
  if (!shape.unit.trim()) problems.push("shape_unit_required");
  if (shape.kind === "RECTANGLE" && (!positive(shape.length) || !positive(shape.width))) problems.push("rectangle_dimensions_invalid");
  if (shape.kind === "TRIANGLE") {
    if (!positive(shape.base) || !positive(shape.height)) problems.push("triangle_dimensions_invalid");
    if (shape.sideLabels) {
      const [left, right] = triangleSides(shape);
      if (Math.abs(left - shape.sideLabels[0]) > 0.05 || Math.abs(right - shape.sideLabels[1]) > 0.05) problems.push("triangle_side_labels_inconsistent");
      if (!isTriangle(shape.base, shape.sideLabels[0], shape.sideLabels[1])) problems.push("triangle_inequality_failed");
    }
  }
  if (shape.kind === "COMPOSITE") {
    if (shape.rects.length === 0 || shape.rects.some((rect) => ![rect.x, rect.y, rect.w, rect.h].every(Number.isInteger) || rect.w <= 0 || rect.h <= 0 || rect.x < 0 || rect.y < 0)) problems.push("composite_rects_invalid");
    else if (compositeOverlaps(shape)) problems.push("composite_rects_overlap");
  }
  return problems;
}

export function formatMeasure(value: number): string {
  return Number.isInteger(value) ? value.toLocaleString("en-US") : value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

/** A text equivalent of the diagram for screen readers and the text-only fallback. */
export function describeShape(shape: ShapeSpec): string {
  const u = shape.unit;
  if (shape.kind === "RECTANGLE") return `A rectangle ${formatMeasure(shape.length)} ${u} long and ${formatMeasure(shape.width)} ${u} wide. Area ${formatMeasure(shapeArea(shape))} square ${u}; perimeter ${formatMeasure(shapePerimeter(shape)!)} ${u}.`;
  if (shape.kind === "TRIANGLE") {
    const sides = shape.sideLabels ? ` Its other two sides are ${formatMeasure(shape.sideLabels[0])} ${u} and ${formatMeasure(shape.sideLabels[1])} ${u}.` : "";
    return `A triangle with a base of ${formatMeasure(shape.base)} ${u} and a perpendicular height of ${formatMeasure(shape.height)} ${u}, measured at a right angle to the base.${sides}`;
  }
  return `A shape made of ${shape.rects.length} rectangles on a grid of 1 ${u} squares: ${shape.rects.map((rect) => `${rect.w} by ${rect.h}`).join(" and ")}. It covers ${shapeArea(shape)} squares.`;
}
