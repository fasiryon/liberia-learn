import type { RenderItem, RenderList } from "@/lib/interactive-labs/v2/fidelity/renderList";

export type ScenePick = { kind: "item"; item: RenderItem } | { kind: "node"; flowId: string; nodeId: string };
export type ScreenPoint = { x: number; y: number; /** Normalized device depth: -1 is nearest, +1 is farthest. */ depth?: number };

/** Nearest pickable target to a pointer, in screen pixels. Trace mode picks flow nodes, otherwise items. */
export function pickNearest(list: RenderList, project: (p: [number, number, number]) => ScreenPoint | null, pointer: ScreenPoint, traceFlowId: string | null, radius = 56): ScenePick | null {
  let best: { pick: ScenePick; d: number; depth?: number; id: string } | null = null;
  const consider = (pick: ScenePick, at: ScreenPoint | null) => {
    if (!at) return;
    const d = Math.hypot(at.x - pointer.x, at.y - pointer.y);
    const id = pick.kind === "item" ? pick.item.id : pick.nodeId;
    const depthWins = best && at.depth !== undefined && best.depth !== undefined && at.depth !== best.depth && at.depth < best.depth;
    const distanceWins = best && (at.depth === undefined || best.depth === undefined || at.depth === best.depth) && d < best.d;
    const stableTieWins = best && d === best.d && (at.depth === undefined || best.depth === undefined || at.depth === best.depth) && id.localeCompare(best.id) < 0;
    if (d <= radius && (!best || depthWins || distanceWins || stableTieWins)) best = { pick, d, depth: at.depth, id };
  };
  if (traceFlowId) {
    const flow = list.flows.find((candidate) => candidate.id === traceFlowId);
    for (const node of flow?.nodes ?? []) if (node.traceable) consider({ kind: "node", flowId: traceFlowId, nodeId: node.id }, project(node.position));
    if (best) return best.pick;
  }
  for (const item of list.items) if (item.detail !== "decor" && item.selectable && item.inFocus) consider({ kind: "item", item }, project(item.center));
  return best?.pick ?? null;
}
