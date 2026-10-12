import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { createServer } from "vite";
/**
 * Lesson Experience V2 runtime: the production student lesson route clients (LessonViewerClient,
 * LessonDeliveryClient) and Lesson Player V2 against explicit fixture server responses shaped like the
 * delivery seam (GET /api/student/lessons/:id/experience). The fixture simulates a released native lesson;
 * release, eligibility and lab authorization are certified by the server tests, not here.
 */
const out = "artifacts/lesson-experience-v2-runtime";
await fs.mkdir(out, { recursive: true });
const base = "http://127.0.0.1:3191";
const WIDTHS = [320, 360, 390, 768, 1280, 1440];

// The fixture module is TypeScript: load it through the harness's Vite server.
const vite = await createServer({ configFile: "e2e/product-design-v2/vite.config.ts", server: { middlewareMode: true }, appType: "custom" });
const { runtimeLessonDelivery } = await vite.ssrLoadModule("/lessonFixtures.ts");
await vite.close();

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ reducedMotion: "reduce" });
const page = await context.newPage();
page.setDefaultNavigationTimeout(120000); page.setDefaultTimeout(60000);
const errors = []; page.on("pageerror", (error) => errors.push(error.message));
const evidence = { layouts: [], longContent: [], flows: [], assigned: null, states: [], offline: null, keyboard: null, reducedMotion: null, axe: {} };

// Server responses. `server.lesson(id)` decides what the delivery seam returns for a route id;
// `server.curriculum` what the legacy curriculum detail route returns.
const ok = (json) => ({ status: 200, json });
const server = { lesson: () => ok(runtimeLessonDelivery(6, { labAuthorized: true })), curriculum: () => ({ status: 404, json: { error: "Not found", offlineManifest: null } }), work: null };
await context.route("**/api/**", (route) => route.fulfill({ json: {} }));
await context.route("**/api/curriculum/**", (route) => { const r = server.curriculum(); return route.fulfill({ status: r.status, json: r.json }); });
await context.route("**/api/student/work/**", (route) => route.fulfill({ json: server.work }));
await context.route("**/api/student/lessons/*/experience", (route) => { const id = decodeURIComponent(new URL(route.request().url()).pathname.split("/").slice(-2)[0]); const r = server.lesson(id); return route.fulfill({ status: r.status, json: r.json }); });

const overflow = () => page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
const player = page.locator("[data-lesson-player-v2]");
const sceneId = () => player.getAttribute("data-scene-id");
const continueButton = () => page.locator("footer").getByRole("button", { name: /^(Continue|Finish)/ });
const resetStorage = () => page.evaluate(async () => { sessionStorage.clear(); await new Promise((resolve) => { const r = indexedDB.deleteDatabase("keyval-store"); r.onsuccess = r.onerror = r.onblocked = resolve; }); });
async function next(expected) { await continueButton().click(); await page.locator(`[data-lesson-player-v2][data-scene-id='${expected}']`).waitFor(); }
/** Walk from the first scene to `target`, completing each scene's interaction the way a learner would. */
async function walkTo(target) {
  const ORDER = ["intro", "goal", "explain", "watch", "diagram", "worked", "practice", "check", "lab", "reflect", "review", "final"];
  for (let current = await sceneId(); current !== target; current = await sceneId()) {
    if (current === "diagram") for (const label of ["Effort", "Fulcrum", "Load"]) await page.locator("button[aria-expanded]", { hasText: label }).click();
    if (current === "practice") await page.locator("input[name='p1']").first().check();
    if (current === "check") await page.locator("input[name='c1']").first().check();
    // A lab the server did not authorize is a viewed walkthrough scene; an authorized one offers the walkthrough too.
    if (current === "lab" && await page.locator("summary", { hasText: "Use the text walkthrough" }).count()) {
      const walkthrough = page.getByRole("button", { name: "I read the walkthrough" });
      if (!(await walkthrough.isVisible())) await page.locator("summary", { hasText: "Use the text walkthrough" }).click();
      await walkthrough.click();
    }
    if (current === "reflect") await page.locator("#reflect-r1").fill("Close to the bag.");
    await next(ORDER[ORDER.indexOf(current) + 1]);
  }
}
async function metrics(target) {
  return page.evaluate((min) => {
    const box = (el) => el.getBoundingClientRect();
    const footer = document.querySelector("footer"); const cont = [...footer.querySelectorAll("button")].pop(); const prev = footer.querySelector("button");
    const leave = document.querySelector("a[aria-label='Leave lesson']"); const h1 = document.querySelector("h1");
    const small = [cont, prev, leave, ...document.querySelectorAll("#lesson-scene label, #lesson-scene button")].filter((el) => el && box(el).width > 0 && box(el).height < min).map((el) => `${el.tagName}:${el.textContent.trim().slice(0, 30)}:${Math.round(box(el).height)}`);
    return { continueInView: box(cont).bottom <= innerHeight && box(cont).top >= 0, continueHeight: box(cont).height, leaveHeight: box(leave).height, h1Clipped: h1.scrollWidth > h1.clientWidth + 1, small };
  }, target);
}

