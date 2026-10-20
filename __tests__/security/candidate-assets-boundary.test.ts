import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { middleware } from "@/middleware";
import { createRequire } from "node:module";
import { imageConfigDefault } from "next/dist/shared/lib/image-config";
import { ImageOptimizerCache } from "next/dist/server/image-optimizer";

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

  it("denies local image optimization by configuration, including candidate artwork", () => {
    // Next 14 serves /_next/image before middleware, so the optimizer's own
    // allowlist is the boundary. Validate with Next's real parameter check.
    vi.stubEnv("SKIP_ENV_VALIDATION", "true");
    const nextConfig = createRequire(import.meta.url)("../../next.config.js");
    expect(nextConfig.images.localPatterns).toEqual([]);
    const images = { ...imageConfigDefault, ...nextConfig.images, localPatterns: [...nextConfig.images.localPatterns, { pathname: "/_next/static/media/**", search: "" }] };
    const validate = (url: string) => ImageOptimizerCache.validateParams({ headers: {} } as never, { url, w: "640", q: "75" }, { images } as never, false);
    for (const url of [
      ...paths,
      "/icons/..%2Fcurriculum-candidates/g7-native-v1/math-hero-numbers.svg",
      "/%2e%2e/curriculum-candidates/g7-native-v1/math-hero-numbers.svg",
      "https://example.test/curriculum-candidates/g7-native-v1/math-hero-numbers.svg",
      "/icons/icon-192.png",
    ]) {
      expect(validate(url), url).toEqual({ errorMessage: '"url" parameter is not allowed' });
    }
    expect(validate("/_next/static/media/imported.png")).not.toHaveProperty("errorMessage");
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
