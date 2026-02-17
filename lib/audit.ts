// lib/audit.ts — Immutable audit logging helper
import { prisma } from "@/lib/db";

export async function logAudit({
  userId,
  action,
  resourceType,
  resourceId,
  details,
  ipAddress,
}: {
  userId?: string | null;
  action: string;
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: userId ?? null,
        action,
        resourceType: resourceType ?? null,
        resourceId: resourceId ?? null,
        details: (details as any) ?? undefined,
        ipAddress: ipAddress ?? null,
      },
    });
  } catch (err) {
    // Audit logging should never break the main flow
    console.error("[AUDIT] Failed to log:", err);
  }
}
