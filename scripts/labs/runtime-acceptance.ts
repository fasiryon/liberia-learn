/**
 * RX-005 A5 runtime acceptance in real Chromium, against the dev-only /lab-review harness (local dev server only).
 *
 * Remount loop: the player (and its renderer) is unmounted and mounted 20 times. It passes only when
 * - exactly one renderer is live afterwards (ThreeScene disposes and force-loses its context; WebGLScene loses its own),
 * - Chromium never warns about too many WebGL contexts or a lost context,
 * - every mount's renderer.info.memory (three.js) equals the first mount's, and
 * - the gc'd JS heap grows by less than 8 MB over the loop (recorded; the heap is not a GPU leak proof on its own).
 *
 *   npx tsx scripts/labs/runtime-acceptance.ts --lab mount-coffee-hydropower --profiles HIGH,LOW [--mounts 20]
 */
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium, type Page } from "@playwright/test";
import { getInteractiveLabDefinition } from "../../lib/interactive-labs/v2/registry";
import { getLabReviewScenarioSet } from "../../lib/interactive-labs/v2/review/referenceScenarios";
import type { FrameProbeResult } from "../../lib/interactive-labs/v2/review/framePlanEvidence";
import type { CapabilityProfile } from "../../lib/interactive-labs/v2/types";

const arg = (name: string) => { const index = process.argv.indexOf(`--${name}`); return index >= 0 ? process.argv[index + 1] : undefined; };
const HEAP_GROWTH_LIMIT_MB = 8;
const CONTEXT_WARNING = /too many active webgl contexts|context lost|CONTEXT_LOST_WEBGL/i;

type ReviewWindow = Window & { __labReviewRemount?: () => number; __labReviewLiveRenderers?: number; __labReviewFrameProbe?: () => FrameProbeResult | null; gc?: () => void };

async function waitForScene(page: Page) {
  await page.waitForFunction(() => {
    const scope = document.querySelector("[data-lab-review-ready]");
    return !!scope?.querySelector("[data-lab-scene-ready]") && !scope.querySelector("[data-lab-loading-veil]");
  }, null, { timeout: 120_000 });
}

async function heapMB(page: Page): Promise<number | null> {
  return page.evaluate(async () => {
    const reviewWindow = window as ReviewWindow;
    for (let pass = 0; pass < 3; pass += 1) { reviewWindow.gc?.(); await new Promise((resolve) => setTimeout(resolve, 50)); }
    const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
    return memory ? Math.round(memory.usedJSHeapSize / 1e4) / 100 : null;
  });
}

async function remountLoop(page: Page, profile: CapabilityProfile, mounts: number) {
  const warnings: string[] = [];
  page.on("console", (message) => { if (CONTEXT_WARNING.test(message.text())) warnings.push(message.text().slice(0, 300)); });
  await waitForScene(page);
  const memory = async () => (await page.evaluate(() => (window as ReviewWindow).__labReviewFrameProbe?.() ?? null))?.memory ?? null;
  const first = await memory();
  const heapBefore = await heapMB(page);
  const perMount: { mount: number; live: number | null; memory: { geometries: number; textures: number } | null }[] = [];
  for (let mount = 1; mount <= mounts; mount += 1) {
    await page.evaluate(() => (window as ReviewWindow).__labReviewRemount?.());
    await page.waitForTimeout(100);
    await waitForScene(page);
    perMount.push({ mount, live: await page.evaluate(() => (window as ReviewWindow).__labReviewLiveRenderers ?? null), memory: await memory() });
  }
  await page.waitForTimeout(500);
  const live = await page.evaluate(() => (window as ReviewWindow).__labReviewLiveRenderers ?? null);
  const heapAfter = await heapMB(page);
  const heapGrowthMB = heapBefore !== null && heapAfter !== null ? Math.round((heapAfter - heapBefore) * 100) / 100 : null;
  const memoryStable = profile === "LOW" || perMount.every((entry) => JSON.stringify(entry.memory) === JSON.stringify(first));
  const problems = [
    ...(live === 1 ? [] : [`live renderers after ${mounts} remounts: ${live} (expected 1)`]),
    ...(warnings.length ? [`context warnings: ${warnings.length}`] : []),
    ...(memoryStable ? [] : ["renderer.info.memory differs from the first mount"]),
    ...(heapGrowthMB !== null && heapGrowthMB > HEAP_GROWTH_LIMIT_MB ? [`JS heap grew ${heapGrowthMB} MB`] : []),
  ];
  return { profile, mounts, ok: problems.length === 0, problems, live, warnings, firstMountMemory: first, perMount, heapBeforeMB: heapBefore, heapAfterMB: heapAfter, heapGrowthMB };
}

async function main() {
  const labId = arg("lab") ?? "mount-coffee-hydropower";
  const profiles = (arg("profiles") ?? "HIGH,LOW").split(",") as CapabilityProfile[];
  const mounts = Number(arg("mounts") ?? 20);
  const baseUrl = arg("base-url") ?? "http://localhost:3000";
  if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(baseUrl)) throw new Error("The review harness only runs against a local dev server.");
  const definition = getInteractiveLabDefinition(labId);
  const scenario = getLabReviewScenarioSet(labId)?.scenarios[0];
  if (!definition || !scenario) throw new Error(`No definition or review scenario for ${labId}.`);
  const out = arg("out") ?? path.join("artifacts", "lab-review", labId, definition.version, "runtime-acceptance");
  mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--js-flags=--expose-gc", "--enable-precise-memory-info"] });
  const results: Record<string, unknown>[] = [];
  try {
    for (const profile of profiles) {
      const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
      await context.addInitScript(`try { localStorage.setItem("liberialearn_session_cookie_notice_dismissed", "true"); } catch (e) {}`);
      const page = await context.newPage();
      const pageErrors: string[] = [];
      page.on("pageerror", (error) => pageErrors.push(error.message.slice(0, 300)));
      try {
        await page.goto(`${baseUrl}/lab-review/${encodeURIComponent(labId)}?scenario=${encodeURIComponent(scenario.id)}&profile=${profile}`, { waitUntil: "domcontentloaded", timeout: 180_000 });
        const result = await remountLoop(page, profile, mounts);
        results.push({ test: "remount-loop", ...result, pageErrors, ok: result.ok && pageErrors.length === 0 });
      } catch (cause) {
        results.push({ test: "remount-loop", profile, ok: false, error: cause instanceof Error ? cause.message.slice(0, 600) : String(cause), pageErrors });
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
    const sha = (() => { try { return execSync("git rev-parse HEAD", { encoding: "utf8" }).trim(); } catch { return process.env.GITHUB_SHA ?? "unknown"; } })();
    writeFileSync(path.join(out, "runtime-acceptance.json"), JSON.stringify({ labId, labVersion: definition.version, gitSha: sha, environment: "headless Chromium, SwiftShader WebGL", results,
      boundary: "Software-GL lifecycle evidence: renderer disposal, context release and memory stability. Not a device performance or GPU-memory measurement." }, null, 2));
  }
  const failed = results.filter((result) => !result.ok);
  console.log(`Runtime acceptance ${labId}: ${results.length - failed.length}/${results.length} passed.`);
  for (const result of failed) console.error(JSON.stringify(result).slice(0, 800));
  if (failed.length) process.exitCode = 1;
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
