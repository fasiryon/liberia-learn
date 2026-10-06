// RX-005 A10 / A13 / A18: flows drawn as cased tubes on every WebGL profile instead of 1-px GL lines. Each flow is a
// coloured core tube inside a dark casing tube. The casing is drawn first without depth writes, so it reads as a dark
// rim around the light core while solids still hide both. A flow that is not running is drawn dashed in the inactive
// colour. Pure and `three`-free: ThreeScene, WebGLScene and the frame planner share these exact triangles.
import type { RenderFlow } from "./renderList";
import { parseHexColor } from "./palette";
import type { Vec3 } from "./math";

export type FlowTubeProfile = "HIGH" | "STANDARD" | "LOW";
/** Core radius (world units) and radial segments per profile; the casing is CASING_SCALE times wider. */
export const FLOW_TUBE: Readonly<Record<FlowTubeProfile, { radius: number; radial: number }>> = Object.freeze({ HIGH: { radius: 0.045, radial: 8 }, STANDARD: { radius: 0.045, radial: 6 }, LOW: { radius: 0.05, radial: 4 } });
export const FLOW_CASING_SCALE = 1.9;
export const FLOW_CASING_COLOR = "#0f172a";
/** Dash and gap lengths (world units) of a flow that is not running. */
export const FLOW_DASH = 0.32, FLOW_GAP = 0.22;
/** A flow that is not running recedes: a thinner tube in a neutral grey, never the water or current colour. */
export const FLOW_IDLE_SCALE = 0.55, FLOW_IDLE_COLOR = "#94a3b8";

/** Non-indexed triangle storage with per-vertex colour, reused across frames (grows geometrically, never shrinks). */
export type TubeBatch = { positions: Float32Array; colors: Float32Array; count: number; /** Bumped on every rewrite, so a renderer uploads only changed tubes. */ version?: number };
export const createTubeBatch = (): TubeBatch => ({ positions: new Float32Array(0), colors: new Float32Array(0), count: 0, version: 0 });
/** `signature` is the flowTubeSignature the tubes were last written for (NaN before the first write). */
export type FlowTubeStorage = { core: TubeBatch; casing: TubeBatch; signature: number };
export const createFlowTubeStorage = (): FlowTubeStorage => ({ core: createTubeBatch(), casing: createTubeBatch(), signature: Number.NaN });

/**
 * An allocation-free hash of everything the tubes depend on (each flow's running state, colour and path), so a
 * renderer rewrites and re-uploads its static tubes only when one of them changes, never every frame.
 */
export function flowTubeSignature(flows: readonly Pick<RenderFlow, "points" | "active" | "color">[]): number {
  let hash = 2166136261;
  const mix = (value: number) => { hash = Math.imul(hash ^ (value | 0), 16777619) >>> 0; };
  for (const flow of flows) {
    mix(flow.active ? 1 : 2);
    for (let index = 0; index < flow.color.length; index += 1) mix(flow.color.charCodeAt(index));
    mix(flow.points.length);
    for (const point of flow.points) { mix(Math.round(point[0] * 1e4)); mix(Math.round(point[1] * 1e4)); mix(Math.round(point[2] * 1e4)); }
  }
  return hash;
}

function reserve(batch: TubeBatch, vertices: number) {
  if (batch.positions.length >= vertices * 3) return;
  let capacity = Math.max(96, batch.positions.length);
  while (capacity < vertices * 3) capacity *= 2;
  const positions = new Float32Array(capacity), colors = new Float32Array(capacity);
  positions.set(batch.positions.subarray(0, batch.count * 3)); colors.set(batch.colors.subarray(0, batch.count * 3));
  batch.positions = positions; batch.colors = colors;
}

