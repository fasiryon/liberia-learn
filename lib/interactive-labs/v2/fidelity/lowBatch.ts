import type { RenderItem, RenderList } from "./renderList";
import type { GeometryKind } from "../types";
import type { ParametricDescriptor } from "./geometry/types";

export type LowBatch = { key: string; itemIds: string[]; items: RenderItem[] };
export type LowBatchPlan = { batches: LowBatch[]; singles: RenderItem[]; drawCalls: number };
const mayBatch = (item: RenderItem) => item.alpha >= 0.9 && !item.clip && !item.spin && !item.highlighted && item.inFocus;
/** WebGL1-safe non-indexed merged chunks stay strictly below the 65,536 vertex boundary. */
export const MAX_LOW_BATCH_VERTICES = 65_532;
const LOW_TRIANGLES: Readonly<Record<GeometryKind, number>> = Object.freeze({ sphere: 192, cylinder: 56, cone: 28, cube: 12, "rectangular-prism": 12, lever: 12, box: 12, panel: 12 });
function descriptorTriangles(descriptor: ParametricDescriptor): number {
  switch (descriptor.kind) {
    case "lathe": return (descriptor.profile.length - 1) * Math.min(descriptor.radialSegments ?? 12, 12) * 2;
    case "sweep": return (descriptor.closed ? descriptor.points.length : descriptor.points.length - 1) * Math.min(descriptor.radialSegments ?? 6, 6) * 2;
    case "extrude": return 4 * descriptor.contour.length - 4;
    case "heightfield": return 2 * (descriptor.rows - 1) * (descriptor.columns - 1);
    case "scatter": return descriptorTriangles(descriptor.prototype) * descriptor.transforms.length;
    case "dimensionLine": return 2 * ((descriptor.ticks ?? 0) + 1);
  }
}
function itemVertexCount(item: RenderItem): number {
  return (item.parametricGeometry ? descriptorTriangles(item.parametricGeometry) : LOW_TRIANGLES[item.geometry]) * 3;
}

/** Deterministic LOW grouping. Each item retains its id and current render-list record for picking and labels. */
export function planLowBatches(list: Pick<RenderList,"items"|"flows"|"markers">): LowBatchPlan {
  const groups = new Map<string, LowBatch>(), singles: RenderItem[] = [];
  const active = new Map<string, { key: string; vertices: number; index: number }>();
  for (const item of list.items) {
    if (!mayBatch(item)) { singles.push(item); continue; }
    const materialKey = JSON.stringify([item.parametricGeometry ?? item.geometry, item.color, item.alpha, item.emissive]);
    const vertexCount = itemVertexCount(item);
    let chunk = active.get(materialKey);
    if (!chunk || chunk.vertices + vertexCount > MAX_LOW_BATCH_VERTICES) {
      chunk = { key: JSON.stringify([materialKey, (chunk?.index ?? -1) + 1]), vertices: 0, index: (chunk?.index ?? -1) + 1 };
      active.set(materialKey, chunk);
    }
    const { key } = chunk;
    let group = groups.get(key);
    if (!group) { group = { key, itemIds: [], items: [] }; groups.set(key, group); }
    group.itemIds.push(item.id); group.items.push(item); chunk.vertices += vertexCount;
  }
  const batches = [...groups.values()].filter((group) => group.items.length > 1);
  for (const group of groups.values()) if (group.items.length === 1) singles.push(group.items[0]);
  // The WebGL pass has three shared flow draws and a shared marker draw.
  const drawCalls = batches.length + singles.length + (list.flows.length ? 3 : 0) + (list.markers.length ? 1 : 0);
  return { batches, singles, drawCalls };
}
