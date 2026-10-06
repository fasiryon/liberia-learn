// Renderer-agnostic scene presentation. WebGL (HIGH/STANDARD/LOW) and the SVG fallback draw the same list,
// which is what keeps FALLBACK_2D instructionally equivalent.
import type { CapabilityProfile, GeometryKind, InteractiveLabDefinition, LabState, Transform } from "../types";
import type { ExplanationLine, FidelityAction, FidelityState, FlowNode, HighFidelitySpec } from "./types";
import type { GeometrySilhouette, ParametricDescriptor } from "./geometry/types";
import { resolveGeometryVariant } from "./geometry/builders";
import { assemblyOf, deriveSimulation, explainState, isAssemblyOpen, isComponentRevealed } from "./engine";
import { flowPoints, presetPose, type CameraPose } from "./presentation";
import { RENDER_BUDGETS, type RenderBudget } from "./profiles";
import { MARKER_COLOR, statusVisual } from "./palette";
import { resolveSurfaces, type RenderSurface } from "./surfaces";
import { resolveCues, resolveEmitters, type RenderCue, type RenderEmitter } from "./emitters";
import { controlAction, controlSelected, dragAxisEnds } from "./controls";
import type { SceneControl } from "./controls";
import { IDENTITY, addVec3, lerpTransform, multiply, rotate, scaleVec3, transformMatrix, transformPoint, translate, type Mat4, type Vec3 } from "./math";

export type ItemSpin = { pre: Mat4; local: Mat4; pivot: Vec3; axis: "x" | "y" | "z"; radPerSec: number };
export type RenderItem = {
  id: string;
  label: string;
  kind: "object" | "component";
  geometry: GeometryKind;
  parametricGeometry?: ParametricDescriptor;
  fallbackSilhouette?: GeometrySilhouette;
  matrix: Mat4;
  center: Vec3;
  color: string;
  alpha: number;
  emissive: number;
  clip: { normal: Vec3; offset: number } | null;
  highlighted: boolean;
  selectable: boolean;
  showLabel: boolean;
  mobileLabel?: boolean;
  labelOffset?: Vec3;
  /** False when the item is only faded context around an isolated part. */
  inFocus: boolean;
  detail?: "decor";
  spin?: ItemSpin;
  /** RX-005c: the action this control part would dispatch now (null = disabled), and whether it is selected. */
  /** A19 / G3: the status glyph and text a status lamp carries besides its colour. */
  status?: { glyph: string; text: string };
  /** A1: the part declares a `label` semantic cue, so its label outranks other parts for the scene label budget. */
  labelCritical?: true;
  /** A15: shown because the active cutaway reveals it (fill light, never receives shadow). */
  revealed?: true;
  control?: { label: string; group: string; variableId: string; kind: SceneControl["kind"]; action: Extract<FidelityAction, { type: "set-variable" }> | null; selected: boolean;
    /** A14: true while this part's confirm preview is pending (drawn with the highlight token only). */
    pending: boolean;
    /** A14 drag-variable: the world-space ends of the drag axis through the part (t = 0 and t = 1). */
    dragAxis?: [[number, number, number], [number, number, number]] };
};
export type RenderMarker = { id: string; position: Vec3; color: string; label?: string };
export type RenderFlow = { id: string; label: string; color: string; points: Vec3[]; active: boolean; rate: number; direction: 1 | -1; particleCount: number; nodes: FlowNode[]; traced: string[] };
export type RenderMotion = { id: string; label: string; active: boolean; center: Vec3 };
export type RenderList = { items: RenderItem[]; markers: RenderMarker[]; flows: RenderFlow[]; surfaces: RenderSurface[]; emitters: RenderEmitter[]; cues: RenderCue[]; motions: RenderMotion[]; camera: CameraPose | null; budget: RenderBudget; explanation: ExplanationLine[]; quantities: Record<string, number>; environment: "DAYLIGHT" | "STUDIO" | "DARK_FIELD" };

/** Paint decorative 2D scenery first so trace nodes, labels and controls remain above it. */
export function orderFallbackItems(items: readonly RenderItem[]): RenderItem[] {
  return [...items.filter((item) => item.detail === "decor"), ...items.filter((item) => item.detail !== "decor").sort((a, b) => a.center[2] - b.center[2])];
}

