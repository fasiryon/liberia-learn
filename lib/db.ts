// lib/db.ts  —  canonical PrismaClient singleton
import { PrismaClient } from "@prisma/client";

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
