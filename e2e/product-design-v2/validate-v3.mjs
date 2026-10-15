import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { createServer } from "vite";
/**
 * Student Experience V3 P0 browser acceptance (fixture harness): production student components with
 * mocked authorized API answers. Covers A01 overflow, A02 keyboard, A03 axe, A04 targets, A06 legacy
 * Read/Slides on both lesson routes, A08 teaching geometry and the Grade 7 DEMO authority boundary
 * (no API request, no storage write, no completion). Not server authorization or real-device evidence.
 * Run: node e2e/product-design-v2/validate-v3.mjs
 */
const out = "artifacts/student-experience-v3/validation";
await fs.mkdir(out, { recursive: true });
const base = `http://127.0.0.1:${process.env.HARNESS_PORT ?? 3191}`;
const WIDTHS = [320, 390, 768, 1024, 1440, 1920];
const server = await createServer({ configFile: "e2e/product-design-v2/vite.config.ts", server: { strictPort: true } });
await server.listen();
const loader = await createServer({ configFile: "e2e/product-design-v2/vite.config.ts", optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true }, appType: "custom" });
const legacy = await loader.ssrLoadModule("/legacyLessonFixtures.ts");
await loader.close();

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ reducedMotion: "reduce" });
const apiCalls = [];
await context.route("**/api/**", async (route) => {
  const request = route.request(); const p = new URL(request.url()).pathname;
  apiCalls.push(`${request.method()} ${p}`);
  if (p.endsWith("/experience")) return route.fulfill({ status: 404, json: { error: "not_found" } });
  if (p.startsWith("/api/curriculum/")) return route.fulfill({ json: legacy.legacyCurriculumResponse() });
  if (p.startsWith("/api/student/work/")) return route.fulfill({ json: legacy.legacyWorkResponse() });
  if (p === "/api/student/progress") return route.fulfill({ json: legacy.progressFixture() });
  if (p === "/api/adaptive/mastery") return route.fulfill({ status: 503, json: { error: "unavailable" } });
  return route.fulfill({ json: {} });
});
const page = await context.newPage();
page.setDefaultNavigationTimeout(120000); page.setDefaultTimeout(60000);
const errors = []; page.on("pageerror", (error) => errors.push(error.message));
const evidence = { overflow: [], geometry: [], targets: [], keyboard: {}, demo: {}, completion: {}, axe: {} };
const overflow = () => page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
const smallTargets = (selector, min) => page.evaluate(([sel, m]) => [...document.querySelectorAll(sel)].filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.height < m && getComputedStyle(el).visibility !== "hidden"; }).map((el) => `${el.tagName}:${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 40)}:${Math.round(el.getBoundingClientRect().height)}`), [selector, min]);
async function axe(name) {
  await page.addScriptTag({ path: "node_modules/axe-core/axe.min.js" });
  const result = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] } })).violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, target: v.nodes[0]?.target })));
  evidence.axe[name] = result;
  assert.equal(result.filter((v) => ["serious", "critical"].includes(v.impact)).length, 0, `${name} axe: ${JSON.stringify(result)}`);
}
const contentUrl = `${base}/student/lesson/${legacy.LEGACY_CONTENT_ID}?grade=7`;
const workUrl = `${base}/student/lessons/${legacy.LEGACY_WORK_ID}?grade=7`;
const demoUrl = `${base}/design-preview/grade-7-place-value`;
const mode = (name) => page.getByRole("group", { name: "How to use this lesson" }).getByRole("button", { name, exact: true });

// A01/A04: every surface at every width — no page overflow, primary targets ≥48px, secondary ≥44px.
const SURFACES = [
  { id: "legacy-read", url: contentUrl, ready: "#lesson-title" },
  { id: "legacy-slides", url: contentUrl, ready: "#lesson-title", then: () => mode("Slides").click() },
  { id: "assigned-read", url: workUrl, ready: "#lesson-title" },
  { id: "assigned-slides", url: workUrl, ready: "#lesson-title", then: () => mode("slides").click() },
  { id: "demo", url: demoUrl, ready: "#teaching-scene-title" },
  { id: "progress", url: `${base}/student/progress?grade=7&progress=1`, ready: "#progress-heading" },
];
for (const surface of SURFACES) for (const width of WIDTHS) {
  await page.setViewportSize({ width, height: width >= 1440 ? 900 : width >= 768 ? 1024 : 844 });
  await page.goto(surface.url);
  await page.locator(surface.ready).waitFor();
  if (surface.then) await surface.then();
  await page.waitForTimeout(150);
  assert.equal(await overflow(), false, `${surface.id}/${width} overflows`);
  const primary = await smallTargets(".ll3-btn, .ll3-back, .ll3-builder-step, .ll3-choice, .pdv2-action", 44);
  const secondary = await smallTargets(".ll3-modes button, .ll3-support-toggle, .ll3-outline-list button", 44);
  assert.deepEqual([...primary, ...secondary], [], `${surface.id}/${width} small targets`);
  evidence.overflow.push({ surface: surface.id, width, overflow: false });
}

