// Mount Coffee run-of-river rule layer (docs/labs/mount-coffee-hydropower/design/03-SIMULATION_SPEC.md,
// amended by 06-V1_1_SIMULATION_DELTA.md: smaller feeder blocks, founder decision 2026-10-01).
// Pure, deterministic and memoryless. Invalid input throws; nothing is defaulted or clamped.
// The one piece of memory, the latched trip (founder decision 2026-10-02), is an input: protectionLatched is held by
// the engine (spec.protection), set on any overload and cleared only by an explicit, validated "Reset plant".
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
/** MODEL ASSUMPTION (fictional feeders). Homes and shops are switched in blocks so the dry-season challenge needs arithmetic. */
export const HOSPITAL_MW = 4;
export const HOMES_BLOCK_MW = 12;
export const SHOPS_BLOCK_MW = 4;
export const BLOCKS_PER_DISTRICT = 4;
export const BLOCK_STEPS = Object.freeze([0, 1, 2, 3, 4]);
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
  const homes = requireStep(input.variables, "homesBlocks", BLOCK_STEPS);
  const shops = requireStep(input.variables, "shopsBlocks", BLOCK_STEPS);
  const latched = requireStep(input.variables, "protectionLatched", [0, 1]);

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
  const demandMW = HOSPITAL_MW * hospital + HOMES_BLOCK_MW * homes + SHOPS_BLOCK_MW * shops;
  // An overload trips the plant; the trip stays latched (supply off) until the learner resets it, even once demand fits.
  const overload = demandMW > outputMW + 1e-9 ? 1 : 0;
  const tripped = overload || latched ? 1 : 0;
  const headroomMW = round6(outputMW - demandMW);
  const suppliedMW = tripped ? 0 : demandMW;
  const turbineFlow = tripped ? 0 : usableFlow;
  const spillFlow = round6(riverFlow - turbineFlow);
  // 8. Status per unit.
  const status = (unit: number): UnitStatus => unit === 3 && !unit3Ready ? "out-for-repair" : !running.includes(unit) ? "off" : tripped ? "tripped" : shares[unit] > 0 ? "generating" : "idle";
  const statuses = [1, 2, 3, 4].map(status);
  // S9: "maximum load served" = hospital on, no trip, and no further block fits (not the best possible mix).
  const noBlockFits = (homes === BLOCKS_PER_DISTRICT || HOMES_BLOCK_MW > headroomMW + 1e-9) && (shops === BLOCKS_PER_DISTRICT || SHOPS_BLOCK_MW > headroomMW + 1e-9) ? 1 : 0;
  const maxLoadServed = hospital === 1 && tripped === 0 && noBlockFits === 1 ? 1 : 0;
  const gridStableWithPriority = riverFlow === DRY_FLOW && maxLoadServed === 1 ? 1 : 0;
  return { riverFlow, unitsOnline, feeders: { hospital, homes, shops }, unit3Ready, running, shares, usableFlow, outputMW, unitPower, demandMW, headroomMW, noBlockFits, maxLoadServed, overload, latched, tripped, suppliedMW, turbineFlow, spillFlow, statuses, gridStableWithPriority };
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
  lines.push({ id: "demand", text: `The city is asking for ${r.demandMW} MW: hospital ${r.feeders.hospital ? "on" : "off"}, ${r.feeders.homes} of 4 homes blocks, ${r.feeders.shops} of 4 shops blocks. (Hospital 4 MW; homes blocks 12 MW each; shops blocks 4 MW each. These are model numbers, not real ones.)` });
  if (!r.tripped && r.outputMW > 0) lines.push({ id: "headroom", text: `About ${Math.round(r.headroomMW * 10) / 10} MW spare. A homes block needs 12 MW and a shops block needs 4 MW.` });
  if (r.tripped) lines.push({ id: "plant-tripped", text: `PLANT TRIPPED — Demand exceeded available generation. ${resetAdvice(r)}` });
  if (r.overload && r.outputMW > 0) lines.push({ id: "trip-overload", text: `The city asks for ${r.demandMW} MW but the plant can make only ${Math.round(r.outputMW)} MW. In this simplified model, protection trips the city supply and stops the modeled units, so the whole city goes dark at once. Real plants can trip breakers or turbines in different ways, and restart steps depend on the cause. Lights do not just get dimmer. Switch some blocks off or bring more units online; once demand fits, operators must reset the plant before supply returns.` });
  else if (r.tripped && !r.overload) lines.push({ id: "trip-latched", text: `Demand now fits: the city asks for ${r.demandMW} MW and the plant can make about ${Math.round(r.outputMW)} MW. The protection stays tripped and the city stays dark until an operator resets the plant. Power never comes back by itself.` });
  else if (r.tripped) lines.push({ id: "no-supply", text: "No unit is making power, so no electricity reaches the city. Electricity is not stored in the dam or the wires." });
  else if (r.demandMW > 0) lines.push({ id: "supplied", text: `The plant is supplying the ${r.demandMW} MW the city asks for. Every feeder that is on gets full power.` });
  else lines.push({ id: "no-demand", text: "All feeders are off, so no electricity is sent to the city." });
  if (r.maxLoadServed) lines.push({ id: "max-served", text: "The hospital is lit and no further block fits without tripping the plant: the most load this supply can carry." });
  if (r.gridStableWithPriority) lines.push({ id: "priority-stable", text: "Dry season: the grid is stable, the hospital is lit, and every block that fits is on." });
  if (r.riverFlow === DRY_FLOW) lines.push({ id: "bottle-wheel", text: "Like the bottle-cap water wheel in class: a thin stream turns it slowly and a full stream turns it fast. Less water each second means less power." });
  lines.push(
    { id: "grade8-rule", text: "More water each second, or a higher drop, gives more power." },
    { id: "power-equation", text: `P ≈ ρ·g·Q·H·η = 1000 × 9.81 × ${r.usableFlow} × 23.1 × 0.903 = ${hydraulicWatts.toLocaleString("en-US")} W; ${hydraulicWatts.toLocaleString("en-US")} W ÷ 1,000,000 W/MW ≈ ${r.outputMW.toFixed(1)} MW (η = 0.903 is a model assumption).`, minGrade: 9 },
    { id: "dynamo", text: "In the generator, the spinning rotor's magnet moves past coils of wire and makes a current, the same idea as a bicycle dynamo.", minGrade: 9 },
    { id: "safety-limits", text: "In class you would also pour the water yourself and feel the dynamo push back when the lamp lights. Never go near a real dam, spillway, intake or power line. The water and electricity there can kill." },
  );
  // State lines first (R2 pedagogy P1-6): what just happened leads; the static chain and context follow.
  // In flood or trip states the safety line comes first, except that a trip's diagnosis (PLANT TRIPPED and what to do)
  // stays above it, so the learner sees the immediate consequence and the recovery step without scrolling.
  const priority = ["plant-tripped", "trip-overload", "trip-latched", "no-supply", "headroom", "max-served", "priority-stable", "dry-limit", "idle-units", "spillway-cap", "unit3-out", "unit3-no-water", "plant-output", "demand", "season"];
  const rank = (id: string) => { const i = priority.indexOf(id); return i < 0 ? priority.length : i; };
  lines.sort((a, b) => rank(a.id) - rank(b.id));
  if (r.tripped || r.spillFlow > 0) {
    const safety = lines.findIndex((line) => line.id === "safety-limits");
    const at = r.tripped ? 1 : 0;
    if (safety > at) lines.splice(at, 0, ...lines.splice(safety, 1));
  }
  lines.push({ id: "chain", text: "Energy chain: stored (potential) energy of the high water → movement (kinetic) energy of falling water → turning turbine and shaft → electrical energy in the generator → light (and some heat) in the city. At each step some energy becomes heat and sound; none is destroyed." });
  return lines;
}

