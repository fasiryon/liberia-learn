// Mount Coffee run-of-river rule layer (docs/labs/mount-coffee-hydropower/design/03-SIMULATION_SPEC.md).
// Pure, deterministic and memoryless. Invalid input throws; nothing is defaulted or clamped.
// Verified facts: 23.1 m head, 4 × 22 MW Francis units, 142.86 rpm, ≈10 MW dependable in the dry season.
// Model assumptions are marked; feeder demands are fictional.
import type { ExplanationLine, SimulationInput, SimulationModel, SimulationOutput } from "../fidelity/types";

export const HEAD_M = 23.1;
export const UNIT_RATING_MW = 22;
export const UNIT_COUNT = 4;
export const SYNCHRONOUS_RPM = 142.86;
/** MODEL ASSUMPTION: 4 × 107.5 = 430 m³/s for 88 MW. */
export const DESIGN_FLOW_PER_UNIT = 107.5;
/** MODEL ASSUMPTION: chosen so one unit at design flow makes exactly its 22 MW rating (≈ 0.903). */
export const EFFICIENCY = UNIT_RATING_MW * 1e6 / (1000 * 9.81 * HEAD_M * DESIGN_FLOW_PER_UNIT);
export const RIVER_FLOW_STEPS = Object.freeze([49, 176, 303, 430, 557]);
export const DRY_FLOW = 49;
export const MAX_RIVER_FLOW = 557;
/** MODEL ASSUMPTION (fictional feeders). */
export const FEEDER_DEMAND_MW = Object.freeze({ feederHospital: 6, feederHomes: 48, feederShops: 32 });
export const UNIT_X = Object.freeze([-1.5, -0.3, 0.9, 2.1]);
/** Unit 3's detailed machine stack: revealed by the powerhouse cutaway, identified, and rebuilt in the repair check. */
export const UNIT3_STACK = Object.freeze(["u3-runner", "u3-shaft", "u3-generator"]);

const round6 = (value: number) => Math.round(value * 1e6) / 1e6;
const SEASONS: Record<number, string> = { 49: "dry season", 176: "early rains", 303: "heavy rains", 430: "rainy season, full", 557: "flood" };
export function seasonLabel(flow: number): string { return SEASONS[flow] ?? `${flow} m³/s`; }

function requireStep(variables: Record<string, number>, id: string, allowed: readonly number[]): number {
  const value = variables[id];
  if (typeof value !== "number" || !Number.isFinite(value) || !allowed.includes(value)) throw new Error(`hydro_model_input_invalid:${id}`);
  return value;
}

type UnitStatus = "generating" | "idle" | "off" | "tripped" | "out-for-repair";

/** Everything the rules derive, before being shaped into SimulationOutput. Exported for tests. */
export function evaluateHydro(input: SimulationInput) {
  const riverFlow = requireStep(input.variables, "riverFlow", RIVER_FLOW_STEPS);
  const unitsOnline = requireStep(input.variables, "unitsOnline", [0, 1, 2, 3, 4]);
  const hospital = requireStep(input.variables, "feederHospital", [0, 1]);
  const homes = requireStep(input.variables, "feederHomes", [0, 1]);
  const shops = requireStep(input.variables, "feederShops", [0, 1]);

  // 1. Unit 3 is available only when rebuilt exactly (fail-closed).
  const u3 = input.placements["unit-3"];
  const unit3Ready = !!u3 && u3["slot-runner"] === "u3-runner" && u3["slot-shaft"] === "u3-shaft" && u3["slot-generator"] === "u3-generator" ? 1 : 0;
  // 2. Dispatch in fixed order, skipping an unavailable unit 3.
  const available = [1, 2, ...(unit3Ready ? [3] : []), 4];
  const running = available.slice(0, unitsOnline);
  // 3. Water shares.
  const shares: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  let remaining = riverFlow;
  for (const unit of running) { const share = Math.min(remaining, DESIGN_FLOW_PER_UNIT); shares[unit] = share; remaining -= share; }
  const usableFlow = running.reduce((sum, unit) => sum + shares[unit], 0);
  // 4. Capability: P = ρ·g·Q·H·η, equal to 22 MW per 107.5 m³/s by construction.
  const unitPower = (unit: number) => round6(UNIT_RATING_MW * shares[unit] / DESIGN_FLOW_PER_UNIT);
  const outputMW = round6(UNIT_RATING_MW * usableFlow / DESIGN_FLOW_PER_UNIT);
  // 5–7. Demand, protection, delivery.
  const demandMW = FEEDER_DEMAND_MW.feederHospital * hospital + FEEDER_DEMAND_MW.feederHomes * homes + FEEDER_DEMAND_MW.feederShops * shops;
  const tripped = demandMW > outputMW + 1e-9 ? 1 : 0;
  const suppliedMW = tripped ? 0 : demandMW;
  const turbineFlow = tripped ? 0 : usableFlow;
  const spillFlow = round6(riverFlow - turbineFlow);
  // 8. Status per unit.
  const status = (unit: number): UnitStatus => unit === 3 && !unit3Ready ? "out-for-repair" : !running.includes(unit) ? "off" : tripped ? "tripped" : shares[unit] > 0 ? "generating" : "idle";
  const statuses = [1, 2, 3, 4].map(status);
  const gridStableWithPriority = riverFlow === DRY_FLOW && hospital === 1 && tripped === 0 ? 1 : 0;
  return { riverFlow, unitsOnline, feeders: { hospital, homes, shops }, unit3Ready, running, shares, usableFlow, outputMW, unitPower, demandMW, tripped, suppliedMW, turbineFlow, spillFlow, statuses, gridStableWithPriority };
}