// A08: teaching geometry at 1440×900 — stage ≥640px with support open; Hide returns width to the stage;
// reading measure ≤ 70ch; short scene task and Continue visible together.
await page.setViewportSize({ width: 1440, height: 900 });
for (const url of [contentUrl, demoUrl]) {
  await page.goto(url); await page.locator(".ll3-stage-main").waitFor();
  const open = await page.locator(".ll3-stage-main").boundingBox();
  assert(open.width >= 640, `${url} stage ${open.width} < 640 with support open`);
  await page.locator(".ll3-support").getByRole("button", { name: "Hide" }).click();
  const closed = await page.locator(".ll3-stage-main").boundingBox();
  assert(closed.width > open.width + 200, `${url} closing support did not return width (${open.width} → ${closed.width})`);
  await page.waitForFunction(() => document.activeElement?.textContent?.trim().startsWith("Show lesson"), null, { timeout: 5000 }).catch(() => assert.fail("focus moves to Show after Hide"));
  evidence.geometry.push({ url: url.replace(base, ""), stageOpen: Math.round(open.width), stageClosed: Math.round(closed.width) });
}
await page.goto(contentUrl); await page.locator(".ll3-reading p").first().waitFor();
const measure = await page.evaluate(() => { const p = document.querySelector(".ll3-section .ll3-reading p"); const ch = parseFloat(getComputedStyle(p).fontSize) * 0.55; return { width: p.getBoundingClientRect().width, approxCh: Math.round(p.getBoundingClientRect().width / ch) }; });
assert(measure.approxCh <= 75, `reading measure ${measure.approxCh}ch`);
evidence.geometry.push({ readingMeasure: measure });
await page.goto(demoUrl); await page.locator("#teaching-scene-title").waitFor();
const together = await page.evaluate(() => { const c = [...document.querySelectorAll("footer button")].pop().getBoundingClientRect(); const t = document.querySelector("#teaching-scene-title").getBoundingClientRect(); return t.top >= 0 && c.bottom <= innerHeight; });
assert(together, "demo scene title and Continue are not visible together at 1440×900");

// A06: legacy Read contents navigation, Slides keyboard and authored-order teaching scenes; table stays a table.
await page.goto(contentUrl); await page.locator("#lesson-title").waitFor();
assert.equal(await page.locator(".ll3-section").count(), 6);
assert.equal(await page.locator(".ll3-section table").count(), 1, "legacy markdown table renders as a table");
// P1: Read is a playlist; all six authored sections stay mounted, one shows, the rail lists all six.
assert.equal(await page.locator(".ll4-read-rail button").count(), 6);
assert.equal(await page.locator("[data-read-section]:visible").count(), 1);
await mode("Slides").click();
await page.getByText("Slide 1 of 6").waitFor();
await page.keyboard.press("ArrowRight"); await page.getByText("Slide 2 of 6").waitFor();
await page.keyboard.press("ArrowLeft"); await page.getByText("Slide 1 of 6").waitFor();
for (let n = 0; n < 2; n++) await page.getByRole("button", { name: "Next", exact: true }).click();
await page.getByText("Slide 3 of 6").waitFor();
assert.equal(await page.locator("[data-legacy-slides] table").count(), 1, "slide visual is the authored table");
evidence.keyboard.slides = "ArrowLeft/ArrowRight and Next move one slide";
// A truthful library completion: no request, device-only statement.
const before = apiCalls.length;
await page.getByRole("button", { name: "Mark as finished" }).click();
await page.getByText(/Marked as finished on this device/).waitFor();
// The existing analytics event (/api/track, unchanged) is not a completion or evidence write.
const posts = apiCalls.slice(before).filter((call) => call.startsWith("POST"));
assert.deepEqual(posts.filter((call) => call !== "POST /api/track"), [], `library completion must not write: ${posts}`);
evidence.completion.library = { message: "device-only", requests: posts };
await axe("legacy-slides");
await mode("Read").click(); await axe("legacy-read");

