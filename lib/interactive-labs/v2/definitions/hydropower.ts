import type { InteractiveLabDefinition, LabState, Transform } from "../types";
import { composeHighFidelity } from "../fidelity/engine";
import { HIGH_FIDELITY_SPEC_VERSION, type HighFidelitySpec } from "../fidelity/types";
import { bladedRunnerKit, generatorHousingKit, latticeTowerKit, pipeKit } from "../fidelity/kits";
import { hydropowerModel, resetBlocker, RIVER_FLOW_STEPS, SYNCHRONOUS_RPM, UNIT3_STACK, UNIT_X } from "./hydropowerModel";

export const HYDROPOWER_LAB_ID = "mount-coffee-hydropower";
const OBJECTIVE_ID = "hydropower-cause-and-effect";
const CONCEPT_ID = "hydropower-energy-chain";
const tr = (position: [number, number, number], scale: [number, number, number], rotation: [number, number, number] = [0, 0, 0]): Transform => ({ position, rotation, scale });
const mat = (color: string, opacity = 1) => ({ color, roughness: 0.72, metalness: 0.18, ...(opacity < 1 ? { opacity } : {}) });
function component(id: string, label: string, geometry: "box" | "cylinder" | "cone" | "rectangular-prism" | "panel", position: [number, number, number], scale: [number, number, number], color: string, extra: Record<string, unknown> = {}) {
  return { id, label, geometry, transform: tr(position, scale), material: mat(color), ...extra };
}

// Valley decor (HIGH/STANDARD only; LOW drops decor): the plant sits in terrain instead of floating above a flat
// floor. Deterministic heights; no state, labels or picking (RX-003). Heights are relative to the ground plane.
const GROUND_Y = -2.25;
const smooth = (a: number, b: number, t: number) => { const u = Math.min(1, Math.max(0, (t - a) / (b - a))); return u * u * (3 - 2 * u); };
/** Terrain height above GROUND_Y at world (x, z): river floodplain, powerhouse terrace, city rise, headpond plateau, hills. */
export function valleyHeight(x: number, z: number): number {
  let h = 0.45;                                                      // floodplain just under the downstream river
  h += 0.6 * smooth(1.2, -0.2, z);                                   // terrace behind the river (powerhouse)
  h += 1.3 * smooth(2.6, 4.8, x) * smooth(0.9, 0.2, z);              // city rise, kept clear of the river channel
  h += 4.05 * smooth(-0.7, -1.7, z) * (1 - smooth(4.2, 5.6, x));     // plateau at the headpond level behind the dam
  h += 0.5 * smooth(2.6, 4.2, z);                                    // far bank
  h += (2.4 + 0.8 * Math.sin(x * 0.55)) * smooth(-5.5, -9.5, z);     // hills behind the headpond
  h += 2.2 * smooth(-9, -15, x) + 2.2 * smooth(10, 16, x);           // valley sides
  return Math.round(h * 1000) / 1000;
}
const VALLEY = { rows: 24, columns: 48, size: [36, 20] as const, centre: [0.5, -1.5] as const, anchorDrop: 4 };
const FOREST_ANCHOR: [number, number, number] = [0, -8, 0];
const valleyHeights = Array.from({ length: VALLEY.rows * VALLEY.columns }, (_, i) => {
  const r = Math.floor(i / VALLEY.columns), c = i % VALLEY.columns;
  return VALLEY.anchorDrop + valleyHeight(VALLEY.centre[0] + (c / (VALLEY.columns - 1) - 0.5) * VALLEY.size[0], VALLEY.centre[1] + (r / (VALLEY.rows - 1) - 0.5) * VALLEY.size[1]);
});
const treePositions = Array.from({ length: 56 }, (_, i) => {
  // Deterministic placement on the hills and valley sides (golden-angle spread, no randomness).
  const t = i * 2.39996323, x = -16 + ((i * 7.31) % 34), z = -6.2 - ((i * 3.17 + Math.sin(t) * 2) % 4.6);
  const sideX = i % 4 === 0 ? (i % 8 === 0 ? -11.5 - (i % 3) : 11 + (i % 3)) : x;
  const sideZ = i % 4 === 0 ? -1 + ((i * 1.3) % 6) : z;
  return [sideX - FOREST_ANCHOR[0], GROUND_Y + valleyHeight(sideX, sideZ) - FOREST_ANCHOR[1], sideZ - FOREST_ANCHOR[2]] as [number, number, number];
});
const treeProfile: readonly (readonly [number, number])[] = [[0, 0], [0.34, 0.18], [0.05, 1.05], [0, 1.1]];

/** One shared control colour so LOW batches every control part into one draw; the labelled chips carry meaning (not colour). */
const CONTROL_COLOR = "#e2e8f0";

