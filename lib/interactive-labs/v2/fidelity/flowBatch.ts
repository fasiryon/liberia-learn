import type { RenderFlow, RenderList } from "./renderList";
import { measureFlowPath, type FlowPathMetrics, writeFlowParticles } from "./presentation";
import { INACTIVE_FLOW_COLOR, MARKER_COLOR, parseHexColor } from "./palette";
import type { Vec3 } from "./math";

export type FlowVertexBatch = { positions: Float32Array; colors: Float32Array; count: number };
export type FlowBatchStorage = { lines: FlowVertexBatch; particles: FlowVertexBatch; traceNodes: FlowVertexBatch; pathMetrics: Map<string, { coordinates: number[]; metrics: FlowPathMetrics }> };
const emptyBatch = (): FlowVertexBatch => ({ positions: new Float32Array(0), colors: new Float32Array(0), count: 0 });
export const createFlowBatchStorage = (): FlowBatchStorage => ({ lines: emptyBatch(), particles: emptyBatch(), traceNodes: emptyBatch(), pathMetrics: new Map() });
const colorCache = new Map<string, [number, number, number]>();
function colorRgb(color: string) {
  let value = colorCache.get(color);
  if (!value) { value = parseHexColor(color); colorCache.set(color, value); }
  return value;
}
function reserve(batch: FlowVertexBatch, vertices: number) {
  if (batch.positions.length >= vertices * 3) return;
  let capacity = Math.max(24, batch.positions.length);
  while (capacity < vertices * 3) capacity *= 2;
  batch.positions = new Float32Array(capacity);
  batch.colors = new Float32Array(capacity);
}
function push(batch: FlowVertexBatch, point: Vec3, color: string) {
  reserve(batch, batch.count + 1);
  const offset = batch.count * 3, rgb = colorRgb(color);
  batch.positions[offset] = point[0]; batch.positions[offset + 1] = point[1]; batch.positions[offset + 2] = point[2];
  batch.colors[offset] = rgb[0]; batch.colors[offset + 1] = rgb[1]; batch.colors[offset + 2] = rgb[2];
  batch.count += 1;
}

function metricsFor(storage: FlowBatchStorage, flow: RenderFlow): FlowPathMetrics {
  const flatCount = flow.points.length * 3;
  let cached = storage.pathMetrics.get(flow.id);
  let changed = !cached || cached.coordinates.length !== flatCount;
  if (!changed && cached) {
    for (let index = 0; index < flow.points.length && !changed; index += 1) {
      const point = flow.points[index], offset = index * 3;
      changed = cached.coordinates[offset] !== point[0] || cached.coordinates[offset + 1] !== point[1] || cached.coordinates[offset + 2] !== point[2];
    }
  }
  if (changed) {
    const coordinates = new Array<number>(flatCount);
    for (let index = 0; index < flow.points.length; index += 1) {
      const point = flow.points[index], offset = index * 3;
      coordinates[offset] = point[0]; coordinates[offset + 1] = point[1]; coordinates[offset + 2] = point[2];
    }
    cached = { coordinates, metrics: measureFlowPath(flow.points) };
    storage.pathMetrics.set(flow.id, cached);
  }
  return cached!.metrics;
}

/** Refill reusable CPU storage for three renderer calls: paths, particles, and trace nodes. */
export function batchFlowGeometry(list: RenderList, timeSeconds: number, reducedMotion: boolean, traceFlowId: string | null, storage: FlowBatchStorage): FlowBatchStorage {
  storage.lines.count = 0; storage.particles.count = 0; storage.traceNodes.count = 0;
  for (const flow of list.flows) {
    const lineColor = flow.active ? flow.color : INACTIVE_FLOW_COLOR;
    for (let segment = 0; segment < flow.points.length - 1; segment += 1) {
      if (!flow.active && segment % 2 === 1) continue;
      push(storage.lines, flow.points[segment], lineColor);
      push(storage.lines, flow.points[segment + 1], lineColor);
    }
    if (flow.active && flow.particleCount > 0) {
      const batch = storage.particles, start = batch.count;
      reserve(batch, start + flow.particleCount);
      const written = writeFlowParticles(flow.points, metricsFor(storage, flow), flow.particleCount, flow.rate, flow.direction, timeSeconds, reducedMotion, batch.positions, start);
      const rgb = colorRgb(flow.color);
      for (let index = start; index < start + written; index += 1) {
        const offset = index * 3;
        batch.colors[offset] = rgb[0]; batch.colors[offset + 1] = rgb[1]; batch.colors[offset + 2] = rgb[2];
      }
      batch.count += written;
    }
    if (traceFlowId === flow.id) for (const node of flow.nodes) if (node.traceable) push(storage.traceNodes, node.position, MARKER_COLOR);
  }
  return storage;
}

/** Add a loop's repeated first endpoint without mutating the authoring flow. */
export function flowLinePointCount(flow: RenderFlow): number {
  let count = 0;
  for (let segment = 0; segment < flow.points.length - 1; segment += 1) if (flow.active || segment % 2 === 0) count += 2;
  return count;
}
