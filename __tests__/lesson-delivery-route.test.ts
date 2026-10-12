import { beforeEach, expect, it, vi } from "vitest";
const ports = vi.hoisted(() => ({ auth: vi.fn(), resolve: vi.fn(), transaction: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireRole: ports.auth }));
vi.mock("@/lib/db", () => ({ prisma: { $transaction: ports.transaction } }));
vi.mock("@/lib/lessons/lessonExperienceDelivery", async (original) => ({ ...await original<typeof import("@/lib/lessons/lessonExperienceDelivery")>(), resolveLessonDelivery: ports.resolve }));
import { GET } from "@/app/api/student/lessons/[id]/experience/route";
import { LessonDeliveryError } from "@/lib/lessons/lessonExperienceDelivery";
beforeEach(() => {
  vi.clearAllMocks();
  ports.auth.mockResolvedValue({ id: "student", role: "STUDENT", schoolId: "school" });
  ports.transaction.mockImplementation(async (callback) => callback("tx"));
  ports.resolve.mockResolvedValue({ compatibility: "NATIVE_V2", evidenceDisposition: { authoritativeSubmission: false } });
});
it("uses STUDENT auth, exact-version resolution and a repeatable-read snapshot; disables shared caching", async () => {
  const result = await GET(new Request("https://example.test/api/student/lessons/lesson/experience?version=1"), { params: { id: "lesson" } });
  expect(result.status).toBe(200);
  expect(result.headers.get("cache-control")).toBe("private, no-store");
  expect(ports.auth).toHaveBeenCalledWith("STUDENT");
  expect(ports.resolve).toHaveBeenCalledWith("tx", expect.objectContaining({ role: "STUDENT" }), "lesson", "1");
  expect(ports.transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "RepeatableRead" });
});
it.each([401, 403])("denies authentication status %s without resolving delivery", async (status) => {
  ports.auth.mockRejectedValue({ status });
  const result = await GET(new Request("https://example.test"), { params: { id: "lesson" } });
  expect(result.status).toBe(status);
  expect(ports.resolve).not.toHaveBeenCalled();
});
it("returns unavailable on stale version without payload or private error detail", async () => {
  ports.resolve.mockRejectedValue(new LessonDeliveryError(409, "INCOMPATIBLE_VERSION"));
  const result = await GET(new Request("https://example.test"), { params: { id: "lesson" } });
  expect(result.status).toBe(409);
  expect(await result.json()).toEqual({ compatibility: "UNAVAILABLE", error: "INCOMPATIBLE_VERSION" });
});
