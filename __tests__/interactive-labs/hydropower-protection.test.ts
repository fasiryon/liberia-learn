// Founder decision 2026-10-02: Mount Coffee overload protection trips are LATCHED. An overload trips the plant; the
// learner keeps every choice and may still change loads and units, but power returns only after an explicit
// Reset plant, which the engine accepts only once demand fits available generation and a unit is generating.
import { describe, expect, it } from "vitest";
import { hydropowerDefinition } from "@/lib/interactive-labs/v2/definitions/hydropower";
import { deriveSimulation, isValidFidelityState, protectionStatus } from "@/lib/interactive-labs/v2/fidelity/engine";
import { classifyLabAction, isEvidenceBearingAction, validateHighFidelityDefinition } from "@/lib/interactive-labs/v2/fidelity/boundary";
import { acceptLabAction, initializeLab } from "@/lib/interactive-labs/v2/kernel";
import type { LabAction, LabState } from "@/lib/interactive-labs/v2/types";
import { controlSelected } from "@/lib/interactive-labs/v2/fidelity/controls";
import { HYDROPOWER_REVIEW_SCENARIOS } from "@/lib/interactive-labs/v2/review/referenceScenarios";
import { replayReviewScenario } from "@/lib/interactive-labs/v2/review/scenarios";

const spec = hydropowerDefinition.fidelity!;
const set = (variableId: string, value: number): LabAction => ({ type: "set-variable", variableId, value });
const RESET: LabAction = { type: "reset-protection" };
const step = (state: LabState, action: LabAction) => acceptLabAction(hydropowerDefinition, state, action);
const play = (actions: LabAction[], from: LabState = initializeLab(hydropowerDefinition)): LabState => actions.reduce((state, action) => {
  const result = step(state, action);
  if ("reason" in result) throw new Error(`${action.type}: ${result.reason}`);
  return result.state;
}, from);
const q = (state: LabState) => deriveSimulation(spec, state.fidelity!).quantities;
const status = (state: LabState) => protectionStatus(spec, state.fidelity!)!;
const lit = (state: LabState) => { const cs = deriveSimulation(spec, state.fidelity!).componentStates; return Object.keys(cs).filter((id) => id.startsWith("city-") && cs[id].intensity === 1); };

// Rainy season, three units (66 MW), every feeder on (68 MW): the overload beat.
const OVERLOAD = [set("unitsOnline", 3)];

