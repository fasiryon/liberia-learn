/**
 * Interactive Learning V4 — reading and diagnosing a learner's typed numeric answer.
 *
 * Formative only: the expected value lives in the lesson (as for every formative check) so feedback is
 * instant and offline. A diagnosis explains the attempt; it is never a score and is never sent anywhere.
 */
import { shapeArea, shapePerimeter, type ShapeSpec } from "./geometry";

export const QUANTITIES = ["AREA", "PERIMETER", "LENGTH", "COUNT", "PRODUCT", "OTHER"] as const;
export type Quantity = (typeof QUANTITIES)[number];

export type UnitKind = "LENGTH" | "AREA" | "NONE";

/** Units a learner may type or choose, normalized: "m2", "sq m", "square metres" → AREA in m. */
export function parseUnit(raw: string): { kind: UnitKind; base: string } | null {
  const text = raw.trim().toLowerCase().replace(/\.$/, "");
  if (!text) return { kind: "NONE", base: "" };
  const area = /^(?:sq(?:uare)?\.?\s*(m|cm|mm|km|metres?|meters?|centimetres?|centimeters?)|(m|cm|mm|km)\s*(?:\^?2|²)|square\s+(m|cm|mm|km|metres?|meters?|centimetres?|centimeters?|units?))$/.exec(text);
  if (area) return { kind: "AREA", base: normalizeLengthUnit(area[1] ?? area[2] ?? area[3]) };
  const length = /^(m|cm|mm|km|metres?|meters?|centimetres?|centimeters?|units?)$/.exec(text);
  if (length) return { kind: "LENGTH", base: normalizeLengthUnit(length[1]) };
  return null;
}

function normalizeLengthUnit(unit: string): string {
  if (/^(m|metres?|meters?)$/.test(unit)) return "m";
  if (/^(cm|centimetres?|centimeters?)$/.test(unit)) return "cm";
  if (/^units?$/.test(unit)) return "unit";
  return unit;
}

/**
 * "4,050", "4050 m²", "4 050", "270m" → value and unit text; fractions "3/4", "6/8" and mixed numbers "1 1/4" are
 * read exactly as their value, so any equivalent fraction is accepted. Returns null when there is no number.
 */
export function parseAnswer(raw: string): { value: number; unit: string } | null {
  const text = (raw ?? "").trim();
  const mixed = /^(-?\d+)\s+(\d+)\s*\/\s*(\d+)\s*(.*)$/.exec(text);
  if (mixed && Number(mixed[3]) > 0) return { value: Number(mixed[1]) + Math.sign(Number(mixed[1]) || 1) * (Number(mixed[2]) / Number(mixed[3])), unit: mixed[4].trim() };
  const fraction = /^(-?\d+)\s*\/\s*(\d+)\s*(.*)$/.exec(text);
  if (fraction) return Number(fraction[2]) > 0 ? { value: Number(fraction[1]) / Number(fraction[2]), unit: fraction[3].trim() } : null;
  const match = /^(-?\d{1,3}(?:[ ,]\d{3})+(?:\.\d+)?|-?\d+(?:\.\d+)?)\s*(.*)$/.exec(text);
  if (!match) return null;
  const value = Number(match[1].replace(/[ ,]/g, ""));
  return Number.isFinite(value) ? { value, unit: match[2].trim() } : null;
}

export type AuthoredMisconception = Readonly<{ value: number; feedback: string; misconceptionId?: string }>;

export type ResponsePart = Readonly<{
  id: string;
  label: string;
  quantity: Quantity;
  /** The unit the answer is measured in ("m" for a length, "m" with kind AREA for square metres), or none. */
  unit: Readonly<{ kind: UnitKind; base: string }>;
  formativeKey: Readonly<{ value: number; tolerance?: number }>;
  misconceptions: readonly AuthoredMisconception[];
}>;

export type Diagnosis = Readonly<{
  result: "right" | "retry" | "pending";
  code: "EMPTY" | "NOT_A_NUMBER" | "CORRECT" | "UNIT_MISSING" | "UNIT_WRONG" | "AREA_PERIMETER_SWAP" | "HALF_PERIMETER" | "FORGOT_HALF" | "AUTHORED" | "CLOSE" | "NOT_YET";
  text: string;
  misconceptionId?: string;
}>;

