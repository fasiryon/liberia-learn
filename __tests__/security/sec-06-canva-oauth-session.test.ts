import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
type Actor = { id: string; role: string; isPlatformAdmin: boolean; authTime: number; credStamp: number; privilegedSessionId?: string };
type State = { id: string; state: string; codeVerifier: string; expiresAt: Date };
const m = vi.hoisted(() => ({ actor: null as Actor | null, stepUp: true, states: new Map<string, State>(),
  save: vi.fn(), consume: vi.fn(), exchange: vi.fn(), read: vi.fn(), claim: vi.fn() }));
const platform = (): Actor => ({ id: "platform-1", role: "ADMIN", isPlatformAdmin: true, authTime: 1_800_000_000_000, credStamp: 0 });
vi.mock("@/lib/auth", () => ({
  requirePlatformAdmin: async () => {
    if (!m.actor) throw Object.assign(new Error("Unauthorized"), { status: 401 });
    if (!m.actor.isPlatformAdmin) throw Object.assign(new Error("Forbidden"), { status: 403 }); return m.actor;
  },
  requireRole: async (role: string) => {
    if (!m.actor) throw Object.assign(new Error("Unauthorized"), { status: 401 });
    if (m.actor.role !== role) throw Object.assign(new Error("Forbidden"), { status: 403 }); return m.actor;
  },
  requirePrivilegedStepUp: async () => {
    if (!m.stepUp) throw Object.assign(new Error("Step-up required"), { status: 403 }); return m.actor;
  },
}));
vi.mock("@/lib/db", () => ({ prisma: { canvaOAuthState: { findUnique: m.read, deleteMany: m.claim } } }));
vi.mock("@/lib/canva/canvaOAuth", () => ({
  CANVA_OAUTH_COOKIE_NAMES: { verifier: "canva_oauth_code_verifier", state: "canva_oauth_state" },
  getCanvaOAuthConfig: () => ({ clientId: "synthetic-client", redirectUri: "http://localhost/api/canva/callback" }),
  hasCanvaOAuthClientConfig: () => true,
  createCanvaPkcePair: () => ({ state: "state-1", codeVerifier: "synthetic-verifier", codeChallenge: "synthetic-challenge" }),
  buildCanvaAuthorizationUrl: () => new URL("https://provider.synthetic.invalid/authorize?state=state-1"),
  saveCanvaOAuthState: m.save, consumeCanvaOAuthState: m.consume, exchangeCanvaAuthorizationCode: m.exchange,
}));
import { GET as publicStart } from "@/app/api/canva/auth/route";
import { GET as publicCallback } from "@/app/api/canva/callback/route";
import { GET as adminStart } from "@/app/api/admin/canva/auth-url/route";
import { GET as adminCallback } from "@/app/api/admin/canva/callback/route";
const callbackRequest = () => new NextRequest("http://localhost/api/canva/callback?code=synthetic-code&state=state-1");
beforeEach(() => {
  vi.clearAllMocks(); m.actor = platform(); m.stepUp = true; m.states.clear();
  m.save.mockImplementation(async ({ state, codeVerifier }: { state: string; codeVerifier: string }) => {
    m.states.set(state, { id: "row-1", state, codeVerifier, expiresAt: new Date(Date.now() + 60_000) });
  });
  m.read.mockImplementation(async ({ where }: { where: { state: string } }) => {
    const row = m.states.get(where.state); return row ? { ...row } : null;
  });
  m.claim.mockImplementation(async ({ where }: { where: { state: string; id: string; codeVerifier: string; expiresAt: { gt: Date } } }) => {
    const row = m.states.get(where.state);
    if (!row || row.id !== where.id || row.codeVerifier !== where.codeVerifier || row.expiresAt <= where.expiresAt.gt) return { count: 0 };
    m.states.delete(where.state); return { count: 1 };
  });
  m.consume.mockImplementation(async ({ state }: { state: string }) => {
    const row = m.states.get(state); if (!row) throw Object.assign(new Error("State missing"), { status: 400 });
    m.states.delete(state); if (row.expiresAt <= new Date()) throw Object.assign(new Error("Expired state"), { status: 400 });
    return row.codeVerifier;
  });
  m.exchange.mockResolvedValue({ scope: "profile:read", token_type: "bearer", expires_in: 3600 });
});
const endpoints = [
  { name: "public start", call: () => publicStart() }, { name: "public callback", call: () => publicCallback(callbackRequest()) },
  { name: "admin start", call: () => adminStart() }, { name: "admin callback", call: () => adminCallback(callbackRequest()) },
];
describe("SEC-06 platform-only, session-bound OAuth lifecycle", () => {
  for (const endpoint of endpoints) {
    it.each(["ANONYMOUS", "STUDENT", "TEACHER", "GUARDIAN", "ADMIN"])(`${endpoint.name} refuses %s before OAuth work`, async role => {
      m.actor = role === "ANONYMOUS" ? null : { ...platform(), role, isPlatformAdmin: false };
      m.states.set("state-1", { id: "row-1", state: "state-1", codeVerifier: "synthetic-verifier", expiresAt: new Date(Date.now() + 60_000) });
      const response = await endpoint.call();
      expect(response.status).toBe(role === "ANONYMOUS" ? 401 : 403);
      expect(m.save).not.toHaveBeenCalled(); expect(m.consume).not.toHaveBeenCalled();
      expect(m.read).not.toHaveBeenCalled(); expect(m.exchange).not.toHaveBeenCalled();
    });
    it(`${endpoint.name} requires current step-up`, async () => {
      m.stepUp = false; expect((await endpoint.call()).status).toBe(403);
      expect(m.save).not.toHaveBeenCalled(); expect(m.exchange).not.toHaveBeenCalled();
    });
  }
  it("preserves a legitimate platform PKCE flow without exposing provider tokens", async () => {
    expect((await publicStart()).status).toBe(302);
    const response = await publicCallback(callbackRequest()); expect(response.status).toBe(200);
    expect(m.exchange).toHaveBeenCalledWith({ code: "synthetic-code", codeVerifier: "synthetic-verifier" });
    expect(m.states.size).toBe(0);
  });
  it("admin initialization can use the configured public callback", async () => {
    expect((await adminStart()).status).toBe(200);
    expect((await publicCallback(callbackRequest())).status).toBe(200);
    expect(m.exchange).toHaveBeenCalledTimes(1);
  });
  it("public initialization can use the admin callback without losing its session binding", async () => {
    await publicStart(); const response = await adminCallback(callbackRequest());
    expect(response.status).toBe(307); expect(response.headers.get("location")).toContain("connected=true");
    expect(m.exchange).toHaveBeenCalledTimes(1);
  });
  it.each(["authTime", "credStamp"] as const)("refuses unreadable session %s before saving state", async field => {
    m.actor = { ...platform(), [field]: Number.NaN }; expect((await publicStart()).status).toBe(403);
    expect(m.save).not.toHaveBeenCalled();
  });
  it("refuses a different privileged session", async () => {
    await publicStart(); m.actor = { ...platform(), privilegedSessionId: "different-mfa-session" };
    expect((await publicCallback(callbackRequest())).status).toBe(400);
    expect(m.states.size).toBe(1); expect(m.exchange).not.toHaveBeenCalled();
  });
  it.each(["id", "authTime", "credStamp"] as const)("refuses another session's %s without consuming its state", async field => {
    await publicStart(); const actor = platform();
    m.actor = field === "id" ? { ...actor, id: "platform-2" } : { ...actor, [field]: actor[field] + 1 };
    expect((await publicCallback(callbackRequest())).status).toBe(400);
    expect(m.states.size).toBe(1); expect(m.exchange).not.toHaveBeenCalled();
  });
  it("refuses callback replay before a second exchange", async () => {
    await publicStart(); expect((await publicCallback(callbackRequest())).status).toBe(200);
    expect((await publicCallback(callbackRequest())).status).toBe(400); expect(m.exchange).toHaveBeenCalledTimes(1);
  });
  it("allows exactly one concurrent claim", async () => {
    await publicStart(); const results = await Promise.all([publicCallback(callbackRequest()), publicCallback(callbackRequest())]);
    expect(results.map(r => r.status).sort()).toEqual([200, 400]); expect(m.exchange).toHaveBeenCalledTimes(1);
  });
  it("does not return a provider exception containing a planted secret", async () => {
    await publicStart(); m.exchange.mockRejectedValue(new Error("synthetic-secret-must-not-escape"));
    const response = await publicCallback(callbackRequest()); expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("synthetic-secret-must-not-escape");
  });
});
