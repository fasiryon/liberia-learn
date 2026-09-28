/**
 * Captures the ACTUAL rendered lab for the Interactive Lab Production Team reviewers.
 *
 * Renders each registered review scenario (lib/interactive-labs/v2/review/referenceScenarios.ts) through the
 * dev-only /lab-review harness, across capability profiles and viewports, and writes screenshots, motion frame
 * strips, optional performance metrics, an optional interaction probe and a manifest.
 *
 * Prerequisite (separate terminal, never against a deployed site):
 *   LAB_REVIEW_HARNESS=1 npm run dev
 *
 * Usage:
 *   npx tsx scripts/labs/capture-lab-review.ts --lab fixture-simple-circuit --label round-1
 *     [--base-url http://localhost:3000] [--profiles HIGH,STANDARD,LOW,FALLBACK_2D]
 *     [--viewports desktop,mobile] [--scenarios overview,current-starts] [--reduced-motion]
 *     [--perf] [--probe] [--video] [--out artifacts/lab-review/...]
 *
 * Determinism: stills and motion frames run on Playwright's virtual clock, paused before navigation, so every
 * animation frame happens at a fixed virtual time step and consecutive runs produce identical PNGs
 * (prove it with scripts/labs/compare-lab-captures.ts). --perf and --video use the real clock and are NOT
 * deterministic.
 *
 * Render honesty: each run records the WebGL renderer. SwiftShader/llvmpipe runs are marked "software" and are
 * valid for composition and labels only, never for performance or visual-fidelity sign-off. Pass --gpu to use
 * the host GPU in headed Chromium (e.g. on a workstation with a real GPU) when a GPU-backed run is needed.
 */
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { chromium, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { getInteractiveLabDefinition } from "../../lib/interactive-labs/v2/registry";
import { getLabReviewScenarioSet } from "../../lib/interactive-labs/v2/review/referenceScenarios";
import { LAB_REVIEW_PROFILES, validateScenarioSet, type LabReviewScenario } from "../../lib/interactive-labs/v2/review/scenarios";
import type { CapabilityProfile } from "../../lib/interactive-labs/v2/types";

const VIEWPORTS = {
  desktop: { viewport: { width: 1366, height: 900 }, isMobile: false, hasTouch: false },
  mobile: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
} as const;
type ViewportName = keyof typeof VIEWPORTS;
const SETTLE_MS = 2500;
const COOKIE_NOTICE_KEY = "liberialearn_session_cookie_notice_dismissed";

type RendererInfo = { kind: "gpu" | "software" | "none"; renderer: string; validFor: string[] };
type Capture = { file: string; scenario: string; storyboardScene?: string; stage: string; profile: CapabilityProfile; viewport: ViewportName; kind: "still" | "motion-frame" | "motion-sheet" | "video"; reducedMotion: boolean; virtualMs?: number };
type PageIssues = { consoleErrors: string[]; pageErrors: string[] };

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}
const flag = (name: string) => process.argv.includes(`--${name}`);
const list = (name: string) => arg(name)?.split(",").map((value) => value.trim()).filter(Boolean);

function gitSha(): string {
  try { return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim() + (execSync("git status --porcelain", { encoding: "utf8" }).trim() ? "-dirty" : ""); } catch { return "unknown"; }
}

async function newContext(browser: Browser, viewport: ViewportName, reducedMotion: boolean, video?: string): Promise<BrowserContext> {
  const context = await browser.newContext({ ...VIEWPORTS[viewport], deviceScaleFactor: 1, reducedMotion: reducedMotion ? "reduce" : "no-preference", ...(video ? { recordVideo: { dir: video, size: VIEWPORTS[viewport].viewport } } : {}) });
  // tsx/esbuild keeps function names by wrapping them in __name(); functions sent to page.evaluate need it defined.
  await context.addInitScript("globalThis.__name = globalThis.__name || ((fn) => fn);");
  await context.addInitScript(([key]) => { try { window.localStorage.setItem(key, "true"); } catch { /* storage blocked */ } }, [COOKIE_NOTICE_KEY]);
  return context;
}

function watch(page: Page): PageIssues {
  const issues: PageIssues = { consoleErrors: [], pageErrors: [] };
  page.on("console", (message) => { if (message.type() === "error") issues.consoleErrors.push(message.text().slice(0, 400)); });
  page.on("pageerror", (error) => issues.pageErrors.push(error.message.slice(0, 400)));
  return issues;
}

