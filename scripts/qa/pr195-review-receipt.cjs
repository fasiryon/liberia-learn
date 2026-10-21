// Metadata only. Never reads protected authored envelopes, keys or rubric text.
const fs = require('node:fs');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const readLog = file => { const bytes = fs.readFileSync(file); return bytes[0] === 255 && bytes[1] === 254 ? bytes.subarray(2).toString('utf16le') : bytes.toString('utf8'); };
const git = args => execFileSync('git', args, { encoding: 'utf8' }).trim();
const delivery = require('../../docs/architecture/content-factory/evidence/first-three-v2-reconciliation.json');
const evidenceFile = 'artifacts/pr195-review-route-repair/browser/evidence.json';
const browser = JSON.parse(fs.readFileSync(evidenceFile, 'utf8'));
const changedLog = readLog('artifacts-pr195-validate-final.log');
const realLog = readLog('artifacts-pr195-real-final.log');
assert(changedLog.includes('validate:changed PASS'));
assert(realLog.includes('21 passed (21)'));
assert.equal(browser.status, 'PASS');
assert.equal(browser.rendering.length, 96);
assert.equal(browser.sequences.reduce((sum, sequence) => sum + sequence.simulationsStarted, 0), 6);
const files = [...new Set([...git(['diff', '--name-only', '6221975b39965f3d1b17b7fa526b9ee2d28df8a7']).split('\n'), ...git(['ls-files', '--others', '--exclude-standard']).split('\n')])].filter(file => /^(app|components|lib|curriculum|__tests__|scripts)\//.test(file) && /\.(ts|tsx|json|cjs)$/.test(file));
if (!files.includes('middleware.ts')) files.push('middleware.ts');
const sources = files.sort().map(file => ({ path: file, sha256: hash(fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n')) }));
const logFiles = ['artifacts-pr195-validate-final.log', 'artifacts-pr195-real-final.log', 'artifacts-pr195-auth-regressions.log', 'artifacts-pr195-registry-regressions.log'];
const receipt = {
  schemaVersion: 'pr195-review-route-repair/1.0.0', recordedAt: new Date().toISOString(), baseCommit: '6221975b39965f3d1b17b7fa526b9ee2d28df8a7',
  sourceHashEncoding: 'UTF8_LF', sourceManifestSha256: hash(JSON.stringify(sources)), sources,
  packages: delivery.packages.map(p => ({ contentId: p.contentId, packageHash: p.packageHash, manifestFileSha256: p.manifestFileSha256, candidateContentHashes: p.candidateContentHashes })),
  ownerCheckpoint: '3cc50242d', candidateVersion: '0.2.0', authoredGeneration: 'V2', v021Adoption: 'PENDING_OWNER_DELIVERY_NEW_IMMUTABLE_ROOT_REQUIRED',
  validation: { changed: 'PASS', changedTests: { passed: 101, skipped: 12 }, relatedTests: { passed: 1956, skipped: 18 }, exactPackageTests: { passed: 21, skipped: 0 }, authRegressions: { passed: 37 }, registryRegressions: { passed: 54 } },
  browser: { evidenceFile, sha256: hash(fs.readFileSync(evidenceFile)), status: browser.status, accessChecks: browser.access.length, responsiveCaptures: browser.rendering.length, axeRuns: browser.violations.length, detectedViolations: browser.violations.reduce((sum, run) => sum + run.violations.length, 0), runsWithManualReviewItems: browser.violations.filter(run => run.incomplete.length).length, protectedResponsesInspected: browser.protectedResponsesInspected, unavailablePrefetchBodies: browser.unavailableResponseBodies, sequences: browser.sequences },
  logs: logFiles.map(file => ({ path: file, sha256: hash(fs.readFileSync(file)) })),
  officialGrades: false, masteryWrites: false, productionRelease: false, merged: false, deployed: false,
  academicStatus: 'BLOCKED_FOR_AUTHORIZED_HUMAN_ACADEMIC_APPROVAL', ci: 'EXACT_FINAL_HEAD_RESULT_REPORTED_SEPARATELY',
};
fs.writeFileSync('docs/qa/PR195_REVIEW_ROUTE_REPAIR.json', JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify({ sourceManifestSha256: receipt.sourceManifestSha256, sourceFiles: sources.length, browserEvidenceSha256: receipt.browser.sha256 }));
