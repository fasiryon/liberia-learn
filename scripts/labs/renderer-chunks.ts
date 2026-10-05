// RX-005 A8 / RX-005g: measure the renderer chunks every HIGH/STANDARD and LOW device downloads. Each renderer entry is
// bundled the way the player imports it (tree-shaken, minified, React and Next external) and sized as stored
// (minified) and as transferred (gzip, brotli). The `three` share is the difference between bundling with and
// without `three` external. Used by scripts/labs/measure-renderer-chunks.ts and the CI size gate.
import { brotliCompressSync, constants, gzipSync } from "node:zlib";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { build } from "esbuild";

export type ChunkSize = { storageBytes: number; gzipBytes: number; transferBytes: number };
export type RendererChunk = ChunkSize & { entry: string; three?: ChunkSize };
export type RendererChunks = { tool: string; three: string; chunks: { threeRenderer: RendererChunk; webglPass: RendererChunk } };

export const RENDERER_ENTRIES = {
  threeRenderer: "components/interactive-labs/v2/ThreeScene.tsx",
  webglPass: "components/interactive-labs/v2/WebGLScene.tsx",
} as const;

function size(code: Uint8Array): ChunkSize {
  return {
    storageBytes: code.byteLength,
    gzipBytes: gzipSync(code, { level: 9 }).byteLength,
    transferBytes: brotliCompressSync(code, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).byteLength,
  };
}

async function bundle(root: string, entry: string, externalThree: boolean): Promise<Uint8Array> {
  const result = await build({
    absWorkingDir: root, entryPoints: [path.join(root, entry)], bundle: true, minify: true, treeShaking: true, write: false,
    format: "esm", platform: "browser", target: "es2020", jsx: "automatic", logLevel: "silent", legalComments: "none",
    tsconfig: path.join(root, "tsconfig.json"), define: { "process.env.NODE_ENV": '"production"' },
    external: ["react", "react-dom", "react/jsx-runtime", "next", "next/*", ...(externalThree ? ["three"] : [])],
  });
  return result.outputFiles[0].contents;
}

const minus = (a: ChunkSize, b: ChunkSize): ChunkSize => ({ storageBytes: a.storageBytes - b.storageBytes, gzipBytes: a.gzipBytes - b.gzipBytes, transferBytes: a.transferBytes - b.transferBytes });

export async function measureRendererChunks(root: string): Promise<RendererChunks> {
  const esbuildVersion = (await import("esbuild")).version;
  // `three` does not export its package.json; read it from the package root beside the resolved entry.
  let threeRoot = path.dirname(createRequire(path.join(root, "package.json")).resolve("three"));
  while (!existsSync(path.join(threeRoot, "package.json"))) threeRoot = path.dirname(threeRoot);
  const threeVersion = (JSON.parse(readFileSync(path.join(threeRoot, "package.json"), "utf8")) as { version: string }).version;
  const withThree = size(await bundle(root, RENDERER_ENTRIES.threeRenderer, false));
  const adapterOnly = size(await bundle(root, RENDERER_ENTRIES.threeRenderer, true));
  const webglPass = size(await bundle(root, RENDERER_ENTRIES.webglPass, false));
  return {
    tool: `esbuild ${esbuildVersion} (minify, tree-shaken, es2020; gzip level 9, brotli q11)`,
    three: String(threeVersion),
    chunks: {
      threeRenderer: { entry: RENDERER_ENTRIES.threeRenderer, ...withThree, three: minus(withThree, adapterOnly) },
      webglPass: { entry: RENDERER_ENTRIES.webglPass, ...webglPass },
    },
  };
}

/** A8 size gate: a chunk may not grow more than the tolerance over the committed measurement. */
export function checkRendererChunks(measured: RendererChunks, committed: RendererChunks, tolerance = 0.05): string[] {
  const problems: string[] = [];
  if (measured.three !== committed.three) problems.push(`three version ${measured.three} differs from the measured ${committed.three}; re-measure the renderer chunks.`);
  for (const key of Object.keys(committed.chunks) as (keyof RendererChunks["chunks"])[]) {
    for (const field of ["storageBytes", "transferBytes"] as const) {
      const before = committed.chunks[key][field], now = measured.chunks[key][field];
      if (now > Math.ceil(before * (1 + tolerance))) problems.push(`${key} ${field} grew from ${before} to ${now} (> ${tolerance * 100}%). Re-measure with a reviewed reason.`);
    }
  }
  return problems;
}