// A. Every width, both age bands: first scene and a long scene are readable, reachable and not clipped.
for (const grade of [2, 6]) for (const width of WIDTHS) {
  server.lesson = () => ok(runtimeLessonDelivery(grade, { labAuthorized: true }));
  await page.setViewportSize({ width, height: width >= 1280 ? 900 : width >= 768 ? 1024 : 700 });
  await page.goto(`${base}/student/lesson/fixture-content-g${grade}?grade=${grade}`);
  await resetStorage(); await page.reload();
  await player.waitFor();
  const target = grade <= 3 ? 56 : 48;
  assert.equal(await player.getAttribute("data-age-band"), grade <= 3 ? "EARLY_PRIMARY" : "UPPER_PRIMARY");
  assert.equal(await overflow(), false, `g${grade}/${width} first scene overflows`);
  const first = await metrics(target);
  assert(first.continueInView, `g${grade}/${width} Continue not in view`);
  assert(first.continueHeight >= target && first.leaveHeight >= target, `g${grade}/${width} targets ${first.continueHeight}/${first.leaveHeight} < ${target}`);
  assert.deepEqual(first.small, [], `g${grade}/${width} small targets`);
  assert.equal(first.h1Clipped, false);
  await page.screenshot({ path: `${out}/scene1-g${grade}-${width}.png`, fullPage: true });
  await next("goal"); await next("explain");
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const long = await page.evaluate(() => {
    const items = [...document.querySelectorAll("#lesson-scene [data-key-points] li")]; const last = items[items.length - 1];
    const footer = document.querySelector("footer").getBoundingClientRect(); const cont = [...document.querySelectorAll("footer button")].pop().getBoundingClientRect();
    return { lastVisibleAboveFooter: last.getBoundingClientRect().bottom <= footer.top + 1, continueInView: cont.bottom <= innerHeight && cont.top >= 0, pageTaller: document.documentElement.scrollHeight > innerHeight };
  });
  assert(long.lastVisibleAboveFooter, `g${grade}/${width} long content hidden under the footer`);
  assert(long.continueInView, `g${grade}/${width} long content traps navigation`);
  assert.equal(await overflow(), false, `g${grade}/${width} long scene overflows`);
  await page.screenshot({ path: `${out}/long-g${grade}-${width}.png`, fullPage: false });
  evidence.layouts.push({ grade, width, overflow: false, continueHeight: first.continueHeight, leaveHeight: first.leaveHeight, target });
  evidence.longContent.push({ grade, width, ...long });
}

