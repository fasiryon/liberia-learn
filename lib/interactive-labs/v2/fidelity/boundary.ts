// Evidence boundary, authoring validation and offline packaging for high-fidelity labs.
import type { InteractiveLabDefinition, LabAction, LabState } from "../types";
import { HIGH_FIDELITY_SPEC_VERSION, type HighFidelityAuthoringRecord, type HighFidelitySpec } from "./types";
import { validateVariableValue } from "./variables";

/**
 * Visual interaction is not learning evidence. Only a governed learning check may produce evidence, and
 * even then only through buildLabEvidence -> adaptLabEvidence (no direct mastery writes).
 */
export type LabActionEvidenceClass = "IGNORED" | "RAW_OBSERVATION" | "LEARNING_CHECK";

const IGNORED: ReadonlySet<LabAction["type"]> = new Set(["camera-preset", "toggle-labels", "focus", "guided-step", "mode", "toggle-flow"]);

export function classifyLabAction(action: LabAction): LabActionEvidenceClass {
  if (action.type === "check") return "LEARNING_CHECK";
  return IGNORED.has(action.type) ? "IGNORED" : "RAW_OBSERVATION";
}

export function isEvidenceBearingAction(action: unknown): boolean {
  return !!action && typeof action === "object" && classifyLabAction(action as LabAction) === "LEARNING_CHECK";
}

export const AUTHORING_FIELDS: readonly (keyof HighFidelityAuthoringRecord)[] = Object.freeze(["learningObjective", "whyInteractive", "scene", "components", "internalStructures", "variables", "simulationRules", "learnerControls", "visualConsequences", "guidedPath", "exploreMode", "challenge", "assessment", "evidence", "misconceptions", "accessibility", "deviceProfile", "offlineFallback"]);

function duplicates(ids: readonly string[]): string[] { return ids.filter((id, index) => ids.indexOf(id) !== index); }