describe("Mount Coffee latched trip and Reset plant", () => {
  it("the definition declares the protection and passes the authoring gate", () => {
    expect(spec.protection).toMatchObject({ latchVariableId: "protectionLatched", overloadQuantityId: "overload", resetLabel: "Reset plant" });
    expect(validateHighFidelityDefinition(hydropowerDefinition)).toEqual([]);
    expect(spec.variables.find((variable) => variable.id === "protectionLatched")).toMatchObject({ learnerControlled: false, initial: 0 });
  });

  it("normal operation: load and unit changes apply immediately with no reset", () => {
    const state = play([set("homesBlocks", 3), set("unitsOnline", 3)]);
    expect(q(state)).toMatchObject({ demandMW: 56, outputMW: 66, tripped: 0, protectionLatched: 0, suppliedMW: 56 });
    expect(status(state).latched).toBe(false);
  });

  it("overload trips: generation delivered falls to zero, the city goes dark, the trip is latched", () => {
    const state = play(OVERLOAD);
    expect(q(state)).toMatchObject({ overload: 1, tripped: 1, protectionLatched: 1, suppliedMW: 0, turbineFlow: 0, unitsGenerating: 0 });
    expect(lit(state)).toEqual([]);
    expect(state.fidelity!.variables.protectionLatched).toBe(1);
  });

  it("the trip keeps every learner choice", () => {
    const state = play(OVERLOAD);
    expect(state.fidelity!.variables).toMatchObject({ riverFlow: 430, unitsOnline: 3, feederHospital: 1, homesBlocks: 4, shopsBlocks: 4 });
  });

  it("power stays off after the load is reduced: no automatic recovery", () => {
    let state = play(OVERLOAD);
    for (const value of [3, 2, 1, 0]) {
      state = play([set("shopsBlocks", value)], state);
      expect(q(state)).toMatchObject({ overload: 0, tripped: 1, suppliedMW: 0 });
      expect(lit(state)).toEqual([]);
    }
    // Even switching every feeder off and back on, or idling through other actions, never clears the latch.
    state = play([set("feederHospital", 0), set("homesBlocks", 0), set("feederHospital", 1), { type: "camera-preset", presetId: "valley" }, { type: "toggle-labels" }], state);
    expect(q(state)).toMatchObject({ tripped: 1, protectionLatched: 1 });
  });

  it("unit changes while tripped are allowed and do not restore power", () => {
    let state = play(OVERLOAD);
    state = play([set("unitsOnline", 4)], state);
    expect(q(state)).toMatchObject({ outputMW: 88, demandMW: 68, overload: 0, tripped: 1, suppliedMW: 0 });
    state = play([set("unitsOnline", 0), set("unitsOnline", 2)], state);
    expect(q(state)).toMatchObject({ tripped: 1, unitsOnline: 2 });
  });

  it("load changes while tripped are allowed, including making the overload worse", () => {
    const state = play([...OVERLOAD, set("shopsBlocks", 0), set("shopsBlocks", 4), set("homesBlocks", 2)]);
    expect(state.fidelity!.variables).toMatchObject({ shopsBlocks: 4, homesBlocks: 2 });
    expect(q(state).tripped).toBe(1);
  });

  it("reset is blocked while still overloaded, and the reason names the exact shortfall", () => {
    const tripped = play(OVERLOAD);
    expect(status(tripped)).toEqual({ latched: true, blocker: "Reset unavailable: demand is still 2 MW above available generation.", resetLabel: "Reset plant" });
    const result = step(tripped, RESET);
    expect(result).toMatchObject({ reason: "protection_reset_blocked" });
    // Dry season, whole city: 68 − 10.03 MW.
    const dry = play([set("riverFlow", 49)]);
    expect(status(dry).blocker).toBe("Reset unavailable: demand is still 58 MW above available generation.");
  });

  it("reset is blocked when no unit is making power, even with no demand", () => {
    const state = play([set("unitsOnline", 0), set("feederHospital", 0), set("homesBlocks", 0), set("shopsBlocks", 0)]);
    expect(q(state)).toMatchObject({ overload: 0, tripped: 1, outputMW: 0 });
    expect(status(state).blocker).toBe("Reset unavailable: no unit is making power. Bring at least one unit online.");
    expect(step(state, RESET)).toMatchObject({ reason: "protection_reset_blocked" });
  });

  it("reset succeeds only once demand fits, then restores generation and supply", () => {
    const corrected = play([...OVERLOAD, set("shopsBlocks", 3)]);
    expect(status(corrected).blocker).toBeNull();
    const reset = play([RESET], corrected);
    expect(q(reset)).toMatchObject({ overload: 0, tripped: 0, protectionLatched: 0, suppliedMW: 64, turbineFlow: 322.5, unitsGenerating: 3 });
    expect(lit(reset)).toHaveLength(1 + 4 + 3);
    expect(protectionStatus(spec, reset.fidelity!)).toMatchObject({ latched: false, blocker: null });
  });

  it("reset is rejected when nothing is tripped; the latch cannot be set or cleared through set-variable", () => {
    expect(step(initializeLab(hydropowerDefinition), RESET)).toMatchObject({ reason: "protection_not_tripped" });
    expect(step(play(OVERLOAD), set("protectionLatched", 0))).toMatchObject({ reason: "variable_not_learner_controlled" });
    expect(step(initializeLab(hydropowerDefinition), set("protectionLatched", 1))).toMatchObject({ reason: "variable_not_learner_controlled" });
  });

  it("an overload after a reset trips again (the reset is not a bypass)", () => {
    const state = play([...OVERLOAD, set("shopsBlocks", 3), RESET, set("shopsBlocks", 4)]);
    expect(q(state)).toMatchObject({ tripped: 1, protectionLatched: 1 });
  });

  it("taking unit 3 apart under load trips the plant like any other loss of generation", () => {
    const state = play([{ type: "clear-assembly", assemblyId: "unit-3" }]);
    expect(q(state)).toMatchObject({ unit3Ready: 0, outputMW: 66, demandMW: 68, tripped: 1, protectionLatched: 1 });
  });

  it("challenge: starts untripped even from a tripped explore state, and is met only after correct + reset", () => {
    const fromTripped = play([...OVERLOAD, { type: "mode", mode: "CHALLENGE" }]);
    expect(q(fromTripped)).toMatchObject({ riverFlow: 49, demandMW: 4, tripped: 0, protectionLatched: 0, gridStableWithPriority: 0 });
    const tripped = play([set("shopsBlocks", 2)], fromTripped);
    expect(spec.challengeStatus!(q(tripped))).toBe("Tripped: work out which change was too much, put it right, then reset the plant.");
    const corrected = play([set("shopsBlocks", 1)], tripped);
    expect(q(corrected)).toMatchObject({ overload: 0, tripped: 1, gridStableWithPriority: 0, maxLoadServed: 0 });
    const solved = play([RESET], corrected);
    expect(q(solved)).toMatchObject({ tripped: 0, gridStableWithPriority: 1 });
  });

  it("assessment: starts untripped; dry-season-peak fails while tripped and passes after the reset", () => {
    const assessment = play([...OVERLOAD, { type: "mode", mode: "ASSESSMENT" }]);
    expect(q(assessment)).toMatchObject({ tripped: 0, protectionLatched: 0, demandMW: 68, outputMW: 88 });
    const corrected = play([set("riverFlow", 49), set("homesBlocks", 0), set("shopsBlocks", 1)], assessment);
    const failed = play([{ type: "check", checkId: "dry-season-peak", response: {} }], corrected);
    expect(failed.completedChecks).not.toContain("dry-season-peak");
    expect(failed.lastFeedback).toBe("incorrect");
    const passed = play([RESET, { type: "check", checkId: "dry-season-peak", response: {} }], failed);
    expect(passed.completedChecks).toContain("dry-season-peak");
  });

  it("the explanation leads with the trip diagnosis, then safety, while tripped", () => {
    const lines = (state: LabState) => deriveSimulation(spec, state.fidelity!).explanation.map((line) => line.id);
    expect(lines(play(OVERLOAD)).slice(0, 3)).toEqual(["plant-tripped", "safety-limits", "trip-overload"]);
    expect(lines(play([...OVERLOAD, set("shopsBlocks", 3)])).slice(0, 3)).toEqual(["plant-tripped", "safety-limits", "trip-latched"]);
    expect(lines(play([set("riverFlow", 557)]))[0]).toBe("safety-limits");
  });

  it("is deterministic: the same actions always give the same state and quantities", () => {
    const actions = [...OVERLOAD, set("unitsOnline", 4), set("shopsBlocks", 2), RESET, set("riverFlow", 176)];
    const a = play(actions), b = play(actions);
    expect(a).toEqual(b);
    expect(q(a)).toEqual(q(b));
  });

  it("the lab Reset returns to the untripped initial state", () => {
    const state = play([...OVERLOAD, { type: "reset" }]);
    expect(state.fidelity!.variables.protectionLatched).toBe(0);
    expect(q(state).tripped).toBe(0);
  });

  it("checkpoint validation rejects an overload with the latch cleared, and accepts a latched trip", () => {
    const tripped = play(OVERLOAD).fidelity!;
    expect(isValidFidelityState(spec, tripped)).toBe(true);
    expect(isValidFidelityState(spec, { ...tripped, variables: { ...tripped.variables, protectionLatched: 0 } })).toBe(false);
  });

  it("no evidence or mastery authority: reset is a raw observation, never a learning check", () => {
    expect(classifyLabAction(RESET)).toBe("RAW_OBSERVATION");
    expect(isEvidenceBearingAction(RESET)).toBe(false);
    const state = play([...OVERLOAD, set("shopsBlocks", 3), RESET]);
    expect(state.completedChecks).toEqual([]);
  });
});