// B. Class → lesson → scene sequence → lab → return → assessment handoff → completion, both age bands.
for (const [grade, width] of [[6, 390], [2, 390], [6, 1440]]) {
  server.lesson = () => ok(runtimeLessonDelivery(grade, { labAuthorized: true }));
  await page.setViewportSize({ width, height: width >= 1280 ? 900 : 844 });
  await page.goto(`${base}/student/classes/fixture-math?grade=${grade}`);
  await resetStorage(); await page.reload();
  await page.locator("a[href='/student/lesson/c-2']").first().click();
  await page.waitForURL("**/student/lesson/c-2");
  await player.waitFor();
  assert.equal(await sceneId(), "intro");
  for (const id of ["goal", "explain", "watch", "diagram"]) await next(id);
  for (const label of ["Effort", "Fulcrum", "Load"]) await page.locator("button[aria-expanded]", { hasText: label }).click();
  await next("worked"); await next("practice");
  // Delivered formative items carry no key: the choice is recorded, never judged on the device.
  await page.locator("input[name='p1']").first().check();
  await page.getByText("Your choice is saved. This lesson does not mark it.").waitFor();
  await next("check");
  await page.locator("input[name='c1']").nth(1).check();
  await next("lab");
  await page.getByRole("button", { name: "Explore in Lab" }).click();
  await page.waitForURL("**/student/labs/fixture-lever?**");
  const labUrl = new URL(page.url());
  assert.equal(labUrl.searchParams.get("rt"), "c:c-2");
  assert.equal(labUrl.searchParams.get("scene"), "lab");
  await page.getByRole("button", { name: "Back to lesson" }).waitFor();
  assert.equal(await overflow(), false, `lab g${grade}/${width} overflows`);
  await page.screenshot({ path: `${out}/flow-lab-g${grade}-${width}.png`, fullPage: true });
  await page.getByRole("button", { name: "Back to lesson" }).click();
  await page.waitForURL("**/student/lesson/c-2**");
  await page.locator("[data-lesson-player-v2][data-scene-id='lab']").waitFor();
  await page.getByText("Welcome back. You are where you left the lesson.").waitFor();
  assert.equal(new URL(page.url()).search, "", "lab return parameters left in the address");
  await page.screenshot({ path: `${out}/flow-return-g${grade}-${width}.png`, fullPage: true });
  await next("reflect");
  await page.locator("#reflect-r1").fill("Close to the heavy bag.");
  await next("review"); await next("final");
  const seam = page.locator("[data-assessment-id]");
  assert.equal(await seam.getAttribute("data-assessment-scoring"), "SERVER_AUTHORITY");
  assert.equal((await page.content()).includes("correctIndex"), false);
  await page.locator("input[name='m1']").first().check();
  await page.locator("input[name='m2']").first().check();
  await page.screenshot({ path: `${out}/flow-handoff-g${grade}-${width}.png`, fullPage: true });
  await continueButton().click();
  const panel = page.locator("[data-finish-state]");
  await panel.waitFor();
  assert.equal(await panel.getAttribute("data-finish-state"), "PRESENTATION_ONLY");
  assert.match(await panel.textContent(), /saved on this device only/);
  // The outcome is brought into view and announced; the viewport capture shows what the learner sees.
  assert.equal(await page.evaluate(() => document.activeElement.id), "handoff-title");
  assert(await page.evaluate(() => { const r = document.getElementById("handoff-title").getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }), "finish outcome not in view");
  await page.screenshot({ path: `${out}/flow-finish-g${grade}-${width}.png`, fullPage: false });
  evidence.flows.push({ grade, width, start: "/student/classes/fixture-math", lessonHref: "/student/lesson/c-2", labRoute: labUrl.pathname, returnedToScene: "lab", finishState: "PRESENTATION_ONLY" });
}

