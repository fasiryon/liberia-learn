import { describe, expect, it } from "vitest";
import { applyCellDivisionAction } from "@/lib/labs/cell-division/runtime";
import { CELL_DIVISION_INITIAL_STATE } from "@/lib/labs/cell-division/state";

describe("cell division runtime", () => {
  it("ADVANCE_STAGE moves through the sequence correctly", () => {
    let state = CELL_DIVISION_INITIAL_STATE;
    state = applyCellDivisionAction(state, { type: "ADVANCE_STAGE" });
    expect(state.stage).toBe("prophase");
    state = applyCellDivisionAction(state, { type: "ADVANCE_STAGE" });
    expect(state.stage).toBe("metaphase");
    state = applyCellDivisionAction(state, { type: "ADVANCE_STAGE" });
    expect(state.stage).toBe("anaphase");
    state = applyCellDivisionAction(state, { type: "ADVANCE_STAGE" });
    expect(state.stage).toBe("telophase");
    state = applyCellDivisionAction(state, { type: "ADVANCE_STAGE" });
    expect(state.stage).toBe("cytokinesis");
  });

  it("chromosomeCount doubles in anaphase", () => {
    let state = CELL_DIVISION_INITIAL_STATE;
    state = applyCellDivisionAction(state, { type: "ADVANCE_STAGE" });
    state = applyCellDivisionAction(state, { type: "ADVANCE_STAGE" });
    state = applyCellDivisionAction(state, { type: "ADVANCE_STAGE" });
    expect(state.stage).toBe("anaphase");
    expect(state.chromosomeCount).toBe(92);
  });

  it("cellCount doubles after cytokinesis", () => {
    let state = CELL_DIVISION_INITIAL_STATE;
    for (let index = 0; index < 6; index += 1) {
      state = applyCellDivisionAction(state, { type: "ADVANCE_STAGE" });
    }
    expect(state.stage).toBe("interphase");
    expect(state.cellCount).toBe(2);
  });

  it("progress auto-advances stage at 100", () => {
    const state = applyCellDivisionAction(
      { ...CELL_DIVISION_INITIAL_STATE, progress: 99, speed: 5 },
      { type: "STEP", dt: 1 }
    );
    expect(state.stage).toBe("prophase");
    expect(state.progress).toBe(0);
  });

  it("RESET returns exact initial state", () => {
    expect(
      applyCellDivisionAction(
        { ...CELL_DIVISION_INITIAL_STATE, stage: "anaphase", chromosomeCount: 92 },
        { type: "RESET" }
      )
    ).toEqual(CELL_DIVISION_INITIAL_STATE);
  });

  it("SET_SPEED clamps at 1 and 5", () => {
    expect(applyCellDivisionAction(CELL_DIVISION_INITIAL_STATE, { type: "SET_SPEED", value: 0 }).speed).toBe(1);
    expect(applyCellDivisionAction(CELL_DIVISION_INITIAL_STATE, { type: "SET_SPEED", value: 6 }).speed).toBe(5);
  });
});
