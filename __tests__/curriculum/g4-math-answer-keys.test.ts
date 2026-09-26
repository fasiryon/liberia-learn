/**
 * Recomputes every Grade 4 Math answer key whose prompt is a plain
 * calculation (whole-number and fraction arithmetic, rounding, LCM/GCF,
 * simplifying, mode/median/mean). Word problems and conceptual items were
 * checked by hand (see curriculum/review/g4-math/review-support.json); this
 * test keeps the computable part honest on every run.
 */
import { describe, expect, it } from "vitest";
import { GRADE4_MATH_DRAFT_LESSONS } from "@/lib/curriculum/authority/grade4Math";
import { GRADE4_FRACTIONS_LESSON_2026_2 } from "@/lib/curriculum/authority/grade4FractionsLesson";

type Checked = { prompt: string; answer: string };
const num = (text: string) => Number(text.replace(/,/g, ""));
const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
const lcm = (a: number, b: number) => (a * b) / gcd(a, b);
/** Parse "3/4", "1 1/3", "2" or "6/8 km = 3/4 km" (last fraction wins) into a value. */
function fractionValue(text: string): number | null {
  const parts = text.replace(/[a-z]+/gi, " ").split("=").map((part) => part.trim()).filter(Boolean);
  const last = parts.at(-1);
  if (!last) return null;
  const mixed = last.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const fraction = last.match(/^(\d+)\/(\d+)$/);
  if (fraction) return Number(fraction[1]) / Number(fraction[2]);
  return /^\d+$/.test(last) ? Number(last) : null;
}
const close = (a: number, b: number) => Math.abs(a - b) < 1e-9;

/** Returns null when the prompt is not a plain calculation this checker understands. */
function expected(prompt: string): ((answer: string) => boolean) | null {
  const n = "(\\d[\\d,]*)";
  let m: RegExpMatchArray | null;
  if ((m = prompt.match(new RegExp(`^(?:What is |Add: |Subtract: )?${n} ([x/+-]) ${n}(?: = \\?|\\?)?$`)))) {
    const [a, op, b] = [num(m[1]), m[2], num(m[3])];
    if (op === "/") {
      const q = Math.floor(a / b), r = a % b;
      return (answer) => answer.replace(/,/g, "") === (r ? `${q} remainder ${r}` : `${q}`);
    }
    const value = op === "x" ? a * b : op === "+" ? a + b : a - b;
    return (answer) => num(answer) === value;
  }
  if ((m = prompt.match(/^(?:What is )?(\d+)\/(\d+) ([+-]) (\d+)\/(\d+)(?: = \?|\?)?(?: \((?:simplest form|as a mixed number)\))?$/))) {
    const value = Number(m[1]) / Number(m[2]) + (m[3] === "+" ? 1 : -1) * Number(m[4]) / Number(m[5]);
    return (answer) => { const got = fractionValue(answer); return got !== null && close(got, value); };
  }
  if ((m = prompt.match(/^(?:What is )?1 - (\d+)\/(\d+)(?: = \?|\?)$/))) {
    const value = 1 - Number(m[1]) / Number(m[2]);
    return (answer) => { const got = fractionValue(answer); return got !== null && close(got, value); };
  }
  if ((m = prompt.match(/^Complete: (\d+)\/(\d+) = (\?|\d+)\/(\?|\d+)$/))) {
    const [a, b, c, d] = [Number(m[1]), Number(m[2]), m[3], m[4]];
    return (answer) => c === "?" ? close(Number(answer) / Number(d), a / b) : close(Number(c) / Number(answer), a / b);
  }
  if ((m = prompt.match(/^Round ([\d,]+) to the nearest (ten|hundred|thousand)\.$/))) {
    const unit = { ten: 10, hundred: 100, thousand: 1000 }[m[2] as "ten"]!;
    const value = Math.floor(num(m[1]) / unit + 0.5) * unit;
    return (answer) => num(answer) === value;
  }
  if ((m = prompt.match(/^(?:Find|What is) the (LCM|GCF) of (\d+) and (\d+)[.?]$/))) {
    const [a, b] = [Number(m[2]), Number(m[3])];
    const value = m[1] === "LCM" ? lcm(a, b) : gcd(a, b);
    return (answer) => Number(answer) === value;
  }
  if ((m = prompt.match(/^Simplify (\d+)\/(\d+)\.$/)) || (m = prompt.match(/^What is (\d+)\/(\d+) in simplest form\?$/))) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    const g = gcd(a, b);
    return (answer) => answer === `${a / g}/${b / g}`;
  }
  if ((m = prompt.match(/^(?:Find the|What is the) (mode|median|mean)(?: of)?:? ([\d, ]+?)\??$/))) {
    const values = m[2].split(",").map((entry) => Number(entry.trim())).sort((x, y) => x - y);
    let value: number;
    if (m[1] === "mean") value = values.reduce((sum, v) => sum + v, 0) / values.length;
    else if (m[1] === "median") value = values.length % 2 ? values[(values.length - 1) / 2] : (values[values.length / 2 - 1] + values[values.length / 2]) / 2;
    else { const freq = new Map<number, number>(); for (const v of values) freq.set(v, (freq.get(v) ?? 0) + 1); value = [...freq].sort((x, y) => y[1] - x[1])[0][0]; }
    return (answer) => Number(answer) === value;
  }
  return null;
}

function allItems(): Checked[] {
  const payloads = [...GRADE4_MATH_DRAFT_LESSONS.map((lesson) => lesson.payload), GRADE4_FRACTIONS_LESSON_2026_2.payload];
  return payloads.flatMap((payload) => [
    ...payload.practice, ...payload.homework, ...payload.quiz, payload.diagnosticCheck,
    { prompt: "question" in payload.assessment ? payload.assessment.question : payload.assessment.prompt,
      answer: "correctAnswer" in payload.assessment ? payload.assessment.correctAnswer : payload.assessment.answer },
  ].map((entry) => ({ prompt: entry.prompt, answer: entry.answer })));
}

describe("Grade 4 Math answer keys", () => {
  const items = allItems();

  it("recomputes every plain-calculation answer key", () => {
    const wrong: string[] = [];
    let checked = 0;
    for (const item of items) {
      const verify = expected(item.prompt);
      if (!verify) continue;
      checked += 1;
      if (!verify(item.answer)) wrong.push(`${item.prompt} -> ${item.answer}`);
    }
    expect(wrong).toEqual([]);
    // Guard against the parser silently matching less over time.
    expect(checked).toBeGreaterThanOrEqual(165);
  });

  it("puts every multiple-choice answer among its options exactly once", () => {
    const payloads = [...GRADE4_MATH_DRAFT_LESSONS.map((lesson) => lesson.payload), GRADE4_FRACTIONS_LESSON_2026_2.payload];
    for (const payload of payloads) {
      for (const question of [...payload.quiz, payload.diagnosticCheck]) {
        expect(question.options.filter((option) => option === question.answer), question.prompt).toHaveLength(1);
        expect(new Set(question.options).size, question.prompt).toBe(question.options.length);
      }
    }
  });
});