const components: HighFidelitySpec["components"] = [
  // Water components are the instructional (pickable, labelled) parts; RX-005b surfaces draw the water itself.
  component("headpond", "Headpond", "rectangular-prism", [-1.5, 2.9, -2.5], [4.7, 0.18, 1.4], "#2f8fe8", { labelOffset: [-0.35, 0.9, 0], material: mat("#2f8fe8", 0.08) }),
  component("dam", "Dam", "rectangular-prism", [-1.5, 2.15, -1.2], [4.8, 1.5, 0.38], "#c9c2b4", { labelOffset: [-2.8, -0.15, 0] }),
  component("intake-1", "Intake", "box", [-1.5, 1.6, -0.9], [0.54, 0.28, 0.5], "#9fb2c6", { labelOffset: [-0.1, 0.65, 0] }),
  { ...pipeKit({ id: "penstock-1", label: "Penstock", transform: tr([-1.5, 0.72, -0.35], [0.2, 1.25, 0.2]), color: "#6f86a0", points: [[0,-1,0],[0,1,0]], radius: 1 }), labelOffset: [-0.55, 0.15, 0] },
  component("tailrace", "Tailrace", "rectangular-prism", [-1.5, -1.15, 0.8], [2.5, 0.16, 0.52], "#2f8fe8", { labelOffset: [-0.3, -0.45, 0], material: mat("#2f8fe8", 0.08) }),
  component("river-downstream", "Saint Paul River", "rectangular-prism", [0, -1.8, 1.6], [5.8, 0.12, 0.5], "#2f8fe8", { labelOffset: [1.7, -0.3, 0], material: mat("#2f8fe8", 0.08) }),
  component("spillway-gate", "Spillway gate", "box", [-3.3, 2.4, -1.0], [0.65, 0.8, 0.18], "#9fb2c6", { labelOffset: [0.55, 0.45, 0], mobileLabel: false }),
  component("powerhouse", "Powerhouse", "rectangular-prism", [0.3, 0.15, 0.1], [2.15, 1.7, 1.5], "#d8d2c4", { material: mat("#d8d2c4", 0.22), labelOffset: [0, 1.05, 0], mobileLabel: false }),
  ...UNIT_X.flatMap((x, i) => {
    const unit = i + 1;
    const offsets: Array<[number, number, number]> = [[-1.8, 0.65, 0], [-0.45, 1.8, 0], [0.5, 0.55, 0], [1.15, 1.3, 0]];
    return [component(`unit-${unit}`, `Unit ${unit} housing`, "cylinder", [x, -0.15, 0.1], [0.52, 0.72, 0.52], "#5fb8a8", { labelOffset: unit === 1 ? [-0.9, 0.95, 0] : offsets[i], ...(unit !== 3 ? { mobileLabel: false } : {}) }),
      component(`unit-${unit}-marker`, `Unit ${unit} rotation marker`, "box", [x + 0.34, -0.15, 0.1], [0.16, 0.08, 0.08], "#facc15", { showLabel: false, selectable: false })];
  }),
  { ...component("u3-runner", "Runner", "cylinder", [0.9, -0.25, 0.1], [0.32, 0.18, 0.32], "#9a6b2f", { internal: true, layerId: "unit-3-internals", shapeKey: "runner", labelOffset: [-0.8, -0.3, 0], mobileLabel: false }),
    geometryVariants: bladedRunnerKit({ id: "u3-runner-shape", label: "Runner", transform: tr([0, 0, 0], [1, 1, 1]), color: "#9a6b2f", radius: 1, bladeCount: 9 })[1].geometryVariants },
  component("u3-shaft", "Shaft", "cylinder", [0.9, 0.05, 0.1], [0.09, 0.36, 0.09], "#5f6d7e", { internal: true, layerId: "unit-3-internals", shapeKey: "shaft", labelOffset: [0, 0.2, 0], mobileLabel: false }),
  { ...generatorHousingKit({ id: "u3-generator", label: "Generator", transform: tr([0.9, 0.48, 0.1], [0.34, 0.28, 0.34]), color: "#ee8f52", radius: 1, height: 2 }), internal: true, layerId: "unit-3-internals", shapeKey: "generator", labelOffset: [0.8, 0.4, 0], mobileLabel: false },
  component("switchyard", "Switchyard", "panel", [3.1, 0.2, 0.1], [0.9, 0.8, 0.18], "#aab4c0", { mobileLabel: false }),
  { ...latticeTowerKit({ id:"power-tower-1",label:"Transmission tower",transform:tr([4.0,1.4,0],[0.48,1.3,0.48]),color:"#aab4c0",width:1,height:2,depth:1 }), showLabel:false },
  component("city-hospital", "Hospital", "rectangular-prism", [5.0, 0.35, 0], [0.4, 0.95, 0.5], "#96a3b6"),
  component("hospital-sign", "Hospital H sign", "panel", [5.0, 1.1, 0.28], [0.22, 0.2, 0.06], "#2f6fe0", { showLabel: false, selectable: false }),
  // v1.1 feeder blocks (06-V1_1_SIMULATION_DELTA): four homes blocks and four shops blocks, each lit or dark on its own.
  ...[1, 2, 3, 4].map((k) => component(`city-homes-b${k}`, k === 1 ? "Homes" : `Homes block ${k}`, "rectangular-prism", [5.55 + (k - 1) * 0.5, 0.25 + (k % 2) * 0.08, 0.15], [0.38, 0.72 + (k % 2) * 0.16, 0.48], "#7a869a", k === 1 ? { labelOffset: [0.4, 1.1, 0] } : { showLabel: false, selectable: false })),
  ...[1, 2, 3, 4].map((k) => component(`city-shops-b${k}`, k === 1 ? "Shops" : `Shops block ${k}`, "rectangular-prism", [7.75 + (k - 1) * 0.42, 0.15, -0.1], [0.3, 0.6, 0.42], "#7a869a", k === 1 ? { labelOffset: [0.3, 1.0, 0] } : { showLabel: false, selectable: false })),
  // Gauge rows (R2 P1-7): supply above (4 × 22 MW), demand below; box half-width = MW × 0.01 so length ∝ MW.
  ...[1, 2, 3, 4].map((n) => component(`gauge-seg-${n}`, `Power gauge ${n}`, "box", [4.6 + (n - 0.5) * 0.46, 2.55, 0], [0.21, 0.1, 0.06], "#8c9ab0", { showLabel: false, selectable: false })),
  component("demand-hospital", "hospital demand segment", "box", [4.6 + 0.04, 2.25, 0], [0.04, 0.1, 0.06], "#c98a4b", { showLabel: false, selectable: false }),
  ...[1, 2, 3, 4].map((k) => component(`demand-homes-b${k}`, `homes block ${k} demand segment`, "box", [4.6 + 0.08 + (k - 0.5) * 0.25, 2.25, 0], [0.115, 0.1, 0.06], "#c98a4b", { showLabel: false, selectable: false })),
  ...[1, 2, 3, 4].map((k) => component(`demand-shops-b${k}`, `shops block ${k} demand segment`, "box", [4.6 + 1.08 + (k - 0.5) * 0.09, 2.25, 0], [0.035, 0.1, 0.06], "#c98a4b", { showLabel: false, selectable: false })),
  // RX-005c in-scene controls (05 pedagogy delta §2): each dispatches the same set-variable as its panel twin.
  // River-gauge post upstream: the season is a condition to test, chosen where the water arrives.
  component("river-gauge-post", "River gauge: choose a season to test", "cylinder", [-5.55, 3.35, -1.75], [0.05, 0.75, 0.05], "#5f6d7e", { showLabel: false }),
  ...([[49, "Dry"], [176, "Early rains"], [303, "Heavy rains"], [430, "Rainy, full"], [557, "Flood"]] as const).map(([value, name], i) =>
    component(`gauge-band-${i + 1}`, `Season: ${name}`, "box", [-5.35, 2.75 + i * 0.29, -1.75], [0.16, 0.12, 0.05], CONTROL_COLOR, { showLabel: false, control: { kind: "set-variable", variableId: "riverFlow", value, label: name, groupLabel: "Season (river gauge)" } })),
  // Powerhouse control desk: units start and stop in the fixed dispatch order, so the desk offers next/last only.
  component("desk-start-next", "Start the next unit", "box", [-0.15, -0.72, 1.35], [0.2, 0.12, 0.14], CONTROL_COLOR, { showLabel: false, control: { kind: "step-variable", variableId: "unitsOnline", direction: 1, label: "Start next unit", group: "desk", groupLabel: "Units (powerhouse desk)" } }),
  component("desk-stop-last", "Stop the last unit", "box", [0.35, -0.72, 1.35], [0.2, 0.12, 0.14], CONTROL_COLOR, { showLabel: false, control: { kind: "step-variable", variableId: "unitsOnline", direction: -1, label: "Stop last unit", group: "desk", groupLabel: "Units (powerhouse desk)" } }),
  // Switchyard breakers, in the same frame as the city they feed.
  component("breaker-hospital", "Hospital breaker", "box", [2.6, -0.45, 0.55], [0.14, 0.2, 0.1], CONTROL_COLOR, { showLabel: false, control: { kind: "toggle-variable", variableId: "feederHospital", label: "Hospital on/off", group: "switchyard", groupLabel: "Load (switchyard breakers)" } }),
  component("breaker-homes-less", "Homes: one block off", "box", [2.95, -0.45, 0.55], [0.12, 0.16, 0.1], CONTROL_COLOR, { showLabel: false, control: { kind: "step-variable", variableId: "homesBlocks", direction: -1, label: "Homes −", group: "switchyard", groupLabel: "Load (switchyard breakers)" } }),
  component("breaker-homes-more", "Homes: one block on", "box", [3.2, -0.45, 0.55], [0.12, 0.16, 0.1], CONTROL_COLOR, { showLabel: false, control: { kind: "step-variable", variableId: "homesBlocks", direction: 1, label: "Homes +", group: "switchyard", groupLabel: "Load (switchyard breakers)" } }),
  component("breaker-shops-less", "Shops: one block off", "box", [3.55, -0.45, 0.55], [0.12, 0.16, 0.1], CONTROL_COLOR, { showLabel: false, control: { kind: "step-variable", variableId: "shopsBlocks", direction: -1, label: "Shops −", group: "switchyard", groupLabel: "Load (switchyard breakers)" } }),
  component("breaker-shops-more", "Shops: one block on", "box", [3.8, -0.45, 0.55], [0.12, 0.16, 0.1], CONTROL_COLOR, { showLabel: false, control: { kind: "step-variable", variableId: "shopsBlocks", direction: 1, label: "Shops +", group: "switchyard", groupLabel: "Load (switchyard breakers)" } }),
  component("distance-break", "Approx. 30 km to Monrovia", "panel", [7.8, 2.1, 0.2], [0.5, 0.08, 0.04], "#f8fafc", { labelOffset: [-1.2, 1.4, 0], mobileLabel: false }),
  // Decorative valley scenery: no labels, state, picking, or instructional references.
  component("bank-lower", "", "rectangular-prism", [-3, 0.6, -2.2], [5, 0.18, 0.18], "#4a7a45", { detail: "decor", selectable: false }),
  component("bank-upper", "", "rectangular-prism", [-5, -0.8, -2.4], [4, 0.16, 0.16], "#b06a42", { detail: "decor", selectable: false }),
  ...[0, 1, 2].map((n) => component(`transmission-pylon-${n + 1}`, `Transmission pylon ${n + 1}`, "cone", [3.3 + n * 0.7, 1.4, -1.2], [0.2, 0.85, 0.2], "#5f6d7e", { selectable: false })),
  ...[0, 1, 2, 3, 4, 5].map((n) => component(`forest-${n + 1}`, "", "cone", [-5.3 + n * 0.45, 0.4, -2.0], [0.28, 0.55, 0.28], "#4a7a45", { detail: "decor", selectable: false })),
  { ...component("valley-terrain", "", "box", [VALLEY.centre[0], GROUND_Y - VALLEY.anchorDrop, VALLEY.centre[1]], [1, 1, 1], "#8aa676", { detail: "decor", selectable: false }),
    geometryVariants: { HIGH: { kind: "heightfield", rows: VALLEY.rows, columns: VALLEY.columns, size: VALLEY.size, heights: valleyHeights }, STANDARD: { kind: "sameAs", profile: "HIGH" },
      LOW: { kind: "heightfield", rows: 2, columns: 2, size: VALLEY.size, heights: [0, 0, 0, 0] },
      FALLBACK_2D: { kind: "polygon", points: [[-18, VALLEY.anchorDrop], [18, VALLEY.anchorDrop], [18, VALLEY.anchorDrop + 0.15], [-18, VALLEY.anchorDrop + 0.15]], semanticLabel: "Saint Paul River valley floor" } } },
  { ...component("valley-forest", "", "cone", FOREST_ANCHOR, [1, 1, 1], "#3f6b3a", { detail: "decor", selectable: false }),
    geometryVariants: { HIGH: { kind: "scatter", seed: 23, prototype: { kind: "lathe", profile: treeProfile, radialSegments: 8 }, transforms: treePositions.map((position, i) => ({ position, rotation: [0, i * 0.7, 0] as [number, number, number], scale: [0.9 + (i % 3) * 0.15, 0.9 + (i % 4) * 0.2, 0.9 + (i % 3) * 0.15] as [number, number, number] })) },
      STANDARD: { kind: "sameAs", profile: "HIGH" }, LOW: { kind: "lathe", profile: treeProfile, radialSegments: 4 },
      FALLBACK_2D: { kind: "polygon", points: [[-14.3, 9], [-13.7, 9], [-14, 10]], semanticLabel: "forest" } } },
];

