// Executable form of docs/labs/mount-coffee-hydropower/design/03-SIMULATION_SPEC.md as amended by
// 06-V1_1_SIMULATION_DELTA.md (feeder blocks, fixtures V01–V17, water quantities, properties over 2,500 states).
import { describe, expect, it } from "vitest";
import { EFFICIENCY, hydropowerModel, RIVER_FLOW_STEPS } from "@/lib/interactive-labs/v2/definitions/hydropowerModel";

const I = { "unit-3": { "slot-runner": "u3-runner", "slot-shaft": "u3-shaft", "slot-generator": "u3-generator" } };
const E = { "unit-3": {} };
const W = { "unit-3": { "slot-runner": "u3-generator", "slot-shaft": "u3-shaft", "slot-generator": "u3-runner" } };
type Placements = Record<string, Record<string, string | null>>;
/** (Q, units, hospital, homes blocks, shops blocks) as in the 06 fixture notation. */
const run = (riverFlow: number, unitsOnline: number, feederHospital: number, homesBlocks: number, shopsBlocks: number, placements: Placements = I) =>
  hydropowerModel.evaluate({ variables: { riverFlow, unitsOnline, feederHospital, homesBlocks, shopsBlocks, protectionLatched: 0 }, placements });
const q = (out: ReturnType<typeof run>) => out.quantities;
const statuses = (out: ReturnType<typeof run>) => [1, 2, 3, 4].map((unit) => out.componentStates[`unit-${unit}`]?.status);
const blocks = (out: ReturnType<typeof run>, district: "homes" | "shops") => [1, 2, 3, 4].map((k) => out.componentStates[`city-${district}-b${k}`]?.intensity);
const cityLights = (out: ReturnType<typeof run>) => [out.componentStates["city-hospital"]?.intensity, ...blocks(out, "homes"), ...blocks(out, "shops")];
const gauge = (out: ReturnType<typeof run>) => [1, 2, 3, 4].map((k) => out.componentStates[`gauge-seg-${k}`]?.intensity);
const ids = (out: ReturnType<typeof run>) => out.explanation.map((line) => line.id);
const DRY = 10.027907;