/** SVG has no clipping plane; represent cutaways by omitting the removed solid. */
export function fallbackVisibleItems(items: readonly RenderItem[]): RenderItem[] {
  return orderFallbackItems(items.filter((item) => !item.clip));
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

export function buildRenderList(input: { definition: InteractiveLabDefinition<LabState>; state: LabState; profile: CapabilityProfile; displayFidelity?: FidelityState; guidedHighlights?: boolean; /** A14 presentation-only pending confirm. */ pendingControlId?: string | null }): RenderList {
  const { definition, state, profile } = input;
  const budget = RENDER_BUDGETS[profile];
  const spec = definition.fidelity;
  const fidelity = state.fidelity;
  const display = input.displayFidelity ?? fidelity;
  const items: RenderItem[] = [];
  const markers: RenderMarker[] = [];
  const isolatedId = fidelity?.isolatedId ?? null;
  const guided = spec && fidelity && (input.guidedHighlights ?? state.mode === "GUIDED") ? spec.guidedPath[fidelity.guidedStepIndex]?.highlightIds ?? [] : [];
  const openRoots = new Set<string>();
  if (spec && display) for (const assembly of spec.assemblies) if (isAssemblyOpen(spec, display, assembly.id)) {
    if (assembly.rootObjectId) openRoots.add(assembly.rootObjectId);
  }
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

  if (!spec || !fidelity || !display) return { items, markers, flows: [], surfaces: [], emitters: [], cues: [], motions: [], camera: null, budget, explanation: [], quantities: {}, environment: spec?.environment ?? "STUDIO" };

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
    if (assembly?.rootComponentId === component.id && isAssemblyOpen(spec, display, assembly.id)) continue;
    const rootObject = assembly?.rootObjectId ? definition.scene.objects.find((object) => object.id === assembly.rootObjectId) : undefined;
    if (rootObject && !openRoots.has(rootObject.id)) continue;
    if (component.layerId && fidelity.hiddenLayerIds.includes(component.layerId)) continue;
    const removed = !!cutaway?.removesComponentIds.includes(component.id);
    if (removed && !budget.shaderClipping) continue;
    // Opening an assembly by explosion or disassembly exposes its internal parts too.
    const rootBackedAssemblyOpen = !!assembly && (!!assembly.rootObjectId || !!assembly.rootComponentId) && isAssemblyOpen(spec, display, assembly.id);
    if (component.internal && !cutaway?.revealsComponentIds.includes(component.id) && !rootBackedAssemblyOpen) continue;
    const inFocus = focusOf(component.id, rootObject?.id ?? assembly?.id);
    if (!inFocus && !budget.fadeContext) continue;
    const rootMatrix = rootObject ? multiply(translate(...rootObject.transform.position), rotate(...objectRotation(state, rootObject.id, rootObject.transform.rotation))) : IDENTITY;
    const baseLocal = componentLocalTransform(spec, display, component.id, component.transform);
    // R3 science P1: a fill state shortens the part along x from its left end, so a gauge segment's length carries MW.
    const fill = simulation.componentStates[component.id]?.fill;
    const localTransform = typeof fill === "number" && Number.isFinite(fill) && fill < 1
      ? { ...baseLocal, position: [baseLocal.position[0] - (1 - Math.max(fill, 0.02)) * baseLocal.scale[0] / 2, baseLocal.position[1], baseLocal.position[2]] as typeof baseLocal.position, scale: [baseLocal.scale[0] * Math.max(fill, 0.02), baseLocal.scale[1], baseLocal.scale[2]] as typeof baseLocal.scale }
      : baseLocal;
    const localMatrix = transformMatrix(localTransform);
    const matrix = multiply(rootMatrix, localMatrix);
    const motion = motionByComponent.get(component.id);
    const spin = motion && motionActive.get(motion.id) ? { pre: rootMatrix, local: localMatrix, pivot: motion.pivot, axis: motion.axis, radPerSec: motion.rpm * Math.PI / 30 } : undefined;
    const pending = !!component.control && input.pendingControlId === component.id;
    const highlighted = fidelity.inspectedComponentId === component.id || guided.includes(component.id) || pending;
    const resolvedGeometry = component.geometryVariants ? resolveGeometryVariant(component.geometryVariants, profile) : undefined;
    const componentState = simulation.componentStates[component.id];
    // Internal mechanisms retain their instructional materials; the housing lamp and HUD carry unit status.
    const warningStatus = componentState?.status === "tripped" || componentState?.status === "out-for-repair";
    const visual = statusVisual(component.internal && !warningStatus ? undefined : componentState?.status);
    items.push({ id: component.id, label: component.label, kind: "component", geometry: component.geometry, ...(resolvedGeometry?.descriptor ? { parametricGeometry: resolvedGeometry.descriptor } : {}), ...(resolvedGeometry?.silhouette ? { fallbackSilhouette: resolvedGeometry.silhouette } : {}), matrix, center: transformPoint(matrix, [0, 0, 0]), ...(component.labelOffset ? { labelOffset: component.labelOffset } : {}), ...(component.mobileLabel === false ? { mobileLabel: false } : {}), color: componentState?.color ?? visual.color ?? component.material.color, alpha: !inFocus ? 0.12 : removed ? 0.35 : component.material.opacity ?? 0.96, emissive: Math.max(componentState?.intensity ?? 0, visual.emissive), clip: removed && cutaway ? cutaway.plane : null, highlighted, selectable: component.detail !== "decor" && component.selectable !== false && !removed && isComponentRevealed(spec, fidelity, component.id), showLabel: component.detail !== "decor" && component.showLabel !== false && fidelity.labelsVisible && component.selectable !== false && !removed, inFocus, detail: component.detail, spin , ...(cutaway?.revealsComponentIds.includes(component.id) ? { revealed: true as const } : {}), ...(visual.cue && !component.internal ? { status: visual.cue } : {}), ...(component.semanticCues?.includes("label") ? { labelCritical: true as const } : {}), ...(component.control ? { control: { label: component.control.label, group: component.control.group ?? component.control.variableId, variableId: component.control.variableId, kind: component.control.kind, action: controlAction(spec, fidelity, component.control), selected: controlSelected(fidelity, component.control), pending, ...(component.control.kind === "drag-variable" ? { dragAxis: dragAxisEnds(component.control, transformPoint(matrix, [0, 0, 0])) } : {}) } } : {}) });
  }

  const flows: RenderFlow[] = spec.flows.filter((flow) => !fidelity.hiddenFlowIds.includes(flow.id)).map((flow) => {
    const simulated = simulation.flows[flow.id] ?? { active: true, rate: 1, direction: 1 as const };
    return { id: flow.id, label: flow.label, color: flow.color, points: flowPoints(flow), active: simulated.active, rate: simulated.rate, direction: simulated.direction, particleCount: simulated.active ? budget.particlesPerFlow : 0, nodes: flow.nodes, traced: fidelity.tracedPaths[flow.id] ?? [] };
  });

  const surfaces = resolveSurfaces(spec, simulation.quantities), emitters = resolveEmitters(spec, simulation.quantities, budget.particlesPerFlow);
  return { items, markers, flows, surfaces, emitters, cues: resolveCues(flows, surfaces, emitters), motions, camera: presetPose(spec, fidelity.cameraPresetId), budget, explanation: explainState(spec, fidelity, definition.grade), quantities: simulation.quantities, environment: spec.environment ?? "STUDIO" };
}

