import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import { describe, expect, it } from "vitest";
import { checkRendererChunks, measureRendererChunks, type RendererChunks } from "@/scripts/labs/renderer-chunks";
import { rendererPackage } from "@/lib/interactive-labs/v2/production/budgets";
import { isThreeChunk } from "@/lib/interactive-labs/v2/review/rendererChunks";

const root = process.cwd();
const committed = JSON.parse(readFileSync(path.join(root, "lib/interactive-labs/v2/production/renderer-chunks.json"), "utf8")) as RendererChunks;

/** ThreeScene and its private modules: the only files allowed to import `three` as a value. */
const THREE_MODULES = new Set([
  "components/interactive-labs/v2/ThreeScene.tsx",
  "components/interactive-labs/v2/threeEnvironment.ts",
  "components/interactive-labs/v2/threeSurfaces.ts",
  "components/interactive-labs/v2/threeSceneSync.ts",
]);

describe("RX-005 A8: renderer chunk accounting", () => {
  it("pins three to an exact version and matches the measured record", () => {
    const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")) as { dependencies: Record<string, string> };
    expect(pkg.dependencies.three).toMatch(/^\d+\.\d+\.\d+$/);
    expect(committed.three).toBe(pkg.dependencies.three);
  });

  it("does not let a renderer chunk grow more than 5% over the record (CI size gate)", async () => {
    const measured = await measureRendererChunks(root);
    expect(checkRendererChunks(measured, committed)).toEqual([]);
    // three is the bulk of the HIGH chunk and never part of the LOW chunk.
    expect(measured.chunks.threeRenderer.three!.storageBytes).toBeGreaterThan(400_000);
    expect(measured.chunks.webglPass.storageBytes).toBeLessThan(100_000);
  }, 120_000);

  it("charges the three chunk to HIGH/STANDARD only", () => {
    expect(rendererPackage("HIGH").storageBytes).toBe(committed.chunks.threeRenderer.storageBytes + committed.chunks.webglPass.storageBytes);
    expect(rendererPackage("STANDARD")).toEqual(rendererPackage("HIGH"));
    expect(rendererPackage("LOW").storageBytes).toBe(committed.chunks.webglPass.storageBytes);
    expect(rendererPackage("FALLBACK_2D")).toEqual({ storageBytes: 0, transferBytes: 0 });
    expect(rendererPackage("HIGH").transferBytes).toBeLessThan(rendererPackage("HIGH").storageBytes);
  });
});

describe("RX-005 A8: three chunk detection for LOW/FALLBACK_2D captures", () => {
  const bundleOf = async (entry: string) => (await build({ absWorkingDir: root, entryPoints: [path.join(root, entry)], bundle: true, minify: true, write: false, format: "esm", platform: "browser", jsx: "automatic", logLevel: "silent", tsconfig: path.join(root, "tsconfig.json"), external: ["react", "react-dom", "react/jsx-runtime", "next", "next/*"] })).outputFiles[0].text;
  it("recognises a minified three.js chunk and never the LOW or 2D renderer", async () => {
    expect(isThreeChunk("/_next/static/chunks/8123.js", await bundleOf("components/interactive-labs/v2/ThreeScene.tsx"))).toBe(true);
    expect(isThreeChunk("/_next/static/chunks/8124.js", await bundleOf("components/interactive-labs/v2/WebGLScene.tsx"))).toBe(false);
    expect(isThreeChunk("/_next/static/chunks/8125.js", await bundleOf("components/interactive-labs/v2/Fallback2D.tsx"))).toBe(false);
  }, 120_000);
  it("recognises dev chunks by their module path", () => {
    expect(isThreeChunk("http://localhost:3000/_next/static/chunks/_app-pages-browser_node_modules_three_build_three_module_js.js", "")).toBe(true);
    expect(isThreeChunk("http://localhost:3000/_next/static/chunks/app/lab-review/page.js", "/***/ \"(app-pages-browser)/./node_modules/three/build/three.core.js\"")).toBe(true);
    expect(isThreeChunk("http://localhost:3000/_next/static/chunks/app/lab-review/page.js", "WebGLScene")).toBe(false);
  });
});

describe("RX-005 A8: import graph", () => {
  it("imports three as a value only in ThreeScene and its private modules", () => {
    const files = execFileSync("git", ["ls-files", "--", "*.ts", "*.tsx"], { cwd: root, encoding: "utf8" }).split("\n").filter((file) => file && !file.startsWith("__tests__/") && !file.includes("/node_modules/"));
    expect(files.length).toBeGreaterThan(500);
    const valueImport = /(^|\n)\s*import\s+(?!type\b)[^;]*?\bfrom\s+["']three(\/[^"']*)?["']|\bimport\(\s*["']three(\/[^"']*)?["']\s*\)|\brequire\(\s*["']three["']\s*\)/;
    const importers = files.filter((file) => valueImport.test(readFileSync(path.join(root, file), "utf8")));
    expect(importers.filter((file) => !THREE_MODULES.has(file))).toEqual([]);
    expect(importers.sort()).toEqual([...THREE_MODULES].sort());
    expect(valueImport.test('import type { Mesh } from "three";')).toBe(false);
  });

  it("keeps three out of the player's static import closure (only the dynamic ThreeScene chunk reaches it)", async () => {
    const result = await build({
      absWorkingDir: root, entryPoints: [path.join(root, "components/interactive-labs/v2/InteractiveLabPlayer.tsx")], bundle: true, splitting: true, format: "esm", outdir: path.join(root, ".tmp-import-graph"),
      write: false, metafile: true, platform: "browser", jsx: "automatic", logLevel: "silent", tsconfig: path.join(root, "tsconfig.json"),
      external: ["react", "react-dom", "react/jsx-runtime", "next", "next/*", "three"],
    });
    const outputs = result.metafile.outputs;
    const entry = Object.keys(outputs).find((file) => outputs[file].entryPoint);
    expect(entry).toBeDefined();
    const reached = new Set<string>(), queue = [entry!];
    let reachesThree = false;
    while (queue.length) {
      const file = queue.pop()!;
      if (reached.has(file)) continue;
      reached.add(file);
      for (const imported of outputs[file]?.imports ?? []) {
        if (imported.kind !== "import-statement") continue;
        if (imported.path === "three") reachesThree = true;
        else if (outputs[imported.path]) queue.push(imported.path);
      }
    }
    expect(reachesThree).toBe(false);
    // ...while the dynamically imported ThreeScene chunk does import three.
    expect(Object.values(outputs).some((output) => output.imports.some((imported) => imported.path === "three"))).toBe(true);
  }, 120_000);
});
