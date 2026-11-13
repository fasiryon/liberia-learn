// lib/db.ts  —  canonical PrismaClient singleton
import { PrismaClient } from "@prisma/client";
import { logger } from "@/lib/logger";
import { assertStagingDatabaseIsolation } from "@/lib/database-target";
import { AUDIT_MUTATION_OPERATIONS, assertDbOperationAllowed, dbGuardExtension } from "@/lib/db-guards";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  rdsPrisma: PrismaClient | undefined;
};

function createPrismaClient(databaseUrl?: string) {
  const rawUrl = databaseUrl ?? process.env.DATABASE_URL;
  let url = rawUrl;
  if (url && !url.includes("connection_limit")) {
    url = url.includes("?") ? `${url}&connection_limit=1` : `${url}?connection_limit=1`;
  }
  return new PrismaClient({
    ...(url
      ? {
          datasources: {
            db: { url },
          },
        }
      : {}),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

// Next 14 does not run instrumentation register(), so deployed Preview/staging
// refuses a non-isolated database here, before any client exists. A no-op for
// Production and for runs without a Vercel identity.
assertStagingDatabaseIsolation();

/**
 * Applies the client-level guards (lib/db-guards.ts: audit immutability, Preview official-records freeze) with the
 * supported query extension, which also covers interactive and batch transactions. Prisma 6.14+ removed the middleware
 * API; the former audit middleware and its 8s timeout race never registered and are removed (a timeout race could not
 * cancel database work anyway: bounded queries need a server-side statement timeout, see the T1 handoff). Query extensions do not change the client's method signatures, so the extended client keeps the
 * PrismaClient type. A client without $extends (unit-test doubles) gets an equivalent root-delegate wrapper.
 */
function withDbGuards(client: PrismaClient): PrismaClient {
  if (typeof (client as any).$extends === "function") {
    return (client as any).$extends(dbGuardExtension) as PrismaClient;
  }
  for (const [key, model] of [["auditLog", "AuditLog"]] as const) {
    const delegate = (client as any)[key];
    if (!delegate || delegate.__guardsWrapped) continue;
    for (const operation of AUDIT_MUTATION_OPERATIONS) {
      const original = delegate[operation];
      if (typeof original !== "function") continue;
      delegate[operation] = (...args: unknown[]) => {
        assertDbOperationAllowed(model, operation);
        return original.apply(delegate, args);
      };
    }
    delegate.__guardsWrapped = true;
  }
  return client;
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? withDbGuards(createPrismaClient());

const shouldEnableRdsDualWrite =
  process.env.ENABLE_RDS_DUAL_WRITE?.trim() === "true" &&
  typeof process.env.RDS_DATABASE_URL === "string" &&
  process.env.RDS_DATABASE_URL.trim().length > 0;

export const rdsPrisma = shouldEnableRdsDualWrite
  ? globalForPrisma.rdsPrisma ?? withDbGuards(createPrismaClient(process.env.RDS_DATABASE_URL))
  : null;

export function isRdsDualWriteEnabled() {
  return rdsPrisma != null;
}

export function logRdsDualWriteError(action: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  logger.error(`[RDS_DUAL_WRITE] ${action} failed`, { message });
}

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  if (rdsPrisma) {
    globalForPrisma.rdsPrisma = rdsPrisma;
  }
}
