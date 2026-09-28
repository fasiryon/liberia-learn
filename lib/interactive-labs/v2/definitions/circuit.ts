// Reference fixture for causal high-fidelity labs: control -> state change -> visual consequence -> governed check.
// Not curriculum content: DRAFT, unreleased, and its checks have no governed authority mapping (RAW_OBSERVATION).
import type { InteractiveLabDefinition, LabAction, LabState } from "../types";
import { composeHighFidelity } from "../fidelity/engine";
import { HIGH_FIDELITY_SPEC_VERSION, type ExplanationLine, type HighFidelitySpec, type SimulationModel } from "../fidelity/types";

export const CIRCUIT_LAB_ID = "fixture-simple-circuit";
const OBJECTIVE_ID = "fixture-circuit-objective";
const CONCEPT_ID = "fixture-circuit-current";

export const BULB_RESISTANCE_OHMS = 4;
const MAX_CURRENT_AMPS = 9 / (2 + BULB_RESISTANCE_OHMS);
const REFERENCE_POWER_WATTS = MAX_CURRENT_AMPS * MAX_CURRENT_AMPS * BULB_RESISTANCE_OHMS;
const round = (value: number) => Math.round(value * 1e6) / 1e6;

/** Ohm's-law rule layer. Pure and deterministic; no physics engine. */
export const circuitModel: SimulationModel = {
  id: "series-circuit-ohms-law",
  version: "1.0.0",
  kind: "equation",
  evaluate: ({ variables }) => {
    const voltage = variables.voltage ?? 0, resistance = variables.resistance ?? 0, closed = variables.switch === 1;
    const current = closed ? round(voltage / (resistance + BULB_RESISTANCE_OHMS)) : 0;
    const brightness = round(Math.min(1, Math.sqrt((current * current * BULB_RESISTANCE_OHMS) / REFERENCE_POWER_WATTS)));
    const explanation: ExplanationLine[] = [
      closed
        ? { id: "loop-closed", text: "The switch is closed, so the circuit is a complete loop and current flows." }
        : { id: "loop-open", text: "The switch is open. The loop is broken, so no current flows and the bulb stays dark." },
      ...(closed ? [{ id: "reading", text: `Current: ${current.toFixed(2)} A. Bulb brightness: ${Math.round(brightness * 100)}%.` }] : []),
      { id: "resistance-rule", text: "More resistance means less current, so the bulb gets dimmer." },
      { id: "voltage-rule", text: "More voltage (a stronger battery) pushes more current, so the bulb gets brighter." },
      { id: "ohms-law", text: `Current = voltage ÷ total resistance: I = V ÷ (R + ${BULB_RESISTANCE_OHMS} Ω for the bulb).`, minGrade: 6 },
    ];
    return {
      quantities: { voltage, resistance, current, brightness },
      flows: { current: { active: current > 0, rate: round(current / MAX_CURRENT_AMPS), direction: 1 } },
      componentStates: { "bulb-glass": { intensity: brightness }, "bulb-filament": { intensity: brightness }, "switch-lever": { status: closed ? "closed" : "open" } },
      explanation,
    };
  },
};

