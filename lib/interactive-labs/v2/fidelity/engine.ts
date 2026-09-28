// Reusable high-fidelity state engine: structural inspection, variables, assemblies, tracing and
// direct-manipulation checks. Pure and deterministic; the renderer and the evidence layer only read its output.
import type { InteractiveLabDefinition, LabAction, LabState, LearningCheck } from "../types";
import { FIDELITY_ACTION_TYPES, type ExplanationLine, type FidelityAction, type FidelityCheck, type FidelityState, type HighFidelitySpec, type SimulationOutput } from "./types";
import { initialVariables, validateVariableValue } from "./variables";

type Verdict = { ok: true } | { ok: false; reason: string };
const OK: Verdict = { ok: true };
const reject = (reason: string): Verdict => ({ ok: false, reason });

export function isFidelityAction(action: LabAction): action is FidelityAction {
  return (FIDELITY_ACTION_TYPES as readonly string[]).includes(action.type);
}

export function initialFidelityState(spec: HighFidelitySpec): FidelityState {
  return {
    variables: initialVariables(spec.variables),
    explode: Object.fromEntries(spec.exploded.map((view) => [view.assemblyId, 0])),
    activeCutawayId: null,
    hiddenLayerIds: spec.layers.filter((layer) => !layer.defaultVisible).map((layer) => layer.id),
    isolatedId: null,
    labelsVisible: true,
    cameraPresetId: spec.camera.defaultPresetId,
    placements: Object.fromEntries(spec.assemblies.filter((assembly) => assembly.slots?.length).map((assembly) => [assembly.id, Object.fromEntries(assembly.slots!.map((slot) => [slot.id, slot.initialComponentId]))])),
    disassembled: [],
    tracedPaths: Object.fromEntries(spec.flows.map((flow) => [flow.id, []])),
    inspectedComponentId: null,
    guidedStepIndex: 0,
    hiddenFlowIds: spec.flows.filter((flow) => !flow.visibleByDefault).map((flow) => flow.id),
  };
}

export function assemblyOf(spec: HighFidelitySpec, componentId: string) {
  return spec.assemblies.find((assembly) => assembly.componentIds.includes(componentId)) ?? null;
}

/** An open assembly renders its components instead of its root object. */
export function isAssemblyOpen(spec: HighFidelitySpec, state: FidelityState, assemblyId: string): boolean {
  const assembly = spec.assemblies.find((candidate) => candidate.id === assemblyId);
  if (!assembly) return false;
  if (!assembly.rootObjectId) return true;
  if ((state.explode[assemblyId] ?? 0) > 0 || state.disassembled.includes(assemblyId)) return true;
  return spec.poseTransitions.some((pose) => pose.assemblyId === assemblyId && (state.variables[pose.variableId] ?? 0) > 0);
}

/** Whether a component can currently be seen (and therefore inspected) at any capability profile. */
export function isComponentRevealed(spec: HighFidelitySpec, state: FidelityState, componentId: string): boolean {
  const component = spec.components.find((candidate) => candidate.id === componentId);
  if (!component) return false;
  if (component.layerId && state.hiddenLayerIds.includes(component.layerId)) return false;
  const cutaway = spec.cutaways.find((candidate) => candidate.id === state.activeCutawayId);
  if (cutaway?.removesComponentIds.includes(componentId)) return false;
  if (component.internal && !cutaway?.revealsComponentIds.includes(componentId)) return false;
  const assembly = assemblyOf(spec, componentId);
  return !assembly || isAssemblyOpen(spec, state, assembly.id);
}

