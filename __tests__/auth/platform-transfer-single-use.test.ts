/**
 * Atlas P1 (INDEPENDENT_DISPOSITION 2026-11-05): platform-transfer token single use.
 *
 * Reproduction: two intended-recipient requests both read one unused token. Their transactions then run one after the
 * other: A accepts with demoteSender=false; B, acting on its stale read, accepts with demoteSender=true. On 8574c05e both
 * return 200, both advance the account version and audit, and B demotes the sender, a second privileged effect from a
 * capability already consumed once.
 *
 * Contract: the token is CLAIMED atomically inside the privilege/audit transaction, before any privileged write:
 * `updateMany WHERE id AND usedAt IS NULL AND expiresAt > now AND intendedUserId = caller`. Only a count of 1 proceeds.
 * The loser gets 409 TOKEN_ALREADY_USED and its transaction writes nothing. A failure after the claim (for example the
 * required audit) rolls back the claim, the promotion and the demotion together.
 *
 * In-memory database with transaction snapshot/rollback; synthetic identities. Native PostgreSQL is CoS db-integration.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import crypto from "crypto";

type UserRow = { id: string; isPlatformAdmin: boolean; passwordChangedAt: Date | null };
type TokenRow = { id: string; tokenHash: string; createdBy: string; usedAt: Date | null; usedBy: string | null; expiresAt: Date; intendedUserId: string | null };

const TOKEN = "transfer-token-synthetic";
const HASH = crypto.createHash("sha256").update(TOKEN).digest("hex");

const db = vi.hoisted(() => ({
  users: {} as Record<string, UserRow>,
  token: null as unknown as TokenRow,
  staleRead: null as unknown as TokenRow,
  audits: [] as unknown[],
  failAudit: false,
  writes: [] as string[],
  actor: "recipient-1",
}));

vi.mock("@/lib/serverFlags", () => ({ isMoePortalEnabled: () => true }));
vi.mock("@/lib/auth", () => ({
  requireUser: async () => ({ id: db.actor }),
  requirePrivilegedStepUp: async () => ({ id: db.actor }),
}));
vi.mock("@/lib/audit", () => ({
  logAuditRequired: async (entry: unknown) => {
    if (db.failAudit) throw new Error("audit store unavailable");
    db.audits.push(entry);
  },
}));
vi.mock("@/lib/db", () => {
  const matches = (row: Record<string, any>, where: Record<string, any>): boolean => Object.entries(where).every(([k, v]) => {
    if (v && typeof v === "object" && !(v instanceof Date) && "gt" in v) return row[k] instanceof Date && row[k].getTime() > (v.gt as Date).getTime();
    if (v instanceof Date) return row[k] instanceof Date && row[k].getTime() === v.getTime();
    return (row[k] ?? null) === v;
  });
  const tx = {
    user: {
      update: async ({ where, data }: any) => { db.writes.push(`user.update:${where.id}:${JSON.stringify(data)}`); Object.assign(db.users[where.id], data); return db.users[where.id]; },
      updateMany: async ({ where, data }: any) => {
        const u = db.users[where.id];
        const ok = u && ((u.passwordChangedAt?.getTime() ?? null) === (where.passwordChangedAt ? new Date(where.passwordChangedAt).getTime() : null));
        if (!ok) return { count: 0 };
        db.writes.push(`user.stamp:${where.id}`);
        Object.assign(u, data);
        return { count: 1 };
      },
      findUnique: async ({ where }: any) => (db.users[where.id] ? { passwordChangedAt: db.users[where.id].passwordChangedAt } : null),
      count: async ({ where }: any) => Object.values(db.users).filter((u) => u.isPlatformAdmin === where.isPlatformAdmin).length,
    },
    platformTransferToken: {
      // Unconditional write (the vulnerable pattern): never re-checks unused/unexpired state.
      update: async ({ where, data }: any) => { db.writes.push("token.update"); if (where.id === db.token.id) Object.assign(db.token, data); return db.token; },
      updateMany: async ({ where, data }: any) => {
        if (!matches(db.token as any, where)) return { count: 0 };
        db.writes.push("token.claim");
        Object.assign(db.token, data);
        return { count: 1 };
      },
    },
  };
  return {
    prisma: {
      // Every request's outer read sees the token as it was before either transaction (the controlled stale read).
      platformTransferToken: { findFirst: async () => structuredClone(db.staleRead) },
      // Serialized transactions with rollback on throw.
      $transaction: async (fn: (client: unknown) => Promise<unknown>) => {
        const snapshot = structuredClone({ users: db.users, token: db.token, audits: db.audits });
        try {
          return await fn(tx);
        } catch (error) {
          db.users = snapshot.users; db.token = snapshot.token; db.audits = snapshot.audits;
          throw error;
        }
      },
    },
  };
});

import { POST } from "@/app/api/platform/security/accept/route";

const accept = async (demoteSender: boolean) => {
  const res = await POST(new Request("http://localhost/api/platform/security/accept", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: TOKEN, demoteSender }),
  }));
  return { status: res.status, body: await res.json() };
};

beforeEach(() => {
  db.users = {
    "recipient-1": { id: "recipient-1", isPlatformAdmin: false, passwordChangedAt: null },
    "sender-1": { id: "sender-1", isPlatformAdmin: true, passwordChangedAt: null },
    "admin-3": { id: "admin-3", isPlatformAdmin: true, passwordChangedAt: null },
  };
  db.token = { id: "tok-1", tokenHash: HASH, createdBy: "sender-1", usedAt: null, usedBy: null, expiresAt: new Date(Date.now() + 3_600_000), intendedUserId: "recipient-1" };
  db.staleRead = structuredClone(db.token);
  db.audits = [];
  db.writes = [];
  db.failAudit = false;
  db.actor = "recipient-1";
});

describe("platform transfer token: single use under a stale concurrent read", () => {
  it("A (no demotion) then B (demotion) from the same unused read: only A succeeds; no second privileged effect", async () => {
    const a = await accept(false);
    expect(a.status).toBe(200);
    const b = await accept(true);
    expect(b.status).toBe(409);
    expect(b.body.code).toBe("TOKEN_ALREADY_USED");
    expect(db.users["sender-1"].isPlatformAdmin).toBe(true); // the sender is NOT demoted by the replay
    expect(db.audits).toHaveLength(1);
    expect(db.writes.filter((w) => w === "user.stamp:recipient-1")).toHaveLength(1);
  });

  it("claims the token before any privileged write, with all single-use conditions", async () => {
    await accept(false);
    expect(db.writes[0]).toBe("token.claim");
    expect(db.writes).not.toContain("token.update");
    expect(db.token.usedBy).toBe("recipient-1");
  });

  it("a token that expires between the read and the claim is refused with no write", async () => {
    db.token.expiresAt = new Date(Date.now() - 1000);
    const res = await accept(false);
    expect(res.status).toBe(409);
    expect(db.users["recipient-1"].isPlatformAdmin).toBe(false);
    expect(db.audits).toHaveLength(0);
  });

  it("a different signed-in user cannot claim another recipient's token even from a stale read", async () => {
    db.actor = "admin-3";
    db.staleRead = { ...db.staleRead, intendedUserId: "admin-3" }; // stale/forged read claims admin-3
    const res = await accept(false);
    expect(res.status).toBe(409);
    expect(db.token.usedAt).toBeNull();
  });

  it("rollback: a required-audit failure after the claim leaves the token unused and nobody promoted or demoted", async () => {
    db.failAudit = true;
    const res = await accept(true);
    expect(res.status).toBe(500);
    expect(db.token.usedAt).toBeNull();
    expect(db.users["recipient-1"].isPlatformAdmin).toBe(false);
    expect(db.users["sender-1"].isPlatformAdmin).toBe(true);
    db.failAudit = false;
    expect((await accept(false)).status).toBe(200); // the capability is still usable exactly once
    expect((await accept(false)).status).toBe(409);
  });
});
