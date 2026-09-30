// Review scenarios for the two reference labs. They validate the capture mechanism end to end and are
// the worked examples future lab authors copy. They add no curriculum or evidence authority.
import { CIRCUIT_LAB_ID } from "../definitions/circuit";
import { HYDROPOWER_LAB_ID } from "../definitions/hydropower";
import { SOLIDS_LAB_ID, SOLIDS_LAB_VERSION } from "../definitions/solids";
import type { InteractiveLabDefinition, LabAction, LabState } from "../types";
import { LAB_REVIEW_SCENARIO_VERSION, type LabReviewScenario, type LabReviewScenarioSet } from "./scenarios";

function prismRebuild(definition: InteractiveLabDefinition<LabState>): LabAction[] {
  const slots = definition.fidelity?.assemblies.find((assembly) => assembly.id === "prism-faces")?.slots ?? [];
  return [
    { type: "clear-assembly", assemblyId: "prism-faces" },
    ...slots.map((slot): LabAction => ({ type: "place-component", assemblyId: "prism-faces", slotId: slot.id, componentId: slot.initialComponentId ?? null })),
  ];
}

const closeSwitch: LabAction = { type: "set-variable", variableId: "switch", value: 1 };
const traceOrder = ["battery-positive", "switch", "resistor", "bulb", "battery-negative"];

export const SOLIDS_REVIEW_SCENARIOS: LabReviewScenarioSet = {
  scenarioVersion: LAB_REVIEW_SCENARIO_VERSION,
  labId: SOLIDS_LAB_ID,
  labVersion: SOLIDS_LAB_VERSION,
  scenarios: [
    { id: "overview", title: "Five solids, first view", stage: "overview", actions: [] },
    { id: "guided-explode-step", title: "Guided step 2: camera moves to the cube", stage: "guided", actions: [{ type: "guided-step", index: 1 }], motion: { frames: 8, intervalMs: 90 } },
    { id: "cube-exploded", title: "Cube taken apart into six faces", stage: "exploded", actions: [{ type: "camera-preset", presetId: "cube-focus" }, { type: "set-explode", assemblyId: "cube-faces", factor: 1 }], motion: { frames: 8, intervalMs: 90 } },
    { id: "cube-net", title: "Cube unfolded into its net", stage: "net", actions: [{ type: "camera-preset", presetId: "net-view" }, { type: "set-variable", variableId: "cube-unfold", value: 1 }], motion: { frames: 10, intervalMs: 90 } },
    { id: "prism-tray", title: "Challenge: prism faces in the tray, unlabeled", stage: "challenge", actions: [{ type: "mode", mode: "CHALLENGE" }, { type: "camera-preset", presetId: "prism-workbench" }, { type: "clear-assembly", assemblyId: "prism-faces" }] },
    { id: "prism-rebuilt", title: "Assessment: prism rebuilt and checked", stage: "assessment", actions: (definition) => [{ type: "mode", mode: "ASSESSMENT" }, { type: "camera-preset", presetId: "prism-workbench" }, ...prismRebuild(definition), { type: "check", checkId: "rebuild-prism", response: {} }], expectCompletedChecks: ["rebuild-prism"] },
  ],
};

export const CIRCUIT_REVIEW_SCENARIOS: LabReviewScenarioSet = {
  scenarioVersion: LAB_REVIEW_SCENARIO_VERSION,
  labId: CIRCUIT_LAB_ID,
  labVersion: "1.0.0",
  scenarios: [
    { id: "overview", title: "Whole circuit, switch open", stage: "overview", actions: [] },
    { id: "guided-close-step", title: "Guided step 2: close the switch", stage: "guided", actions: [{ type: "guided-step", index: 1 }], motion: { frames: 8, intervalMs: 90 } },
    { id: "current-starts", title: "Closing the switch starts the current", stage: "process", actions: [closeSwitch], motion: { frames: 10, intervalMs: 80 } },
    { id: "high-resistance", title: "Resistance raised to 20 Ω: dim bulb, slow current", stage: "variable", actions: [closeSwitch, { type: "set-variable", variableId: "resistance", value: 20 }], motion: { frames: 8, intervalMs: 80 } },
    { id: "max-brightness", title: "9 V and 2 Ω: brightest bulb, fastest current", stage: "variable", actions: [closeSwitch, { type: "set-variable", variableId: "voltage", value: 9 }, { type: "set-variable", variableId: "resistance", value: 2 }] },
    { id: "open-circuit", title: "Fault: switch reopened, loop broken", stage: "fault", actions: [closeSwitch, { type: "set-variable", variableId: "switch", value: 0 }], motion: { frames: 8, intervalMs: 80 } },
    { id: "bulb-exploded", title: "Bulb exploded view", stage: "exploded", actions: [{ type: "set-explode", assemblyId: "bulb", factor: 1 }], motion: { frames: 8, intervalMs: 90 } },
    { id: "bulb-cutaway", title: "Bulb cut open, filament glowing", stage: "cutaway", actions: [closeSwitch, { type: "set-cutaway", cutawayId: "bulb-cutaway" }] },
    { id: "challenge-start", title: "Challenge: reach medium brightness", stage: "challenge", actions: [{ type: "mode", mode: "CHALLENGE" }, closeSwitch] },
    {
      id: "assessment-complete", title: "Assessment: all four direct-manipulation checks passed", stage: "assessment",
      actions: [
        { type: "mode", mode: "ASSESSMENT" },
        closeSwitch,
        { type: "check", checkId: "light-bulb", response: {} },
        ...traceOrder.map((nodeId): LabAction => ({ type: "trace-node", flowId: "current", nodeId })),
        { type: "check", checkId: "trace-current", response: {} },
        { type: "set-variable", variableId: "voltage", value: 4.5 },
        { type: "set-variable", variableId: "resistance", value: 2 },
        { type: "check", checkId: "medium-glow", response: {} },
        { type: "set-cutaway", cutawayId: "bulb-cutaway" },
        { type: "inspect-component", componentId: "bulb-filament" },
        { type: "check", checkId: "find-filament", response: {} },
      ],
      expectCompletedChecks: ["light-bulb", "trace-current", "medium-glow", "find-filament"],
    },
  ],
};