export function validateFidelityAction(spec: HighFidelitySpec, state: FidelityState, action: FidelityAction, sceneObjectIds: readonly string[] = []): Verdict {
  switch (action.type) {
    case "set-variable": {
      const variable = spec.variables.find((candidate) => candidate.id === action.variableId);
      if (!variable) return reject("variable_unknown");
      if (!variable.learnerControlled) return reject("variable_not_learner_controlled");
      return validateVariableValue(variable, action.value);
    }
    case "set-explode":
      if (!spec.exploded.some((view) => view.assemblyId === action.assemblyId)) return reject("exploded_view_unknown");
      return typeof action.factor === "number" && Number.isFinite(action.factor) && action.factor >= 0 && action.factor <= 1 ? OK : reject("explode_factor_out_of_bounds");
    case "set-cutaway":
      return action.cutawayId === null || spec.cutaways.some((cutaway) => cutaway.id === action.cutawayId) ? OK : reject("cutaway_unknown");
    case "toggle-layer":
      return spec.layers.some((layer) => layer.id === action.layerId) ? OK : reject("layer_unknown");
    case "isolate":
      return action.targetId === null || spec.components.some((component) => component.id === action.targetId) || sceneObjectIds.includes(action.targetId) ? OK : reject("isolate_target_unknown");
    case "toggle-labels":
      return OK;
    case "camera-preset":
      return spec.camera.presets.some((preset) => preset.id === action.presetId) ? OK : reject("camera_preset_unknown");
    case "clear-assembly":
      return spec.assemblies.some((assembly) => assembly.id === action.assemblyId && assembly.slots?.length) ? OK : reject("assembly_not_buildable");
    case "place-component": {
      const assembly = spec.assemblies.find((candidate) => candidate.id === action.assemblyId);
      if (!assembly?.slots?.some((slot) => slot.id === action.slotId)) return reject("assembly_slot_unknown");
      if (action.componentId !== null && !assembly.componentIds.includes(action.componentId)) return reject("component_not_in_assembly");
      return state.disassembled.includes(assembly.id) ? OK : reject("assembly_not_disassembled");
    }
    case "trace-node": {
      const flow = spec.flows.find((candidate) => candidate.id === action.flowId);
      if (!flow) return reject("flow_unknown");
      return flow.nodes.some((node) => node.id === action.nodeId && node.traceable) ? OK : reject("flow_node_not_traceable");
    }
    case "clear-trace":
    case "toggle-flow":
      return spec.flows.some((flow) => flow.id === action.flowId) ? OK : reject("flow_unknown");
    case "inspect-component": {
      const component = spec.components.find((candidate) => candidate.id === action.componentId);
      if (!component || component.selectable === false) return reject("component_not_selectable");
      return isComponentRevealed(spec, state, action.componentId) ? OK : reject("component_not_visible");
    }
    case "guided-step":
      return Number.isInteger(action.index) && action.index >= 0 && action.index < spec.guidedPath.length ? OK : reject("guided_step_out_of_range");
  }
}

function toggle(list: readonly string[], id: string): string[] {
  return list.includes(id) ? list.filter((candidate) => candidate !== id) : [...list, id];
}

export function transitionFidelity(spec: HighFidelitySpec, state: FidelityState, action: FidelityAction): FidelityState {
  switch (action.type) {
    case "set-variable":
      return { ...state, variables: { ...state.variables, [action.variableId]: action.value } };
    case "set-explode": {
      const view = spec.exploded.find((candidate) => candidate.assemblyId === action.assemblyId);
      return { ...state, explode: { ...state.explode, [action.assemblyId]: action.factor }, cameraPresetId: action.factor > 0 && view?.cameraPresetId ? view.cameraPresetId : state.cameraPresetId };
    }
    case "set-cutaway": {
      const cutaway = spec.cutaways.find((candidate) => candidate.id === action.cutawayId);
      const next = { ...state, activeCutawayId: action.cutawayId, cameraPresetId: cutaway?.cameraPresetId ?? state.cameraPresetId };
      return next.inspectedComponentId && !isComponentRevealed(spec, next, next.inspectedComponentId) ? { ...next, inspectedComponentId: null } : next;
    }
    case "toggle-layer":
      return { ...state, hiddenLayerIds: toggle(state.hiddenLayerIds, action.layerId) };
    case "isolate":
      return { ...state, isolatedId: action.targetId };
    case "toggle-labels":
      return { ...state, labelsVisible: !state.labelsVisible };
    case "camera-preset":
      return { ...state, cameraPresetId: action.presetId };
    case "clear-assembly":
      return { ...state, placements: { ...state.placements, [action.assemblyId]: {} }, disassembled: state.disassembled.includes(action.assemblyId) ? state.disassembled : [...state.disassembled, action.assemblyId] };
    case "place-component": {
      const current = Object.fromEntries(Object.entries(state.placements[action.assemblyId] ?? {}).filter(([slotId, componentId]) => slotId !== action.slotId && componentId !== action.componentId));
      if (action.componentId !== null) current[action.slotId] = action.componentId;
      return { ...state, placements: { ...state.placements, [action.assemblyId]: current } };
    }
    case "trace-node": {
      const flow = spec.flows.find((candidate) => candidate.id === action.flowId)!;
      const prior = state.tracedPaths[action.flowId] ?? [];
      if (prior[prior.length - 1] === action.nodeId) return state;
      const limit = flow.nodes.length * 2;
      return { ...state, tracedPaths: { ...state.tracedPaths, [action.flowId]: [...prior, action.nodeId].slice(-limit) } };
    }
    case "clear-trace":
      return { ...state, tracedPaths: { ...state.tracedPaths, [action.flowId]: [] } };
    case "inspect-component":
      return { ...state, inspectedComponentId: action.componentId };
    case "guided-step": {
      const step = spec.guidedPath[action.index];
      return { ...state, guidedStepIndex: action.index, cameraPresetId: step.cameraPresetId ?? state.cameraPresetId };
    }
    case "toggle-flow":
      return { ...state, hiddenFlowIds: toggle(state.hiddenFlowIds, action.flowId) };
  }
}