function explain(r: ReturnType<typeof evaluateHydro>): ExplanationLine[] {
  const hydraulicWatts = Math.round(1000 * 9.81 * r.usableFlow * 23.1 * 0.903);
  const lines: ExplanationLine[] = [
    { id: "context", text: "Mount Coffee is a real run-of-river hydropower plant on the Saint Paul River, about 30 km from Monrovia. This model is not to scale." },
    { id: "season", text: `River flow: ${r.riverFlow} m³/s (${seasonLabel(r.riverFlow)}). The headpond stays at the same level. What changes is how much water arrives each second.` },
  ];
  if (r.riverFlow === DRY_FLOW) lines.push({ id: "dry-limit", text: "In the dry season only about 49 m³/s arrives each second. That is enough water for about one unit, so the plant can make only about 10 MW, even though the headpond looks full. There is no big lake saved up." });
  lines.push({ id: "plant-output", text: `Power the plant can make now: about ${Math.round(r.outputMW)} MW, with ${r.running.length} unit${r.running.length === 1 ? "" : "s"} switched on.` });
  if (!r.unit3Ready) lines.push({ id: "unit3-out", text: "Unit 3 is taken apart for repair, so it cannot run." });
  if (r.unit3Ready && r.running.includes(3) && r.shares[3] === 0 && !r.tripped) lines.push({ id: "unit3-no-water", text: "Unit 3 is ready, but the river has no water left for it, so it makes nothing. Repair adds a machine, not water." });
  const idle = [1, 2, 3, 4].filter((unit, index) => r.statuses[index] === "idle");
  if (idle.length) lines.push({ id: "idle-units", text: `Unit${idle.length === 1 ? "" : "s"} ${idle.join(", ")} ${idle.length === 1 ? "is" : "are"} on but get${idle.length === 1 ? "s" : ""} no water, so ${idle.length === 1 ? "it makes" : "they make"} nothing. More turbines do not bring more water.` });
  if (!r.tripped && r.spillFlow > 0) lines.push({ id: "spillway-cap", text: `The river brings more water than the running turbines can take (${r.usableFlow} m³/s). The other ${r.spillFlow} m³/s goes over the spillway, so power stays at ${Math.round(r.outputMW)} MW.` });
  if (r.statuses.includes("generating")) lines.push({ id: "constant-speed", text: "Every unit that is making power turns at the same steady speed: 142.86 turns per minute. More water gives more power, not a faster turbine." });
  lines.push({ id: "water-returns", text: "The water is not used up. After the turbine it flows out through the tailrace and back into the Saint Paul River." });
  lines.push({ id: "demand", text: `The city is asking for ${r.demandMW} MW. (Hospital 6 MW, homes 48 MW, shops 32 MW are model numbers, not real ones.)` });
  if (r.tripped && r.outputMW > 0) lines.push({ id: "trip-overload", text: `The city asked for ${r.demandMW} MW but the plant can make only ${Math.round(r.outputMW)} MW. In this simplified model, protection trips the city supply and stops the modeled units, so the whole city goes dark at once. Real plants can trip breakers or turbines in different ways, and restart steps depend on the cause. Lights do not just get dimmer. Switch some feeders off; when demand fits again, the model lets operators restore supply.` });
  else if (r.tripped) lines.push({ id: "no-supply", text: "No unit is making power, so no electricity reaches the city. Electricity is not stored in the dam or the wires." });
  else if (r.demandMW > 0) lines.push({ id: "supplied", text: `The plant is supplying the ${r.demandMW} MW the city asks for. Every feeder that is on gets full power.` });
  else lines.push({ id: "no-demand", text: "All feeders are off, so no electricity is sent to the city." });
  if (r.gridStableWithPriority) lines.push({ id: "priority-stable", text: "Dry season, evening peak: the grid is stable and the hospital is lit." });
  lines.push(
    { id: "grade8-rule", text: "More water each second, or a higher drop, gives more power." },
    { id: "power-equation", text: `P ≈ ρ·g·Q·H·η = 1000 × 9.81 × ${r.usableFlow} × 23.1 × 0.903 = ${hydraulicWatts.toLocaleString("en-US")} W; ${hydraulicWatts.toLocaleString("en-US")} W ÷ 1,000,000 W/MW ≈ ${r.outputMW.toFixed(1)} MW (η = 0.903 is a model assumption).`, minGrade: 9 },
    { id: "dynamo", text: "In the generator, the spinning rotor's magnet moves past coils of wire and makes a current, the same idea as a bicycle dynamo.", minGrade: 9 },
    { id: "safety-limits", text: "In class you would also pour the water yourself and feel the dynamo push back when the lamp lights. Never go near a real dam, spillway, intake or power line. The water and electricity there can kill." },
  );
  // Keep the storyboard's S7 energy-chain explanation in the first visible scroll-panel row.
  lines.unshift({ id: "chain", text: "Energy chain: stored (potential) energy of the high water → movement (kinetic) energy of falling water → turning turbine and shaft → electrical energy in the generator → light (and some heat) in the city. At each step some energy becomes heat and sound; none is destroyed." });
  return lines;
}

