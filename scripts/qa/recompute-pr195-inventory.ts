import fs from 'node:fs';
import assert from 'node:assert/strict';
import {loadLibraryExtract} from '@/lib/curriculum/modernization/extract';
import {hashCurriculumSnapshot} from '@/lib/curriculum/provenance/hash';
import {auditLegacyLesson, buildLibraryAuditContext} from '@/lib/curriculum/modernization/legacyAudit';
import {classifyLesson} from '@/lib/curriculum/modernization/classify';
import {evaluateG7Candidate, G7_NATIVE_LESSONS} from '@/lib/curriculum/v2/g7Native';
import {readLedgerFile} from '@/lib/curriculum/modernization/ledger';
const {manifest, records} = loadLibraryExtract(process.argv[2] || 'C:/liberia-learn/.worktrees/library-modernization-v1/artifacts/library-modernization-v1/extract');
const inventory = JSON.parse(fs.readFileSync('curriculum/modernization/v1/inventory.json', 'utf8'));
const context = buildLibraryAuditContext(records);
const counts: Record<string, number> = {};
const differences: unknown[] = [];
for (const record of records) {
  const revision = record.revision!;
  assert.equal(hashCurriculumSnapshot(revision.snapshotSchemaVersion, revision.contentSnapshot), revision.contentHash, record.contentId);
  assert.equal(record.verification.liveSnapshotHash, revision.contentHash, record.contentId);
  assert.equal(record.verification.liveRowEqualsRevision, true, record.contentId);
  const committed = inventory.lessons.find((x: any) => x.contentId === record.contentId);
  assert.equal(committed.revision.contentHash, revision.contentHash);
  const audit = auditLegacyLesson(record, context);
  const classification = classifyLesson(record, audit);
  counts[classification.track] = (counts[classification.track] || 0) + 1;
  if (classification.track !== committed.classification.track || audit.auditDigest !== committed.audit.auditDigest) differences.push({contentId: record.contentId, currentTrack: classification.track, committedTrack: committed.classification.track, auditMatches: audit.auditDigest === committed.audit.auditDigest});
}
const ledger = readLedgerFile('curriculum/modernization/v1/ledger/events.jsonl');
const nativeCandidates = G7_NATIVE_LESSONS.map(lesson => {
  const current = evaluateG7Candidate(lesson);
  const recorded = ledger.lessons.get(lesson.legacy.contentId)?.candidate;
  return {contentId: lesson.legacy.contentId, evaluatedHash: current.candidateSha256, ledgerHash: recorded?.candidateHash, matches: current.candidateSha256 === recorded?.candidateHash};
});
const result = {checkedAt: new Date().toISOString(), basis: 'LOCAL_2026_10_16_CAPTURE_NOT_LIVE_ATTESTATION', extractSha256: manifest.extractSha256, records: records.length, recomputedRevisionHashes: records.length, storedLiveEqualityAssertionsMatch: records.length, counts, differences, nativeCandidates};
fs.writeFileSync(process.argv[3] || 'artifacts/pr195-review/recomputed-inventory.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
if (differences.length) process.exitCode = 1;
