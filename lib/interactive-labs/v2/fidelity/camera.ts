// RX-005d camera choreography and the A16 camera principle, as pure functions shared by every renderer:
// constrained orbit (target box, ground, guided offsets), aspect-fitted preset framing, learner-advanced rails with
// eased legs (a 0 ms cut under reduced motion), and the authoring gate. Camera state is presentation only.
import type { InteractiveLabDefinition, LabState } from "../types";
import type { CameraConstraints, CameraPreset, CameraRail, HighFidelitySpec } from "./types";
import type { RenderItem } from "./renderList";
import { constrainCamera, easeInOutCubic, viewMatrix, type CameraPose } from "./presentation";
import { buildParametricGeometry } from "./geometry/builders";
import { clamp, fitHorizontalFieldOfView, lerp, lerpVec3, multiply, perspective, transformPoint, type Mat4, type Vec3 } from "./math";

/** Default leg of a preset change or rail stop. */
export const CAMERA_LEG_MS = 700;
/** The camera stays this far above a declared ground or water surface. */
const GROUND_CLEARANCE = 0.3;
/** Framing margin around the fitted bounding sphere. */
const FRAME_MARGIN = 1.08;
/** Desktop stage and phone-portrait stage aspect ratios used by the framing gate. */
export const GATE_ASPECTS = Object.freeze([1.5, 0.8]);

export type OrbitMode = "explore" | "guided";

/** Height of the camera above the target for a pose (both WebGL renderers place the eye this way). */
export const cameraHeight = (pose: CameraPose) => pose.target[1] + Math.sin(pose.pitch) * pose.distance;

/** Clamp the target into the box (if any) and keep the eye above the declared ground. */
function settle(pose: CameraPose, constraints: CameraConstraints): CameraPose {
  let next = constrainCamera(pose, constraints);
  const box = constraints.targetBox;
  if (box) next = { ...next, target: [clamp(next.target[0], box.min[0], box.max[0]), clamp(next.target[1], box.min[1], box.max[1]), clamp(next.target[2], box.min[2], box.max[2])] };
  if (constraints.groundY !== undefined && cameraHeight(next) < constraints.groundY + GROUND_CLEARANCE) {
    const needed = Math.asin(clamp((constraints.groundY + GROUND_CLEARANCE - next.target[1]) / next.distance, -1, 1));
    next = { ...next, pitch: clamp(Math.max(next.pitch, needed), constraints.minPitch, constraints.maxPitch) };
  }
  return next;
}

/**
 * A16: the learner's orbit, zoom and pan. Without a target box the target stays on the anchor (the current preset);
 * in guided mode the pose stays within the declared offsets of the anchor.
 */
export function constrainOrbit(pose: CameraPose, constraints: CameraConstraints, options: { anchor: CameraPose; mode: OrbitMode }): CameraPose {
  let next: CameraPose = constraints.targetBox ? pose : { ...pose, target: options.anchor.target };
  const guided = constraints.guided;
  if (options.mode === "guided" && guided) {
    next = {
      ...next,
      distance: clamp(next.distance, options.anchor.distance - guided.distance, options.anchor.distance + guided.distance),
      yaw: clamp(next.yaw, options.anchor.yaw - guided.yaw, options.anchor.yaw + guided.yaw),
      pitch: clamp(next.pitch, options.anchor.pitch - guided.pitch, options.anchor.pitch + guided.pitch),
      target: options.anchor.target,
    };
  }
  return settle(next, constraints);
}