export const CIRCUIT_FIDELITY: HighFidelitySpec = {
  specVersion: HIGH_FIDELITY_SPEC_VERSION,
  authoring: {
    learningObjective: "Explain how a switch, the battery voltage and a resistance change the current in a simple series circuit, and what that does to a bulb.",
    whyInteractive: "Current cannot be seen. Showing it as moving charge whose speed follows the real rule, and letting the learner change the causes, makes the cause-and-effect visible.",
    scene: "A battery, a switch, a resistor and a bulb joined in one loop of wire.",
    components: "Battery; switch base and lever; resistor; bulb assembly (glass, filament, base).",
    internalStructures: "The bulb filament, revealed by the bulb cutaway.",
    variables: "voltage (1.5 to 9 V, steps of 1.5), resistance (2 to 20 Ω, steps of 2), switch (open/closed).",
    simulationRules: "I = V ÷ (R + 4 Ω) when the switch is closed, otherwise 0. Brightness = √(I²·4 Ω ÷ reference power), capped at 1.",
    learnerControls: "Voltage and resistance sliders with step buttons, the switch toggle, tapping parts to trace the current, the bulb cutaway, the bulb exploded view, camera presets.",
    visualConsequences: "Closing the switch starts the flow of current. Particle speed follows the current. The bulb glows brighter or dimmer. The switch lever moves.",
    guidedPath: "Meet the parts, close the switch, change the resistance, cut the bulb open.",
    exploreMode: "Free use of all variables and views.",
    challenge: "Reach a target brightness band using any mix of voltage and resistance.",
    assessment: "Light the bulb, trace the current path, reach medium brightness, and identify the filament. Every check is direct manipulation.",
    evidence: "Checks emit governed evidence, which stays RAW_OBSERVATION because this fixture has no release binding. Slider moves and views are observation only.",
    misconceptions: "Current is used up by the bulb; the switch position does not matter; the battery alone sets the brightness.",
    accessibility: "Every slider has step buttons. The switch is a labelled toggle. Tracing uses buttons as well as scene taps. Reduced motion freezes particles and shows static arrows.",
    deviceProfile: "HIGH: 18 particles per flow and a clipping cutaway. STANDARD: 10 particles. LOW: 4 particles; the cutaway hides the glass instead of clipping it. FALLBACK_2D: an SVG schematic from the same render list.",
    offlineFallback: "Procedural geometry only; no remote assets. All checks can be completed in FALLBACK_2D.",
  },
  components: [
    { id: "battery", label: "Battery", description: "Pushes charge around the loop. Higher voltage pushes harder.", geometry: "cylinder", transform: { position: [-3, 0, 0], rotation: [0, 0, 0], scale: [0.45, 0.9, 0.45] }, material: { color: "#38bdf8", roughness: 0.3, metalness: 0.2 } },
    { id: "switch-base", label: "Switch", description: "Opens or closes the loop.", geometry: "box", transform: { position: [-0.8, 2, 0], rotation: [0, 0, 0], scale: [0.55, 0.12, 0.3] }, material: { color: "#64748b", roughness: 0.5, metalness: 0.1 } },
    { id: "switch-lever", label: "Switch lever", geometry: "box", transform: { position: [-0.8, 2.12, 0], rotation: [0, 0, 0], scale: [0.5, 0.06, 0.12] }, material: { color: "#f8fafc", roughness: 0.3, metalness: 0.4 } },
    { id: "resistor", label: "Resistor", description: "Resists the current. More resistance, less current.", geometry: "box", transform: { position: [3, 0.3, 0], rotation: [0, 0, 0], scale: [0.18, 0.55, 0.18] }, material: { color: "#d97706", roughness: 0.45, metalness: 0.05 } },
    { id: "bulb-glass", label: "Bulb glass", geometry: "sphere", transform: { position: [0.4, -1.3, 0], rotation: [0, 0, 0], scale: [0.62, 0.62, 0.62] }, material: { color: "#fde68a", roughness: 0.1, metalness: 0, opacity: 0.55 } },
    { id: "bulb-filament", label: "Filament", description: "A thin wire that gets hot and glows when current flows through it.", geometry: "box", internal: true, transform: { position: [0.4, -1.3, 0], rotation: [0, 0, 0], scale: [0.28, 0.035, 0.035] }, material: { color: "#fb923c", roughness: 0.4, metalness: 0.3 } },
    { id: "bulb-base", label: "Bulb base", geometry: "cylinder", transform: { position: [0.4, -2.05, 0], rotation: [0, 0, 0], scale: [0.3, 0.22, 0.3] }, material: { color: "#94a3b8", roughness: 0.3, metalness: 0.6 } },
  ],
  assemblies: [
    { id: "bulb", label: "Light bulb", componentIds: ["bulb-glass", "bulb-filament", "bulb-base"], dependencies: [{ from: "bulb-base", to: "bulb-filament", label: "carries current to" }] },
    { id: "switch", label: "Switch", componentIds: ["switch-base", "switch-lever"] },
  ],
  exploded: [{ assemblyId: "bulb", offsets: { "bulb-glass": [0, 1.1, 0], "bulb-filament": [0, 0.35, 0], "bulb-base": [0, -0.6, 0] }, cameraPresetId: "bulb-close" }],
  cutaways: [{ id: "bulb-cutaway", label: "Cut the bulb open", plane: { normal: [0, 0, 1], offset: 0 }, removesComponentIds: ["bulb-glass"], revealsComponentIds: ["bulb-filament"], cameraPresetId: "bulb-close" }],
  layers: [],
  poseTransitions: [{ id: "switch-throw", assemblyId: "switch", variableId: "switch", from: { "switch-lever": { position: [-0.62, 2.3, 0], rotation: [0, 0, 0.6], scale: [0.5, 0.06, 0.12] } }, to: { "switch-lever": { position: [-0.8, 2.12, 0], rotation: [0, 0, 0], scale: [0.5, 0.06, 0.12] } } }],
  variables: [
    { id: "voltage", label: "Battery voltage", unit: "V", kind: "discrete", min: 1.5, max: 9, step: 1.5, initial: 3, learnerControlled: true },
    { id: "resistance", label: "Resistance", unit: "Ω", kind: "discrete", min: 2, max: 20, step: 2, initial: 6, learnerControlled: true },
    { id: "switch", label: "Switch", kind: "toggle", min: 0, max: 1, step: 1, initial: 0, learnerControlled: true },
  ],
  simulation: circuitModel,
  flows: [{
    id: "current", label: "Current", medium: "electric-current", sourceNodeId: "battery-positive", destinationNodeId: "battery-negative", closedLoop: true, visibleByDefault: true, color: "#facc15",
    nodes: [
      { id: "battery-positive", label: "Battery + end", position: [-3, 0.9, 0], componentId: "battery", traceable: true },
      { id: "corner-top-left", label: "Wire", position: [-3, 2, 0] },
      { id: "switch", label: "Switch", position: [-0.8, 2, 0], componentId: "switch-base", traceable: true },
      { id: "corner-top-right", label: "Wire", position: [3, 2, 0] },
      { id: "resistor", label: "Resistor", position: [3, 0.3, 0], componentId: "resistor", traceable: true },
      { id: "corner-bottom-right", label: "Wire", position: [3, -2.05, 0] },
      { id: "bulb", label: "Bulb", position: [0.4, -2.05, 0], componentId: "bulb-base", traceable: true },
      { id: "corner-bottom-left", label: "Wire", position: [-3, -2.05, 0] },
      { id: "battery-negative", label: "Battery − end", position: [-3, -0.9, 0], componentId: "battery", traceable: true },
    ],
  }],
  camera: {
    defaultPresetId: "overview",
    presets: [
      { id: "overview", label: "Whole circuit", target: [0, 0, 0], distance: 10, yaw: 0, pitch: 0.12 },
      { id: "bulb-close", label: "Bulb close-up", target: [0.4, -1.3, 0], distance: 5, yaw: 0.35, pitch: 0.2 },
      { id: "switch-close", label: "Switch close-up", target: [-0.8, 2, 0], distance: 5, yaw: -0.2, pitch: 0.3 },
    ],
    constraints: { minDistance: 4, maxDistance: 14, minPitch: -0.5, maxPitch: 0.8, minYaw: -1, maxYaw: 1 },
  },
  guidedPath: [
    { id: "meet", prompt: "This loop has a battery, a switch, a resistor and a bulb, joined by wire.", cameraPresetId: "overview" },
    { id: "close", prompt: "Close the switch. Watch current start to flow and the bulb light up.", cameraPresetId: "switch-close", highlightIds: ["switch-lever"] },
    { id: "resist", prompt: "Raise the resistance. What happens to the current and to the bulb?", cameraPresetId: "overview", highlightIds: ["resistor"] },
    { id: "inside", prompt: "Cut the bulb open to see the part that glows.", cameraPresetId: "bulb-close", highlightIds: ["bulb-glass"] },
  ],
  modes: ["GUIDED", "EXPLORE", "CHALLENGE", "ASSESSMENT"],
  offline: { remoteAssets: [], maxPackageBytes: 32_000 },
};

