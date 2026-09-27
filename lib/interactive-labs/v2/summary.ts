import type { LabSessionCheckpoint, LearningCheck } from "./types";
export type TeacherLabSummary = { labId: string; labVersion: string; status: "IN_PROGRESS" | "COMPLETED"; checksAttempted: number; checksCompleted: number; retries: number; hints: number; misconceptionSignals: string[]; meaningfulManipulations: string[] };
export function buildTeacherSummary(checks: readonly LearningCheck[], checkpoint: LabSessionCheckpoint): TeacherLabSummary {
  const completed = new Set(checkpoint.completedChecks);
  return { labId: checkpoint.labId, labVersion: checkpoint.labVersion, status: checkpoint.mode === "COMPLETE" ? "COMPLETED" : "IN_PROGRESS", checksAttempted: completed.size + checkpoint.retries, checksCompleted: completed.size, retries: checkpoint.retries, hints: checkpoint.hints, misconceptionSignals: checkpoint.retries > 0 ? ["retry-before-correct-response"] : [], meaningfulManipulations: Object.entries(checkpoint.state.rotations).filter(([, rotation]) => rotation.some((value) => Math.abs(value) > .05)).map(([id]) => `rotated:${id}`) };
}
