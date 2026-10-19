/**
 * Writes the Grade 7 Native Curriculum V1 review package. `--check` exits 1 when committed files
 * differ from a fresh build. Read-only against curriculum authority: it never approves, publishes
 * or persists lessons, and never touches the legacy rows the candidates may replace.
 */
import fs from "fs";
import path from "path";
import { buildG7NativePackageFiles, G7_PACKAGE_DIR } from "@/lib/curriculum/v2/g7NativePackage";

const files = buildG7NativePackageFiles();
if (process.argv.includes("--check")) {
  const stale = [...files.entries()].filter(([name, text]) => !fs.existsSync(path.join(G7_PACKAGE_DIR, name)) || fs.readFileSync(path.join(G7_PACKAGE_DIR, name), "utf8") !== text);
  if (stale.length) { console.error(`review package stale: ${stale.map(([name]) => name).join(", ")}`); process.exit(1); }
  console.log("review package matches a fresh build");
} else {
  for (const [name, text] of files) {
    fs.mkdirSync(path.dirname(path.join(G7_PACKAGE_DIR, name)), { recursive: true });
    fs.writeFileSync(path.join(G7_PACKAGE_DIR, name), text);
  }
  console.log(JSON.stringify({ out: G7_PACKAGE_DIR, files: [...files.keys()] }));
}
