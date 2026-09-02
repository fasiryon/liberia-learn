import type { QualityReport } from "@/lib/experiments/qualityOperations";

export function deriveQualityStopSignal(quality: QualityReport): { shouldStop: boolean; reason: "quality_stopped" | "quality_invalid" | null } {
  if (quality.state === "STOPPED") return { shouldStop: true, reason: "quality_stopped" };
  if (quality.state === "INVALID") return { shouldStop: true, reason: "quality_invalid" };
  return { shouldStop: false, reason: null };
}
