import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

export type EscalationFilter = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED" | "all";

/**
 * SECURITY FIX (2026-07-16, same-night as Sprint 6.2): EscalationQueue has
 * no schoolId column itself - not every escalation is school-scoped (e.g. an
 * ops-sentinel platform-health finding has no school at all). Prior to this
 * fix, listEscalations had NO tenant scoping whatsoever: any authenticated
 * school ADMIN holding AGENT_PLATFORM_VIEW (every school ADMIN, by default -
 * see lib/permissions.ts ROLE_PERMISSIONS.ADMIN) could see every school's
 * escalations, including Sprint 6.1 safeguarding concerns for children they
 * have no relationship to. Confirmed live in production before this patch.
 *
 * Fix: join through AuditLog, which enqueueEscalation already writes with
 * schoolId on every school-scoped call (lib/agents/escalation.ts writes an
 * "agent.escalation" audit row with resourceType "EscalationQueue" and the
 * schoolId every single time). A school ADMIN only ever sees escalations
 * whose own audit trail names their school. A true platform admin
 * (isPlatformAdmin: true) still sees everything, including platform-wide
 * escalations with no school at all - that visibility is correct for that
 * role, not the bug.
 */
async function scopedEscalationIds(schoolId: string): Promise<string[]> {
  const audits = await prisma.auditLog.findMany({
    where: { resourceType: "EscalationQueue", schoolId, action: "agent.escalation" },
    select: { resourceId: true },
  });
  return [...new Set(audits.map((a) => a.resourceId).filter((id): id is string => Boolean(id)))];
}

/**
 * List escalations. Pass `schoolId` for a school-scoped ADMIN caller - they
 * see ONLY escalations whose audit trail names their school, never another
 * school's and never a platform-wide escalation with no school at all.
 * Omit `schoolId` (or pass null) only for a true platform admin.
 */
export async function listEscalations(filter: EscalationFilter = "OPEN", schoolId?: string | null) {
  const statusWhere = filter === "all" ? {} : { status: filter };

  if (!schoolId) {
    return prisma.escalationQueue.findMany({
      where: statusWhere,
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
      take: 100,
    });
  }

  const ids = await scopedEscalationIds(schoolId);
  if (ids.length === 0) return [];

  return prisma.escalationQueue.findMany({
    where: { ...statusWhere, id: { in: ids } },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    take: 100,
  });
}

/**
 * True if this escalation's own audit trail names the given school. Used as
 * a defense-in-depth check before a school ADMIN is allowed to assign or
 * resolve a specific escalation by ID (not just filtered out of a list).
 */
export async function isEscalationInSchool(id: string, schoolId: string): Promise<boolean> {
  const audit = await prisma.auditLog.findFirst({
    where: { resourceType: "EscalationQueue", resourceId: id, schoolId, action: "agent.escalation" },
    select: { id: true },
  });
  return audit !== null;
}

export async function assignEscalation(id: string, assignedTo: string, actorId: string) {
  const row = await prisma.escalationQueue.update({
    where: { id },
    data: { status: "IN_PROGRESS", assignedTo },
  });
  await logAudit({
    userId: actorId,
    action: "agent.escalation.assign",
    resourceType: "EscalationQueue",
    resourceId: id,
    details: { assignedTo },
  });
  return row;
}

export async function resolveEscalation(id: string, resolution: string, actorId: string) {
  const row = await prisma.escalationQueue.update({
    where: { id },
    data: { status: "RESOLVED", resolvedAt: new Date(), resolution },
  });
  await logAudit({
    userId: actorId,
    action: "agent.escalation.resolve",
    resourceType: "EscalationQueue",
    resourceId: id,
    details: { resolution: resolution.slice(0, 200) },
  });
  return row;
}
