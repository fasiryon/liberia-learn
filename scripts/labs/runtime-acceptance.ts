/**
 * RX-005 A5 runtime acceptance in real Chromium, against the dev-only /lab-review harness (local dev server only).
 *
 * Remount loop: the player (and its renderer) is unmounted and mounted 20 times. It passes only when
 * - exactly one renderer is live afterwards (ThreeScene disposes and force-loses its context; WebGLScene loses its own),
 * - Chromium never warns about too many WebGL contexts or a lost context,
 * - every mount's renderer.info.memory (three.js) equals the first mount's, and
 * - the gc'd JS heap grows by less than 8 MB over the loop (recorded; the heap is not a GPU leak proof on its own).
 *
 * LOW buffer identity (RX-006 test 6, LOW only): after a warm-up pass through every learner-controlled variable's
 * values, a second identical pass must create no WebGL buffer and reallocate none (no bufferData); state-only changes
 * reach the GPU only as bufferSubData range updates.
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

type GlCounts = { create: number; data: number; sub: number; del: number };
type ReviewWindow = Window & { __glBuffers?: GlCounts; __labReview?: { dispatch: (action: unknown) => { ok: boolean; reason?: string } }; __labReviewRemount?: () => number; __labReviewLiveRenderers?: number; __labReviewFrameProbe?: () => FrameProbeResult | null; gc?: () => void };

async function waitForScene(page: Page) {
  const scope = page.locator("[data-lab-review-ready]");
  try {
    await scope.locator("[data-lab-scene-ready]").waitFor({ state: "attached", timeout: 120_000 });
    await scope.locator("[data-lab-loading-veil]").waitFor({ state: "detached", timeout: 120_000 });
  } catch (cause) {
    const state = await page.evaluate(() => {
      const player = document.querySelector("[data-lab-active-profile]");
      const renderer = document.querySelector("[data-lab-review-ready] [data-lab-renderer]");
      return { activeProfile: player?.getAttribute("data-lab-active-profile") ?? null, downgradePath: player?.getAttribute("data-lab-downgrade-path") ?? null,
        renderer: renderer?.getAttribute("data-lab-renderer") ?? null, sceneReady: !!document.querySelector("[data-lab-review-ready] [data-lab-scene-ready]"),
        loadingVeil: !!document.querySelector("[data-lab-review-ready] [data-lab-loading-veil]"), liveRenderers: (window as ReviewWindow).__labReviewLiveRenderers ?? null };
    }).catch(() => null);
    throw new Error(`scene readiness failed: ${JSON.stringify(state)}; ${cause instanceof Error ? cause.message : String(cause)}`);
  }
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

/** Counts buffer creation and (re)allocation on every WebGL context in the page. Installed before any script runs. */
const GL_BUFFER_COUNTER = `(() => {
  const counts = { create: 0, data: 0, sub: 0, del: 0 };
  window.__glBuffers = counts;
  for (const Ctx of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
    if (!Ctx) continue;
    const proto = Ctx.prototype;
    const wrap = (name, key) => { const original = proto[name]; proto[name] = function (...args) { counts[key] += 1; return original.apply(this, args); }; };
    wrap("createBuffer", "create"); wrap("bufferData", "data"); wrap("bufferSubData", "sub"); wrap("deleteBuffer", "del");
  }
})();`;

/** Every value of every learner-controlled variable, in order: the state-only toggles the LOW pass must absorb. */
function variableSweep(labId: string): { type: "set-variable"; variableId: string; value: number }[] {
  const spec = getInteractiveLabDefinition(labId)?.fidelity;
  if (!spec) return [];
  return spec.variables.filter((variable) => variable.learnerControlled).flatMap((variable) => {
    const values: number[] = [];
    for (let value = variable.min; value <= variable.max + 1e-9; value += variable.step) values.push(Number(value.toFixed(9)));
    return [...values, variable.initial].map((value) => ({ type: "set-variable" as const, variableId: variable.id, value }));
  });
}

async function lowBufferIdentity(page: Page, labId: string) {
  await waitForScene(page);
  const sweep = variableSweep(labId);
  const counts = () => page.evaluate(() => ({ ...(window as ReviewWindow).__glBuffers! }));
  const pass = async () => {
    let applied = 0;
    for (const action of sweep) {
      const result = await page.evaluate((next) => (window as ReviewWindow).__labReview?.dispatch(next) ?? { ok: false, reason: "no dispatcher" }, action);
      if (result.ok) applied += 1;
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(600);
    return applied;
  };
  const warmApplied = await pass();
  const before = await counts();
  const applied = await pass();
  const after = await counts();
  const delta = { create: after.create - before.create, data: after.data - before.data, sub: after.sub - before.sub, del: after.del - before.del };
  const problems = [
    ...(sweep.length && applied > 0 ? [] : ["no state-only change was applied"]),
    ...(delta.create === 0 ? [] : [`${delta.create} buffers created after warm-up`]),
    ...(delta.data === 0 ? [] : [`${delta.data} buffer reallocations (bufferData) after warm-up`]),
    ...(delta.sub > 0 ? [] : ["no bufferSubData range update observed"]),
  ];
  return { profile: "LOW" as const, ok: problems.length === 0, problems, toggles: sweep.length, warmApplied, applied, before, after, delta };
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
      // tsx/esbuild keeps callback names with a __name wrapper; page.evaluate/waitForFunction need it defined.
      await context.addInitScript("globalThis.__name = globalThis.__name || ((fn) => fn);");
      await context.addInitScript(`try { localStorage.setItem("liberialearn_session_cookie_notice_dismissed", "true"); } catch (e) {}`);
      const page = await context.newPage();
      const pageErrors: string[] = [];
      page.on("pageerror", (error) => pageErrors.push(error.message.slice(0, 300)));
      try {
        await page.goto(`${baseUrl}/lab-review/${encodeURIComponent(labId)}?scenario=${encodeURIComponent(scenario.id)}&profile=${profile}`, { waitUntil: "domcontentloaded", timeout: 180_000 });
        const result = await remountLoop(page, profile, mounts);
        results.push({ test: "remount-loop", ...result, pageErrors, ok: result.ok && pageErrors.length === 0 });
        if (profile === "LOW") {
          // RX-006 test 6 on a fresh page so the counter sees the renderer from its first frame.
          const identityPage = await context.newPage();
          await identityPage.addInitScript(GL_BUFFER_COUNTER);
          const identityErrors: string[] = [];
          identityPage.on("pageerror", (error) => identityErrors.push(error.message.slice(0, 300)));
          try {
            await identityPage.goto(`${baseUrl}/lab-review/${encodeURIComponent(labId)}?scenario=${encodeURIComponent(scenario.id)}&profile=LOW`, { waitUntil: "domcontentloaded", timeout: 180_000 });
            const identity = await lowBufferIdentity(identityPage, labId);
            results.push({ test: "low-buffer-identity", ...identity, pageErrors: identityErrors, ok: identity.ok && identityErrors.length === 0 });
          } catch (cause) {
            results.push({ test: "low-buffer-identity", profile, ok: false, error: cause instanceof Error ? cause.message.slice(0, 600) : String(cause), pageErrors: identityErrors });
          } finally { await identityPage.close(); }
        }
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