/**
 * What a learner can perceive and act on, independent of rendering technique. Two profiles are
 * instructionally equivalent when this view is identical for the same state.
 */
export function instructionalView(list: RenderList) {
  return {
    actionable: list.items.filter((item) => item.selectable && item.inFocus).map((item) => item.id).sort(),
    flows: list.flows.map((flow) => ({ id: flow.id, active: flow.active, rate: flow.rate, traced: flow.traced })),
    surfaces: list.surfaces.map((surface) => ({ id: surface.id, active: surface.active, width: surface.width, rate: surface.rate })),
    emitters: list.emitters.map((emitter) => ({ id: emitter.id, active: emitter.active, rate: emitter.rate })),
    cues: list.cues.map((cue) => cue.id),
    quantities: list.quantities,
    explanation: list.explanation.map((line) => line.id),
    markers: list.markers.map((marker) => marker.id).sort(),
    spinning: list.motions.filter((motion) => motion.active).map((motion) => motion.id).sort(),
    /** A19 / G3: every visible status lamp's text (the glyph and colour carry the same state). */
    statuses: Object.fromEntries(list.items.filter((item) => item.status && item.inFocus && item.selectable).map((item) => [item.id, item.status!.text]).sort(([a], [b]) => a.localeCompare(b))),
  };
}
