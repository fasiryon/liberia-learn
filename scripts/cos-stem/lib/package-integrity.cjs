/**
 * Independent package integrity check (CoS). Recomputes what a factory manifest claims instead of trusting it:
 *  - every file listed in manifest.files is present and its bytes hash to the listed SHA-256;
 *  - packageHash equals sha256(canonicalizeJson({ domain: manifestVersion, value: manifest minus packageHash })),
 *    the derivation in lib/content-factory/v2/blueprint.ts `digest` with lib/curriculum/provenance/hash.ts
 *    `canonicalizeJson` (mirrored here exactly);
 *  - every text file is strict UTF-8 with none of the UTF-8-as-Windows-1252 corruption patterns that
 *    lib/content-factory/v4/textIntegrity.ts (T2) rejects.
 */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

function toCanonical(value) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") { if (!Number.isFinite(value)) throw new Error("non-finite number"); return value; }
  if (Array.isArray(value)) return value.map(toCanonical);
  if (typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value).sort()) if (value[key] !== undefined) out[key] = toCanonical(value[key]);
    return out;
  }
  throw new Error(`unsupported value: ${typeof value}`);
}
const canonicalizeJson = (v) => JSON.stringify(toCanonical(v));
const sha256 = (data) => crypto.createHash("sha256").update(data).digest("hex");
const CORRUPT = /�|â(?:€|ˆ|[\u0080-¿])|Ã[\u0080-¿–—œš]|Â[\u0080-¿]|ï»¿/u;
const TEXT = /\.(json|txt|svg|md)$/i;

function verifyPackage(packageDir) {
  const errors = [];
  const manifest = JSON.parse(fs.readFileSync(path.join(packageDir, "manifest.json"), "utf8"));
  const { packageHash, ...body } = manifest;
  const recomputed = sha256(canonicalizeJson({ domain: manifest.manifestVersion, value: body }));
  if (recomputed !== packageHash) errors.push(`packageHash ${packageHash} does not recompute (got ${recomputed})`);
  const files = manifest.files ?? {};
  if (!Object.keys(files).length) errors.push("manifest lists no files");
  for (const [name, expected] of Object.entries(files)) {
    const file = path.join(packageDir, name);
    if (!fs.existsSync(file)) { errors.push(`${name} is listed but missing`); continue; }
    const bytes = fs.readFileSync(file);
    if (sha256(bytes) !== expected) errors.push(`${name} bytes do not match the manifest digest`);
    if (TEXT.test(name)) {
      let text;
      try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { errors.push(`${name} is not valid UTF-8`); continue; }
      const m = text.match(CORRUPT);
      if (m) errors.push(`${name} contains mis-decoded text near "${text.slice(Math.max(0, m.index - 20), m.index + 10)}"`);
    }
  }
  return { key: manifest.key, manifest, recomputedPackageHash: recomputed, ok: errors.length === 0, errors };
}

module.exports = { verifyPackage, canonicalizeJson, sha256, CORRUPT };