const dry: LabAction = { type: "set-variable", variableId: "riverFlow", value: 49 };
const rainy: LabAction = { type: "set-variable", variableId: "riverFlow", value: 430 };
const flowFlood: LabAction = { type: "set-variable", variableId: "riverFlow", value: 557 };
const units = (value: number): LabAction => ({ type: "set-variable", variableId: "unitsOnline", value });
const feeder = (id: string, value: number): LabAction => ({ type: "set-variable", variableId: id, value });
const unit3Parts: LabAction[] = [
  { type: "clear-assembly", assemblyId: "unit-3" },
  { type: "place-component", assemblyId: "unit-3", slotId: "slot-runner", componentId: "u3-runner" },
  { type: "place-component", assemblyId: "unit-3", slotId: "slot-shaft", componentId: "u3-shaft" },
  { type: "place-component", assemblyId: "unit-3", slotId: "slot-generator", componentId: "u3-generator" },
];
const traceHydro: LabAction[] = ["headpond", "intake-1", "penstock-1", "turbine-1", "tailrace-1", "river-downstream"].map((nodeId) => ({ type: "trace-node", flowId: "water-u1", nodeId }));
const hydroScenario = (id: string, title: string, stage: LabReviewScenario["stage"], storyboardScene: string, actions: LabAction[], motion = false): LabReviewScenario => ({ id, title, stage, storyboardScene, actions, ...(motion ? { motion: { frames: 10, intervalMs: 90 } } : {}) });

