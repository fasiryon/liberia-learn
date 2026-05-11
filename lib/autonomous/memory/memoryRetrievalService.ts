import { prisma } from "@/lib/db";
import { isAutonomousMemoryEnabled } from "@/lib/serverFlags";
import { isMemoryExpired } from "@/lib/autonomous/memory/memoryRetentionService";
import type { OperationalMemoryType } from "@/lib/autonomous/memory/types";

export type MemoryRequester = {
  id?: string | null;
  role?: string | null;
  schoolId?: string | null;
  districtId?: string | null;
  isPlatformAdmin?: boolean;
};

function canReadMemory(event: any, requester: MemoryRequester) {
  if (requester.isPlatformAdmin) return true;
  const memoryType = event.metadata?.memoryType;
  if (memoryType === "NATIONAL_PATTERN" || memoryType === "DISTRICT_PATTERN") {
    return ["MOE_OFFICIAL", "MOE_SUPER_ADMIN", "DISTRICT_ADMIN"].includes(String(requester.role));
  }
  return !!event.schoolId && !!requester.schoolId && event.schoolId === requester.schoolId;
}

export async function retrieveOperationalMemory(input: {
  requester: MemoryRequester;
  memoryTypes?: OperationalMemoryType[];
  schoolId?: string | null;
  districtId?: string | null;
  aggregateOnly?: boolean;
  limit?: number;
}) {
  if (!isAutonomousMemoryEnabled()) {
    throw Object.assign(new Error("Autonomous memory is disabled"), { status: 404, code: "autonomous_memory_disabled" });
  }
  const where: any = { eventType: "autonomous.memory.recorded" };
  if (input.aggregateOnly) where.schoolId = null;
  else if (!input.requester.isPlatformAdmin) where.schoolId = input.requester.schoolId ?? "__none__";
  else if (input.schoolId) where.schoolId = input.schoolId;
  if (input.districtId) where.districtId = input.districtId;
  const events = await (prisma as any).learningEvent.findMany({ where, orderBy: { occurredAt: "desc" }, take: input.limit ?? 50 });
  return events
    .filter((event: any) => canReadMemory(event, input.requester))
    .filter((event: any) => !isMemoryExpired(event.metadata))
    .filter((event: any) => !input.memoryTypes?.length || input.memoryTypes.includes(event.metadata?.memoryType))
    .map((event: any) => ({
      id: event.id,
      memoryType: event.metadata?.memoryType,
      scope: event.metadata?.scope,
      summary: event.metadata?.summary,
      confidence: event.metadata?.confidence,
      lineageRefs: event.metadata?.lineage ? Object.keys(event.metadata.lineage) : [],
      occurredAt: event.occurredAt,
      schoolId: event.schoolId,
      districtId: event.districtId,
      sensitivity: event.metadata?.sensitivity,
    }));
}

