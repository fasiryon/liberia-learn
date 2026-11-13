/**
 * AT-R-LAB revision (COS-T1-AT-R-LAB-REVIEW.md): a lab counts as scored only when a teacher has reviewed it.
 * Unreviewed sessions (no score, or a student-supplied provisional score) never enter the class average as zero or
 * as a score, and are reported as pending. Synthetic identities and mocks only.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sessions: [] as any[] }));
vi.mock("@/lib/serverFlags", () => ({ isVirtualLabsEnabled: () => true }));
vi.mock("@/lib/auth", () => ({ requireRole: async () => ({ id: "synthetic-teacher", role: "TEACHER", schoolId: "synthetic-school" }) }));
vi.mock("@/lib/db", () => ({
  prisma: {
    class: { findUnique: async () => ({ schoolId: "synthetic-school", teacherId: "synthetic-teacher" }) },
    enrollment: { findMany: async () => [{ Student: { userId: "s1" } }, { Student: { userId: "s2" } }, { Student: { userId: "s3" } }] },
    scheduledWork: { findMany: async () => [{ id: "w1" }] },
    labSession: { findMany: async () => mocks.sessions },
    virtualLab: { findMany: async () => [{ labId: "plant-lab", title: "Plant Growth Lab" }] },
  },
}));

import { GET } from "@/app/api/teacher/labs/sessions/route";

const at = new Date("2026-10-24T10:00:00Z");
const session = (id: string, over: Record<string, unknown>) => ({ id, labId: "plant-lab", scheduledWorkId: "w1", startedAt: at, completedAt: at, score: null, teacherFeedback: null, ...over });
const read = async () => (await (await GET(new Request("http://localhost/api/teacher/labs/sessions?classId=c1") as any)).json()).sessions[0];

beforeEach(() => { mocks.sessions = []; });

describe("AT-R-LAB: teacher class lab average", () => {
  it("one teacher-scored 80 and one unreviewed gives 80 with 1 pending, never 40", async () => {
    mocks.sessions = [session("a", { score: 80, teacherFeedback: "Clear evidence, conclusion needs one more detail." }), session("b", {})];
    expect(await read()).toMatchObject({ completedCount: 2, avgScore: 80, reviewedCount: 1, pendingCount: 1 });
  });
  it("a student-supplied provisional score is pending, not part of the average", async () => {
    mocks.sessions = [session("a", { score: 80, teacherFeedback: "Clear evidence, conclusion needs one more detail." }), session("b", { score: 100 })];
    expect(await read()).toMatchObject({ avgScore: 80, reviewedCount: 1, pendingCount: 1 });
  });
  it("no reviewed session gives no average", async () => {
    mocks.sessions = [session("a", {}), session("b", { score: 55 }), session("c", { completedAt: null })];
    expect(await read()).toMatchObject({ completedCount: 2, avgScore: null, reviewedCount: 0, pendingCount: 2 });
  });
});

describe("AT-R-LAB: the shared reviewed rule", async () => {
  const { isTeacherReviewed, labReviewSummary } = await import("@/lib/labs/labReview");
  it("needs both a score and the teacher's feedback", () => {
    expect(isTeacherReviewed({ completedAt: at, score: 70, teacherFeedback: "Good use of evidence in the conclusion." })).toBe(true);
    expect(isTeacherReviewed({ completedAt: at, score: 70, teacherFeedback: null })).toBe(false);
    expect(isTeacherReviewed({ completedAt: at, score: 70, teacherFeedback: "   " })).toBe(false);
    expect(isTeacherReviewed({ completedAt: at, score: null, teacherFeedback: "Feedback without a score." })).toBe(false);
    expect(labReviewSummary([])).toEqual({ completedCount: 0, reviewedCount: 0, pendingCount: 0, avgScore: null });
  });
});
