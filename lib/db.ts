// lib/db.ts  —  canonical PrismaClient singleton
import { PrismaClient } from "@prisma/client";
import { isAuditImmutabilityEnabled } from "@/lib/serverFlags";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  rdsPrisma: PrismaClient | undefined;
};

function createPrismaClient(databaseUrl?: string) {
  return new PrismaClient({
    ...(databaseUrl
      ? {
          datasources: {
            db: { url: databaseUrl },
          },
        }
      : {}),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

type AuditMutationAction = "delete" | "deleteMany" | "update" | "updateMany";

function assertAuditLogMutationAllowed(action: AuditMutationAction) {
  if (isAuditImmutabilityEnabled()) {
    console.error("[AUDIT] blocked AuditLog mutation", { action });
    throw new Error("AuditLog mutations are forbidden");
  }
}

const auditModel = (prisma as any).auditLog;
if (auditModel && !auditModel.__immutabilityWrapped) {
  for (const action of ["delete", "deleteMany", "update", "updateMany"] as const) {
    const original = auditModel[action];
    if (typeof original === "function") {
      auditModel[action] = (...args: unknown[]) => {
        assertAuditLogMutationAllowed(action);
        return original.apply(auditModel, args);
      };
    }
  }
  auditModel.__immutabilityWrapped = true;
}

const prismaWithUse = prisma as PrismaClient & {
  __auditMiddlewareRegistered?: boolean;
  $use?: (fn: (params: any, next: (params: any) => Promise<any>) => Promise<any>) => void;
};

if (!prismaWithUse.__auditMiddlewareRegistered && typeof prismaWithUse.$use === "function") {
  prismaWithUse.$use(async (params, next) => {
    if (
      params.model === "AuditLog" &&
      (params.action === "delete" ||
        params.action === "deleteMany" ||
        params.action === "update" ||
        params.action === "updateMany")
    ) {
      assertAuditLogMutationAllowed(params.action as AuditMutationAction);
    }
    return next(params);
  });
  prismaWithUse.__auditMiddlewareRegistered = true;
}

const shouldEnableRdsDualWrite =
  process.env.ENABLE_RDS_DUAL_WRITE === "true" &&
  typeof process.env.RDS_DATABASE_URL === "string" &&
  process.env.RDS_DATABASE_URL.trim().length > 0;

export const rdsPrisma = shouldEnableRdsDualWrite
  ? globalForPrisma.rdsPrisma ?? createPrismaClient(process.env.RDS_DATABASE_URL)
  : null;

export function isRdsDualWriteEnabled() {
  return rdsPrisma != null;
}

export function logRdsDualWriteError(action: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[RDS_DUAL_WRITE] ${action} failed`, { message });
}

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  if (rdsPrisma) {
    globalForPrisma.rdsPrisma = rdsPrisma;
  }
}
