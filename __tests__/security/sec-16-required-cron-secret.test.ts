import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
const m = vi.hoisted(() => ({ preview: false, effects: [] as string[], sms: [] as any[], logs: [] as any[], releaseError: false }));
vi.mock("@/lib/previewSideEffects", () => ({ previewAutomationDisabled: () => m.preview }));
vi.mock("@/lib/db", () => ({ prisma: { user: { findMany: async () => { m.effects.push("SQL:guardians"); return [{ id: "guardian-A", guardianOf: [{ studentId: "student-A" }] }]; } } } }));
vi.mock("@/lib/guardian/sms-service", () => ({ sendGuardianSMS: async (...args: any[]) => { m.effects.push("SMS"); m.sms.push(args); } }));
vi.mock("@/lib/notifications/guardianDigest", () => ({ mostRecentWeekWindow: () => ({ weekStart: new Date("2026-11-02T00:00:00Z"), weekEnd: new Date("2026-11-08T00:00:00Z") }),
  composeGuardianDigest: async () => { m.effects.push("digest"); return { schoolId: "school-A", primaryStudentId: "student-A", metrics: { actionTip: "Synthetic tip" }, studentFirstName: "Synthetic" }; } }));
vi.mock("@/lib/ai/staleGradeReleaser", () => ({ releaseStaleAIGrades: async () => { m.effects.push("release"); if (m.releaseError) throw Error("synthetic failure"); return { released: 2 }; } }));
vi.mock("@/lib/logger", () => ({ logger: { info: (...args: any[]) => m.logs.push(args), error: (...args: any[]) => m.logs.push(args) } }));
import { GET as digest } from "@/app/api/cron/guardian-weekly-digest/route";
import { GET as releaseGet, POST as releasePost } from "@/app/api/cron/release-stale-grades/route";
let secret: string;
const req = (method: string, headers: Record<string, string> = {}) => new NextRequest("http://localhost/api/cron/synthetic?schoolId=school-B", { method, headers });
const routes = [
  { name: "guardian digest GET", call: (headers: Record<string, string> = {}) => digest(req("GET", headers)), effect: "SMS" },
  { name: "stale grades POST", call: (headers: Record<string, string> = {}) => releasePost(req("POST", headers)), effect: "release" },
  { name: "stale grades GET alias", call: (headers: Record<string, string> = {}) => releaseGet(req("GET", headers)), effect: "release" },
];
beforeEach(() => { secret = randomUUID(); vi.stubEnv("CRON_SECRET", secret); m.preview = false; m.effects = []; m.sms = []; m.logs = []; m.releaseError = false; });
afterEach(() => vi.unstubAllEnvs());
for (const route of routes) describe(route.name, () => {
  it.each([undefined, "", "   "])("missing/blank configured secret never authorizes (%s)", async value => {
    vi.stubEnv("CRON_SECRET", value); expect((await route.call()).status).toBe(401); expect(m.effects).toEqual([]);
  });
  it("no credential denies before any school query, SMS or grade work", async () => {
    expect((await route.call()).status).toBe(401); expect(m.effects).toEqual([]);
  });
  it("wrong bearer denies even with a forged school or role header", async () => {
    expect((await route.call({ authorization: "Bearer wrong", "x-user-role": "ADMIN", "x-school-id": "school-B" })).status).toBe(401); expect(m.effects).toEqual([]);
  });
  it("a valid configured bearer retains the legitimate job", async () => {
    expect((await route.call({ authorization: `Bearer ${secret}` })).status).toBe(200); expect(m.effects).toContain(route.effect); expect(JSON.stringify(m.logs)).not.toContain(secret);
  });
  it("Preview refusal cannot be bypassed by a valid credential", async () => {
    m.preview = true; expect((await route.call({ authorization: `Bearer ${secret}` })).status).toBe(401); expect(m.effects).toEqual([]);
  });
});
it("release keeps its existing explicit x-cron-secret transport", async () => { expect((await releasePost(req("POST", { "x-cron-secret": secret }))).status).toBe(200); expect(m.effects).toEqual(["release"]); });
it("release keeps its existing raw Authorization transport", async () => { expect((await releasePost(req("POST", { authorization: secret }))).status).toBe(200); expect(m.effects).toEqual(["release"]); });
it("guardian job preserves canonical school and idempotent SMS request metadata", async () => {
  expect((await digest(req("GET", { authorization: `Bearer ${secret}` }))).status).toBe(200);
  expect(m.sms[0][0]).toMatchObject({ schoolId: "school-A", studentId: "student-A", guardianId: "guardian-A", idempotencyKey: "weekly-digest:guardian-A:2026-11-02" });
});
it("GET is exactly the same guarded stale-grade handler", () => { expect(releaseGet).toBe(releasePost); });
