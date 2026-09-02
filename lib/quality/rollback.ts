import type { ReleaseGateResult } from "@/lib/quality/releaseGate";

export type RollbackCandidate = { gateId: string; version: number; recommendedAt: string; reasons: string[]; requiresHumanAuthorization: true };

export function evaluateRollbackCandidate(gateResult: ReleaseGateResult, now: string): RollbackCandidate | null {
  if (!gateResult.rollbackRecommended) return null;
  return { gateId: gateResult.gateId, version: gateResult.version, recommendedAt: now, reasons: [...gateResult.reasons], requiresHumanAuthorization: true };
}
