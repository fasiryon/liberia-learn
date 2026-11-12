/** CoS: LL_SEC_06_DB_TEST=1, db_setup=push, disposable loopback PostgreSQL,
 * connection_limit=1. Real state persistence and conditional claims; no provider
 * calls, credentials, real user records or mocked database/transactions.
 */
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import type { SessionUser } from "@/lib/auth";
vi.mock("@/lib/auth", () => ({ requirePlatformAdmin: vi.fn(), requirePrivilegedStepUp: vi.fn() }));
let admitted = false;
try {
  const url = new URL(process.env.DATABASE_URL ?? "");
  admitted = process.env.LL_SEC_06_DB_TEST === "1" && ["postgres:", "postgresql:"].includes(url.protocol) &&
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) && /^\/(?:e2e|test|sec06)(?:[_-][a-z0-9_-]+)?$/i.test(url.pathname) &&
    url.searchParams.get("connection_limit") === "1";
} catch { /* Not an admitted disposable target. */ }
if (process.env.LL_SEC_06_DB_TEST === "1" && !admitted) throw new Error("SEC-06 requires disposable loopback PostgreSQL with connection_limit=1");
describe.skipIf(!admitted)("SEC-06 native session-bound OAuth state", () => {
  let db: PrismaClient;
  let save: typeof import("@/lib/canva/oauthSession").saveBoundCanvaOAuthState;
  let consume: typeof import("@/lib/canva/oauthSession").consumeBoundCanvaOAuthState;
  const prefix = `sec06-${Date.now().toString(36)}`;
  const session = { id: `${prefix}-platform`, role: "ADMIN", isPlatformAdmin: true,
    authTime: Date.now(), credStamp: 0, privilegedSessionId: "synthetic-mfa-session" } satisfies SessionUser;
  let sequence = 0;
  beforeAll(async () => {
    ({ prisma: db } = await import("@/lib/db"));
    const module = await import("@/lib/canva/oauthSession"); save = module.saveBoundCanvaOAuthState; consume = module.consumeBoundCanvaOAuthState;
  });
  async function fixture() {
    const state = `${prefix}-${++sequence}`;
    await save({ state, codeVerifier: "synthetic-pkce-verifier", session }); return state;
  }
  it("returns the verifier only once for the initiating session", async () => {
    const state = await fixture(); expect(await consume({ state, session })).toBe("synthetic-pkce-verifier");
    expect(await db.canvaOAuthState.findUnique({ where: { state } })).toBeNull();
    await expect(consume({ state, session })).rejects.toMatchObject({ status: 400 });
  });
  it("refuses a different platform account without consuming state", async () => {
    const state = await fixture(); await expect(consume({ state, session: { ...session, id: `${prefix}-other` } })).rejects.toMatchObject({ status: 400 });
    expect(await db.canvaOAuthState.count({ where: { state } })).toBe(1);
  });
  it("refuses a different login of the same account", async () => {
    const state = await fixture(); await expect(consume({ state, session: { ...session, authTime: session.authTime + 1 } })).rejects.toMatchObject({ status: 400 });
    expect(await db.canvaOAuthState.count({ where: { state } })).toBe(1);
  });
  it("refuses a changed credential version", async () => {
    const state = await fixture(); await expect(consume({ state, session: { ...session, credStamp: 1 } })).rejects.toMatchObject({ status: 400 });
    expect(await db.canvaOAuthState.count({ where: { state } })).toBe(1);
  });
  it("refuses a different privileged session", async () => {
    const state = await fixture(); await expect(consume({ state, session: { ...session, privilegedSessionId: "other-mfa-session" } })).rejects.toMatchObject({ status: 400 });
    expect(await db.canvaOAuthState.count({ where: { state } })).toBe(1);
  });
  it("does not accept old unbound pending state", async () => {
    const state = `${prefix}-legacy`;
    await db.canvaOAuthState.create({ data: { state, codeVerifier: "synthetic-unbound", expiresAt: new Date(Date.now() + 60_000) } });
    await expect(consume({ state, session })).rejects.toMatchObject({ status: 400 });
  });
  it("does not accept expired state", async () => {
    const state = await fixture(); await db.canvaOAuthState.update({ where: { state }, data: { expiresAt: new Date(Date.now() - 1) } });
    await expect(consume({ state, session })).rejects.toMatchObject({ status: 400 });
  });
  it("conditional concurrent claims have one winner at pool 1", async () => {
    const state = await fixture(); const results = await Promise.allSettled([consume({ state, session }), consume({ state, session })]);
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter(r => r.status === "rejected")).toHaveLength(1);
    expect(await db.canvaOAuthState.count({ where: { state } })).toBe(0);
  });
});
