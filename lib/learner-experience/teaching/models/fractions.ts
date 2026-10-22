/** Interactive Learning V4 — exact fraction arithmetic for the fraction blocks (no floating-point comparison). */

export type Fraction = Readonly<{ numerator: number; denominator: number }>;
export type Relation = "<" | "=" | ">";

export function gcd(a: number, b: number): number {
  let x = Math.abs(a), y = Math.abs(b);
  while (y) [x, y] = [y, x % y];
  return x || 1;
}

export function isValidFraction(value: Fraction, maxDenominator = 24): boolean {
  return Number.isInteger(value.numerator) && Number.isInteger(value.denominator) && value.denominator >= 1 && value.denominator <= maxDenominator && value.numerator >= 0;
}

export function simplify(value: Fraction): Fraction {
  const divisor = gcd(value.numerator, value.denominator);
  return { numerator: value.numerator / divisor, denominator: value.denominator / divisor };
}

export function equivalent(a: Fraction, b: Fraction): boolean {
  return a.numerator * b.denominator === b.numerator * a.denominator;
}

/** Cross-multiplication, exact for whole numbers. */
export function compare(a: Fraction, b: Fraction): Relation {
  const left = a.numerator * b.denominator, right = b.numerator * a.denominator;
  return left === right ? "=" : left < right ? "<" : ">";
}

export function scale(value: Fraction, factor: number): Fraction {
  return { numerator: value.numerator * factor, denominator: value.denominator * factor };
}

export function fractionTex(value: Fraction): string {
  return `\\frac{${value.numerator}}{${value.denominator}}`;
}

export type ShadeDiagnosis =
  | Readonly<{ kind: "MATCH" }>
  | Readonly<{ kind: "EQUIVALENT"; shown: Fraction }>
  | Readonly<{ kind: "COUNTED_UNSHADED"; shown: Fraction }>
  | Readonly<{ kind: "WRONG_WHOLE"; shown: Fraction }>
  | Readonly<{ kind: "NOT_YET"; shown: Fraction }>;

/**
 * A shading attempt against a target fraction. A different but equivalent partition counts as right
 * (6/8 shows 3/4); shading the complement and partitioning into the wrong number of parts are named.
 */
export function diagnoseShading(target: Fraction, parts: number, shaded: number): ShadeDiagnosis {
  const shown = { numerator: shaded, denominator: parts };
  if (parts === target.denominator && shaded === target.numerator) return { kind: "MATCH" };
  if (equivalent(shown, target)) return { kind: "EQUIVALENT", shown };
  if (equivalent({ numerator: parts - shaded, denominator: parts }, target)) return { kind: "COUNTED_UNSHADED", shown };
  if (shaded === target.numerator && parts !== target.denominator) return { kind: "WRONG_WHOLE", shown };
  return { kind: "NOT_YET", shown };
}

export type CompareDiagnosis = Readonly<{ correct: boolean; misconception: "LARGER_DENOMINATOR_IS_LARGER" | "COMPARED_NUMERATORS_ONLY" | null }>;

/** A learner's chosen relation, with the two classic whole-number misconceptions named when they explain it. */
export function diagnoseComparison(a: Fraction, b: Fraction, chosen: Relation): CompareDiagnosis {
  const actual = compare(a, b);
  if (chosen === actual) return { correct: true, misconception: null };
  const byDenominator: Relation = a.denominator === b.denominator ? "=" : a.denominator < b.denominator ? "<" : ">";
  if (a.numerator === b.numerator && chosen === byDenominator) return { correct: false, misconception: "LARGER_DENOMINATOR_IS_LARGER" };
  const byNumerator: Relation = a.numerator === b.numerator ? "=" : a.numerator < b.numerator ? "<" : ">";
  if (chosen === byNumerator) return { correct: false, misconception: "COMPARED_NUMERATORS_ONLY" };
  return { correct: false, misconception: null };
}