// C. Assignment deep link (/student/lessons/:scheduledWorkId) keeps working and plays the native lesson.
server.work = { id: "sw-2", contentId: "c-2", contentVersion: "7", title: "Levers help us lift", subject: "SCIENCE", grade: 6, body: "", bodyStandard: "", bodyBlock: "", status: "in_progress", completedAt: null };
server.lesson = (id) => (id === "sw-2" ? ok(runtimeLessonDelivery(6)) : { status: 404, json: {} });
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${base}/student/lessons/sw-2?grade=6`);
await player.waitFor();
assert.equal(await page.locator("a[aria-label='Leave lesson']").getAttribute("href"), "/student/today");
assert.equal(await page.locator("main").count(), 1);
await page.screenshot({ path: `${out}/assigned-g6-390.png`, fullPage: true });
evidence.assigned = { href: "/student/lessons/sw-2", plays: true, exit: "/student/today" };

// D. Honest unavailable / restricted states.
const NONE = { status: 404, json: { compatibility: "UNAVAILABLE", error: "UNAVAILABLE" } };
for (const [name, delivery, curriculum, reason] of [
  ["revoked", NONE, { status: 410, json: { error: "Content revoked", offlineManifest: null } }, "REVOKED"],
  ["not-found", NONE, { status: 404, json: { error: "Not found", offlineManifest: null } }, "NOT_FOUND"],
  ["unreleased", ok(runtimeLessonDelivery(6, { releaseId: null })), NONE, "NOT_RELEASED"],
  ["incompatible-version", { status: 409, json: { compatibility: "UNAVAILABLE", error: "INCOMPATIBLE_VERSION" } }, NONE, "INCOMPATIBLE_VERSION"],
  ["not-ready", ok({ ...runtimeLessonDelivery(6), compatibility: "SOMETHING_ELSE" }), NONE, "NOT_STUDENT_READY"],
]) {
  server.lesson = () => delivery; server.curriculum = () => curriculum;
  for (const grade of [2, 6]) {
    await page.goto(`${base}/student/lesson/state-${name}?grade=${grade}`);
    const state = page.locator(`[data-lesson-unavailable='${reason}']`);
    await state.waitFor();
    assert.equal(await player.count(), 0);
    assert.equal(await page.getByRole("link", { name: "Back to Learn" }).getAttribute("href"), "/student/learn");
    assert.equal(await overflow(), false);
    await page.screenshot({ path: `${out}/state-${name}-g${grade}-390.png`, fullPage: true });
  }
  evidence.states.push({ name, reason, exit: "/student/learn" });
}
// A lesson with no server-authorized lab link: the lab scene teaches through its walkthrough only.
server.lesson = () => ok(runtimeLessonDelivery(6));
await page.goto(`${base}/student/lesson/no-lab?grade=6`);
await resetStorage(); await page.reload(); await player.waitFor();
await walkTo("lab");
assert.equal(await page.getByRole("button", { name: "Explore in Lab" }).count(), 0);
await page.getByText("Lab not available here").waitFor();
await page.screenshot({ path: `${out}/state-no-lab-link-g6-390.png`, fullPage: true });
evidence.states.push({ name: "no-authorized-lab-link", launchable: false, walkthrough: true });

// E. Offline during a current lesson: an explicit notice, nothing sent.
await context.setOffline(true);
await page.locator("[data-runtime-notice]").getByText("You are offline").waitFor();
await page.screenshot({ path: `${out}/offline-notice-g6-390.png`, fullPage: true });
await context.setOffline(false);
evidence.offline = { noticeShown: true, cachedReadOnlyCoveredBy: "__tests__/learner-experience/lesson-runtime-v2.test.tsx (signed offline cache cannot be produced in this harness)" };

// F. Keyboard: Tab reaches Continue with visible focus, Enter advances, focus lands on the new scene heading.
await page.setViewportSize({ width: 1280, height: 900 });
server.lesson = () => ok(runtimeLessonDelivery(6, { labAuthorized: true }));
await page.goto(`${base}/student/lesson/keyboard?grade=6`);
await resetStorage(); await page.reload(); await player.waitFor();
let reached = null;
for (let i = 0; i < 60 && !reached; i++) {
  await page.keyboard.press("Tab");
  const info = await page.evaluate(() => { const el = document.activeElement; const style = getComputedStyle(el); return { text: el.textContent.trim(), footer: !!el.closest("footer"), outline: style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0 }; });
  if (info.footer && info.text.startsWith("Continue")) reached = info;
}
assert(reached, "keyboard never reached Continue");
assert(reached.outline, "Continue has no visible focus");
await page.keyboard.press("Enter");
await page.locator("[data-lesson-player-v2][data-scene-id='goal']").waitFor();
assert.equal(await page.evaluate(() => document.activeElement.id), "scene-title");
const order = await page.evaluate(() => [...document.querySelectorAll("header p, main h1, footer button")].map((el) => el.tagName));
evidence.keyboard = { continueReached: true, visibleFocus: true, enterAdvances: true, focusAfterAdvance: "scene-title", readingOrder: order };

// G. Reduced motion: no animated progress transition.
evidence.reducedMotion = await page.evaluate(() => ({ progressTransition: getComputedStyle(document.querySelector("[role=progressbar] > div")).transitionDuration }));
// The global reduced-motion rule clamps transitions to 0.01ms.
assert(parseFloat(evidence.reducedMotion.progressTransition) <= 0.00001, `progress animates: ${evidence.reducedMotion.progressTransition}`);

// H. Automated WCAG 2.2 AA checks.
const audit = async (name, url, ready) => {
  await page.goto(url); await ready();
  await page.addScriptTag({ path: "node_modules/axe-core/axe.min.js" });
  const result = await page.evaluate(async () => axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] } }));
  evidence.axe[name] = result.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length }));
  assert.equal(result.violations.filter((v) => ["serious", "critical"].includes(v.impact)).length, 0, `${name}: ${JSON.stringify(evidence.axe[name])}`);
};
await page.setViewportSize({ width: 390, height: 844 });
for (const grade of [2, 6]) {
  server.lesson = () => ok(runtimeLessonDelivery(grade, { labAuthorized: true }));
  await audit(`scene1-g${grade}`, `${base}/student/lesson/axe-g${grade}?grade=${grade}`, async () => { await resetStorage(); await page.reload(); await player.waitFor(); });
  // Position is saved on the device, so each audit resumes where the previous walk stopped.
  for (const sceneName of ["diagram", "lab", "final"]) {
    await audit(`${sceneName}-g${grade}`, `${base}/student/lesson/axe-g${grade}?grade=${grade}`, async () => { await player.waitFor(); await walkTo(sceneName); });
  }
}
server.lesson = () => NONE; server.curriculum = () => ({ status: 410, json: { error: "Content revoked", offlineManifest: null } });
await audit("state-revoked", `${base}/student/lesson/axe-revoked?grade=6`, () => page.locator("[data-lesson-unavailable]").waitFor());
await audit("lab-from-lesson", `${base}/student/labs/fixture-lever?v=1&link=fixture-lever-link&exp=fixture-levers-g6&ver=1.0.0&scene=lab&activity=fixture-levers-g6&obj=fixture-obj-levers&rt=c%3Ac-2`, () => page.getByRole("button", { name: "Back to lesson" }).waitFor());

assert.deepEqual(errors, []);
await fs.writeFile(`${out}/results.json`, JSON.stringify({ ...evidence, errors, caveat: "Production lesson route clients and Lesson Player V2 with explicit fixture responses shaped like the delivery seam (a simulated released native lesson). Server release, eligibility and lab authorization, real devices and screen readers are not certified here." }, null, 2));
await browser.close();
console.log(`Lesson runtime browser fixtures passed: ${evidence.layouts.length} layouts, ${evidence.flows.length} full flows, ${evidence.states.length} states; zero serious/critical axe issues.`);
