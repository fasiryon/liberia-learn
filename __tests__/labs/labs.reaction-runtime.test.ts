import { describe, expect, it } from "vitest";
import {
  applyChemicalReactionAction,
  calculateReactionRate,
} from "@/lib/labs/chemical-reaction/runtime";
import { REACTION_INITIAL_STATE } from "@/lib/labs/chemical-reaction/state";

describe("chemical reaction runtime", () => {
  it("reaction rate increases with temperature", () => {
    const low = calculateReactionRate(25, 80, 80, false);
    const high = calculateReactionRate(200, 80, 80, false);
    expect(high).toBeGreaterThan(low);
  });

  it("catalyst reduces effective activation energy and increases rate", () => {
    const noCatalyst = calculateReactionRate(80, 80, 80, false);
    const catalyst = calculateReactionRate(80, 80, 80, true);
    expect(catalyst).toBeGreaterThan(noCatalyst);
  });

  it("reactants decrease and product increases when reaction runs", () => {
    const started = applyChemicalReactionAction(REACTION_INITIAL_STATE, { type: "START_REACTION" });
    const next = applyChemicalReactionAction(started, { type: "STEP" });
    expect(next.reactantA).toBeLessThan(started.reactantA);
    expect(next.reactantB).toBeLessThan(started.reactantB);
    expect(next.productC).toBeGreaterThan(started.productC);
  });

  it("exothermic reactions increase temperature during reaction", () => {
    const started = applyChemicalReactionAction(
      { ...REACTION_INITIAL_STATE, temperature: 100, energyType: "exothermic" },
      { type: "START_REACTION" }
    );
    const next = applyChemicalReactionAction(started, { type: "STEP" });
    expect(next.temperature).toBeGreaterThan(started.temperature);
  });

  it("endothermic reactions decrease temperature during reaction", () => {
    const started = applyChemicalReactionAction(
      { ...REACTION_INITIAL_STATE, temperature: 100, energyType: "endothermic" },
      { type: "START_REACTION" }
    );
    const next = applyChemicalReactionAction(started, { type: "STEP" });
    expect(next.temperature).toBeLessThan(started.temperature);
  });

  it("RESET returns exact REACTION_INITIAL_STATE", () => {
    expect(
      applyChemicalReactionAction(
        { ...REACTION_INITIAL_STATE, productC: 20, catalyst: true, reactionStarted: true },
        { type: "RESET" }
      )
    ).toEqual(REACTION_INITIAL_STATE);
  });

  it("consumed never exceeds available reactants", () => {
    const state = {
      ...REACTION_INITIAL_STATE,
      reactantA: 0.2,
      reactantB: 0.1,
      temperature: 500,
      catalyst: true,
      reactionStarted: true,
      paused: false,
    };
    const next = applyChemicalReactionAction(state, { type: "STEP" });
    const consumed = state.productC + (next.productC - state.productC);
    expect(next.reactantA).toBeGreaterThanOrEqual(0);
    expect(next.reactantB).toBeGreaterThanOrEqual(0);
    expect(consumed).toBeLessThanOrEqual(state.reactantA);
    expect(consumed).toBeLessThanOrEqual(state.reactantB);
  });
});
