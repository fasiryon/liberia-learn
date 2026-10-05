// RX-005 A8 / RX-006 test 1: one pure draw and triangle planner per renderer, shared by the renderers (which publish
// it beside their measured counts) and by measureLabBudget. It never imports `three`; the primitive triangle table is
// checked against three.js geometry by __tests__/interactive-labs/frame-plan.test.ts.
import type { CapabilityProfile, GeometryKind, InteractiveLabDefinition, LabState } from "../types";
import type { RenderItem, RenderList } from "./renderList";
import { planLowBatches, type LowBatchPlan } from "./lowBatch";
import { parametricTriangleCount } from "./geometry/builders";

/** One planned frame. Shadow figures are the extra sun-shadow pass ThreeScene draws only when casters moved (A7). */
export type FramePlan = { drawCalls: number; triangles: number; shadowDrawCalls: number; shadowTriangles: number; textures: { id: string; px: number }[] };

/** Triangles of the primitive meshes ThreeScene builds (SphereGeometry(1,32,20), CylinderGeometry(1,1,2,32), ...). */
export const THREE_PRIMITIVE_TRIANGLES: Readonly<Record<GeometryKind, number>> = Object.freeze({ sphere: 1216, cylinder: 128, cone: 64, cube: 12, "rectangular-prism": 12, lever: 12, box: 12, panel: 12 });
/** Triangles of the procedural LOW meshes (components/interactive-labs/v2/meshes.ts). */
export function lowPrimitiveTriangles(kind: GeometryKind): number {
  switch (kind) {
    case "sphere": return 12 * 8 * 2;
    case "cylinder": return 14 * 4;
    case "cone": return 14 * 2;
    default: return 12;
  }
}

/** ThreeScene environment: a ground plane on every rig, and the sky dome SphereGeometry(140,32,16) on daylight. */
export const THREE_GROUND_TRIANGLES = 2;
export const THREE_SKY_TRIANGLES = 960;
/** A13: the LOW daylight ground quad. */
export const LOW_GROUND_TRIANGLES = 2;
/** A7 runtime textures on HIGH daylight: the sun shadow map and the PMREM environment (cube size 256 → 768 × 1024). */
export const DAYLIGHT_SHADOW_MAP_PX = 1024;
export const DAYLIGHT_ENVIRONMENT_PX = 1024;

/** The shadow-caster rule ThreeScene applies to individually drawn parts; batches of opaque static parts always cast. */
export const castsShadow = (item: RenderItem) => !item.spin && !item.clip && item.alpha >= 0.9 && item.detail !== "decor";

/** The trace-path flow a learner is currently asked to trace, exactly as the player derives it. */
export function activeTraceFlowId(definition: InteractiveLabDefinition<LabState>, state: LabState): string | null {
  const active = (definition.checks ?? []).find((check) => !state.completedChecks.includes(check.id));
  return active?.fidelity?.kind === "trace-path" ? active.fidelity.flowId : null;
}

function itemTriangles(item: RenderItem, profile: Exclude<CapabilityProfile, "FALLBACK_2D">): number {
  if (item.parametricGeometry) return parametricTriangleCount(item.parametricGeometry, profile);
  return profile === "LOW" ? lowPrimitiveTriangles(item.geometry) : THREE_PRIMITIVE_TRIANGLES[item.geometry];
}
const activeSurfaces = (list: Pick<RenderList, "surfaces">) => list.surfaces.filter((surface) => surface.active && surface.width > 0);
const hasParticles = (list: Pick<RenderList, "flows">) => list.flows.some((flow) => flow.active && flow.particleCount > 0 && flow.rate > 0 && flow.points.length >= 2);
const hasTraceNodes = (list: Pick<RenderList, "flows">, traceFlowId: string | null) => !!traceFlowId && list.flows.some((flow) => flow.id === traceFlowId && flow.nodes.some((node) => node.traceable));
const hasLines = (list: Pick<RenderList, "flows">) => list.flows.some((flow) => flow.points.length >= 2);

