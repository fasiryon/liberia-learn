// lib/audit.ts — Immutable audit logging helper
import { prisma } from "@/lib/db";

export async function logAudit({
  userId,
  action,
  resourceType,
  resourceId,
  details,
  ipAddress,
  traceId,
  schoolId,
}: {
  userId?: string | null;
  action: string;
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  /** Block 6: request-correlation trace ID. Pass randomUUID() at route entry. */
  traceId?: string | null;
  /** Block 6: tenant school ID for tenant-scoped audit queries. */
  schoolId?: string | null;
}) {
  try {
    // AuditLog is append-only by design.
    // DELETE and UPDATE operations on AuditLog are forbidden.
    // This is enforced at the application layer.
    if (!prisma?.auditLog?.create) return;
    await prisma.auditLog.create({
      data: {
        userId: userId ?? null,
        action,
        resourceType: resourceType ?? null,
        resourceId: resourceId ?? null,
        details: (details as any) ?? undefined,
        ipAddress: ipAddress ?? null,
        traceId: traceId ?? null,
        schoolId: schoolId ?? null,
      },
    });
  } catch (err) {
    // Audit logging should never break the main flow
    console.error("[AUDIT] Failed to log:", err);
  }
}