const BASE_RADIUS: Record<RenderItem["geometry"], number> = { sphere: 1, cylinder: Math.SQRT2, cone: Math.SQRT2, cube: Math.sqrt(3), box: Math.sqrt(3), lever: Math.sqrt(3), "rectangular-prism": Math.hypot(1.25, 0.82, 0.72), panel: Math.hypot(0.5, 0.5, 0.02) };
const parametricRadius = new Map<string, number>();
function localRadius(item: RenderItem): number {
  if (!item.parametricGeometry) return BASE_RADIUS[item.geometry];
  const key = JSON.stringify(item.parametricGeometry);
  let radius = parametricRadius.get(key);
  if (radius === undefined) {
    const positions = buildParametricGeometry(item.parametricGeometry, "LOW").positions;
    radius = 0;
    for (let index = 0; index < positions.length; index += 3) radius = Math.max(radius, Math.hypot(positions[index], positions[index + 1], positions[index + 2]));
    parametricRadius.set(key, radius);
  }
  return radius;
}

/** Local half-extents of each primitive as ThreeScene and the LOW meshes build it (BoxGeometry(2,2,2), sphere r1, ...). */
const BASE_HALF: Record<RenderItem["geometry"], Vec3> = { sphere: [1, 1, 1], cylinder: [1, 1, 1], cone: [1, 1, 1], cube: [1, 1, 1], box: [1, 1, 1], lever: [1, 1, 1], "rectangular-prism": [1.25, 0.82, 0.72], panel: [0.5, 0.5, 0.02] };
const parametricBox = new Map<string, { min: Vec3; max: Vec3 }>();
function localBox(item: RenderItem): { min: Vec3; max: Vec3 } {
  if (!item.parametricGeometry) { const h = BASE_HALF[item.geometry]; return { min: [-h[0], -h[1], -h[2]], max: h }; }
  const key = JSON.stringify(item.parametricGeometry);
  let box = parametricBox.get(key);
  if (!box) {
    const positions = buildParametricGeometry(item.parametricGeometry, "LOW").positions;
    const min: Vec3 = [Infinity, Infinity, Infinity], max: Vec3 = [-Infinity, -Infinity, -Infinity];
    for (let index = 0; index < positions.length; index += 3) for (let axis = 0; axis < 3; axis += 1) { min[axis] = Math.min(min[axis], positions[index + axis]); max[axis] = Math.max(max[axis], positions[index + axis]); }
    box = { min, max }; parametricBox.set(key, box);
  }
  return box;
}

/** RX-006 picking bounds: the eight world-space corners of a render item's oriented local box. */
export function itemCorners(item: RenderItem): Vec3[] {
  const { min, max } = localBox(item);
  const corners: Vec3[] = [];
  for (const x of [min[0], max[0]]) for (const y of [min[1], max[1]]) for (const z of [min[2], max[2]]) corners.push(transformPoint(item.matrix, [x, y, z]));
  return corners;
}

/** World-space bounding sphere of a render item (its matrix may scale non-uniformly: use the largest axis). */
export function itemSphere(item: RenderItem): { center: Vec3; radius: number } {
  const m = item.matrix;
  const scale = Math.max(Math.hypot(m[0], m[1], m[2]), Math.hypot(m[4], m[5], m[6]), Math.hypot(m[8], m[9], m[10]));
  return { center: transformPoint(m, [0, 0, 0]), radius: localRadius(item) * scale };
}

/** Bounding sphere of several items (box-centred, so it is stable and deterministic). */
export function framedSphere(items: readonly RenderItem[]): { center: Vec3; radius: number } | null {
  if (!items.length) return null;
  const spheres = items.map(itemSphere);
  const min = [0, 1, 2].map((axis) => Math.min(...spheres.map((sphere) => sphere.center[axis] - sphere.radius))) as Vec3;
  const max = [0, 1, 2].map((axis) => Math.max(...spheres.map((sphere) => sphere.center[axis] + sphere.radius))) as Vec3;
  const center: Vec3 = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
  const radius = Math.max(...spheres.map((sphere) => Math.hypot(sphere.center[0] - center[0], sphere.center[1] - center[1], sphere.center[2] - center[2]) + sphere.radius));
  return { center, radius };
}

