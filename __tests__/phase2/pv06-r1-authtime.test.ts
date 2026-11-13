/**
 * Phase 2 (integration/g4-day) interaction: PV-06 Preview session policy × R1 session revocation.
 *
 * R1 (main): `authTime` is taken in authorizeCredentials BEFORE the credential read and carried on the user; the jwt
 * sign-in branch copies it and it never changes. PV-06 (V3): the 8 h Preview bound is anchored at sign-in (authTime).
 * The automatic merge kept V3's later `token.authTime = Date.now()` in the same branch, which silently overwrote R1's
 * anchor. Both sides mean "the sign-in time"; the merged code must keep the time R1 took, on Preview and elsewhere.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ findFirst: vi.fn(), findUnique: vi.fn(), cache: vi.fn(), session: vi.fn() }));
vi.mock("next-auth", () => ({ getServerSession: m.session }));
vi.mock("@/lib/db", () => ({ prisma: { user: { findFirst: m.findFirst, findUnique: m.findUnique } } }));
vi.mock("@/lib/cache/redisCache", () => ({ withRedisCache: m.cache }));

const NOW = Date.parse("2026-11-06T12:00:00Z");
const PRE_READ = NOW - 5_000; // authTime taken in authorizeCredentials before the credential read
const signedIn = { id: "synthetic-student", role: "STUDENT", schoolId: "synthetic-school", isPlatformAdmin: false, authTime: PRE_READ, credStamp: 0 };

async function auth(env: Record<string, string | undefined>) {
  vi.unstubAllEnvs();
  vi.stubEnv("VERCEL_ENV", undefined as unknown as string);
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v as string);
  vi.resetModules();
  return import("@/lib/auth");
}
const signIn = async (mod: typeof import("@/lib/auth")) =>
  (await mod.authOptions.callbacks!.jwt!({ token: {}, user: signedIn, account: { provider: "credentials" } } as never)) as Record<string, unknown>;

beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers(); vi.setSystemTime(NOW); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

describe("authTime anchor: one value for R1 lifetime and the PV-06 Preview bound", () => {
  it.each([["deployed Preview", { VERCEL_ENV: "preview" }], ["Production", { VERCEL_ENV: "production" }], ["local", {}]])(
    "%s: sign-in keeps the authTime taken before the credential read (never re-stamped)", async (_l, env) => {
      const token = await signIn(await auth(env));
      expect(token.authTime).toBe(PRE_READ);
      expect(token.credStamp).toBe(0);
    });

  it("Preview: the 8 h bound counts from that same anchor", async () => {
    const mod = await auth({ VERCEL_ENV: "preview" });
    const token = await signIn(mod);
    vi.setSystemTime(PRE_READ + 8 * 3600_000 - 1);
    const live = await mod.authOptions.callbacks!.session!({ session: { user: {}, expires: "2099-01-01T00:00:00.000Z" }, token } as never) as { user?: unknown };
    expect(live.user).toBeDefined();
    vi.setSystemTime(PRE_READ + 8 * 3600_000);
    const ended = await mod.authOptions.callbacks!.session!({ session: { user: {}, expires: "2099-01-01T00:00:00.000Z" }, token } as never) as { user?: unknown };
    expect(ended.user).toBeUndefined();
  });
});
