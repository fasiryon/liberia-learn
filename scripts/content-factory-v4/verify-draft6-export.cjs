const fs = require("node:fs"), crypto = require("node:crypto"), JSZip = require("jszip");
const sha = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
(async () => {
  const receipt = JSON.parse(fs.readFileSync("artifacts/draft6-academic-review/export-receipt.json", "utf8"));
  const bytes = fs.readFileSync(receipt.archive);
  if (sha(bytes) !== receipt.sha256 || bytes.length !== receipt.bytes) throw Error("archive_identity_mismatch");
  const zip = await JSZip.loadAsync(bytes, { checkCRC32: true });
  const entries = Object.values(zip.files).filter(entry => !entry.dir);
  if (entries.length !== receipt.entries || entries.length !== Object.keys(receipt.files).length) throw Error("archive_inventory_mismatch");
  for (const entry of entries) {
    const contents = await entry.async("nodebuffer");
    if (sha(contents) !== receipt.files[entry.name]) throw Error(`archive_entry_hash:${entry.name}`);
    if (entry.name !== "README.txt" && sha(fs.readFileSync(entry.name)) !== receipt.files[entry.name]) throw Error(`repository_export_divergence:${entry.name}`);
  }
  console.log(JSON.stringify({ archive: receipt.archive, sha256: sha(bytes), bytes: bytes.length, entries: entries.length,
    crc: "PASS", everyEntryAndRepositoryBytes: "PASS", version: receipt.version, sourceCommit: receipt.sourceCommit }, null, 2));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
