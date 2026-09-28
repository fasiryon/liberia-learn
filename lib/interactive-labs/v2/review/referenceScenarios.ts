// Review scenarios for the two reference labs. They validate the capture mechanism end to end and are
// the worked examples future lab authors copy. They add no curriculum or evidence authority.
import { CIRCUIT_LAB_ID } from "../definitions/circuit";
import { SOLIDS_LAB_ID, SOLIDS_LAB_VERSION } from "../definitions/solids";
import type { InteractiveLabDefinition, LabAction, LabState } from "../types";
import { LAB_REVIEW_SCENARIO_VERSION, type LabReviewScenarioSet } from "./scenarios";

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

/** Registered scenario sets, keyed by lab id. A lab entering the production team adds its set here. */
export const LAB_REVIEW_SCENARIO_SETS: Readonly<Record<string, LabReviewScenarioSet>> = Object.freeze({
  [SOLIDS_REVIEW_SCENARIOS.labId]: SOLIDS_REVIEW_SCENARIOS,
  [CIRCUIT_REVIEW_SCENARIOS.labId]: CIRCUIT_REVIEW_SCENARIOS,
});

export function getLabReviewScenarioSet(labId: string): LabReviewScenarioSet | null {
  return LAB_REVIEW_SCENARIO_SETS[labId] ?? null;
}
