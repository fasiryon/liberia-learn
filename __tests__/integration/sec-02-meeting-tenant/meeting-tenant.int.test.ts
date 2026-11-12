/** CoS db-integration: disposable loopback PostgreSQL, connection_limit=1,
 * LL_SEC_02_DB_TEST=1, db_setup=push. Real route, tenant/enrollment queries and
 * attendee writes; only session and product-signal delivery are substituted.
 */
import { beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { PrismaClient } from "@prisma/client";
const h = vi.hoisted(() => ({ actor: { id: "", role: "STUDENT", schoolId: "" }, signal: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireRole: async (role: string) => {
  if (h.actor.role !== role) throw Object.assign(new Error("Forbidden"), { status: 403 }); return h.actor;
} }));
vi.mock("@/lib/autonomous/signals/productSignalService", () => ({ logProductSignal: h.signal }));
let admitted = false;
try {
  const url = new URL(process.env.DATABASE_URL ?? "");
  admitted = process.env.LL_SEC_02_DB_TEST === "1" && ["postgres:", "postgresql:"].includes(url.protocol) &&
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) && /(?:e2e|test|sec.?02)/i.test(url.pathname) &&
    url.searchParams.get("connection_limit") === "1";
} catch { /* No disposable PostgreSQL target. */ }
if (process.env.LL_SEC_02_DB_TEST === "1" && !admitted) throw new Error("SEC-02 requires disposable loopback PostgreSQL with connection_limit=1");
describe.skipIf(!admitted)("SEC-02 meeting join native tenant boundaries", () => {
  let db: PrismaClient;
  let post: typeof import("@/app/api/student/meetings/[meetingId]/join/route").POST;
  const prefix = `sec02-${Date.now().toString(36)}`;
  const a = `${prefix}-A`, b = `${prefix}-B`, cls = `${prefix}-class`, foreignClass = `${prefix}-foreign`;
  const meeting = `${prefix}-meeting`, foreignMeeting = `${prefix}-foreign-meeting`;
  const enrolled = `${prefix}-enrolled`, outsider = `${prefix}-outsider`, foreign = `${prefix}-foreign-user`;
  beforeAll(async () => {
    ({ prisma: db } = await import("@/lib/db")); ({ POST: post } = await import("@/app/api/student/meetings/[meetingId]/join/route"));
    await db.school.createMany({ data: [{ id: a, name: "Synthetic A" }, { id: b, name: "Synthetic B" }] });
    await db.class.createMany({ data: [{ id: cls, schoolId: a, name: "A", subject: "MATH" },
      { id: foreignClass, schoolId: b, name: "B", subject: "MATH" }] });
    for (const [id, school] of [[enrolled, a], [outsider, a], [foreign, b]]) {
      await db.user.create({ data: { id, email: `${id}@synthetic.invalid`, role: "STUDENT", schoolId: school } });
      await db.student.create({ data: { id: `${id}-student`, userId: id } });
    }
    // A deliberately inconsistent foreign enrollment must not override the learner's school.
    await db.enrollment.createMany({ data: [{ studentId: `${enrolled}-student`, classId: cls },
      { studentId: `${foreign}-student`, classId: cls }] });
    await db.meeting.createMany({ data: [[meeting, cls], [foreignMeeting, foreignClass]].map(([id, classId]) => ({
      id, classId, liveStatus: "LIVE", startsAt: new Date(), endsAt: new Date(Date.now() + 60_000),
      joinUrl: `https://synthetic.invalid/${id}`,
    })) });
  });
  const join = (id: string) => post(new NextRequest("http://localhost/api/student/meetings/join", { method: "POST" }), { params: { meetingId: id } });
  async function deny(userId: string, schoolId: string, target: string) {
    h.actor = { id: userId, role: "STUDENT", schoolId }; h.signal.mockClear();
    const response = await join(target); expect(response.status).toBe(404);
    expect(await response.text()).not.toContain("https://synthetic.invalid");
    expect(await db.meetingAttendee.count({ where: { userId, meetingId: target } })).toBe(0);
    expect(h.signal).not.toHaveBeenCalled();
  }
  it("denies foreign meetings", () => deny(enrolled, a, foreignMeeting));
  it("denies unenrolled same-school students", () => deny(outsider, a, meeting));
  it("denies an inconsistent cross-school enrollment", () => deny(foreign, b, meeting));
  it("denies a soft-deleted student", async () => {
    await db.student.update({ where: { userId: enrolled }, data: { deletedAt: new Date() } });
    try { await deny(enrolled, a, meeting); }
    finally { await db.student.update({ where: { userId: enrolled }, data: { deletedAt: null } }); }
  });
  it("preserves legitimate join and its signal", async () => {
    h.actor = { id: enrolled, role: "STUDENT", schoolId: a }; h.signal.mockClear();
    const response = await join(meeting); expect(response.status).toBe(200);
    expect(await db.meetingAttendee.count({ where: { userId: enrolled, meetingId: meeting } })).toBe(1);
    expect(h.signal).toHaveBeenCalledWith(expect.objectContaining({ schoolId: a, studentId: `${enrolled}-student` }));
  });
});
