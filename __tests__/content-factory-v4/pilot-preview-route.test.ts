import { afterEach, describe, expect, it, vi } from "vitest";
const boundary = vi.hoisted(() => ({ requireRole: vi.fn(), load: vi.fn(), authorize: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireRole: boundary.requireRole }));
vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/curriculum/v4/learningPreview", async importOriginal => ({
  ...await importOriginal<typeof import("@/lib/curriculum/v4/learningPreview")>(), loadStudentLearningPreview: boundary.load,
  authorizeStudentLearningPreview: boundary.authorize,
}));
import { GET } from "@/app/api/student/learning-preview/[key]/route";
const selection = "factory@4.0.0-draft.6@g7-math-area-perimeter";
const request = () => new Request(`http://localhost/api/student/learning-preview/${selection}`);
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
describe("pilot HTTP boundary", () => {
  it("denies the default disabled flag before authentication or package/database access", async () => {
    vi.stubEnv("V4_LEARNING_PREVIEW_ENABLED", "0");
    const response = await GET(request(), { params: { key: selection } });
    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(boundary.requireRole).not.toHaveBeenCalled(); expect(boundary.load).not.toHaveBeenCalled();
  });
  it("denies absent or unauthorized sessions without disclosing a lesson", async () => {
    vi.stubEnv("V4_LEARNING_PREVIEW_ENABLED", "1");
    boundary.requireRole.mockRejectedValue(Object.assign(new Error("unauthorized"), { status: 401 }));
    const response = await GET(request(), { params: { key: selection } });
    expect(response.status).toBe(404); expect(await response.json()).toEqual({ error: "Not found" });
    expect(boundary.requireRole).toHaveBeenCalledWith("STUDENT"); expect(boundary.load).not.toHaveBeenCalled();
  });
  it("fails closed on package integrity failure", async () => {
    vi.stubEnv("V4_LEARNING_PREVIEW_ENABLED", "1");
    boundary.requireRole.mockResolvedValue({ id: "test-only", role: "STUDENT" });
    boundary.load.mockRejectedValue(new Error("draft6_review_file_hash:candidate.json"));
    const response = await GET(request(), { params: { key: selection } });
    expect(response.status).toBe(404); expect(await response.json()).toEqual({ error: "Not found" });
  });
  it("denies temporary DB failure with a generic uncached 503", async () => {
    vi.stubEnv("V4_LEARNING_PREVIEW_ENABLED", "1");
    boundary.requireRole.mockResolvedValue({ id: "test-only", role: "STUDENT" });
    boundary.load.mockRejectedValue(new Error("database_unavailable"));
    const response = await GET(request(), { params: { key: selection } });
    expect(response.status).toBe(503); expect(await response.json()).toEqual({ error: "Preview unavailable" });
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("reauthorizes heartbeats without loading or returning package content", async () => {
    vi.stubEnv("V4_LEARNING_PREVIEW_ENABLED", "1");
    boundary.requireRole.mockResolvedValue({ id: "test-only", role: "STUDENT" });
    boundary.authorize.mockResolvedValue({ status: "PILOT_ONLY", identity: { selection, packageHash: "TEST_ONLY" }, expiresAt: "2026-10-23T00:00:00Z" });
    const response = await GET(new Request(request().url + "?accessOnly=1"), { params: { key: selection } });
    expect(response.status).toBe(200); expect(await response.json()).not.toHaveProperty("experience");
    expect(boundary.load).not.toHaveBeenCalled(); expect(boundary.authorize).toHaveBeenCalledOnce();
  });
});
