// RX-005b emitters and the A15 reduced-motion direction cues. Like surfaces, an emitter binds only to simulation
// output quantities; the renderers draw what these pure, seeded functions return (A9: no Math.random).
import type { FlowMedium, HighFidelitySpec } from "./types";
import type { RenderFlow } from "./renderList";
import type { RenderSurface } from "./surfaces";
import type { Vec3 } from "./math";

/** A19 generic emitter kinds. */
export type EmitterKind = "stream" | "spray" | "upwell" | "bubble" | "pulse";

export type EmitterDefinition = {
  id: string;
  label: string;
  kind: EmitterKind;
  medium: FlowMedium;
  /** World-space origin. */
  origin: Vec3;
  /** Unit-ish direction the particles leave in (normalised on resolve). Upwell and bubble rise along +y regardless. */
  direction?: Vec3;
  /** Reach of the effect in world units at full rate. */
  reach: number;
  /** Quantity that must be > 0 for the emitter to run. Absent means always active. */
  activeQuantity?: string;
  /** Quantity in [0, 1] scaling reach and speed. Absent means 1. */
  rateQuantity?: string;
  color: string;
  /** The component this effect belongs to (labels, picking and checks stay on the component). */
  componentId?: string;
  /** A15: what LOW draws instead of animated particles (a few static points, or a glyph on the component). */
  lowProxy: { kind: "points" } | { kind: "glyph"; glyph: string };
  /** A15: what reduced motion keeps (a direction chevron or a glyph), so the cue never depends on motion. */
  staticCue: { kind: "chevron" } | { kind: "glyph"; glyph: string };
};

export type RenderEmitter = { id: string; label: string; kind: EmitterKind; medium: FlowMedium; origin: Vec3; direction: Vec3; reach: number; active: boolean; rate: number; particleCount: number; color: string; lowProxy: EmitterDefinition["lowProxy"]; staticCue: EmitterDefinition["staticCue"] };

/** A15 static cue: a direction chevron (or glyph) drawn on top of the scene, used under reduced motion. */
export type RenderCue = { id: string; kind: "chevron" | "glyph"; glyph?: string; position: Vec3; direction: Vec3; color: string };

const round4 = (value: number) => Math.round(value * 1e4) / 1e4;
const normalise = (v: Vec3): Vec3 => { const length = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / length, v[1] / length, v[2] / length]; };

/** Resolve every declared emitter against the simulation quantities; inactive emitters keep no particles. */
export function resolveEmitters(spec: HighFidelitySpec, quantities: Record<string, number>, particlesPerEmitter: number): RenderEmitter[] {
  return (spec.emitters ?? []).map((emitter) => {
    const active = emitter.activeQuantity ? (quantities[emitter.activeQuantity] ?? 0) > 0 : true;
    const rate = active ? round4(emitter.rateQuantity ? Math.min(1, Math.max(0, quantities[emitter.rateQuantity] ?? 0)) : 1) : 0;
    const direction = emitter.kind === "upwell" || emitter.kind === "bubble" ? [0, 1, 0] as Vec3 : normalise(emitter.direction ?? [0, 1, 0]);
    return { id: emitter.id, label: emitter.label, kind: emitter.kind, medium: emitter.medium, origin: emitter.origin, direction, reach: emitter.reach, active, rate, particleCount: active && rate > 0 ? particlesPerEmitter : 0, color: emitter.color, lowProxy: emitter.lowProxy, staticCue: emitter.staticCue };
  });
}

