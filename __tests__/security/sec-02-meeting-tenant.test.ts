import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({
  actor: { id: "student-user", role: "STUDENT", schoolId: "school-A", isPlatformAdmin: false },
  meeting: { id: "meeting-1", classId: "class-1", liveStatus: "LIVE", joinUrl: "https://meeting.synthetic.invalid/private",
    Class: { id: "class-1", schoolId: "school-A", subject: "MATH" } },
  student: vi.fn(), attendee: vi.fn(), signal: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ requireRole: async (role: string) => {
  if (m.actor.role !== role) throw Object.assign(new Error("Forbidden"), { status: 403 }); return m.actor;
} }));
vi.mock("@/lib/db", () => ({ prisma: {
  meeting: { findUnique: async () => m.meeting },
  student: { findUnique: m.student, findFirst: m.student },
  meetingAttendee: { upsert: m.attendee },
} }));
vi.mock("@/lib/autonomous/signals/productSignalService", () => ({ logProductSignal: m.signal }));
import { POST } from "@/app/api/student/meetings/[meetingId]/join/route";
const join = () => POST(new NextRequest("http://localhost/api/student/meetings/meeting-1/join", { method: "POST" }),
  { params: { meetingId: "meeting-1" } });
beforeEach(() => {
  vi.clearAllMocks();
  m.actor = { id: "student-user", role: "STUDENT", schoolId: "school-A", isPlatformAdmin: false };
  m.meeting = { id: "meeting-1", classId: "class-1", liveStatus: "LIVE", joinUrl: "https://meeting.synthetic.invalid/private",
    Class: { id: "class-1", schoolId: "school-A", subject: "MATH" } };
  m.student.mockResolvedValue({ id: "student-1" });
});
async function refused(status: number) {
  const response = await join(); expect(response.status).toBe(status);
  expect(await response.text()).not.toContain(m.meeting.joinUrl);
  expect(m.attendee).not.toHaveBeenCalled(); expect(m.signal).not.toHaveBeenCalled();
}
describe("SEC-02 meeting join authority", () => {
  it("denies a foreign school's LIVE meeting", async () => { m.meeting.Class.schoolId = "school-B"; await refused(404); });
  it("denies a school-less student", async () => { m.actor.schoolId = ""; await refused(404); });
  it("denies an unenrolled same-school student", async () => { m.student.mockResolvedValue(null); await refused(404); });
  it.each(["TEACHER", "GUARDIAN", "ADMIN"])("preserves %s refusal", async (role) => { m.actor.role = role; await refused(403); });
  it("does not admit a platform administrator", async () => { m.actor.role = "ADMIN"; m.actor.isPlatformAdmin = true; await refused(403); });
  it("keeps the live-status check after authority", async () => { m.meeting.liveStatus = "ENDED"; await refused(400); });
  it("does not disclose meeting status to an unenrolled learner", async () => {
    m.meeting.liveStatus = "ENDED"; m.student.mockResolvedValue(null); await refused(404);
  });
  it("returns the meeting link and preserves the join signal for an enrolled student", async () => {
    const response = await join(); expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ joinUrl: m.meeting.joinUrl });
    expect(m.student).toHaveBeenCalledWith({ where: { userId: "student-user", deletedAt: null,
      user: { schoolId: "school-A" }, enrollments: { some: { classId: "class-1" } } }, select: { id: true } });
    expect(m.attendee).toHaveBeenCalledTimes(1);
    expect(m.signal).toHaveBeenCalledWith(expect.objectContaining({ schoolId: "school-A", classId: "class-1",
      studentId: "student-1", eventType: "live_session.joined" }));
  });
});