/** Authoring gate: every high-fidelity definition must satisfy the standard before it can be registered. */
export function validateHighFidelityDefinition(definition: InteractiveLabDefinition<LabState>): string[] {
  const spec: HighFidelitySpec | undefined = definition.fidelity;
  if (!spec) return ["fidelity_spec_missing"];
  const errors: string[] = [];
  if (spec.specVersion !== HIGH_FIDELITY_SPEC_VERSION) errors.push("spec_version_unsupported");
  for (const field of AUTHORING_FIELDS) if (!spec.authoring[field]?.trim()) errors.push(`authoring_missing:${field}`);
  const componentIds = spec.components.map((component) => component.id);
  const objectIds = definition.scene.objects.map((object) => object.id);
  for (const id of duplicates([...componentIds, ...objectIds])) errors.push(`duplicate_id:${id}`);
  const known = (id: string) => componentIds.includes(id);
  for (const assembly of spec.assemblies) {
    if (assembly.rootObjectId && !objectIds.includes(assembly.rootObjectId)) errors.push(`assembly_root_unknown:${assembly.id}`);
    for (const id of assembly.componentIds) if (!known(id)) errors.push(`assembly_component_unknown:${assembly.id}:${id}`);
    for (const slot of assembly.slots ?? []) {
      if (!assembly.componentIds.includes(slot.initialComponentId)) errors.push(`slot_initial_unknown:${slot.id}`);
      if (!assembly.componentIds.some((id) => spec.components.find((component) => component.id === id)?.shapeKey === slot.accepts)) errors.push(`slot_unfillable:${slot.id}`);
    }
  }
  for (const view of spec.exploded) {
    if (!spec.assemblies.some((assembly) => assembly.id === view.assemblyId)) errors.push(`exploded_assembly_unknown:${view.assemblyId}`);
    for (const id of Object.keys(view.offsets)) if (!known(id)) errors.push(`exploded_component_unknown:${id}`);
  }
  for (const cutaway of spec.cutaways) for (const id of [...cutaway.removesComponentIds, ...cutaway.revealsComponentIds]) if (!known(id)) errors.push(`cutaway_component_unknown:${cutaway.id}:${id}`);
  for (const component of spec.components) if (component.internal && !spec.cutaways.some((cutaway) => cutaway.revealsComponentIds.includes(component.id))) errors.push(`internal_unreachable:${component.id}`);
  for (const pose of spec.poseTransitions) if (!spec.variables.some((variable) => variable.id === pose.variableId && variable.min === 0 && variable.max === 1)) errors.push(`pose_variable_invalid:${pose.id}`);
  for (const variable of spec.variables) {
    if (!(variable.min < variable.max) || !(variable.step > 0)) errors.push(`variable_bounds_invalid:${variable.id}`);
    else if (!validateVariableValue(variable, variable.initial).ok) errors.push(`variable_initial_invalid:${variable.id}`);
  }
  for (const flow of spec.flows) {
    const nodeIds = flow.nodes.map((node) => node.id);
    if (nodeIds[0] !== flow.sourceNodeId || nodeIds[nodeIds.length - 1] !== flow.destinationNodeId) errors.push(`flow_endpoints_invalid:${flow.id}`);
    for (const node of flow.nodes) if (node.componentId && !known(node.componentId)) errors.push(`flow_component_unknown:${flow.id}:${node.componentId}`);
  }
  const presetIds = spec.camera.presets.map((preset) => preset.id);
  if (!presetIds.includes(spec.camera.defaultPresetId)) errors.push("camera_default_unknown");
  for (const preset of spec.camera.presets) if (preset.distance < spec.camera.constraints.minDistance || preset.distance > spec.camera.constraints.maxDistance) errors.push(`camera_preset_outside_constraints:${preset.id}`);
  for (const step of spec.guidedPath) if (step.cameraPresetId && !presetIds.includes(step.cameraPresetId)) errors.push(`guided_camera_unknown:${step.id}`);
  const direct = definition.checks.filter((check) => check.kind === "direct-manipulation");
  if (direct.length === 0) errors.push("direct_manipulation_check_missing");
  for (const check of direct) if (!check.fidelity) errors.push(`direct_check_unbound:${check.id}`);
  for (const check of definition.checks) {
    const fidelity = check.fidelity;
    if (!fidelity) continue;
    if (fidelity.kind === "trace-path" && !spec.flows.some((flow) => flow.id === fidelity.flowId && flow.nodes.some((node) => node.traceable))) errors.push(`check_flow_untraceable:${check.id}`);
    if (fidelity.kind === "assemble" && !spec.assemblies.some((assembly) => assembly.id === fidelity.assemblyId && assembly.slots?.length)) errors.push(`check_assembly_unbuildable:${check.id}`);
    if (fidelity.kind === "identify-component" && !known(fidelity.componentId)) errors.push(`check_component_unknown:${check.id}`);
    if (fidelity.kind === "reach-target" && !spec.simulation) errors.push(`check_requires_simulation:${check.id}`);
  }
  if (spec.offline.remoteAssets.length > 0 && definition.accessibility.offline) errors.push("offline_claim_with_remote_assets");
  if (spec.modes.length === 0) errors.push("modes_missing");
  return errors;
}

/** Serializable offline manifest: data only (rules ship with the app bundle), sized against the declared budget. */
export function buildOfflineManifest(definition: InteractiveLabDefinition<LabState>) {
  const spec = definition.fidelity;
  const data = JSON.parse(JSON.stringify({ id: definition.id, version: definition.version, scene: definition.scene, checks: definition.checks, fidelity: spec ? { ...spec, simulation: spec.simulation ? { id: spec.simulation.id, version: spec.simulation.version, kind: spec.simulation.kind } : undefined, explain: undefined } : undefined, initialState: definition.initialState }));
  const bytes = new TextEncoder().encode(JSON.stringify(data)).length;
  return { data, bytes, withinBudget: !spec || bytes <= spec.offline.maxPackageBytes, remoteAssets: spec?.offline.remoteAssets ?? [] };
}
