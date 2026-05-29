/**
 * __tests__/adaptive.scaffold.test.ts  — NR-14B-ii
 *
 * Tests for:
 *   1. routeStuck scaffold preference (with a real LessonVariant in mock DB)
 *   2. generateScaffold quality gate logic (≥400w absolute floor + stub guard)
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
//
// New gate (NR-14B-ii fix): absolute floor ≥400 words only.
// Ratio-of-parent is NOT checked — a 700-word scaffold of a 3500-word lesson
// is correct and good. Stub guard rejects parents with <300 words.

describe("generateScaffold", () => {
  beforeEach(() => vi.clearAllMocks());

  // 1000-word parent — well above the 300-word stub threshold
  const parentBody = "A ".repeat(800) + "b ".repeat(200);
  const baseInput = {
    lessonId: "lesson-1",
    parentBody,
    grade: 5,
    subject: "MATH",
    title: "Fractions",
  };

  it("returns scaffold when ≥400 words (absolute floor)", async () => {
    const scaffoldBody = "Word ".repeat(450);
    mockRouted.mockResolvedValueOnce({ content: scaffoldBody });

    const result = await generateScaffold(baseInput);
    expect(result).not.toBeNull();
    expect(result!.wordCount).toBeGreaterThanOrEqual(400);
  });

  it("retries once when first attempt is below 400-word floor", async () => {
    const tooShort = "Word ".repeat(100); // 100 words — below 400 floor
    const goodBody = "Word ".repeat(450);
    mockRouted
      .mockResolvedValueOnce({ content: tooShort })
      .mockResolvedValueOnce({ content: goodBody });

    const result = await generateScaffold(baseInput);
    expect(result).not.toBeNull();
    expect(mockRouted).toHaveBeenCalledTimes(2);
  });

  it("returns null when both attempts are below 400-word floor", async () => {
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

  it("passes for long parents (3500w) with a 700-word scaffold (20% ratio) — ratio NOT checked", async () => {
    // Old gate would have rejected this. New gate accepts it.
    const longParent = "Word ".repeat(3500);
    const scaffold = "Word ".repeat(700);
    mockRouted.mockResolvedValueOnce({ content: scaffold });

    const result = await generateScaffold({ ...baseInput, parentBody: longParent });
    expect(result).not.toBeNull();
    expect(result!.wordCount).toBe(700);
    // ratioOfParent is recorded but no longer a gate — just informational
    expect(result!.ratioOfParent).toBeCloseTo(0.2, 1);
  });

  it("passes for long parents with a 400-word scaffold (11% ratio) — ratio NOT checked", async () => {
    // A 400-word scaffold of a 3500-word lesson is the hardest case the old gate rejected.
    const longParent = "Word ".repeat(3500);
    const scaffold = "Word ".repeat(400);
    mockRouted.mockResolvedValueOnce({ content: scaffold });

    const result = await generateScaffold({ ...baseInput, parentBody: longParent });
    expect(result).not.toBeNull();
    expect(result!.wordCount).toBe(400);
  });

  it("stub guard: returns null without calling AI when parent is <300 words", async () => {
    // A 200-word parent is a stub — scaffolding it would fabricate content
    const stubParent = "Word ".repeat(200);

    const result = await generateScaffold({ ...baseInput, parentBody: stubParent });
    expect(result).toBeNull();
    // AI must NOT be called for stubs
    expect(mockRouted).not.toHaveBeenCalled();
  });

  it("stub guard: returns null for a 35-word parent (classic stub case)", async () => {
    const tinyParent = "Word ".repeat(35);

    const result = await generateScaffold({ ...baseInput, parentBody: tinyParent });
    expect(result).toBeNull();
    expect(mockRouted).not.toHaveBeenCalled();
  });

  it("stub guard boundary: accepts a 300-word parent (at the threshold)", async () => {
    const borderlineParent = "Word ".repeat(300);
    const goodScaffold = "Word ".repeat(420);
    mockRouted.mockResolvedValueOnce({ content: goodScaffold });

    const result = await generateScaffold({ ...baseInput, parentBody: borderlineParent });
    expect(result).not.toBeNull();
    expect(mockRouted).toHaveBeenCalledTimes(1);
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