const tracePositions: Array<[number, string, [number, number, number], string?]> = [
  [0, "headpond", [-1.5, 2.9, -2.5], "headpond"], [1, "intake", [-1.5, 2.1, -1.2], "intake-1"],
  [2, "penstock", [-2.05, 1.0, -0.6], "penstock-1"], [3, "turbine", [-1.5, -0.2, 0], "unit-1"],
  [4, "tailrace", [-1.5, -1.0, 0.9], "tailrace"], [5, "downstream", [1.0, -2.0, 2.0], "river-downstream"],
];
const node = (id: string, label: string, position: [number, number, number], componentId?: string, traceable = false) => ({ id, label, position, ...(componentId ? { componentId } : {}), ...(traceable ? { traceable: true } : {}) });
const flows: HighFidelitySpec["flows"] = [
  { id: "river-in", label: "River flow", medium: "water", sourceNodeId: "river-source", destinationNodeId: "headpond-node", closedLoop: false, visibleByDefault: true, color: "#67e8f9", nodes: [node("river-source", "River", [-4, 2.9, -2.5]), node("headpond-node", "Headpond", [-1.5, 2.9, -2.5], "headpond")] },
  ...[1, 2, 3, 4].map((unit) => unit === 1
    ? ({ id: "water-u1", label: "Unit 1 water", medium: "water" as const, sourceNodeId: "headpond", destinationNodeId: "river-downstream", closedLoop: false, visibleByDefault: true, color: "#67e8f9", nodes: tracePositions.map(([i, label, position, componentId]) => node(i === 0 ? "headpond" : i === 5 ? "river-downstream" : `${label}-1`, label, position, componentId, true)) })
    : ({ id: `water-u${unit}`, label: `Unit ${unit} water`, medium: "water" as const, sourceNodeId: `water-u${unit}-in`, destinationNodeId: "river-downstream", closedLoop: false, visibleByDefault: true, color: "#67e8f9", nodes: [
      node(`water-u${unit}-in`, "Intake", [-1.5 + (unit - 1) * 0.5, 1.2, -0.4]),
      node(`water-u${unit}-turbine`, `Unit ${unit}`, [UNIT_X[unit - 1], -0.15, 0.1], `unit-${unit}`),
      node(`water-u${unit}-tailrace`, "Tailrace", [UNIT_X[unit - 1], -1.0, 0.8], "tailrace"),
      node("river-downstream", "Saint Paul River", [1.0, -2.0, 2.0], "river-downstream"),
    ] })),
  { id: "spillway", label: "Spillway", medium: "water", sourceNodeId: "spill-in", destinationNodeId: "spill-out", closedLoop: false, visibleByDefault: true, color: "#67e8f9", nodes: [node("spill-in", "Spillway gate", [-3.3, 2.2, -0.7], "spillway-gate"), node("spill-face", "Dam face", [-3.3, 1.15, 0.72]), node("spill-drop", "Spillway channel", [-3.3, -0.1, 0.92]), node("spill-out", "Downstream river", [-3.3, -1.5, 1.8], "river-downstream")] },
  { id: "power-line", label: "Transmission line", medium: "light", sourceNodeId: "power-source", destinationNodeId: "switchyard-node", closedLoop: false, visibleByDefault: true, color: "#facc15", nodes: [node("power-source", "Generator", [3, 0.2, 0], "switchyard"), node("switchyard-node", "Switchyard", [3.1, 0.2, 0], "switchyard")] },
  ...["hospital", "homes", "shops"].map((name, i) => ({ id: `feeder-${name}`, label: `${name} feeder`, medium: "light" as const, sourceNodeId: `feeder-${name}-in`, destinationNodeId: `feeder-${name}-out`, closedLoop: false, visibleByDefault: true, color: "#facc15", nodes: [node(`feeder-${name}-in`, "Switchyard", [3.1, 0.2, 0], "switchyard"), node(`feeder-${name}-out`, name, [5 + i * 1.3, 0.35, 0], name === "hospital" ? "city-hospital" : `city-${name}-b1`)] })),
];
// Ten physical flows: river-in, four turbine feeds, spillway, power-line and three city feeders (one per district). Unit 1 carries the trace nodes.

