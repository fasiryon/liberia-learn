import { hasGenuineMoeAlignment } from "@/lib/moe/alignmentReader";

export type AlignmentMode = "FULL_CONFIDENCE" | "DEFERRED";

/**
 * Decided ONCE at session start (Escalation Point 1) from the live,
 * per-lesson hasGenuineMoeAlignment() check, never from a cached count.
 */
export function determineAlignmentMode(moeAlignments: unknown): AlignmentMode {
  return hasGenuineMoeAlignment(moeAlignments) ? "FULL_CONFIDENCE" : "DEFERRED";
}
