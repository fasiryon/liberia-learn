export type CellDivisionStage =
  | "interphase"
  | "prophase"
  | "metaphase"
  | "anaphase"
  | "telophase"
  | "cytokinesis";

export type CellDivisionState = {
  stage: CellDivisionStage;
  chromosomeCount: number;
  cellCount: number;
  progress: number;
  speed: number;
  paused: boolean;
};

export const CELL_DIVISION_INITIAL_STATE: CellDivisionState = {
  stage: "interphase",
  chromosomeCount: 46,
  cellCount: 1,
  progress: 0,
  speed: 2,
  paused: true,
};

export const CELL_DIVISION_STAGE_SEQUENCE: CellDivisionStage[] = [
  "interphase",
  "prophase",
  "metaphase",
  "anaphase",
  "telophase",
  "cytokinesis",
];
