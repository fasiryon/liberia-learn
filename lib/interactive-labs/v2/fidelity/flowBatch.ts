import type { RenderFlow, RenderList } from "./renderList";
import { measureFlowPath, type FlowPathMetrics, writeFlowParticles } from "./presentation";
import { MARKER_COLOR, parseHexColor } from "./palette";
import { emitterParticles } from "./emitters";
import type { Vec3 } from "./math";
import { createFlowTubeStorage, flowTubeSignature, writeFlowTubes, type FlowTubeStorage } from "./flowTubes";

export type FlowVertexBatch = { positions: Float32Array; colors: Float32Array; count: number; /** When set, a renderer may skip re-uploading an unchanged version. */ version?: number };
export type PointBatchStorage = { positions: Float32Array; count: number };
export const createPointBatchStorage = (): PointBatchStorage => ({ positions: new Float32Array(0), count: 0 });
/** Write moving scene markers into reusable CPU storage; capacity changes only when the list grows. */
export function writeMarkerPositions(markers: readonly { position: Vec3 }[], storage: PointBatchStorage): PointBatchStorage {
  if (storage.positions.length < markers.length * 3) {
    let capacity = Math.max(24, storage.positions.length);
    while (capacity < markers.length * 3) capacity *= 2;
    storage.positions = new Float32Array(capacity);
  }
  storage.count = markers.length;
  for (let index = 0; index < markers.length; index += 1) {
    const position = markers[index].position, offset = index * 3;
    storage.positions[offset] = position[0]; storage.positions[offset + 1] = position[1]; storage.positions[offset + 2] = position[2];
  }
  return storage;
}
/** LOW flow geometry: cased tubes (A10/A13), particles and trace nodes, all in reusable storage. */
export type FlowBatchStorage = { tubes: FlowTubeStorage; particles: FlowVertexBatch; traceNodes: FlowVertexBatch; pathMetrics: Map<string, { coordinates: number[]; metrics: FlowPathMetrics }> };
const emptyBatch = (): FlowVertexBatch => ({ positions: new Float32Array(0), colors: new Float32Array(0), count: 0 });
export const createFlowBatchStorage = (): FlowBatchStorage => ({ tubes: createFlowTubeStorage(), particles: emptyBatch(), traceNodes: emptyBatch(), pathMetrics: new Map() });
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

/** Refill reusable CPU storage for the LOW renderer: cased flow tubes, particles, and trace nodes. */
export function batchFlowGeometry(list: RenderList, timeSeconds: number, reducedMotion: boolean, traceFlowId: string | null, storage: FlowBatchStorage): FlowBatchStorage {
  storage.particles.count = 0; storage.traceNodes.count = 0;
  // The tubes are static between flow changes: rewrite (and so re-upload) them only when their signature moves.
  const drawable = list.flows.filter((flow) => flow.points.length >= 2), signature = flowTubeSignature(drawable);
  if (signature !== storage.tubes.signature) { writeFlowTubes(drawable, "LOW", storage.tubes); storage.tubes.signature = signature; }
  for (const flow of list.flows) {
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
  // A15 LOW proxy: an emitter whose lowProxy is "points" shows a few static points in the same particle batch.
  for (const emitter of list.emitters) if (emitter.particleCount > 0 && emitter.lowProxy.kind === "points") for (const point of emitterParticles(emitter, 0, true)) push(storage.particles, point, emitter.color);
  return storage;
}

