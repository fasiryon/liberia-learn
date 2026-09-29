// Executable form of docs/labs/mount-coffee-hydropower/design/03-SIMULATION_SPEC.md (fixtures F01–F22 + properties).
import { describe, expect, it } from "vitest";
import { EFFICIENCY, hydropowerModel, RIVER_FLOW_STEPS } from "@/lib/interactive-labs/v2/definitions/hydropowerModel";

const I = { "unit-3": { "slot-runner": "u3-runner", "slot-shaft": "u3-shaft", "slot-generator": "u3-generator" } };
const E = { "unit-3": {} };
const W = { "unit-3": { "slot-runner": "u3-generator", "slot-shaft": "u3-shaft", "slot-generator": "u3-runner" } };
type Placements = Record<string, Record<string, string | null>>;
const run = (riverFlow: number, unitsOnline: number, feeders: string, placements: Placements = I) =>
  hydropowerModel.evaluate({ variables: { riverFlow, unitsOnline, feederHospital: feeders.includes("H") ? 1 : 0, feederHomes: feeders.includes("M") ? 1 : 0, feederShops: feeders.includes("S") ? 1 : 0 }, placements });
const q = (out: ReturnType<typeof run>) => out.quantities;
const statuses = (out: ReturnType<typeof run>) => [1, 2, 3, 4].map((unit) => out.componentStates[`unit-${unit}`]?.status);
const city = (out: ReturnType<typeof run>) => ["hospital", "homes", "shops"].map((f) => out.componentStates[`city-${f}`]?.intensity);
const gauge = (out: ReturnType<typeof run>) => [1, 2, 3, 4].map((k) => out.componentStates[`gauge-seg-${k}`]?.intensity);
const ids = (out: ReturnType<typeof run>) => out.explanation.map((line) => line.id);
const DRY = 10.027907;

