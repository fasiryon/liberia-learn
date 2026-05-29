/**
 * __tests__/grading.code.test.ts  — NR-14C Phase 2
 *
 * Judge0 is ALWAYS mocked — never call the real API in tests.
 *
 * Tests for:
 *   1. gradeCode — score computation, compile errors, language allowlist
 *   2. POST /api/grading/code — rate limit, languageId validation,
 *      idempotency, resource limits present in Judge0 payload
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock Judge0 fetch globally ────────────────────────────────────────────────
vi.stubGlobal("fetch", vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: {
    student: { findFirst: vi.fn() },
    curriculumContent: { findUnique: vi.fn() },
    gradedSubmission: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  requireRole: vi.fn().mockResolvedValue({ id: "user-1", role: "STUDENT" }),
}));

vi.mock("@/lib/rateLimit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 19 }),
  rateLimitExceededResponse: vi.fn().mockReturnValue(
    new Response(JSON.stringify({ error: "rate_limit_exceeded" }), { status: 429 })
  ),
}));

vi.mock("@/lib/adaptive/updateMastery", () => ({
  recordAnswer: vi.fn().mockResolvedValue({ score: 0.8, mastered: false }),
  buildSkillKey: vi.fn().mockReturnValue("CS:G8:unit-code"),
}));

import {
  gradeCode,
  ALLOWED_LANGUAGE_ID_SET,
  JUDGE0_LIMITS,
} from "@/lib/grading/gradeCode";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/rateLimit";

const mockPrisma = prisma as any;
const mockFetch = fetch as any;
const mockCheckRateLimit = checkRateLimit as any;

// ── gradeCode unit tests ──────────────────────────────────────────────────────

describe("gradeCode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JUDGE0_API_KEY = "test-key";
    process.env.JUDGE0_API_HOST = "judge0-ce.p.rapidapi.com";
  });

  function mockJudge0Response(stdout: string) {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ stdout, stderr: null, compile_output: null }),
    });
  }

  it("computes score from passed/total test cases", async () => {
    mockJudge0Response("3\n");  // test 1: pass
    mockJudge0Response("7\n");  // test 2: pass
    mockJudge0Response("0\n");  // test 3: fail (expected "5")

    const result = await gradeCode({
      sourceCode: "print(int(input()) + int(input()))",
      languageId: 71,
      testCases: [
        { stdin: "1\n2\n", expectedStdout: "3" },
        { stdin: "3\n4\n", expectedStdout: "7" },
        { stdin: "2\n3\n", expectedStdout: "5" },
      ],
    });

    expect(result.passed).toBe(2);
    expect(result.total).toBe(3);
    expect(result.score).toBeCloseTo(2 / 3, 4);
    expect(result.results[0].passed).toBe(true);
    expect(result.results[1].passed).toBe(true);
    expect(result.results[2].passed).toBe(false);
  });

  it("handles compile errors — 0 score, error in result", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        stdout: null,
        stderr: null,
        compile_output: "SyntaxError: invalid syntax",
        status: { id: 6, description: "Compilation Error" },
      }),
    });

    const result = await gradeCode({
      sourceCode: "def broken(:((",
      languageId: 71,
      testCases: [{ stdin: "", expectedStdout: "hello" }],
    });

    expect(result.passed).toBe(0);
    expect(result.score).toBe(0);
    expect(result.results[0].passed).toBe(false);
    expect(result.results[0].got).toContain("SyntaxError");
  });

  it("throws for disallowed language IDs", async () => {
    await expect(
      gradeCode({
        sourceCode: "console.log('hello')",
        languageId: 63, // Node.js — not in allowlist
        testCases: [{ stdin: "", expectedStdout: "hello" }],
      })
    ).rejects.toThrow("allowlist");
  });

  it("resource limits are present in every Judge0 payload", async () => {
    mockJudge0Response("hello\n");

    await gradeCode({
      sourceCode: "print('hello')",
      languageId: 71,
      testCases: [{ stdin: "", expectedStdout: "hello" }],
    });

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(callBody.cpu_time_limit).toBe(JUDGE0_LIMITS.cpu_time_limit);
    expect(callBody.memory_limit).toBe(JUDGE0_LIMITS.memory_limit);
    expect(callBody.wall_time_limit).toBe(JUDGE0_LIMITS.wall_time_limit);
    expect(callBody.enable_network).toBe(false);
  });

  it("handles Judge0 network error gracefully — failing test, no throw", async () => {
    mockFetch.mockRejectedValueOnce(new Error("fetch failed"));

    const result = await gradeCode({
      sourceCode: "print('hello')",
      languageId: 71,
      testCases: [{ stdin: "", expectedStdout: "hello" }],
    });

    expect(result.passed).toBe(0);
    expect(result.results[0].passed).toBe(false);
    expect(result.results[0].got).toContain("error");
  });

  it("Python language ID 71 is in the allowed set", () => {
    expect(ALLOWED_LANGUAGE_ID_SET.has(71)).toBe(true);
  });
});

// ── POST /api/grading/code ────────────────────────────────────────────────────

describe("POST /api/grading/code", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JUDGE0_API_KEY = "test-key";
    process.env.JUDGE0_API_HOST = "judge0-ce.p.rapidapi.com";

    mockPrisma.student.findFirst.mockResolvedValue({ id: "student-1" });
    mockPrisma.curriculumContent.findUnique.mockResolvedValue({
      grade: 8, subject: "CS", unitId: "unit-cs", contentId: "content-cs",
    });
    mockPrisma.gradedSubmission.findUnique.mockResolvedValue(null);
    mockPrisma.gradedSubmission.create.mockResolvedValue({ id: "sub-1", status: "pending" });
    mockPrisma.gradedSubmission.update.mockResolvedValue({
      id: "sub-1", score: 1.0, feedback: "All test cases passed — excellent work!",
      gradedAt: new Date(),
    });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ stdout: "hello\n", stderr: null, compile_output: null }),
    });
  });

  it("returns 200 with passed/total on success", async () => {
    const { POST } = await import("@/app/api/grading/code/route");
    const req = new Request("http://localhost/api/grading/code", {
      method: "POST",
      body: JSON.stringify({
        lessonId: "lesson-1",
        sourceCode: "print('hello')",
        languageId: 71,
        testCases: [{ stdin: "", expectedStdout: "hello" }],
      }),
    });
    const res = await POST(req as any);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(typeof data.passed).toBe("number");
    expect(typeof data.total).toBe("number");
  });

  it("returns 400 for disallowed languageId", async () => {
    const { POST } = await import("@/app/api/grading/code/route");
    const req = new Request("http://localhost/api/grading/code", {
      method: "POST",
      body: JSON.stringify({
        lessonId: "lesson-1",
        sourceCode: "console.log('hi')",
        languageId: 63, // Node.js — not allowed
        testCases: [{ stdin: "", expectedStdout: "hi" }],
      }),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("not allowed");
  });

  it("returns 429 when rate limit exceeded", async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ allowed: false, remaining: 0 });

    const { POST } = await import("@/app/api/grading/code/route");
    const req = new Request("http://localhost/api/grading/code", {
      method: "POST",
      body: JSON.stringify({
        lessonId: "lesson-1",
        sourceCode: "print('hello')",
        languageId: 71,
        testCases: [{ stdin: "", expectedStdout: "hello" }],
      }),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(429);
  });

  it("idempotency: same clientSubmissionId returns existing submission", async () => {
    const existing = { id: "sub-existing", score: 0.5, status: "graded" };
    mockPrisma.gradedSubmission.findUnique.mockResolvedValueOnce(existing);

    const { POST } = await import("@/app/api/grading/code/route");
    const req = new Request("http://localhost/api/grading/code", {
      method: "POST",
      body: JSON.stringify({
        lessonId: "lesson-1",
        sourceCode: "print('hello')",
        languageId: 71,
        testCases: [{ stdin: "", expectedStdout: "hello" }],
        clientSubmissionId: "already-sent",
      }),
    });
    const res = await POST(req as any);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.submission.id).toBe("sub-existing");
    // Judge0 must NOT be called for duplicate submissions
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns 503 when JUDGE0_API_KEY is not set", async () => {
    delete process.env.JUDGE0_API_KEY;

    const { POST } = await import("@/app/api/grading/code/route");
    const req = new Request("http://localhost/api/grading/code", {
      method: "POST",
      body: JSON.stringify({
        lessonId: "lesson-1",
        sourceCode: "print('hello')",
        languageId: 71,
        testCases: [{ stdin: "", expectedStdout: "hello" }],
      }),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(503);
  });
});
