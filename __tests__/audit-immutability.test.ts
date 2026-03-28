import { afterEach, describe, expect, it, vi } from "vitest";

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

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe("audit immutability", () => {
  it("logAudit creates a new record", async () => {
    const { logAudit, create } = await loadDbWithFlag(true);
    await logAudit({ action: "test.action" });
    expect(create).toHaveBeenCalled();
  });

  it("prisma middleware blocks AuditLog delete", async () => {
    const { prisma } = await loadDbWithFlag(true);
    expect(() => prisma.auditLog.delete({ where: { id: "audit-1" } })).toThrow(
      "AuditLog mutations are forbidden"
    );
  });

  it("prisma middleware blocks AuditLog update", async () => {
    const { prisma } = await loadDbWithFlag(true);
    expect(() => prisma.auditLog.update({ where: { id: "audit-1" }, data: {} })).toThrow(
      "AuditLog mutations are forbidden"
    );
  });

  it("blocks are bypassed when flag is off", async () => {
    const { prisma, remove, update } = await loadDbWithFlag(false);
    await prisma.auditLog.delete({ where: { id: "audit-1" } });
    await prisma.auditLog.update({ where: { id: "audit-1" }, data: {} });
    expect(remove).toHaveBeenCalled();
    expect(update).toHaveBeenCalled();
  });
});
