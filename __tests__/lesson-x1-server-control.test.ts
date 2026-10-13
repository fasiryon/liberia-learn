// X1 server controls: synthetic rows only; no hosted database or curriculum mutation.
import { beforeEach, expect, it, vi } from "vitest";
import { runG4Proof } from "@/lib/curriculum/v2/g4Proof";
import { learnerRowAllowed } from "@/lib/curriculum/learnerEligibility";
const ports = vi.hoisted(() => ({
  student: vi.fn(), content: vi.fn(), work: vi.fn(), byContent: vi.fn(), createWork: vi.fn(),
  enrollment: vi.fn(), createProgress: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ requireRole: async () => ({ id: "x1-user", role: "STUDENT", schoolId: "x1-school" }) }));
vi.mock("@/lib/db", () => {
  const tx = {
    student: { findUnique: ports.student }, curriculumContent: { findUnique: ports.content },
    scheduledWork: { findUnique: ports.work, findFirst: ports.byContent, create: ports.createWork },
    enrollment: { findUnique: ports.enrollment }, studentProgress: { create: ports.createProgress },
  };
  return { prisma: { ...tx, $transaction: async (callback: any) => callback(tx) } };
});
vi.mock("@/lib/autonomous/signals/productSignalService", () => ({ logProductSignal: vi.fn() }));
import { GET as experienceGET } from "@/app/api/student/lessons/[id]/experience/route";
import { GET as workGET } from "@/app/api/student/work/[scheduledWorkId]/route";
beforeEach(() => {
  vi.clearAllMocks();
  ports.student.mockResolvedValue({ id: "x1-student", enrollments: [{ classId: "x1-class", Class: { schoolId: "x1-school" } }] });
  ports.work.mockResolvedValue(null);
  ports.enrollment.mockResolvedValue({ id: "x1-enrollment" });
});
it("contentId requested as SCHEDULED_WORK returns indistinguishable plain 404 and creates no work", async () => {
  const response = await experienceGET(new Request("https://example.test/api/student/lessons/x1-content/experience?kind=SCHEDULED_WORK"), { params: { id: "x1-content" } });
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({ compatibility: "UNAVAILABLE", error: "UNAVAILABLE" });
  expect(ports.work).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "x1-content" } }));
  expect(ports.content).not.toHaveBeenCalled();
  expect(ports.byContent).not.toHaveBeenCalled();
  expect(ports.createWork).not.toHaveBeenCalled();
  expect(ports.createProgress).not.toHaveBeenCalled();
});
it("legacy work API Path 2 still rejects a native row before starting or returning its lesson", async () => {
  const proof = runG4Proof("equivalent-fractions.json", "moe-math-g4-s1-p3-number-theory-and-fraction-obj5");
  if (proof.status === "REJECTED") throw new Error(proof.errors.join());
  const content = { contentId: "x1-content", status: "published", schoolId: "x1-school", teacherCreated: false,
    visibility: "school_wide", versionId: null, grade: 4, subject: "MATH",
    payload: { curriculumV2: proof.lesson }, provenance: { lifecycleState: "APPROVED" } };
  expect(learnerRowAllowed(content)).toBe(false);
  ports.byContent.mockResolvedValue({ id: "x1-work", classId: "x1-class", class: { schoolId: "x1-school" }, content, progress: [] });
  const response = await workGET(new Request("https://example.test/api/student/work/x1-content") as any, { params: Promise.resolve({ scheduledWorkId: "x1-content" }) });
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({ error: "Lesson not found" });
  expect(ports.byContent).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ contentId: "x1-content" }) }));
  expect(ports.createProgress).not.toHaveBeenCalled();
  expect(ports.createWork).not.toHaveBeenCalled();
});
