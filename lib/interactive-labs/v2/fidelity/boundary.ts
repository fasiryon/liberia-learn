// Evidence boundary, authoring validation and offline packaging for high-fidelity labs.
import type { InteractiveLabDefinition, LabAction, LabState } from "../types";
import { HIGH_FIDELITY_SPEC_VERSION, type HighFidelityAuthoringRecord, type HighFidelitySpec } from "./types";
import { deriveSimulation, initialFidelityState } from "./engine";
import { validateVariableValue } from "./variables";
import { compositeHex, contrastRatio, deltaE00, highlightColor, HIGHLIGHT_COLOR, INACTIVE_FLOW_COLOR } from "./palette";

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
  for (const component of spec.components.filter((candidate) => candidate.detail === "decor")) {
    const id = component.id;
    if (component.label.trim()) errors.push(`decor_has_label:${id}`);
    if (component.description?.trim()) errors.push(`decor_has_description:${id}`);
    if (component.showLabel !== undefined) errors.push(`decor_declares_show_label:${id}`);
    if (component.selectable !== false) errors.push(`decor_selectable:${id}`);
    if (component.internal) errors.push(`decor_internal:${id}`);
    if (component.carriesSymbol || component.carriesScale || component.carriesPlaceIdentity) errors.push(`decor_instructional_identity:${id}`);
    if (/(hospital.*sign|(?:30|distance).*km|river.*bend|tower)/i.test(id)) errors.push(`decor_named_instructional_landmark:${id}`);
    const linked = spec.flows.some((flow) => flow.nodes.some((node) => node.componentId === id))
      || spec.cutaways.some((cutaway) => cutaway.removesComponentIds.includes(id) || cutaway.revealsComponentIds.includes(id))
      || spec.exploded.some((view) => Object.hasOwn(view.offsets, id))
      || spec.assemblies.some((assembly) => assembly.componentIds.includes(id) || assembly.slots?.some((slot) => slot.initialComponentId === id))
      || spec.poseTransitions.some((pose) => Object.hasOwn(pose.from, id) || Object.hasOwn(pose.to, id))
      || spec.guidedPath.some((step) => step.highlightIds?.includes(id))
      || definition.checks.some((check) => check.fidelity?.kind === "identify-component" && check.fidelity.componentId === id);
    if (linked) errors.push(`decor_instructional_reference:${id}`);
    const mentions = (value: string) => value.toLocaleLowerCase().includes(id.toLocaleLowerCase());
    if (spec.guidedPath.some((step) => mentions(step.prompt)) || definition.checks.some((check) => mentions(check.prompt))
      || spec.camera.presets.some((preset) => mentions(preset.id) || mentions(preset.label))) errors.push(`decor_named_in_instruction:${id}`);
    if (spec.simulation && Object.hasOwn(deriveSimulation(spec, initialFidelityState(spec)).componentStates, id)) errors.push(`decor_has_component_state:${id}`);
  }
  const motionComponentIds = new Set<string>();
  for (const motion of spec.motions ?? []) {
    if (motion.componentIds.length === 0) errors.push(`motion_components_missing:${motion.id}`);
    for (const id of motion.componentIds) {
      if (!known(id)) errors.push(`motion_component_unknown:${motion.id}:${id}`);
      if (motionComponentIds.has(id)) errors.push(`motion_component_shared:${id}`);
      motionComponentIds.add(id);
    }
    if (!known(motion.activeWhen.componentId)) errors.push(`motion_driver_unknown:${motion.id}:${motion.activeWhen.componentId}`);
    if (motion.activeWhen.statuses.length === 0) errors.push(`motion_statuses_missing:${motion.id}`);
    if (!(motion.rpm > 0) || !Number.isFinite(motion.rpm)) errors.push(`motion_rpm_invalid:${motion.id}`);
    if (!(motion.symmetryOrder >= 1) || !Number.isInteger(motion.symmetryOrder)) errors.push(`motion_symmetry_invalid:${motion.id}`);
    if (motion.rpm / 60 * motion.symmetryOrder > 12) errors.push(`motion_aliasing:${motion.id}`);
    const members = spec.components.filter((component) => motion.componentIds.includes(component.id));
    const radialDistance = (position: number[]) => motion.axis === "x" ? Math.hypot(position[1] - motion.pivot[1], position[2] - motion.pivot[2]) : motion.axis === "y" ? Math.hypot(position[0] - motion.pivot[0], position[2] - motion.pivot[2]) : Math.hypot(position[0] - motion.pivot[0], position[1] - motion.pivot[1]);
    if (members.length > 0 && members.every((component) => component.geometry === "sphere" || ((component.geometry === "cylinder" || component.geometry === "cone") && radialDistance(component.transform.position) < 1e-4))) errors.push(`motion_invisible:${motion.id}`);
  }
  for (const assembly of spec.assemblies) {
    if (assembly.rootObjectId && !objectIds.includes(assembly.rootObjectId)) errors.push(`assembly_root_unknown:${assembly.id}`);
    if (assembly.rootComponentId && !known(assembly.rootComponentId)) errors.push(`assembly_root_component_unknown:${assembly.id}`);
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
    try {
      if (deltaE00(INACTIVE_FLOW_COLOR, flow.color) < 20) errors.push(`flow_palette_too_close_to_inactive:${flow.id}`);
      if (deltaE00(HIGHLIGHT_COLOR, flow.color) < 25) errors.push(`flow_palette_too_close_to_highlight:${flow.id}`);
    } catch { errors.push(`flow_color_invalid:${flow.id}`); }
  }
  if (contrastRatio(compositeHex(INACTIVE_FLOW_COLOR, "#263d72", 1), "#263d72") < 3) errors.push("inactive_flow_contrast_below_3_after_blend");
  if (deltaE00(HIGHLIGHT_COLOR, INACTIVE_FLOW_COLOR) < 25) errors.push("highlight_too_close_to_inactive_flow");
  if (deltaE00(HIGHLIGHT_COLOR, "#fde68a") < 25) errors.push("highlight_too_close_to_emissive_glow");
  for (const material of [...definition.scene.objects.map((object) => object.material), ...spec.components.map((component) => component.material)]) {
    try {
      // Gate the least visible (20% base mix, zero rim) highlight and the most visible rim separately.
      if (deltaE00(material.color, highlightColor(material.color, true, false, 0)) < 15) errors.push(`highlight_material_minimum_difference_too_small:${material.color}`);
      if (deltaE00(material.color, highlightColor(material.color, true, false, 1)) < 15) errors.push(`highlight_material_rim_difference_too_small:${material.color}`);
    }
    catch { errors.push(`material_color_invalid:${material.color}`); }
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
