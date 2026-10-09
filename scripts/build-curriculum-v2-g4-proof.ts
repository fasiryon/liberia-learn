/**
 * Writes the Grade 4 Math Curriculum V2 review package. `--check` exits 1 when committed files
 * differ from a fresh build. Read-only against curriculum authority: it never approves, publishes
 * or persists lessons.
 */
import fs from "fs";
import path from "path";
import { buildG4ProofPackageFiles, G4_PROOF_PACKAGE_DIR } from "@/lib/curriculum/v2/g4ProofPackage";

const files = buildG4ProofPackageFiles();
if (process.argv.includes("--check")) {
  const stale = [...files.entries()].filter(([name, text]) => !fs.existsSync(path.join(G4_PROOF_PACKAGE_DIR, name)) || fs.readFileSync(path.join(G4_PROOF_PACKAGE_DIR, name), "utf8") !== text);
  if (stale.length) { console.error(`review package stale: ${stale.map(([name]) => name).join(", ")}`); process.exit(1); }
  console.log("review package matches a fresh build");
} else {
  for (const [name, text] of files) {
    fs.mkdirSync(path.dirname(path.join(G4_PROOF_PACKAGE_DIR, name)), { recursive: true });
    fs.writeFileSync(path.join(G4_PROOF_PACKAGE_DIR, name), text);
  }
  console.log(JSON.stringify({ out: G4_PROOF_PACKAGE_DIR, files: [...files.keys()] }));
}
