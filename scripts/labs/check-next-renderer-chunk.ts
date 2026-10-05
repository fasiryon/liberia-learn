/**
 * RX-005 A8: confirm the esbuild renderer-chunk record against real `next build` output. Run after `npm run build`.
 * Finds the built chunks that carry three.js and fails if they exceed the recorded esbuild measurement by more than
 * the webpack allowance (module wrappers, runtime glue), or if no such chunk exists.
 *
 *   npx tsx scripts/labs/check-next-renderer-chunk.ts [--allowance 0.15]
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { brotliCompressSync, constants } from "node:zlib";
import { isThreeChunk } from "../../lib/interactive-labs/v2/review/rendererChunks";
import type { RendererChunks } from "./renderer-chunks";

const allowanceIndex = process.argv.indexOf("--allowance");
const allowance = allowanceIndex > 0 ? Number(process.argv[allowanceIndex + 1]) : 0.15;
const record = JSON.parse(readFileSync(path.join("lib", "interactive-labs", "v2", "production", "renderer-chunks.json"), "utf8")) as RendererChunks;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => { const file = path.join(dir, name); return statSync(file).isDirectory() ? walk(file) : file.endsWith(".js") ? [file] : []; });
}

const chunks = walk(path.join(".next", "static", "chunks")).filter((file) => isThreeChunk(file.split(path.sep).join("/"), readFileSync(file, "utf8")));
if (!chunks.length) { console.error("No built chunk carries three.js; the HIGH renderer is missing from the build."); process.exit(1); }
const bytes = chunks.map((file) => readFileSync(file));
const storageBytes = bytes.reduce((sum, data) => sum + data.byteLength, 0);
const transferBytes = bytes.reduce((sum, data) => sum + brotliCompressSync(data, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).byteLength, 0);
const recorded = record.chunks.threeRenderer;
const report = { chunks: chunks.map((file) => path.relative(".next", file).split(path.sep).join("/")), next: { storageBytes, transferBytes }, esbuild: { storageBytes: recorded.storageBytes, transferBytes: recorded.transferBytes }, allowance };
console.log(JSON.stringify(report, null, 2));
const limit = (value: number) => Math.ceil(value * (1 + allowance));
if (storageBytes > limit(recorded.storageBytes) || transferBytes > limit(recorded.transferBytes)) {
  console.error(`next build three.js chunks (${storageBytes} B stored, ${transferBytes} B brotli) exceed the esbuild record + ${allowance * 100}%.`);
  process.exit(1);
}