const EMPTY_SIMULATION: SimulationOutput = Object.freeze({ quantities: {}, flows: {}, componentStates: {}, explanation: [] }) as SimulationOutput;

/** Runs the simulation rule layer. The renderer never computes consequences itself. */
export function deriveSimulation(spec: HighFidelitySpec, state: FidelityState): SimulationOutput {
  return spec.simulation ? spec.simulation.evaluate({ variables: state.variables, placements: state.placements }) : EMPTY_SIMULATION;
}

/** Grade-filtered explanation layer built from simulation output and the structural explainer. */
export function explainState(spec: HighFidelitySpec, state: FidelityState, grade: number): ExplanationLine[] {
  const lines = [...deriveSimulation(spec, state).explanation, ...(spec.explain?.(state) ?? [])];
  return lines.filter((line) => (line.minGrade ?? 0) <= grade);
}

export function expectedTrace(spec: HighFidelitySpec, flowId: string): string[] {
  return spec.flows.find((flow) => flow.id === flowId)?.nodes.filter((node) => node.traceable).map((node) => node.id) ?? [];
}

export function isAssemblyComplete(spec: HighFidelitySpec, state: FidelityState, assemblyId: string): boolean {
  const assembly = spec.assemblies.find((candidate) => candidate.id === assemblyId);
  if (!assembly?.slots?.length) return false;
  const placements = state.placements[assemblyId] ?? {};
  const used = new Set<string>();
  return assembly.slots.every((slot) => {
    const componentId = placements[slot.id];
    const component = spec.components.find((candidate) => candidate.id === componentId);
    if (!component || used.has(component.id) || component.shapeKey !== slot.accepts) return false;
    used.add(component.id);
    return true;
  });
}

export function evaluateFidelityCheck(spec: HighFidelitySpec, state: FidelityState, check: FidelityCheck): boolean {
  switch (check.kind) {
    case "reach-target": {
      const value = deriveSimulation(spec, state).quantities[check.quantityId];
      return typeof value === "number" && Number.isFinite(value) && value >= check.min && value <= check.max;
    }
    case "trace-path": {
      const flow = deriveSimulation(spec, state).flows[check.flowId];
      if (flow && !flow.active) return false;
      const traced = state.tracedPaths[check.flowId] ?? [];
      const expected = expectedTrace(spec, check.flowId);
      return expected.length > 0 && traced.length === expected.length && traced.every((nodeId, index) => nodeId === expected[index]);
    }
    case "assemble":
      return state.disassembled.includes(check.assemblyId) && isAssemblyComplete(spec, state, check.assemblyId);
    case "identify-component":
      return state.inspectedComponentId === check.componentId && isComponentRevealed(spec, state, check.componentId);
  }
}