function initialCircuitState(): LabState {
  return { mode: "GUIDED", selectedObjectId: null, focusedObjectId: null, rotations: {}, highlightedFeatures: {}, netObjectIds: [], completedChecks: [], retries: 0, hints: 0, lastFeedback: null };
}

const circuitBase: InteractiveLabDefinition<LabState> = {
  contractVersion: "interactive-lab-definition/2.0.0", id: CIRCUIT_LAB_ID, version: "1.0.0", title: "Simple circuit", summary: "Close the switch, change the battery and the resistance, and watch what the current does to the bulb.", grade: 6, subject: "SCIENCE",
  objectiveIds: [OBJECTIVE_ID], conceptIds: [CONCEPT_ID],
  releaseBinding: { releaseId: "fixture-unreleased", releaseIdentity: "fixture", activityId: CIRCUIT_LAB_ID, activityVersion: "1.0.0" },
  provenance: { source: "runtime fixture", reference: "docs/architecture/HIGH_FIDELITY_INTERACTIVE_LABS.md", author: "LiberiaLearn" },
  reviewState: "DRAFT", approvalState: "PENDING",
  scene: { objects: [], lighting: { ambient: "#9aa8c7", key: "#fff1d0" }, camera: { fov: 42, minDistance: 4, maxDistance: 14 } },
  interactions: ["set-variable", "trace", "cutaway", "explode", "inspect", "camera", "answer/check"],
  initialState: initialCircuitState(),
  validateAction: (_state, action: LabAction) => action.type === "mode" || action.type === "reset" ? { ok: true } : { ok: false, reason: action.type === "check" ? "Unknown learning check." : "This lab has no free scene objects." },
  transition: (state, action) => action.type === "reset" ? initialCircuitState() : action.type === "mode" ? { ...state, mode: action.mode, lastFeedback: null } : state,
  checks: [
    { id: "light-bulb", prompt: "Close the switch so the bulb lights up.", objectiveId: OBJECTIVE_ID, conceptId: CONCEPT_ID, kind: "direct-manipulation", answer: { quantityId: "brightness" }, fidelity: { kind: "reach-target", quantityId: "brightness", min: 0.01, max: 1 }, hints: ["A circuit must be a complete loop."] },
    { id: "trace-current", prompt: "Trace the current: tap each part in order, starting at the battery's + end and ending at its − end.", objectiveId: OBJECTIVE_ID, conceptId: CONCEPT_ID, kind: "direct-manipulation", answer: { flowId: "current" }, fidelity: { kind: "trace-path", flowId: "current" }, hints: ["Follow the wire from the + end.", "Current only flows when the switch is closed."] },
    { id: "medium-glow", prompt: "Change the battery and the resistance until the bulb glows at medium brightness (45% to 65%).", objectiveId: OBJECTIVE_ID, conceptId: CONCEPT_ID, kind: "direct-manipulation", answer: { quantityId: "brightness", min: 0.45, max: 0.65 }, fidelity: { kind: "reach-target", quantityId: "brightness", min: 0.45, max: 0.65 }, hints: ["Lower resistance lets more current through.", "You can change the battery, the resistance, or both."] },
    { id: "find-filament", prompt: "Cut the bulb open and tap the part that glows.", objectiveId: OBJECTIVE_ID, conceptId: CONCEPT_ID, kind: "direct-manipulation", answer: { componentId: "bulb-filament" }, fidelity: { kind: "identify-component", componentId: "bulb-filament" }, hints: ["Use 'Cut the bulb open'."] },
  ],
  accessibility: { touch: true, keyboard: true, reducedMotion: true, offline: true, fallback: "FALLBACK_2D" },
};

export const circuitDefinition: InteractiveLabDefinition<LabState> = composeHighFidelity(circuitBase, CIRCUIT_FIDELITY);