/** Learner-facing reason a plant reset would fail now, or null when it is safe. */
export function resetBlocker(quantities: Record<string, number>): string | null {
  const shortMW = quantities.demandMW - quantities.outputMW;
  // No running unit is the first thing to fix (R3 interaction P2), whatever the demand.
  if (!(quantities.outputMW > 0)) return "Reset unavailable: no unit is making power. Bring at least one unit online.";
  if (quantities.overload === 1) return `Reset unavailable: demand is still ${formatMW(shortMW)} MW above available generation.`;
  return null;
}
const formatMW = (mw: number) => String(Math.round(mw * 10) / 10);

function resetAdvice(r: ReturnType<typeof evaluateHydro>): string {
  const blocker = resetBlocker({ overload: r.overload, demandMW: r.demandMW, outputMW: r.outputMW });
  return blocker ? `Reduce demand or bring enough units online, then reset the plant. ${blocker}` : "Conditions are safe now: press Reset plant to restore power.";
}

const lanes = (q: number) => q <= 0 ? 0 : Math.ceil(q / DESIGN_FLOW_PER_UNIT - 1e-9);

/** Water quantities a renderer may draw (06 water section). Derived here so no renderer computes a consequence. */
function waterQuantities(r: ReturnType<typeof evaluateHydro>): Record<string, number> {
  const generating = (unit: number) => r.statuses[unit - 1] === "generating";
  const unitFlow = (unit: number) => generating(unit) ? round6(r.shares[unit]) : 0;
  const tailraceFlow = round6([1, 2, 3, 4].reduce((sum, unit) => sum + unitFlow(unit), 0));
  const width = (q: number) => round6(Math.sqrt(q / MAX_RIVER_FLOW));
  return {
    upstreamFlow: r.riverFlow, headpondInflow: r.riverFlow, tailraceFlow, downstreamFlow: round6(tailraceFlow + r.spillFlow), headpondLevel: 1,
    upstreamWidthFactor: width(r.riverFlow), downstreamWidthFactor: width(r.riverFlow),
    upstreamDepthFactor: round6(Math.cbrt(r.riverFlow / MAX_RIVER_FLOW)), downstreamDepthFactor: round6(Math.cbrt(r.riverFlow / MAX_RIVER_FLOW)),
    tailraceWidthFactor: width(tailraceFlow), spillWidthFactor: width(r.spillFlow),
    riverLanes: lanes(r.riverFlow), downstreamLanes: lanes(r.riverFlow), tailraceLanes: [1, 2, 3, 4].filter(generating).length, spillLanes: lanes(r.spillFlow),
    ...Object.fromEntries([1, 2, 3, 4].flatMap((unit) => [
      [`u${unit}Flow`, unitFlow(unit)], [`u${unit}FillFactor`, round6(unitFlow(unit) / DESIGN_FLOW_PER_UNIT)], [`u${unit}Idle`, r.statuses[unit - 1] === "idle" ? 1 : 0],
    ])),
  };
}