/** Deterministic per-particle hash in [0, 1) (A9: seeded, never Math.random). */
export function hash01(seed: number, index: number): number {
  let h = (Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(index + 1, 0xc2b2ae35)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const seedOf = (id: string) => { let h = 2166136261; for (let index = 0; index < id.length; index += 1) h = Math.imul(h ^ id.charCodeAt(index), 16777619); return h >>> 0; };

/** Side vectors perpendicular to a direction, for spreading a spray or a pulse ring. */
function basis(direction: Vec3): [Vec3, Vec3] {
  const up: Vec3 = Math.abs(direction[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const a = normalise([direction[1] * up[2] - direction[2] * up[1], direction[2] * up[0] - direction[0] * up[2], direction[0] * up[1] - direction[1] * up[0]]);
  const b: Vec3 = [direction[1] * a[2] - direction[2] * a[1], direction[2] * a[0] - direction[0] * a[2], direction[0] * a[1] - direction[1] * a[0]];
  return [a, b];
}

/**
 * Particle positions at time t (seconds). Every particle cycles through a phase in [0, 1); speed and reach scale with
 * the model's rate. Reduced motion freezes the phases (a static scatter that still shows extent and direction).
 */
export function emitterParticles(emitter: RenderEmitter, timeSeconds: number, reducedMotion: boolean): Vec3[] {
  if (!emitter.active || emitter.particleCount <= 0) return [];
  const seed = seedOf(emitter.id), [sideA, sideB] = basis(emitter.direction);
  const reach = emitter.reach * (0.35 + 0.65 * emitter.rate), speed = 0.4 + 0.9 * emitter.rate;
  const points: Vec3[] = [];
  for (let index = 0; index < emitter.particleCount; index += 1) {
    const offset = hash01(seed, index), angle = hash01(seed, index + 997) * Math.PI * 2;
    const phase = reducedMotion ? offset : ((offset + timeSeconds * speed * 0.5) % 1 + 1) % 1;
    const along = (d: number, sideScale: number, lift = 0): Vec3 => {
      const sx = Math.cos(angle) * sideScale, sy = Math.sin(angle) * sideScale;
      return [emitter.origin[0] + emitter.direction[0] * d + sideA[0] * sx + sideB[0] * sy, emitter.origin[1] + emitter.direction[1] * d + sideA[1] * sx + sideB[1] * sy + lift, emitter.origin[2] + emitter.direction[2] * d + sideA[2] * sx + sideB[2] * sy];
    };
    switch (emitter.kind) {
      case "stream": points.push(along(phase * reach, 0.04 * reach)); break;
      case "spray": points.push(along(phase * reach, 0.45 * phase * reach, -0.6 * phase * phase * reach)); break;
      case "upwell": points.push(along(phase * reach, 0.18 * reach * (1 - phase))); break;
      case "bubble": points.push(along(phase * reach, 0.08 * reach * Math.sin(phase * Math.PI * 4 + angle))); break;
      case "pulse": points.push(along(0, phase * reach)); break;
    }
  }
  return points;
}

/** A15 reduced-motion cues: a chevron at each active flow segment's midpoint, on active moving surfaces, and per emitter. */
export function resolveCues(flows: readonly RenderFlow[], surfaces: readonly RenderSurface[], emitters: readonly RenderEmitter[]): RenderCue[] {
  const cues: RenderCue[] = [];
  for (const flow of flows) {
    if (!flow.active) continue;
    for (let segment = 0; segment + 1 < flow.points.length; segment += 2) {
      const a = flow.points[segment], b = flow.points[segment + 1];
      const forward = flow.direction === 1 ? [b[0] - a[0], b[1] - a[1], b[2] - a[2]] as Vec3 : [a[0] - b[0], a[1] - b[1], a[2] - b[2]] as Vec3;
      cues.push({ id: `${flow.id}:${segment}`, kind: "chevron", position: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], direction: normalise(forward), color: flow.color });
    }
  }
  for (const surface of surfaces) {
    if (!surface.active || surface.rate <= 0 || surface.points.length < 2) continue;
    const middle = Math.floor((surface.points.length - 1) / 2), a = surface.points[middle], b = surface.points[middle + 1];
    cues.push({ id: `surface:${surface.id}`, kind: "chevron", position: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 0.05, (a[2] + b[2]) / 2], direction: normalise([b[0] - a[0], b[1] - a[1], b[2] - a[2]]), color: "#e0f2fe" });
  }
  for (const emitter of emitters) {
    if (!emitter.active) continue;
    const tip: Vec3 = [emitter.origin[0] + emitter.direction[0] * emitter.reach * 0.5, emitter.origin[1] + emitter.direction[1] * emitter.reach * 0.5, emitter.origin[2] + emitter.direction[2] * emitter.reach * 0.5];
    cues.push(emitter.staticCue.kind === "glyph"
      ? { id: `emitter:${emitter.id}`, kind: "glyph", glyph: emitter.staticCue.glyph, position: tip, direction: emitter.direction, color: emitter.color }
      : { id: `emitter:${emitter.id}`, kind: "chevron", position: tip, direction: emitter.direction, color: emitter.color });
  }
  return cues;
}

/** Authoring checks: geometry, quantities the simulation really emits, components, and the A15 cue requirements. */
export function validateEmitters(spec: HighFidelitySpec, quantities: Record<string, number>): string[] {
  const errors: string[] = [], seen = new Set<string>(), componentIds = new Set(spec.components.map((component) => component.id));
  for (const emitter of spec.emitters ?? []) {
    if (seen.has(emitter.id)) errors.push(`emitter_duplicate:${emitter.id}`);
    seen.add(emitter.id);
    if (!(emitter.reach > 0) || !Number.isFinite(emitter.reach)) errors.push(`emitter_reach_invalid:${emitter.id}`);
    if (!emitter.origin.every(Number.isFinite)) errors.push(`emitter_origin_invalid:${emitter.id}`);
    if (emitter.direction && (!emitter.direction.every(Number.isFinite) || Math.hypot(...emitter.direction) === 0)) errors.push(`emitter_direction_invalid:${emitter.id}`);
    for (const key of ["activeQuantity", "rateQuantity"] as const) {
      const quantity = emitter[key];
      if (quantity !== undefined && !Object.hasOwn(quantities, quantity)) errors.push(`emitter_quantity_unknown:${emitter.id}:${quantity}`);
    }
    if (emitter.componentId !== undefined && !componentIds.has(emitter.componentId)) errors.push(`emitter_component_unknown:${emitter.id}`);
    if (!emitter.lowProxy || (emitter.lowProxy.kind === "glyph" && !emitter.lowProxy.glyph.trim())) errors.push(`emitter_low_proxy_missing:${emitter.id}`);
    if (!emitter.staticCue || (emitter.staticCue.kind === "glyph" && !emitter.staticCue.glyph.trim())) errors.push(`emitter_static_cue_missing:${emitter.id}`);
  }
  return errors;
}
