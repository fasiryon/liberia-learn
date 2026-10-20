/**
 * Formative, on-device checks for the teaching blocks. Deterministic and local: they explain a learner's
 * attempt so the next try is better. They are not assessment, never score, and are never sent anywhere.
 */
import { PLACES, digitsOf, formatNumber } from "@/lib/learner-experience/demo/placeValue";

export type PlacementDiagnosis =
  | Readonly<{ kind: "INCOMPLETE"; remaining: number }>
  | Readonly<{ kind: "CORRECT" }>
  | Readonly<{ kind: "REVERSED" }>
  | Readonly<{ kind: "ZEROS_MISPLACED" }>
  | Readonly<{ kind: "WRONG_PLACE"; placeIndex: number; expected: number; placed: number }>;

/** The digit cards for a target: its own seven digits (one card per place), in a fixed shuffled order. */
export function digitCardsFor(target: number): number[] {
  const digits = digitsOf(target);
  // Deterministic interleave (odd places, then even places, reversed) so the first card is rarely the answer.
  const order = [...digits.map((_, index) => index).filter((index) => index % 2 === 1), ...digits.map((_, index) => index).filter((index) => index % 2 === 0)].reverse();
  return order.map((index) => digits[index]);
}

/** Explain a (possibly partial) placement of digit cards against the target, most significant place first. */
export function diagnosePlacement(target: number, placed: readonly (number | null)[]): PlacementDiagnosis {
  const expected = digitsOf(target);
  const remaining = expected.filter((_, index) => placed[index] === null || placed[index] === undefined).length;
  if (remaining > 0) return { kind: "INCOMPLETE", remaining };
  const digits = placed as readonly number[];
  if (digits.every((digit, index) => digit === expected[index])) return { kind: "CORRECT" };
  if (digits.every((digit, index) => digit === expected[expected.length - 1 - index])) return { kind: "REVERSED" };
  const nonZero = (list: readonly number[]) => list.filter((digit) => digit !== 0).join(",");
  if (nonZero(digits) === nonZero(expected)) return { kind: "ZEROS_MISPLACED" };
  const placeIndex = digits.findIndex((digit, index) => digit !== expected[index]);
  return { kind: "WRONG_PLACE", placeIndex, expected: expected[placeIndex], placed: digits[placeIndex] };
}

/** Misconception-specific feedback for a placement; the correct value is stated only after a full attempt. */
export function placementFeedback(target: number, diagnosis: PlacementDiagnosis): { result: "right" | "retry" | "pending"; text: string } {
  switch (diagnosis.kind) {
    case "INCOMPLETE": return { result: "pending", text: `${diagnosis.remaining} ${diagnosis.remaining === 1 ? "place is" : "places are"} still empty.` };
    case "CORRECT": return { result: "right", text: `You made ${formatNumber(target)}. Every digit is in the place that gives it the right value.` };
    case "REVERSED": return { result: "retry", text: "The digits are in reverse order. Numbers are written from the largest place on the left (millions) to the ones on the right." };
    case "ZEROS_MISPLACED": return { result: "retry", text: "The other digits are in the right order, but a zero is in the wrong place. A zero holds a place that is empty. Say the number in words and listen for which places have nothing in them." };
    case "WRONG_PLACE": {
      const place = PLACES[diagnosis.placeIndex];
      return { result: "retry", text: `Look at the ${place.name} place. You put ${diagnosis.placed} there, which is worth ${formatNumber(diagnosis.placed * place.value)}. The number needs ${formatNumber(diagnosis.expected * place.value)} in that place.` };
    }
  }
}

/** Sorting: which cards are in the right group. Unplaced cards are not counted as wrong. */
export function checkSort(cards: readonly { id: string; group: string }[], placed: Readonly<Record<string, string | undefined>>) {
  const results = cards.map((card) => ({ id: card.id, placed: placed[card.id] ?? null, correct: placed[card.id] === card.group }));
  return { allPlaced: results.every((result) => result.placed !== null), allCorrect: results.every((result) => result.correct), results };
}

/** Ordering: how many events are in the authored position, and the first one that is not. */
export function checkSequence(authored: readonly string[], order: readonly string[]) {
  const inPlace = order.filter((id, index) => authored[index] === id).length;
  const firstWrong = order.findIndex((id, index) => authored[index] !== id);
  return { correct: inPlace === authored.length && order.length === authored.length, inPlace, firstWrong };
}

/** Move one item up (-1) or down (+1) in a list, returning a new list. Out-of-range moves are no-ops. */
export function moveItem<T>(list: readonly T[], index: number, delta: -1 | 1): T[] {
  const target = index + delta;
  if (index < 0 || index >= list.length || target < 0 || target >= list.length) return [...list];
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
