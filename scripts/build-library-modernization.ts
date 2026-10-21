/**
 * Builds the Library Modernization V1 baseline from the local read-only extract:
 *   curriculum/modernization/v1/{inventory,tracker,waves}.json, audit/, ledger/
 *   docs/curriculum/modernization/{LIBRARY_MODERNIZATION_INVENTORY_V1,LIBRARY_QUALITY_BASELINE_V1}.md
 *   curriculum/modernization/v1/DASHBOARD.md
 *
 *   npx tsx scripts/extract-library-modernization-inventory.ts   # read-only, needs DATABASE_URL
 *   npx tsx scripts/build-library-modernization.ts               # offline, deterministic
 *
 * Idempotent: re-running against an unchanged extract appends no ledger events and rewrites identical files.
 * Never touches a database.
 */
import fs from "fs";
import path from "path";
import { loadLibraryExtract } from "@/lib/curriculum/modernization/extract";
import { buildBaseline, digest, LEDGER_FILE, loadCleanupPlanIndex, MODERNIZATION_DIR, repositorySources, writeBaseline, type ExistingCandidate } from "@/lib/curriculum/modernization/build";
import { readLedgerFile, writeLedgerFile, type LedgerActor } from "@/lib/curriculum/modernization/ledger";
import { renderInventoryReport, renderLedgerDashboard, renderQualityBaseline } from "@/lib/curriculum/modernization/report";
import { evaluateG7Candidate, G7_CANDIDATE_VERSION, G7_NATIVE_LESSONS } from "@/lib/curriculum/v2/g7Native";
import { candidateReleaseManifest } from "@/lib/curriculum/v2/g7NativePackage";
import { loadPilotCandidates } from "@/lib/curriculum/modernization/pilot";

function grade7Candidates(): ExistingCandidate[] {
  const source = JSON.parse(fs.readFileSync("curriculum/excellence/g7-v0.3.0/source.json", "utf8")) as {
    candidateAuthors: { kind: string; agentId: string; modelFamily: string | null }[];
    lessons: { lessonKey: string; contentKey: string; expectedCandidateSha256: string }[];
  };
  const authors: LedgerActor[] = source.candidateAuthors.map((author) => ({ kind: "AI_AGENT", id: author.agentId, role: "CANDIDATE_AUTHOR", modelFamily: author.modelFamily ?? undefined }));
  return G7_NATIVE_LESSONS.map((lesson) => {
    const pinned = source.lessons.find((entry) => entry.lessonKey === lesson.key);
    if (!pinned) throw new Error(`G7 source pin missing for ${lesson.key}`);
    const outcome = evaluateG7Candidate(lesson);
    if (outcome.candidateSha256 !== pinned.expectedCandidateSha256) throw new Error(`G7 candidate ${lesson.key} hash ${outcome.candidateSha256} != pinned ${pinned.expectedCandidateSha256}`);
    return {
      contentId: lesson.legacy.contentId, candidateId: pinned.contentKey.split("@")[0], candidateVersion: G7_CANDIDATE_VERSION, candidateHash: outcome.candidateSha256,
      manifestHash: digest(candidateReleaseManifest(lesson)), legacyRevisionId: lesson.legacy.currentRevisionId, authors, ref: "PR #191 v0.3.0",
    };
  });
}

function main() {
  const { manifest, records } = loadLibraryExtract();
  const cleanup = loadCleanupPlanIndex();
  const candidates = [...grade7Candidates(), ...loadPilotCandidates()];
  const before = readLedgerFile(LEDGER_FILE);
  const build = buildBaseline({ manifest, records, cleanup: cleanup.index, candidates, ledger: before });
  for (const candidate of candidates) {
    const live = records.find((record) => record.contentId === candidate.contentId)?.revision?.id;
    if (live !== candidate.legacyRevisionId) throw new Error(`candidate ${candidate.candidateId} is bound to ${candidate.legacyRevisionId}, live is ${live}`);
  }
  writeLedgerFile(LEDGER_FILE, build.ledger);
  const written = writeBaseline(build, manifest, { cleanupCapturedAt: cleanup.capturedAt });
  const docs = "docs/curriculum/modernization";
  fs.mkdirSync(docs, { recursive: true });
  fs.writeFileSync(path.join(docs, "LIBRARY_MODERNIZATION_INVENTORY_V1.md"), renderInventoryReport(build, manifest, repositorySources(), cleanup.capturedAt));
  fs.writeFileSync(path.join(docs, "LIBRARY_QUALITY_BASELINE_V1.md"), renderQualityBaseline(build, manifest));
  fs.writeFileSync(path.join(MODERNIZATION_DIR, "DASHBOARD.md"), renderLedgerDashboard(build));
  console.log(JSON.stringify({
    lessons: records.length, ledgerEvents: build.ledger.events.length, appended: build.appended, head: build.ledger.head,
    written: [...written, `${docs}/LIBRARY_MODERNIZATION_INVENTORY_V1.md`, `${docs}/LIBRARY_QUALITY_BASELINE_V1.md`, `${MODERNIZATION_DIR}/DASHBOARD.md`, LEDGER_FILE],
  }, null, 2));
}

main();
