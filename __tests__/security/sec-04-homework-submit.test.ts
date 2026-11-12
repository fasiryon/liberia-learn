import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  actor: { id: "student-user", role: "STUDENT", schoolId: "school-A", isPlatformAdmin: false },
  tenant: "school-A", student: vi.fn(), homework: vi.fn(), submit: vi.fn(),
}));
vi.mock("@/lib/tenant", () => ({ requireTenant: async () => ({ schoolId: m.tenant }) }));
vi.mock("@/lib/auth", () => ({ requireRole: async (role: string) => {
  if (m.actor.role !== role) throw Object.assign(new Error("Forbidden"), { status: 403 }); return m.actor;
} }));
vi.mock("@/lib/db", () => ({ prisma: { student: { findFirst: m.student }, homework: { findFirst: m.homework },
  homeworkSubmission: { upsert: m.submit } } }));
import { POST } from "@/app/api/student/homework/submit/route";
const submit = (redirect = "/assignments") => {
  const body = new FormData(); body.set("homeworkId", "homework-1"); body.set("redirectTo", redirect); body.set("answer_0", "Synthetic answer");
  return POST(new Request("http://localhost/api/student/homework/submit", { method: "POST", body }))
    .catch(() => new Response("uncaught route exception", { status: 500 }));
};
beforeEach(() => {
  vi.clearAllMocks(); m.actor = { id: "student-user", role: "STUDENT", schoolId: "school-A", isPlatformAdmin: false };
  m.tenant = "school-A"; m.student.mockResolvedValue({ id: "student-1" }); m.homework.mockResolvedValue({ id: "homework-1" });
});
describe("SEC-04 homework ownership and redirects", () => {
  it("refuses unavailable homework without writing", async () => {
    m.homework.mockResolvedValue(null); expect((await submit()).status).toBe(404); expect(m.submit).not.toHaveBeenCalled();
  });
  it("requires current tenant and student school to agree", async () => {
    m.tenant = "school-B"; expect((await submit()).status).toBe(403); expect(m.submit).not.toHaveBeenCalled();
  });
  it.each(["https://outside.invalid/steal", "//outside.invalid/steal", "/\\outside.invalid", "\\\\outside.invalid", "javascript:alert(1)", " /assignments"])(
    "refuses non-local redirect %s before writing", async redirect => {
      expect((await submit(redirect)).status).toBe(400); expect(m.submit).not.toHaveBeenCalled();
    });
  it.each(["TEACHER", "GUARDIAN", "ADMIN"])("preserves %s refusal", async role => {
    m.actor.role = role; expect((await submit()).status).toBe(403); expect(m.submit).not.toHaveBeenCalled();
  });
  it("requires an active same-school student and exact-class enrollment", async () => {
    const response = await submit("/assignments?tab=mine#done"); expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/assignments?tab=mine#done");
    expect(m.student).toHaveBeenCalledWith({ where: { userId: "student-user", deletedAt: null, user: { schoolId: "school-A" } } });
    expect(m.homework).toHaveBeenCalledWith({ where: { id: "homework-1", Class: { schoolId: "school-A", enrollments: { some: { studentId: "student-1" } } } } });
    expect(m.submit).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ studentId: "student-1", homeworkId: "homework-1", answers: ["Synthetic answer"] }) }));
  });
});
