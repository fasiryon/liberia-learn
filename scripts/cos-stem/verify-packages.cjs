#!/usr/bin/env node
/**
 * Verify factory batches independently (CoS evidence): recomputed package hashes, per-file digests and
 * text integrity for every package in each batch's generation receipt.
 *
 *   node scripts/cos-stem/verify-packages.cjs <drafts/<version> dir> [...]
 *
 * Writes curriculum/program/stem-v1/package-integrity.json (results accumulate per version). Read-only on
 * factory output. Exit 1 if any package fails.
 */
const fs = require("fs");
const path = require("path");
const { verifyPackage } = require("./lib/package-integrity.cjs");

const ROOT = path.resolve(__dirname, "../..");
const OUT = path.join(ROOT, "curriculum/program/stem-v1/package-integrity.json");
const prior = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")).batches : [];
const batches = [];
let failed = 0;
for (const dir of process.argv.slice(2)) {
  const receipt = JSON.parse(fs.readFileSync(path.join(dir, "generation-receipt.json"), "utf8"));
  const packages = receipt.packages.map((r) => {
    const v = verifyPackage(path.join(dir, r.key));
    const errors = [...v.errors];
    if (v.manifest.packageHash !== r.packageHash) errors.push("receipt packageHash differs from manifest");
    if (v.manifest.candidateSha256 !== r.candidateSha256) errors.push("receipt candidateSha256 differs from manifest");
    if (v.manifest.key !== r.key) errors.push("manifest key differs from receipt key");
    if (errors.length) failed += 1;
    return { key: r.key, packageHash: r.packageHash, recomputed: v.recomputedPackageHash, files: Object.keys(v.manifest.files ?? {}).length, ok: errors.length === 0, errors };
  });
  batches.push({ version: receipt.version, packages: packages.length, passed: packages.filter((p) => p.ok).length, results: packages });
}
const merged = [...prior.filter((b) => !batches.some((x) => x.version === b.version)), ...batches].sort((a, b) => a.version.localeCompare(b.version));
fs.writeFileSync(OUT, JSON.stringify({ generatedBy: "scripts/cos-stem/verify-packages.cjs", batches: merged }, null, 2) + "\n");
for (const b of batches) {
  console.log(`${b.version}: ${b.passed}/${b.packages} packages pass`);
  for (const p of b.results.filter((x) => !x.ok)) console.log(`  FAIL ${p.key}: ${p.errors.slice(0, 3).join("; ")}${p.errors.length > 3 ? ` (+${p.errors.length - 3})` : ""}`);
}
process.exit(failed ? 1 : 0);