describe("Mount Coffee hydropower model (spec fixtures)", () => {
  it("η is the stated model assumption (≈0.903) and one unit at design flow makes 22 MW", () => {
    expect(EFFICIENCY).toBeCloseTo(0.903094566, 9);
    expect(q(run(430, 1, "H")).outputMW).toBe(22);
  });

  it("F01 initial: rainy, 4 units, all feeders — 88 MW, all generating, city lit", () => {
    const out = run(430, 4, "HMS");
    expect(q(out)).toMatchObject({ outputMW: 88, demandMW: 86, tripped: 0, suppliedMW: 86, turbineFlow: 430, spillFlow: 0, gridStableWithPriority: 0, unitsAvailable: 4, unitsRunning: 4, unitsGenerating: 4, unit3Ready: 1, u1PowerMW: 22, u4PowerMW: 22 });
    expect(statuses(out)).toEqual(["generating", "generating", "generating", "generating"]);
    expect(out.flows["river-in"]).toEqual({ active: true, rate: 0.771993, direction: 1 });
    expect(out.flows["power-line"].rate).toBe(0.977273);
    expect(out.flows.spillway.active).toBe(false);
    expect(gauge(out)).toEqual([1, 1, 1, 1]);
    expect(city(out)).toEqual([1, 1, 1]);
  });

  it("F02 dry with every feeder on trips the whole city (not dimming) while the headpond is unchanged", () => {
    const out = run(49, 4, "HMS");
    expect(q(out)).toMatchObject({ outputMW: DRY, tripped: 1, suppliedMW: 0, turbineFlow: 0, spillFlow: 49 });
    expect(statuses(out)).toEqual(["tripped", "tripped", "tripped", "tripped"]);
    expect(gauge(out)).toEqual([0.455814, 0, 0, 0]);
    expect(city(out)).toEqual([0, 0, 0]);
    expect(ids(out)).toEqual(expect.arrayContaining(["dry-limit", "trip-overload"]));
    expect(ids(out)).not.toContain("constant-speed");
  });

  it("shows the W-to-MW conversion and bounds the trip sequence as a model simplification", () => {
    const rainy = run(430, 4, "HMS").explanation.find((line) => line.id === "power-equation")?.text;
    expect(rainy).toMatch(/W ÷ 1,000,000 W\/MW ≈ 88\.0 MW/);
    const tripped = run(49, 4, "HMS").explanation.find((line) => line.id === "trip-overload")?.text;
    expect(tripped).toContain("In this simplified model");
    expect(tripped).toContain("Real plants can trip breakers or turbines in different ways");
  });

  it("F03 challenge pass: dry, hospital only — stable, three idle units", () => {
    const out = run(49, 4, "H");
    expect(q(out)).toMatchObject({ outputMW: DRY, demandMW: 6, tripped: 0, gridStableWithPriority: 1, u1PowerMW: DRY, u2PowerMW: 0 });
    expect(statuses(out)).toEqual(["generating", "idle", "idle", "idle"]);
    expect(out.flows["water-u1"].rate).toBe(0.455814);
    expect(out.flows["water-u2"]).toEqual({ active: false, rate: 0, direction: 1 });
    expect(city(out)).toEqual([1, 0, 0]);
    expect(ids(out)).toEqual(expect.arrayContaining(["idle-units", "priority-stable", "constant-speed"]));
    expect(out.explanation.find((line) => line.id === "idle-units")!.text).toContain("2, 3, 4");
  });

  it("F05/F20 no unit on: no supply, electricity is not stored", () => {
    expect(ids(run(49, 0, "H"))).toContain("no-supply");
    expect(q(run(557, 0, ""))).toMatchObject({ outputMW: 0, tripped: 0, spillFlow: 557 });
  });

  it("F08–F11 intermediate seasons and the near-tie trips", () => {
    expect(q(run(176, 4, "HMS"))).toMatchObject({ outputMW: 36.018605, tripped: 1 });
    expect(q(run(176, 4, "HS"))).toMatchObject({ demandMW: 38, tripped: 1 });
    const f10 = run(176, 4, "S");
    expect(statuses(f10)).toEqual(["generating", "generating", "idle", "idle"]);
    expect(f10.flows["water-u2"].rate).toBe(0.637209);
    const f11 = run(303, 4, "HM");
    expect(q(f11)).toMatchObject({ outputMW: 62.009302, tripped: 0, suppliedMW: 54 });
    expect(gauge(f11)).toEqual([1, 1, 0.818605, 0]);
  });

  it("F12 flood: extra water goes over the spillway, output stays 88", () => {
    const out = run(557, 4, "HMS");
    expect(q(out)).toMatchObject({ outputMW: 88, spillFlow: 127, tripped: 0 });
    expect(out.flows.spillway.rate).toBe(0.228007);
    expect(ids(out)).toContain("spillway-cap");
  });

  it("F13/F15/F21 unit 3 taken apart, wrongly rebuilt, or placements missing: fail-closed, 66 MW, trip", () => {
    for (const placements of [E, W, {}] as Placements[]) {
      const out = run(430, 4, "HMS", placements);
      expect(q(out)).toMatchObject({ outputMW: 66, tripped: 1, unitsAvailable: 3, unitsRunning: 3, usableFlow: 322.5, u3PowerMW: 0, unit3Ready: 0 });
      expect(statuses(out)).toEqual(["tripped", "tripped", "out-for-repair", "tripped"]);
      expect(out.componentStates["u3-generator"].status).toBe("out-for-repair");
    }
    expect(ids(run(430, 4, "HMS", E))).toContain("unit3-out");
  });

  it("F14/F16: repair adds a machine, not water", () => {
    expect(q(run(430, 4, "HM", E))).toMatchObject({ outputMW: 66, tripped: 0, turbineFlow: 322.5, spillFlow: 107.5 });
    const dry = run(49, 4, "H", E);
    expect(q(dry)).toMatchObject({ outputMW: DRY, gridStableWithPriority: 1 });
    expect(ids(dry)).toContain("unit3-out");
    expect(ids(dry)).not.toContain("unit3-no-water");
  });

  it("F17–F19 fewer units on", () => {
    expect(statuses(run(430, 3, "HMS"))).toEqual(["tripped", "tripped", "tripped", "off"]);
    expect(q(run(430, 2, "HS"))).toMatchObject({ outputMW: 44, suppliedMW: 38, spillFlow: 215 });
    expect(q(run(430, 2, "M"))).toMatchObject({ tripped: 1 });
  });

  it("F22 invalid input throws instead of defaulting", () => {
    expect(() => run(100, 4, "H")).toThrow("hydro_model_input_invalid:riverFlow");
    expect(() => run(430, 5, "H")).toThrow("hydro_model_input_invalid:unitsOnline");
    expect(() => hydropowerModel.evaluate({ variables: { riverFlow: 430, unitsOnline: 4, feederHospital: 1, feederHomes: 0.5, feederShops: 1 }, placements: I })).toThrow("hydro_model_input_invalid:feederHomes");
    expect(() => hydropowerModel.evaluate({ variables: { unitsOnline: 4, feederHospital: 1, feederHomes: 1, feederShops: 1 }, placements: I })).toThrow("hydro_model_input_invalid:riverFlow");
  });

  it("grade gating: the equation and dynamo lines are marked minGrade 9", () => {
    const lines = run(430, 4, "HMS").explanation;
    expect(lines.filter((line) => line.minGrade === 9).map((line) => line.id)).toEqual(["power-equation", "dynamo"]);
  });
});

