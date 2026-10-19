/**
 * Deterministic error models for number-sense distractors.
 *
 * A distractor mapped to a misconception is diagnostic only if a learner holding that
 * misconception would actually choose it. For items with a mechanical verification record these
 * models compute which errors produce each option, so a mapping can be checked instead of trusted.
 * Items without a verification record (most literacy items) are left to judgment review.
 */

export const ERROR_MODELS = [
  /** Gives the face value of the digit instead of its place value (the 6 in 3,462,105 → 6). */
  "DIGIT_INSTEAD_OF_VALUE",
  /** Right digit, wrong place: the value is off by a power of ten. */
  "PLACE_SHIFT",
  /** The nonzero digits are right and in order, but zeros holding empty places are dropped or moved. */
  "ZERO_PLACEHOLDER_OMITTED",
  /** Treats the decimal part as a whole number, so more decimal digits looks bigger (0.307 > 0.37). */
  "LONGER_DECIMAL_GREATER",
  /** Treats fewer decimal digits as bigger (tenths beat hundredths), so 0.3 > 0.37. */
  "SHORTER_DECIMAL_GREATER",
  /** Correct order, wrong direction. */
  "ORDER_REVERSED",
] as const;
export type ErrorModel = (typeof ERROR_MODELS)[number];

export type ItemVerification =
  | Readonly<{ kind: "DIGIT_VALUE"; number: string; digit: string }>
  | Readonly<{ kind: "WORD_FORM"; number: number | string }>
  | Readonly<{ kind: "EXPANDED_FORM"; number: string }>
  | Readonly<{ kind: "ORDER_ASCENDING"; values: readonly string[] }>
  | Readonly<{ kind: "GREATEST"; values: readonly string[] }>;

const clean = (text: string) => text.replace(/[,\s]/g, "");
const isDecimalText = (text: string) => /^\d+(\.\d+)?$/.test(clean(text));

/** Exact decimal string → scaled bigint pair, so no floating-point error enters a comparison. */
function toScaled(text: string, scale = 12): bigint {
  const [whole, fraction = ""] = clean(text).split(".");
  return BigInt(whole + fraction.padEnd(scale, "0").slice(0, scale));
}

function nonzeroDigits(text: string): string {
  return clean(text).replace(/[.0]/g, "");
}

function placeValue(number: string, digit: string): bigint | null {
  const [whole, fraction = ""] = clean(number).split(".");
  const wholeIndex = whole.lastIndexOf(digit);
  const fractionIndex = fraction.indexOf(digit);
  if (wholeIndex >= 0 && fractionIndex >= 0) return null; // ambiguous digit
  if (wholeIndex >= 0) return toScaled(digit + "0".repeat(whole.length - 1 - wholeIndex));
  if (fractionIndex >= 0) return toScaled(`0.${"0".repeat(fractionIndex)}${digit}`);
  return null;
}

function isPowerOfTenMultiple(value: bigint, base: bigint): boolean {
  if (value === base || value === 0n || base === 0n) return false;
  let [big, small] = value > base ? [value, base] : [base, value];
  while (big > small && big % 10n === 0n) big /= 10n;
  return big === small;
}

function expandedTerms(option: string): string[] | null {
  const terms = option.split("+").map((term) => clean(term));
  return terms.every(isDecimalText) ? terms : null;
}

function expandedValue(option: string): bigint | null {
  const terms = expandedTerms(option);
  return terms ? terms.reduce((sum, term) => sum + toScaled(term), 0n) : null;
}

function parseList(option: string): string[] {
  return option.split(/,\s+/).map((part) => part.trim());
}

function fractionAsInteger(text: string): number {
  return Number(clean(text).split(".")[1] ?? "0");
}

function fractionLength(text: string): number {
  return (clean(text).split(".")[1] ?? "").length;
}

/**
 * Which error models produce `option` for this item. An empty result means no modelled error
 * explains the option; a mapping to it cannot be confirmed mechanically.
 */
