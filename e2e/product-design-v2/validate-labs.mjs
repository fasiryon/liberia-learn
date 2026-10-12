import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
/**
 * Labs hub showcase fixtures: an explicit server authority response (?showcase=) drives the production
 * LabsHubView and InteractiveLabScreen. Server authorization is certified by the server tests, not here.
 */
const out = "artifacts/demo-student-labs-ui";
await fs.mkdir(out, { recursive: true });
const base = "http://127.0.0.1:3191";
const WIDTHS = [320, 360, 390, 768, 1280, 1440];
const LABS = [["g4-solid-figures", "Solid figures"], ["fixture-lever", "Lever"], ["fixture-simple-circuit", "Simple circuit"], ["mount-coffee-hydropower", "Mount Coffee hydropower"]];
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ reducedMotion: "reduce" });
await context.route("**/api/**", (route) => route.fulfill({ json: {} }));
const page = await context.newPage();
page.setDefaultNavigationTimeout(120000); page.setDefaultTimeout(60000);
const errors = []; page.on("pageerror", (error) => errors.push(error.message));
const overflow = () => page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
const showcaseCards = page.locator("section[aria-labelledby=showcase-labs-title] article");
const evidence = { hub: [], routes: [], states: [], keyboard: null };

// A. Authorized demo response: four cards, readable titles, obvious Open actions, both age bands, every width.
for (const grade of [2, 6]) for (const width of WIDTHS) {
  await page.setViewportSize({ width, height: width >= 1280 ? 900 : 844 });
  await page.goto(`${base}/student/labs?showcase=all&grade=${grade}`);
  await showcaseCards.first().waitFor();
  assert.equal(await showcaseCards.count(), 4, `hub ${grade}/${width} card count`);
  assert.deepEqual(await showcaseCards.locator("h3").allTextContents(), LABS.map(([, title]) => title), `hub ${grade}/${width} titles`);
  assert.equal(await overflow(), false, `hub ${grade}/${width} overflows`);
  // Convergence: the showcase section owns the four labs; the ordinary Library tab never repeats them.
  assert.equal(await page.locator("nav[aria-label='Lab sections'] a[aria-current=page]").textContent().then((t) => t.startsWith("Library")), true, `hub ${grade}/${width} default tab`);
  assert.equal(await page.locator("section[aria-labelledby=labs-section-title] a[href^='/student/labs/']").count(), 0, `hub ${grade}/${width} Library duplicates showcase`);
  const metrics = await page.evaluate(() => [...document.querySelectorAll("section[aria-labelledby=showcase-labs-title] article")].map((card) => {
    const title = card.querySelector("h3"); const open = card.querySelector("a"); const box = open.getBoundingClientRect();
    return { clipped: title.scrollWidth > title.clientWidth + 1, openHeight: box.height, openVisible: box.width > 0 && getComputedStyle(open).visibility !== "hidden", href: open.getAttribute("href") };
  }));
  const target = grade <= 3 ? 56 : 44;
  for (const m of metrics) {
    assert.equal(m.clipped, false, `hub ${grade}/${width} title clipped`);
    assert(m.openVisible, `hub ${grade}/${width} Open hidden`);
    assert(m.openHeight >= target, `hub ${grade}/${width} Open ${m.openHeight}px < ${target}px`);
  }
  assert.deepEqual(metrics.map((m) => m.href), LABS.map(([id]) => `/student/labs/${id}`));
  await page.screenshot({ path: `${out}/hub-g${grade}-${width}.png`, fullPage: true });
  evidence.hub.push({ grade, width, cards: 4, overflow: false, minOpenHeight: Math.min(...metrics.map((m) => m.openHeight)) });
}

// B. Every Open action reaches a usable lab, it can be interacted with, and Back to Labs returns.
for (const width of [320, 390, 768, 1440]) for (const [labId, title] of LABS) {
  await page.setViewportSize({ width, height: width >= 1280 ? 900 : 844 });
  await page.goto(`${base}/student/labs?showcase=all&grade=6`);
  await page.getByRole("link", { name: new RegExp(`^Open lab\\s*: ${title}$`) }).click();
  await page.waitForURL(`**/student/labs/${labId}`);
  await page.getByRole("heading", { name: title }).waitFor();
  assert.equal(await page.getByText("This lab is not available.").count(), 0, `${labId}/${width} denied`);
  assert.equal(await overflow(), false, `${labId}/${width} intro overflows`);
  await page.getByRole("button", { name: "Start exploring" }).click();
  await page.getByRole("button", { name: "Start exploring" }).waitFor({ state: "detached" });
  // Phone portrait keeps controls in a bottom sheet; every layout must still offer working visible controls.
  await page.locator("main button:visible").nth(1).waitFor();
  const controls = await page.locator("main button:visible").count();
  assert(controls >= 2, `${labId}/${width} no lab controls`);
  const restart = page.getByRole("button", { name: /Restart lab/ });
  if (await restart.isVisible()) { await restart.click(); await page.getByRole("button", { name: "Keep my progress" }).click(); }
  const overflowed = await overflow();
  await page.screenshot({ path: `${out}/lab-${labId}-${width}.png`, fullPage: true });
  await page.getByRole("link", { name: "Back to Labs" }).click();
  await page.waitForURL("**/student/labs");
  await showcaseCards.first().waitFor();
  evidence.routes.push({ labId, width, controls, labOverflow: overflowed });
}