/** Distance at which a sphere fills the view for a vertical FOV (degrees) and aspect ratio. */
export function fitDistance(radius: number, verticalFovDegrees: number, aspect: number): number {
  const vertical = verticalFovDegrees * Math.PI / 360;
  const horizontal = Math.atan(Math.tan(vertical) * aspect);
  return radius / Math.sin(Math.min(vertical, horizontal)) * FRAME_MARGIN;
}

/**
 * The pose a preset resolves to on a stage of this aspect. With `frame`, target and distance are refitted to the
 * framed parts; yaw and pitch stay authored. Always within the lab's constraints.
 */
export function framedPose(spec: HighFidelitySpec, preset: CameraPreset, items: readonly RenderItem[], baseFovDegrees: number, aspect: number): CameraPose {
  const authored: CameraPose = { target: preset.target, distance: preset.distance, yaw: preset.yaw, pitch: preset.pitch };
  const ids = preset.frame?.componentIds;
  const sphere = ids ? framedSphere(items.filter((item) => ids.includes(item.id))) : null;
  if (!sphere) return settle(authored, spec.camera.constraints);
  const fov = fitHorizontalFieldOfView(baseFovDegrees, aspect);
  return settle({ ...authored, target: sphere.center, distance: fitDistance(sphere.radius, fov, aspect) }, spec.camera.constraints);
}

export const findPreset = (spec: HighFidelitySpec, presetId: string): CameraPreset => spec.camera.presets.find((preset) => preset.id === presetId) ?? spec.camera.presets[0];

/** Interpolate one camera leg. Reduced motion is a 0 ms cut (A16). */
export function tweenPose(from: CameraPose, to: CameraPose, elapsedMs: number, durationMs: number, easing: "ease-in-out" | "linear", reducedMotion: boolean): CameraPose {
  if (reducedMotion || durationMs <= 0 || elapsedMs >= durationMs) return to;
  const raw = clamp(elapsedMs / durationMs, 0, 1), t = easing === "linear" ? raw : easeInOutCubic(raw);
  return { target: lerpVec3(from.target, to.target, t), distance: lerp(from.distance, to.distance, t), yaw: lerp(from.yaw, to.yaw, t), pitch: lerp(from.pitch, to.pitch, t) };
}

export type RailPosition = { railId: string; index: number };
export type CameraLeg = { durationMs: number; easing: "ease-in-out" | "linear" };
export const DEFAULT_LEG: CameraLeg = Object.freeze({ durationMs: CAMERA_LEG_MS, easing: "ease-in-out" as const });

export const findRail = (spec: HighFidelitySpec, railId: string): CameraRail | undefined => spec.camera.rails?.find((rail) => rail.id === railId);

/** The preset and leg for a rail position, or null when the position is not on the rail. */
export function railStop(spec: HighFidelitySpec, position: RailPosition): { presetId: string; leg: CameraLeg } | null {
  const stop = findRail(spec, position.railId)?.stops[position.index];
  return stop ? { presetId: stop.presetId, leg: { durationMs: stop.durationMs ?? CAMERA_LEG_MS, easing: stop.easing ?? "ease-in-out" } } : null;
}

/** Next stop, or null when the rail is finished. */
export function advanceRail(spec: HighFidelitySpec, position: RailPosition): RailPosition | null {
  const rail = findRail(spec, position.railId);
  return rail && position.index + 1 < rail.stops.length ? { railId: position.railId, index: position.index + 1 } : null;
}

/** Project a world point for a pose; null when it is behind the camera. Coordinates are -1..1 when on screen. */
export function projectPoint(pose: CameraPose, point: Vec3, verticalFovDegrees: number, aspect: number): [number, number] | null {
  const clip: Mat4 = multiply(perspective(verticalFovDegrees, aspect, 0.1, 400), viewMatrix(pose));
  const x = clip[0] * point[0] + clip[4] * point[1] + clip[8] * point[2] + clip[12];
  const y = clip[1] * point[0] + clip[5] * point[1] + clip[9] * point[2] + clip[13];
  const w = clip[3] * point[0] + clip[7] * point[1] + clip[11] * point[2] + clip[15];
  return w <= 0 ? null : [x / w, y / w];
}

