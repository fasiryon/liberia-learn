/**
 * Pilot modernization batch: candidates produced by the modernization pipeline for a representative set
 * of live lessons. Each pilot candidate is registered in the ledger bound to the exact legacy revision it
 * would replace, and waits for independent review. Nothing here is approved, released or scored.
 */
import type { ExistingCandidate } from "./build";

/** Pilot candidates registered in the ledger. Populated by the pilot batch (Milestone 3). */
export function loadPilotCandidates(): ExistingCandidate[] {
  return [];
}
