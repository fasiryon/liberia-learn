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
