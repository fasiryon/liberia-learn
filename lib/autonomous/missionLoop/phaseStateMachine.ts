import type { MissionStatus, PhaseStatus } from "@/lib/autonomous/missionLoop/types";

export class IllegalPhaseTransitionError extends Error {
  readonly from: PhaseStatus;
  readonly to: PhaseStatus;

  constructor(from: PhaseStatus, to: PhaseStatus) {
    super(`Illegal phase transition: ${from} -> ${to}`);
    this.name = "IllegalPhaseTransitionError";
    this.from = from;
    this.to = to;
  }
}

const LEGAL_TRANSITIONS: Record<PhaseStatus, PhaseStatus[]> = {
  NOT_STARTED: ["IN_PROGRESS"],
  IN_PROGRESS: ["BLOCKED", "VERIFYING", "FAILED"],
  BLOCKED: ["IN_PROGRESS", "FAILED"],
  VERIFYING: ["COMPLETE", "IN_PROGRESS", "FAILED"],
  COMPLETE: [],
  FAILED: [],
};

export function assertLegalPhaseTransition(from: PhaseStatus, to: PhaseStatus): void {
  if (!LEGAL_TRANSITIONS[from].includes(to)) {
    throw new IllegalPhaseTransitionError(from, to);
  }
}

export function deriveMissionStatus(phaseStatuses: PhaseStatus[]): MissionStatus {
  if (phaseStatuses.length === 0) return "NOT_STARTED";
  if (phaseStatuses.every((status) => status === "COMPLETE")) return "COMPLETE";
  if (phaseStatuses.some((status) => status === "FAILED")) return "FAILED";
  if (phaseStatuses.every((status) => status === "NOT_STARTED")) return "NOT_STARTED";
  return "IN_PROGRESS";
}