export const hydropowerModel: SimulationModel = {
  id: "mount-coffee-run-of-river",
  version: "1.2.0",
  kind: "deterministic-rules",
  evaluate: (input): SimulationOutput => {
    const r = evaluateHydro(input);
    const generating = (unit: number) => r.statuses[unit - 1] === "generating";
    const quantities: Record<string, number> = {
      riverFlow: r.riverFlow, usableFlow: round6(r.usableFlow), outputMW: r.outputMW, demandMW: r.demandMW, suppliedMW: r.suppliedMW,
      tripped: r.tripped, overload: r.overload, protectionLatched: r.latched, turbineFlow: round6(r.turbineFlow), spillFlow: r.spillFlow, unit3Ready: r.unit3Ready,
      unitsAvailable: r.unit3Ready ? 4 : 3, unitsRunning: r.running.length, unitsGenerating: [1, 2, 3, 4].filter(generating).length,
      gridStableWithPriority: r.gridStableWithPriority, headroomMW: r.headroomMW, maxLoadServed: r.maxLoadServed,
      // dry-season-output: capability (not delivery) with all four units switched on; more units cannot add water.
      capabilityAllUnitsMW: r.unitsOnline === 4 ? r.outputMW : 0, unitsOnline: r.unitsOnline,
      ...waterQuantities(r),
      ...Object.fromEntries([1, 2, 3, 4].flatMap((unit) => [[`u${unit}PowerMW`, r.unitPower(unit)], [`u${unit}Generating`, generating(unit) ? 1 : 0]])),
    };
    const flow = (active: boolean, rate: number) => ({ active, rate: active ? round6(rate) : 0, direction: 1 as const });
    const feederOn = { hospital: r.feeders.hospital === 1, homes: r.feeders.homes > 0, shops: r.feeders.shops > 0 };
    const flows: SimulationOutput["flows"] = {
      "river-in": flow(true, r.riverFlow / MAX_RIVER_FLOW),
      ...Object.fromEntries([1, 2, 3, 4].map((unit) => [`water-u${unit}`, flow(generating(unit), r.shares[unit] / DESIGN_FLOW_PER_UNIT)])),
      spillway: flow(r.spillFlow > 0, r.spillFlow / MAX_RIVER_FLOW),
      "power-line": flow(r.suppliedMW > 0, r.suppliedMW / 88),
      "feeder-hospital": flow(feederOn.hospital && !r.tripped, HOSPITAL_MW / 48),
      "feeder-homes": flow(feederOn.homes && !r.tripped, r.feeders.homes / 4),
      "feeder-shops": flow(feederOn.shops && !r.tripped, r.feeders.shops / 12),
    };
    const componentStates: SimulationOutput["componentStates"] = {};
    for (let k = 1; k <= 4; k += 1) componentStates[`gauge-seg-${k}`] = { intensity: round6(Math.min(1, Math.max(0, (r.outputMW - 22 * (k - 1)) / 22))) };
    componentStates["demand-hospital"] = { intensity: feederOn.hospital ? 1 : 0 };
    componentStates["city-hospital"] = { intensity: feederOn.hospital && !r.tripped ? 1 : 0 };
    for (const district of ["homes", "shops"] as const) for (let k = 1; k <= BLOCKS_PER_DISTRICT; k += 1) {
      const on = k <= r.feeders[district];
      componentStates[`demand-${district}-b${k}`] = { intensity: on ? 1 : 0 };
      componentStates[`city-${district}-b${k}`] = { intensity: on && !r.tripped ? 1 : 0 };
    }
    // Every unit's housing and pole marker carry its status (RX-001 motion driver); unit 3's internal stack does too.
    for (let unit = 1; unit <= 4; unit += 1) {
      componentStates[`unit-${unit}`] = { status: r.statuses[unit - 1] };
      // The unit lamp glows only while the unit is generating (idle, off, tripped and out-for-repair stay dark).
      componentStates[`unit-${unit}-marker`] = { status: r.statuses[unit - 1], intensity: r.statuses[unit - 1] === "generating" ? 1 : 0 };
    }
    for (const part of UNIT3_STACK) componentStates[part] = { status: r.statuses[2] };
    return { quantities, flows, componentStates, explanation: explain(r) };
  },
};
