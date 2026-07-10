/**
 * Lightweight lesson-quality proxy (0..100) for the fine-tune eval harness:
 * length adequacy for the grade band, structural completeness, and Liberian
 * context. It approximates the production curriculum quality gate and can be
 * swapped for it; the point is a consistent metric to compare base vs FT.
 */
function wordFloor(grade: number): number {
  if (grade <= 3) return 800;
  if (grade <= 6) return 1200;
  if (grade <= 9) return 1800;
  return 2500;
}

const SECTION_MARKERS = ["objective", "example", "guided practice", "independent practice", "assessment", "summary"];
const CONTEXT_MARKERS = ["liberia", "monrovia", "fatu", "pewu", "boima", "musu", "waterside", "gbarnga", "buchanan", "ld "];

export function scoreLessonBody(body: string, grade: number): number {
  const text = (body ?? "").trim();
  if (!text) return 0;
  const lower = text.toLowerCase();
  const words = text.split(/\s+/).length;

  // Length adequacy (up to 40)
  const lengthScore = Math.min(40, (words / wordFloor(grade)) * 40);

  // Structural completeness (up to 40)
  const sectionsHit = SECTION_MARKERS.filter((m) => lower.includes(m)).length;
  const sectionScore = (sectionsHit / SECTION_MARKERS.length) * 40;

  // Liberian context (up to 20)
  const contextHit = CONTEXT_MARKERS.some((m) => lower.includes(m));
  const contextScore = contextHit ? 20 : 0;

  return Math.max(0, Math.min(100, Math.round(lengthScore + sectionScore + contextScore)));
}