/** World position of a component as authored (its assembly root object's translation, plus its own position). */
function componentWorldCenter(definition: InteractiveLabDefinition<LabState>, componentId: string): Vec3 | null {
  const spec = definition.fidelity!;
  const component = spec.components.find((candidate) => candidate.id === componentId);
  if (!component) return null;
  const assembly = spec.assemblies.find((candidate) => candidate.componentIds.includes(componentId));
  const root = assembly?.rootObjectId ? definition.scene.objects.find((object) => object.id === assembly.rootObjectId) : undefined;
  const p = component.transform.position, r = root?.transform.position ?? [0, 0, 0];
  return [p[0] + r[0], p[1] + r[1], p[2] + r[2]];
}

/** Every point a learner must reach: check targets, trace nodes and in-scene controls (A16). */
export function cameraTargets(definition: InteractiveLabDefinition<LabState>): { id: string; point: Vec3 }[] {
  const spec = definition.fidelity!;
  const targets: { id: string; point: Vec3 }[] = [];
  const add = (id: string, point: Vec3 | null) => { if (point && !targets.some((target) => target.id === id)) targets.push({ id, point }); };
  for (const check of definition.checks ?? []) {
    const fidelity = check.fidelity;
    if (fidelity?.kind === "identify-component") add(fidelity.componentId, componentWorldCenter(definition, fidelity.componentId));
    if (fidelity?.kind === "trace-path") for (const node of spec.flows.find((flow) => flow.id === fidelity.flowId)?.nodes.filter((node) => node.traceable) ?? []) add(`${fidelity.flowId}:${node.id}`, node.position);
    if (fidelity?.kind === "assemble") for (const id of spec.assemblies.find((assembly) => assembly.id === fidelity.assemblyId)?.componentIds ?? []) add(id, componentWorldCenter(definition, id));
  }
  for (const component of spec.components) if (component.control) add(component.id, componentWorldCenter(definition, component.id));
  return targets;
}

const near = (a: number, b: number) => Math.abs(a - b) <= 1e-6;

