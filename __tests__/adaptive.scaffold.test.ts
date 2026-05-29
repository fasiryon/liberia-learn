/**
 * __tests__/adaptive.scaffold.test.ts  — NR-14B-ii
 *
 * Tests for:
 *   1. routeStuck scaffold preference (with a real LessonVariant in mock DB)
 *   2. generateScaffold quality gate logic
 *   3. GET /api/adaptive/scaffold/[variantId] endpoint
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    lessonVariant: { findFirst: vi.fn(), findUnique: vi.fn() },
    lessonPrerequisite: { findMany: vi.fn() },
    adaptiveMasteryRecord: { findUnique: vi.fn() },
    curriculumContent: { findUnique: vi.fn() },
    student: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/auth", () => ({
  requireRole: vi.fn().mockResolvedValue({ id: "user-1", role: "STUDENT", schoolId: "school-1" }),
}));

vi.mock("@/lib/ai/router", () => ({
  routedCompletion: vi.fn(),
}));

vi.mock("@/lib/localization/tone-standardizer", () => ({
  toneGuidance: vi.fn().mockReturnValue("Be encouraging and patient."),
}));

import { routeStuck } from "@/lib/adaptive/routeStuck";
import { generateScaffold, type ScaffoldResult } from "@/lib/adaptive/generateScaffold";
import { prisma } from "@/lib/db";
import { routedCompletion } from "@/lib/ai/router";

const mockPrisma = prisma as any;
const mockRouted = routedCompletion as any;

// ── routeStuck with scaffold variant present ───────────────────────────────────

describe("routeStuck — scaffold routing", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns scaffold route when a LessonVariant with variantType=scaffold exists", async () => {
    mockPrisma.lessonVariant.findFirst.mockResolvedValueOnce({ id: "variant-scaffold-1" });

    const result = await routeStuck({ studentId: "s1", lessonId: "lesson-1" });
    expect(result.to).toBe("scaffold");
    expect((result as any).variantId).toBe("variant-scaffold-1");
  });

  it("returns scaffold route when variantType=simplified exists (also accepted)", async () => {
    mockPrisma.lessonVariant.findFirst.mockResolvedValueOnce({ id: "variant-simplified-1" });

    const result = await routeStuck({ studentId: "s1", lessonId: "lesson-1" });
    expect(result.to).toBe("scaffold");
    expect((result as any).variantId).toBe("variant-simplified-1");
  });

  it("skips scaffold when findFirst returns null and falls to prerequisite", async () => {
    mockPrisma.lessonVariant.findFirst.mockResolvedValueOnce(null);
    mockPrisma.lessonPrerequisite.findMany.mockResolvedValueOnce([
      { prerequisiteLessonId: "prereq-1", strength: "required" },
    ]);
    mockPrisma.curriculumContent.findUnique.mockResolvedValueOnce({
      subject: "MATH",
      grade: 6,
      unitId: "unit-1",
      contentId: "prereq-1",
    });
    mockPrisma.adaptiveMasteryRecord.findUnique.mockResolvedValueOnce(null);

    const result = await routeStuck({ studentId: "s1", lessonId: "lesson-1" });
    expect(result.to).toBe("prerequisite");
  });
});

// ── generateScaffold quality gate ────────────────────────────────────────────

describe("generateScaffold", () => {
  beforeEach(() => vi.clearAllMocks());

  const parentBody =
    "A ".repeat(800) + "b ".repeat(200); // 1000 words — ensures ratio math works
  const baseInput = {
    lessonId: "lesson-1",
    parentBody,
    grade: 5,
    subject: "MATH",
    title: "Fractions",
  };

  it("returns scaffold when quality gate passes (≥300 words, ≥40% of parent)", async () => {
    // 450 words — 45% of 1000-word parent
    const scaffoldBody = "Word ".repeat(450);
    mockRouted.mockResolvedValueOnce({ content: scaffoldBody });

    const result = await generateScaffold(baseInput);
    expect(result).not.toBeNull();
    expect(result!.wordCount).toBeGreaterThanOrEqual(300);
    expect(result!.ratioOfParent).toBeGreaterThanOrEqual(0.40);
  });

  it("retries once when first attempt fails quality gate (too short)", async () => {
    const tooShort = "Word ".repeat(100); // 100 words — below 300 minimum
    const goodBody = "Word ".repeat(450);
    mockRouted
      .mockResolvedValueOnce({ content: tooShort })
      .mockResolvedValueOnce({ content: goodBody });

    const result = await generateScaffold(baseInput);
    expect(result).not.toBeNull();
    expect(mockRouted).toHaveBeenCalledTimes(2);
  });

  it("returns null when both attempts fail quality gate", async () => {
    const tooShort = "Word ".repeat(100);
    mockRouted
      .mockResolvedValueOnce({ content: tooShort })
      .mockResolvedValueOnce({ content: tooShort });

    const result = await generateScaffold(baseInput);
    expect(result).toBeNull();
    expect(mockRouted).toHaveBeenCalledTimes(2);
  });

  it("returns null when routedCompletion throws on both attempts", async () => {
    mockRouted
      .mockRejectedValueOnce(new Error("AI unavailable"))
      .mockRejectedValueOnce(new Error("AI unavailable"));

    const result = await generateScaffold(baseInput);
    expect(result).toBeNull();
  });

  it("returns null when scaffold has ≥300 words but is <40% of parent length", async () => {
    // Parent is 1000 words; 350-word scaffold is 35% — below ratio threshold
    const belowRatio = "Word ".repeat(350);
    mockRouted
      .mockResolvedValueOnce({ content: belowRatio })
      .mockResolvedValueOnce({ content: belowRatio });

    const result = await generateScaffold(baseInput);
    expect(result).toBeNull();
  });

  it("passes with short parent if scaffold meets absolute minimum (≥300 words)", async () => {
    // Parent is only 500 words — 400 word scaffold is 80% which is ≥40%
    const shortParent = "Word ".repeat(500);
    const goodScaffold = "Word ".repeat(400);
    mockRouted.mockResolvedValueOnce({ content: goodScaffold });

    const result = await generateScaffold({ ...baseInput, parentBody: shortParent });
    expect(result).not.toBeNull();
    expect(result!.ratioOfParent).toBeCloseTo(0.8, 1);
  });
});

// ── GET /api/adaptive/scaffold/[variantId] ────────────────────────────────────

describe("GET /api/adaptive/scaffold/[variantId]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns variant body when found", async () => {
    mockPrisma.lessonVariant.findUnique.mockResolvedValueOnce({
      id: "var-1",
      lessonId: "lesson-1",
      variantType: "scaffold",
      body: "## Let us take it slowly\n\nThis is simpler.",
    });

    const { GET } = await import("@/app/api/adaptive/scaffold/[variantId]/route");
    const req = new Request("http://localhost/api/adaptive/scaffold/var-1");
    const res = await GET(req as any, { params: { variantId: "var-1" } });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.body).toContain("Let us take it slowly");
    expect(data.variantType).toBe("scaffold");
  });

  it("returns 404 when variant not found", async () => {
    mockPrisma.lessonVariant.findUnique.mockResolvedValueOnce(null);

    const { GET } = await import("@/app/api/adaptive/scaffold/[variantId]/route");
    const req = new Request("http://localhost/api/adaptive/scaffold/missing");
    const res = await GET(req as any, { params: { variantId: "missing" } });

    expect(res.status).toBe(404);
  });
});
