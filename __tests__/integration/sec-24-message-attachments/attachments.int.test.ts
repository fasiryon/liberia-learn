/** Actual messages, enrollment and audit SQL; session, rate admission and push transport only are replaced. */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { PrismaClient } from "@prisma/client";
vi.mock("@/lib/auth", () => ({ requireUser: async () => {
  const { prisma } = await import("@/lib/db"); return prisma.user.findUniqueOrThrow({ where: { id: "student-user" } });
} }));
vi.mock("@/lib/rateLimit", () => ({ checkRateLimit: async () => ({ allowed: true }), rateLimitExceededResponse: () => { throw Error("Unexpected rate refusal"); } }));
vi.mock("@/lib/push/sendPush", () => ({ sendPushToUser: async () => undefined }));
let admitted = false;
try { const url = new URL(process.env.DATABASE_URL ?? ""); admitted = process.env.LL_SEC_24_DB_TEST === "1" && url.hostname === "127.0.0.1" && url.port === "55432" && /^\/sec24_t2_\d+$/.test(url.pathname) && url.searchParams.get("connection_limit") === "1"; } catch { /* Local only. */ }
if (process.env.LL_SEC_24_DB_TEST === "1" && !admitted) throw Error("SEC-24 requires its own IPv4 loopback database");
describe.skipIf(!admitted)("SEC-24 native message attachment contract", () => {
  let db: PrismaClient; let send: typeof import("@/app/api/student/messages/route").POST;
  beforeAll(async () => {
    vi.stubGlobal("fetch", () => { throw Error("No external calls"); });
    ({ prisma: db } = await import("@/lib/db")); ({ POST: send } = await import("@/app/api/student/messages/route"));
    for (const suffix of ["A", "B"]) {
      await db.school.create({ data: { id: `school-${suffix}`, name: `Synthetic ${suffix}` } });
      await db.user.create({ data: { id: `teacher-${suffix}`, email: `teacher-${suffix}@example.invalid`, role: "TEACHER", schoolId: `school-${suffix}` } });
      await db.class.create({ data: { id: `class-${suffix}`, schoolId: `school-${suffix}`, teacherId: `teacher-${suffix}`, name: "Synthetic", subject: "MATH" } });
    }
    await db.user.create({ data: { id: "student-user", email: "student@example.invalid", role: "STUDENT", schoolId: "school-A" } });
    await db.student.create({ data: { id: "student-profile", userId: "student-user", currentGrade: 4 } });
    for (const suffix of ["A", "B"]) await db.enrollment.create({ data: { studentId: "student-profile", classId: `class-${suffix}` } });
    await db.message.create({ data: { id: "prior-message", fromUserId: "student-user", toUserId: "teacher-A", body: "Saved previous message", threadKey: "student-user:teacher-A", classId: "class-A", senderRole: "STUDENT", recipientRole: "TEACHER" } });
  });
  beforeEach(async () => { await db.user.update({ where: { id: "student-user" }, data: { schoolId: "school-A" } }); });
  afterAll(async () => { vi.unstubAllGlobals(); await db?.$disconnect(); });
  const attachment = { attachmentUrl: "https://attachments.example.invalid/synthetic.png", attachmentName: "synthetic.png", attachmentType: "image/png" };
  const payload = (overrides: Record<string, unknown> = {}) => ({ teacherId: "teacher-A", body: "Synthetic message", ...attachment, ...overrides });
  const request = (body: unknown) => new NextRequest("http://localhost/api/student/messages", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const unchanged = async (body: unknown, status = 400) => {
    const before = [await db.message.count(), await db.auditLog.count()]; const res = await send(request(body)); expect(res.status).toBe(status);
    expect([await db.message.count(), await db.auditLog.count()]).toEqual(before);
    expect(await db.message.findUnique({ where: { id: "prior-message" } })).toMatchObject({ body: "Saved previous message", attachmentUrl: null });
  };
  for (const [label, overrides] of [
    ["javascript URL", { attachmentUrl: "javascript:alert(1)" }], ["data URL", { attachmentUrl: "data:text/html,synthetic" }],
    ["file URL", { attachmentUrl: "file:///synthetic" }], ["protocol-relative URL", { attachmentUrl: "//attachments.example.invalid/a.png" }],
    ["unencrypted URL", { attachmentUrl: "http://attachments.example.invalid/a.png" }], ["URL userinfo", { attachmentUrl: "https://synthetic@attachments.example.invalid/a.png" }],
    ["backslash URL", { attachmentUrl: "https:\\\\attachments.example.invalid/a.png" }], ["leading URL whitespace", { attachmentUrl: " https://attachments.example.invalid/a.png" }],
    ["URL control character", { attachmentUrl: "https://attachments.example.invalid/a\n.png" }], ["unsupported MIME", { attachmentType: "text/html" }],
    ["non-string URL", { attachmentUrl: 42 }], ["empty name", { attachmentName: "" }], ["control character name", { attachmentName: "bad\u0000name.png" }],
    ["oversized name", { attachmentName: "x".repeat(256) }], ["incomplete metadata", { attachmentType: null }],
  ] as Array<[string, Record<string, unknown>]>) it(`rejects ${label} before message or audit writes`, async () => { await unchanged(payload(overrides)); });
  it.each([...Array.from({ length: 32 }, (_, code) => code), 127])("rejects raw URL-path control code %i before any write", async code => {
    await unchanged(payload({ attachmentUrl: `https://attachments.example.invalid/a${String.fromCharCode(code)}.png` }));
  });
  it.each(["image/jpeg", "image/png", "image/gif", "application/pdf"])("retains the upload producer's %s contract and durable actor/school audit", async attachmentType => {
    const res = await send(request(payload({ attachmentType }))); expect(res.status).toBe(201); const { messageId } = await res.json();
    expect(await db.message.findUnique({ where: { id: messageId } })).toMatchObject({ fromUserId: "student-user", toUserId: "teacher-A", classId: "class-A", attachmentType });
    expect(await db.auditLog.findFirst({ where: { resourceId: messageId } })).toMatchObject({ userId: "student-user", schoolId: "school-A", action: "student.message.sent" });
  });
  it("Grade9 can still send a text-only message with all attachment fields null", async () => {
    await db.student.update({ where: { id: "student-profile" }, data: { currentGrade: 9 } });
    const res = await send(request(payload({ attachmentUrl: null, attachmentName: null, attachmentType: null }))); expect(res.status).toBe(201);
    expect(await db.message.findUnique({ where: { id: (await res.json()).messageId } })).toMatchObject({ attachmentUrl: null, attachmentName: null, attachmentType: null });
  });
  it("malformed foreign-school enrollment cannot authorize sending an attachment to that teacher", async () => { await unchanged(payload({ teacherId: "teacher-B" }), 403); });
  it("missing canonical school context cannot authorize sending", async () => {
    await db.user.update({ where: { id: "student-user" }, data: { schoolId: null } }); await unchanged(payload(), 403);
  });
  it.each([[null], [[]], ["synthetic"]])("malformed body refuses without persistence (%j)", async body => { await unchanged(body); });
});