const near = (a: number, b: number, tolerance = 0) => Math.abs(a - b) <= Math.max(tolerance, 1e-9);
const squareLabel = (base: string) => (base === "unit" ? "square units" : `square ${base === "m" ? "metres" : base === "cm" ? "centimetres" : base}`);

/**
 * Diagnose one part of an answer. Order matters: a unit problem is only named once the number is right, and
 * automatic geometry diagnoses (area/perimeter swap, half perimeter, forgotten ½) come before authored ones.
 */
export function diagnoseNumeric(part: ResponsePart, rawValue: string, rawUnit: string, shape?: ShapeSpec): Diagnosis {
  if (!rawValue.trim()) return { result: "pending", code: "EMPTY", text: "Enter a number." };
  const parsed = parseAnswer(rawValue);
  if (!parsed) return { result: "retry", code: "NOT_A_NUMBER", text: "Write your answer as a number, for example 120, or a fraction such as 3/4." };
  const unitText = rawUnit.trim() || parsed.unit;
  const unit = parseUnit(unitText);
  const key = part.formativeKey.value;
  const value = parsed.value;
  if (near(value, key, part.formativeKey.tolerance)) {
    if (part.unit.kind !== "NONE") {
      if (!unit || unit.kind === "NONE") return { result: "retry", code: "UNIT_MISSING", text: `The number is right. Add the unit: ${part.unit.kind === "AREA" ? squareLabel(part.unit.base) : part.unit.base}.` };
      if (unit.kind !== part.unit.kind) return { result: "retry", code: "UNIT_WRONG", text: part.unit.kind === "AREA" ? `The number is right, but area is measured in square units (${squareLabel(part.unit.base)}), because it counts squares that cover the inside.` : `The number is right, but a perimeter is a length, so it is measured in ${part.unit.base}, not square units.` };
      if (unit.base !== part.unit.base) return { result: "retry", code: "UNIT_WRONG", text: `Check the unit. The measurements are in ${part.unit.base}.` };
    }
    return { result: "right", code: "CORRECT", text: "" };
  }
  // An automatic diagnosis keeps the authored misconception id for the same value, so it stays diagnosable.
  const linked = part.misconceptions.find((entry) => near(value, entry.value))?.misconceptionId;
  const auto = (diagnosis: Omit<Diagnosis, "misconceptionId">): Diagnosis => (linked ? { ...diagnosis, misconceptionId: linked } : diagnosis);
  if (shape) {
    const area = shapeArea(shape), perimeter = shapePerimeter(shape);
    if (part.quantity === "AREA" && perimeter !== null && near(value, perimeter)) return auto({ result: "retry", code: "AREA_PERIMETER_SWAP", text: "That is the perimeter: the distance around the outside. Area counts the squares that cover the inside."});
    if (part.quantity === "PERIMETER" && near(value, area)) return auto({ result: "retry", code: "AREA_PERIMETER_SWAP", text: "That is the area: the squares inside the shape. Perimeter is the distance all the way around the edge, so add the lengths of every side."});
    if (part.quantity === "PERIMETER" && shape.kind === "RECTANGLE" && near(value, shape.length + shape.width)) return auto({ result: "retry", code: "HALF_PERIMETER", text: "You added one length and one width. That is only half of the way round. A rectangle has two lengths and two widths: 2 × (length + width)."});
    if (part.quantity === "AREA" && shape.kind === "TRIANGLE" && near(value, shape.base * shape.height)) return auto({ result: "retry", code: "FORGOT_HALF", text: "That is base × height, the area of the whole rectangle around the triangle. The triangle is exactly half of it: ½ × base × height."});
  }
  const authored = part.misconceptions.find((entry) => near(value, entry.value));
  if (authored) return { result: "retry", code: "AUTHORED", text: authored.feedback, misconceptionId: authored.misconceptionId };
  if (key !== 0 && Math.abs(value - key) / Math.abs(key) <= 0.1) return { result: "retry", code: "CLOSE", text: "You are close. Check your arithmetic one step at a time." };
  return { result: "retry", code: "NOT_YET", text: part.quantity === "AREA" ? "Not yet. Which two measurements cover the inside? Multiply them." : part.quantity === "PERIMETER" ? "Not yet. Trace the edge with your finger and add every side you pass." : "Not yet. Check each step." };
}
