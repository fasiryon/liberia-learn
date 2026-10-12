import { beforeEach, expect, it, vi } from "vitest";
const ports = vi.hoisted(() => ({ returned: null as any }));
vi.mock("@/lib/auth", () => ({ requireRole: async () => ({ id: "synthetic-student", role: "STUDENT", schoolId: "synthetic-school" }) }));
vi.mock("@/lib/db", () => ({ prisma: { $transaction: async (callback: any) => callback({}) } }));
vi.mock("@/lib/lessons/authorizeLabReturn", () => ({ authorizeStudentLabReturn: async () => ports.returned }));
vi.mock("@/lib/student/labEligibility", () => ({ loadAuthorizedPracticalSessions: async () => [] }));
vi.mock("@/lib/interactive-labs/v2/registry", () => ({ getInteractiveLabDefinition: () => ({ labId: "test-lab", version: "1.0.0", reviewState: "APPROVED", approvalState: "APPROVED", checks: [] }) }));
vi.mock("@/lib/learner-experience/labExperience", () => ({ fromInteractiveLab: () => ({}), isStudentAccessible: () => true }));
vi.mock("@/lib/student/showcaseLabs", () => ({ canAccessShowcaseLab: () => true, loadShowcaseStudentAuthority: async () => ({}) }));
import Page from "@/app/student/labs/[labId]/page";
beforeEach(() => { ports.returned = { context: { labId: "test-lab" }, returnHref: "/student/lesson/test?scene=lab&from=lab", labVersion: "1.0.0" }; });
it("matching authorized version enables the exact lesson return", async () => {
  const result = await Page({ params: { labId: "test-lab" }, searchParams: { rt: "c:test" } });
  expect(result.props.access).toBe("RELEASED");
  expect(result.props.lessonReturn.returnHref).toBe(ports.returned.returnHref);
});
it("lab version mismatch disables lesson return and denies the launch", async () => {
  ports.returned.labVersion = "old-version";
  const result = await Page({ params: { labId: "test-lab" }, searchParams: { rt: "c:test" } });
  expect(result.props.access).toBe("DENIED");
  expect(result.props.lessonReturn).toBeUndefined();
});
it("showcase access does not recover a denied lesson link", async () => {
  ports.returned = null;
  const result = await Page({ params: { labId: "test-lab" }, searchParams: { rt: "c:test" } });
  expect(result.props.access).toBe("DENIED");
  expect(result.props.lessonReturn).toBeUndefined();
});
