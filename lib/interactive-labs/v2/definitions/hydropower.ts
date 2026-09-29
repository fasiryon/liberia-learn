import type { InteractiveLabDefinition, LabState, Transform } from "../types";
import { composeHighFidelity } from "../fidelity/engine";
import { HIGH_FIDELITY_SPEC_VERSION, type HighFidelitySpec } from "../fidelity/types";
import { hydropowerModel, RIVER_FLOW_STEPS, SYNCHRONOUS_RPM, UNIT3_STACK, UNIT_X } from "./hydropowerModel";

export const HYDROPOWER_LAB_ID = "mount-coffee-hydropower";
const OBJECTIVE_ID = "hydropower-cause-and-effect";
const CONCEPT_ID = "hydropower-energy-chain";
const tr = (position: [number, number, number], scale: [number, number, number], rotation: [number, number, number] = [0, 0, 0]): Transform => ({ position, rotation, scale });
const mat = (color: string, opacity = 1) => ({ color, roughness: 0.72, metalness: 0.18, ...(opacity < 1 ? { opacity } : {}) });
function component(id: string, label: string, geometry: "box" | "cylinder" | "cone" | "rectangular-prism" | "panel", position: [number, number, number], scale: [number, number, number], color: string, extra: Record<string, unknown> = {}) {
  return { id, label, geometry, transform: tr(position, scale), material: mat(color), ...extra };
}

