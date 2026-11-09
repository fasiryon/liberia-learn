/**
 * AT-GRADE-01 record scope for GET /api/teacher/labs/sessions?classId=A (Atlas independent review of 7aee0db2,
 * CLASS_AUTHORITY_INDEPENDENT_REVIEW.md). Class authority for A authorizes A's records, not every record of a learner
 * who happens to be enrolled in A: a session counts for A only when its scheduled work belongs to class A.
 * - The two `it.each` probes are Atlas's, unchanged (atlas-independent-lab-class-records.test.ts).
 * - A session with no scheduled work has no class, so it is withheld from every class view (fail closed).
 * Synthetic identities and mocks only.
 */
import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ co: false, query: null as null | Record<string, unknown>, workWhere: null as null | Record<string, unknown> }));
vi.mock("@/lib/auth", () => ({ requireRole: async () => ({ id: m.co ? "co-teacher" : "owner-A", role: "TEACHER", schoolId: "school-A" }) }));
vi.mock("@/lib/serverFlags", () => ({ isVirtualLabsEnabled: () => true }));
vi.mock("@/lib/db", () => ({ prisma: {
  class: { findUnique: async () => ({ schoolId: "school-A", teacherId: "owner-A" }) },
  teacherAssignment: { findMany: async () => m.co ? [{ subject: "SCIENCE" }] : [] },
  enrollment: { findMany: async () => [{ Student: { userId: "learner-A" } }] },
  scheduledWork: { findMany: async ({ where }: { where: Record<string, unknown> }) => { m.workWhere = where; return where.classId === "class-A" ? [{ id: "work-A" }] : []; } },
  labSession: { findMany: async ({ where }: { where: Record<string, unknown> }) => {
    m.query = where;
    const relation = where.scheduledWork;
    const classId = relation && typeof relation === "object" && "classId" in relation ? relation.classId : undefined;
    const work = where.scheduledWorkId;
    const workIds = work && typeof work === "object" && "in" in work && Array.isArray(work.in) ? work.in : null;
    return [
      { id: "session-class-A", classId: "class-A", scheduledWorkId: "work-A" },
      { id: "session-class-B", classId: "class-B", scheduledWorkId: "work-B" },
      { id: "session-unscheduled", classId: undefined, scheduledWorkId: null },
    ].filter(s => (!classId || s.classId === classId) && (!workIds || workIds.includes(s.scheduledWorkId)))
      .map(s => ({ ...s, studentId: "learner-A", schoolId: "school-A", labId: "science-lab", score: 80, teacherFeedback: "Reviewed synthetic evidence", startedAt: new Date(0), completedAt: new Date(0) }));
  } },
  virtualLab: { findMany: async () => [{ labId: "science-lab", subject: "SCIENCE", title: "Synthetic lab" }] },
} }));
import { GET } from "@/app/api/teacher/labs/sessions/route";
beforeEach(() => { m.co = false; m.query = null; m.workWhere = null; });
const sessionIds = async () => {
  const result = await GET(new Request("http://atlas.invalid/api/teacher/labs/sessions?classId=class-A") as never);
  expect(result.status).toBe(200);
  const body = await result.json();
  return body.sessions.flatMap((group: { sessions: { sessionId: string }[] }) => group.sessions.map(s => s.sessionId));
};
it.each([false, true])("a class-bound response excludes the same learner's session from another class, co-teacher=%s", async co => {
  m.co = co;
  const ids = await sessionIds();
  expect(ids).toContain("session-class-A");
  expect(ids).not.toContain("session-class-B");
});
it.each([false, true])("a session scheduled for no class is withheld from the class view, co-teacher=%s", async co => {
  m.co = co;
  expect(await sessionIds()).not.toContain("session-unscheduled");
});
it("the class's scheduled work is looked up for the requested class only", async () => {
  await sessionIds();
  expect(m.workWhere).toEqual({ classId: "class-A" });
  expect(m.query).toMatchObject({ scheduledWorkId: { in: ["work-A"] }, schoolId: "school-A" });
});