describe("Mount Coffee R3 interaction and fixture fixes", () => {
  const guided = (id: string) => spec.guidedPath.findIndex((step) => step.id === id);

  it("guided steps start in their intended, untripped state even after a trip", () => {
    const tripped = play([set("riverFlow", 49)]);
    expect(q(tripped).tripped).toBe(1);
    const season = play([{ type: "guided-step", index: guided("season") }], tripped);
    expect(q(season)).toMatchObject({ tripped: 0, protectionLatched: 0, demandMW: 8 });
    // The season step can now go dry without a trip: 8 MW fits about 10 MW.
    expect(q(play([set("riverFlow", 49)], season)).tripped).toBe(0);
    const overload = play([{ type: "guided-step", index: guided("overload") }], tripped);
    expect(q(overload)).toMatchObject({ tripped: 0, outputMW: 66, demandMW: 52, unitsOnline: 3 });
    const repair = play([{ type: "guided-step", index: guided("repair") }, { type: "clear-assembly", assemblyId: "unit-3" }], tripped);
    expect(q(repair)).toMatchObject({ unit3Ready: 0, outputMW: 66, demandMW: 60, tripped: 0 });
    for (const step of spec.guidedPath) expect(Object.keys(step.variables ?? {}).every((id) => id !== "protectionLatched")).toBe(true);
  });

  it("the authoring gate rejects a guided-step variable that is not learner controlled or off its grid", () => {
    const bad = { ...hydropowerDefinition, fidelity: { ...spec, guidedPath: [{ id: "x", prompt: "p", variables: { protectionLatched: 1, riverFlow: 50 } }] } };
    expect(validateHighFidelityDefinition(bad)).toEqual(expect.arrayContaining(["guided_step_variable_invalid:x:protectionLatched", "guided_step_variable_invalid:x:riverFlow"]));
  });

  it("the hospital breaker chip reports its on state", () => {
    const hospital = spec.components.find((component) => component.id === "breaker-hospital")!.control!;
    expect(controlSelected(initializeLab(hydropowerDefinition).fidelity!, hospital)).toBe(true);
    expect(controlSelected(play([set("feederHospital", 0)]).fidelity!, hospital)).toBe(false);
  });

  it("with no unit running, the reset blocker names the missing units first", () => {
    expect(status(play([set("unitsOnline", 0)])).blocker).toBe("Reset unavailable: no unit is making power. Bring at least one unit online.");
  });

  it("S2 fixture: unit 1 generates and the water goes through the turbine, not over the spillway", () => {
    const replay = replayReviewScenario(hydropowerDefinition, HYDROPOWER_REVIEW_SCENARIOS.scenarios.find((scenario) => scenario.id === "hydro-process-water-starts")!);
    if ("reason" in replay) throw new Error(replay.reason);
    expect(q(replay.state)).toMatchObject({ tripped: 0, u1Generating: 1, u1Flow: 107.5, spillFlow: 322.5 });
  });

  it("S3 and S6 fault fixtures carry their own guided step", () => {
    for (const [id, step] of [["hydro-cutaway-powerhouse", "machine"], ["hydro-exploded-unit", "machine"], ["hydro-fault-overload-trip", "overload"], ["hydro-fault-zero-units-dark", "overload"], ["hydro-fault-shed-not-reset", "overload"]] as const) {
      const replay = replayReviewScenario(hydropowerDefinition, HYDROPOWER_REVIEW_SCENARIOS.scenarios.find((scenario) => scenario.id === id)!);
      if ("reason" in replay) throw new Error(replay.reason);
      expect(replay.state.fidelity!.guidedStepIndex, id).toBe(guided(step));
    }
  });
});
