/** Factory-side formative contract. T1 must integrate before typed rational input can be enabled. */
export type Rational = Readonly<{ numerator: number; denominator: number }>;
export type AnswerRule = Readonly<{ exact: Rational; decimal: "EXACT_TERMINATING_ONLY" }>
  | Readonly<{ exact: Rational; decimal: "ROUND_HALF_UP"; places: number }>;

function parseExact(input: string): Rational | null {
  const value = input.trim();
  const fraction = /^([+-]?\d{1,8})\s*\/\s*([1-9]\d{0,7})$/.exec(value);
  if (fraction) return { numerator: Number(fraction[1]), denominator: Number(fraction[2]) };
  const decimal = /^([+-]?)(\d{1,8})(?:\.(\d{1,6}))?$/.exec(value);
  if (!decimal) return null;
  const scale = 10 ** (decimal[3]?.length ?? 0);
  return { numerator: (decimal[1] === "-" ? -1 : 1) * (Number(decimal[2]) * scale + Number(decimal[3] ?? 0)), denominator: scale };
}

export function checkRationalAnswer(input: string, rule: AnswerRule) {
  const answer = parseExact(input);
  if (!answer) return { result: "INVALID", feedback: "Enter a fraction a/b with a nonzero positive denominator, an integer, or a finite decimal. Use no ellipsis." };
  const equal = BigInt(answer.numerator) * BigInt(rule.exact.denominator) === BigInt(rule.exact.numerator) * BigInt(answer.denominator);
  if (equal) return { result: "EXACT", feedback: "Your answer names the same exact quantity. Equivalent fractions are accepted even before simplifying." };
  if (rule.decimal === "ROUND_HALF_UP" && !input.includes("/")) {
    const scale = 10 ** rule.places;
    const rounded = Math.sign(rule.exact.numerator) * Math.floor(Math.abs(rule.exact.numerator) * scale / rule.exact.denominator + 0.5);
    if (answer.numerator * scale === rounded * answer.denominator)
      return { result: "ROUNDED", feedback: `Correct approximation to ${rule.places} decimal places. Use approximately equal, not equals, beside the exact fraction.` };
  }
  return { result: "INCORRECT", feedback: rule.decimal === "EXACT_TERMINATING_ONLY"
    ? "Use a common denominator and preserve the whole. A finite decimal is accepted only if exactly equal; a rounded decimal is not the exact fraction."
    : `Check the common denominator, then round only the final value to ${rule.places} decimal places, with a halfway digit rounded away from zero.` };
}
