// RX-005 A8 / RX-006 test 1 evidence: the renderers publish their planned frame next to what the GPU path actually
// drew, and the capture harness fails a run whose planner and renderer disagree.
import type { FramePlan } from "../fidelity/framePlan";

export type MeasuredFrame = { drawCalls: number; triangles: number; shadowDrawCalls: number; shadowTriangles: number };
export type FrameProbeResult = { renderer: "three" | "webgl-pass"; planned: FramePlan; measured: MeasuredFrame; programs?: number | null; memory?: { geometries: number; textures: number } };
/** Installed on window as __labReviewFrameProbe by a renderer mounted in the dev-only review harness. */
export type ReviewFrameProbe = () => FrameProbeResult | null;

/** Planned draws and triangles of the frame just drawn (plus the shadow pass when this frame redrew it). */
export function publishFramePlan(element: HTMLElement, plan: FramePlan | null, shadowPass: boolean): void {
  if (!plan) return;
  element.dataset.labPlannedDraws = String(plan.drawCalls + (shadowPass ? plan.shadowDrawCalls : 0));
  element.dataset.labPlannedTriangles = String(plan.triangles + (shadowPass ? plan.shadowTriangles : 0));
}

export type FrameParity = { ok: boolean; mismatches: string[] };

/** Exact parity: every planned figure must equal the renderer's own count for the same frame. */
export function compareFramePlan(result: FrameProbeResult): FrameParity {
  const mismatches: string[] = [];
  for (const key of ["drawCalls", "triangles", "shadowDrawCalls", "shadowTriangles"] as const) {
    if (result.planned[key] !== result.measured[key]) mismatches.push(`${result.renderer} ${key}: planned ${result.planned[key]}, measured ${result.measured[key]}`);
  }
  return { ok: mismatches.length === 0, mismatches };
}
