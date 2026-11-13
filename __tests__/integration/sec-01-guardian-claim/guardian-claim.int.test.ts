/** Real PostgreSQL route acceptance. CoS db-integration: db_setup=push, pool=1,
 * LL_SEC_01_DB_TEST=1. Only email, Preview freeze and a pre-transaction bcrypt
 * barrier are substituted. Transactions, conditional writes and stamps are real.
 * A skipped suite is NOT acceptance. No hosted target is admitted.
 */
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { PrismaClient, Role } from "@prisma/client";

const barrier = vi.hoisted(() => ({ afterHash: async () => {} }));
vi.mock("@/lib/email", () => ({ sendGuardianWelcome: async () => ({ ok: true }) }));
vi.mock("@/lib/preview/identityFreeze", () => ({ previewIdentityFrozen: () => null }));
vi.mock("bcryptjs", async () => {
  const actual = await vi.importActual<typeof import("bcryptjs")>("bcryptjs");
  return { default: { ...actual.default, hash: async (value: string, rounds: number) => {
    const hash = await actual.default.hash(value, rounds); await barrier.afterHash(); return hash;
  } } };
});

let admitted = false;
try {
  const url = new URL(process.env.DATABASE_URL ?? "");
  admitted = process.env.LL_SEC_01_DB_TEST === "1" && ["postgres:", "postgresql:"].includes(url.protocol) &&
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
    /(?:e2e|test|sec.?01)/i.test(url.pathname) && url.searchParams.get("connection_limit") === "1";
} catch { /* Not an explicitly admitted disposable PostgreSQL target. */ }
if (process.env.LL_SEC_01_DB_TEST === "1" && !admitted) throw new Error("SEC-01 requires disposable loopback PostgreSQL with connection_limit=1");

describe.skipIf(!admitted)("SEC-01 native guardian claim at pool 1", () => {
  let db: PrismaClient;
  let post: (request: Request) => Promise<Response>;
  const prefix = `sec01-${Date.now().toString(36)}`;
  const schoolA = `${prefix}-A`, schoolB = `${prefix}-B`;
  let sequence = 0;

  beforeAll(async () => {
    ({ prisma: db } = await import("@/lib/db"));
    ({ POST: post } = await import("@/app/api/guardian/register/route"));
    await db.school.createMany({ data: [{ id: schoolA, name: "Synthetic SEC-01 A" }, { id: schoolB, name: "Synthetic SEC-01 B" }] });
  });
  // Fixtures and audit evidence remain in this disposable database for inspection.
  async function fixture(role: Role = "GUARDIAN", schoolId: string | null = schoolA, isPlatformAdmin = false) {
    const id = `${prefix}-${++sequence}`;
    const guardian = await db.user.create({ data: { id, email: `${id}@synthetic.invalid`,
      role, schoolId, isPlatformAdmin, guardianPhoneE164: "+231770000111", hashedPwd: "synthetic-original" } });
    const learner = await db.user.create({ data: { email: `${id}-child@synthetic.invalid`, role: "STUDENT", schoolId: schoolA } });
    const student = await db.student.create({ data: { userId: learner.id } });
    const token = `${id}-raw-token`;
    const invite = await db.inviteToken.create({ data: { token, email: guardian.email, role: "GUARDIAN",
      tokenType: "GUARDIAN_LINK", schoolId: schoolA, studentId: student.id, expiresAt: new Date(Date.now() + 60_000) } });
    const submit = () => post(new Request("http://localhost/api/guardian/register", { method: "POST",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, fullName: "Synthetic guardian", pin: "6382", confirmPin: "6382" }) }));
    return { guardian, student, invite, submit };
  }
  async function unchanged(f: Awaited<ReturnType<typeof fixture>>, inviteUnused = true) {
    const guardian = await db.user.findUniqueOrThrow({ where: { id: f.guardian.id } });
    expect(guardian.hashedPwd).toBe(f.guardian.hashedPwd);
    expect(guardian.passwordChangedAt).toEqual(f.guardian.passwordChangedAt);
    expect(await db.studentGuardian.count({ where: { guardianId: guardian.id } })).toBe(0);
    expect(await db.guardianConsent.count({ where: { guardianId: guardian.id } })).toBe(0);
    if (inviteUnused) expect((await db.inviteToken.findUniqueOrThrow({ where: { id: f.invite.id } })).usedAt).toBeNull();
  }

  it.each(["STUDENT", "TEACHER", "ADMIN"] as const)("refuses %s credentials without consuming the invite", async (role) => {
    const f = await fixture(role); expect((await f.submit()).status).toBe(400); await unchanged(f);
  });
  it("refuses a platform guardian", async () => {
    const f = await fixture("GUARDIAN", schoolA, true); expect((await f.submit()).status).toBe(400); await unchanged(f);
  });
  it("refuses cross-school and school-less guardians", async () => {
    for (const school of [schoolB, null]) {
      const f = await fixture("GUARDIAN", school); expect((await f.submit()).status).toBe(400); await unchanged(f);
      expect((await db.user.findUniqueOrThrow({ where: { id: f.guardian.id } })).schoolId).toBe(school);
    }
  });
  it.each(["role", "schoolId", "isPlatformAdmin"] as const)("refuses %s changed after the outside lookup", async (field) => {
    const f = await fixture();
    barrier.afterHash = async () => { await db.user.update({ where: { id: f.guardian.id },
      data: field === "role" ? { role: "TEACHER" } : field === "schoolId" ? { schoolId: schoolB } : { isPlatformAdmin: true } }); };
    try { expect((await f.submit()).status).toBe(400); await unchanged(f); }
    finally { barrier.afterHash = async () => {}; }
  });
  it("a consumed invite rolls back the credential, stamp, link and consent together", async () => {
    const f = await fixture();
    barrier.afterHash = async () => { await db.inviteToken.update({ where: { id: f.invite.id }, data: { usedAt: new Date() } }); };
    try { expect((await f.submit()).status).toBe(400); await unchanged(f, false); }
    finally { barrier.afterHash = async () => {}; }
  });
  it("a legitimate guardian claims once; concurrent replay cannot persist a second effect", async () => {
    const f = await fixture();
    const responses = await Promise.all([f.submit(), f.submit()]);
    expect(responses.map(r => r.status).sort()).toEqual([200, 400]);
    const guardian = await db.user.findUniqueOrThrow({ where: { id: f.guardian.id } });
    expect(guardian.role).toBe("GUARDIAN"); expect(guardian.schoolId).toBe(schoolA);
    expect(guardian.hashedPwd).not.toBe(f.guardian.hashedPwd); expect(guardian.passwordChangedAt).not.toBeNull();
    expect(await db.studentGuardian.count({ where: { guardianId: guardian.id } })).toBe(1);
    expect(await db.guardianConsent.count({ where: { guardianId: guardian.id } })).toBe(1);
    expect((await db.inviteToken.findUniqueOrThrow({ where: { id: f.invite.id } })).usedAt).not.toBeNull();
  });
});
