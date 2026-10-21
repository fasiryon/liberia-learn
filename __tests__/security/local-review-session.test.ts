import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { decode } from "next-auth/jwt";
import { assertLocalReview, createLocalReviewerToken } from "@/scripts/labs/reviewer-session.cjs";
import { assertReviewFixtureDatabase } from "@/scripts/labs/prepare-review-consent.cjs";
const env: NodeJS.ProcessEnv = { NODE_ENV: "development", LAB_REVIEW_HARNESS: "1", NEXTAUTH_SECRET: "synthetic-test-only", NEXTAUTH_URL: "http://127.0.0.1:3000" };
const unsafeEnvironments: Partial<NodeJS.ProcessEnv>[] = [{ NODE_ENV: "production" }, { VERCEL: "1" }, { LAB_REVIEW_HARNESS: "0" }, { NEXTAUTH_SECRET: "" }];
describe("authenticated local lab review tools", () => {
  beforeEach(() => { vi.stubEnv("NODE_ENV", "test"); vi.stubEnv("LAB_REVIEW_HARNESS", "1"); vi.stubEnv("VERCEL", ""); });
  afterEach(() => vi.unstubAllEnvs());
  it("creates a real NextAuth-verifiable synthetic national reviewer session", async () => {
    const signed = await createLocalReviewerToken(env.NEXTAUTH_URL, env);
    expect(await decode({ token: signed, secret: env.NEXTAUTH_SECRET })).toMatchObject({ id: "synthetic-MOE_OFFICIAL", role: "MOE_OFFICIAL", isPlatformAdmin: false });
    expect(await decode({ token: signed, secret: "wrong-secret" }).catch(() => null)).toBeNull();
  });
  it.each(["https://example.invalid", "http://127.0.0.1:3000/path", "http://user:password@127.0.0.1:3000", "http://localhost:3001"])("refuses signing for unsafe or mismatched origin %s", url => {
    expect(() => assertLocalReview(url, env)).toThrow();
  });
  it.each(unsafeEnvironments)("requires explicit nonhosted local review configuration %j", override => {
    expect(() => assertLocalReview(env.NEXTAUTH_URL, { ...env, ...override })).toThrow();
  });
  it("allows fixture bootstrap only for the reserved loopback database", () => {
    expect(assertReviewFixtureDatabase("postgresql://synthetic:synthetic@127.0.0.1:5432/lab_review_fixture").pathname).toBe("/lab_review_fixture");
    expect(() => assertReviewFixtureDatabase("postgresql://synthetic:synthetic@db.example.invalid:5432/lab_review_fixture")).toThrow();
    expect(() => assertReviewFixtureDatabase("postgresql://synthetic:synthetic@127.0.0.1:5432/production")).toThrow();
    vi.stubEnv("NODE_ENV", "production");
    expect(() => assertReviewFixtureDatabase("postgresql://synthetic:synthetic@127.0.0.1:5432/lab_review_fixture")).toThrow();
  });
});