/** RX-005d / A16 authoring gate for the camera block. Empty means the camera is valid. */
export function validateCamera(definition: InteractiveLabDefinition<LabState>, items: readonly RenderItem[] = []): string[] {
  const spec = definition.fidelity;
  if (!spec) return [];
  const errors: string[] = [];
  const { constraints, presets } = spec.camera;
  if (!(constraints.minDistance > 0 && constraints.minDistance < constraints.maxDistance)) errors.push("camera_distance_limits_invalid");
  if (!(constraints.minPitch < constraints.maxPitch) || !(constraints.minYaw < constraints.maxYaw)) errors.push("camera_angle_limits_invalid");
  const box = constraints.targetBox;
  if (box && [0, 1, 2].some((axis) => !(box.min[axis] <= box.max[axis]))) errors.push("camera_target_box_invalid");
  if (constraints.guided && Object.values(constraints.guided).some((value) => !(value >= 0))) errors.push("camera_guided_offsets_invalid");
  const presetIds = new Set<string>();
  const componentIds = new Set(spec.components.map((component) => component.id));
  for (const preset of presets) {
    if (presetIds.has(preset.id)) errors.push(`camera_preset_duplicate:${preset.id}`);
    presetIds.add(preset.id);
    const pose: CameraPose = { target: preset.target, distance: preset.distance, yaw: preset.yaw, pitch: preset.pitch };
    const settled = settle(pose, constraints);
    if (!near(settled.distance, pose.distance) || !near(settled.yaw, pose.yaw) || !near(settled.pitch, pose.pitch)) errors.push(`camera_preset_outside_limits:${preset.id}`);
    if (settled.target.some((value, axis) => !near(value, pose.target[axis]))) errors.push(`camera_preset_target_outside_box:${preset.id}`);
    for (const id of preset.frame?.componentIds ?? []) if (!componentIds.has(id)) errors.push(`camera_frame_component_unknown:${preset.id}:${id}`);
    if (preset.frame && preset.frame.componentIds.length === 0) errors.push(`camera_frame_empty:${preset.id}`);
  }
  if (!presetIds.has(spec.camera.defaultPresetId)) errors.push("camera_default_preset_unknown");
  const railIds = new Set<string>();
  for (const rail of spec.camera.rails ?? []) {
    if (railIds.has(rail.id)) errors.push(`camera_rail_duplicate:${rail.id}`);
    railIds.add(rail.id);
    if (rail.stops.length < 2) errors.push(`camera_rail_too_short:${rail.id}`);
    for (const stop of rail.stops) {
      if (!presetIds.has(stop.presetId)) errors.push(`camera_rail_stop_unknown:${rail.id}:${stop.presetId}`);
      if (stop.durationMs !== undefined && !(stop.durationMs >= 0 && stop.durationMs <= 5000)) errors.push(`camera_rail_duration_invalid:${rail.id}:${stop.presetId}`);
    }
  }
  for (const step of spec.guidedPath) if (step.railId && !railIds.has(step.railId)) errors.push(`guided_step_rail_unknown:${step.id}:${step.railId}`);
  // A16: every check target, trace node and control must be on screen in at least one preset on both stage shapes.
  const fov = definition.scene.camera.fov;
  for (const target of cameraTargets(definition)) {
    const framed = GATE_ASPECTS.every((aspect) => presets.some((preset) => {
      const pose = framedPose(spec, preset, items, fov, aspect);
      const at = projectPoint(pose, target.point, fitHorizontalFieldOfView(fov, aspect), aspect);
      return !!at && Math.abs(at[0]) <= 0.95 && Math.abs(at[1]) <= 0.95;
    }));
    if (!framed) errors.push(`camera_target_unframed:${target.id}`);
  }
  return errors;
}

/** 2D stage shape (height / width): a wide desktop stage, a near-square phone stage. */
export const FALLBACK_STAGE_RATIO = Object.freeze({ wide: 0.62, narrow: 0.95 });
/** World width the 2D stage shows per unit of authored preset distance. */
const FALLBACK_WIDTH_PER_DISTANCE = Object.freeze({ wide: 1.25, narrow: 0.62 });

/**
 * A18: the FALLBACK_2D view box (front orthographic, SVG y down) for a preset. With `frame`, it is fitted to the framed
 * parts so a rail stop or check frame always fits the 2D stage; otherwise it follows the authored target and distance.
 * `distance` is the preset distance this framing is equivalent to (used to keep labels a stable screen size).
 */
export function fallbackFrame(items: readonly RenderItem[], preset: CameraPreset | undefined, narrow: boolean): { x: number; y: number; width: number; height: number; distance: number } {
  const shape = narrow ? "narrow" : "wide", ratio = FALLBACK_STAGE_RATIO[shape];
  const ids = preset?.frame?.componentIds;
  const sphere = ids ? framedSphere(items.filter((item) => ids.includes(item.id))) : null;
  const target: Vec3 = sphere?.center ?? preset?.target ?? [0.25, 0, 0];
  const width = sphere ? Math.max(2 * sphere.radius * FRAME_MARGIN, 2 * sphere.radius * FRAME_MARGIN / ratio) : (preset?.distance ?? 11) * FALLBACK_WIDTH_PER_DISTANCE[shape];
  const height = width * ratio;
  return { x: target[0] - width / 2, y: -target[1] - height / 2, width, height, distance: width / FALLBACK_WIDTH_PER_DISTANCE[shape] };
}