// RX-005b water (07 water language): volume follows the model; the headpond level never moves; the downstream
// river always matches the upstream river because turbine water plus spill equals river flow.
const surfaces: HighFidelitySpec["surfaces"] = [
  { id: "water-upstream", label: "Saint Paul River (upstream)", kind: "channel", medium: "water", path: [[-6.6, 2.93, -2.5], [-5.2, 2.93, -2.6], [-3.7, 2.93, -2.5]], baseWidth: 1.5, widthQuantity: "upstreamWidthFactor", activeQuantity: "upstreamFlow", rateQuantity: "upstreamWidthFactor" },
  { id: "water-headpond", label: "Headpond (operating level stays the same)", kind: "pool", medium: "water", path: [[-3.8, 3.22, -2.5], [0.8, 3.22, -2.5]], baseWidth: 1.7, activeQuantity: "headpondLevel", componentId: "headpond" },
  { id: "water-tailrace", label: "Tailrace", kind: "channel", medium: "water", path: [[-2.4, -1.06, 0.8], [1.8, -1.06, 0.8]], baseWidth: 1.0, widthQuantity: "tailraceWidthFactor", activeQuantity: "tailraceFlow", rateQuantity: "tailraceWidthFactor", componentId: "tailrace" },
  { id: "water-downstream", label: "Saint Paul River (downstream)", kind: "channel", medium: "water", path: [[-4.6, -1.73, 1.6], [1.5, -1.73, 1.75], [7.6, -1.73, 1.6]], baseWidth: 1.6, widthQuantity: "downstreamWidthFactor", activeQuantity: "downstreamFlow", rateQuantity: "downstreamWidthFactor", componentId: "river-downstream" },
  { id: "water-spill", label: "Spillway water", kind: "sheet", medium: "water", path: [[-3.3, 2.2, -0.7], [-3.3, 1.15, 0.72], [-3.3, -0.1, 0.92], [-3.3, -1.5, 1.8]], baseWidth: 1.4, widthQuantity: "spillWidthFactor", activeQuantity: "spillFlow", rateQuantity: "spillWidthFactor" },
];