const components: HighFidelitySpec["components"] = [
  component("headpond", "Headpond", "rectangular-prism", [-1.5, 2.9, -2.5], [4.7, 0.18, 1.4], "#2f8fe8"),
  component("dam", "Dam", "rectangular-prism", [-1.5, 2.15, -1.2], [4.8, 1.5, 0.38], "#c9c2b4"),
  component("intake-1", "Intake", "box", [-1.5, 1.6, -0.9], [0.54, 0.28, 0.5], "#9fb2c6"),
  component("penstock-1", "Penstock", "cylinder", [-1.5, 0.72, -0.35], [0.2, 1.25, 0.2], "#6f86a0"),
  component("tailrace", "Tailrace", "rectangular-prism", [-1.5, -1.15, 0.8], [2.5, 0.16, 0.52], "#2f8fe8"),
  component("river-downstream", "Saint Paul River", "rectangular-prism", [0, -1.8, 1.6], [5.8, 0.12, 0.5], "#2f8fe8"),
  component("spillway-gate", "Spillway gate", "box", [1.0, 2.4, -1.0], [0.65, 0.8, 0.18], "#9fb2c6"),
  component("powerhouse", "Powerhouse", "rectangular-prism", [0.3, 0.15, 0.1], [4.5, 1.7, 1.5], "#c9c2b4", { material: mat("#c9c2b4", 0.55) }),
  ...UNIT_X.flatMap((x, i) => {
    const unit = i + 1;
    return [component(`unit-${unit}`, `Unit ${unit} housing`, "cylinder", [x, -0.15, 0.1], [0.52, 0.72, 0.52], "#5fb8a8"),
      component(`unit-${unit}-marker`, `Unit ${unit} rotation marker`, "box", [x + 0.34, -0.15, 0.1], [0.16, 0.08, 0.08], "#facc15")];
  }),
  component("u3-runner", "Runner", "cylinder", [0.9, -0.25, 0.1], [0.32, 0.18, 0.32], "#cfe0ea", { internal: true, layerId: "unit-3-internals", shapeKey: "runner" }),
  component("u3-shaft", "Shaft", "cylinder", [0.9, 0.05, 0.1], [0.09, 0.36, 0.09], "#5f6d7e", { internal: true, layerId: "unit-3-internals", shapeKey: "shaft" }),
  component("u3-generator", "Generator", "cylinder", [0.9, 0.48, 0.1], [0.34, 0.28, 0.34], "#ee8f52", { internal: true, layerId: "unit-3-internals", shapeKey: "generator" }),
  component("switchyard", "Switchyard", "panel", [3.1, 0.2, 0.1], [0.9, 0.8, 0.18], "#aab4c0"),
  component("power-tower-1", "Transmission tower", "cone", [4.0, 1.4, 0], [0.48, 1.3, 0.48], "#aab4c0"),
  component("city-hospital", "Hospital", "rectangular-prism", [5.0, 0.35, 0], [0.8, 0.95, 0.5], "#96a3b6"),
  component("hospital-sign", "Hospital H sign", "panel", [5.0, 1.1, 0.28], [0.22, 0.2, 0.06], "#2f6fe0"),
  component("city-homes", "Homes", "rectangular-prism", [6.4, 0.25, 0], [1.15, 0.75, 0.5], "#7a869a"),
  component("city-shops", "Shops", "rectangular-prism", [7.7, 0.25, 0], [0.9, 0.75, 0.5], "#7a869a"),
  ...[1, 2, 3, 4].map((n) => component(`gauge-seg-${n}`, `Power gauge ${n}`, "box", [4.6 + n * 0.24, 2.3, 0], [0.18, 0.22, 0.08], "#8c9ab0")),
  ...["hospital", "homes", "shops"].map((name, i) => component(`demand-${name}`, `${name} demand segment`, "box", [5.2 + i * 0.28, 2.3, 0], [0.2, 0.22, 0.08], "#c98a4b")),
  component("distance-break", "Approx. 30 km to Monrovia", "panel", [7.8, 2.1, 0.2], [0.5, 0.08, 0.04], "#f8fafc"),
  // Decorative valley scenery: no labels, state, picking, or instructional references.
  component("bank-lower", "", "rectangular-prism", [-3, 0.6, -2.2], [5, 0.18, 0.18], "#4a7a45", { detail: "decor", selectable: false }),
  component("bank-upper", "", "rectangular-prism", [1, 1.0, -2.4], [4, 0.16, 0.16], "#b06a42", { detail: "decor", selectable: false }),
  ...[0, 1, 2].map((n) => component(`transmission-pylon-${n + 1}`, `Transmission pylon ${n + 1}`, "cone", [3.3 + n * 0.7, 1.4, -1.2], [0.2, 0.85, 0.2], "#5f6d7e", { selectable: false })),
  ...[0, 1, 2, 3, 4, 5].map((n) => component(`forest-${n + 1}`, "", "cone", [-5.3 + n * 0.45, 0.4, -2.0], [0.28, 0.55, 0.28], "#4a7a45", { detail: "decor", selectable: false })),
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
    : ({ id: `water-u${unit}`, label: `Unit ${unit} water`, medium: "water" as const, sourceNodeId: `water-u${unit}-in`, destinationNodeId: `water-u${unit}-out`, closedLoop: false, visibleByDefault: true, color: "#67e8f9", nodes: [node(`water-u${unit}-in`, "Intake", [-1.5 + (unit - 1) * 0.5, 1.2, -0.4]), node(`water-u${unit}-out`, `Unit ${unit}`, [UNIT_X[unit - 1], -0.15, 0.1], `unit-${unit}`)] })),
  { id: "spillway", label: "Spillway", medium: "water", sourceNodeId: "spill-in", destinationNodeId: "spill-out", closedLoop: false, visibleByDefault: true, color: "#cffafe", nodes: [node("spill-in", "Spillway gate", [1, 2.4, -1], "spillway-gate"), node("spill-out", "Downstream river", [1, -1.5, 1], "river-downstream")] },
  { id: "power-line", label: "Transmission line", medium: "light", sourceNodeId: "power-source", destinationNodeId: "switchyard-node", closedLoop: false, visibleByDefault: true, color: "#facc15", nodes: [node("power-source", "Generator", [3, 0.2, 0], "switchyard"), node("switchyard-node", "Switchyard", [3.1, 0.2, 0], "switchyard")] },
  ...["hospital", "homes", "shops"].map((name, i) => ({ id: `feeder-${name}`, label: `${name} feeder`, medium: "light" as const, sourceNodeId: `feeder-${name}-in`, destinationNodeId: `feeder-${name}-out`, closedLoop: false, visibleByDefault: true, color: "#facc15", nodes: [node(`feeder-${name}-in`, "Switchyard", [3.1, 0.2, 0], "switchyard"), node(`feeder-${name}-out`, name, [5 + i * 1.3, 0.35, 0], `city-${name}`)] })),
];
// Ten physical flows: river-in, four turbine feeds, spillway, power-line and three city feeders. Unit 1 carries the trace nodes.

