// RX-005b: quantity-bound surfaces (water channels, pools, spill sheets). Every visual parameter comes from a
// simulation quantity; the renderers only draw what these pure functions return.
import type { FlowMedium, HighFidelitySpec } from "./types";
import type { Vec3 } from "./math";

export type SurfaceKind = "channel" | "pool" | "sheet";

export type SurfaceDefinition = {
  id: string;
  label: string;
  kind: SurfaceKind;
  medium: FlowMedium;
  /** Centreline, at least two points. A channel or pool lies flat; a sheet may run down a face. */
  path: Vec3[];
  /** Width in world units when the width factor is 1. */
  baseWidth: number;
  /** Simulation quantity used as the width factor (≥ 0). Absent means a fixed width (factor 1). */
  widthQuantity?: string;
  /** Simulation quantity that must be > 0 for the surface to show water. Absent means always active. */
  activeQuantity?: string;
  /** Simulation quantity in [0, 1] used as the surface-flow rate. Absent means still water (a pool). */
  rateQuantity?: string;
  /** Instructional component this surface depicts; labels, picking and checks stay on that component. */
  componentId?: string;
};

export type RenderSurface = {
  id: string;
  label: string;
  kind: SurfaceKind;
  medium: FlowMedium;
  points: Vec3[];
  width: number;
  /** An inactive surface is drawn dry: no water body and no motion. */
  active: boolean;
  /** Flow rate in [0, 1]; 0 for still water. Motion speed is secondary to width (06 water language). */
  rate: number;
};

const round4 = (value: number) => Math.round(value * 1e4) / 1e4;

/** Resolve every declared surface against the current simulation quantities. */
export function resolveSurfaces(spec: HighFidelitySpec, quantities: Record<string, number>): RenderSurface[] {
  return (spec.surfaces ?? []).map((surface) => {
    const factor = surface.widthQuantity ? Math.max(0, quantities[surface.widthQuantity] ?? 0) : 1;
    const active = surface.activeQuantity ? (quantities[surface.activeQuantity] ?? 0) > 0 : true;
    const rate = surface.rateQuantity ? Math.min(1, Math.max(0, quantities[surface.rateQuantity] ?? 0)) : 0;
    return { id: surface.id, label: surface.label, kind: surface.kind, medium: surface.medium, points: surface.path, width: active ? round4(surface.baseWidth * factor) : 0, active, rate: active ? round4(rate) : 0 };
  });
}

export type SurfaceRibbon = { positions: Float32Array; uvs: Float32Array; indices: Uint16Array; triangles: number };

/**
 * A flat ribbon of the given width along a polyline, with `along` (u, in world units) and `across` (v, 0..1)
 * coordinates. The side vector is horizontal when the path is not vertical, so channels lie flat and spill
 * sheets hang down a face. Deterministic: same input, same arrays.
 */
export function surfaceRibbon(points: readonly Vec3[], width: number): SurfaceRibbon {
  const n = points.length;
  const positions = new Float32Array(n * 2 * 3), uvs = new Float32Array(n * 2 * 2);
  let along = 0;
  for (let i = 0; i < n; i += 1) {
    const a = points[Math.max(0, i - 1)], b = points[Math.min(n - 1, i + 1)];
    const t: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    // side = normalize(t × up); fall back to +x for a vertical tangent.
    let side: Vec3 = [-t[2], 0, t[0]];
    const length = Math.hypot(side[0], side[2]);
    side = length < 1e-9 ? [1, 0, 0] : [side[0] / length, 0, side[2] / length];
    if (i > 0) along += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1], points[i][2] - points[i - 1][2]);
    const half = width / 2;
    for (const [k, sign] of [[0, -1], [1, 1]] as const) {
      const p = i * 2 + k;
      positions.set([points[i][0] + side[0] * half * sign, points[i][1], points[i][2] + side[2] * half * sign], p * 3);
      uvs.set([along, k], p * 2);
    }
  }
  const indices = new Uint16Array((n - 1) * 6);
  for (let i = 0; i < n - 1; i += 1) indices.set([i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2], i * 6);
  return { positions, uvs, indices, triangles: (n - 1) * 2 };
}