// C. Ordinary learner, explicit server denial and a partial grant: nothing beyond the grant is openable.
for (const [mode, expected] of [["none", []], ["fixture-simple-circuit", ["fixture-simple-circuit"]]]) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}/student/labs?showcase=${mode}&grade=6`);
  await page.locator("main h1").waitFor();
  const hrefs = await page.evaluate(() => [...document.querySelectorAll("main a[href^='/student/labs/']")].map((a) => a.getAttribute("href")));
  assert.deepEqual(hrefs, expected.map((id) => `/student/labs/${id}`), `${mode}: openable ${hrefs}`);
  if (!expected.length) {
    assert.equal(await page.locator("section[aria-labelledby=showcase-labs-title]").count(), 0, `${mode}: showcase section rendered`);
    await page.getByText("No released labs are available for your classes yet.").waitFor();
  }
  await page.screenshot({ path: `${out}/hub-${mode.replace(/[^a-z]/g, "-")}-390.png`, fullPage: true });
  for (const [labId] of LABS.filter(([id]) => !expected.includes(id))) {
    await page.goto(`${base}/student/labs/${labId}`);
    await page.getByText("This lab is not available.").waitFor();
    assert.equal(await page.getByRole("button", { name: "Start exploring" }).count(), 0, `${mode}: ${labId} opened`);
    await page.getByRole("link", { name: "Back to Labs" }).click();
    await page.waitForURL("**/student/labs");
  }
  evidence.states.push({ mode, openable: expected });
}

// D. Keyboard: Tab reaches each Open action with a visible focus indicator.
await page.setViewportSize({ width: 1280, height: 900 });
await page.goto(`${base}/student/labs?showcase=all&grade=6`);
await showcaseCards.first().waitFor();
const focused = [];
for (let i = 0; i < 80 && focused.length < 4; i++) {
  await page.keyboard.press("Tab");
  const info = await page.evaluate(() => { const el = document.activeElement; const style = getComputedStyle(el); return { text: el.textContent, inShowcase: !!el.closest("section[aria-labelledby=showcase-labs-title]"), outline: style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0 }; });
  if (info.inShowcase) { assert(info.outline, `no visible focus on ${info.text}`); focused.push(info.text); }
}
assert.equal(focused.length, 4, "keyboard did not reach all four Open actions");
await page.keyboard.press("Enter");
await page.waitForURL("**/student/labs/mount-coffee-hydropower");
evidence.keyboard = { reached: focused, enterOpens: true };

// E. Automated WCAG 2.2 AA checks on the hub (granted and ordinary) and each lab route.
const axe = {};
const audit = async (name, url, ready) => {
  await page.goto(url); await ready();
  await page.addScriptTag({ path: "node_modules/axe-core/axe.min.js" });
  const result = await page.evaluate(async () => axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] } }));
  axe[name] = result.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length }));
  assert.equal(result.violations.filter((v) => ["serious", "critical"].includes(v.impact)).length, 0, `${name}: ${JSON.stringify(axe[name])}`);
};
await page.setViewportSize({ width: 390, height: 844 });
await audit("hub-all", `${base}/student/labs?showcase=all&grade=6`, () => showcaseCards.first().waitFor());
await audit("hub-all-young", `${base}/student/labs?showcase=all&grade=2`, () => showcaseCards.first().waitFor());
await audit("hub-none", `${base}/student/labs?showcase=none&grade=6`, () => page.locator("main h1").waitFor());
for (const [labId, title] of LABS) await audit(`lab-${labId}`, `${base}/student/labs/${labId}?showcase=all`, () => page.getByRole("heading", { name: title }).waitFor());

await fs.writeFile(`${out}/results.json`, JSON.stringify({ ...evidence, axe, errors, caveat: "Production components with an explicit showcase grant fixture. Server authorization, real devices, GPUs and screen readers are not certified here." }, null, 2));
assert.deepEqual(errors, []);
await browser.close();
console.log(`Labs fixtures passed: ${evidence.hub.length} hub layouts, ${evidence.routes.length} open/interact/return runs, ${evidence.states.length} restricted states, keyboard reach, zero serious/critical axe issues.`);
