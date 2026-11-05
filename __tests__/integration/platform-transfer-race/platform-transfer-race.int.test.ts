/**
 * Atlas P1 platform-transfer single use on REAL PostgreSQL (CoS db-integration, `db_setup: push`).
 *
 * Drives the actual POST /api/platform/security/accept with the real `@/lib/db` client against a disposable database.
 * Only the session lookup, privileged step-up, the portal flag and (for the rollback case) a one-shot audit fault are
 * substituted.
 *
 * Admission: runs only when LL_PLATFORM_TRANSFER_DB_TEST=1 AND DATABASE_URL points at a loopback host; skipped
 * everywhere else. CoS: inside the db-integration job a skip counts as a failure.
 */
import crypto from "crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const url = process.env.DATABASE_URL ?? "";
const loopback = /^postgres(ql)?:\/\/[^@]*@(localhost|127\.0\.0\.1)(:\d+)?\//.test(url);
const enabled = process.env.LL_PLATFORM_TRANSFER_DB_TEST === "1" && loopback;

const h = vi.hoisted(() => ({ actor: "", failNextAudit: false }));
vi.mock("@/lib/serverFlags", () => ({ isMoePortalEnabled: () => true }));
vi.mock("@/lib/auth", () => ({
  requireUser: async () => ({ id: h.actor }),
  requirePrivilegedStepUp: async () => ({ id: h.actor }),
}));
vi.mock("@/lib/audit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/audit")>("@/lib/audit");
  return {
    ...actual,
    logAuditRequired: async (...args: Parameters<typeof actual.logAuditRequired>) => {
      if (h.failNextAudit) { h.failNextAudit = false; throw new Error("injected audit failure"); }
      return actual.logAuditRequired(...args);
    },
  };
});

describe("platform-transfer-race admission", () => {
  it("states whether this run is admitted (loopback DATABASE_URL + LL_PLATFORM_TRANSFER_DB_TEST=1)", () => {
    expect(typeof enabled).toBe("boolean");
  });
});

describe.skipIf(!enabled)("platform transfer token single use on real PostgreSQL", () => {
  const s = `ptr-${Date.now().toString(36)}`;
  const ids = { sender: `${s}-sender`, admin3: `${s}-admin3`, recipient: `${s}-recipient`, recipient2: `${s}-recipient2`, tok1: `${s}-tok1`, tok2: `${s}-tok2` };
  const raw1 = `${s}-raw-1`, raw2 = `${s}-raw-2`;
  const hash = (v: string) => crypto.createHash("sha256").update(v).digest("hex");
  let prisma: any;
  let POST: (req: Request) => Promise<Response>;
  const accept = (token: string, demoteSender: boolean) =>
    POST(new Request("http://localhost/api/platform/security/accept", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, demoteSender }) }));
  const acceptAudits = (userId: string) => prisma.auditLog.count({ where: { action: "platform.transfer.accept", userId } });

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/db"));
    ({ POST } = await import("@/app/api/platform/security/accept/route"));
    for (const [id, admin] of [[ids.sender, true], [ids.admin3, true], [ids.recipient, false], [ids.recipient2, false]] as const) {
      await prisma.user.create({ data: { id, email: `${id}@synthetic.invalid`, role: "ADMIN", isPlatformAdmin: admin } });
    }
    const expiresAt = new Date(Date.now() + 3_600_000);
    await prisma.platformTransferToken.create({ data: { id: ids.tok1, tokenHash: hash(raw1), createdBy: ids.sender, intendedUserId: ids.recipient, expiresAt } });
    await prisma.platformTransferToken.create({ data: { id: ids.tok2, tokenHash: hash(raw2), createdBy: ids.sender, intendedUserId: ids.recipient2, expiresAt } });
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.platformTransferToken.deleteMany({ where: { id: { in: [ids.tok1, ids.tok2] } } }).catch(() => undefined);
    await prisma.user.deleteMany({ where: { id: { in: [ids.sender, ids.admin3, ids.recipient, ids.recipient2] } } }).catch(() => undefined);
    // Audit rows are append-only evidence in the disposable database; they are not deleted.
  });

  it("two concurrent accepts of one token (no demotion vs demotion): one 200, one 409, one audit, one effect set", async () => {
    h.actor = ids.recipient;
    const before = await prisma.user.findUnique({ where: { id: ids.recipient }, select: { passwordChangedAt: true } });
    const [a, b] = await Promise.all([accept(raw1, false), accept(raw1, true)]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    const loser = a.status === 409 ? a : b;
    expect((await loser.json()).code).toBe("TOKEN_ALREADY_USED");
    const winnerDemoted = a.status === 200 ? false : true;

    const tok = await prisma.platformTransferToken.findUnique({ where: { id: ids.tok1 } });
    expect(tok.usedAt).not.toBeNull();
    expect(tok.usedBy).toBe(ids.recipient);
    expect((await prisma.user.findUnique({ where: { id: ids.recipient } })).isPlatformAdmin).toBe(true);
    // The sender is demoted only if the WINNING request asked for it; the losing request has no effect.
    expect((await prisma.user.findUnique({ where: { id: ids.sender } })).isPlatformAdmin).toBe(!winnerDemoted);
    expect(await acceptAudits(ids.recipient)).toBe(1);
    const after = await prisma.user.findUnique({ where: { id: ids.recipient }, select: { passwordChangedAt: true } });
    expect(after.passwordChangedAt?.getTime()).not.toBe(before.passwordChangedAt?.getTime() ?? undefined);
  });

  it("a later replay of the consumed token is refused with no effect", async () => {
    h.actor = ids.recipient;
    const res = await accept(raw1, true);
    expect(res.status).toBe(400); // pre-check sees usedAt; the claim would refuse it too
    expect(await acceptAudits(ids.recipient)).toBe(1);
  });

  it("a required-audit failure rolls back the claim, the promotion and the demotion; the token then works once", async () => {
    h.actor = ids.recipient2;
    const senderBefore = (await prisma.user.findUnique({ where: { id: ids.sender } })).isPlatformAdmin;
    h.failNextAudit = true;
    expect((await accept(raw2, true)).status).toBe(500);
    expect((await prisma.platformTransferToken.findUnique({ where: { id: ids.tok2 } })).usedAt).toBeNull();
    expect((await prisma.user.findUnique({ where: { id: ids.recipient2 } })).isPlatformAdmin).toBe(false);
    expect((await prisma.user.findUnique({ where: { id: ids.sender } })).isPlatformAdmin).toBe(senderBefore);
    expect(await acceptAudits(ids.recipient2)).toBe(0);

    expect((await accept(raw2, false)).status).toBe(200);
    expect(await acceptAudits(ids.recipient2)).toBe(1);
  });
});
