import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
vi.mock("next-auth/jwt", () => ({ getToken: vi.fn() }));
import { getToken } from "next-auth/jwt";
import { middleware } from "@/middleware";
const token = vi.mocked(getToken);
const paths = ["/lab-review/experience/candidate-ft01-g7-civics-counties-capitals", "/lab-review/experience/candidate-ft01-g7-civics-counties-capitals/diagnostic", "/lab-review/experience/candidate-ft01-g7-civics-counties-capitals/media/abc", "/lab-review/experience/candidate-ft01-g7-civics-counties-capitals/lab/g7-liberia-counties", "/lab-review/unknown"];
describe("review harness authorization and cache containment", () => {
  beforeEach(() => { vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("LAB_REVIEW_HARNESS", "1"); vi.stubEnv("VERCEL", ""); vi.clearAllMocks(); });
  afterEach(() => vi.unstubAllEnvs());
  it.each(paths)("rejects anonymous and student requests before resolver for %s", async pathname => {
    for (const identity of [null, { id: "synthetic-student", role: "STUDENT" }, { id: "synthetic-teacher", role: "TEACHER" }, { role: "MOE_OFFICIAL" }]) {
      token.mockResolvedValue(identity);
      const response = await middleware(new NextRequest(`http://localhost${pathname}`));
      expect(response.status).toBe(404);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(response.headers.get("vary")).toContain("Cookie");
    }
  });
  it("allows a signed national reviewer through the existing read scope", async () => {
    token.mockResolvedValue({ id: "synthetic-reviewer", role: "MOE_OFFICIAL" });
    expect((await middleware(new NextRequest(`http://localhost${paths[0]}`))).headers.get("x-middleware-next")).toBe("1");
  });
  it.each(["production", "vercel", "disabled"])("rejects even reviewers when %s", async mode => {
    token.mockResolvedValue({ id: "synthetic-reviewer", role: "MOE_OFFICIAL" });
    if (mode === "production") vi.stubEnv("NODE_ENV", "production");
    if (mode === "vercel") vi.stubEnv("VERCEL", "1");
    if (mode === "disabled") vi.stubEnv("LAB_REVIEW_HARNESS", "0");
    expect((await middleware(new NextRequest(`http://localhost${paths[0]}`))).status).toBe(404);
    expect(token).not.toHaveBeenCalled();
  });
});
