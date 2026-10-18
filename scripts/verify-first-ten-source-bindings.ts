// Verifies the ten first-ten source bindings against the local read-only extract (gitignored) and writes
// curriculum/modernization/v1/first-ten/source-bindings.json in the Content Factory V2 source shape
// { databaseId, contentId, revisionId, revisionNumber, snapshotSha256 }. Recomputes every snapshot hash
// with the same hashCurriculumSnapshot the factory uses. No database, no ledger writes.
//   npx tsx scripts/verify-first-ten-source-bindings.ts [extractDir] [--check]
import { readFileSync, writeFileSync } from "fs";
import { hashCurriculumSnapshot } from "@/lib/curriculum/provenance/hash";
import { LIBRARY_EXTRACT_DIR, loadLibraryExtract } from "@/lib/curriculum/modernization/extract";
import { FIRST_TEN_BINDINGS_FILE, FIRST_TEN_SPEC_FILE, type FirstTenSpec } from "@/lib/curriculum/modernization/firstTen";

const args = process.argv.slice(2);
const dir = args.find((arg) => !arg.startsWith("--")) ?? LIBRARY_EXTRACT_DIR;
const spec = JSON.parse(readFileSync(FIRST_TEN_SPEC_FILE, "utf8")) as FirstTenSpec;
const { manifest, records } = loadLibraryExtract(dir); // refuses a modified or incomplete extract
if (manifest.extractSha256 !== spec.basis.inventory.extractSha256) throw new Error(`extract ${manifest.extractSha256} is not the pinned ${spec.basis.inventory.extractSha256}`);

const byId = new Map(records.map((record) => [record.contentId, record]));
const bindings = spec.lessons.map((lesson) => {
  const record = byId.get(lesson.contentId);
  if (!record) throw new Error(`not in extract: ${lesson.contentId}`);
  const revision = record.revision as unknown as { id: string; sequence: number; snapshotSchemaVersion: number; contentHash: string; contentSnapshot: unknown };
  const recomputed = hashCurriculumSnapshot(revision.snapshotSchemaVersion, revision.contentSnapshot as never);
  const problems = [
    record.id !== lesson.contentPk && "databaseId",
    revision.id !== lesson.legacy.revisionId && "revisionId",
    revision.contentHash !== lesson.legacy.contentHash && "storedHash",
    recomputed !== lesson.legacy.contentHash && "recomputedHash",
    !record.verification.liveRowEqualsRevision && "liveRowDiffersFromRevision",
  ].filter(Boolean);
  if (problems.length) throw new Error(`${lesson.contentId}: ${problems.join(",")}`);
  return {
    key: lesson.key,
    source: { databaseId: record.id, contentId: record.contentId, revisionId: revision.id, revisionNumber: revision.sequence, snapshotSha256: recomputed },
    snapshotSchemaVersion: revision.snapshotSchemaVersion,
    liveRowEqualsRevision: true,
  };
});
const output = `${JSON.stringify({
  schemaVersion: "liberialearn-first-ten-source-bindings/1.0.0",
  notice: "Exact source bindings for the first-ten cohort, recomputed from the read-only extract. This is NOT a Content Factory ACCEPTED_READ_ONLY_EXPORT: that requires a separately authorized factory-production-capture/1.0.0 export with operator attestations.",
  extract: { sha256: manifest.extractSha256, capturedAt: manifest.capturedAt, target: manifest.target, transactionReadOnly: manifest.transactionReadOnly },
  hashFunction: "lib/curriculum/provenance/hash.ts hashCurriculumSnapshot (identical at 3e4ba71d and Content Factory d1f1826c)",
  bindings,
}, null, 2)}\n`;
if (args.includes("--check")) {
  if (readFileSync(FIRST_TEN_BINDINGS_FILE, "utf8") !== output) { console.error(`${FIRST_TEN_BINDINGS_FILE} is stale`); process.exit(1); }
  console.log(`${bindings.length} bindings verified; ${FIRST_TEN_BINDINGS_FILE} is current`);
} else {
  writeFileSync(FIRST_TEN_BINDINGS_FILE, output);
  console.log(`${bindings.length} bindings verified and written to ${FIRST_TEN_BINDINGS_FILE}`);
}
