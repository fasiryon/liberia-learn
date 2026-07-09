import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

export type EscalationFilter = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED" | "all";

export async function listEscalations(filter: EscalationFilter = "OPEN") {
  return prisma.escalationQueue.findMany({
    where: filter === "all" ? {} : { status: filter },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    take: 100,
  });
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
