/** PostgreSQL-backed cron authorization with real provisional-feedback writes.
 * External push/SMS transports are forbidden; SQL and grading service are real.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
vi.mock("@/lib/push/sendPush", () => ({ sendPushToUser: async () => undefined }));
vi.mock("@/lib/guardian/sms-service", () => ({ sendGuardianSMS: () => { throw Error("No SMS transport allowed in native acceptance"); } }));
let admitted = false;
try {
  const url = new URL(process.env.DATABASE_URL ?? "");
  admitted = process.env.LL_SEC_16_DB_TEST === "1" && url.hostname === "127.0.0.1" && url.port === "55432" &&
    /^\/sec16_t2_\d+$/.test(url.pathname) && url.searchParams.get("connection_limit") === "1";
} catch { /* No external database. */ }
if (process.env.LL_SEC_16_DB_TEST === "1" && !admitted) throw Error("SEC-16 requires its own IPv4 loopback database");
describe.skipIf(!admitted)("SEC-16 native required-secret boundary", () => {
  let db: PrismaClient;
  let release: typeof import("@/app/api/cron/release-stale-grades/route");
  let digest: typeof import("@/app/api/cron/guardian-weekly-digest/route");
  let secret: string;
  beforeAll(async () => {
    ({ prisma: db } = await import("@/lib/db"));
    release = await import("@/app/api/cron/release-stale-grades/route");
    digest = await import("@/app/api/cron/guardian-weekly-digest/route");
    for (const school of ["A", "B"]) {
      await db.school.create({ data: { id: `school-${school}`, name: `Synthetic ${school}` } });
      await db.user.create({ data: { id: `user-${school}`, email: `student-${school}@example.invalid`, role: "STUDENT", schoolId: `school-${school}` } });
      await db.student.create({ data: { id: `student-${school}`, userId: `user-${school}` } });
      await db.class.create({ data: { id: `class-${school}`, name: "Synthetic", subject: "MATH", schoolId: `school-${school}` } });
      await db.assignment.create({ data: { id: `assignment-${school}`, classId: `class-${school}`, title: "Synthetic" } });
      await db.assignmentSubmission.create({ data: { id: `submission-${school}`, assignmentId: `assignment-${school}`, studentId: `student-${school}`, aiGrade: 75,
        aiFeedback: "Synthetic provisional feedback", aiGradedAt: new Date(Date.now() - 96 * 3600000) } });
    }
  });
  beforeEach(() => { secret = randomUUID(); vi.stubEnv("CRON_SECRET", secret); vi.stubEnv("VERCEL_ENV", ""); });
  afterAll(async () => { vi.unstubAllEnvs(); await db?.$disconnect(); });
  const req = (headers: Record<string, string> = {}) => new NextRequest("http://localhost/api/cron/synthetic?schoolId=school-B", { headers });
  const unchanged = async () => {
    const rows = await db.assignmentSubmission.findMany({ orderBy: { id: "asc" } });
    expect(rows).toHaveLength(2);
    for (const row of rows) expect(row).toMatchObject({ score: null, feedback: null, gradedAt: null, autoReleasedAt: null });
  };
  it.each([undefined, "", "   "])("unconfigured or blank secret cannot release persisted grades (%s)", async value => {
    vi.stubEnv("CRON_SECRET", value);
    expect((await release.POST(req())).status).toBe(401); await unchanged(); expect(await db.auditLog.count()).toBe(0);
  });
  it("wrong and forged-school credentials cannot release either school's feedback", async () => {
    expect((await release.GET(req({ authorization: "Bearer wrong", "x-school-id": "school-B" }))).status).toBe(401); await unchanged();
  });
  it("Preview refuses valid credentials before changing persisted submissions", async () => {
    vi.stubEnv("VERCEL_ENV", "preview"); expect((await release.GET(req({ authorization: `Bearer ${secret}` }))).status).toBe(401); await unchanged();
  });
  it("guardian digest rejects missing configuration on the real database", async () => {
    vi.stubEnv("CRON_SECRET", undefined); expect((await digest.GET(req())).status).toBe(401); await unchanged();
  });
  it("authorized digest retains its actual empty-eligibility query without SMS", async () => {
    expect(await (await digest.GET(req({ authorization: `Bearer ${secret}` }))).json()).toMatchObject({ ok: true, sent: 0, errors: 0 });
  });
  it("authorized scheduled release changes only provisional fields and is idempotent", async () => {
    const res = await release.GET(req({ authorization: `Bearer ${secret}` })); expect(res.status).toBe(200); expect(await res.json()).toMatchObject({ released: 2 });
    for (const row of await db.assignmentSubmission.findMany()) {
      expect(row.autoReleasedAt).toBeInstanceOf(Date); expect(row).toMatchObject({ score: null, feedback: null, gradedAt: null, teacherApproved: false });
    }
    // The service appends audit asynchronously. A subsequent pool-1 query drains it.
    expect(await db.auditLog.count({ where: { action: "homework.ai_feedback_released_provisional" } })).toBe(2);
    expect(await (await release.POST(req({ "x-cron-secret": secret }))).json()).toMatchObject({ released: 0 });
    expect((await db.auditLog.findMany()).map(row => row.schoolId).sort()).toEqual(["school-A", "school-B"]);
  });
});
