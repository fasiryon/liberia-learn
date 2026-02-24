/**
 * __tests__/training-adoption.test.ts
 *
 * Tests for:
 *   • GET /api/admin/training/adoption — route handler
 *     - Tenant isolation (scoped to admin's schoolId)
 *     - Level completion counting
 *     - 403 when no schoolId
 *     - 403 when not ADMIN
 *
 *   • getSchoolAdoptionStats — library function
 *     - Returns correct counts
 *     - Handles 0 teachers gracefully
 *
 * Vitest environment: node (no jsdom)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────────
vi.mock("@/lib/auth", () => ({
  requireRole: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    trainingProgress: {
      findMany: vi.fn(),
    },
  },
}));

import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { GET } from "@/app/api/admin/training/adoption/route";
import { getSchoolAdoptionStats } from "@/lib/training/progress";
import { MODULES_BY_LEVEL } from "@/lib/training/modules";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeAdminUser(overrides: Partial<{ schoolId: string | null; isPlatformAdmin: boolean }> = {}) {
  return {
    id: "admin-1",
    role: "ADMIN" as const,
    schoolId: "school-1",
    isPlatformAdmin: false,
    ...overrides,
  };
}

function makeRequest(url = "http://localhost/api/admin/training/adoption") {
  return new Request(url) as any;
}

// ─────────────────────────────────────────────────────────────────────────────
describe("GET /api/admin/training/adoption", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireRole as any).mockResolvedValue(makeAdminUser());
    (prisma.user.count as any).mockResolvedValue(3);
    (prisma.user.findMany as any).mockResolvedValue([
      { id: "t1" }, { id: "t2" }, { id: "t3" },
    ]);
    (prisma.trainingProgress.findMany as any).mockResolvedValue([]);
  });

  it("returns 200 with correct shape", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toMatchObject({
      totalTeachers: 3,
      level1Complete: 0,
      level2Complete: 0,
      level3Complete: 0,
    });
  });

  it("scopes user.count query to admin's schoolId", async () => {
    await GET(makeRequest());
    expect(prisma.user.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ schoolId: "school-1", role: "TEACHER" }) })
    );
  });

  it("scopes user.findMany query to admin's schoolId", async () => {
    await GET(makeRequest());
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ schoolId: "school-1", role: "TEACHER" }) })
    );
  });

  it("returns 403 when admin has no schoolId", async () => {
    (requireRole as any).mockResolvedValue(makeAdminUser({ schoolId: null }));
    const res = await GET(makeRequest());
    expect(res.status).toBe(403);
  });

  it("returns 403 when requireRole throws (non-admin)", async () => {
    (requireRole as any).mockRejectedValue(Object.assign(new Error("Forbidden"), { status: 403 }));
    const res = await GET(makeRequest());
    expect(res.status).toBe(403);
  });

  it("counts Level 1 completions correctly", async () => {
    const l1ModuleIds = MODULES_BY_LEVEL[1].map((m) => m.id);

    // Teacher t1 completed all Level 1 modules
    // Teacher t2 completed only the first Level 1 module
    // Teacher t3 completed nothing
    (prisma.trainingProgress.findMany as any).mockResolvedValue([
      ...l1ModuleIds.map((mId) => ({ teacherUserId: "t1", moduleId: mId })),
      { teacherUserId: "t2", moduleId: l1ModuleIds[0] },
    ]);

    const res = await GET(makeRequest());
    const data = await res.json();

    expect(data.level1Complete).toBe(1); // only t1 completed all L1
    expect(data.level2Complete).toBe(0);
    expect(data.level3Complete).toBe(0);
  });

  it("counts teachers who completed all three levels", async () => {
    const allModuleIds = [
      ...MODULES_BY_LEVEL[1],
      ...MODULES_BY_LEVEL[2],
      ...MODULES_BY_LEVEL[3],
    ].map((m) => m.id);

    // t1 completed everything; t2 completed only L1
    (prisma.trainingProgress.findMany as any).mockResolvedValue([
      ...allModuleIds.map((mId) => ({ teacherUserId: "t1", moduleId: mId })),
      ...MODULES_BY_LEVEL[1].map((m) => ({ teacherUserId: "t2", moduleId: m.id })),
    ]);

    const res = await GET(makeRequest());
    const data = await res.json();

    expect(data.level1Complete).toBe(2); // t1 + t2
    expect(data.level2Complete).toBe(1); // t1 only
    expect(data.level3Complete).toBe(1); // t1 only
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("getSchoolAdoptionStats", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns all zeros when there are no teachers", async () => {
    (prisma.user.count as any).mockResolvedValue(0);
    (prisma.user.findMany as any).mockResolvedValue([]);
    (prisma.trainingProgress.findMany as any).mockResolvedValue([]);

    const stats = await getSchoolAdoptionStats("school-empty");

    expect(stats).toEqual({
      totalTeachers: 0,
      level1Complete: 0,
      level2Complete: 0,
      level3Complete: 0,
    });
  });

  it("skips the findMany queries when totalTeachers is 0 (short-circuit)", async () => {
    (prisma.user.count as any).mockResolvedValue(0);

    await getSchoolAdoptionStats("school-empty");

    // findMany for teachers should NOT be called (we return early)
    expect(prisma.user.findMany).not.toHaveBeenCalled();
    expect(prisma.trainingProgress.findMany).not.toHaveBeenCalled();
  });

  it("counts correctly when teacher completes all Level 2 modules", async () => {
    (prisma.user.count as any).mockResolvedValue(2);
    (prisma.user.findMany as any).mockResolvedValue([{ id: "t1" }, { id: "t2" }]);

    const l2ModuleIds = MODULES_BY_LEVEL[2].map((m) => m.id);
    (prisma.trainingProgress.findMany as any).mockResolvedValue(
      l2ModuleIds.map((mId) => ({ teacherUserId: "t1", moduleId: mId }))
    );

    const stats = await getSchoolAdoptionStats("school-x");

    expect(stats.totalTeachers).toBe(2);
    expect(stats.level1Complete).toBe(0);
    expect(stats.level2Complete).toBe(1);
    expect(stats.level3Complete).toBe(0);
  });

  it("does NOT leak cross-school data — only passes schoolId to user queries", async () => {
    (prisma.user.count as any).mockResolvedValue(0);

    await getSchoolAdoptionStats("school-safe");

    expect(prisma.user.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ schoolId: "school-safe" }) })
    );
  });
});
