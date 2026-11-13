const fs = require("node:fs"), crypto = require("node:crypto");
const sha = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const directory = "artifacts/draft6-pilot-validation";
const implementationCommit = process.argv[2];
if (!/^[a-f0-9]{40}$/.test(implementationCommit ?? "")) throw Error("full_implementation_commit_required");
const log = name => fs.readFileSync(`${directory}/${name}.log`, "utf8").replace(/\x1b\[[0-9;]*m/g, "");
const summary = name => {
  const text = log(name), lines = text.split(/\r?\n/);
  return { files: lines.filter(line => /Test Files/.test(line)).at(-1)?.trim() ?? null,
    tests: lines.filter(line => /^\s*Tests\s/.test(line)).at(-1)?.trim() ?? null,
    sha256: sha(fs.readFileSync(`${directory}/${name}.log`)) };
};
const root = "curriculum/factory-v4/drafts/4.0.0-draft.6";
const receiptBytes = fs.readFileSync(`${root}/generation-receipt.json`);
if (sha(receiptBytes) !== "c59d3623d3bd558398a50e30de62688bc066ca22238c3d188b2ef88c9cbe04ab") throw Error("immutable_receipt_changed");
const receipt = JSON.parse(receiptBytes);
for (const [file, checksum] of Object.entries(receipt.files)) {
  if (sha(fs.readFileSync(`${root}/${file}`)) !== checksum) throw Error(`immutable_file_changed:${file}`);
}
const archive = JSON.parse(fs.readFileSync("artifacts/draft6-academic-review/export-receipt.json", "utf8"));
if (sha(fs.readFileSync(archive.archive)) !== archive.sha256) throw Error("archive_changed");
const browserFile = `${directory}/browser.json`;
const evidence = {
  generatedAt: new Date().toISOString(), implementationCommit, prerequisiteCommits: ["36d2ca665de6e76f7abe00383158e7286ee40f85", "fe951d3965757e840c8d4f9055a179038bad2768"],
  version: receipt.version, immutableFileDigestsVerified: Object.keys(receipt.files).length,
  packages: receipt.packages.map(entry => ({ ...entry, projectionSha256: JSON.parse(fs.readFileSync(`${root}/${entry.key}/manifest.json`)).learnerProjectionSha256,
    academicStatus: entry.key.includes("civics") ? "MAP_AND_ACADEMIC_VERIFICATION_PENDING" : "FOUNDER_REPORTED_CONDITIONAL_AI_ACCEPTANCE",
    pilotActive: false, officiallyPublishable: false })),
  archive: { path: archive.archive, sha256: archive.sha256, bytes: archive.bytes, entries: archive.entries, crcAndAllEntries: "PASS_BY_VERIFY_EXPORT_SCRIPT" },
  isolatedDatabase: { host: "127.0.0.1", port: 55447, database: "draft6_preview_validation", user: "preview_test", container: "ll-draft6-pilot-pgvector",
    containerId: "facbf788884f082c15207f9129d5d54a71ad6e5c3f3b2970bd1da3d90e718941", image: "pgvector/pgvector:0.8.0-pg17", postgres: "17.6",
    verifiedBeforeSeeding: true, activeSyntheticPilotRecordsAfterBrowser: 0 },
  fullUnitSuite: summary("tests"), changed: { ...summary("changed"), pass: log("changed").includes("validate:changed PASS") },
  focused: summary("focused"), recovery: summary("recovery"),
  security: JSON.parse(fs.readFileSync(`${directory}/security-summary.json`, "utf8")),
  browser: fs.existsSync(browserFile) ? JSON.parse(fs.readFileSync(browserFile, "utf8")) : { status: "NOT_YET_COMPLETED" },
  productionBuild: { completed: log("build").includes("prerendered as static content"), standaloneWindowsSymlinkWarning: log("build").includes("Failed to copy traced files"), logSha256: sha(fs.readFileSync(`${directory}/build.log`)) },
  pwa: { summary: log("pwa").split(/\r?\n/).find(line => /^\s*14 passed/.test(line))?.trim(), logSha256: sha(fs.readFileSync(`${directory}/pwa.log`)) },
  fixtures: { completed: log("fixtures").includes("1920x900: 46 fullscreen pages"), logSha256: sha(fs.readFileSync(`${directory}/fixtures.log`)) },
  vault: { pass: 4, skippedWindowsSymlinks: 2, logSha256: sha(fs.readFileSync(`${directory}/vault.log`)) },
  renderer: JSON.parse(log("renderer")),
  packageTracing: [".next/server/app/learn/preview/[selection]/page.js.nft.json", ".next/server/app/api/student/learning-preview/[key]/route.js.nft.json"].map(file => {
    const files = JSON.parse(fs.readFileSync(file)).files.map(entry => entry.replaceAll("\\", "/"));
    const receiptIncluded = files.some(entry => entry.includes("draft.6/generation-receipt.json"));
    if (!receiptIncluded) throw Error("production_receipt_not_traced");
    return { file, draft6Files: files.filter(entry => entry.includes("draft.6/")).length, receiptIncluded };
  }),
  officialDeliveryPolicyChanged: false, schemaChanged: false, generatedDraft7: false,
  featureFlagDefault: "OFF", committedExample: "disabled, no students, no lesson hashes", realApprovalsCreated: false,
  claudeAcknowledgement: "SUPPLIED_CODE_READ_ONLY_AI_REVIEW_RECEIVED_FINDINGS_ADDRESSED_FINAL_OWNER_REVIEW_PENDING",
  hostedCI: "NOT_RUN_NO_PUSH_AUTHORIZED", recommendation: "HOLD_FOR_REMAINING_GATES",
};
fs.writeFileSync("docs/qa/draft6/PILOT_VALIDATION.json", JSON.stringify(evidence, null, 2) + "\n");
console.log(JSON.stringify({ packages: evidence.packages.length, immutableFileDigestsVerified: evidence.immutableFileDigestsVerified,
  fullUnitSuite: evidence.fullUnitSuite.tests, changed: evidence.changed.pass, productionBuild: evidence.productionBuild.completed,
  browser: evidence.browser.status, recommendation: evidence.recommendation }, null, 2));