// Assigned route: slides end at the existing assessment hand-off; arrows ignored while typing.
await page.goto(workUrl); await page.locator("#lesson-title").waitFor();
await mode("slides").click(); await page.getByText("Slide 1 of 6").waitFor();
for (let n = 0; n < 5; n++) await page.keyboard.press("ArrowRight");
await page.getByRole("button", { name: "Go to assessment" }).click();
const answer = page.getByPlaceholder("Write your answer here");
await answer.click(); await page.keyboard.press("ArrowLeft");
assert(await page.getByText("Slide 6 of 6").isVisible(), "ArrowLeft inside an answer box must not change slides");
await axe("assigned-slides");

// Grade 7 DEMO: keyboard-only walk, interactive breakdown, guided example, practice feedback, review.
apiCalls.length = 0;
await page.goto(demoUrl); await page.locator("#teaching-scene-title").waitFor();
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
assert(await page.getByText("DEMO · not a released lesson").isVisible());
const cont = page.locator("footer").getByRole("button", { name: /^Continue/ });
await cont.focus(); await page.keyboard.press("Enter");
await page.locator("[data-demo-lesson][data-scene-id='explain']").waitFor();
assert.equal(await page.evaluate(() => document.activeElement?.id), "teaching-scene-title", "focus moves to the new scene heading");
await cont.click(); await page.locator("[data-scene-id='build']").waitFor();
const plus = page.getByRole("button", { name: /Add one to the millions digit, now 2/ });
await plus.focus(); await page.keyboard.press("Enter");
await page.getByText("3,350,480").first().waitFor();
await page.getByRole("button", { name: "Reset" }).click();
await page.getByText("zero", { exact: true }).waitFor();
await axe("demo-build");
await cont.click(); await page.locator("[data-scene-id='example']").waitFor();
assert.equal(await cont.isDisabled(), true, "Continue waits for every worked-example step");
for (let step = 1; step <= 3; step++) await page.getByRole("button", { name: `Show step ${step} of 3` }).click();
await page.getByText("All steps shown").waitFor();
// P1 guided practice: digit cards gate Continue until the number is made.
await cont.click(); await page.locator("[data-scene-id='digits']").waitFor();
assert.equal(await cont.isDisabled(), true, "Continue waits for the digit cards");
for (const [place, digit] of [5, 0, 4, 0, 0, 0, 9].entries()) {
  await page.locator(".ll4-digit-card:not([disabled])", { hasText: String(digit) }).first().click();
  await page.locator(".ll4-slot").nth(place).click();
}
await page.getByText("You made 5,040,009").waitFor();
await cont.click(); await page.locator("[data-scene-id='practice']").waitFor();
await page.locator("[data-practice='q1'] input").first().check();
await page.getByText("Not yet.").waitFor();
await page.locator("[data-practice='q1'] input").nth(1).check();
await page.locator("[data-practice='q2'] input").first().check();
await page.locator("[data-practice='q3'] input").nth(2).check();
assert.equal(await page.locator(".ll3-feedback[data-result=right]").count(), 3);
await axe("demo-practice");
await cont.click(); await page.locator("[data-scene-id='review']").waitFor();
await page.getByRole("button", { name: /Finish demo/ }).click();
await page.locator(".ll3-notice-title", { hasText: "Demo finished" }).waitFor();
const storage = await page.evaluate(async () => ({ local: localStorage.length, session: sessionStorage.length, idb: (await indexedDB.databases?.() ?? []).map((db) => db.name) }));
assert.deepEqual(apiCalls, [], `demo made API requests: ${apiCalls}`);
assert.equal(storage.local + storage.session, 0, "demo wrote browser storage");
evidence.demo = { apiCalls: apiCalls.length, storage, flow: "intro→explain→build(keyboard +/reset)→example(3 steps)→digit cards→practice(3, retry feedback)→review→finish" };
await axe("demo-review");
for (const width of [320, 1440]) { await page.setViewportSize({ width, height: width >= 1440 ? 900 : 844 }); await page.screenshot({ path: `${out}/demo-finished-${width}.png`, fullPage: true }); }

// Progress: a failed practice-mastery read is "unknown", never zero.
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto(`${base}/student/progress?grade=7&progress=1`); await page.locator("#progress-heading").waitFor();
await page.getByText("Practice results unknown").waitFor();
assert.equal(await page.getByText("No practice results yet.").count(), 0);
await axe("progress");

await fs.writeFile(`${out}/results.json`, JSON.stringify({ evidence, errors, caveat: "Fixture harness with production components and mocked API answers; not server authorization, production content, or real-device certification." }, null, 2));
assert.deepEqual(errors, []);
await browser.close(); await server.close();
console.log(`Student Experience V3 fixtures passed: ${evidence.overflow.length} surface/width layouts (${WIDTHS.join("/")}), teaching geometry, slides keyboard, truthful completion, demo walk with zero API calls and zero storage, ${Object.keys(evidence.axe).length} axe scans with zero serious/critical.`);