describe("Mount Coffee hydropower model 1.2.0 (spec fixtures)", () => {
  it("η is the stated model assumption (≈0.903) and one unit at design flow makes 22 MW", () => {
    expect(EFFICIENCY).toBeCloseTo(0.903094566, 9);
    expect(q(run(430, 1, 1, 0, 0)).outputMW).toBe(22);
    expect(hydropowerModel.version).toBe("1.2.0");
  });

  it("V01 rainy, 4 units, every block on: 88 MW, 68 MW demand, 20 MW spare, whole city lit", () => {
    const out = run(430, 4, 1, 4, 4);
    expect(q(out)).toMatchObject({ outputMW: 88, demandMW: 68, headroomMW: 20, tripped: 0, suppliedMW: 68, turbineFlow: 430, spillFlow: 0, gridStableWithPriority: 0, unitsGenerating: 4, upstreamWidthFactor: 0.878631, downstreamWidthFactor: 0.878631, riverLanes: 4, tailraceLanes: 4, spillLanes: 0 });
    expect(statuses(out)).toEqual(["generating", "generating", "generating", "generating"]);
    expect(out.flows["power-line"].rate).toBe(0.772727);
    expect(gauge(out)).toEqual([1, 1, 1, 1]);
    expect(cityLights(out)).toEqual([1, 1, 1, 1, 1, 1, 1, 1, 1]);
    expect(out.explanation.find((line) => line.id === "demand")?.text).toContain("Hospital 4 MW; homes blocks 12 MW each; shops blocks 4 MW each");
  });

  it("V02 dry with every block on trips the whole city (not dimming); the headpond level is unchanged", () => {
    const out = run(49, 4, 1, 4, 4);
    expect(q(out)).toMatchObject({ outputMW: DRY, tripped: 1, suppliedMW: 0, turbineFlow: 0, spillFlow: 49, downstreamFlow: 49, headpondLevel: 1, headroomMW: -57.972093, riverLanes: 1, tailraceLanes: 0, spillLanes: 1 });
    expect(statuses(out)).toEqual(["tripped", "tripped", "tripped", "tripped"]);
    expect(gauge(out)).toEqual([0.455814, 0, 0, 0]);
    expect(cityLights(out).every((value) => value === 0)).toBe(true);
    expect(ids(out)).toEqual(expect.arrayContaining(["dry-limit", "trip-overload"]));
    expect(out.explanation.find((line) => line.id === "trip-overload")?.text).toContain("Switch some blocks off");
  });

  it("shows the W-to-MW conversion and bounds the trip sequence as a model simplification", () => {
    expect(run(430, 4, 1, 4, 4).explanation.find((line) => line.id === "power-equation")?.text).toMatch(/W ÷ 1,000,000 W\/MW ≈ 88\.0 MW/);
    const tripped = run(49, 4, 1, 4, 4).explanation.find((line) => line.id === "trip-overload")?.text;
    expect(tripped).toContain("In this simplified model");
    expect(tripped).toContain("Real plants can trip breakers or turbines in different ways");
  });

  it("V03 challenge pass: dry, hospital + one shops block — the most load that fits; three idle units", () => {
    const out = run(49, 4, 1, 0, 1);
    expect(q(out)).toMatchObject({ outputMW: DRY, demandMW: 8, headroomMW: 2.027907, tripped: 0, maxLoadServed: 1, gridStableWithPriority: 1, u1PowerMW: DRY, u2PowerMW: 0, u1Flow: 49, u2Idle: 1, u1Idle: 0 });
    expect(statuses(out)).toEqual(["generating", "idle", "idle", "idle"]);
    expect(out.flows["water-u2"]).toEqual({ active: false, rate: 0, direction: 1 });
    expect(blocks(out, "shops")).toEqual([1, 0, 0, 0]);
    expect(blocks(out, "homes")).toEqual([0, 0, 0, 0]);
    expect(ids(out)).toEqual(expect.arrayContaining(["idle-units", "max-served", "priority-stable", "constant-speed", "headroom"]));
  });

  it("V04 the v1.0 pass state (hospital only) is now under-served: a shops block still fits", () => {
    expect(q(run(49, 4, 1, 0, 0))).toMatchObject({ tripped: 0, headroomMW: 6.027907, maxLoadServed: 0, gridStableWithPriority: 0 });
  });

  it("V05–V08 one block too many, a homes block too big, hospital off, no units", () => {
    expect(q(run(49, 4, 1, 0, 2))).toMatchObject({ demandMW: 12, tripped: 1, gridStableWithPriority: 0 });
    expect(q(run(49, 4, 1, 1, 0))).toMatchObject({ demandMW: 16, tripped: 1, gridStableWithPriority: 0 });
    expect(q(run(49, 4, 0, 0, 2))).toMatchObject({ demandMW: 8, tripped: 0, maxLoadServed: 0, gridStableWithPriority: 0 });
    expect(q(run(49, 0, 1, 0, 1))).toMatchObject({ outputMW: 0, tripped: 1 });
    expect(ids(run(49, 0, 1, 0, 1))).toContain("no-supply");
  });

  it("V09 rainy overload beat with three units (66 MW): the fourth shops block trips", () => {
    const headroom = [0, 1, 2, 3, 4].map((s) => q(run(430, 3, 1, 4, s)));
    expect(headroom.map((out) => out.headroomMW)).toEqual([14, 10, 6, 2, -2]);
    expect(headroom.map((out) => out.tripped)).toEqual([0, 0, 0, 0, 1]);
    expect(headroom[3]).toMatchObject({ spillFlow: 107.5, tailraceLanes: 3, spillLanes: 1 });
    expect(headroom[4]).toMatchObject({ spillFlow: 430, tailraceLanes: 0, spillLanes: 4 });
  });

  it("V10 / F13 unit 3 taken apart, wrongly rebuilt or placements missing: fail-closed, 66 MW, trip", () => {
    for (const placements of [E, W, {}] as Placements[]) {
      const out = run(430, 4, 1, 4, 4, placements);
      expect(q(out)).toMatchObject({ outputMW: 66, tripped: 1, unitsAvailable: 3, unitsRunning: 3, usableFlow: 322.5, u3PowerMW: 0, unit3Ready: 0 });
      expect(statuses(out)).toEqual(["tripped", "tripped", "out-for-repair", "tripped"]);
      expect(out.componentStates["u3-generator"].status).toBe("out-for-repair");
    }
    expect(ids(run(430, 4, 1, 4, 4, E))).toContain("unit3-out");
  });

  it("V11/V12 flood: extra water goes over the spillway and output stays 88 (or all spills on a trip)", () => {
    const out = run(557, 4, 1, 4, 4);
    expect(q(out)).toMatchObject({ outputMW: 88, spillFlow: 127, tripped: 0, spillWidthFactor: 0.477501, riverLanes: 6, tailraceLanes: 4, spillLanes: 2 });
    expect(out.flows.spillway.rate).toBe(0.228007);
    expect(ids(out)).toContain("spillway-cap");
    expect(q(run(557, 1, 1, 4, 4))).toMatchObject({ tripped: 1, spillFlow: 557, spillLanes: 6 });
  });

  it("V13–V15 near ties: equal demand fits, one more block trips", () => {
    expect(q(run(430, 2, 1, 3, 1))).toMatchObject({ outputMW: 44, demandMW: 44, tripped: 0, headroomMW: 0 });
    expect(q(run(430, 2, 1, 3, 2)).tripped).toBe(1);
    expect(q(run(176, 4, 1, 2, 2))).toMatchObject({ outputMW: 36.018605, demandMW: 36, tripped: 0 });
    expect(q(run(176, 4, 1, 2, 3)).tripped).toBe(1);
    expect(q(run(303, 4, 1, 4, 2))).toMatchObject({ outputMW: 62.009302, headroomMW: 2.009302, tripped: 0 });
    expect(q(run(303, 4, 1, 4, 3)).tripped).toBe(1);
  });

  it("F14/F16 repair adds a machine, not water", () => {
    expect(q(run(430, 4, 1, 4, 0, E))).toMatchObject({ outputMW: 66, tripped: 0, turbineFlow: 322.5, spillFlow: 107.5 });
    const dry = run(49, 4, 1, 0, 1, E);
    expect(q(dry)).toMatchObject({ outputMW: DRY, gridStableWithPriority: 1 });
    expect(ids(dry)).toContain("unit3-out");
  });

  it("F17–F19 fewer units on", () => {
    expect(statuses(run(430, 3, 1, 4, 4))).toEqual(["tripped", "tripped", "tripped", "off"]);
    expect(q(run(430, 2, 1, 0, 4))).toMatchObject({ outputMW: 44, suppliedMW: 20, spillFlow: 215 });
    expect(q(run(430, 2, 0, 4, 0)).tripped).toBe(1);
  });

  it("V16 dry-season-output: 8–12 MW is reachable only with dry flow and at least one unit", () => {
    for (const flow of RIVER_FLOW_STEPS) for (const units of [0, 1, 2, 3, 4]) {
      const out = q(run(flow, units, 1, 0, 0)).outputMW;
      expect(out >= 8 && out <= 12, `${flow}/${units}`).toBe(flow === 49 && units >= 1);
    }
  });

  it("V17 invalid input throws instead of defaulting or clamping", () => {
    expect(() => run(100, 4, 1, 4, 4)).toThrow("hydro_model_input_invalid:riverFlow");
    expect(() => run(430, 5, 1, 4, 4)).toThrow("hydro_model_input_invalid:unitsOnline");
    expect(() => run(430, 4, 1, 5, 4)).toThrow("hydro_model_input_invalid:homesBlocks");
    expect(() => run(430, 4, 1, 1.5, 4)).toThrow("hydro_model_input_invalid:homesBlocks");
    expect(() => run(430, 4, 1, 4, -1)).toThrow("hydro_model_input_invalid:shopsBlocks");
    expect(() => hydropowerModel.evaluate({ variables: { riverFlow: 430, unitsOnline: 4, feederHospital: 1, shopsBlocks: 4 }, placements: I })).toThrow("hydro_model_input_invalid:homesBlocks");
    // v1.0 variable ids are not silently accepted.
    expect(() => hydropowerModel.evaluate({ variables: { riverFlow: 430, unitsOnline: 4, feederHospital: 1, feederHomes: 1, feederShops: 1 }, placements: I })).toThrow("hydro_model_input_invalid:homesBlocks");
  });

  it("grade gating: the equation and dynamo lines are marked minGrade 9", () => {
    const lines = run(430, 4, 1, 4, 4).explanation;
    // R2 P1-6: what just happened leads; the static energy chain follows the state lines.
    expect(lines[0].id).not.toBe("chain");
    expect(lines.findIndex((line) => line.id === "chain")).toBeGreaterThan(lines.findIndex((line) => line.id === "plant-output"));
    expect(lines.filter((line) => line.minGrade === 9).map((line) => line.id)).toEqual(["power-equation", "dynamo"]);
  });
});

