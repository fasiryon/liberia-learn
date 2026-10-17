import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { config, middleware } from "@/middleware";

vi.mock("next-auth/jwt", () => ({ getToken: vi.fn() }));

describe("unreleased candidate assets", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

  const paths = [
    "/curriculum-candidates/g7-native-v1/math-hero-numbers.svg",
    "/%63urriculum-candidates/g7-native-v1/math-hero-numbers.svg",
    "/curriculum%2Dcandidates/g7-native-v1/math-hero-numbers.svg",
    "/curriculum-candidates%2Fg7-native-v1/math-hero-numbers.svg",
  ];

  it.each([null, { role: "STUDENT" }, { role: "TEACHER" }, { role: "ADMIN" }, { isPlatformAdmin: true }])(
    "denies production candidate artwork regardless of identity %j", async token => {
      vi.stubEnv("NODE_ENV", "production");
      vi.mocked(getToken).mockResolvedValue(token as never);
      for (const path of paths) {
        const response = await middleware(new NextRequest(`https://example.test${path}`));
        expect(response.status, path).toBe(404);
        expect(response.headers.get("cache-control")).toContain("no-store");
        expect(response.headers.get("content-security-policy")).toBeTruthy();
      }
      expect(getToken).not.toHaveBeenCalled();
    },
  );

  it("denies hosted previews even with a non-production NODE_ENV", async () => {
    vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("VERCEL", "1");
    const response = await middleware(new NextRequest(`https://example.test${paths[0]}`));
    expect(response.status).toBe(404);
  });

  it("rejects local candidate image optimization before authentication while preserving ordinary images", async () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(config.matcher).toContain("/_next/image");
    for (const path of paths) {
      const request = new NextRequest(`https://example.test/_next/image?url=${encodeURIComponent(path)}&w=640&q=75`);
      const response = await middleware(request);
      expect(response.status, path).toBe(404);
      expect(response.headers.get("cache-control")).toContain("no-store");
    }
    for (const source of [
      "https://example.test/curriculum-candidates/g7-native-v1/math-hero-numbers.svg",
      "/public/../curriculum-candidates/g7-native-v1/math-hero-numbers.svg",
      "/%2e%2e/curriculum-candidates/g7-native-v1/math-hero-numbers.svg",
      "/curriculum-candidates",
    ]) {
      const response = await middleware(new NextRequest(`https://example.test/_next/image?url=${encodeURIComponent(source)}&w=640&q=75`));
      expect(response.status, source).toBe(404);
    }
    const ordinary = await middleware(new NextRequest("https://example.test/_next/image?url=%2Flogo.png&w=640&q=75"));
    expect(ordinary.headers.get("x-middleware-next")).toBe("1");
    expect(getToken).not.toHaveBeenCalled();
  });

  it("preserves local development candidate diagrams and ordinary public assets", async () => {
    vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("VERCEL", "");
    const candidate = await middleware(new NextRequest(`http://localhost:3000${paths[0]}`));
    expect(candidate.headers.get("x-middleware-next")).toBe("1");
    vi.stubEnv("NODE_ENV", "production");
    const manifest = await middleware(new NextRequest("https://example.test/manifest.json"));
    expect(manifest.headers.get("x-middleware-next")).toBe("1");
  });
});