async function detectRenderer(page: Page): Promise<RendererInfo> {
  const renderer = await page.evaluate(() => {
    const gl = document.createElement("canvas").getContext("webgl");
    if (!gl) return "";
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    return String(info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
  });
  if (!renderer) return { kind: "none", renderer: "no WebGL", validFor: ["composition", "labels"] };
  const software = /swiftshader|llvmpipe|software|basic render|mesa offscreen/i.test(renderer);
  return software
    ? { kind: "software", renderer, validFor: ["composition", "labels"] }
    : { kind: "gpu", renderer, validFor: ["composition", "labels", "visual-fidelity", "performance"] };
}

async function openScenario(page: Page, baseUrl: string, labId: string, scenario: string, profile: CapabilityProfile, hold: boolean, fakeClock: boolean) {
  // Paused from the first instant: no animation frame ever runs on wall-clock time, so captures repeat exactly.
  if (fakeClock) { await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") }); await page.clock.pauseAt(new Date("2026-01-01T00:00:01Z")); }
  const url = `${baseUrl}/lab-review/${encodeURIComponent(labId)}?scenario=${encodeURIComponent(scenario)}&profile=${profile}${hold ? "&hold=1" : ""}`;
  const response = await page.goto(url, { waitUntil: "domcontentloaded" });
  if (!response || response.status() === 404) throw new Error(`${url} returned ${response?.status() ?? "no response"}. Is the dev server running with LAB_REVIEW_HARNESS=1?`);
  const error = page.locator("[data-lab-review-error]");
  const scene = page.locator("[data-lab-review-ready] canvas, [data-lab-review-ready] svg[role=group]").first();
  await Promise.race([scene.waitFor({ timeout: 90_000 }), error.waitFor({ timeout: 90_000 })]);
  if (await error.count()) throw new Error(await error.innerText());
  if (fakeClock) await page.clock.runFor(SETTLE_MS);
  else await page.waitForTimeout(SETTLE_MS);
  return {
    notice: await page.locator("[data-lab-review-ready] [role=status]").allInnerTexts(),
    surface: (await page.locator("[data-lab-review-ready] canvas").count()) > 0 ? "webgl" : "svg",
  };
}

async function contactSheet(browser: Browser, frames: { file: string; label: string }[], out: string) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const cells = frames.map((frame) => `<figure><img src="data:image/png;base64,${readFileSync(frame.file).toString("base64")}"/><figcaption>${frame.label}</figcaption></figure>`).join("");
  await page.setContent(`<html><body style="margin:0;background:#0b1020;color:#e2e8f0;font:14px system-ui"><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:8px">${cells}</div><style>figure{margin:0}img{width:100%;display:block;border:1px solid #334155}figcaption{padding:2px 4px}</style></body></html>`);
  await page.screenshot({ path: out, fullPage: true });
  await page.close();
}

async function measurePerf(page: Page) {
  return page.evaluate(async () => {
    const intervals: number[] = [];
    await new Promise<void>((resolve) => {
      let last = performance.now();
      const started = last;
      const tick = (now: number) => { intervals.push(now - last); last = now; if (now - started < 3000) requestAnimationFrame(tick); else resolve(); };
      requestAnimationFrame(tick);
    });
    const sorted = [...intervals].sort((a, b) => a - b);
    const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
    const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
    return {
      frames: intervals.length,
      medianFrameMs: Math.round(sorted[Math.floor(sorted.length / 2)] ?? 0),
      p95FrameMs: Math.round(sorted[Math.floor(sorted.length * 0.95)] ?? 0),
      usedJSHeapMB: memory ? Math.round(memory.usedJSHeapSize / 1e5) / 10 : null,
      resourceCount: resources.length,
      transferKB: Math.round(resources.reduce((sum, entry) => sum + (entry.transferSize || 0), 0) / 1024),
      note: "Dev server. Only renderer.kind === 'gpu' runs (or real devices) may be used for performance sign-off; software runs are relative comparison only.",
    };
  });
}

async function probeInteraction(page: Page) {
  const targets = await page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement | SVGElement>("[data-lab-review-ready] :is(button, a[href], input, select, textarea, [role=button], [tabindex]:not([tabindex='-1']))"));
    return nodes.map((node) => {
      const box = node.getBoundingClientRect();
      const name = node.getAttribute("aria-label") || (node as HTMLElement).innerText?.trim() || node.getAttribute("title") || "";
      return { tag: node.tagName.toLowerCase(), role: node.getAttribute("role"), name: name.slice(0, 80), width: Math.round(box.width), height: Math.round(box.height), visible: box.width > 0 && box.height > 0 };
    });
  });
  const focusOrder: { name: string; tag: string; outline: string }[] = [];
  await page.locator("[data-lab-review-ready]").click({ position: { x: 5, y: 5 } });
  for (let index = 0; index < 60; index += 1) {
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => {
      const element = document.activeElement as HTMLElement | null;
      if (!element || !element.closest("[data-lab-review-ready]")) return null;
      const style = getComputedStyle(element);
      return { name: (element.getAttribute("aria-label") || element.innerText || "").trim().slice(0, 80), tag: element.tagName.toLowerCase(), outline: `${style.outlineStyle} ${style.outlineWidth} / shadow ${style.boxShadow === "none" ? "none" : "set"}` };
    });
    if (!focused) break;
    focusOrder.push(focused);
  }
  return {
    targets,
    smallTargets: targets.filter((target) => target.visible && (target.width < 44 || target.height < 44)),
    unnamedTargets: targets.filter((target) => target.visible && !target.name),
    focusOrder,
    note: "Automated probe only. The interaction reviewer must still exercise touch, mouse and keyboard flows.",
  };
}

