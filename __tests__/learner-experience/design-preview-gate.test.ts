import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { isStudentDesignPreviewEnabled } from "@/lib/learner-experience/demo/designPreview";

vi.mock("next-auth/jwt", () => ({ getToken: vi.fn(async () => null) }));

describe("Student design preview gate", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

  it("is off in production unless STUDENT_DESIGN_PREVIEW=1 is set on purpose", () => {
    expect(isStudentDesignPreviewEnabled({ NODE_ENV: "production" })).toBe(false);
    expect(isStudentDesignPreviewEnabled({ NODE_ENV: "production", STUDENT_DESIGN_PREVIEW: "true" })).toBe(false);
    expect(isStudentDesignPreviewEnabled({ NODE_ENV: "production", STUDENT_DESIGN_PREVIEW: "1" })).toBe(true);
    expect(isStudentDesignPreviewEnabled({ NODE_ENV: "development" })).toBe(true);
    expect(isStudentDesignPreviewEnabled({ NODE_ENV: "test" })).toBe(true);
  });

  it("the page 404s in a production build without the flag", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("STUDENT_DESIGN_PREVIEW", "");
    const { default: Page } = await import("@/app/design-preview/grade-7-place-value/page");
    expect(() => Page()).toThrow(/NEXT_NOT_FOUND|NEXT_HTTP_ERROR_FALLBACK/);
  });

  it("production middleware does not make /design-preview public (anonymous users go to sign-in)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.resetModules();
    const { middleware } = await import("@/middleware");
    const response = await middleware(new NextRequest("https://example.test/design-preview/grade-7-place-value"));
    expect(response.status).toBeGreaterThanOrEqual(300);
    expect(response.status).toBeLessThan(400);
    expect(response.headers.get("location") ?? "").toMatch(/\/login/);
  });

  it("development middleware lets the dev-only preview through without sign-in", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.resetModules();
    const { middleware } = await import("@/middleware");
    const response = await middleware(new NextRequest("http://localhost:3000/design-preview/grade-7-place-value"));
    expect(response.headers.get("location")).toBeNull();
  });
});