const spec: HighFidelitySpec = {
  specVersion: HIGH_FIDELITY_SPEC_VERSION,
  environment: "DAYLIGHT",
  surfaces,
  authoring: {
    learningObjective: "Explain how river flow, available turbine units and electricity demand affect hydropower generation and delivery.",
    whyInteractive: "Learners can change season, unit availability and feeder demand, then inspect the linked water, machine and grid consequences.",
    scene: "A simplified section view of the Mount Coffee run-of-river plant, Saint Paul River, powerhouse, switchyard and city feeders.",
    components: "Procedural dam, intake, penstock, turbine housings, transmission yard, city loads and a compact section stack for unit 3.",
    internalStructures: "Unit 3 runner, shaft and generator are exposed by the powerhouse cutaway and rebuilt in the repair check.",
    variables: "River flow has five discrete seasonal values; units online, the hospital feeder and four-block homes and shops districts are learner controlled.",
    simulationRules: "Deterministic capability model: water is dispatched in unit order; demand above capability trips delivery and the trip stays latched (learner choices kept, no automatic recovery) until an explicit Reset plant, which is accepted only when demand fits and a unit is generating; remaining water spills.",
    learnerControls: "In the scene: river-gauge season bands, a powerhouse desk (start next / stop last unit) and switchyard breakers (hospital, homes ±, shops ±); every one has a panel twin. Reset plant (HUD and panel) clears a latched trip once conditions are safe, and explains why when they are not. Also trace path, unit 3 cutaway and repair assembly.",
    visualConsequences: "River and tailrace width, spill sheet, water flow, unit rotation status, power gauge, feeder flow and city lighting follow the simulation; the headpond level never changes.",
    guidedPath: "Meet the plant, follow water, inspect unit 3, compare seasons, test overload, repair the unit, then explore the grid.",
    exploreMode: "Change all controls and inspect the explanation and energy path.",
    challenge: "Dry season, hospital lit: predict first, then switch on as much other load as fits without tripping the plant. Compare the spare MW with a homes block (12 MW) and a shops block (4 MW).",
    assessment: "Trace water, identify the generator, reach dry-season capability, stabilize priority supply and rebuild unit 3.",
    evidence: "All five checks remain RAW_OBSERVATION; the release binding is a fixture and this definition is DRAFT.",
    misconceptions: "A full headpond guarantees high output; more turbines create more water; generators spin faster with more water; a trip merely dims loads.",
    accessibility: "Every control has a label; the motion group exposes status text; reduced motion suppresses pulses; all checks work in 2D.",
    deviceProfile: "LOW omits scenery and batches flow geometry; all instructional components remain within the locked profile budget.",
    offlineFallback: "Procedural geometry and local rules only; no remote assets; FALLBACK_2D supports all controls and checks.",
  },
  // RX-005 A1: every check-critical part is named and tappable on every profile; the unit-1 lamp also carries status.
  components: components.map((component) => {
    const critical = /^(gauge-band-\d|desk-(start-next|stop-last)|breaker-.+|headpond|intake-1|penstock-1|tailrace|river-downstream|u3-(runner|shaft|generator))$/.test(component.id);
    return component.id === "unit-1" ? { ...component, semanticCues: ["label", "target", "status"] as const } : critical ? { ...component, semanticCues: ["label", "target"] as const } : component;
  }),
  assemblies: [{ id: "unit-3", label: "Unit 3 machine", rootComponentId: "unit-3", componentIds: [...UNIT3_STACK], slots: [
    { id: "slot-runner", label: "Runner position", accepts: "runner", transform: tr([0.9, -0.25, 0.1], [0.32, 0.18, 0.32]), initialComponentId: "u3-runner" },
    { id: "slot-shaft", label: "Shaft position", accepts: "shaft", transform: tr([0.9, 0.05, 0.1], [0.09, 0.36, 0.09]), initialComponentId: "u3-shaft" },
    { id: "slot-generator", label: "Generator position", accepts: "generator", transform: tr([0.9, 0.48, 0.1], [0.34, 0.28, 0.34]), initialComponentId: "u3-generator" },
  ], dependencies: [{ from: "u3-runner", to: "u3-shaft", label: "turns the" }, { from: "u3-shaft", to: "u3-generator", label: "drives the" }] }],
  exploded: [{ assemblyId: "unit-3", cameraPresetId: "exploded-bench", offsets: { "u3-runner": [0, -1.05, 0.85], "u3-shaft": [0, 0, 1.05], "u3-generator": [0, 1.05, 0.85] } }],
  cutaways: [{ id: "powerhouse-section", label: "Open the powerhouse section", plane: { normal: [0, 0, 1], offset: 0 }, removesComponentIds: ["powerhouse"], revealsComponentIds: [...UNIT3_STACK], cameraPresetId: "powerhouse-section" }],
  layers: [{ id: "unit-3-internals", label: "Unit 3 internal machine", defaultVisible: true }],
  poseTransitions: [],
  variables: [
    { id: "riverFlow", label: "River flow", unit: "m³/s", kind: "discrete", min: 49, max: 557, step: 127, initial: 430, learnerControlled: true, description: "Choose a seasonal flow scenario." },
    { id: "unitsOnline", label: "Units online", kind: "discrete", min: 0, max: 4, step: 1, initial: 4, learnerControlled: true },
    { id: "feederHospital", label: "Hospital feeder", kind: "toggle", min: 0, max: 1, step: 1, initial: 1, learnerControlled: true, description: "The hospital is always the priority load (4 MW)." },
    { id: "homesBlocks", label: "Homes blocks on", kind: "discrete", min: 0, max: 4, step: 1, initial: 4, learnerControlled: true, description: "Each homes block needs 12 MW (model number)." },
    { id: "shopsBlocks", label: "Shops blocks on", kind: "discrete", min: 0, max: 4, step: 1, initial: 4, learnerControlled: true, description: "Each shops block needs 4 MW (model number)." },
    // Founder decision 2026-10-02: overload protection trips are latched. Held by the engine, never set directly.
    { id: "protectionLatched", label: "Plant tripped", kind: "toggle", min: 0, max: 1, step: 1, initial: 0, learnerControlled: false },
  ],
  simulation: hydropowerModel,
  motions: [1, 2, 3, 4].map((unit) => ({ id: `unit-${unit}-spin`, label: `Unit ${unit} rotation`, componentIds: [`unit-${unit}`, `unit-${unit}-marker`, ...(unit === 3 ? [...UNIT3_STACK] : [])], pivot: [UNIT_X[unit - 1], -0.15, 0.1] as [number, number, number], axis: "y" as const, rpm: SYNCHRONOUS_RPM, symmetryOrder: 1, activeWhen: { componentId: `unit-${unit}`, statuses: ["generating"] } })),
  flows,
  camera: { defaultPresetId: "valley", presets: [
    { id: "valley", label: "Whole valley", target: [1.8, 0.3, 0.2], distance: 17.5, yaw: -0.48, pitch: 0.56 },
    { id: "water-path", label: "Water route", target: [-1.3, 0.7, 0], distance: 8, yaw: 0.15, pitch: 0.2 },
    { id: "powerhouse-section", label: "Powerhouse section", target: [0.3, 0.2, 0.1], distance: 7, yaw: 0.2, pitch: 0.1 },
    { id: "unit-bench", label: "Unit 3 bench", target: [0.9, 0.2, 0.1], distance: 5, yaw: 0.2, pitch: 0.1 },
    { id: "exploded-bench", label: "Exploded unit 3", target: [0.9, 0.15, 0.1], distance: 9, yaw: 0.2, pitch: 0.1 },
    { id: "grid-city", label: "Power and city", target: [6.6, 0.9, 0.2], distance: 8.5, yaw: -0.18, pitch: 0.3 },
  ], constraints: { minDistance: 2.5, maxDistance: 28, minPitch: 0.02, maxPitch: 1.25, minYaw: -1.75, maxYaw: 1.75 } },
  guidedPath: [
    { id: "meet", prompt: "Meet the plant: the Saint Paul River feeds a narrow headpond behind the dam. Find the powerhouse, the switchyard and the city it supplies.", cameraPresetId: "valley" },
    { id: "trace", prompt: "Follow the water from the headpond, through a turbine, and back to the river.", cameraPresetId: "water-path", highlightIds: ["headpond", "penstock-1", "tailrace"] },
    { id: "machine", prompt: "Open the powerhouse section and find the generator in unit 3.", cameraPresetId: "unit-bench", highlightIds: ["u3-generator"] },
    // R3 interaction P1: each load-bearing step starts in its intended, untripped state (hospital + one shops block
    // fits even the dry season), so the guided path never inherits a latched trip from an earlier step.
    { id: "season", prompt: "Predict: will the headpond drop in the dry season? Then compare dry season with rainy season. What changes when less water arrives?", cameraPresetId: "valley", variables: { riverFlow: 430, unitsOnline: 4, feederHospital: 1, homesBlocks: 0, shopsBlocks: 1 } },
    { id: "overload", prompt: "Three units in the rainy season make 66 MW. The hospital and all 4 homes blocks are on (52 MW). Add shops blocks one at a time: which block trips the plant? Then switch that block off and press Reset plant to bring the power back.", cameraPresetId: "grid-city", variables: { riverFlow: 430, unitsOnline: 3, feederHospital: 1, homesBlocks: 4, shopsBlocks: 0 } },
    { id: "repair", prompt: "Rebuild unit 3 in order: runner, shaft, generator.", cameraPresetId: "unit-bench", highlightIds: ["u3-runner", "u3-shaft", "u3-generator"], variables: { riverFlow: 430, unitsOnline: 4, feederHospital: 1, homesBlocks: 4, shopsBlocks: 2 } },
    { id: "energy-chain", prompt: "Name the energy chain: gravitational potential energy of high water → kinetic energy of falling water → turbine and shaft rotation → electrical energy → light and heat. Use the explanation panel to check your thinking.", cameraPresetId: "valley", variables: { riverFlow: 430, unitsOnline: 4, feederHospital: 1, homesBlocks: 4, shopsBlocks: 4 } },
  ],
  modes: ["GUIDED", "EXPLORE", "CHALLENGE", "ASSESSMENT"],
  // R2 pedagogy P1-1 / P1-3: the challenge starts under-loaded (learner must add what fits, not shed until lit);
  // assessment starts from the lab's initial conditions so no check is pre-solved by the challenge.
  modeStart: {
    CHALLENGE: { variables: { riverFlow: 49, unitsOnline: 4, feederHospital: 1, homesBlocks: 0, shopsBlocks: 0 }, cameraPresetId: "grid-city" },
    ASSESSMENT: { variables: { riverFlow: 430, unitsOnline: 4, feederHospital: 1, homesBlocks: 4, shopsBlocks: 4 } },
  },
  hud: [
    { quantityId: "outputMW", label: "Plant can make", unit: "MW", digits: 0 },
    { quantityId: "demandMW", label: "City asks for", unit: "MW", digits: 0 },
    { quantityId: "headroomMW", label: "Spare", unit: "MW", digits: 1 },
    { quantityId: "riverFlow", label: "River", unit: "m³/s", digits: 0 },
    { quantityId: "unitsRunning", label: "Units on", digits: 0 },
  ],
  hudAlert: (q) => q.tripped === 1
    ? { text: `PLANT TRIPPED — Demand exceeded available generation. ${resetBlocker(q) ?? "Demand fits now: press Reset plant to restore power."}`, tone: "danger" }
    : q.spillFlow > 0 ? { text: `Spilling ${Math.round(q.spillFlow)} m³/s: more water than the running turbines can take`, tone: "info" } : null,
  protection: { latchVariableId: "protectionLatched", overloadQuantityId: "overload", resetLabel: "Reset plant", resetBlocker },
  challengeStatus: (quantities) => quantities.gridStableWithPriority === 1
    ? "Hospital supply is stable in the dry season. Challenge met."
    : quantities.tripped === 1 ? "Tripped: work out which change was too much, put it right, then reset the plant."
    : "Not met yet: in the dry season, keep the hospital lit and switch on every block that still fits without a trip.",
  offline: { remoteAssets: [], maxPackageBytes: 96_000 },
};

