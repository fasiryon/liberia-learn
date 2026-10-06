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
 *     [--viewports desktop,mobile] [--scenarios overview,current-starts] [--reduced-motion] [--still-only]
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
import sharp from "sharp";
import { getInteractiveLabDefinition } from "../../lib/interactive-labs/v2/registry";
import { getLabReviewScenarioSet } from "../../lib/interactive-labs/v2/review/referenceScenarios";
import { LAB_REVIEW_PROFILES, validateScenarioSet, type LabReviewScenario } from "../../lib/interactive-labs/v2/review/scenarios";

// Software-GL (SwiftShader) frames of the three.js HIGH renderer can take ~10 s each; captures are composition evidence only.
const SCREENSHOT_TIMEOUT_MS = 240_000;
import type { CapabilityProfile } from "../../lib/interactive-labs/v2/types";
import { verifyRendererIdentity } from "../../lib/interactive-labs/v2/review/rendererIdentity";
import { compareFramePlan, type FrameProbeResult } from "../../lib/interactive-labs/v2/review/framePlanEvidence";
import { isThreeChunk } from "../../lib/interactive-labs/v2/review/rendererChunks";

const VIEWPORTS = {
  desktop: { viewport: { width: 1366, height: 900 }, isMobile: false, hasTouch: false },
  mobile: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
  // A17: a phone held sideways (scene left, 40% controls sheet right). Opt-in: --viewports desktop,mobile,landscape.
  landscape: { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true },
} as const;
type ViewportName = keyof typeof VIEWPORTS;
/**
 * A full-page shot grows the viewport to the page height. In landscape that lifts the height past the A17
 * max-height:500px query mid-capture and re-lays the page out (run 37429567958: 3 circuit landscape stills differed);
 * a phone held sideways only ever shows its viewport, so landscape captures the viewport.
 */
const fullPageFor = (viewport: ViewportName) => viewport !== "landscape";
/** WebGL/three.js shader or GL errors in the console fail a still. */
const SHADER_ERROR = /Shader Error|VALIDATE_STATUS|THREE\.WebGLProgram|WebGL: INVALID|GL_INVALID|undeclared identifier/i;
const SETTLE_MS = 2500;
/**
 * RX-005 A9 determinism on the software path. WebGL already renders identically run to run on SwiftShader; these
 * flags pin the DOM around it (CPU tile raster, no partial/threaded raster or animation, fixed text AA and colour
 * profile) so translucent rounded chips and label pills composite byte-identically too (run 37408210917: 14/64 stills
 * differed only in DOM chips by <= 9 levels). They change no layout; the --gpu sign-off path does not use them.
 */
const DETERMINISTIC_RASTER_FLAGS = ["--disable-gpu-rasterization", "--disable-partial-raster", "--disable-skia-runtime-opts", "--run-all-compositor-stages-before-draw",
  "--disable-threaded-animation", "--disable-threaded-scrolling", "--disable-checker-imaging", "--disable-image-animation-resync", "--disable-lcd-text",
  "--font-render-hinting=none", "--force-color-profile=srgb", "--hide-scrollbars"];
const COOKIE_NOTICE_KEY = "liberialearn_session_cookie_notice_dismissed";

type RendererInfo = { kind: "gpu" | "software" | "none"; renderer: string; validFor: string[] };
type Capture = { file: string; scenario: string; storyboardScene?: string; stage: string; profile: CapabilityProfile; viewport: ViewportName; kind: "still" | "motion-frame" | "motion-sheet" | "video"; reducedMotion: boolean; virtualMs?: number };
type PageIssues = { consoleErrors: string[]; pageErrors: string[]; threeChunkRequests: string[] };

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}
const flag = (name: string) => process.argv.includes(`--${name}`);
const list = (name: string) => arg(name)?.split(",").map((value) => value.trim()).filter(Boolean);

function gitSha(): string {
  try { return execSync("git rev-parse HEAD", { encoding: "utf8" }).trim() + (execSync("git status --porcelain --untracked-files=no", { encoding: "utf8" }).trim() ? "-dirty" : ""); } catch { return process.env.GITHUB_SHA ?? "unknown"; }
}

