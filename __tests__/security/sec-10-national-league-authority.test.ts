import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({ actor: { id: "admin-1", role: "ADMIN", schoolId: "school-A", isPlatformAdmin: false },
  window: vi.fn(), compute: vi.fn(), rank: vi.fn(), write: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireRole: async (role: string) => {
  if (m.actor.role !== role) throw Object.assign(new Error("Forbidden"), { status: 403 }); return m.actor;
} }));
vi.mock("@/lib/db", () => ({ prisma: { leagueWeekSnapshot: { upsert: m.write } } }));
vi.mock("@/lib/league/weeklyScore", () => ({ previousWeekWindow: m.window, computeSchoolWeeklyScores: m.compute, assignDistrictRanks: m.rank }));
import { POST } from "@/app/api/admin/league/reset/route";
const reset = () => POST(new NextRequest("http://localhost/api/admin/league/reset", { method: "POST" }))
  .catch(() => new Response("uncaught authorization", { status: 500 }));
beforeEach(() => {
  vi.clearAllMocks(); m.actor = { id: "admin-1", role: "ADMIN", schoolId: "school-A", isPlatformAdmin: false };
  m.window.mockReturnValue({ weekStart: new Date("2026-11-02T00:00:00Z"), weekEnd: new Date("2026-11-09T00:00:00Z") });
  const rows = ["school-A", "school-B"].map(schoolId => ({ schoolId, schoolName: "Synthetic", district: "Synthetic", rank: 1, score: 1, pointsTotal: 1, enrollmentCount: 1 }));
  m.compute.mockResolvedValue(rows); m.rank.mockReturnValue(rows); m.write.mockResolvedValue({});
});
describe("SEC-10 national league reset authority", () => {
  it.each(["school-A", "school-B"])("denies school ADMIN in %s before global work", async schoolId => {
    m.actor.schoolId = schoolId; expect((await reset()).status).toBe(403);
    expect(m.window).not.toHaveBeenCalled(); expect(m.compute).not.toHaveBeenCalled(); expect(m.write).not.toHaveBeenCalled();
  });
  it.each(["STUDENT", "TEACHER", "GUARDIAN"])("preserves %s rejection with a structured status", async role => {
    m.actor.role = role; expect((await reset()).status).toBe(403); expect(m.compute).not.toHaveBeenCalled();
  });
  it("does not widen a non-ADMIN role carrying a platform flag", async () => {
    m.actor.role = "TEACHER"; m.actor.isPlatformAdmin = true;
    expect((await reset()).status).toBe(403); expect(m.write).not.toHaveBeenCalled();
  });
  it("preserves explicit platform ADMIN national reset", async () => {
    m.actor.isPlatformAdmin = true; const response = await reset(); expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ snapshots_written: 2 }); expect(m.write).toHaveBeenCalledTimes(2);
  });
});
