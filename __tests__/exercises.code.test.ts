/**
 * __tests__/exercises.code.test.ts  — NR-14D Phase 2
 *
 * Tests for generateCodeExercise:
 *   1. Returns success when reference solution passes all test cases
 *   2. Returns failure when reference solution fails any test case
 *   3. Returns failure when JSON is invalid
 *   4. Returns failure when Judge0 throws (network error)
 *   5. gradeCode is called for self-validation before persisting
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock fetch (Judge0) ────────────────────────────────────────────────────────
vi.stubGlobal("fetch", vi.fn());

// ── Mock routedCompletion ─────────────────────────────────────────────────────
vi.mock("@/lib/ai/router", () => ({
  routedCompletion: vi.fn(),
}));

import { generateCodeExercise } from "@/lib/exercises/generateCodeExercise";
import { routedCompletion } from "@/lib/ai/router";

const mockRoute = routedCompletion as any;
const mockFetch = fetch as any;

const VALID_EXERCISE_JSON = JSON.stringify({
  title: "Count Market Items",
  description: "Fatu sells items at Waterside Market. Write a function that counts how many items she sells.",
  starterCode: "# TODO: write the function\n",
  referenceSolution: "n = int(input())\nprint(n * 2)",
  testCases: [
    { stdin: "3", expectedStdout: "6", hidden: false },
    { stdin: "5", expectedStdout: "10", hidden: false },
    { stdin: "0", expectedStdout: "0", hidden: true },
  ],
});

function makeJudge0Response(stdout: string) {
  return {
    ok: true,
    json: async () => ({
      stdout,
      stderr: null,
      compile_output: null,
      status: { id: 3, description: "Accepted" },
    }),
  };
}

const BASE_INPUT = {
  lessonId: "lesson-1",
  lessonTitle: "Python Functions",
  lessonBody: "Learn about Python functions...",
  grade: 5,
  difficulty: "intro" as const,
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.JUDGE0_API_KEY = "test-key";
  process.env.JUDGE0_API_HOST = "judge0-ce.p.rapidapi.com";
});

describe("generateCodeExercise", () => {
  it("returns success when reference solution passes all test cases", async () => {
    mockRoute.mockResolvedValue({ content: VALID_EXERCISE_JSON });
    // Each test case returns matching stdout
    mockFetch
      .mockResolvedValueOnce(makeJudge0Response("6\n"))  // tc1: stdin=3 → 6
      .mockResolvedValueOnce(makeJudge0Response("10\n")) // tc2: stdin=5 → 10
      .mockResolvedValueOnce(makeJudge0Response("0\n")); // tc3 (hidden): stdin=0 → 0

    const result = await generateCodeExercise(BASE_INPUT);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.exercise.title).toBe("Count Market Items");
      expect(result.exercise.testCases).toHaveLength(3);
    }
  });

  it("returns failure when reference solution fails a test case", async () => {
    mockRoute.mockResolvedValue({ content: VALID_EXERCISE_JSON });
    mockFetch
      .mockResolvedValueOnce(makeJudge0Response("6\n"))   // tc1 passes
      .mockResolvedValueOnce(makeJudge0Response("99\n")); // tc2 FAILS (expected 10)
    // tc3 not reached — grade completes after seeing a failure

    // gradeCode runs all 3, so mock the third too
    mockFetch.mockResolvedValueOnce(makeJudge0Response("0\n"));

    const result = await generateCodeExercise(BASE_INPUT);

    expect(result.success).toBe(false);
    if (result.success === false) {
      expect(result.reason).toMatch(/reference_solution_failed/);
    }
  });

  it("returns failure when LLM returns invalid JSON", async () => {
    mockRoute.mockResolvedValue({ content: "not valid json at all {{{" });

    const result = await generateCodeExercise(BASE_INPUT);

    expect(result.success).toBe(false);
    if (result.success === false) {
      expect(result.reason).toBe("invalid_json");
    }
    // Judge0 should not be called if JSON parsing fails
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns failure when LLM returns JSON missing required fields", async () => {
    mockRoute.mockResolvedValue({
      content: JSON.stringify({ title: "Test" }), // missing description, starterCode, etc.
    });

    const result = await generateCodeExercise(BASE_INPUT);

    expect(result.success).toBe(false);
    if (result.success === false) {
      expect(result.reason).toBe("invalid_json");
    }
  });

  it("returns failure when Judge0 has a network error (gradeCode catches internally → reference_solution_failed)", async () => {
    // gradeCode catches per-test-case network errors internally and marks them as failed.
    // So a network error causes all test cases to fail → reference_solution_failed.
    // The judge0_error path is only reached if gradeCode throws (e.g. missing API keys).
    mockRoute.mockResolvedValue({ content: VALID_EXERCISE_JSON });
    mockFetch.mockRejectedValue(new Error("network timeout"));

    const result = await generateCodeExercise(BASE_INPUT);

    expect(result.success).toBe(false);
    if (result.success === false) {
      expect(result.reason).toMatch(/reference_solution_failed/);
    }
  });

  it("returns judge0_error when API keys are missing", async () => {
    mockRoute.mockResolvedValue({ content: VALID_EXERCISE_JSON });
    const savedKey = process.env.JUDGE0_API_KEY;
    delete process.env.JUDGE0_API_KEY;

    const result = await generateCodeExercise(BASE_INPUT);

    process.env.JUDGE0_API_KEY = savedKey;
    expect(result.success).toBe(false);
    if (result.success === false) {
      expect(result.reason).toMatch(/judge0_error/);
    }
  });

  it("runs Judge0 validation before considering exercise valid", async () => {
    mockRoute.mockResolvedValue({ content: VALID_EXERCISE_JSON });
    mockFetch
      .mockResolvedValueOnce(makeJudge0Response("6\n"))
      .mockResolvedValueOnce(makeJudge0Response("10\n"))
      .mockResolvedValueOnce(makeJudge0Response("0\n"));

    await generateCodeExercise(BASE_INPUT);

    // Judge0 was called (fetch was called for test case submissions)
    expect(mockFetch).toHaveBeenCalledTimes(3); // one per test case
    const firstCall = mockFetch.mock.calls[0][0] as string;
    expect(firstCall).toContain("judge0");
  });
});
