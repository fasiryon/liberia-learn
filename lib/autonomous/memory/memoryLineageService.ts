import { prisma } from "@/lib/db";

export async function getMemoryLineage(memoryEventId: string) {
  const event = await (prisma as any).learningEvent.findUnique({ where: { id: memoryEventId } });
  if (!event || event.eventType !== "autonomous.memory.recorded") throw Object.assign(new Error("Memory not found"), { status: 404 });
  return {
    memoryEventId: event.id,
    schoolId: event.schoolId,
    districtId: event.districtId,
    targetType: event.targetType,
    targetId: event.targetId,
    lineage: event.metadata?.lineage ?? {},
    evidenceRefs: event.metadata?.evidenceRefs ?? {},
    confidence: event.metadata?.confidence ?? null,
    retention: event.metadata?.retention ?? null,
  };
}

