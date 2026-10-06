import type { RenderItem, RenderList } from "@/lib/interactive-labs/v2/fidelity/renderList";
import { itemCorners } from "@/lib/interactive-labs/v2/fidelity/camera";

export type ScenePick = { kind: "item"; item: RenderItem } | { kind: "node"; flowId: string; nodeId: string };
export type ScreenPoint = { x: number; y: number; /** Normalized device depth: -1 is nearest, +1 is farthest. */ depth?: number };

/** A touch target is never smaller than this on screen (WCAG 2.5.5 / the 44 px FALLBACK_2D rule). */
export const MIN_TARGET_PX = 44;

/**
 * RX-006 picking from the current render list (never GPU ids), identical for merged, instanced and single draws.
 * Tiers, best first:
 *   0. the pointer is inside the part's projected bounds: the nearest (smallest depth) wins, so a part in front
 *      occludes one behind it;
 *   1. the pointer is inside the part's bounds grown to the minimum touch target;
 *   2. the pointer is within `radius` of the part's projected centre.
 * Tiers 1 and 2 pick the smallest screen distance to the centre (so adjacent small controls such as gauge bands stay
 * individually reachable), then depth; every tier ends with stable component-id order. Trace mode picks flow nodes.
 */
export function pickNearest(list: RenderList, project: (p: [number, number, number]) => ScreenPoint | null, pointer: ScreenPoint, traceFlowId: string | null, radius = 56): ScenePick | null {
  type Candidate = { pick: ScenePick; tier: number; d: number; depth: number; id: string };
  let best: Candidate | null = null;
  const better = (a: Candidate, b: Candidate) => {
    if (a.tier !== b.tier) return a.tier < b.tier;
    const byDepth = a.tier === 0;
    if (byDepth && a.depth !== b.depth) return a.depth < b.depth;
    if (a.d !== b.d) return a.d < b.d;
    if (!byDepth && a.depth !== b.depth) return a.depth < b.depth;
    return a.id.localeCompare(b.id) < 0;
  };
  const consider = (pick: ScenePick, at: ScreenPoint | null, bounds: { left: number; top: number; right: number; bottom: number } | null) => {
    if (!at || (at.depth !== undefined && (at.depth < -1 || at.depth > 1))) return;
    const d = Math.hypot(at.x - pointer.x, at.y - pointer.y);
    const inside = (box: { left: number; top: number; right: number; bottom: number }) => pointer.x >= box.left && pointer.x <= box.right && pointer.y >= box.top && pointer.y <= box.bottom;
    let tier = d <= radius ? 2 : Infinity;
    if (bounds) {
      if (inside(bounds)) tier = 0;
      else {
        const growX = Math.max(0, (MIN_TARGET_PX - (bounds.right - bounds.left)) / 2), growY = Math.max(0, (MIN_TARGET_PX - (bounds.bottom - bounds.top)) / 2);
        if (inside({ left: bounds.left - growX, right: bounds.right + growX, top: bounds.top - growY, bottom: bounds.bottom + growY })) tier = 1;
      }
    }
    if (tier === Infinity) return;
    const candidate: Candidate = { pick, tier, d, depth: at.depth ?? 0, id: pick.kind === "item" ? pick.item.id : pick.nodeId };
    if (!best || better(candidate, best)) best = candidate;
  };
  if (traceFlowId) {
    const flow = list.flows.find((candidate) => candidate.id === traceFlowId);
    for (const node of flow?.nodes ?? []) if (node.traceable) consider({ kind: "node", flowId: traceFlowId, nodeId: node.id }, project(node.position), null);
    if (best) return (best as Candidate).pick;
  }
  for (const item of list.items) {
    if (item.detail === "decor" || !item.selectable || !item.inFocus) continue;
    const corners = itemCorners(item).map(project).filter((point): point is ScreenPoint => !!point);
    const bounds = corners.length === 8 ? { left: Math.min(...corners.map((p) => p.x)), right: Math.max(...corners.map((p) => p.x)), top: Math.min(...corners.map((p) => p.y)), bottom: Math.max(...corners.map((p) => p.y)) } : null;
    consider({ kind: "item", item }, project(item.center), bounds);
  }
  return (best as Candidate | null)?.pick ?? null;
}
