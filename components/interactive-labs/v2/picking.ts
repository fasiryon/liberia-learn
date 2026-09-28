import type { RenderItem, RenderList } from "@/lib/interactive-labs/v2/fidelity/renderList";

export type ScenePick = { kind: "item"; item: RenderItem } | { kind: "node"; flowId: string; nodeId: string };
export type ScreenPoint = { x: number; y: number };

/** Nearest pickable target to a pointer, in screen pixels. Trace mode picks flow nodes, otherwise items. */
export function pickNearest(list: RenderList, project: (p: [number, number, number]) => ScreenPoint | null, pointer: ScreenPoint, traceFlowId: string | null, radius = 56): ScenePick | null {
  let best: { pick: ScenePick; d: number } | null = null;
  const consider = (pick: ScenePick, at: ScreenPoint | null) => {
    if (!at) return;
    const d = Math.hypot(at.x - pointer.x, at.y - pointer.y);
    if (d <= radius && (!best || d < best.d)) best = { pick, d };
  };
  if (traceFlowId) {
    const flow = list.flows.find((candidate) => candidate.id === traceFlowId);
    for (const node of flow?.nodes ?? []) if (node.traceable) consider({ kind: "node", flowId: traceFlowId, nodeId: node.id }, project(node.position));
    if (best) return (best as { pick: ScenePick }).pick;
  }
  for (const item of list.items) if (item.selectable && item.inFocus) consider({ kind: "item", item }, project(item.center));
  return best ? (best as { pick: ScenePick }).pick : null;
}
