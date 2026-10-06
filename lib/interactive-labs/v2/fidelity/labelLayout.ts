// Screen-space scene label placement shared by the WebGL renderers (A11 label budget, R3 visual findings).
// A label is shown only when its whole box is inside the scene and it does not overlap a label or obstacle already
// placed. Highlighted parts go first, then nearest the frame centre; at most `budget` labels. Pure and deterministic.

/** `critical`: a part a check names (A1 `label` cue); it outranks other unhighlighted parts for the budget. */
export type LabelCandidate = { id: string; text: string; x: number; y: number; highlighted: boolean; critical?: boolean };
export type LabelBox = { left: number; top: number; right: number; bottom: number };
export type PlacedLabel = LabelCandidate & { box: LabelBox };

/** Box of an 11 px semibold pill anchored bottom-centre at (x, y), as the renderers draw it. */
export function labelBox(text: string, x: number, y: number, anchor: "bottom" | "center" = "bottom"): LabelBox {
  const width = text.length * 6.6 + 16, height = 20;
  const top = anchor === "bottom" ? y - height : y - height / 2;
  return { left: x - width / 2, top, right: x + width / 2, bottom: top + height };
}

const overlaps = (a: LabelBox, b: LabelBox, gap = 2) => a.left < b.right + gap && b.left < a.right + gap && a.top < b.bottom + gap && b.top < a.bottom + gap;

export function placeSceneLabels(candidates: readonly LabelCandidate[], viewport: { width: number; height: number }, budget: number, obstacles: readonly LabelBox[] = [], anchor: "bottom" | "center" = "bottom"): PlacedLabel[] {
  // Highlighted parts first; then the parts nearest the centre of the frame, so a focused camera (city, powerhouse
  // section, exploded bench) names what it frames instead of spending the budget on parts at the edges.
  const centre = (candidate: LabelCandidate) => Math.hypot(candidate.x - viewport.width / 2, candidate.y - viewport.height / 2);
  // Then the parts a check names (R4 visual: runner/shaft and unit labels lost the budget to decor-adjacent parts).
  const rank = (candidate: LabelCandidate) => candidate.highlighted ? 0 : candidate.critical ? 1 : 2;
  const ranked = [...candidates].sort((a, b) => rank(a) - rank(b) || (rank(a) === 0 ? 0 : centre(a) - centre(b)));
  const placed: PlacedLabel[] = [];
  for (const candidate of ranked) {
    if (placed.length >= budget) break;
    if (!Number.isFinite(candidate.x) || !Number.isFinite(candidate.y)) continue;
    const box = labelBox(candidate.text, candidate.x, candidate.y, anchor);
    if (box.left < 0 || box.top < 0 || box.right > viewport.width || box.bottom > viewport.height) continue;
    if (obstacles.some((obstacle) => overlaps(box, obstacle)) || placed.some((other) => overlaps(box, other.box))) continue;
    placed.push({ ...candidate, box });
  }
  return placed;
}
