/**
 * ADMIN-SENTIMENT-01 (P2, COS-CYCLE-13-T1-FINDINGS-ROUTING-20261028.md): GET /api/admin/sentiment reads a school's
 * 7-day teacher-sentiment ratings. A non-platform ADMIN is bound to its own school: a foreign ?schoolId is refused
 * with 403 before any read, as in the neighbouring admin/dashboard/school routes. The platform path (any school) is
 * unchanged here; it belongs to AT-PLATFORM-PERM. Synthetic identities and mocks only.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ actor: null as any, findMany: vi.fn() }));
vi.mock("@/lib/auth", () => ({
  requireRole: async (...roles: string[]) => {
    if (!roles.includes(m.actor.role)) throw Object.assign(new Error("Forbidden"), { status: 403 });
    return m.actor;
  },
}));
vi.mock("@/lib/db", () => ({ prisma: { teacherSentiment: { findMany: m.findMany } } }));

import { GET } from "@/app/api/admin/sentiment/route";

const get = async (actor: any, query = "") => {
  m.actor = actor;
  const res = await GET(new Request(`http://localhost/api/admin/sentiment${query}`));
  return { status: res.status, body: await res.json() };
};
const ADMIN_A = { id: "admin-A", role: "ADMIN", schoolId: "school-A" };

beforeEach(() => {
  vi.clearAllMocks();
  m.findMany.mockResolvedValue([{ rating: "good" }, { rating: "struggling" }]);
});

describe("ADMIN-SENTIMENT-01: a school ADMIN reads only its own school's sentiment", () => {
  it("SEC-15: school-less ADMIN cannot select a tenant", async () => {
    expect((await get({ id: "admin-none", role: "ADMIN", schoolId: null }, "?schoolId=school-B")).status).toBe(403);
    expect(m.findMany).not.toHaveBeenCalled();
  });
  it.each(["STUDENT", "GUARDIAN"])("SEC-15: %s cannot read a school's sentiment", async role => {
    expect((await get({ id: "actor", role, schoolId: "school-A" }, "?schoolId=school-B")).status).toBe(403);
    expect(m.findMany).not.toHaveBeenCalled();
  });
  it("RED: another school's schoolId is refused with 403 before any read", async () => {
    const { status } = await get(ADMIN_A, "?schoolId=school-B");
    expect(m.findMany).not.toHaveBeenCalled();
    expect(status).toBe(403);
  });
  it("guard: without a schoolId the ADMIN's own school is read", async () => {
    const { status, body } = await get(ADMIN_A);
    expect(status).toBe(200);
    expect(m.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ schoolId: "school-A" }) }));
    expect(body.sentiment).toEqual({ good: 1, okay: 0, struggling: 1 });
  });
  it("guard: its own schoolId passed explicitly is allowed", async () => {
    expect((await get(ADMIN_A, "?schoolId=school-A")).status).toBe(200);
  });
  it("guard: a TEACHER is refused before any read", async () => {
    expect((await get({ id: "t", role: "TEACHER", schoolId: "school-A" })).status).toBe(403);
    expect(m.findMany).not.toHaveBeenCalled();
  });
  it("guard: the platform path is unchanged here (AT-PLATFORM-PERM decides it)", async () => {
    await get({ ...ADMIN_A, isPlatformAdmin: true }, "?schoolId=school-B");
    expect(m.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ schoolId: "school-B" }) }));
  });
});
