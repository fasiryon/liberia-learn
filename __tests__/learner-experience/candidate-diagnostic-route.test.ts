import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
const boundary = vi.hoisted(() => ({ authorize: vi.fn(), resolve: vi.fn() }));
vi.mock("@/lib/learner-experience/reviewerAccess", () => ({ requireCandidateReviewer: boundary.authorize }));
vi.mock("@/lib/learner-experience/candidateReview", async importOriginal => {
  const original = await importOriginal<typeof import("@/lib/learner-experience/candidateReview")>();
  return { ...original, reviewDiagnosticResult: boundary.resolve };
});
import { POST } from "@/app/lab-review/experience/[experienceId]/diagnostic/route";
const context = { params: { experienceId: "candidate-ft01-g7-civics-counties-capitals" } };
const make = (origin = "http://127.0.0.1:3195", extra = {}) => new NextRequest("http://localhost:3195/lab-review/experience/candidate-ft01-g7-civics-counties-capitals/diagnostic", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify({ packageHash: "a".repeat(64), responses: {}, ...extra }) });
describe("candidate diagnostic HTTP boundary", () => {
  beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("NEXTAUTH_URL", "http://127.0.0.1:3195"); boundary.authorize.mockResolvedValue({ id: "synthetic-reviewer" }); });
  afterEach(() => vi.unstubAllEnvs());
  it("authorizes before resolving protected resources", async () => {
    boundary.authorize.mockRejectedValue(new Error("NOT_FOUND"));
    await expect(POST(make(), context)).rejects.toThrow("NOT_FOUND");
    expect(boundary.resolve).not.toHaveBeenCalled();
  });
  it("rejects foreign origins and client asserted grades without invoking scoring", async () => {
    expect((await POST(make("https://untrusted.invalid"), context)).status).toBe(403);
    expect((await POST(make(undefined, { officialGrade: 100 }), context)).status).toBe(400);
    expect(boundary.resolve).not.toHaveBeenCalled();
  });
  it("accepts the configured canonical origin even when Next internally normalizes its hostname", async () => {
    boundary.resolve.mockReturnValue({ phase: "INSTRUCTION", officialGrades: false, masteryWrites: false, released: false });
    const result = await POST(make(), context);
    expect(result.status).toBe(200);
    expect(result.headers.get("cache-control")).toBe("private, no-store");
    expect(await result.json()).toMatchObject({ officialGrades: false, masteryWrites: false, released: false });
  });
  it("rejects stale and unknown candidate selections safely", async () => {
    boundary.resolve.mockReturnValue(null);
    expect((await POST(make(), context)).status).toBe(404);
  });
});