/** Structural validation for restored checkpoints: a corrupt or tampered fidelity slice is rejected, not repaired. */
export function isValidFidelityState(spec: HighFidelitySpec, value: unknown): value is FidelityState {
  if (!value || typeof value !== "object") return false;
  const state = value as FidelityState;
  if (!state.variables || typeof state.variables !== "object") return false;
  const variableIds = Object.keys(state.variables).sort();
  if (variableIds.join("|") !== spec.variables.map((variable) => variable.id).sort().join("|")) return false;
  if (!spec.variables.every((variable) => validateVariableValue(variable, state.variables[variable.id]).ok)) return false;
  if (!state.explode || !Object.entries(state.explode).every(([id, factor]) => spec.exploded.some((view) => view.assemblyId === id) && typeof factor === "number" && factor >= 0 && factor <= 1)) return false;
  if (state.activeCutawayId !== null && !spec.cutaways.some((cutaway) => cutaway.id === state.activeCutawayId)) return false;
  if (!spec.camera.presets.some((preset) => preset.id === state.cameraPresetId)) return false;
  if (!Number.isInteger(state.guidedStepIndex) || state.guidedStepIndex < 0 || (spec.guidedPath.length > 0 && state.guidedStepIndex >= spec.guidedPath.length)) return false;
  if (!Array.isArray(state.hiddenLayerIds) || !Array.isArray(state.disassembled) || !Array.isArray(state.hiddenFlowIds)) return false;
  if (!state.placements || !Object.entries(state.placements).every(([assemblyId, slots]) => {
    const assembly = spec.assemblies.find((candidate) => candidate.id === assemblyId);
    return !!assembly && Object.entries(slots ?? {}).every(([slotId, componentId]) => assembly.slots?.some((slot) => slot.id === slotId) && assembly.componentIds.includes(componentId));
  })) return false;
  if (!state.tracedPaths || !Object.entries(state.tracedPaths).every(([flowId, nodes]) => Array.isArray(nodes) && nodes.every((nodeId) => spec.flows.find((flow) => flow.id === flowId)?.nodes.some((node) => node.id === nodeId)))) return false;
  return true;
}

/** Shared check bookkeeping so every lab records completion, retries and COMPLETE mode the same way. */
export function recordCheckResult(state: LabState, checks: readonly LearningCheck[], checkId: string, correct: boolean): LabState {
  const completedChecks = correct && !state.completedChecks.includes(checkId) ? [...state.completedChecks, checkId] : state.completedChecks;
  const allDone = checks.every((check) => completedChecks.includes(check.id));
  return { ...state, completedChecks, retries: correct ? state.retries : state.retries + 1, lastFeedback: correct ? "correct" : "incorrect", mode: correct && allDone ? "COMPLETE" : state.mode };
}

/**
 * Attaches a high-fidelity layer to a definition without a bespoke architecture: fidelity actions and
 * direct-manipulation checks go through the reusable engine, everything else goes to the definition's own rules.
 */
export function composeHighFidelity(base: InteractiveLabDefinition<LabState>, spec: HighFidelitySpec): InteractiveLabDefinition<LabState> {
  const sceneObjectIds = base.scene.objects.map((object) => object.id);
  const fidelityChecks = new Map(base.checks.filter((check) => check.fidelity).map((check) => [check.id, check.fidelity!]));
  const current = (state: LabState) => state.fidelity ?? initialFidelityState(spec);
  return {
    ...base,
    fidelity: spec,
    initialState: { ...base.initialState, fidelity: initialFidelityState(spec) },
    validateAction: (state, action) => {
      if (isFidelityAction(action)) return validateFidelityAction(spec, current(state), action, sceneObjectIds);
      if (action.type === "check" && fidelityChecks.has(action.checkId)) return OK;
      return base.validateAction(state, action);
    },
    transition: (state, action) => {
      if (action.type === "reset") return { ...base.transition(state, action), fidelity: initialFidelityState(spec) };
      if (isFidelityAction(action)) return { ...state, fidelity: transitionFidelity(spec, current(state), action), lastFeedback: null };
      const fidelityCheck = action.type === "check" ? fidelityChecks.get(action.checkId) : undefined;
      if (action.type === "check" && fidelityCheck) return recordCheckResult(state, base.checks, action.checkId, evaluateFidelityCheck(spec, current(state), fidelityCheck));
      return { ...base.transition(state, action), fidelity: current(state) };
    },
  };
}
