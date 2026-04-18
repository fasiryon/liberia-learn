import type { CellDivisionAction } from "@/lib/labs/cell-division/actions";
import {
  CELL_DIVISION_INITIAL_STATE,
  CELL_DIVISION_STAGE_SEQUENCE,
  type CellDivisionStage,
  type CellDivisionState,
} from "@/lib/labs/cell-division/state";

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function chromosomeCountForStage(stage: CellDivisionStage): number {
  return stage === "anaphase" ? 92 : 46;
}

function normalizeState(state: CellDivisionState): CellDivisionState {
  const stage = CELL_DIVISION_STAGE_SEQUENCE.includes(state.stage)
    ? state.stage
    : CELL_DIVISION_INITIAL_STATE.stage;
  return {
    stage,
    chromosomeCount: chromosomeCountForStage(stage),
    cellCount: Math.max(1, Math.floor(Number.isFinite(state.cellCount) ? state.cellCount : 1)),
    progress: clamp(state.progress, 0, 100),
    speed: clamp(state.speed, 1, 5),
    paused: Boolean(state.paused),
  };
}

function advanceStage(state: CellDivisionState): CellDivisionState {
  const current = normalizeState(state);
  const currentIndex = CELL_DIVISION_STAGE_SEQUENCE.indexOf(current.stage);
  const nextStage =
    CELL_DIVISION_STAGE_SEQUENCE[(currentIndex + 1) % CELL_DIVISION_STAGE_SEQUENCE.length];
  const nextCellCount =
    current.stage === "cytokinesis" && nextStage === "interphase"
      ? current.cellCount * 2
      : current.cellCount;

  return {
    ...current,
    stage: nextStage,
    chromosomeCount: chromosomeCountForStage(nextStage),
    cellCount: nextCellCount,
    progress: 0,
  };
}

export function applyCellDivisionAction(
  state: CellDivisionState,
  action: CellDivisionAction
): CellDivisionState {
  const current = normalizeState(state);

  switch (action.type) {
    case "ADVANCE_STAGE":
      return advanceStage(current);
    case "SET_SPEED":
      return { ...current, speed: clamp(action.value, 1, 5) };
    case "PLAY":
      return { ...current, paused: false };
    case "PAUSE":
      return { ...current, paused: true };
    case "RESET":
      return { ...CELL_DIVISION_INITIAL_STATE };
    case "STEP": {
      const dt = clamp(action.dt ?? 0.05, 0.001, 1);
      const progress = current.progress + current.speed * dt * 10;
      if (progress >= 100) {
        return advanceStage({ ...current, progress: 100 });
      }
      return { ...current, progress };
    }
  }
}

export function isCellDivisionState(value: unknown): value is CellDivisionState {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<CellDivisionState>;
  return (
    typeof state.stage === "string" &&
    CELL_DIVISION_STAGE_SEQUENCE.includes(state.stage as CellDivisionStage) &&
    typeof state.chromosomeCount === "number" &&
    typeof state.cellCount === "number" &&
    typeof state.progress === "number" &&
    typeof state.speed === "number" &&
    typeof state.paused === "boolean"
  );
}