/** What actually drew the page: the player's resolved profile and the mounted renderer's own identity marker. */
async function observeRenderer(page: Page, requestedProfile: CapabilityProfile) {
  const seen = await page.evaluate(`(() => {
    const scope = document.querySelector("[data-lab-review-ready]");
    const player = scope && scope.querySelector("[data-lab-active-profile]");
    const renderer = scope && scope.querySelector("[data-lab-renderer]:not([data-lab-loading-veil] *)");
    return {
      actualProfile: player ? player.getAttribute("data-lab-active-profile") : null,
      downgradePath: player ? player.getAttribute("data-lab-downgrade-path") || "" : "",
      actualRenderer: renderer ? renderer.getAttribute("data-lab-renderer") : null,
      framesRendered: renderer ? Number(renderer.getAttribute("data-lab-frames-rendered") || 0) : 0,
      drawCalls: renderer && renderer.hasAttribute("data-lab-draw-calls") ? Number(renderer.getAttribute("data-lab-draw-calls")) : null,
    };
  })()`) as { actualProfile: string | null; downgradePath: string; actualRenderer: string | null; framesRendered: number; drawCalls: number | null };
  return { ...seen, verdict: verifyRendererIdentity({ requestedProfile, ...seen }) };
}

async function newContext(browser: Browser, viewport: ViewportName, reducedMotion: boolean, video?: string): Promise<BrowserContext> {
  const context = await browser.newContext({ ...VIEWPORTS[viewport], deviceScaleFactor: 1, reducedMotion: reducedMotion ? "reduce" : "no-preference", ...(video ? { recordVideo: { dir: video, size: VIEWPORTS[viewport].viewport } } : {}) });
  // tsx/esbuild keeps function names by wrapping them in __name(); functions sent to page.evaluate need it defined.
  await context.addInitScript("globalThis.__name = globalThis.__name || ((fn) => fn);");
  await context.addInitScript(([key]) => { try { window.localStorage.setItem(key, "true"); } catch { /* storage blocked */ } }, [COOKIE_NOTICE_KEY]);
  return context;
}

