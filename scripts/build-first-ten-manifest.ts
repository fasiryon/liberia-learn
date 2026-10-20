// Writes curriculum/modernization/v1/first-ten/manifest.json: the SHA-256 of every file in the first-ten
// contract, so an owner approval can name one manifest hash. --check exits non-zero when it is stale.
import { readFileSync, writeFileSync } from "fs";
import { createHash } from "crypto";
import { buildFirstTenManifest, FIRST_TEN_MANIFEST_FILE, FIRST_TEN_SPEC_FILE } from "@/lib/curriculum/modernization/firstTen";

const sha256 = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const manifest = buildFirstTenManifest((path) => readFileSync(path), JSON.parse(readFileSync(FIRST_TEN_SPEC_FILE, "utf8")), sha256);
const output = `${JSON.stringify(manifest, null, 2)}\n`;
if (process.argv.includes("--check")) {
  if (readFileSync(FIRST_TEN_MANIFEST_FILE, "utf8") !== output) { console.error(`${FIRST_TEN_MANIFEST_FILE} is stale`); process.exit(1); }
  console.log(`${FIRST_TEN_MANIFEST_FILE} is current (sha256 ${sha256(Buffer.from(output))})`);
} else {
  writeFileSync(FIRST_TEN_MANIFEST_FILE, output);
  console.log(`wrote ${FIRST_TEN_MANIFEST_FILE} (sha256 ${sha256(Buffer.from(output))})`);
}