/** The straight pieces a flow is drawn as: every segment when running, dashes along each segment when not. */
export function flowPieces(flow: Pick<RenderFlow, "points" | "active">): [Vec3, Vec3][] {
  const pieces: [Vec3, Vec3][] = [];
  for (let index = 0; index < flow.points.length - 1; index += 1) {
    const a = flow.points[index], b = flow.points[index + 1];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    if (length < 1e-6) continue;
    if (flow.active) { pieces.push([a, b]); continue; }
    for (let start = 0; start < length; start += FLOW_DASH + FLOW_GAP) {
      const end = Math.min(length, start + FLOW_DASH), at = (t: number): Vec3 => [a[0] + (b[0] - a[0]) * t / length, a[1] + (b[1] - a[1]) * t / length, a[2] + (b[2] - a[2]) * t / length];
      pieces.push([at(start), at(end)]);
    }
  }
  return pieces;
}

function writeTube(batch: TubeBatch, a: Vec3, b: Vec3, radius: number, radial: number, rgb: [number, number, number]) {
  const d: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], length = Math.hypot(...d);
  const dir: Vec3 = [d[0] / length, d[1] / length, d[2] / length];
  const helper: Vec3 = Math.abs(dir[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  let u: Vec3 = [dir[1] * helper[2] - dir[2] * helper[1], dir[2] * helper[0] - dir[0] * helper[2], dir[0] * helper[1] - dir[1] * helper[0]];
  const ul = Math.hypot(...u); u = [u[0] / ul, u[1] / ul, u[2] / ul];
  const v: Vec3 = [dir[1] * u[2] - dir[2] * u[1], dir[2] * u[0] - dir[0] * u[2], dir[0] * u[1] - dir[1] * u[0]];
  reserve(batch, batch.count + radial * 6);
  const ring = (centre: Vec3, k: number): Vec3 => { const angle = (k % radial) / radial * Math.PI * 2, c = Math.cos(angle) * radius, s = Math.sin(angle) * radius; return [centre[0] + u[0] * c + v[0] * s, centre[1] + u[1] * c + v[1] * s, centre[2] + u[2] * c + v[2] * s]; };
  for (let k = 0; k < radial; k += 1) {
    const a0 = ring(a, k), a1 = ring(a, k + 1), b0 = ring(b, k), b1 = ring(b, k + 1);
    for (const point of [a0, b0, a1, a1, b0, b1]) {
      const offset = batch.count * 3;
      batch.positions[offset] = point[0]; batch.positions[offset + 1] = point[1]; batch.positions[offset + 2] = point[2];
      batch.colors[offset] = rgb[0]; batch.colors[offset + 1] = rgb[1]; batch.colors[offset + 2] = rgb[2];
      batch.count += 1;
    }
  }
}

/** Refill the reusable core and casing triangles for every flow (both empty when there are no drawable flows). */
export function writeFlowTubes(flows: readonly Pick<RenderFlow, "points" | "active" | "color">[], profile: FlowTubeProfile, storage: FlowTubeStorage): FlowTubeStorage {
  storage.core.count = 0; storage.casing.count = 0;
  storage.core.version = (storage.core.version ?? 0) + 1; storage.casing.version = (storage.casing.version ?? 0) + 1;
  const { radius, radial } = FLOW_TUBE[profile], casing = parseHexColor(FLOW_CASING_COLOR);
  // Idle flows first, running flows last, so a running flow is never overdrawn where paths share a segment.
  for (const flow of [...flows.filter((candidate) => !candidate.active), ...flows.filter((candidate) => candidate.active)]) {
    const core = parseHexColor(flow.active ? flow.color : FLOW_IDLE_COLOR), r = flow.active ? radius : radius * FLOW_IDLE_SCALE;
    for (const [a, b] of flowPieces(flow)) { writeTube(storage.core, a, b, r, radial, core); writeTube(storage.casing, a, b, r * FLOW_CASING_SCALE, radial, casing); }
  }
  return storage;
}

/** Triangles of the core tubes (the casing draws the same number again). */
export function flowTubeTriangles(flows: readonly Pick<RenderFlow, "points" | "active">[], profile: FlowTubeProfile): number {
  return flows.reduce((sum, flow) => sum + flowPieces(flow).length * FLOW_TUBE[profile].radial * 2, 0);
}