function watch(page: Page): PageIssues {
  const issues: PageIssues = { consoleErrors: [], pageErrors: [], threeChunkRequests: [] };
  // A8 capture assertion: record every script response that carries three.js (by URL or, in dev, by module path).
  page.on("response", (response) => {
    if (response.request().resourceType() !== "script") return;
    void response.text().then((body) => { if (isThreeChunk(response.url(), body)) issues.threeChunkRequests.push(response.url().slice(0, 200)); }).catch(() => undefined);
  });
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
  // Pin the browser clock before navigation so no animation or adaptive-quality sample depends on wall time.
  if (fakeClock) {
    await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
    await page.addInitScript("globalThis.__labReviewClockSeconds = 0;");
    // The Next.js dev indicator is not part of the lab and changes between runs.
    await page.addInitScript(`document.addEventListener("DOMContentLoaded", () => { const style = document.createElement("style"); style.textContent = "nextjs-portal, [role='status'].fixed { display: none !important; }"; document.head.appendChild(style); });`);
  }
  const url = `${baseUrl}/lab-review/${encodeURIComponent(labId)}?scenario=${encodeURIComponent(scenario)}&profile=${profile}${hold ? "&hold=1" : ""}`;
  const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120_000 });
  if (!response || response.status() === 404) throw new Error(`${url} returned ${response?.status() ?? "no response"}. Is the dev server running with LAB_REVIEW_HARNESS=1?`);
  const error = page.locator("[data-lab-review-error]");
  const scene = page.locator("[data-lab-review-ready] canvas, [data-lab-review-ready] svg[role=group]").first();
  try {
    await Promise.race([scene.waitFor({ timeout: 90_000 }), error.waitFor({ timeout: 90_000 })]);
  } catch (cause) {
    const diagnostic = await page.evaluate(() => ({
      url: location.href,
      title: document.title,
      ready: Boolean(document.querySelector("[data-lab-review-ready]")),
      error: document.querySelector("[data-lab-review-error]")?.textContent?.trim() ?? null,
      scene: Boolean(document.querySelector("[data-lab-review-ready] canvas, [data-lab-review-ready] svg[role=group]")),
      text: document.body.innerText.slice(0, 400),
    })).catch(() => null);
    throw new Error(`Review scene did not render: ${JSON.stringify(diagnostic)}; cause=${cause instanceof Error ? cause.message : String(cause)}`);
  }
  if (await error.count()) throw new Error(await error.innerText());
  if (fakeClock) {
    // Advance the installed clock once before waiting on the review dispatcher; React's client hydration may
    // schedule work on controlled timers, and the scene clock is already fixed at zero from document start.
    await page.clock.runFor(SETTLE_MS);
    try {
      await page.waitForFunction(() => Boolean((window as unknown as { __labReview?: unknown }).__labReview), null, { timeout: 30_000 });
    } catch (cause) {
      const diagnostic = await page.evaluate(() => ({ url: location.href, body: document.body.innerText.slice(0, 500), ready: Boolean(document.querySelector("[data-lab-review-ready]")), error: document.querySelector("[data-lab-review-error]")?.textContent ?? null })).catch(() => null);
      throw new Error(`Review dispatcher did not initialize: ${JSON.stringify(diagnostic)}; cause=${cause instanceof Error ? cause.message : String(cause)}`);
    }
    // Let hydration and deferred renderer effects settle while the installed clock advances normally.
    await page.clock.runFor(SETTLE_MS);
    if (profile !== "FALLBACK_2D") {
      // A9: wait for the WebGL renderer's first full frame (it compiles every program first in review mode). The 2D
      // view under the loading veil is not the scene: the chunk may still be loading when the page first paints.
      await page.waitForFunction(() => {
        const ready = document.querySelector("[data-lab-review-ready] [data-lab-scene-ready]");
        const canvas = document.querySelector<HTMLCanvasElement>("[data-lab-review-ready] canvas");
        // A downgrade to 2D (lost context) never becomes scene-ready; identity then reports it as a FAIL.
        if (document.querySelector("[data-lab-review-ready] [data-lab-active-profile=FALLBACK_2D]")) return true;
        return !!ready && !!canvas && canvas.width > 300 && !document.querySelector("[data-lab-review-ready] [data-lab-loading-veil]");
      }, null, { timeout: 120_000 });
    } else {
      try {
        await page.waitForFunction(() => Boolean((window as Window & { __labReviewClockReady?: boolean }).__labReviewClockReady), null, { timeout: 30_000 });
      } catch (cause) {
        const diagnostic = await page.evaluate(() => ({ url: location.href, clockReady: (window as Window & { __labReviewClockReady?: boolean }).__labReviewClockReady, body: document.body.innerText.slice(0, 500), error: document.querySelector("[data-lab-review-error]")?.textContent ?? null })).catch(() => null);
        throw new Error(`Review clock did not initialize: ${JSON.stringify(diagnostic)}; cause=${cause instanceof Error ? cause.message : String(cause)}`);
      }
    }
    // Playwright's clock freezes Date, but browser performance/rAF timestamps can remain tied to wall time.
    // Install this only after the player has built its canvas; the virtual time then advances with Date during runFor.
    await page.evaluate(() => {
      const origin = Date.now();
      const nativeRequestAnimationFrame = window.requestAnimationFrame.bind(window);
      Object.defineProperty(performance, "now", { configurable: true, value: () => Date.now() - origin });
      window.requestAnimationFrame = (callback: FrameRequestCallback) => nativeRequestAnimationFrame(() => callback(performance.now()));
      (window as Window & { __labReviewClockSeconds?: number }).__labReviewClockSeconds = 0;
    });
    await page.clock.runFor(SETTLE_MS);
  }
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
  await page.screenshot({ path: out, fullPage: true, animations: "disabled", caret: "hide", timeout: SCREENSHOT_TIMEOUT_MS });
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
      // FALLBACK_2D component groups can have a larger invisible SVG stroke for touch. Measure
      // that pointer target instead of the component's visible silhouette.
      const hitTarget = node.querySelector?.("[data-lab-touch-target]") ?? node;
      const box = hitTarget.getBoundingClientRect();
      const touchStroke = hitTarget.hasAttribute("data-lab-touch-target") ? Number.parseFloat(getComputedStyle(hitTarget).strokeWidth) : 0;
      // Name as assistive technology would: aria-label, an associated <label for>, then raw text content (not innerText,
      // which is empty inside collapsed <details> and transformed by CSS).
      const labelFor = node.id ? document.querySelector(`label[for="${CSS.escape(node.id)}"]`)?.textContent?.trim() : "";
      const name = node.getAttribute("aria-label") || labelFor || node.textContent?.trim() || node.getAttribute("title") || "";
      const collapsed = !!node.closest("details:not([open]) > :not(summary)");
      return { tag: node.tagName.toLowerCase(), role: node.getAttribute("role"), name: name.slice(0, 80), width: Math.round(box.width + touchStroke), height: Math.round(box.height + touchStroke), visible: !collapsed && box.width > 0 && box.height > 0 };
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
  const unknownScenarios = (wanted ?? []).filter((id) => !set.scenarios.some((scenario) => scenario.id === id));
  if (unknownScenarios.length) throw new Error(`Unknown scenario id(s) for ${labId}: ${unknownScenarios.join(", ")}. Known: ${set.scenarios.map((scenario) => scenario.id).join(", ")}`);
  const scenarios: LabReviewScenario[] = wanted ? set.scenarios.filter((scenario) => wanted.includes(scenario.id)) : set.scenarios;
  for (const profile of profiles) if (!LAB_REVIEW_PROFILES.includes(profile)) throw new Error(`Unknown profile ${profile}`);
  for (const viewport of viewports) if (!(viewport in VIEWPORTS)) throw new Error(`Unknown viewport ${viewport}`);
  mkdirSync(out, { recursive: true });

  const launch = () => flag("gpu")
    ? chromium.launch({ headless: false, args: ["--ignore-gpu-blocklist", "--enable-gpu-rasterization"] })
    : chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", ...DETERMINISTIC_RASTER_FLAGS] });
  // Memory safety: a fresh browser every N scenario runs (default 6) so one long run never accumulates GPU/JS memory.
  const restartEvery = Math.max(1, Number(arg("restart-every") ?? 6));
  let browser = await launch();
  let runsSinceLaunch = 0;
  const probePage = await browser.newPage();
  const renderer = await detectRenderer(probePage);
  await probePage.close();
  if (flag("gpu") && renderer.kind !== "gpu") throw new Error(`--gpu requested but the renderer is ${renderer.kind} (${renderer.renderer}).`);
  const captures: Capture[] = [];
  const runs: Record<string, unknown>[] = [];
  const motionModes = flag("reduced-motion") ? [false, true] : [false];
  try {
    for (const viewport of viewports) for (const profile of profiles) for (const scenario of scenarios) {
      if (runsSinceLaunch >= restartEvery) { await browser.close(); browser = await launch(); runsSinceLaunch = 0; }
      runsSinceLaunch += 1;
      const base = `${scenario.id}__${profile}__${viewport}`;
      const stillReducedMotion = flag("reduced-motion");
      const context = await newContext(browser, viewport, stillReducedMotion);
      const still = path.join(out, `${base}.png`);
      try {
        const page = await context.newPage();
        const issues = watch(page);
        const opened = await openScenario(page, baseUrl, labId, scenario.id, profile, false, true);
        const identity = await observeRenderer(page, profile);
        // A8: the planner must equal what the renderer drew (worst frame: culling off, shadow pass forced on HIGH).
        const frameProbe = profile === "FALLBACK_2D" ? null : await page.evaluate(() => (window as Window & { __labReviewFrameProbe?: () => unknown }).__labReviewFrameProbe?.() ?? null) as FrameProbeResult | null;
        const frameParity = frameProbe ? compareFramePlan(frameProbe) : null;
        const threeRequestViolation = (profile === "LOW" || profile === "FALLBACK_2D") && issues.threeChunkRequests.length > 0;
        // A9: every web font settled before the still, so text never rasterises with a fallback face in one run only.
        await page.evaluate(() => document.fonts.ready.then(() => true));
        await page.screenshot({ path: still, fullPage: fullPageFor(viewport), animations: "disabled", caret: "hide", timeout: SCREENSHOT_TIMEOUT_MS });
        captures.push({ file: still, scenario: scenario.id, storyboardScene: scenario.storyboardScene, stage: scenario.stage, profile, viewport, kind: "still", reducedMotion: stillReducedMotion });
        // R4 P1-1: a shader that fails to compile still counts draws, so parity alone cannot catch it.
        const shaderErrors = issues.consoleErrors.filter((text) => SHADER_ERROR.test(text));
        const failure = !identity.verdict.ok ? identity.verdict.reason
          : shaderErrors.length ? `shader_error: ${shaderErrors[0].slice(0, 200)}`
          : profile !== "FALLBACK_2D" && !frameProbe ? "frame_probe_missing: the renderer installed no __labReviewFrameProbe"
          : frameParity && !frameParity.ok ? `frame_plan_mismatch: ${frameParity.mismatches.join("; ")}`
          : threeRequestViolation ? `three_chunk_requested_on_${profile}: ${issues.threeChunkRequests.join(", ")}` : undefined;
        runs.push({ scenario: scenario.id, profile, viewport, kind: "still", screenshot: path.relative(out, still).replace(/\\/g, "/"),
          status: failure ? "FAIL" : "PASS", ...(failure ? { failureReason: failure } : {}),
          framePlan: frameProbe, frameParity, threeChunkRequests: issues.threeChunkRequests,
          actualProfile: identity.actualProfile, downgradePath: identity.downgradePath, actualRenderer: identity.actualRenderer, framesRendered: identity.framesRendered, drawCalls: identity.drawCalls,
          ...opened, warnings: issues.consoleErrors, consoleErrors: issues.consoleErrors, pageErrors: issues.pageErrors });
        writeManifest();
        if (failure) { console.error(`FAIL ${base}: ${failure}`); if (!identity.verdict.ok) continue; }
      } catch (cause) {
        const reason = cause instanceof Error ? cause.message.slice(0, 600) : String(cause);
        console.error(`ERROR ${base}: ${reason}`);
        runs.push({ scenario: scenario.id, profile, viewport, kind: "still", status: "ERROR", failureReason: reason });
        writeManifest();
        continue;
      } finally {
        await context.close().catch(() => undefined);
      }

      if (!scenario.motion || flag("still-only")) continue;
      for (const reducedMotion of motionModes) {
        const motionContext = await newContext(browser, viewport, reducedMotion);
        const motionPage = await motionContext.newPage();
        const motionIssues = watch(motionPage);
        await openScenario(motionPage, baseUrl, labId, scenario.id, profile, true, true);
        const suffix = reducedMotion ? "__reduced" : "";
        const frames: { file: string; label: string }[] = [];
        const shoot = async (index: number) => {
          const file = path.join(out, `${base}${suffix}__motion-${String(index).padStart(2, "0")}.png`);
          // Flush one browser frame at the held review time; advancing Playwright's virtual clock
          // alone can leave the previous SVG compositor frame visible to a clipped screenshot.
          await motionPage.clock.runFor(34);
          const section = motionPage.locator("[data-lab-review-ready] section").first();
          const bounds = await section.boundingBox();
          if (!bounds) throw new Error(`Review player has no bounds for ${scenario.id} frame ${index}.`);
          const pageImage = await motionPage.screenshot({ fullPage: fullPageFor(viewport), animations: "disabled", caret: "hide", timeout: SCREENSHOT_TIMEOUT_MS });
          const left = Math.max(0, Math.floor(bounds.x)), top = Math.max(0, Math.floor(bounds.y));
          const width = Math.max(1, Math.ceil(bounds.width)), height = Math.max(1, Math.ceil(bounds.height));
          await sharp(pageImage).extract({ left, top, width, height }).png().toFile(file);
          frames.push({ file, label: `t=${index * scenario.motion!.intervalMs}ms` });
          captures.push({ file, scenario: scenario.id, storyboardScene: scenario.storyboardScene, stage: scenario.stage, profile, viewport, kind: "motion-frame", reducedMotion, virtualMs: index * scenario.motion!.intervalMs });
        };
        const dispatched = await motionPage.evaluate(() => {
          (window as Window & { __labReviewClockSeconds?: number }).__labReviewClockSeconds = 0;
          const reviewWindow = window as Window & { __labReviewStateRevision?: number; __labReview?: { finalAction: unknown; dispatch: (action: unknown) => { ok: boolean; reason?: string } } };
          const review = reviewWindow.__labReview;
          const stateRevision = reviewWindow.__labReviewStateRevision ?? 0;
          return review?.finalAction ? { ...review.dispatch(review.finalAction), stateRevision } : { ok: false, reason: "No review dispatcher or final action.", stateRevision };
        });
        if (!dispatched.ok) throw new Error(`Motion action for ${scenario.id} was rejected: ${dispatched.reason}`);
        try {
          await motionPage.waitForFunction((revision) => ((window as Window & { __labReviewStateRevision?: number }).__labReviewStateRevision ?? 0) > revision, dispatched.stateRevision, { timeout: 30_000 });
        } catch (cause) {
          const diagnostic = await motionPage.evaluate(() => ({ url: location.href, revision: (window as Window & { __labReviewStateRevision?: number }).__labReviewStateRevision, body: document.body.innerText.slice(0, 500) })).catch(() => null);
          throw new Error(`Motion action did not update the review state: ${JSON.stringify(diagnostic)}; cause=${cause instanceof Error ? cause.message : String(cause)}`);
        }
        // Let React commit the action and restart its display-state effect while review time remains at t=0.
        // The extra virtual-clock frames make effect startup independent of page load and profile timing.
        await motionPage.clock.runFor(150);
        await shoot(0);
        for (let index = 1; index < scenario.motion.frames; index += 1) {
          await motionPage.evaluate((seconds) => { (window as Window & { __labReviewClockSeconds?: number }).__labReviewClockSeconds = seconds; }, index * scenario.motion.intervalMs / 1000);
          await motionPage.clock.runFor(scenario.motion.intervalMs);
          await shoot(index);
        }
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
    await browser.close().catch(() => undefined);
    writeManifest();
  }

  function writeManifest() {
  const manifest = {
    labId, labVersion: definition.version, reviewState: definition.reviewState, label, gitSha: gitSha(), capturedAt: new Date().toISOString(),
    environment: `${process.env.GITHUB_ACTIONS ? `GitHub Actions (${process.env.RUNNER_OS ?? "runner"}, run ${process.env.GITHUB_RUN_ID ?? "?"})` : "local"} dev server, ${flag("gpu") ? "headed" : "headless"} Chromium, virtual clock paused from navigation for stills and motion frames`,
    rendererIdentityRule: "HIGH/STANDARD must be drawn by three@*, LOW by webgl-pass, FALLBACK_2D by svg, at the requested profile, with at least one frame drawn; otherwise status FAIL.",
    framePlanRule: "RX-005 A8 / RX-006 test 1: the shared frame planner must equal the renderer's own count for the probed frame (three.js: renderer.info with frustum culling off and the shadow pass forced; LOW: counted drawArrays); otherwise status FAIL.",
    threeChunkRule: "RX-005 A8: LOW and FALLBACK_2D runs must make zero requests for a script carrying three.js; otherwise status FAIL.",
    deviceBoundary: "Headless browser evidence proves rendering correctness, composition, layout, interaction automation and renderer/profile routing only. It does not prove low-end GPU performance, touch latency, thermal behaviour or mobile memory pressure (DEVICE_REQUIRED).",
    renderer,
    profiles, viewports, captures: captures.map((capture) => ({ ...capture, file: path.relative(out, capture.file).replace(/\\/g, "/") })), runs,
  };
  writeFileSync(path.join(out, "manifest.json"), JSON.stringify(manifest, null, 2));
  }
  const errors = runs.filter((run) => (run.pageErrors as string[] | undefined)?.length);
  const failed = runs.filter((run) => run.status === "FAIL" || run.status === "ERROR");
  console.log(`Captured ${captures.length} files for ${labId}@${definition.version} into ${out}; ${runs.filter((run) => run.status === "PASS").length} PASS, ${failed.length} FAIL/ERROR.`);
  if (errors.length) { console.error(`${errors.length} capture run(s) had page errors; see manifest.json.`); process.exitCode = 1; }
  if (failed.length) { console.error(`${failed.length} capture run(s) failed renderer identity or errored; they are not review evidence. See manifest.json.`); process.exitCode = 1; }
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
