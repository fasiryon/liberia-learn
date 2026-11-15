import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
const h = vi.hoisted(() => ({ stored: null as any, writes: 0 }));
vi.mock("@/lib/db", () => ({ prisma: { canvaOAuthCredential: {
  upsert: async ({ create, update }: any) => { h.writes++; h.stored = h.stored ? { ...h.stored, ...update } : create; },
  findUnique: async () => h.stored,
} } }));
import { loadCanvaOAuthTokens, persistCanvaOAuthTokens } from "@/lib/canva/canvaOAuth";
let explicit: string;
let accessToken: string;
beforeEach(() => { explicit = randomUUID(); accessToken = randomUUID(); h.stored = null; h.writes = 0;
  vi.stubEnv("NEXTAUTH_SECRET", explicit); vi.stubEnv("JWT_SECRET", randomUUID()); });
afterEach(() => vi.unstubAllEnvs());
it.each([undefined, "", "   "])("JWT_SECRET alone cannot select a credential encryption key (%s)", async missing => {
  vi.stubEnv("NEXTAUTH_SECRET", missing);
  await expect(persistCanvaOAuthTokens({ access_token: accessToken })).rejects.toMatchObject({ status: 503, code: "CANVA_TOKEN_SECRET_MISSING" });
  expect(h.writes).toBe(0); expect(h.stored).toBeNull();
});
it("explicit NEXTAUTH_SECRET preserves actual authenticated encryption round-trip", async () => {
  await persistCanvaOAuthTokens({ access_token: accessToken, expires_in: 3600 });
  expect(h.stored.encryptedTokenSet).not.toContain(accessToken); expect(await loadCanvaOAuthTokens()).toMatchObject({ access_token: accessToken });
});
it("changing an unrelated JWT_SECRET cannot change the explicit encryption key", async () => {
  await persistCanvaOAuthTokens({ access_token: accessToken }); vi.stubEnv("JWT_SECRET", randomUUID());
  expect(await loadCanvaOAuthTokens()).toMatchObject({ access_token: accessToken });
});
it("removing the explicit key cannot decrypt through an identically valued fallback", async () => {
  await persistCanvaOAuthTokens({ access_token: accessToken }); const stored = h.stored.encryptedTokenSet;
  vi.stubEnv("JWT_SECRET", explicit); vi.stubEnv("NEXTAUTH_SECRET", undefined);
  await expect(loadCanvaOAuthTokens()).rejects.toMatchObject({ status: 503, code: "CANVA_TOKEN_SECRET_MISSING" });
  expect(h.stored.encryptedTokenSet).toBe(stored); expect(h.writes).toBe(1);
});
it("a different explicit key refuses decryption without changing storage", async () => {
  await persistCanvaOAuthTokens({ access_token: accessToken }); const stored = h.stored.encryptedTokenSet;
  vi.stubEnv("NEXTAUTH_SECRET", randomUUID()); await expect(loadCanvaOAuthTokens()).rejects.toThrow();
  expect(h.stored.encryptedTokenSet).toBe(stored); expect(h.writes).toBe(1);
});
it("no configured key refuses without leaking diagnostic values", async () => {
  vi.stubEnv("NEXTAUTH_SECRET", undefined); vi.stubEnv("JWT_SECRET", undefined);
  const error = await persistCanvaOAuthTokens({ access_token: accessToken }).catch(err => err);
  expect(error).toMatchObject({ status: 503 }); expect(error.message).not.toContain(accessToken); expect(h.writes).toBe(0);
});
it("the cited Auth0 claim parser has no secret fallback and stays byte-identical", () => {
  const path = "lib/auth/auth0Claims.ts";
  expect(readFileSync(path)).toEqual(execFileSync("git", ["show", "4662b14ac47e561ec628ec327499fd1a87eef5ef:" + path]));
  expect(readFileSync(path, "utf8")).not.toMatch(/JWT_SECRET|NEXTAUTH_SECRET/);
});
