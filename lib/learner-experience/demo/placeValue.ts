/**
 * Place-value arithmetic for the Grade 7 Number Sense DEMO (Student Experience V3). Deterministic and
 * local. It supports a synthetic design preview only; it is not curriculum content, assessment logic or
 * an evidence source.
 */
export const PLACES = [
  { id: "millions", name: "millions", value: 1_000_000, group: "Millions" },
  { id: "hundred-thousands", name: "hundred thousands", value: 100_000, group: "Thousands" },
  { id: "ten-thousands", name: "ten thousands", value: 10_000, group: "Thousands" },
  { id: "thousands", name: "thousands", value: 1_000, group: "Thousands" },
  { id: "hundreds", name: "hundreds", value: 100, group: "Ones" },
  { id: "tens", name: "tens", value: 10, group: "Ones" },
  { id: "ones", name: "ones", value: 1, group: "Ones" },
] as const;

export type PlaceId = (typeof PLACES)[number]["id"];
export const MAX_DEMO_NUMBER = 9_999_999;

/** Digits by place, most significant first (always seven places). */
export function digitsOf(n: number): number[] {
  const safe = Math.max(0, Math.min(MAX_DEMO_NUMBER, Math.trunc(n)));
  return PLACES.map((place) => Math.floor(safe / place.value) % 10);
}

export function fromDigits(digits: readonly number[]): number {
  return PLACES.reduce((sum, place, index) => sum + (digits[index] ?? 0) * place.value, 0);
}

export function formatNumber(n: number): string {
  return Math.trunc(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** Expanded form, skipping zero places: 2,350,480 → 2,000,000 + 300,000 + 50,000 + 400 + 80. */
export function expandedForm(n: number): string {
  const parts = digitsOf(n).map((digit, index) => digit * PLACES[index].value).filter((value) => value > 0).map(formatNumber);
  return parts.length ? parts.join(" + ") : "0";
}

const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

function underThousand(n: number): string {
  const hundreds = Math.floor(n / 100), rest = n % 100;
  const words: string[] = [];
  if (hundreds) words.push(`${ONES[hundreds]} hundred`);
  if (rest) words.push(rest < 20 ? ONES[rest] : TENS[Math.floor(rest / 10)] + (rest % 10 ? `-${ONES[rest % 10]}` : ""));
  return words.join(" ");
}

/** Word form as read aloud in class: 4,205,316 → "four million, two hundred five thousand, three hundred sixteen". */
export function wordForm(n: number): string {
  const safe = Math.max(0, Math.min(MAX_DEMO_NUMBER, Math.trunc(n)));
  if (safe === 0) return "zero";
  const millions = Math.floor(safe / 1_000_000), thousands = Math.floor(safe / 1000) % 1000, ones = safe % 1000;
  return [millions && `${underThousand(millions)} million`, thousands && `${underThousand(thousands)} thousand`, ones && underThousand(ones)].filter(Boolean).join(", ");
}

/** The value of one digit in its place, e.g. the 3 in 2,350,480 is worth 300,000. */
export function placeValueOf(n: number, placeIndex: number): number {
  return digitsOf(n)[placeIndex] * PLACES[placeIndex].value;
}

/** Index of the first place holding `digit` (most significant first), or -1. */
export function placeOfDigit(n: number, digit: number): number {
  return digitsOf(n).findIndex((value, index) => value === digit && (index > 0 || value > 0));
}
