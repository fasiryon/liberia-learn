/**
 * AT-GRADE-01-2C (CoS, 2026-10-28): POST /api/teacher/messages/reply. Atlas: the client-supplied thread and recipient are
 * not bound to class or school. A reply is allowed only when:
 * - the caller is a TEACHER with a school, and threadKey is exactly the pair {teacher, recipient} (the recipient must be
 *   the other participant);
 * - the recipient is a STUDENT or GUARDIAN of the teacher's school, and the conversation already exists (a reply; the
 *   only way a Message thread starts is a student writing to their class teacher, app/api/student/messages);
 * - the recipient links to a class where lib/authz/classAuthority grants the teacher class.feedback: a student through
 *   their own enrollment, a guardian through a linked child's enrollment;
 * - otherwise a non-disclosing 404 (recipient or conversation), or 403 (not a participant, not a teacher), before any
 *   read of message bodies and before any write, audit or push. The recipient role comes from the user, not a default.
 * Synthetic identities and mocks only.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  actor: null as unknown as { id: string; role: string; schoolId: string | null; name?: string },
  users: {} as Record<string, { id: string; role: string; schoolId: string | null }>,
  enrollments: {} as Record<string, string[]>, guardianChildren: {} as Record<string, string[]>,
  thread: true, threadSelects: [] as Record<string, unknown>[],
  assignments: [] as { schoolId: string; teacherId: string; classId: string; subject: string }[],
  create: vi.fn(), audit: vi.fn(), push: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ requireUser: async () => m.actor }));
vi.mock("@/lib/audit", () => ({ logAudit: m.audit }));
vi.mock("@/lib/push/sendPush", () => ({ sendPushToUser: m.push }));
vi.mock("@/lib/messaging/keywordFilter", () => ({ shouldFlag: () => false }));
vi.mock("@/lib/db", () => ({ prisma: {
  user: { findUnique: async ({ where }: { where: { id: string } }) => m.users[where.id] ?? null },
  student: { findUnique: async ({ where }: { where: { userId: string } }) => (m.enrollments[where.userId] ? { id: `stu-${where.userId}`, enrollments: m.enrollments[where.userId].map((classId) => ({ classId })) } : null) },
  studentGuardian: { findMany: async ({ where }: { where: { guardianId: string } }) => (m.guardianChildren[where.guardianId] ?? []).map((child) => ({ student: { enrollments: (m.enrollments[child] ?? []).map((classId) => ({ classId })) } })) },
  message: {
    findFirst: async ({ select }: { select: Record<string, unknown> }) => { m.threadSelects.push(select); return m.thread ? { id: "msg-1", senderRole: "STUDENT", recipientRole: "TEACHER", fromUserId: "stu-user", toUserId: "teacher-A" } : null; },
    create: m.create,
  },
  class: { findUnique: async ({ where }: { where: { id: string } }) => ({ "class-A": { schoolId: "school-A", teacherId: "teacher-A" }, "class-B": { schoolId: "school-A", teacherId: "teacher-B" } } as Record<string, unknown>)[where.id] ?? null },
  teacherAssignment: { findMany: async ({ where }: { where: Record<string, unknown> }) => m.assignments.filter((r) => Object.entries(where).every(([k, v]) => (r as Record<string, unknown>)[k] === v)) },
} }));

import { POST } from "@/app/api/teacher/messages/reply/route";

const key = (a: string, b: string) => [a, b].sort().join(":");
const send = async (recipientId: string, threadKey = key(m.actor.id, recipientId)) => {
  const res = await POST({ json: async () => ({ threadKey, recipientId, body: "Thank you, see you in class." }) } as never);
  return { status: res.status, body: await res.json() };
};
const nothingHappened = () => { expect(m.create).not.toHaveBeenCalled(); expect(m.audit).not.toHaveBeenCalled(); expect(m.push).not.toHaveBeenCalled(); };

beforeEach(() => {
  vi.clearAllMocks();
  m.actor = { id: "teacher-A", role: "TEACHER", schoolId: "school-A", name: "T" };
  m.users = { "stu-user": { id: "stu-user", role: "STUDENT", schoolId: "school-A" }, "guardian-user": { id: "guardian-user", role: "GUARDIAN", schoolId: "school-A" },
    "stu-other-class": { id: "stu-other-class", role: "STUDENT", schoolId: "school-A" }, "stu-other-school": { id: "stu-other-school", role: "STUDENT", schoolId: "school-B" },
    "teacher-B": { id: "teacher-B", role: "TEACHER", schoolId: "school-A" } };
  m.enrollments = { "stu-user": ["class-A"], "stu-other-class": ["class-B"], "stu-other-school": ["class-C"] };
  m.guardianChildren = { "guardian-user": ["stu-user"] };
  m.thread = true; m.threadSelects = []; m.assignments = [];
  m.create.mockResolvedValue({ id: "new-msg" });
});

describe("allowed replies", () => {
  it("the class teacher replies to an enrolled student in an existing thread", async () => {
    expect((await send("stu-user")).status).toBe(201);
    expect(m.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ toUserId: "stu-user", recipientRole: "STUDENT" }) }));
  });
  it("the class teacher replies to a guardian of an enrolled child (role from the user, not a default)", async () => {
    expect((await send("guardian-user")).status).toBe(201);
    expect(m.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ toUserId: "guardian-user", recipientRole: "GUARDIAN" }) }));
  });
});

describe("refused before any write, audit or push", () => {
  it("a recipient who is not the other participant of the thread (403)", async () => {
    expect((await send("stu-other-class", key("teacher-A", "stu-user"))).status).toBe(403);
    nothingHappened();
  });
  it.each([["a student of another school", "stu-other-school"], ["a same-school student not in any of the teacher's classes", "stu-other-class"],
    ["an unknown recipient", "nobody"], ["another teacher (not a student or guardian)", "teacher-B"]])("%s: non-disclosing 404", async (_, recipient) => {
    const { status, body } = await send(recipient);
    expect(status).toBe(404);
    expect(body).toEqual({ error: "Conversation not found" });
    nothingHappened();
  });
  it("a guardian whose linked children are not in the teacher's classes: 404", async () => {
    m.guardianChildren = { "guardian-user": ["stu-other-class"] };
    expect((await send("guardian-user")).status).toBe(404);
    nothingHappened();
  });
  it("no existing conversation (a reply cannot start one): 404", async () => {
    m.thread = false;
    expect((await send("stu-user")).status).toBe(404);
    nothingHappened();
  });
  it("a teacher with no school, and a non-teacher, are refused (403)", async () => {
    m.actor = { id: "teacher-A", role: "TEACHER", schoolId: null };
    expect((await send("stu-user")).status).toBe(403);
    m.actor = { id: "admin-A", role: "ADMIN", schoolId: "school-A" };
    expect((await send("stu-user")).status).toBe(403);
    nothingHappened();
  });
  it("the thread lookup never reads message bodies", async () => {
    await send("stu-user");
    expect(m.threadSelects.length).toBeGreaterThan(0);
    for (const select of m.threadSelects) expect(select).not.toHaveProperty("body");
  });
});
