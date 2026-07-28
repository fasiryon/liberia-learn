/**
 * CurriculumContent.moeAlignments has two shapes in production, both real:
 * - legacy bare array `[{code, ...}]` or `["CODE", ...]`, written by content-
 *   creation pipelines (importer.ts, generate-full-pack route, etc.) as an
 *   "unaligned" placeholder, predating lib/moe/alignment-engine.ts entirely.
 * - canonical object `{contentId, standards, alignedAt, method}`, written by
 *   the real alignment engine (lib/moe/alignment-engine.ts::alignContentToMOE).
 *
 * Every consumer must go through these helpers instead of casting/assuming
 * either shape directly - a bare `.map()`/`.forEach()` on the canonical
 * object throws, and a naive `Boolean(moeAlignments)` truthy check treats
 * an empty legacy placeholder as "aligned" when it never was.
 */

export type MoeAlignmentCode = { code: string; description?: string; confidence?: string };

export function readMoeAlignmentEntries(value: unknown): MoeAlignmentCode[] {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return { code: item };
        if (item && typeof item === "object" && typeof (item as { code?: unknown }).code === "string") {
          return item as MoeAlignmentCode;
        }
        return null;
      })
      .filter((entry): entry is MoeAlignmentCode => entry != null && Boolean(entry.code));
  }

  if (typeof value === "object") {
    const standards = (value as { standards?: unknown }).standards;
    if (Array.isArray(standards)) {
      return standards
        .map((s) => {
          if (typeof s === "string") return { code: s };
          if (s && typeof s === "object" && typeof (s as { code?: unknown }).code === "string") {
            return s as MoeAlignmentCode;
          }
          return null;
        })
        .filter((entry): entry is MoeAlignmentCode => entry != null && Boolean(entry.code));
    }
  }

  return [];
}

export function readMoeAlignmentCodes(value: unknown): string[] {
  return readMoeAlignmentEntries(value)
    .map((entry) => entry.code.trim())
    .filter(Boolean);
}

/** "Aligned"/"coverage" means a genuine, non-empty standard match - never
 * just "the field is non-null" (a legacy placeholder or an empty attempted
 * result both count as NOT aligned). */
export function hasGenuineMoeAlignment(value: unknown): boolean {
  return readMoeAlignmentEntries(value).length > 0;
}