const spec: HighFidelitySpec = {
  specVersion: HIGH_FIDELITY_SPEC_VERSION,
  authoring: {
    learningObjective: "Explain how river flow, available turbine units and electricity demand affect hydropower generation and delivery.",
    whyInteractive: "Learners can change season, unit availability and feeder demand, then inspect the linked water, machine and grid consequences.",
    scene: "A simplified section view of the Mount Coffee run-of-river plant, Saint Paul River, powerhouse, switchyard and city feeders.",
    components: "Procedural dam, intake, penstock, turbine housings, transmission yard, city loads and a compact section stack for unit 3.",
    internalStructures: "Unit 3 runner, shaft and generator are exposed by the powerhouse cutaway and rebuilt in the repair check.",
    variables: "River flow has five discrete seasonal values; unit count and three feeder switches are learner controlled.",
    simulationRules: "Deterministic capability model: water is dispatched in unit order; demand above capability trips delivery; remaining water spills.",
    learnerControls: "Season, units online, three feeder toggles, trace path, unit 3 cutaway and repair assembly.",
    visualConsequences: "Water flow, unit rotation status, power gauge, spillway flow, feeder flow and city lighting follow the simulation.",
    guidedPath: "Meet the plant, follow water, inspect unit 3, compare seasons, test overload, repair the unit, then explore the grid.",
    exploreMode: "Change all controls and inspect the explanation and energy path.",
    challenge: "In the dry season, keep the hospital supplied while other feeders may be switched off.",
    assessment: "Trace water, identify the generator, reach dry-season capability, stabilize priority supply and rebuild unit 3.",
    evidence: "All five checks remain RAW_OBSERVATION; the release binding is a fixture and this definition is DRAFT.",
    misconceptions: "A full headpond guarantees high output; more turbines create more water; generators spin faster with more water; a trip merely dims loads.",
    accessibility: "Every control has a label; the motion group exposes status text; reduced motion suppresses pulses; all checks work in 2D.",
    deviceProfile: "LOW omits scenery and batches flow geometry; all instructional components remain within the locked profile budget.",
    offlineFallback: "Procedural geometry and local rules only; no remote assets; FALLBACK_2D supports all controls and checks.",
  },
  components,
  assemblies: [{ id: "unit-3", label: "Unit 3 machine", componentIds: [...UNIT3_STACK], slots: [
    { id: "slot-runner", label: "Runner position", accepts: "runner", transform: tr([0.9, -0.25, 0.1], [1, 1, 1]), initialComponentId: "u3-runner" },
    { id: "slot-shaft", label: "Shaft position", accepts: "shaft", transform: tr([0.9, 0.05, 0.1], [1, 1, 1]), initialComponentId: "u3-shaft" },
    { id: "slot-generator", label: "Generator position", accepts: "generator", transform: tr([0.9, 0.48, 0.1], [1, 1, 1]), initialComponentId: "u3-generator" },
  ], dependencies: [{ from: "u3-runner", to: "u3-shaft", label: "turns the" }, { from: "u3-shaft", to: "u3-generator", label: "drives the" }] }],
  exploded: [{ assemblyId: "unit-3", cameraPresetId: "unit-bench", offsets: { "u3-runner": [0, -0.7, 0], "u3-shaft": [0, 0, 0], "u3-generator": [0, 0.7, 0] } }],
  cutaways: [{ id: "powerhouse-section", label: "Open the powerhouse section", plane: { normal: [0, 0, 1], offset: 0 }, removesComponentIds: ["powerhouse"], revealsComponentIds: [...UNIT3_STACK], cameraPresetId: "powerhouse-section" }],
  layers: [{ id: "unit-3-internals", label: "Unit 3 internal machine", defaultVisible: true }],
  poseTransitions: [],
  variables: [
    { id: "riverFlow", label: "River flow", unit: "m³/s", kind: "discrete", min: 49, max: 557, step: 127, initial: 430, learnerControlled: true, description: "Choose a seasonal flow scenario." },
    { id: "unitsOnline", label: "Units online", kind: "discrete", min: 0, max: 4, step: 1, initial: 4, learnerControlled: true },
    ...["feederHospital", "feederHomes", "feederShops"].map((id) => ({ id, label: id.replace("feeder", "Feeder "), kind: "toggle" as const, min: 0, max: 1, step: 1, initial: 1, learnerControlled: true })),
  ],
  simulation: hydropowerModel,
  motions: [1, 2, 3, 4].map((unit) => ({ id: `unit-${unit}-spin`, label: `Unit ${unit} rotation`, componentIds: [`unit-${unit}`, `unit-${unit}-marker`, ...(unit === 3 ? [...UNIT3_STACK] : [])], pivot: [UNIT_X[unit - 1], -0.15, 0.1] as [number, number, number], axis: "y" as const, rpm: SYNCHRONOUS_RPM, symmetryOrder: 1, activeWhen: { componentId: `unit-${unit}`, statuses: ["generating"] } })),
  flows,
  camera: { defaultPresetId: "valley", presets: [
    { id: "valley", label: "Whole valley", target: [0.8, 0.7, 0], distance: 15, yaw: -0.2, pitch: 0.16 },
    { id: "water-path", label: "Water route", target: [-1.3, 0.7, 0], distance: 8, yaw: 0.15, pitch: 0.2 },
    { id: "powerhouse-section", label: "Powerhouse section", target: [0.3, 0.2, 0.1], distance: 7, yaw: 0.2, pitch: 0.1 },
    { id: "unit-bench", label: "Unit 3 bench", target: [0.9, 0.2, 0.1], distance: 5, yaw: 0.2, pitch: 0.1 },
    { id: "grid-city", label: "Power and city", target: [5, 1, 0], distance: 8, yaw: -0.1, pitch: 0.12 },
  ], constraints: { minDistance: 4, maxDistance: 20, minPitch: -0.4, maxPitch: 0.8, minYaw: -1, maxYaw: 1 } },
  guidedPath: [
    { id: "meet", prompt: "Water flows down from the headpond through the plant and returns to the river.", cameraPresetId: "valley" },
    { id: "trace", prompt: "Follow the water from the headpond, through a turbine, and back to the river.", cameraPresetId: "water-path", highlightIds: ["headpond", "penstock-1", "tailrace"] },
    { id: "machine", prompt: "Open the powerhouse section and find the generator in unit 3.", cameraPresetId: "unit-bench", highlightIds: ["u3-generator"] },
    { id: "season", prompt: "Compare dry season with rainy season. What changes when less water arrives?", cameraPresetId: "valley" },
    { id: "overload", prompt: "With three units in the rainy season, keep the hospital on, then switch on homes and shops one at a time. When does demand exceed the plant's 66 MW capacity?", cameraPresetId: "grid-city" },
    { id: "repair", prompt: "Rebuild unit 3 in order: runner, shaft, generator.", cameraPresetId: "unit-bench", highlightIds: ["u3-runner", "u3-shaft", "u3-generator"] },
    { id: "explore", prompt: "Explore how river flow, units online and feeder demand work together.", cameraPresetId: "valley" },
  ],
  modes: ["GUIDED", "EXPLORE", "CHALLENGE", "ASSESSMENT"],
  offline: { remoteAssets: [], maxPackageBytes: 96_000 },
};

