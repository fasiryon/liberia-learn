import { logAudit } from "@/lib/audit";
import { logLearningEvent } from "@/lib/events/logLearningEvent";
import { isAutonomousMemoryEnabled } from "@/lib/serverFlags";
import { compressMemorySummary } from "@/lib/autonomous/memory/memoryCompressionService";
import { scoreMemoryConfidence } from "@/lib/autonomous/memory/memoryConfidenceService";
import { retentionExpiresAt } from "@/lib/autonomous/memory/memoryRetentionService";
import { validateMemoryGovernance } from "@/lib/autonomous/memory/memoryGovernanceService";
import type { OperationalMemoryInput } from "@/lib/autonomous/memory/types";

export async function recordOperationalMemory(input: OperationalMemoryInput) {
  if (!isAutonomousMemoryEnabled()) {
    throw Object.assign(new Error("Autonomous memory is disabled"), { status: 404, code: "autonomous_memory_disabled" });
  }
  const governance = validateMemoryGovernance(input);
  if (!governance.allowed) throw Object.assign(new Error("Memory governance blocked write"), { status: 403, code: governance.reason });
  const summary = compressMemorySummary(input.summary);
  const confidence = scoreMemoryConfidence({ evidenceRefs: input.evidenceRefs, lineage: input.lineage, baseConfidence: input.confidence });
  const expiresAt = retentionExpiresAt({ scope: input.scope, retentionDays: input.retentionDays });
  const metadata = {
    memoryType: input.memoryType,
    scope: input.scope,
    summary,
    evidenceRefs: input.evidenceRefs,
    lineage: input.lineage,
    confidence,
    sensitivity: input.sensitivity ?? (input.scope === "district" || input.scope === "national" ? "aggregate" : "tenant"),
    redactionStatus: "redacted",
    governanceVersion: "memory-governance-v1",
    retention: { expiresAt: expiresAt.toISOString(), retentionDays: input.retentionDays ?? null },
  };
  const event = await logLearningEvent(
    {
      schoolId: input.scope === "district" || input.scope === "national" ? null : input.schoolId ?? null,
      districtId: input.districtId ?? null,
      actor: { type: "system", id: "operationalMemoryService" },
      target: { type: input.targetType ?? input.scope, id: input.targetId ?? input.districtId ?? input.schoolId ?? input.scope },
      eventType: "autonomous.memory.recorded",
      source: "autonomous.memory",
      status: "recorded",
      metadata,
    },
    { throwOnError: true }
  );
  await logAudit({
    userId: input.actorId ?? null,
    action: "autonomous.memory.recorded",
    resourceType: "LearningEvent",
    resourceId: (event as any)?.id ?? null,
    schoolId: input.scope === "district" || input.scope === "national" ? null : input.schoolId ?? null,
    details: { memoryType: input.memoryType, scope: input.scope, confidence },
  });
  return event;
}

