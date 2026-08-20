// lib/audit.ts — Immutable audit logging helper
import { prisma } from "@/lib/db";

export type AuditEntry = {
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
};

type AuditWriteClient = {
  auditLog?: {
    create(args: any): PromiseLike<unknown>;
  };
};

async function writeAudit({
  userId,
  action,
  resourceType,
  resourceId,
  details,
  ipAddress,
  traceId,
  schoolId,
}: AuditEntry, client: AuditWriteClient = prisma): Promise<unknown> {
  if (!client?.auditLog?.create) {
    throw new Error("audit_log_unavailable");
  }

  return client.auditLog.create({
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
}

export async function logAudit(entry: AuditEntry): Promise<boolean> {
  try {
    await writeAudit(entry);
    return true;
  } catch (err) {
    // Audit logging should never break the main flow
    console.error("[AUDIT] Failed to log:", err);
    return false;
  }
}

/**
 * Use for safety, approval, access-control, and other sensitive transitions
 * that must not be reported as complete without durable audit evidence.
 */
export async function logAuditRequired(entry: AuditEntry, client: AuditWriteClient = prisma): Promise<void> {
  await writeAudit(entry, client);
}

export async function logAuditRequiredWithId(
  entry: AuditEntry,
  client: AuditWriteClient = prisma,
): Promise<string> {
  const created = await writeAudit(entry, client);
  const id =
    created && typeof created === "object" && "id" in created
      ? (created as { id?: unknown }).id
      : null;
  if (typeof id !== "string" || id.length === 0) {
    throw new Error("audit_log_id_unavailable");
  }
  return id;
}
