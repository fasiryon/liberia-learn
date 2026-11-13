/** Real authenticated encryption and PostgreSQL credential persistence.
 * This global credential store has no tenant parameter; its unchanged callers
 * retain the separately accepted platform-administrator boundary (SEC-07).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
let admitted = false;
try {
  const url = new URL(process.env.DATABASE_URL ?? "");
  admitted = process.env.LL_SEC_21_DB_TEST === "1" && url.hostname === "127.0.0.1" && url.port === "55432" &&
    /^\/sec21_t2_\d+$/.test(url.pathname) && url.searchParams.get("connection_limit") === "1";
} catch { /* No external database. */ }
if (process.env.LL_SEC_21_DB_TEST === "1" && !admitted) throw Error("SEC-21 requires its own IPv4 loopback database");
describe.skipIf(!admitted)("SEC-21 native explicit encryption key", () => {
  let db: PrismaClient;
  let oauth: typeof import("@/lib/canva/canvaOAuth");
  let explicit: string;
  let accessToken: string;
  beforeAll(async () => {
    vi.stubGlobal("fetch", () => { throw Error("No external calls allowed"); });
    ({ prisma: db } = await import("@/lib/db")); oauth = await import("@/lib/canva/canvaOAuth");
  });
  beforeEach(async () => {
    explicit = randomUUID(); accessToken = randomUUID();
    vi.stubEnv("NEXTAUTH_SECRET", explicit); vi.stubEnv("JWT_SECRET", randomUUID());
    await db.canvaOAuthCredential.deleteMany();
  });
  afterAll(async () => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); await db?.$disconnect(); });
  const envelope = async () => (await db.canvaOAuthCredential.findUniqueOrThrow({ where: { provider: "canva" } })).encryptedTokenSet;
  it("JWT-only configuration cannot create a persisted credential", async () => {
    vi.stubEnv("NEXTAUTH_SECRET", undefined);
    await expect(oauth.persistCanvaOAuthTokens({ access_token: accessToken })).rejects.toMatchObject({ status: 503, code: "CANVA_TOKEN_SECRET_MISSING" });
    expect(await db.canvaOAuthCredential.count()).toBe(0);
  });
  it("explicit key encrypts the database value and decrypts it correctly", async () => {
    await oauth.persistCanvaOAuthTokens({ access_token: accessToken, expires_in: 3600 });
    expect(await envelope()).not.toContain(accessToken);
    expect(await oauth.loadCanvaOAuthTokens()).toMatchObject({ access_token: accessToken });
  });
  it("unrelated JWT key changes do not affect the persisted explicit-key envelope", async () => {
    await oauth.persistCanvaOAuthTokens({ access_token: accessToken }); const before = await envelope();
    vi.stubEnv("JWT_SECRET", randomUUID()); expect(await oauth.loadCanvaOAuthTokens()).toMatchObject({ access_token: accessToken });
    expect(await envelope()).toBe(before);
  });
  it("removing the explicit key refuses read despite a matching fallback and preserves storage", async () => {
    await oauth.persistCanvaOAuthTokens({ access_token: accessToken }); const before = await envelope();
    vi.stubEnv("JWT_SECRET", explicit); vi.stubEnv("NEXTAUTH_SECRET", undefined);
    await expect(oauth.loadCanvaOAuthTokens()).rejects.toMatchObject({ status: 503, code: "CANVA_TOKEN_SECRET_MISSING" });
    expect(await envelope()).toBe(before);
  });
  it("wrong explicit key cannot decrypt or mutate the persisted envelope", async () => {
    await oauth.persistCanvaOAuthTokens({ access_token: accessToken }); const before = await envelope();
    vi.stubEnv("NEXTAUTH_SECRET", randomUUID()); await expect(oauth.loadCanvaOAuthTokens()).rejects.toThrow();
    expect(await envelope()).toBe(before);
  });
  it("blank explicit key cannot overwrite a credential through the JWT fallback", async () => {
    await oauth.persistCanvaOAuthTokens({ access_token: accessToken }); const before = await envelope();
    vi.stubEnv("NEXTAUTH_SECRET", "   "); vi.stubEnv("JWT_SECRET", explicit);
    await expect(oauth.persistCanvaOAuthTokens({ access_token: randomUUID() })).rejects.toMatchObject({ status: 503 });
    expect(await envelope()).toBe(before); expect(await db.canvaOAuthCredential.count()).toBe(1);
  });
});
