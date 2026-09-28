// Renderer-agnostic scene presentation. WebGL (HIGH/STANDARD/LOW) and the SVG fallback draw the same list,
// which is what keeps FALLBACK_2D instructionally equivalent.
import type { CapabilityProfile, GeometryKind, InteractiveLabDefinition, LabState, Transform } from "../types";
import type { ExplanationLine, FidelityState, FlowNode, HighFidelitySpec } from "./types";
import { assemblyOf, deriveSimulation, explainState, isAssemblyOpen, isComponentRevealed } from "./engine";
import { flowPoints, presetPose, type CameraPose } from "./presentation";
import { RENDER_BUDGETS, type RenderBudget } from "./profiles";
import { MARKER_COLOR } from "./palette";
import { IDENTITY, addVec3, lerpTransform, multiply, rotate, scaleVec3, transformMatrix, transformPoint, translate, type Mat4, type Vec3 } from "./math";

export type ItemSpin = { pre: Mat4; local: Mat4; pivot: Vec3; axis: "x" | "y" | "z"; radPerSec: number };
export type RenderItem = {
  id: string;
  label: string;
  kind: "object" | "component";
  geometry: GeometryKind;
  matrix: Mat4;
  center: Vec3;
  color: string;
  alpha: number;
  emissive: number;
  clip: { normal: Vec3; offset: number } | null;
  highlighted: boolean;
  selectable: boolean;
  showLabel: boolean;
  /** False when the item is only faded context around an isolated part. */
  inFocus: boolean;
  detail?: "decor";
  spin?: ItemSpin;
};
export type RenderMarker = { id: string; position: Vec3; color: string; label?: string };
export type RenderFlow = { id: string; label: string; color: string; points: Vec3[]; active: boolean; rate: number; direction: 1 | -1; particleCount: number; nodes: FlowNode[]; traced: string[] };
export type RenderMotion = { id: string; label: string; active: boolean; center: Vec3 };
export type RenderList = { items: RenderItem[]; markers: RenderMarker[]; flows: RenderFlow[]; motions: RenderMotion[]; camera: CameraPose | null; budget: RenderBudget; explanation: ExplanationLine[]; quantities: Record<string, number> };

/** Paint decorative 2D scenery first so trace nodes, labels and controls remain above it. */
export function orderFallbackItems(items: readonly RenderItem[]): RenderItem[] {
  return [...items.filter((item) => item.detail === "decor"), ...items.filter((item) => item.detail !== "decor").sort((a, b) => a.center[2] - b.center[2])];
}

/** Corners of the box meshes used by cube / rectangular-prism, indexed like the vertex feature indices. */
export function boxCorners(geometry: GeometryKind): Vec3[] {
  const [x, y, z] = geometry === "rectangular-prism" ? [1.25, 0.82, 0.72] : [1, 1, 1];
  return [[-x, -y, -z], [x, -y, -z], [x, y, -z], [-x, y, -z], [-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z]];
}

function objectRotation(state: LabState, id: string, fallback: Vec3): Vec3 { return state.rotations[id] ?? fallback; }

function componentLocalTransform(spec: HighFidelitySpec, display: FidelityState, componentId: string, base: Transform): Transform {
  const assembly = assemblyOf(spec, componentId);
  let local = base;
  if (assembly?.slots?.length) {
    const slotId = Object.entries(display.placements[assembly.id] ?? {}).find(([, placed]) => placed === componentId)?.[0];
    const slot = assembly.slots.find((candidate) => candidate.id === slotId);
    if (slot) local = slot.transform;
  }
  let posed = 0;
  for (const pose of spec.poseTransitions) {
    if (pose.assemblyId !== assembly?.id) continue;
    posed = Math.max(posed, display.variables[pose.variableId] ?? 0);
    // Applied at every value (including 0) so the pose always reflects state, e.g. an open switch.
    local = lerpTransform(pose.from[componentId] ?? local, pose.to[componentId] ?? local, display.variables[pose.variableId] ?? 0);
  }
  const offset = assembly ? spec.exploded.find((view) => view.assemblyId === assembly.id)?.offsets[componentId] : undefined;
  // The exploded offset fades out as a pose (e.g. a net) takes over, so the two never scatter each other.
  const factor = assembly ? (display.explode[assembly.id] ?? 0) * (1 - posed) : 0;
  return offset && factor > 0 ? { ...local, position: addVec3(local.position, scaleVec3(offset, factor)) } : local;
}

