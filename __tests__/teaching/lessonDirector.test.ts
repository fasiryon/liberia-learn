import { describe, it, expect } from "vitest";
import { decideNextAction, type TurnSignal } from "@/lib/teaching/lessonDirector";

function studentTurns(corrects: (boolean | null)[]): TurnSignal[] {
  return corrects.map((correct) => ({ role: "student" as const, correct }));
}

describe("decideNextAction", () => {
  it("recommends revisit_prerequisite after 3 consecutive wrong student answers", () => {
    expect(decideNextAction(studentTurns([false, false, false]), 3)).toBe("revisit_prerequisite");
  });

  it("recommends comprehension_check after a mixed struggle (2+ wrong in last 3)", () => {
    expect(decideNextAction(studentTurns([true, false, false]), 3)).toBe("comprehension_check");
  });

  it("recommends pause every 10th turn with no struggle signal", () => {
    expect(decideNextAction(studentTurns([true, true, true]), 10)).toBe("pause");
  });

  it("recommends exit_ticket once the turn count reaches 40", () => {
    expect(decideNextAction(studentTurns([true, true, true]), 40)).toBe("exit_ticket");
  });

  it("defaults to continue otherwise", () => {
    expect(decideNextAction(studentTurns([true, true, true]), 3)).toBe("continue");
  });

  it("ignores facilitator turns when computing the recent-student window", () => {
    const mixed: TurnSignal[] = [
      { role: "facilitator", correct: null },
      { role: "student", correct: false },
      { role: "facilitator", correct: null },
      { role: "student", correct: false },
      { role: "student", correct: false },
    ];
    expect(decideNextAction(mixed, 5)).toBe("revisit_prerequisite");
  });
});