describe("Mount Coffee hydropower model (properties over all 400 states)", () => {
  const feederSets = ["", "H", "M", "S", "HM", "HS", "MS", "HMS"];
  const states = RIVER_FLOW_STEPS.flatMap((flow) => [0, 1, 2, 3, 4].flatMap((units) => feederSets.flatMap((feeders) => [I, E].map((placements) => ({ flow, units, feeders, placements, out: run(flow, units, feeders, placements) })))));

  it("covers 400 states", () => expect(states).toHaveLength(400));

  it("output never decreases with more river flow or more units, and never exceeds 22 MW per running unit", () => {
    for (const s of states) {
      const o = q(s.out).outputMW;
      expect(o).toBeLessThanOrEqual(22 * q(s.out).unitsRunning + 1e-9);
      const nextFlow = RIVER_FLOW_STEPS[RIVER_FLOW_STEPS.indexOf(s.flow) + 1];
      if (nextFlow) expect(q(run(nextFlow, s.units, s.feeders, s.placements)).outputMW).toBeGreaterThanOrEqual(o);
      if (s.units < 4) expect(q(run(s.flow, s.units + 1, s.feeders, s.placements)).outputMW).toBeGreaterThanOrEqual(o);
    }
  });

  it("water is conserved; city lights are only ever fully on or off; lit implies not tripped", () => {
    for (const s of states) {
      expect(q(s.out).turbineFlow + q(s.out).spillFlow).toBeCloseTo(s.flow, 6);
      for (const intensity of city(s.out)) expect([0, 1]).toContain(intensity);
      if (city(s.out).includes(1)) expect(q(s.out).tripped).toBe(0);
    }
  });

  it("removing a feeder never causes a trip; adding one never clears a trip", () => {
    for (const s of states) for (const feeder of ["H", "M", "S"]) if (s.feeders.includes(feeder)) {
      const fewer = run(s.flow, s.units, s.feeders.replace(feeder, ""), s.placements);
      if (q(s.out).tripped === 0) expect(q(fewer).tripped).toBe(0);
    }
  });

  it("repair never adds water: intact output ≥ taken-apart output, equal in the dry season", () => {
    for (const s of states.filter((state) => state.placements === I)) {
      const apart = q(run(s.flow, s.units, s.feeders, E)).outputMW;
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

  it("the challenge composite holds in exactly 8 states: dry, hospital only, ≥1 unit, either placement", () => {
    expect(states.filter((s) => q(s.out).gridStableWithPriority === 1).map((s) => `${s.flow}/${s.units}/${s.feeders}`).sort()).toEqual(["49/1/H", "49/1/H", "49/2/H", "49/2/H", "49/3/H", "49/3/H", "49/4/H", "49/4/H"]);
  });

  it("no quantity scales with turbine speed; generating status is the same at every flow that feeds the units", () => {
    for (const flow of [176, 303, 430, 557]) expect(statuses(run(flow, 1, "H"))).toEqual(["generating", "off", "off", "off"]);
    expect(Object.keys(q(run(430, 4, "HMS"))).some((key) => /rpm|speed/i.test(key))).toBe(false);
  });

  it("is pure: same input, same output, input not mutated", () => {
    const input = { variables: { riverFlow: 430, unitsOnline: 4, feederHospital: 1, feederHomes: 1, feederShops: 1 }, placements: structuredClone(I) as Placements };
    const frozen = structuredClone(input);
    expect(hydropowerModel.evaluate(input)).toEqual(hydropowerModel.evaluate(input));
    expect(input).toEqual(frozen);
  });
});
