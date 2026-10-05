/**
 * Writes lib/interactive-labs/v2/production/renderer-chunks.json (RX-005 A8). Run only when a renderer chunk change
 * is intended and reviewed; CI fails when a chunk grows more than 5% over this record.
 *
 *   npx tsx scripts/labs/measure-renderer-chunks.ts
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { measureRendererChunks } from "./renderer-chunks";

measureRendererChunks(process.cwd()).then((measured) => {
  writeFileSync(path.join("lib", "interactive-labs", "v2", "production", "renderer-chunks.json"), JSON.stringify(measured, null, 2) + "\n");
  console.log(JSON.stringify(measured, null, 2));
}).catch((error) => { console.error(error); process.exit(1); });
