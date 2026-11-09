/**
 * One registry of every factory package the program may bind (CoS).
 *
 * Sources: source/draft6-pins.json, source/schoolday-pins.json, and one source/batches/<version>.json per
 * sealed batch written by scripts/cos-stem/intake-batch.cjs. A package enters only by exact version, key,
 * package hash and candidate hash. Batch files also carry the factory validation evidence and any T2 hold.
 */
const fs = require("fs");
const path = require("path");

function loadBatches(programDir) {
  const src = path.join(programDir, "source");
  const files = ["draft6-pins.json", "schoolday-pins.json"].map((f) => path.join(src, f));
  const batchDir = path.join(src, "batches");
  if (fs.existsSync(batchDir)) for (const f of fs.readdirSync(batchDir).filter((x) => x.endsWith(".json")).sort()) files.push(path.join(batchDir, f));
  return files.map((file) => {
    const b = JSON.parse(fs.readFileSync(file, "utf8"));
    return { file: path.relative(programDir, file).replace(/\\/g, "/"), version: b.version, state: b.state, commit: b.commit ?? null, factoryValidation: b.factoryValidation ?? null, hold: b.hold ?? null, packages: b.packages };
  });
}

/** Flat list of packages, each carrying its batch's version, state, validation and hold. */
function loadPackages(programDir) {
  const out = [];
  for (const b of loadBatches(programDir)) {
    for (const p of b.packages) out.push({ ...p, version: b.version, batchState: b.state, batchCommit: b.commit, factoryValidation: b.factoryValidation, hold: b.hold });
  }
  const seen = new Set();
  for (const p of out) {
    const id = `${p.version}@${p.key}`;
    if (seen.has(id)) throw new Error(`package pinned twice: ${id}`);
    seen.add(id);
  }
  return out;
}

module.exports = { loadBatches, loadPackages };
