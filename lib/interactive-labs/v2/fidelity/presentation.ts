// Camera, animation and flow primitives. Every animated quantity eases toward a target taken from lab
// state, so animation always reflects simulation state instead of playing canned motion.
import type { CameraConstraints, CameraPreset, FidelityState, FlowDefinition, HighFidelitySpec } from "./types";
import { clamp, distance, lerp, lerpVec3, multiply, rotate, translate, type Mat4, type Vec3 } from "./math";

export type CameraPose = { target: Vec3; distance: number; yaw: number; pitch: number };

export function constrainCamera(pose: CameraPose, constraints: CameraConstraints): CameraPose {
  return { target: pose.target, distance: clamp(pose.distance, constraints.minDistance, constraints.maxDistance), yaw: clamp(pose.yaw, constraints.minYaw, constraints.maxYaw), pitch: clamp(pose.pitch, constraints.minPitch, constraints.maxPitch) };
}

export function presetPose(spec: HighFidelitySpec, presetId: string, zoom = 1): CameraPose {
  const preset: CameraPreset = spec.camera.presets.find((candidate) => candidate.id === presetId) ?? spec.camera.presets[0];
  return constrainCamera({ target: preset.target, distance: preset.distance * zoom, yaw: preset.yaw, pitch: preset.pitch }, spec.camera.constraints);
}

export function easeInOutCubic(t: number): number {
  const x = clamp(t, 0, 1);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/** Frame-rate independent exponential approach. Reduced motion snaps straight to the target. */
export function approach(current: number, target: number, dtSeconds: number, ratePerSecond: number, reducedMotion: boolean): number {
  if (reducedMotion) return target;
  const next = lerp(current, target, 1 - Math.exp(-ratePerSecond * Math.max(0, dtSeconds)));
  return Math.abs(next - target) < 1e-4 ? target : next;
}

export function approachCamera(current: CameraPose, target: CameraPose, dt: number, reducedMotion: boolean): CameraPose {
  const t = reducedMotion ? 1 : 1 - Math.exp(-5 * Math.max(0, dt));
  const pose = { target: lerpVec3(current.target, target.target, t), distance: lerp(current.distance, target.distance, t), yaw: lerp(current.yaw, target.yaw, t), pitch: lerp(current.pitch, target.pitch, t) };
  return distance(pose.target, target.target) < 1e-4 && Math.abs(pose.distance - target.distance) < 1e-4 && Math.abs(pose.yaw - target.yaw) < 1e-4 && Math.abs(pose.pitch - target.pitch) < 1e-4 ? target : pose;
}

export function viewMatrix(pose: CameraPose): Mat4 {
  return multiply(translate(0, 0, -pose.distance), multiply(rotate(pose.pitch, 0, 0), multiply(rotate(0, pose.yaw, 0), translate(-pose.target[0], -pose.target[1], -pose.target[2]))));
}

/**
 * The displayed state eases toward the lab state: explode factors and continuous variables animate,
 * discrete/toggle variables and everything else change immediately.
 */
export function easeDisplayState(spec: HighFidelitySpec, displayed: FidelityState, target: FidelityState, dt: number, reducedMotion: boolean): FidelityState {
  const explode = Object.fromEntries(Object.entries(target.explode).map(([id, value]) => [id, approach(displayed.explode[id] ?? value, value, dt, 6, reducedMotion)]));
  const variables = Object.fromEntries(Object.entries(target.variables).map(([id, value]) => {
    const variable = spec.variables.find((candidate) => candidate.id === id);
    const animated = variable?.kind === "continuous" || spec.poseTransitions.some((pose) => pose.variableId === id);
    return [id, animated ? approach(displayed.variables[id] ?? value, value, dt, 6, reducedMotion) : value];
  }));
  return { ...target, explode, variables };
}

export function isSettled(a: FidelityState, b: FidelityState): boolean {
  return Object.entries(b.explode).every(([id, value]) => a.explode[id] === value) && Object.entries(b.variables).every(([id, value]) => a.variables[id] === value);
}

export function flowPoints(flow: FlowDefinition): Vec3[] {
  const points = flow.nodes.map((node) => node.position);
  return flow.closedLoop && points.length > 1 ? [...points, points[0]] : points;
}

export function samplePath(points: readonly Vec3[], u: number): Vec3 {
  if (points.length === 0) return [0, 0, 0];
  if (points.length === 1) return points[0];
  const lengths = points.slice(1).map((point, index) => distance(points[index], point));
  const total = lengths.reduce((sum, length) => sum + length, 0) || 1;
  let remaining = (((u % 1) + 1) % 1) * total;
  for (let index = 0; index < lengths.length; index++) {
    if (remaining <= lengths[index] || index === lengths.length - 1) return lerpVec3(points[index], points[index + 1], lengths[index] ? clamp(remaining / lengths[index], 0, 1) : 0);
    remaining -= lengths[index];
  }
  return points[points.length - 1];
}

/**
 * Particle positions for a flow at time t. Speed is proportional to the simulated rate; an inactive flow
 * yields no particles, so a stopped process is never shown as moving. Reduced motion freezes positions.
 */
export function flowParticles(points: readonly Vec3[], count: number, rate: number, direction: 1 | -1, timeSeconds: number, reducedMotion: boolean): Vec3[] {
  if (count <= 0 || rate <= 0 || points.length < 2) return [];
  const phase = reducedMotion ? 0 : direction * timeSeconds * 0.12 * rate;
  return Array.from({ length: count }, (_, index) => samplePath(points, index / count + phase));
}
