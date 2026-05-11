import type { DetectionFinding, DetectorSignal } from "@/lib/autonomous/detectors/types";

function signalTriggered(signal: DetectorSignal) {
  if (signal.direction === "below") return signal.value < signal.threshold;
  if (signal.direction === "above") return signal.value > signal.threshold;
  if (signal.direction === "decline") return signal.value <= -Math.abs(signal.threshold);
  if (signal.direction === "increase") return signal.value >= Math.abs(signal.threshold);
  return signal.value === signal.threshold;
}

export function scoreDetectorSignals(signals: DetectorSignal[]) {
  const totalWeight = signals.reduce((sum, signal) => sum + Math.max(0, signal.weight), 0);
  if (totalWeight <= 0) return { confidence: 0, triggeredSignals: [] as DetectorSignal[] };

  const triggeredSignals = signals.filter(signalTriggered);
  const triggeredWeight = triggeredSignals.reduce((sum, signal) => sum + Math.max(0, signal.weight), 0);
  const evidenceCoverage =
    triggeredSignals.length === 0
      ? 0
      : triggeredSignals.filter((signal) => signal.evidence.length > 0).length / triggeredSignals.length;
  const confidence = Math.min(0.99, Math.max(0, (triggeredWeight / totalWeight) * (0.75 + evidenceCoverage * 0.25)));
  return { confidence: Number(confidence.toFixed(2)), triggeredSignals };
}

export function severityFromConfidence(confidence: number): DetectionFinding["severity"] {
  if (confidence >= 0.85) return "high";
  if (confidence >= 0.65) return "medium";
  if (confidence >= 0.45) return "low";
  return "info";
}

export function confidenceBand(confidence: number) {
  if (confidence >= 0.85) return "high";
  if (confidence >= 0.65) return "medium";
  if (confidence >= 0.45) return "low";
  return "insufficient";
}
