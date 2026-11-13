/** Real PostgreSQL cron reads and demo schedule writes; no provider adapters. */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
let admitted = false;
try {
  const url = new URL(process.env.DATABASE_URL ?? "");
  admitted = process.env.LL_SEC_17_DB_TEST === "1" && url.hostname === "127.0.0.1" && url.port === "55432" &&
    /^\/sec17_t2_\d+$/.test(url.pathname) && url.searchParams.get("connection_limit") === "1";
} catch { /* No external database. */ }
if (process.env.LL_SEC_17_DB_TEST === "1" && !admitted) throw Error("SEC-17 requires its own IPv4 loopback database");
describe.skipIf(!admitted)("SEC-17 native header-only cron authority", () => {
  let db: PrismaClient;
  let rebuild: typeof import("@/app/api/cron/rebuild-leaderboards/route").GET;
  let refresh: typeof import("@/app/api/cron/refresh-demo-schedule/route").GET;
  let secret: string;
  const originalDate = new Date("2020-01-06T00:00:00.000Z");
  beforeAll(async () => {
    vi.stubGlobal("fetch", () => { throw Error("External calls forbidden"); });
    ({ prisma: db } = await import("@/lib/db"));
    ({ GET: rebuild } = await import("@/app/api/cron/rebuild-leaderboards/route"));
    ({ GET: refresh } = await import("@/app/api/cron/refresh-demo-schedule/route"));
    await db.curriculumContent.create({ data: { contentId: "synthetic-content", grade: 4, subject: "MATH", contentType: "lesson", status: "published", version: "synthetic-1", payload: {} } });
    for (const [suffix, classId] of [["A", "class_mca_7a"], ["B", "class_pcs_9a"], ["C", "ordinary-class"]]) {
      await db.school.create({ data: { id: `school-${suffix}`, name: `Synthetic ${suffix}` } });
      await db.class.create({ data: { id: classId, schoolId: `school-${suffix}`, name: "Synthetic", subject: "MATH" } });
      await db.scheduledWork.create({ data: { id: `work-${suffix}`, classId, contentId: "synthetic-content", scheduledDate: originalDate, createdById: "synthetic-cron" } });
    }
  });
  beforeEach(async () => { secret = randomUUID(); vi.stubEnv("CRON_SECRET", secret); await db.scheduledWork.updateMany({ data: { scheduledDate: originalDate } }); });
  afterAll(async () => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); await db?.$disconnect(); });
  const req = (headers: Record<string, string> = {}, query = "") => new NextRequest("http://localhost/api/cron/synthetic?schoolId=school-C" + query, { headers });
  const untouched = async () => {
    for (const row of await db.scheduledWork.findMany()) expect(row.scheduledDate).toEqual(originalDate);
  };
  for (const name of ["rebuild", "refresh"]) {
    const handler = () => name === "rebuild" ? rebuild : refresh;
    it(`${name}: URL secrets do not authorize persisted work`, async () => {
      expect((await handler()(req({}, "&secret=" + secret))).status).toBe(401); await untouched();
    });
    it(`${name}: missing configuration refuses before SQL work`, async () => {
      vi.stubEnv("CRON_SECRET", ""); expect((await handler()(req({ "x-cron-secret": "" }))).status).toBe(401); await untouched();
    });
    it(`${name}: conflicting explicit credential is not overridden by Bearer`, async () => {
      expect((await handler()(req({ "x-cron-secret": "wrong", authorization: `Bearer ${secret}` }))).status).toBe(401); await untouched();
    });
  }
  it("valid Bearer refresh persists demo updates without changing an ordinary school's schedule", async () => {
    expect((await refresh(req({ authorization: `Bearer ${secret}` }))).status).toBe(200);
    for (const id of ["work-A", "work-B"]) expect((await db.scheduledWork.findUniqueOrThrow({ where: { id } })).scheduledDate.getTime()).toBeGreaterThan(originalDate.getTime());
    expect((await db.scheduledWork.findUniqueOrThrow({ where: { id: "work-C" } })).scheduledDate).toEqual(originalDate);
  });
  it("existing explicit header still performs the actual demo write", async () => {
    expect((await refresh(req({ "x-cron-secret": secret }))).status).toBe(200);
    expect((await db.scheduledWork.findUniqueOrThrow({ where: { id: "work-A" } })).scheduledDate.getTime()).toBeGreaterThan(originalDate.getTime());
  });
  it("valid Bearer rebuild retains the actual empty-roster query contract", async () => {
    const res = await rebuild(req({ authorization: `Bearer ${secret}` })); expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, total: 0, built: 0, failed: 0 }); await untouched();
  });
});
