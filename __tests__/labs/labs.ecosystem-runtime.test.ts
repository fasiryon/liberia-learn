import { describe, expect, it } from "vitest";
import { applyEcosystemBalanceAction } from "@/lib/labs/ecosystem-balance/runtime";
import { ECOSYSTEM_INITIAL_STATE } from "@/lib/labs/ecosystem-balance/state";

describe("ecosystem balance runtime", () => {
  it("keeps all trophic levels alive after 200 STEP iterations", () => {
    let state = ECOSYSTEM_INITIAL_STATE;
    for (let index = 0; index < 200; index += 1) {
      state = applyEcosystemBalanceAction(state, { type: "STEP" });
    }

    expect(state.plantCount).toBeGreaterThan(0);
    expect(state.herbivoreCount).toBeGreaterThan(0);
    expect(state.carnivoreCount).toBeGreaterThan(0);
  });

  it("ADD_DROUGHT reduces effective plant growth", () => {
    const normal = applyEcosystemBalanceAction(ECOSYSTEM_INITIAL_STATE, { type: "STEP" });
    const drought = applyEcosystemBalanceAction(
      applyEcosystemBalanceAction(ECOSYSTEM_INITIAL_STATE, { type: "ADD_DROUGHT" }),
      { type: "STEP" }
    );

    expect(drought.plantCount).toBeLessThan(normal.plantCount);
  });

  it("SET_PLANTS clamps at 0 and 1000", () => {
    expect(applyEcosystemBalanceAction(ECOSYSTEM_INITIAL_STATE, { type: "SET_PLANTS", value: -1 }).plantCount).toBe(0);
    expect(applyEcosystemBalanceAction(ECOSYSTEM_INITIAL_STATE, { type: "SET_PLANTS", value: 1200 }).plantCount).toBe(1000);
  });

  it("SET_HERBIVORES clamps at 0 and 500", () => {
    expect(applyEcosystemBalanceAction(ECOSYSTEM_INITIAL_STATE, { type: "SET_HERBIVORES", value: -1 }).herbivoreCount).toBe(0);
    expect(applyEcosystemBalanceAction(ECOSYSTEM_INITIAL_STATE, { type: "SET_HERBIVORES", value: 600 }).herbivoreCount).toBe(500);
  });

  it("SET_CARNIVORES clamps at 0 and 200", () => {
    expect(applyEcosystemBalanceAction(ECOSYSTEM_INITIAL_STATE, { type: "SET_CARNIVORES", value: -1 }).carnivoreCount).toBe(0);
    expect(applyEcosystemBalanceAction(ECOSYSTEM_INITIAL_STATE, { type: "SET_CARNIVORES", value: 300 }).carnivoreCount).toBe(200);
  });

  it("history grows correctly and caps at 100 entries", () => {
    let state = ECOSYSTEM_INITIAL_STATE;
    for (let index = 0; index < 120; index += 1) {
      state = applyEcosystemBalanceAction(state, { type: "STEP" });
    }

    expect(state.history).toHaveLength(100);
    expect(state.history[99].plants).toBe(state.plantCount);
  });

  it("RESET returns exact initial state", () => {
    const changed = applyEcosystemBalanceAction(ECOSYSTEM_INITIAL_STATE, { type: "STEP" });
    expect(applyEcosystemBalanceAction(changed, { type: "RESET" })).toEqual(ECOSYSTEM_INITIAL_STATE);
  });
});
