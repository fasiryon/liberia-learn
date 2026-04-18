import { describe, expect, it } from "vitest";
import { applyElectricCircuitAction } from "@/lib/labs/electric-circuit/runtime";
import { CIRCUIT_INITIAL_STATE } from "@/lib/labs/electric-circuit/state";

describe("electric circuit runtime", () => {
  it("calculates series total resistance as R1 + R2", () => {
    const state = applyElectricCircuitAction(CIRCUIT_INITIAL_STATE, {
      type: "SET_RESISTANCE1",
      value: 150,
    });
    expect(state.totalResistance).toBe(350);
  });

  it("calculates parallel total resistance as product over sum", () => {
    const state = applyElectricCircuitAction(CIRCUIT_INITIAL_STATE, {
      type: "SET_CIRCUIT_TYPE",
      value: "parallel",
    });
    expect(state.totalResistance).toBeCloseTo((100 * 200) / (100 + 200));
  });

  it("calculates current as voltage divided by total resistance", () => {
    const state = applyElectricCircuitAction(CIRCUIT_INITIAL_STATE, {
      type: "SET_VOLTAGE",
      value: 12,
    });
    expect(state.current).toBeCloseTo(12 / 300);
  });

  it("calculates power as voltage times current", () => {
    const state = applyElectricCircuitAction(CIRCUIT_INITIAL_STATE, {
      type: "SET_VOLTAGE",
      value: 12,
    });
    expect(state.power).toBeCloseTo(state.voltage * state.current);
  });

  it("SET_VOLTAGE clamps at 0 and 24", () => {
    expect(applyElectricCircuitAction(CIRCUIT_INITIAL_STATE, { type: "SET_VOLTAGE", value: -1 }).voltage).toBe(0);
    expect(applyElectricCircuitAction(CIRCUIT_INITIAL_STATE, { type: "SET_VOLTAGE", value: 25 }).voltage).toBe(24);
  });

  it("SET_RESISTANCE1 clamps at 1 and 1000", () => {
    expect(applyElectricCircuitAction(CIRCUIT_INITIAL_STATE, { type: "SET_RESISTANCE1", value: 0 }).resistance1).toBe(1);
    expect(applyElectricCircuitAction(CIRCUIT_INITIAL_STATE, { type: "SET_RESISTANCE1", value: 1200 }).resistance1).toBe(1000);
  });

  it("SET_RESISTANCE2 clamps at 1 and 1000", () => {
    expect(applyElectricCircuitAction(CIRCUIT_INITIAL_STATE, { type: "SET_RESISTANCE2", value: 0 }).resistance2).toBe(1);
    expect(applyElectricCircuitAction(CIRCUIT_INITIAL_STATE, { type: "SET_RESISTANCE2", value: 1200 }).resistance2).toBe(1000);
  });

  it("RESET returns exact CIRCUIT_INITIAL_STATE", () => {
    expect(
      applyElectricCircuitAction(
        { ...CIRCUIT_INITIAL_STATE, voltage: 24, circuitType: "parallel" },
        { type: "RESET" }
      )
    ).toEqual(CIRCUIT_INITIAL_STATE);
  });
});
