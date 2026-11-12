import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { decode } from "next-auth/jwt";
import { assertLocalReview, createLocalReviewerToken } from "@/scripts/labs/reviewer-session.cjs";
import { FIXTURE_GRANTS, SYNTHETIC_REVIEWER_ROW, assertReviewFixtureDatabase, prepareReviewFixture } from "@/scripts/labs/prepare-review-consent.cjs";
import { claimsShapeFailure } from "@/lib/auth/sessionClaims";
import { assertTokenFresh } from "@/lib/auth/sessionRevocation";
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

  // Session-security contract (U1/R1): the harness passes through the REAL edge and freshness checks; no bypass.
  it("mints the current session contract: the edge claim check admits it", async () => {
    const claims = await decode({ token: await createLocalReviewerToken(env.NEXTAUTH_URL, env), secret: env.NEXTAUTH_SECRET! });
    expect(claims).toMatchObject({ id: SYNTHETIC_REVIEWER_ROW.id, role: SYNTHETIC_REVIEWER_ROW.role, schoolId: null, credStamp: 0 });
    expect(claimsShapeFailure(claims as never)).toBeNull();
  });
  it("is fresh only against the seeded fixture row: a credential change or a role change is still revoked", async () => {
    const claims = await decode({ token: await createLocalReviewerToken(env.NEXTAUTH_URL, env), secret: env.NEXTAUTH_SECRET! }) as never;
    const db = (row: unknown) => ({ user: { findFirst: async () => row } });
    const seeded = { ...SYNTHETIC_REVIEWER_ROW, school: null };
    await expect(assertTokenFresh(claims, db(seeded))).resolves.toBeUndefined();
    await expect(assertTokenFresh(claims, db(null))).rejects.toMatchObject({ code: "SESSION_ACCOUNT_MISSING" });
    await expect(assertTokenFresh(claims, db({ ...seeded, passwordChangedAt: new Date("2026-11-11T00:00:00Z") }))).rejects.toMatchObject({ code: "SESSION_CREDENTIAL_CHANGED" });
    await expect(assertTokenFresh(claims, db({ ...seeded, role: "TEACHER" }))).rejects.toMatchObject({ code: "SESSION_ACCOUNT_CHANGED" });
  });
  it("L-CRED-1: the privileged synthetic row is seeded only into the loopback /lab_review_fixture database", async () => {
    const appUrl = "postgresql://lab_review_reader:x@127.0.0.1:5432/lab_review_fixture";
    for (const adminUrl of ["postgresql://postgres:x@db.example.invalid:5432/lab_review_fixture", "postgresql://postgres:x@127.0.0.1:5432/production",
      "postgresql://postgres:x@127.0.0.1:5432/lab_review_fixture_copy"]) {
      await expect(prepareReviewFixture({ ...process.env, REVIEW_FIXTURE_ADMIN_URL: adminUrl, DATABASE_URL: appUrl })).rejects.toThrow(/Only the isolated local lab_review_fixture database is permitted/);
    }
    await expect(prepareReviewFixture({ ...process.env, REVIEW_FIXTURE_ADMIN_URL: "postgresql://postgres:x@127.0.0.1:5432/lab_review_fixture",
      DATABASE_URL: "postgresql://postgres:x@127.0.0.1:5432/lab_review_fixture" })).rejects.toThrow(/lab_review_reader/);
  });
  it("keeps the application connection SELECT-only: every grant is CONNECT, USAGE or SELECT, and the role defaults to read-only", () => {
    expect(FIXTURE_GRANTS.length).toBeGreaterThan(0);
    for (const statement of FIXTURE_GRANTS) {
      expect(statement).toMatch(/^(GRANT (CONNECT|USAGE|SELECT) |ALTER ROLE lab_review_reader SET default_transaction_read_only = on$)/);
      expect(statement).not.toMatch(/INSERT|UPDATE|DELETE|TRUNCATE|ALL PRIVILEGES|CREATE/i);
    }
    expect(FIXTURE_GRANTS).toContain("ALTER ROLE lab_review_reader SET default_transaction_read_only = on");
  });
});
