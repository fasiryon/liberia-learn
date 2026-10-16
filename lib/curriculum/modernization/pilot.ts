/**
 * Pilot modernization batch: candidates produced by the modernization pipeline for a representative set
 * of live lessons. Each pilot candidate is registered in the ledger bound to the exact legacy revision it
 * would replace, and waits for independent review. Nothing here is approved, released or scored.
 *
 * The pilot author is a static author: the spec, candidate and assessment definitions are files written by
 * the AI agent named below. That agent may not review them.
 */
import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import type { ExistingCandidate } from "./build";
import type { LedgerActor } from "./ledger";
import type { AssessmentDefinitions, CandidateAuthor, ModernizationSpec } from "./pipeline";

export const PILOT_DIR = "curriculum/modernization/v1/pilot";

export const PILOT_AUTHOR: LedgerActor & { role: "CANDIDATE_AUTHOR" } = Object.freeze({
  kind: "AI_AGENT", id: "claude-code:library-modernization-v1", role: "CANDIDATE_AUTHOR", modelFamily: "anthropic-claude",
});

/** Selected from the baseline audit for coverage of subject, track and learner history (see PILOT_BATCH_V1.md). */
export const PILOT_LESSONS: readonly Readonly<{ key: string; contentId: string; why: string }>[] = Object.freeze([
  { key: "g6-math-decimal-place-value", contentId: "wk_pcs6a_mon_p1", why: "Foundational numeracy; Track B; learner progress on 7 learners; answer key exposed; factual error in a worked example." },
  { key: "g6-literacy-cause-effect", contentId: "wk_pcs6a_wed_p2", why: "Foundational literacy; Track A targeted repair; learner progress on 7 learners." },
  { key: "g7-science-observation-inference", contentId: "science-g7-1-observation-and-scientific-thinking-foundations", why: "Science; Track C placeholder shell (weak original); 11 learning events." },
  { key: "g1-civics-rules-rights-duties", contentId: "civics-g1-1-rules-rights-and-duties-foundations", why: "Civics (MOE Social Studies proxy); grade 1 emergent readers; highest exposure (60 learners' progress); one of four identical duplicates." },
]);

const PILOT_FILES = ["spec.json", "candidate.json", "assessment-definitions.json"] as const;
const read = (key: string, file: string) => fs.readFileSync(path.join(PILOT_DIR, key, file), "utf8");

export function pilotAuthor(key: string): CandidateAuthor {
  return {
    identity: PILOT_AUTHOR,
    inputHash: () => createHash("sha256").update(PILOT_FILES.map((file) => read(key, file)).join("\u0000")).digest("hex"),
    author: () => ({
      spec: JSON.parse(read(key, "spec.json")) as ModernizationSpec,
      candidate: JSON.parse(read(key, "candidate.json")) as unknown,
      assessment: JSON.parse(read(key, "assessment-definitions.json")) as AssessmentDefinitions,
      // Authored in-session from files: no metered generation call.
      costTokens: 0,
    }),
  };
}

/** Pilot candidates that have a package, for the inventory's candidate column and ledger reconciliation. */
export function loadPilotCandidates(): ExistingCandidate[] {
  const out: ExistingCandidate[] = [];
  for (const lesson of PILOT_LESSONS) {
    const specFile = path.join(PILOT_DIR, lesson.key, "spec.json");
    if (!fs.existsSync(specFile)) continue;
    const spec = JSON.parse(fs.readFileSync(specFile, "utf8")) as ModernizationSpec;
    const manifestFile = path.join(PILOT_DIR, lesson.key, "package", spec.candidateVersion, "manifest.json");
    if (!fs.existsSync(manifestFile)) continue;
    const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8")) as { manifestHash: string; candidate: { sha256: string }; legacy: { revisionId: string } };
    out.push({
      contentId: lesson.contentId, candidateId: spec.candidateId, candidateVersion: spec.candidateVersion, candidateHash: manifest.candidate.sha256,
      manifestHash: manifest.manifestHash, legacyRevisionId: manifest.legacy.revisionId, authors: [PILOT_AUTHOR], ref: "library modernization pilot V1",
    });
  }
  return out;
}