/** WebGLScene (LOW): merged batches, singles, ground, one surface batch, and the shared line/particle/trace/marker batches. */
export function planLowFrame(list: RenderList, options: { traceFlowId: string | null; plan?: LowBatchPlan }): FramePlan {
  const plan = options.plan ?? planLowBatches(list);
  const daylight = list.environment === "DAYLIGHT", surfaces = activeSurfaces(list);
  const drawCalls = plan.batches.length + plan.singles.length + (daylight ? 1 : 0) + (surfaces.length ? 1 : 0)
    + (hasLines(list) ? 1 : 0) + (hasParticles(list) ? 1 : 0) + (list.flows.length && hasTraceNodes(list, options.traceFlowId) ? 1 : 0) + (list.markers.length ? 1 : 0);
  const triangles = list.items.reduce((sum, item) => sum + itemTriangles(item, "LOW"), 0) + (daylight ? LOW_GROUND_TRIANGLES : 0)
    + surfaces.reduce((sum, surface) => sum + (surface.points.length - 1) * 4, 0);
  return { drawCalls, triangles, shadowDrawCalls: 0, shadowTriangles: 0, textures: [] };
}

/**
 * ThreeScene (HIGH/STANDARD) with frustum culling off, i.e. the worst frame. Main pass: ground, daylight sky, one
 * InstancedMesh per batch, singles, one mesh per active surface, one line per flow, one point cloud per particle flow
 * and the shared marker cloud. Shadow pass (HIGH daylight only): every caster again.
 */
export function planThreeFrame(list: RenderList, options: { profile: "HIGH" | "STANDARD"; traceFlowId: string | null; plan?: LowBatchPlan }): FramePlan {
  const plan = options.plan ?? planLowBatches(list);
  const daylight = list.environment === "DAYLIGHT", shadows = daylight && options.profile === "HIGH";
  const surfaces = activeSurfaces(list);
  const particleFlows = list.flows.filter((flow) => flow.active && flow.particleCount > 0 && flow.rate > 0 && flow.points.length >= 2).length;
  const markerCloud = list.markers.length > 0 || hasTraceNodes(list, options.traceFlowId) ? 1 : 0;
  const drawCalls = 1 + (daylight ? 1 : 0) + plan.batches.length + plan.singles.length + surfaces.length + list.flows.length + particleFlows + markerCloud;
  const tri = (item: RenderItem) => itemTriangles(item, options.profile);
  const batchTriangles = plan.batches.reduce((sum, batch) => sum + tri(batch.items[0]) * batch.items.length, 0);
  const triangles = THREE_GROUND_TRIANGLES + (daylight ? THREE_SKY_TRIANGLES : 0) + batchTriangles + plan.singles.reduce((sum, item) => sum + tri(item), 0)
    + surfaces.reduce((sum, surface) => sum + (surface.points.length - 1) * 2, 0);
  const casters = shadows ? plan.singles.filter(castsShadow) : [];
  return {
    drawCalls, triangles,
    shadowDrawCalls: shadows ? plan.batches.length + casters.length : 0,
    shadowTriangles: shadows ? batchTriangles + casters.reduce((sum, item) => sum + tri(item), 0) : 0,
    textures: shadows ? [{ id: "sun-shadow-map", px: DAYLIGHT_SHADOW_MAP_PX }, { id: "pmrem-environment", px: DAYLIGHT_ENVIRONMENT_PX }] : [],
  };
}

/** The renderer-specific planned frame for a profile (FALLBACK_2D draws SVG: zero GPU draws). */
export function planFrame(list: RenderList, profile: CapabilityProfile, traceFlowId: string | null): FramePlan {
  if (profile === "FALLBACK_2D") return { drawCalls: 0, triangles: 0, shadowDrawCalls: 0, shadowTriangles: 0, textures: [] };
  return profile === "LOW" ? planLowFrame(list, { traceFlowId }) : planThreeFrame(list, { profile, traceFlowId });
}
