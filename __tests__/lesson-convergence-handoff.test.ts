import { beforeEach, expect, it, vi } from "vitest";
import { buildStudentLabLaunchHref, parseStudentLabReturn } from "@/lib/learner-experience/labLaunch";
import { authorizeStudentLabReturn } from "@/lib/lessons/authorizeLabReturn";
import { runtimeLessonDelivery, FIXTURE_LAB_ID } from "../e2e/product-design-v2/lessonFixtures";
const ports = vi.hoisted(() => ({ resolve: vi.fn() }));
vi.mock("@/lib/lessons/lessonExperienceDelivery", () => ({ resolveLessonDelivery: ports.resolve }));
const delivery = () => runtimeLessonDelivery(6, { labAuthorized: true });
const user = { id: "test-only-student", role: "STUDENT", schoolId: "test-only-school" };
const query = (kind: "CONTENT" | "SCHEDULED_WORK") => {
  const d = delivery();
  const target = kind === "CONTENT" ? { kind, contentId: d.lessonId } : { kind, contentId: d.lessonId, scheduledWorkId: "test-only-work" };
  return Object.fromEntries(new URL(buildStudentLabLaunchHref(target, { ...d.authorizedLabLinks[0].launchContext, origin: { ...d.authorizedLabLinks[0].launchContext.origin, activityId: kind === "SCHEDULED_WORK" ? "test-only-work" : d.lessonId } }), "https://example.test").searchParams);
};
beforeEach(() => { vi.clearAllMocks(); ports.resolve.mockResolvedValue(delivery()); });
it.each(["CONTENT", "SCHEDULED_WORK"] as const)("reauthorizes %s and returns to its exact scene", async (kind) => {
  const d = delivery();
  if (kind === "SCHEDULED_WORK") ports.resolve.mockResolvedValue({ ...d, routeTarget: { kind: "SCHEDULED_WORK", scheduledWorkId: "test-only-work", contentId: d.lessonId }, authorizedLabLinks: d.authorizedLabLinks.map((link) => ({ ...link, launchContext: { ...link.launchContext, origin: { ...link.launchContext.origin, activityId: "test-only-work" } } })) });
  const result = await authorizeStudentLabReturn({} as any, user, FIXTURE_LAB_ID, query(kind));
  expect(result?.returnHref).toBe(kind === "CONTENT" ? "/student/lesson/fixture-levers-g6?scene=lab&from=lab" : "/student/lessons/test-only-work?scene=lab&from=lab");
  expect(ports.resolve).toHaveBeenCalledWith({}, user, kind === "CONTENT" ? "fixture-levers-g6" : "test-only-work", "1.0.0", kind);
  expect(result?.context.origin.activityId).toBe(kind === "SCHEDULED_WORK" ? "test-only-work" : d.lessonId);
});
it.each(["exp", "ver", "scene", "link", "activity", "obj"])("rejects tampered %s", async (field) => {
  const q = { ...query("SCHEDULED_WORK"), [field]: "tampered" };
  expect(await authorizeStudentLabReturn({} as any, user, FIXTURE_LAB_ID, q)).toBeNull();
});
it.each(["https://evil.test", "c:../bad", "w://evil.test", "c:other-content"])("rejects malformed return %s", async (rt) => {
  expect(parseStudentLabReturn(FIXTURE_LAB_ID, { ...query("CONTENT"), rt })).toBeNull();
});
it.each(["g4-solid-figures", "fixture-lever", "fixture-simple-circuit", "mount-coffee-hydropower"])("showcase %s cannot supply certified lesson authority", async (labId) => {
  ports.resolve.mockResolvedValue({ ...delivery(), authorizedLabLinks: [] });
  expect(await authorizeStudentLabReturn({} as any, user, labId, query("CONTENT"))).toBeNull();
});
it("fails closed when release or learner authorization is lost", async () => {
  ports.resolve.mockRejectedValue(new Error("unavailable"));
  expect(await authorizeStudentLabReturn({} as any, user, FIXTURE_LAB_ID, query("CONTENT"))).toBeNull();
});
