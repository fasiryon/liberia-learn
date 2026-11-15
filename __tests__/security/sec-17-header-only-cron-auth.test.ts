import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
const m = vi.hoisted(() => ({ effects: [] as string[], builds: [] as any[], scheduledQueries: [] as any[], updates: [] as any[] }));
vi.mock("@/lib/db", () => ({ prisma: { class: { findMany: async () => { m.effects.push("classes"); return [{ id: "class-A", schoolId: "school-A" }]; } },
  scheduledWork: { findMany: async (args: any) => { m.effects.push("schedule-read"); m.scheduledQueries.push(args); return []; },
    update: async (args: any) => { m.effects.push("schedule-write"); m.updates.push(args); }, updateMany: async (args: any) => { m.effects.push("schedule-write"); m.updates.push(args); return { count: 1 }; } } } }));
vi.mock("@/lib/gamification/leaderboardService", () => ({ buildWeeklyLeaderboard: async (...args: any[]) => { m.effects.push("leaderboard"); m.builds.push(args); } }));
import { GET as rebuild } from "@/app/api/cron/rebuild-leaderboards/route";
import { GET as refresh } from "@/app/api/cron/refresh-demo-schedule/route";
let secret: string;
const request = (headers: Record<string, string> = {}, query = "") => new NextRequest("http://localhost/api/cron/synthetic?schoolId=school-B" + query, { headers });
const routes = [["leaderboards", rebuild], ["demo schedule", refresh]] as const;
beforeEach(() => { secret = randomUUID(); vi.stubEnv("CRON_SECRET", secret); m.effects = []; m.builds = []; m.scheduledQueries = []; m.updates = []; });
afterEach(() => vi.unstubAllEnvs());
for (const [name, handler] of routes) describe(name, () => {
  it("a correct URL query secret is not an authentication method", async () => {
    const res = await handler(request({}, "&secret=" + encodeURIComponent(secret))); expect(res.status).toBe(401); expect(m.effects).toEqual([]);
    expect(JSON.stringify(await res.json())).not.toContain(secret);
  });
  it("standard configured Bearer authentication retains the scheduled job", async () => {
    const res = await handler(request({ authorization: `Bearer ${secret}` })); expect(res.status).toBe(200); expect(m.effects.length).toBeGreaterThan(0);
    expect(JSON.stringify(await res.json())).not.toContain(secret);
  });
  it("the existing explicit x-cron-secret header still works", async () => {
    expect((await handler(request({ "x-cron-secret": secret }))).status).toBe(200); expect(m.effects.length).toBeGreaterThan(0);
  });
  it("missing credentials refuse before any tenant read or write", async () => { expect((await handler(request())).status).toBe(401); expect(m.effects).toEqual([]); });
  it("wrong credentials cannot be replaced by a role or school header", async () => {
    expect((await handler(request({ authorization: "Bearer wrong", "x-user-role": "ADMIN", "x-school-id": "school-B" }))).status).toBe(401); expect(m.effects).toEqual([]);
  });
  it("raw Authorization is not newly admitted", async () => { expect((await handler(request({ authorization: secret }))).status).toBe(401); expect(m.effects).toEqual([]); });
  it("conflicting invalid explicit header does not fall back to another credential", async () => {
    expect((await handler(request({ "x-cron-secret": "wrong", authorization: `Bearer ${secret}` }))).status).toBe(401); expect(m.effects).toEqual([]);
  });
  it.each([undefined, "", "   "])("missing or blank configuration refuses (%s)", async value => {
    vi.stubEnv("CRON_SECRET", value); expect((await handler(request({ "x-cron-secret": "" }))).status).toBe(401); expect(m.effects).toEqual([]);
  });
});
it("leaderboard job uses canonical SQL class/school pairs, not request scope", async () => {
  expect((await rebuild(request({ authorization: `Bearer ${secret}` }))).status).toBe(200); expect(m.builds).toEqual([["class-A", "school-A"]]);
});
it("demo refresh retains its fixed demo-class query and fixed multimedia target", async () => {
  expect((await refresh(request({ authorization: `Bearer ${secret}` }))).status).toBe(200);
  expect(m.scheduledQueries[0].where.classId.in).toContain("cha-class-grade9a"); expect(JSON.stringify(m.scheduledQueries[0])).not.toContain("school-B");
  expect(m.updates[0].where).toEqual({ id: "cha-demo-student1-multimedia-lesson" });
});