describe("Mount Coffee hydropower model 1.2.0 (properties over all 2,500 states)", () => {
  const steps = [0, 1, 2, 3, 4];
  const states = RIVER_FLOW_STEPS.flatMap((flow) => steps.flatMap((units) => [0, 1].flatMap((h) => steps.flatMap((homes) => steps.flatMap((shops) =>
    [I, E].map((placements) => ({ flow, units, h, homes, shops, placements, out: run(flow, units, h, homes, shops, placements) })))))));

  it("covers 2,500 states", () => expect(states).toHaveLength(2500));

  it("output never decreases with more river flow or more units, and never exceeds 22 MW per running unit", () => {
    for (const s of states) {
      const o = q(s.out).outputMW;
      expect(o).toBeLessThanOrEqual(22 * q(s.out).unitsRunning + 1e-9);
      const nextFlow = RIVER_FLOW_STEPS[RIVER_FLOW_STEPS.indexOf(s.flow) + 1];
      if (nextFlow) expect(q(run(nextFlow, s.units, s.h, s.homes, s.shops, s.placements)).outputMW).toBeGreaterThanOrEqual(o);
      if (s.units < 4) expect(q(run(s.flow, s.units + 1, s.h, s.homes, s.shops, s.placements)).outputMW).toBeGreaterThanOrEqual(o);
    }
  });

  it("water is conserved: Σ unit flows = tailrace; tailrace + spill = downstream = upstream; the headpond never moves", () => {
    for (const s of states) {
      const out = q(s.out);
      expect([1, 2, 3, 4].reduce((sum, unit) => sum + out[`u${unit}Flow`], 0)).toBeCloseTo(out.tailraceFlow, 6);
      expect(out.tailraceFlow + out.spillFlow).toBeCloseTo(out.downstreamFlow, 6);
      expect(out.downstreamFlow).toBeCloseTo(s.flow, 6);
      expect(out.upstreamFlow).toBe(s.flow);
      expect(out.headpondLevel).toBe(1);
      expect(out.downstreamWidthFactor).toBe(out.upstreamWidthFactor);
      expect(out.tailraceLanes + out.spillLanes).toBe(out.riverLanes);
    }
  });

  it("a unit is generating exactly when it carries water, and never both generating and idle", () => {
    for (const s of states) for (let unit = 1; unit <= 4; unit += 1) {
      const generating = s.out.componentStates[`unit-${unit}`].status === "generating";
      expect(q(s.out)[`u${unit}Flow`] > 0).toBe(generating);
      expect(generating && q(s.out)[`u${unit}Idle`] === 1).toBe(false);
    }
  });

  it("city lights are only ever fully on or off, and any lit block means no trip", () => {
    for (const s of states) {
      for (const intensity of cityLights(s.out)) expect([0, 1]).toContain(intensity);
      if (cityLights(s.out).includes(1)) expect(q(s.out).tripped).toBe(0);
    }
  });

  it("removing a block never causes a trip; adding one never clears a trip", () => {
    for (const s of states) {
      if (s.homes < 4 && q(s.out).tripped) expect(q(run(s.flow, s.units, s.h, s.homes + 1, s.shops, s.placements)).tripped).toBe(1);
      if (s.shops < 4 && q(s.out).tripped) expect(q(run(s.flow, s.units, s.h, s.homes, s.shops + 1, s.placements)).tripped).toBe(1);
      if (s.homes > 0 && !q(s.out).tripped) expect(q(run(s.flow, s.units, s.h, s.homes - 1, s.shops, s.placements)).tripped).toBe(0);
    }
  });

  it("maximum load served means adding a block to any district below its maximum trips", () => {
    for (const s of states.filter((state) => q(state.out).maxLoadServed === 1)) {
      if (s.homes < 4) expect(q(run(s.flow, s.units, s.h, s.homes + 1, s.shops, s.placements)).tripped).toBe(1);
      if (s.shops < 4) expect(q(run(s.flow, s.units, s.h, s.homes, s.shops + 1, s.placements)).tripped).toBe(1);
    }
  });

  it("repair never adds water: intact output ≥ taken-apart output, equal in the dry season", () => {
    for (const s of states.filter((state) => state.placements === I)) {
      const apart = q(run(s.flow, s.units, s.h, s.homes, s.shops, E)).outputMW;
      expect(q(s.out).outputMW).toBeGreaterThanOrEqual(apart);
      if (s.flow === 49 && s.units >= 1) expect(apart).toBe(q(s.out).outputMW);
    }
  });

  it("inactive flows have rate 0; rates stay in [0, 1]; direction is always 1", () => {
    for (const s of states) for (const flow of Object.values(s.out.flows)) {
      if (!flow.active) expect(flow.rate).toBe(0);
      expect(flow.rate).toBeGreaterThanOrEqual(0); expect(flow.rate).toBeLessThanOrEqual(1); expect(flow.direction).toBe(1);
    }
  });

  it("the challenge composite holds in exactly 8 states: dry, hospital + one shops block, ≥1 unit, either placement", () => {
    expect(states.filter((s) => q(s.out).gridStableWithPriority === 1).map((s) => `${s.flow}/${s.units}/${s.h}/${s.homes}/${s.shops}`).sort())
      .toEqual(["49/1/1/0/1", "49/1/1/0/1", "49/2/1/0/1", "49/2/1/0/1", "49/3/1/0/1", "49/3/1/0/1", "49/4/1/0/1", "49/4/1/0/1"]);
  });

  it("blind toggling is unlikely to pass (founder P0 fix): 4/1250 over all settings, 1/50 over feeder settings in the dry season", () => {
    const intact = states.filter((s) => s.placements === I);
    expect(intact).toHaveLength(1250);
    expect(intact.filter((s) => q(s.out).gridStableWithPriority === 1)).toHaveLength(4);
    const feederSettings = intact.filter((s) => s.flow === 49 && s.units === 4);
    expect(feederSettings).toHaveLength(50);
    expect(feederSettings.filter((s) => q(s.out).gridStableWithPriority === 1)).toHaveLength(1);
  });

  it("no quantity scales with turbine speed; generating status is the same at every flow that feeds the units", () => {
    for (const flow of [176, 303, 430, 557]) expect(statuses(run(flow, 1, 1, 0, 0))).toEqual(["generating", "off", "off", "off"]);
    expect(Object.keys(q(run(430, 4, 1, 4, 4))).some((key) => /rpm|speed/i.test(key))).toBe(false);
  });

  it("is pure: same input, same output, input not mutated", () => {
    const input = { variables: { riverFlow: 430, unitsOnline: 4, feederHospital: 1, homesBlocks: 4, shopsBlocks: 4, protectionLatched: 0 }, placements: structuredClone(I) as Placements };
    const frozen = structuredClone(input);
    expect(hydropowerModel.evaluate(input)).toEqual(hydropowerModel.evaluate(input));
    expect(input).toEqual(frozen);
  });
});