const base: InteractiveLabDefinition<LabState> = {
  contractVersion: "interactive-lab-definition/2.0.0", id: HYDROPOWER_LAB_ID, version: "1.0.0", title: "Mount Coffee hydropower", summary: "Explore how water, turbines and electricity demand shape the power supplied by a run-of-river plant.", grade: 8, subject: "SCIENCE",
  objectiveIds: [OBJECTIVE_ID], conceptIds: [CONCEPT_ID], releaseBinding: { releaseId: "fixture-unreleased", releaseIdentity: "fixture", activityId: HYDROPOWER_LAB_ID, activityVersion: "1.0.0" },
  provenance: { source: "Mount Coffee design-stage lab", reference: "docs/labs/mount-coffee-hydropower/", author: "LiberiaLearn Interactive Lab Production Team" },
  reviewState: "DRAFT", approvalState: "PENDING", scene: { objects: [], lighting: { ambient: "#9aa8c7", key: "#fff1d0" }, camera: { fov: 42, minDistance: 4, maxDistance: 20 } },
  interactions: ["set-variable", "trace", "cutaway", "assemble", "inspect", "camera", "answer/check"],
  initialState: { mode: "GUIDED", selectedObjectId: null, focusedObjectId: null, rotations: {}, highlightedFeatures: {}, netObjectIds: [], completedChecks: [], retries: 0, hints: 0, lastFeedback: null },
  validateAction: (_state, action) => action.type === "mode" || action.type === "reset" ? { ok: true } : { ok: false, reason: "Use the high-fidelity lab controls." },
  transition: (state, action) => action.type === "reset" ? { ...base.initialState } : action.type === "mode" ? { ...state, mode: action.mode, lastFeedback: null } : state,
  checks: [
    { id: "trace-water", prompt: "Trace the water through the six nodes, in order.", objectiveId: OBJECTIVE_ID, conceptId: CONCEPT_ID, kind: "direct-manipulation", answer: { flowId: "water-u1" }, fidelity: { kind: "trace-path", flowId: "water-u1" }, hints: ["Start at the headpond and follow the water back to the river."] },
    { id: "find-generator", prompt: "Open the powerhouse section and identify unit 3's generator.", objectiveId: OBJECTIVE_ID, conceptId: CONCEPT_ID, kind: "direct-manipulation", answer: { componentId: "u3-generator" }, fidelity: { kind: "identify-component", componentId: "u3-generator" }, hints: ["Use the powerhouse section cutaway."] },
    { id: "dry-season-output", prompt: "Set dry season flow with at least one unit. Reach 8–12 MW capability.", objectiveId: OBJECTIVE_ID, conceptId: CONCEPT_ID, kind: "direct-manipulation", answer: { quantityId: "outputMW", min: 8, max: 12 }, fidelity: { kind: "reach-target", quantityId: "outputMW", min: 8, max: 12 }, hints: ["Dry season flow is 49 m³/s."] },
    { id: "dry-season-peak", prompt: "In the dry season, keep the hospital supplied without a trip.", objectiveId: OBJECTIVE_ID, conceptId: CONCEPT_ID, kind: "direct-manipulation", answer: { quantityId: "gridStableWithPriority", value: 1 }, fidelity: { kind: "reach-target", quantityId: "gridStableWithPriority", min: 1, max: 1 }, hints: ["Switch off other feeders if demand is too high."] },
    { id: "repair-unit-3", prompt: "Rebuild unit 3 with its runner, shaft and generator in the matching slots.", objectiveId: OBJECTIVE_ID, conceptId: CONCEPT_ID, kind: "direct-manipulation", answer: { assemblyId: "unit-3" }, fidelity: { kind: "assemble", assemblyId: "unit-3" }, hints: ["Start by clearing the assembly, then place each matching part."] },
  ],
  accessibility: { touch: true, keyboard: true, reducedMotion: true, offline: true, fallback: "FALLBACK_2D" },
};

export const hydropowerDefinition: InteractiveLabDefinition<LabState> = composeHighFidelity(base, spec);
export const HYDROPOWER_RIVER_FLOW_STEPS = RIVER_FLOW_STEPS;