/** Authoring checks for declared surfaces: geometry, and quantities that the simulation actually emits. */
export function validateSurfaces(spec: HighFidelitySpec, quantities: Record<string, number>): string[] {
  const errors: string[] = [];
  const componentIds = new Set(spec.components.map((component) => component.id));
  const seen = new Set<string>();
  for (const surface of spec.surfaces ?? []) {
    if (seen.has(surface.id)) errors.push(`surface_duplicate:${surface.id}`);
    seen.add(surface.id);
    if (surface.path.length < 2) errors.push(`surface_path_too_short:${surface.id}`);
    if (!(surface.baseWidth > 0)) errors.push(`surface_width_invalid:${surface.id}`);
    for (const key of ["widthQuantity", "activeQuantity", "rateQuantity"] as const) {
      const quantity = surface[key];
      if (quantity !== undefined && !Object.hasOwn(quantities, quantity)) errors.push(`surface_quantity_unknown:${surface.id}:${quantity}`);
    }
    if (surface.componentId !== undefined && !componentIds.has(surface.componentId)) errors.push(`surface_component_unknown:${surface.id}`);
  }
  return errors;
}

export type SurfaceTriangleStorage = { positions: Float32Array; colors: Float32Array; count: number };
export const createSurfaceTriangleStorage = (): SurfaceTriangleStorage => ({ positions: new Float32Array(0), colors: new Float32Array(0), count: 0 });

const hexRgb = (hex: string): [number, number, number] => { const n = Number.parseInt(hex.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
/** Water tokens from the v1.1 asset delta: deep centre, shallow edge. */
export const SURFACE_DEEP = "#1d5fa8";
export const SURFACE_SHALLOW = "#2f8fe8";

/**
 * LOW profile (A13): every active surface as flat two-tone triangles (deep centre line, shallow edges) in one
 * vertex batch, so all water costs a single draw call. Storage grows only when the batch grows.
 */
export function writeSurfaceTriangles(surfaces: readonly RenderSurface[], storage: SurfaceTriangleStorage): SurfaceTriangleStorage {
  const deep = hexRgb(SURFACE_DEEP), shallow = hexRgb(SURFACE_SHALLOW);
  let vertices = 0;
  for (const surface of surfaces) if (surface.active && surface.width > 0) vertices += (surface.points.length - 1) * 12;
  if (storage.positions.length < vertices * 3) { storage.positions = new Float32Array(vertices * 3); storage.colors = new Float32Array(vertices * 3); }
  let v = 0;
  const push = (p: Vec3, c: [number, number, number]) => { storage.positions.set(p, v * 3); storage.colors.set(c, v * 3); v += 1; };
  for (const surface of surfaces) {
    if (!surface.active || surface.width <= 0) continue;
    const ribbon = surfaceRibbon(surface.points, surface.width);
    const at = (index: number): Vec3 => [ribbon.positions[index * 3], ribbon.positions[index * 3 + 1], ribbon.positions[index * 3 + 2]];
    const mid = (index: number): Vec3 => { const a = at(index * 2), b = at(index * 2 + 1); return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]; };
    for (let i = 0; i < surface.points.length - 1; i += 1) {
      const l0 = at(i * 2), r0 = at(i * 2 + 1), l1 = at(i * 2 + 2), r1 = at(i * 2 + 3), m0 = mid(i), m1 = mid(i + 1);
      push(l0, shallow); push(m0, deep); push(l1, shallow);  push(m0, deep); push(m1, deep); push(l1, shallow);
      push(m0, deep); push(r0, shallow); push(m1, deep);    push(r0, shallow); push(r1, shallow); push(m1, deep);
    }
  }
  storage.count = v;
  return storage;
}