export const hydropowerModel: SimulationModel = {
  id: "mount-coffee-run-of-river",
  version: "1.0.0",
  kind: "deterministic-rules",
  evaluate: (input): SimulationOutput => {
    const r = evaluateHydro(input);
    const generating = (unit: number) => r.statuses[unit - 1] === "generating";
    const quantities: Record<string, number> = {
      riverFlow: r.riverFlow, usableFlow: round6(r.usableFlow), outputMW: r.outputMW, demandMW: r.demandMW, suppliedMW: r.suppliedMW,
      tripped: r.tripped, turbineFlow: round6(r.turbineFlow), spillFlow: r.spillFlow, unit3Ready: r.unit3Ready,
      unitsAvailable: r.unit3Ready ? 4 : 3, unitsRunning: r.running.length, unitsGenerating: [1, 2, 3, 4].filter(generating).length,
      gridStableWithPriority: r.gridStableWithPriority,
      ...Object.fromEntries([1, 2, 3, 4].flatMap((unit) => [[`u${unit}PowerMW`, r.unitPower(unit)], [`u${unit}Generating`, generating(unit) ? 1 : 0]])),
    };
    const flow = (active: boolean, rate: number) => ({ active, rate: active ? round6(rate) : 0, direction: 1 as const });
    const feederOn = { hospital: r.feeders.hospital === 1, homes: r.feeders.homes === 1, shops: r.feeders.shops === 1 };
    const flows: SimulationOutput["flows"] = {
      "river-in": flow(true, r.riverFlow / MAX_RIVER_FLOW),
      ...Object.fromEntries([1, 2, 3, 4].map((unit) => [`water-u${unit}`, flow(generating(unit), r.shares[unit] / DESIGN_FLOW_PER_UNIT)])),
      spillway: flow(r.spillFlow > 0, r.spillFlow / MAX_RIVER_FLOW),
      "power-line": flow(r.suppliedMW > 0, r.suppliedMW / 88),
      "feeder-hospital": flow(feederOn.hospital && !r.tripped, FEEDER_DEMAND_MW.feederHospital / 48),
      "feeder-homes": flow(feederOn.homes && !r.tripped, FEEDER_DEMAND_MW.feederHomes / 48),
      "feeder-shops": flow(feederOn.shops && !r.tripped, FEEDER_DEMAND_MW.feederShops / 48),
    };
    const componentStates: SimulationOutput["componentStates"] = {};
    for (let k = 1; k <= 4; k += 1) componentStates[`gauge-seg-${k}`] = { intensity: round6(Math.min(1, Math.max(0, (r.outputMW - 22 * (k - 1)) / 22))) };
    for (const [feeder, on] of Object.entries(feederOn)) {
      componentStates[`demand-${feeder}`] = { intensity: on ? 1 : 0 };
      componentStates[`city-${feeder}`] = { intensity: on && !r.tripped ? 1 : 0 };
    }
    // Every unit's housing and pole marker carry its status (RX-001 motion driver); unit 3's internal stack does too.
    for (let unit = 1; unit <= 4; unit += 1) for (const id of [`unit-${unit}`, `unit-${unit}-marker`]) componentStates[id] = { status: r.statuses[unit - 1] };
    for (const part of UNIT3_STACK) componentStates[part] = { status: r.statuses[2] };
    return { quantities, flows, componentStates, explanation: explain(r) };
  },
};