export const HYDROPOWER_REVIEW_SCENARIOS: LabReviewScenarioSet = {
  scenarioVersion: LAB_REVIEW_SCENARIO_VERSION,
  labId: HYDROPOWER_LAB_ID,
  labVersion: "1.0.0",
  scenarios: [
    hydroScenario("hydro-overview", "S1 Meet the plant", "overview", "S1", []),
    hydroScenario("hydro-guided-meet-to-water", "S1 Meet then move to water", "guided", "S1-S2", [{ type: "guided-step", index: 1 }], true),
    hydroScenario("hydro-guided-trace-partial", "S2 Trace begins", "guided", "S2", [{ type: "guided-step", index: 1 }, { type: "trace-node", flowId: "water-u1", nodeId: "headpond" }]),
    hydroScenario("hydro-guided-name-chain", "S7 Review the energy chain: potential, kinetic, rotation, electrical, light and heat", "guided", "S7", [{ type: "guided-step", index: 6 }]),
    // Begin in rainy flow so the held final dry-flow action always changes state for the motion capture.
    hydroScenario("hydro-process-water-starts", "S2 Water starts through unit 1", "process", "S2", [rainy, dry], true),
    hydroScenario("hydro-cutaway-powerhouse", "S3 Powerhouse section", "cutaway", "S3", [{ type: "camera-preset", presetId: "powerhouse-section" }, { type: "set-cutaway", cutawayId: "powerhouse-section" }], true),
    hydroScenario("hydro-exploded-unit", "S3 Unit 3 stack exploded", "exploded", "S3", [{ type: "camera-preset", presetId: "exploded-bench" }, { type: "set-explode", assemblyId: "unit-3", factor: 1 }], true),
    hydroScenario("hydro-variable-rainy-full", "S4 Rainy season, full capability", "variable", "S4", [rainy], true),
    hydroScenario("hydro-variable-flood-cap", "S4 Flood water spills", "variable", "S4", [flowFlood], true),
    hydroScenario("hydro-variable-dry-drop", "S5 Dry season capability drop", "variable", "S5", [dry], true),
    hydroScenario("hydro-guided-overload-beat", "S6 Guided overload beat: rainy season, three units", "guided", "S6", [rainy, units(3), feeder("feederHomes", 0), feeder("feederShops", 0), { type: "guided-step", index: 4 }], true),
    hydroScenario("hydro-fault-dry-all-units", "S5 Dry flow with four units", "fault", "S5", [dry, units(4)]),
    hydroScenario("hydro-fault-zero-units-dark", "S6 No units, no supply", "fault", "S6", [units(0)], true),
    hydroScenario("hydro-fault-overload-trip", "S6 Rainy season overload with three units", "fault", "S6", [rainy, feeder("feederHospital", 1), feeder("feederHomes", 1), feeder("feederShops", 1), units(3)], true),
    hydroScenario("hydro-fault-shed-restore", "S6 Shed load to restore priority", "fault", "S6", [dry, feeder("feederHomes", 0), feeder("feederShops", 0)], true),
    hydroScenario("hydro-challenge-start", "S8 Dry evening challenge: initial unmet state", "challenge", "S8", [{ type: "mode", mode: "CHALLENGE" }, dry, units(1)]),
    hydroScenario("hydro-challenge-intuitive-fail", "S8 Four units cannot create water", "challenge", "S8", [{ type: "mode", mode: "CHALLENGE" }, dry, units(4)]),
    hydroScenario("hydro-challenge-solved", "S8 Hospital remains supplied", "challenge", "S8", [{ type: "mode", mode: "CHALLENGE" }, dry, units(1), feeder("feederHomes", 0), feeder("feederShops", 0)], true),
    hydroScenario("hydro-assessment-trace", "S9 Trace water", "assessment", "S9", [dry, ...traceHydro, { type: "mode", mode: "ASSESSMENT" }, { type: "check", checkId: "trace-water", response: {} }]),
    hydroScenario("hydro-assessment-generator", "S9 Identify generator", "assessment", "S9", [...traceHydro, { type: "mode", mode: "ASSESSMENT" }, { type: "check", checkId: "trace-water", response: {} }, { type: "set-cutaway", cutawayId: "powerhouse-section" }, { type: "inspect-component", componentId: "u3-generator" }]),
    hydroScenario("hydro-assessment-dry-output", "S9 Reach dry output", "assessment", "S9", [...traceHydro, { type: "mode", mode: "ASSESSMENT" }, { type: "check", checkId: "trace-water", response: {} }, { type: "set-cutaway", cutawayId: "powerhouse-section" }, { type: "inspect-component", componentId: "u3-generator" }, { type: "check", checkId: "find-generator", response: {} }, dry, units(1), { type: "mode", mode: "ASSESSMENT" }]),
    hydroScenario("hydro-assessment-repair", "S9 Repair unit 3", "assessment", "S9", [...traceHydro, { type: "set-cutaway", cutawayId: "powerhouse-section" }, { type: "inspect-component", componentId: "u3-generator" }, dry, units(1), feeder("feederHomes", 0), feeder("feederShops", 0), ...unit3Parts, { type: "mode", mode: "ASSESSMENT" }, { type: "check", checkId: "trace-water", response: {} }, { type: "check", checkId: "find-generator", response: {} }, { type: "check", checkId: "dry-season-output", response: {} }, { type: "check", checkId: "dry-season-peak", response: {} }], true),
    hydroScenario("hydro-assessment-all-passed", "S9 Five direct manipulation checks", "assessment", "S9", [dry, units(1), feeder("feederHomes", 0), feeder("feederShops", 0), { type: "set-cutaway", cutawayId: "powerhouse-section" }, { type: "inspect-component", componentId: "u3-generator" }, ...traceHydro, ...unit3Parts, { type: "mode", mode: "ASSESSMENT" }, { type: "check", checkId: "trace-water", response: {} }, { type: "check", checkId: "find-generator", response: {} }, { type: "check", checkId: "dry-season-output", response: {} }, { type: "check", checkId: "dry-season-peak", response: {} }, { type: "check", checkId: "repair-unit-3", response: {} }], true),
  ],
};

/** Registered scenario sets, keyed by lab id. A lab entering the production team adds its set here. */
export const LAB_REVIEW_SCENARIO_SETS: Readonly<Record<string, LabReviewScenarioSet>> = Object.freeze({
  [SOLIDS_REVIEW_SCENARIOS.labId]: SOLIDS_REVIEW_SCENARIOS,
  [CIRCUIT_REVIEW_SCENARIOS.labId]: CIRCUIT_REVIEW_SCENARIOS,
  [HYDROPOWER_REVIEW_SCENARIOS.labId]: HYDROPOWER_REVIEW_SCENARIOS,
});

export function getLabReviewScenarioSet(labId: string): LabReviewScenarioSet | null {
  return LAB_REVIEW_SCENARIO_SETS[labId] ?? null;
}
