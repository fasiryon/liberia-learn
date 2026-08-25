import * as fs from "fs";
import * as path from "path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it, vi } from "vitest";

// ── helpers ──────────────────────────────────────────────────────────────────

async function loadDbWithFlag(enabled: boolean) {
  vi.resetModules();
  delete (globalThis as any).prisma;
  delete (globalThis as any).rdsPrisma;

  const create = vi.fn(async ({ data }) => ({ id: "audit-1", ...data }));
  const remove = vi.fn(async () => ({ id: "deleted" }));
  const update = vi.fn(async () => ({ id: "updated" }));

  class PrismaClientMock {
    auditLog = {
      create,
      delete: remove,
      deleteMany: remove,
      update,
      updateMany: update,
    };
  }

  vi.doMock("@prisma/client", () => ({ PrismaClient: PrismaClientMock }));
  vi.doMock("@/lib/serverFlags", () => ({
    isAuditImmutabilityEnabled: () => enabled,
  }));

  const db = await import("@/lib/db");
  const audit = await import("@/lib/audit");
  return { prisma: db.prisma as any, logAudit: audit.logAudit, create, remove, update };
}

const MIGRATION_SQL = path.join(
  __dirname,
  "../prisma/migrations/20260522_000001_audit_immutability/migration.sql"
);

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

// ── DB trigger presence (static verification of migration SQL) ────────────────

describe("DB trigger migration SQL", () => {
  it("migration file contains prevent_audit_update trigger", () => {
    const sql = fs.readFileSync(MIGRATION_SQL, "utf8");
    expect(sql).toContain("CREATE TRIGGER audit_log_no_update");
    expect(sql).toContain("prevent_audit_update");
    expect(sql).toContain('BEFORE UPDATE ON "AuditLog"');
  });

  it("migration file contains prevent_audit_delete trigger", () => {
    const sql = fs.readFileSync(MIGRATION_SQL, "utf8");
    expect(sql).toContain("CREATE TRIGGER audit_log_no_delete");
    expect(sql).toContain("prevent_audit_delete");
    expect(sql).toContain('BEFORE DELETE ON "AuditLog"');
  });
});

// ── App-layer immutability (Prisma middleware) ────────────────────────────────

describe("audit immutability", () => {
  it("logAudit creates a new record", async () => {
    const { logAudit, create } = await loadDbWithFlag(true);
    await logAudit({ action: "test.action" });
    expect(create).toHaveBeenCalled();
  });

  it("app middleware blocks AuditLog delete", async () => {
    const { prisma } = await loadDbWithFlag(true);
    expect(() => prisma.auditLog.delete({ where: { id: "audit-1" } })).toThrow(
      "AuditLog mutations are forbidden"
    );
  });

  it("app middleware blocks AuditLog update", async () => {
    const { prisma } = await loadDbWithFlag(true);
    expect(() => prisma.auditLog.update({ where: { id: "audit-1" }, data: {} })).toThrow(
      "AuditLog mutations are forbidden"
    );
  });

  it("middleware bypassed when flag is off (DB trigger remains the safety net)", async () => {
    const { prisma, remove, update } = await loadDbWithFlag(false);
    await prisma.auditLog.delete({ where: { id: "audit-1" } });
    await prisma.auditLog.update({ where: { id: "audit-1" }, data: {} });
    expect(remove).toHaveBeenCalled();
    expect(update).toHaveBeenCalled();
  });
});

// ── Static analysis: no production code mutates AuditLog ────────────────────

describe("static analysis: no production auditLog mutations", () => {
  it("no app code calls auditLog.update or auditLog.delete outside demo and tests", () => {
    const root = path.join(__dirname, "..");
    const scan = spawnSync(
      "git",
      [
        "grep",
        "--untracked",
        "-n",
        "-E",
        String.raw`auditLog\.(update|delete)`,
        "--",
        "app",
        "lib",
        "scripts",
      ],
      { cwd: root, encoding: "utf8" },
    );
    expect([0, 1]).toContain(scan.status);
    const violations = scan.stdout
      .split(/\r?\n/)
      .filter(Boolean)
      .filter((line) => !line.replaceAll("\\", "/").includes("/demo/"))
      .filter((line) => line.split(":", 1)[0].endsWith(".ts"))
      .filter((line) => !line.split(":", 1)[0].endsWith(".test.ts"));

    expect(violations).toEqual([]);
  });
});
