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
  labVersion: "1.1.0",
  scenarios: [
    hydroScenario("hydro-overview", "S1 Meet the plant", "overview", "S1", []),
    hydroScenario("hydro-guided-meet-to-water", "S1 Meet then move to water", "guided", "S1-S2", [{ type: "guided-step", index: 1 }], true),
    hydroScenario("hydro-guided-trace-partial", "S2 Trace begins", "guided", "S2", [{ type: "guided-step", index: 1 }, { type: "trace-node", flowId: "water-u1", nodeId: "headpond" }]),
    hydroScenario("hydro-guided-name-chain", "S7 Review the energy chain: potential, kinetic, rotation, electrical, light and heat", "guided", "S7", [{ type: "guided-step", index: 6 }]),
    // Begin in rainy flow so the held final dry-flow action always changes state for the motion capture.
    hydroScenario("hydro-process-water-starts", "S2 Water starts through unit 1", "process", "S2", [{ type: "guided-step", index: 1 }, feeder("feederHospital", 0), feeder("homesBlocks", 0), feeder("shopsBlocks", 0), units(0), rainy, units(1)], true),
    hydroScenario("hydro-cutaway-powerhouse", "S3 Powerhouse section", "cutaway", "S3", [{ type: "guided-step", index: 2 }, { type: "camera-preset", presetId: "powerhouse-section" }, { type: "set-cutaway", cutawayId: "powerhouse-section" }], true),
    hydroScenario("hydro-exploded-unit", "S3 Unit 3 stack exploded", "exploded", "S3", [{ type: "guided-step", index: 2 }, { type: "camera-preset", presetId: "exploded-bench" }, { type: "set-explode", assemblyId: "unit-3", factor: 1 }], true),
    hydroScenario("hydro-variable-rainy-full", "S4 Rainy season, full capability", "variable", "S4", [{ type: "guided-step", index: 3 }, rainy], true),
    hydroScenario("hydro-variable-flood-cap", "S4 Flood water spills", "variable", "S4", [{ type: "guided-step", index: 3 }, flowFlood], true),
    hydroScenario("hydro-variable-dry-drop", "S5 Dry season capability drop", "variable", "S5", [{ type: "guided-step", index: 3 }, feeder("homesBlocks", 0), feeder("shopsBlocks", 1), dry], true),
    hydroScenario("hydro-guided-overload-beat", "S6 Guided overload beat: rainy season, three units", "guided", "S6", [{ type: "guided-step", index: 4 }, rainy, feeder("homesBlocks", 4), feeder("shopsBlocks", 0), units(3)], true),
    hydroScenario("hydro-variable-idle-units-dry", "S5 Dry season: four units on, only enough water for about 10 MW", "variable", "S5", [{ type: "guided-step", index: 3 }, feeder("homesBlocks", 0), feeder("shopsBlocks", 1), dry, units(4)]),
    hydroScenario("hydro-fault-dry-all-units", "S5 Dry flow with four units", "fault", "S5", [dry, units(4)]),
    hydroScenario("hydro-fault-zero-units-dark", "S6 No units, no supply", "fault", "S6", [{ type: "guided-step", index: 4 }, units(0)], true),
    hydroScenario("hydro-fault-overload-trip", "S6 Rainy season overload with three units", "fault", "S6", [{ type: "guided-step", index: 4 }, rainy, feeder("feederHospital", 1), feeder("homesBlocks", 4), feeder("shopsBlocks", 4), units(3)], true),
    // Latched trip (founder decision 2026-10-02): overload trips; correcting the load does not restore power; only an
    // explicit Reset plant does, and only once demand fits.
    hydroScenario("hydro-fault-shed-not-reset", "S6 Load shed but the plant stays tripped until reset", "fault", "S6", [{ type: "guided-step", index: 4 }, dry, feeder("homesBlocks", 0), feeder("shopsBlocks", 1)]),
    hydroScenario("hydro-fault-shed-restore", "S6 Shed load, then reset the plant to restore priority", "fault", "S6", [{ type: "guided-step", index: 4 }, dry, feeder("homesBlocks", 0), feeder("shopsBlocks", 1), { type: "reset-protection" }], true),
    hydroScenario("hydro-fault-tripped-change-units", "S6 While tripped, units can still be changed; power stays off", "fault", "S6", [{ type: "guided-step", index: 4 }, dry, units(2), feeder("homesBlocks", 0), feeder("shopsBlocks", 0)]),
    hydroScenario("hydro-challenge-start", "S8 Dry evening challenge: initial unmet state", "challenge", "S8", [{ type: "mode", mode: "CHALLENGE" }]),
    hydroScenario("hydro-challenge-intuitive-fail", "S8 Four units cannot create water", "challenge", "S8", [{ type: "mode", mode: "CHALLENGE" }, feeder("homesBlocks", 1)]),
    hydroScenario("hydro-challenge-solved", "S8 Hospital remains supplied", "challenge", "S8", [{ type: "mode", mode: "CHALLENGE" }, feeder("homesBlocks", 0), feeder("shopsBlocks", 1)], true),
    // v1.1 feeder blocks: the v1.0 pass state (hospital only) is now under-served, and one block too many trips.
    hydroScenario("hydro-challenge-hospital-only-underserved", "S8 Hospital only: stable but not the most load", "challenge", "S8", [{ type: "mode", mode: "CHALLENGE" }, feeder("homesBlocks", 0), feeder("shopsBlocks", 0)]),
    hydroScenario("hydro-challenge-one-block-too-many", "S8 One shops block too many trips the plant", "challenge", "S8", [{ type: "mode", mode: "CHALLENGE" }, feeder("homesBlocks", 0), feeder("shopsBlocks", 2)]),
    hydroScenario("hydro-challenge-homes-block-too-big", "S8 A homes block is bigger than the spare power", "challenge", "S8", [{ type: "mode", mode: "CHALLENGE" }, feeder("homesBlocks", 1), feeder("shopsBlocks", 0)]),
    hydroScenario("hydro-challenge-corrected-not-reset", "S8 Trip diagnosed and corrected, reset not yet pressed", "challenge", "S8", [{ type: "mode", mode: "CHALLENGE" }, feeder("shopsBlocks", 2), feeder("shopsBlocks", 1)]),
    hydroScenario("hydro-challenge-reset-solved", "S8 Trip, correct, reset: hospital supplied again", "challenge", "S8", [{ type: "mode", mode: "CHALLENGE" }, feeder("shopsBlocks", 2), feeder("shopsBlocks", 1), { type: "reset-protection" }], true),
    hydroScenario("hydro-guided-overload-fourth-block", "S6 The fourth shops block trips the plant", "guided", "S6", [{ type: "guided-step", index: 4 }, rainy, units(3), feeder("homesBlocks", 4), feeder("shopsBlocks", 3), feeder("shopsBlocks", 4)], true),
    hydroScenario("hydro-assessment-trace", "S9 Trace water", "assessment", "S9", [{ type: "mode", mode: "ASSESSMENT" }, ...traceHydro, { type: "check", checkId: "trace-water", response: {} }]),
    hydroScenario("hydro-assessment-generator", "S9 Identify generator", "assessment", "S9", [{ type: "mode", mode: "ASSESSMENT" }, ...traceHydro, { type: "check", checkId: "trace-water", response: {} }, { type: "set-cutaway", cutawayId: "powerhouse-section" }, { type: "inspect-component", componentId: "u3-generator" }]),
    hydroScenario("hydro-assessment-dry-output", "S9 Reach dry output", "assessment", "S9", [{ type: "mode", mode: "ASSESSMENT" }, ...traceHydro, { type: "check", checkId: "trace-water", response: {} }, { type: "set-cutaway", cutawayId: "powerhouse-section" }, { type: "inspect-component", componentId: "u3-generator" }, { type: "check", checkId: "find-generator", response: {} }, dry]),
    hydroScenario("hydro-assessment-repair", "S9 Repair unit 3", "assessment", "S9", [{ type: "mode", mode: "ASSESSMENT" }, ...traceHydro, { type: "check", checkId: "trace-water", response: {} }, { type: "set-cutaway", cutawayId: "powerhouse-section" }, { type: "inspect-component", componentId: "u3-generator" }, { type: "check", checkId: "find-generator", response: {} }, dry, { type: "check", checkId: "dry-season-output", response: {} }, feeder("homesBlocks", 0), feeder("shopsBlocks", 1), { type: "reset-protection" }, { type: "check", checkId: "dry-season-peak", response: {} }, ...unit3Parts], true),
    hydroScenario("hydro-assessment-all-passed", "S9 Five direct manipulation checks", "assessment", "S9", [{ type: "mode", mode: "ASSESSMENT" }, ...traceHydro, { type: "check", checkId: "trace-water", response: {} }, { type: "set-cutaway", cutawayId: "powerhouse-section" }, { type: "inspect-component", componentId: "u3-generator" }, { type: "check", checkId: "find-generator", response: {} }, dry, { type: "check", checkId: "dry-season-output", response: {} }, feeder("homesBlocks", 0), feeder("shopsBlocks", 1), { type: "reset-protection" }, { type: "check", checkId: "dry-season-peak", response: {} }, ...unit3Parts, { type: "check", checkId: "repair-unit-3", response: {} }, { type: "camera-preset", presetId: "valley" }], true),
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
