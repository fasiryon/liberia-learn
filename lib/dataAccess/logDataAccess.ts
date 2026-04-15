// lib/dataAccess/logDataAccess.ts — Sprint 7
// Fine-grained data access logging for governance audit trail.
// Never throws — mirrors logAudit() pattern.

import { prisma } from "@/lib/db";

export interface DataAccessEvent {
  userId?: string | null;
  schoolId?: string | null;
  resourceType: string;
  resourceId?: string | null;
  action: string;
  scope?: string | null;
  traceId?: string | null;
  ipAddress?: string | null;
  metadata?: Record<string, unknown>;
}

export async function logDataAccess(event: DataAccessEvent): Promise<void> {
  try {
    if (!prisma?.dataAccessLog?.create) return;
    await prisma.dataAccessLog.create({
      data: {
        userId: event.userId ?? null,
        schoolId: event.schoolId ?? null,
        resourceType: event.resourceType,
        resourceId: event.resourceId ?? null,
        action: event.action,
        scope: event.scope ?? null,
        traceId: event.traceId ?? null,
        ipAddress: event.ipAddress ?? null,
        metadata: (event.metadata as never) ?? undefined,
      },
    });
  } catch {
    // Data access logging must never break main flow
  }
}
