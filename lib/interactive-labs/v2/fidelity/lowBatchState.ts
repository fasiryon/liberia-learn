/** Reusable per-source-item GPU attribute ranges for the LOW merged renderer. */
export type LowBatchStateRange = {
  color: string;
  emissive: number;
  colorData: Float32Array;
  emissiveData: Float32Array;
};

export const LOW_BATCH_COLOR_CHANGED = 1;
export const LOW_BATCH_EMISSIVE_CHANGED = 2;

/** Rewrite only the changed component's reusable staging ranges; returns a bit mask for GPU subrange uploads. */
export function syncLowBatchItemState(range: LowBatchStateRange, item: { color: string; emissive: number }): number {
  let changed = 0;
  if (range.color !== item.color) {
    const color = Number.parseInt(item.color.replace("#", ""), 16), red = (color >> 16 & 255) / 255, green = (color >> 8 & 255) / 255, blue = (color & 255) / 255;
    for (let offset = 0; offset < range.colorData.length; offset += 3) {
      range.colorData[offset] = red;
      range.colorData[offset + 1] = green;
      range.colorData[offset + 2] = blue;
    }
    range.color = item.color;
    changed |= LOW_BATCH_COLOR_CHANGED;
  }
  if (range.emissive !== item.emissive) {
    range.emissiveData.fill(item.emissive);
    range.emissive = item.emissive;
    changed |= LOW_BATCH_EMISSIVE_CHANGED;
  }
  return changed;
}

/**
 * RX-006 capacity rule: a merged batch's GPU buffers (and CPU scratch) grow geometrically, and only during a rebuild,
 * never past the WebGL1-safe batch cap; a rebuild that fits writes into the existing buffers with bufferSubData.
 */
export function growLowBatchCapacity(current: number, needed: number, max: number): number {
  if (needed > max) throw new Error(`low_batch_over_capacity:${needed}>${max}`);
  if (needed <= current) return current;
  return Math.min(max, Math.max(needed, Math.ceil(Math.max(current, 1) * 2)));
}

/** Reusable CPU staging for one batch rebuild, sized to the batch capacity in vertices. */
export type LowBatchScratch = { capacity: number; positions: Float32Array; normals: Float32Array; colors: Float32Array; emissions: Float32Array };
export function createLowBatchScratch(): LowBatchScratch {
  return { capacity: 0, positions: new Float32Array(0), normals: new Float32Array(0), colors: new Float32Array(0), emissions: new Float32Array(0) };
}
/** Grow `scratch` to hold `vertices`; returns true when it (and so the GPU buffers) had to grow. */
export function ensureLowBatchScratch(scratch: LowBatchScratch, vertices: number, max: number): boolean {
  const capacity = growLowBatchCapacity(scratch.capacity, vertices, max);
  if (capacity === scratch.capacity) return false;
  scratch.capacity = capacity;
  scratch.positions = new Float32Array(capacity * 3); scratch.normals = new Float32Array(capacity * 3);
  scratch.colors = new Float32Array(capacity * 3); scratch.emissions = new Float32Array(capacity);
  return true;
}
