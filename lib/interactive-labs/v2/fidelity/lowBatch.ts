import type { RenderItem, RenderList } from "./renderList";

export type LowBatch = { key: string; itemIds: string[]; items: RenderItem[] };
export type LowBatchPlan = { batches: LowBatch[]; singles: RenderItem[]; drawCalls: number };
const mayBatch = (item: RenderItem) => item.alpha >= 0.9 && !item.clip && !item.spin && !item.highlighted && item.inFocus;

/** Deterministic LOW grouping. Each item retains its id and current render-list record for picking and labels. */
export function planLowBatches(list: Pick<RenderList,"items"|"flows"|"markers">): LowBatchPlan {
  const groups = new Map<string, LowBatch>(), singles: RenderItem[] = [];
  for (const item of list.items) {
    if (!mayBatch(item)) { singles.push(item); continue; }
    const key = JSON.stringify([item.parametricGeometry ?? item.geometry, item.color, item.alpha, item.emissive]);
    const group = groups.get(key) ?? { key, itemIds: [], items: [] };
    group.itemIds.push(item.id); group.items.push(item); groups.set(key, group);
  }
  const batches = [...groups.values()].filter((group) => group.items.length > 1);
  for (const group of groups.values()) if (group.items.length === 1) singles.push(group.items[0]);
  // The WebGL pass has three shared flow draws and a shared marker draw.
  const drawCalls = batches.length + singles.length + (list.flows.length ? 3 : 0) + (list.markers.length ? 1 : 0);
  return { batches, singles, drawCalls };
}