const base: InteractiveLabDefinition<LabState> = {
  contractVersion: "interactive-lab-definition/2.0.0", id: HYDROPOWER_LAB_ID, version: "1.1.0", title: "Mount Coffee hydropower", summary: "Explore how water, turbines and electricity demand shape the power supplied by a run-of-river plant.", grade: 8, subject: "SCIENCE",
  objectiveIds: [OBJECTIVE_ID], conceptIds: [CONCEPT_ID], releaseBinding: { releaseId: "fixture-unreleased", releaseIdentity: "fixture", activityId: HYDROPOWER_LAB_ID, activityVersion: "1.1.0" },
  provenance: { source: "Mount Coffee design-stage lab", reference: "docs/labs/mount-coffee-hydropower/", author: "LiberiaLearn Interactive Lab Production Team" },
  reviewState: "DRAFT", approvalState: "PENDING", scene: { objects: [], lighting: { ambient: "#9aa8c7", key: "#fff1d0" }, camera: { fov: 42, minDistance: 4, maxDistance: 20 } },
  interactions: ["set-variable", "trace", "cutaway", "assemble", "inspect", "camera", "answer/check"],
  initialState: { mode: "GUIDED", selectedObjectId: null, focusedObjectId: null, rotations: {}, highlightedFeatures: {}, netObjectIds: [], completedChecks: [], retries: 0, hints: 0, lastFeedback: null },
  validateAction: (_state, action) => action.type === "mode" || action.type === "reset" ? { ok: true } : { ok: false, reason: "Use the high-fidelity lab controls." },
  transition: (state, action) => action.type === "reset" ? { ...base.initialState } : action.type === "mode" ? { ...state, mode: action.mode, lastFeedback: null } : state,
  checks: [
    { id: "trace-water", prompt: "Trace the water through the six nodes, in order.", objectiveId: OBJECTIVE_ID, conceptId: CONCEPT_ID, kind: "direct-manipulation", answer: { flowId: "water-u1" }, fidelity: { kind: "trace-path", flowId: "water-u1" }, hints: ["Start at the headpond and follow the water back to the river."] },
    { id: "find-generator", prompt: "Open the powerhouse section and identify unit 3's generator.", objectiveId: OBJECTIVE_ID, conceptId: CONCEPT_ID, kind: "direct-manipulation", answer: { componentId: "u3-generator" }, fidelity: { kind: "identify-component", componentId: "u3-generator" }, hints: ["Use the powerhouse section cutaway."] },
    { id: "dry-season-output", prompt: "With all four units on, set the season so the plant can make only about 10 MW (8–12).", objectiveId: OBJECTIVE_ID, conceptId: CONCEPT_ID, kind: "direct-manipulation", answer: { quantityId: "capabilityAllUnitsMW", min: 8, max: 12 }, fidelity: { kind: "reach-target", quantityId: "capabilityAllUnitsMW", min: 8, max: 12 }, hints: ["Units alone cannot do it: what limits how much water arrives each second?"] },
    { id: "dry-season-peak", prompt: "In the dry season, keep the hospital lit and switch on as much other load as fits without a trip.", objectiveId: OBJECTIVE_ID, conceptId: CONCEPT_ID, kind: "direct-manipulation", answer: { quantityId: "gridStableWithPriority", value: 1 }, fidelity: { kind: "reach-target", quantityId: "gridStableWithPriority", min: 1, max: 1 }, hints: ["Compare the spare MW with the size of a homes block (12 MW) and a shops block (4 MW)."] },
    { id: "repair-unit-3", prompt: "Rebuild unit 3 with its runner, shaft and generator in the matching slots.", objectiveId: OBJECTIVE_ID, conceptId: CONCEPT_ID, kind: "direct-manipulation", answer: { assemblyId: "unit-3" }, fidelity: { kind: "assemble", assemblyId: "unit-3" }, hints: ["Start by clearing the assembly, then place each matching part."] },
  ],
  accessibility: { touch: true, keyboard: true, reducedMotion: true, offline: true, fallback: "FALLBACK_2D" },
};

export const hydropowerDefinition: InteractiveLabDefinition<LabState> = composeHighFidelity(base, spec);
export const HYDROPOWER_RIVER_FLOW_STEPS = RIVER_FLOW_STEPS;
