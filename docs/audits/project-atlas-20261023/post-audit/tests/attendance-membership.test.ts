import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ user: vi.fn(), meeting: vi.fn(), roster: vi.fn(), write: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireRole: mocks.user }));
vi.mock("@/lib/db", () => ({ prisma: {
  meeting: { findFirst: mocks.meeting }, enrollment: { findMany: mocks.roster }, attendanceRecord: { upsert: mocks.write },
} }));
import { PATCH } from "@/app/api/attendance/[meetingId]/route";
const mark = { studentId: "synthetic-student-A", status: "PRESENT" };
beforeEach(() => {
  vi.clearAllMocks(); mocks.user.mockResolvedValue({ id: "synthetic-teacher-A", role: "TEACHER", schoolId: "synthetic-school-A" });
  mocks.meeting.mockResolvedValue({ id: "synthetic-meeting", classId: "synthetic-class-A", Class: { teacherId: "synthetic-teacher-A", schoolId: "synthetic-school-A" } });
  mocks.roster.mockResolvedValue([{ studentId: mark.studentId }]); mocks.write.mockResolvedValue({ id: "synthetic-mark" });
});
function patch(records = [mark]) {
  return PATCH(new Request("http://atlas.invalid/api/attendance/synthetic-meeting", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ records }) }), { params: { meetingId: "synthetic-meeting" } });
}
describe("AT-ADJ-02 staff attendance requires class enrollment and tenant", () => {
  it("foreign or unenrolled learner is denied before any write", async () => {
    mocks.roster.mockResolvedValue([]);
    expect((await patch()).status).toBe(403); expect(mocks.write).not.toHaveBeenCalled();
  });
  it("one invalid learner rejects the whole mixed batch", async () => {
    expect((await patch([mark, { ...mark, studentId: "synthetic-foreign-B" }])).status).toBe(403);
    expect(mocks.write).not.toHaveBeenCalled();
  });
  it.each([null, undefined, "", "  "])("missing school %s denies before lookup", async schoolId => {
    mocks.user.mockResolvedValue({ id: "synthetic-teacher-A", role: "TEACHER", schoolId });
    expect((await patch()).status).toBe(403); expect(mocks.meeting).not.toHaveBeenCalled(); expect(mocks.write).not.toHaveBeenCalled();
  });
  it("own-class enrolled learner still accepts trusted teacher mark", async () => {
    const response = await patch(); expect(response.status).toBe(200); expect(await response.json()).toMatchObject({ ok: true, updated: 1 });
    expect(mocks.roster).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({
      classId: "synthetic-class-A", studentId: { in: [mark.studentId] },
      Class: { schoolId: "synthetic-school-A" }, Student: expect.objectContaining({ user: { schoolId: "synthetic-school-A" } }),
    }) })); expect(mocks.write).toHaveBeenCalledOnce();
  });
  it("same-school administrator retains enrolled roster authority", async () => {
    mocks.user.mockResolvedValue({ id: "synthetic-admin-A", role: "ADMIN", schoolId: "synthetic-school-A" });
    expect((await patch()).status).toBe(200); expect(mocks.write).toHaveBeenCalledOnce();
  });
  it("another teacher cannot mark the meeting", async () => {
    mocks.user.mockResolvedValue({ id: "synthetic-other-teacher", role: "TEACHER", schoolId: "synthetic-school-A" });
    expect((await patch()).status).toBe(403); expect(mocks.roster).not.toHaveBeenCalled(); expect(mocks.write).not.toHaveBeenCalled();
  });
  it("foreign or absent meeting remains hidden", async () => {
    mocks.meeting.mockResolvedValue(null);
    expect((await patch()).status).toBe(404); expect(mocks.write).not.toHaveBeenCalled();
  });
  it("conflicting duplicate marks cannot race", async () => {
    expect((await patch([mark, { ...mark, status: "ABSENT" }])).status).toBe(400); expect(mocks.write).not.toHaveBeenCalled();
  });
});
