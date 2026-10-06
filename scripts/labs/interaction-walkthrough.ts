/**
 * Keyboard-only interaction walkthrough for the review harness (local dev server only).
 *
 * Each step Tabs to the named control (no pointer, no programmatic focus), presses Enter, and records how many Tab
 * presses it took. Status steps assert on the lab's live status regions. The result is written as JSON next to the
 * capture evidence; any failed step exits non-zero.
 *
 *   npx tsx scripts/labs/interaction-walkthrough.ts --lab mount-coffee-hydropower --profile HIGH [--viewport desktop]
 *     [--abort-three-chunk]
 *
 * --abort-three-chunk (RX-005 A3 harness): every request for the HIGH renderer's chunks is aborted. The lab must land
 * on LOW with a notice, and the whole walkthrough (every check) must still complete.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { chromium } from "playwright";
import { LAB_WALKTHROUGHS, type WalkthroughStep } from "../../lib/interactive-labs/v2/review/walkthroughs";
import { verifyRendererIdentity } from "../../lib/interactive-labs/v2/review/rendererIdentity";
import { getInteractiveLabDefinition } from "../../lib/interactive-labs/v2/registry";
import type { CapabilityProfile } from "../../lib/interactive-labs/v2/types";

const arg = (name: string) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : undefined; };
// The 2D view makes every part focusable, so the panel can sit a few hundred Tabs from the top.
const MAX_TABS = 400;

async function main() {
  const labId = arg("lab") ?? "mount-coffee-hydropower";
  const profile = (arg("profile") ?? "HIGH") as CapabilityProfile;
  const viewport = arg("viewport") ?? "desktop";
  const baseUrl = arg("base-url") ?? "http://localhost:3000";
  if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(baseUrl)) throw new Error("The review harness only runs against a local dev server.");
  const walkthrough = LAB_WALKTHROUGHS[labId];
  const definition = getInteractiveLabDefinition(labId);
  if (!walkthrough || !definition) throw new Error(`No walkthrough or definition for ${labId}.`);
  const abortThree = process.argv.includes("--abort-three-chunk");
  const out = arg("out") ?? path.join("artifacts", "lab-review", labId, definition.version, `walkthrough-${profile}-${viewport}${abortThree ? "-three-aborted" : ""}`);
  mkdirSync(out, { recursive: true });

  const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const context = await browser.newContext(viewport === "mobile" ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }
    : viewport === "landscape" ? { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true } : { viewport: { width: 1366, height: 900 } });
  await context.addInitScript(`try { localStorage.setItem("liberialearn_session_cookie_notice_dismissed", "true"); } catch (e) {}`);
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message.slice(0, 300)));
  const aborted: string[] = [];
  if (abortThree) await page.route("**/_next/static/**", (route) => {
    const url = route.request().url();
    if (/ThreeScene|threeScene|node_modules[_/]three[_/]/.test(url)) { aborted.push(url.slice(0, 200)); return route.abort("failed"); }
    return route.continue();
  });
  // When the HIGH chunk is aborted the player must fall back to LOW (A3), so that is the renderer the walkthrough expects.
  const expectedProfile: CapabilityProfile = abortThree && (profile === "HIGH" || profile === "STANDARD") ? "LOW" : profile;
  const results: Record<string, unknown>[] = [];
  let failed = 0;
  try {
    await page.goto(`${baseUrl}/lab-review/${labId}?scenario=${walkthrough.scenario}&profile=${profile}`, { waitUntil: "domcontentloaded", timeout: 180_000 });
    // The 2D render under the loading veil is not the scene: wait for the renderer's first full frame (or the real 2D view).
    await page.waitForSelector("[data-lab-review-ready] [data-lab-scene-ready], [data-lab-review-ready] [data-lab-active-profile=FALLBACK_2D] [data-lab-renderer]", { timeout: 180_000 });
    await page.waitForTimeout(4000);
    const identity = await page.evaluate(`(() => { const s = document.querySelector("[data-lab-review-ready]"); const p = s && s.querySelector("[data-lab-active-profile]"); const r = s && s.querySelector("[data-lab-renderer]:not([data-lab-loading-veil] *)");
      return { actualProfile: p ? p.getAttribute("data-lab-active-profile") : null, downgradePath: p ? p.getAttribute("data-lab-downgrade-path") : null, actualRenderer: r ? r.getAttribute("data-lab-renderer") : null, framesRendered: r ? Number(r.getAttribute("data-lab-frames-rendered") || 0) : 0 }; })()`) as { actualProfile: string | null; downgradePath: string | null; actualRenderer: string | null; framesRendered: number };
    const verdict = verifyRendererIdentity({ requestedProfile: expectedProfile, ...identity });
    results.push({ step: "renderer-identity", requestedProfile: profile, expectedProfile, ...identity, ok: verdict.ok, ...(verdict.ok ? {} : { reason: verdict.reason }) });
    if (!verdict.ok) failed += 1;
    if (abortThree) {
      const notice = (await page.locator("[data-lab-review-ready] [role=status]").allInnerTexts()).find((text) => /could not load/i.test(text)) ?? null;
      const ok = aborted.length > 0 && !!notice && (identity.downgradePath ?? "").includes(":load");
      results.push({ step: "three-chunk-aborted", ok, abortedRequests: aborted, notice, downgradePath: identity.downgradePath });
      if (!ok) failed += 1;
    }
    // Start keyboard navigation from the top of the review harness.
    await page.locator("[data-lab-review-ready]").first().focus().catch(() => undefined);

    const focusedName = (scope?: "panel") => page.evaluate(`(() => { const e = document.activeElement; if (!e || !e.closest("[data-lab-review-ready]")) return null;
      if (${JSON.stringify(scope ?? "")} === "panel" && e.closest("[data-lab-renderer], [data-three-controls], [data-lab-scene-controls]")) return null;
      const label = e.getAttribute("aria-label"); return (label || e.textContent || "").trim().replace(/\\s+/g, " "); })()`) as Promise<string | null>;
    if (viewport === "mobile") {
      // The mobile controls live in a disclosure. Open it through the real Tab + Enter path so the
      // walkthrough exercises the same keyboard-accessible shell a learner sees on a phone.
      let opened = false;
      for (let tabs = 0; tabs < MAX_TABS; tabs += 1) {
        await page.keyboard.press("Tab");
        if ((await focusedName())?.startsWith("Lab controls and next step")) {
          await page.keyboard.press("Enter");
          opened = true;
          break;
        }
      }
      if (!opened) {
        results.push({ step: "open mobile lab controls", ok: false, note: "The mobile controls disclosure was not reachable by keyboard." });
        failed += 1;
      }
    }
    for (const step of walkthrough.steps as WalkthroughStep[]) {
      if ("expectStatus" in step) {
        const texts = await page.locator("[data-lab-review-ready] [role=status]").allInnerTexts();
        const ok = texts.some((text) => text.includes(step.expectStatus));
        results.push({ step: `expect "${step.expectStatus}"`, ok, statusTexts: texts.map((text) => text.slice(0, 160)), note: step.note });
        if (!ok) failed += 1;
        continue;
      }
      for (let repeat = 0; repeat < (step.repeat ?? 1); repeat += 1) {
        let tabs = 0, found = false;
        const recentFocus: string[] = [];
        // Accessible names compare as a screen reader hears them: raw text, case-insensitive (CSS uppercase is presentation).
        const wanted = step.press.toLowerCase();
        const matches = (name: string | null) => !!name && (step.match === "prefix" ? name.toLowerCase().startsWith(wanted) : name.toLowerCase() === wanted);
        // Reset to the top each time so a step never depends on where the previous one left focus.
        await page.locator("[data-lab-review-ready]").first().evaluate((element) => { (element as HTMLElement).tabIndex = -1; (element as HTMLElement).focus(); });
        while (tabs < MAX_TABS) {
          await page.keyboard.press("Tab"); tabs += 1;
          const name = await focusedName(step.scope);
          if (name) {
            recentFocus.push(name.slice(0, 100));
            if (recentFocus.length > 20) recentFocus.shift();
          }
          if (matches(name)) { found = true; break; }
        }
        if (found) { await page.keyboard.press("Enter"); await page.waitForTimeout(700); }
        const outline = found ? await page.evaluate(`(() => { const s = getComputedStyle(document.activeElement); return s.outlineStyle + " " + s.outlineWidth; })()`) : null;
        results.push({ step: `press "${step.press}"${step.repeat ? ` (${repeat + 1}/${step.repeat})` : ""}`, ok: found, tabs, focusOutline: outline, note: step.note, ...(!found ? { recentFocus } : {}) });
        if (!found) { failed += 1; break; }
      }
    }
    await page.screenshot({ path: path.join(out, "walkthrough-end.png"), fullPage: true, timeout: 120_000 }).catch(() => undefined);
  } finally {
    const sha = (() => { try { return execSync("git rev-parse HEAD", { encoding: "utf8" }).trim(); } catch { return process.env.GITHUB_SHA ?? "unknown"; } })();
    writeFileSync(path.join(out, "walkthrough.json"), JSON.stringify({ labId, labVersion: definition.version, profile, expectedProfile, abortThreeChunk: abortThree, viewport, gitSha: sha, input: "keyboard only (Tab + Enter)", failedSteps: failed, pageErrors: errors, results,
      boundary: "Automated keyboard walkthrough in headless Chromium. It does not test real touch latency, screen readers or physical devices." }, null, 2));
    await browser.close();
  }
  console.log(`Walkthrough ${labId} ${profile}${abortThree ? " (three chunk aborted)" : ""}/${viewport}: ${failed} failed step(s).`);
  if (failed) process.exitCode = 1;
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