export function explainDistractor(verification: ItemVerification, option: string): ErrorModel[] {
  const fits = new Set<ErrorModel>();
  switch (verification.kind) {
    case "DIGIT_VALUE": {
      if (!isDecimalText(option)) break;
      const correct = placeValue(verification.number, verification.digit);
      if (correct === null) break;
      const chosen = toScaled(option);
      // Face value is its own error, not a place shift, even though it is also a power of ten away.
      if (chosen === toScaled(verification.digit)) fits.add("DIGIT_INSTEAD_OF_VALUE");
      else if (isPowerOfTenMultiple(chosen, correct)) fits.add("PLACE_SHIFT");
      break;
    }
    case "WORD_FORM": {
      const correct = String(verification.number);
      if (!isDecimalText(option) || toScaled(option) === toScaled(correct)) break;
      if (nonzeroDigits(option) === nonzeroDigits(correct)) fits.add("ZERO_PLACEHOLDER_OMITTED");
      break;
    }
    case "EXPANDED_FORM": {
      const terms = expandedTerms(option);
      const value = expandedValue(option);
      if (!terms || value === null || value === toScaled(verification.number)) break;
      const digits = clean(verification.number).replace(".", "");
      if (terms.every((term) => /^\d$/.test(term)) && terms.join("") === digits.replace(/0/g, "")) fits.add("DIGIT_INSTEAD_OF_VALUE");
      const shown = terms.map(nonzeroDigits).join("");
      if (shown === nonzeroDigits(verification.number)) {
        // Same digits, wrong places. Removing a zero digit from the number reproduces the option exactly?
        const number = clean(verification.number);
        const withoutAZero = Array.from(number).flatMap((char, index) => (char === "0" ? [number.slice(0, index) + number.slice(index + 1)] : []));
        if (withoutAZero.some((candidate) => toScaled(candidate) === value)) fits.add("ZERO_PLACEHOLDER_OMITTED");
        else fits.add("PLACE_SHIFT");
      }
      break;
    }
    case "ORDER_ASCENDING": {
      const chosen = parseList(option);
      const values = [...verification.values];
      if (chosen.length !== values.length) break;
      const same = (order: string[]) => order.every((value, index) => clean(value) === clean(chosen[index]));
      const correct = [...values].sort((left, right) => (toScaled(left) < toScaled(right) ? -1 : 1));
      if (same([...correct].reverse())) fits.add("ORDER_REVERSED");
      const decimals = values.some((value) => clean(value).includes("."));
      const lengths = new Set(values.map(fractionLength));
      if (decimals && lengths.size > 1) {
        const longer = [...values].sort((left, right) => fractionAsInteger(left) - fractionAsInteger(right));
        if (same(longer) && !same(correct)) fits.add("LONGER_DECIMAL_GREATER");
        const shorter = [...values].sort((left, right) => fractionLength(right) - fractionLength(left) || (toScaled(left) < toScaled(right) ? -1 : 1));
        if (same(shorter) && !same(correct)) fits.add("SHORTER_DECIMAL_GREATER");
      }
      break;
    }
    case "GREATEST": {
      const values = verification.values.map(clean);
      const chosen = clean(option);
      if (!values.includes(chosen)) break;
      const greatest = values.reduce((best, value) => (toScaled(value) > toScaled(best) ? value : best));
      if (chosen === greatest) break;
      const decimals = values.filter((value) => value.includes("."));
      if (decimals.length > 1 && new Set(decimals.map(fractionLength)).size > 1) {
        const longest = decimals.reduce((best, value) => (fractionAsInteger(value) > fractionAsInteger(best) ? value : best));
        if (chosen === longest) fits.add("LONGER_DECIMAL_GREATER");
        const shortest = decimals.reduce((best, value) => (fractionLength(value) < fractionLength(best) ? value : best));
        if (chosen === shortest) fits.add("SHORTER_DECIMAL_GREATER");
      }
      break;
    }
  }
  return ERROR_MODELS.filter((model) => fits.has(model));
}