export function buildRenderList(input: { definition: InteractiveLabDefinition<LabState>; state: LabState; profile: CapabilityProfile; displayFidelity?: FidelityState; guidedHighlights?: boolean }): RenderList {
  const { definition, state, profile } = input;
  const budget = RENDER_BUDGETS[profile];
  const spec = definition.fidelity;
  const fidelity = state.fidelity;
  const display = input.displayFidelity ?? fidelity;
  const items: RenderItem[] = [];
  const markers: RenderMarker[] = [];
  const isolatedId = fidelity?.isolatedId ?? null;
  const guided = spec && fidelity && (input.guidedHighlights ?? state.mode === "GUIDED") ? spec.guidedPath[fidelity.guidedStepIndex]?.highlightIds ?? [] : [];
  const openRoots = new Set(spec && display ? spec.assemblies.filter((assembly) => assembly.rootObjectId && isAssemblyOpen(spec, display, assembly.id)).map((assembly) => assembly.rootObjectId!) : []);
  // An explicit isolation wins; otherwise opening a solid (explode, net, take apart) brings it into focus and fades the rest.
  const focusOf = (id: string, rootId?: string) => isolatedId ? isolatedId === id || (!!rootId && isolatedId === rootId) : openRoots.size === 0 || (!!rootId && openRoots.has(rootId));

  for (const object of definition.scene.objects) {
    if (openRoots.has(object.id)) continue;
    const inFocus = focusOf(object.id);
    if (!inFocus && !budget.fadeContext) continue;
    const matrix = multiply(translate(...object.transform.position), multiply(rotate(...objectRotation(state, object.id, object.transform.rotation)), transformMatrix({ position: [0, 0, 0], rotation: [0, 0, 0], scale: object.transform.scale })));
    items.push({ id: object.id, label: object.label, kind: "object", geometry: object.geometry, matrix, center: object.transform.position, color: object.material.color, alpha: inFocus ? 0.94 : 0.12, emissive: 0, clip: null, highlighted: state.selectedObjectId === object.id || guided.includes(object.id), selectable: object.selectable !== false, showLabel: fidelity?.labelsVisible ?? true, inFocus });
    const features = state.highlightedFeatures[object.id];
    if (features?.kind === "vertex") for (const index of features.indices) markers.push({ id: `${object.id}:vertex:${index}`, position: transformPoint(matrix, boxCorners(object.geometry)[index] ?? [0, 0, 0]), color: MARKER_COLOR, label: String(index + 1) });
  }

  if (!spec || !fidelity || !display) return { items, markers, flows: [], motions: [], camera: null, budget, explanation: [], quantities: {} };

  const simulation = deriveSimulation(spec, fidelity);
  const motionDefinitions = spec.motions ?? [];
  const motionActive = new Map(motionDefinitions.map((motion) => [motion.id, motion.activeWhen.statuses.includes(simulation.componentStates[motion.activeWhen.componentId]?.status ?? "")]));
  const motionByComponent = new Map(motionDefinitions.flatMap((motion) => motion.componentIds.map((id) => [id, motion] as const)));
  const motions: RenderMotion[] = motionDefinitions.map((motion) => {
    const component = spec.components.find((candidate) => motion.componentIds.includes(candidate.id));
    const assembly = component ? assemblyOf(spec, component.id) : null;
    const root = assembly?.rootObjectId ? definition.scene.objects.find((object) => object.id === assembly.rootObjectId) : undefined;
    const pre = root ? multiply(translate(...root.transform.position), rotate(...objectRotation(state, root.id, root.transform.rotation))) : IDENTITY;
    return { id: motion.id, label: motion.label, active: motionActive.get(motion.id) ?? false, center: transformPoint(pre, motion.pivot) };
  });
  const cutaway = spec.cutaways.find((candidate) => candidate.id === fidelity.activeCutawayId) ?? null;
  for (const component of spec.components) {
    if (component.detail === "decor" && budget.meshDetail === "low") continue;
    const assembly = assemblyOf(spec, component.id);
    const rootObject = assembly?.rootObjectId ? definition.scene.objects.find((object) => object.id === assembly.rootObjectId) : undefined;
    if (rootObject && !openRoots.has(rootObject.id)) continue;
    if (component.layerId && fidelity.hiddenLayerIds.includes(component.layerId)) continue;
    const removed = !!cutaway?.removesComponentIds.includes(component.id);
    if (removed && !budget.shaderClipping) continue;
    if (component.internal && !cutaway?.revealsComponentIds.includes(component.id)) continue;
    const inFocus = focusOf(component.id, rootObject?.id ?? assembly?.id);
    if (!inFocus && !budget.fadeContext) continue;
    const rootMatrix = rootObject ? multiply(translate(...rootObject.transform.position), rotate(...objectRotation(state, rootObject.id, rootObject.transform.rotation))) : IDENTITY;
    const localTransform = componentLocalTransform(spec, display, component.id, component.transform);
    const localMatrix = transformMatrix(localTransform);
    const matrix = multiply(rootMatrix, localMatrix);
    const motion = motionByComponent.get(component.id);
    const spin = motion && motionActive.get(motion.id) ? { pre: rootMatrix, local: localMatrix, pivot: motion.pivot, axis: motion.axis, radPerSec: motion.rpm * Math.PI / 30 } : undefined;
    const highlighted = fidelity.inspectedComponentId === component.id || guided.includes(component.id);
    items.push({ id: component.id, label: component.label, kind: "component", geometry: component.geometry, matrix, center: transformPoint(matrix, [0, 0, 0]), color: component.material.color, alpha: !inFocus ? 0.12 : removed ? 0.35 : component.material.opacity ?? 0.96, emissive: simulation.componentStates[component.id]?.intensity ?? 0, clip: removed && cutaway ? cutaway.plane : null, highlighted, selectable: component.detail !== "decor" && component.selectable !== false && !removed && isComponentRevealed(spec, fidelity, component.id), showLabel: component.detail !== "decor" && fidelity.labelsVisible && component.selectable !== false && !removed, inFocus, detail: component.detail, spin });
  }

  const flows: RenderFlow[] = spec.flows.filter((flow) => !fidelity.hiddenFlowIds.includes(flow.id)).map((flow) => {
    const simulated = simulation.flows[flow.id] ?? { active: true, rate: 1, direction: 1 as const };
    return { id: flow.id, label: flow.label, color: flow.color, points: flowPoints(flow), active: simulated.active, rate: simulated.rate, direction: simulated.direction, particleCount: simulated.active ? budget.particlesPerFlow : 0, nodes: flow.nodes, traced: fidelity.tracedPaths[flow.id] ?? [] };
  });

  return { items, markers, flows, motions, camera: presetPose(spec, fidelity.cameraPresetId), budget, explanation: explainState(spec, fidelity, definition.grade), quantities: simulation.quantities };
}

/**
 * What a learner can perceive and act on, independent of rendering technique. Two profiles are
 * instructionally equivalent when this view is identical for the same state.
 */
export function instructionalView(list: RenderList) {
  return {
    actionable: list.items.filter((item) => item.selectable && item.inFocus).map((item) => item.id).sort(),
    flows: list.flows.map((flow) => ({ id: flow.id, active: flow.active, rate: flow.rate, traced: flow.traced })),
    quantities: list.quantities,
    explanation: list.explanation.map((line) => line.id),
    markers: list.markers.map((marker) => marker.id).sort(),
    spinning: list.motions.filter((motion) => motion.active).map((motion) => motion.id).sort(),
  };
}