async function main() {
  const labId = arg("lab");
  if (!labId) throw new Error("--lab is required");
  const definition = getInteractiveLabDefinition(labId);
  const set = getLabReviewScenarioSet(labId);
  if (!definition || !set) throw new Error(`No definition or review scenario set for ${labId}. Register one in lib/interactive-labs/v2/review/referenceScenarios.ts.`);
  const problems = validateScenarioSet(definition, set);
  if (problems.length) throw new Error(`Scenario set is invalid:\n- ${problems.join("\n- ")}`);

  const baseUrl = arg("base-url") ?? "http://localhost:3000";
  if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(baseUrl)) throw new Error("The review harness only runs against a local dev server.");
  const label = arg("label") ?? "adhoc";
  const out = arg("out") ?? path.join("artifacts", "lab-review", labId, definition.version, label);
  const profiles = (list("profiles") ?? [...LAB_REVIEW_PROFILES]) as CapabilityProfile[];
  const viewports = (list("viewports") ?? ["desktop", "mobile"]) as ViewportName[];
  const wanted = list("scenarios");
  const scenarios: LabReviewScenario[] = wanted ? set.scenarios.filter((scenario) => wanted.includes(scenario.id)) : set.scenarios;
  for (const profile of profiles) if (!LAB_REVIEW_PROFILES.includes(profile)) throw new Error(`Unknown profile ${profile}`);
  for (const viewport of viewports) if (!(viewport in VIEWPORTS)) throw new Error(`Unknown viewport ${viewport}`);
  mkdirSync(out, { recursive: true });

  const browser = flag("gpu")
    ? await chromium.launch({ headless: false, args: ["--ignore-gpu-blocklist", "--enable-gpu-rasterization"] })
    : await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const probePage = await browser.newPage();
  const renderer = await detectRenderer(probePage);
  await probePage.close();
  if (flag("gpu") && renderer.kind !== "gpu") throw new Error(`--gpu requested but the renderer is ${renderer.kind} (${renderer.renderer}).`);
  const captures: Capture[] = [];
  const runs: Record<string, unknown>[] = [];
  const motionModes = flag("reduced-motion") ? [false, true] : [false];
  try {
    for (const viewport of viewports) for (const profile of profiles) for (const scenario of scenarios) {
      const base = `${scenario.id}__${profile}__${viewport}`;
      const context = await newContext(browser, viewport, false);
      const page = await context.newPage();
      const issues = watch(page);
      const opened = await openScenario(page, baseUrl, labId, scenario.id, profile, false, true);
      const still = path.join(out, `${base}.png`);
      await page.screenshot({ path: still, fullPage: true });
      captures.push({ file: still, scenario: scenario.id, storyboardScene: scenario.storyboardScene, stage: scenario.stage, profile, viewport, kind: "still", reducedMotion: false });
      await context.close();
      runs.push({ scenario: scenario.id, profile, viewport, kind: "still", ...opened, ...issues });

      if (!scenario.motion) continue;
      for (const reducedMotion of motionModes) {
        const motionContext = await newContext(browser, viewport, reducedMotion);
        const motionPage = await motionContext.newPage();
        const motionIssues = watch(motionPage);
        await openScenario(motionPage, baseUrl, labId, scenario.id, profile, true, true);
        const suffix = reducedMotion ? "__reduced" : "";
        const frames: { file: string; label: string }[] = [];
        const shoot = async (index: number) => {
          const file = path.join(out, `${base}${suffix}__motion-${String(index).padStart(2, "0")}.png`);
          await motionPage.locator("[data-lab-review-ready] section").first().screenshot({ path: file });
          frames.push({ file, label: `t=${index * scenario.motion!.intervalMs}ms` });
          captures.push({ file, scenario: scenario.id, storyboardScene: scenario.storyboardScene, stage: scenario.stage, profile, viewport, kind: "motion-frame", reducedMotion, virtualMs: index * scenario.motion!.intervalMs });
        };
        await shoot(0);
        const dispatched = await motionPage.evaluate(() => {
          const review = (window as unknown as { __labReview?: { finalAction: unknown; dispatch: (action: unknown) => { ok: boolean; reason?: string } } }).__labReview;
          return review?.finalAction ? review.dispatch(review.finalAction) : { ok: false, reason: "No review dispatcher or final action." };
        });
        if (!dispatched.ok) throw new Error(`Motion action for ${scenario.id} was rejected: ${dispatched.reason}`);
        for (let index = 1; index < scenario.motion.frames; index += 1) { await motionPage.clock.runFor(scenario.motion.intervalMs); await shoot(index); }
        const sheet = path.join(out, `${base}${suffix}__motion-sheet.png`);
        await contactSheet(browser, frames, sheet);
        captures.push({ file: sheet, scenario: scenario.id, storyboardScene: scenario.storyboardScene, stage: scenario.stage, profile, viewport, kind: "motion-sheet", reducedMotion });
        await motionContext.close();
        runs.push({ scenario: scenario.id, profile, viewport, kind: "motion", reducedMotion, ...motionIssues });
      }

      if (flag("video")) {
        const dir = path.join(out, "video");
        const videoContext = await newContext(browser, viewport, false, dir);
        const videoPage = await videoContext.newPage();
        await openScenario(videoPage, baseUrl, labId, scenario.id, profile, true, false);
        await videoPage.evaluate(() => { const review = (window as unknown as { __labReview?: { finalAction: unknown; dispatch: (action: unknown) => unknown } }).__labReview; if (review?.finalAction) review.dispatch(review.finalAction); });
        await videoPage.waitForTimeout(scenario.motion.frames * scenario.motion.intervalMs + 1500);
        const video = videoPage.video();
        await videoContext.close();
        if (video) captures.push({ file: await video.path(), scenario: scenario.id, stage: scenario.stage, profile, viewport, kind: "video", reducedMotion: false });
      }
    }

    if (flag("perf")) {
      const perf: Record<string, unknown>[] = [];
      for (const viewport of viewports) for (const profile of profiles) {
        const scenario = scenarios.find((candidate) => candidate.stage === "process") ?? scenarios[0];
        const context = await newContext(browser, viewport, false);
        const page = await context.newPage();
        const opened = await openScenario(page, baseUrl, labId, scenario.id, profile, false, false);
        perf.push({ scenario: scenario.id, profile, viewport, renderer, signOffValid: renderer.kind === "gpu", ...opened, ...(await measurePerf(page)) });
        await context.close();
      }
      writeFileSync(path.join(out, "perf.json"), JSON.stringify(perf, null, 2));
    }

    if (flag("probe")) {
      const probes: Record<string, unknown>[] = [];
      for (const viewport of viewports) for (const profile of ["HIGH", "FALLBACK_2D"] as CapabilityProfile[]) {
        const context = await newContext(browser, viewport, false);
        const page = await context.newPage();
        await openScenario(page, baseUrl, labId, scenarios[0].id, profile, false, false);
        probes.push({ scenario: scenarios[0].id, profile, viewport, ...(await probeInteraction(page)) });
        await context.close();
      }
      writeFileSync(path.join(out, "interaction-probe.json"), JSON.stringify(probes, null, 2));
    }
  } finally {
    await browser.close();
  }

  const manifest = {
    labId, labVersion: definition.version, reviewState: definition.reviewState, label, gitSha: gitSha(), capturedAt: new Date().toISOString(),
    environment: `local dev server, ${flag("gpu") ? "headed" : "headless"} Chromium, virtual clock paused from navigation for stills and motion frames`,
    renderer,
    profiles, viewports, captures: captures.map((capture) => ({ ...capture, file: path.relative(out, capture.file).replace(/\\/g, "/") })), runs,
  };
  writeFileSync(path.join(out, "manifest.json"), JSON.stringify(manifest, null, 2));
  const errors = runs.filter((run) => (run.pageErrors as string[] | undefined)?.length);
  console.log(`Captured ${captures.length} files for ${labId}@${definition.version} into ${out}`);
  if (errors.length) { console.error(`${errors.length} capture run(s) had page errors; see manifest.json.`); process.exitCode = 1; }
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
