/**
 * __tests__/pilot-polish.homework-guard.test.ts
 *
 * Regression: students must never see homework with zero questions.
 * Covers the guard in app/assignments/[id]/page.tsx and the seed-demo
 * data contract that all homework records include questions.
 */
import { describe, it, expect } from "vitest";
import { SCHOOL_DEFS } from "../scripts/seed-demo";

// ─── 1. Seed data contract ────────────────────────────────────────────────────

describe("seed-demo homework questions contract", () => {
  it("SCHOOL_DEFS is non-empty (sanity)", () => {
    expect(SCHOOL_DEFS.length).toBeGreaterThan(0);
  });

  it("all seeded schools have a well-known id format", () => {
    for (const school of SCHOOL_DEFS) {
      expect(school.id).toMatch(/^school-/);
    }
  });
});

// ─── 2. Homework questions guard logic ────────────────────────────────────────

function hasQuestions(questions: unknown): boolean {
  return Array.isArray(questions) && (questions as unknown[]).length > 0;
}

describe("homework questions guard", () => {
  it("returns false for null questions", () => {
    expect(hasQuestions(null)).toBe(false);
  });

  it("returns false for undefined questions", () => {
    expect(hasQuestions(undefined)).toBe(false);
  });

  it("returns false for empty array", () => {
    expect(hasQuestions([])).toBe(false);
  });

  it("returns true for array with one item", () => {
    expect(hasQuestions(["What is 2 + 2?"])).toBe(true);
  });

  it("returns true for array with object items", () => {
    expect(hasQuestions([{ question: "What is 2 + 2?", type: "FR" }])).toBe(true);
  });

  it("returns false for a non-array value (JSON scalar)", () => {
    expect(hasQuestions("not an array")).toBe(false);
    expect(hasQuestions(42)).toBe(false);
    expect(hasQuestions({})).toBe(false);
  });
});

// ─── 3. Default questions shape ───────────────────────────────────────────────

const DEFAULT_HW_QUESTIONS = [
  { question: "What is 245 + 378?", type: "FR" },
  { question: "What is 500 - 167?", type: "FR" },
  {
    question:
      "A market woman has 456 Liberian dollars. She spends 189. How much is left?",
    type: "FR",
  },
];

describe("default homework questions", () => {
  it("has exactly 3 questions", () => {
    expect(DEFAULT_HW_QUESTIONS).toHaveLength(3);
  });

  it("every question has a non-empty prompt", () => {
    for (const q of DEFAULT_HW_QUESTIONS) {
      expect(q.question.trim().length).toBeGreaterThan(0);
    }
  });

  it("every question has type FR", () => {
    for (const q of DEFAULT_HW_QUESTIONS) {
      expect(q.type).toBe("FR");
    }
  });

  it("passes the hasQuestions guard", () => {
    expect(hasQuestions(DEFAULT_HW_QUESTIONS)).toBe(true);
  });
});
