import { describe, expect, it } from "vitest";
import { applyPeriodicTableAction } from "@/lib/labs/periodic-table/runtime";
import { PERIODIC_TABLE_INITIAL_STATE } from "@/lib/labs/periodic-table/state";

describe("periodic table runtime", () => {
  it("SELECT_ELEMENT with invalid symbol returns state unchanged", () => {
    const state = applyPeriodicTableAction(PERIODIC_TABLE_INITIAL_STATE, {
      type: "SELECT_ELEMENT",
      symbol: "Xx",
    });
    expect(state).toBe(PERIODIC_TABLE_INITIAL_STATE);
  });

  it("CLEAR_SELECTION sets selectedElement to null", () => {
    const state = applyPeriodicTableAction(
      { ...PERIODIC_TABLE_INITIAL_STATE, selectedElement: "C" },
      { type: "CLEAR_SELECTION" }
    );
    expect(state.selectedElement).toBeNull();
  });

  it("SET_VIEW_MODE accepts only valid modes", () => {
    const bohr = applyPeriodicTableAction(PERIODIC_TABLE_INITIAL_STATE, {
      type: "SET_VIEW_MODE",
      value: "bohr",
    });
    expect(bohr.viewMode).toBe("bohr");
    const unchanged = applyPeriodicTableAction(bohr, {
      type: "SET_VIEW_MODE",
      value: "invalid" as any,
    });
    expect(unchanged).toBe(bohr);
  });

  it("RESET returns exact initial state", () => {
    expect(
      applyPeriodicTableAction(
        {
          ...PERIODIC_TABLE_INITIAL_STATE,
          selectedElement: "Au",
          viewMode: "properties",
          highlightProperty: "electronegativity",
        },
        { type: "RESET" }
      )
    ).toEqual(PERIODIC_TABLE_INITIAL_STATE);
  });
});
