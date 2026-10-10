import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
/** Shell polish + Learn V2 fixtures. Production components, mocked authorized APIs; no server auth or real-device certification. */
const out = "artifacts/product-design-v2/learn";
await fs.mkdir(out, { recursive: true });
const base = "http://127.0.0.1:3191";
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ reducedMotion: "reduce" });
const LONG = "Understanding equivalent fractions with number lines, fraction strips and real market examples from Monrovia";
let mode = "ready";
const governed = (label = "Equivalent fractions") => ({ available: true, decisionId: "fixture-decision", sessionId: "fixture-session", releaseId: "fixture-release", releaseIdentity: "fixture-identity", learnerStateRevision: "1", grade: 4, subject: "MATH", conceptLabel: label, action: { kind: "PRACTICE", reason: "Practice the learning question selected by the server." }, item: { id: "fixture-item", version: "1", prompt: "Which fraction is equal to 1/2?", options: ["2/4", "1/3", "3/5"] }, toolPolicy: { allowed: [], prohibited: [] }, lessonHref: "/student/lesson/fixture-lesson" });
const units = (long) => [{ unitId: "u-1", unitName: long ? LONG : "Fractions on a number line", subject: "MATH", grade: 4, completedCount: 2, totalCount: 5, completionPct: 40 }, { unitId: "u-2", unitName: "Reading for meaning", subject: "ENGLISH", grade: 4, completedCount: 0, totalCount: 4, completionPct: 0 }];
const catalog = (long) => ({ studentId: "fixture-student", grade: 4, page: 1, totalPages: 1, items: [{ contentId: "c-1", displayTitle: long ? LONG : "Comparing fractions", subject: "MATH", grade: 4 }, { contentId: "c-2", displayTitle: "Main idea and details", subject: "ENGLISH", grade: 4 }], subjectCompletion: [{ subject: "MATH", total: 10, completed: 3 }, { subject: "ENGLISH", total: 8, completed: 1 }] });
const assignments = (long) => ({ assignments: [{ id: "a-1", title: long ? LONG : "Fractions worksheet", subject: "MATH", dueAt: "2026-10-08T09:00:00Z", isOverdue: true, submission: null }, { id: "a-2", title: "Story summary", subject: "ENGLISH", dueAt: "2026-10-12T09:00:00Z", isOverdue: false, submission: null }] });
const unitDetail = { unitId: "u-1", unitName: "Fractions on a number line", subject: "MATH", grade: 4, completedCount: 1, totalCount: 3, completionPct: 33, lessons: [
  { contentId: "l1", title: "What is a fraction?", orderInUnit: 1, lessonType: "lesson", status: "completed", scheduledWorkId: null, locked: false, href: "/student/lesson/l1" },
  { contentId: "l2", title: "Fractions on a number line", orderInUnit: 2, lessonType: "lesson", status: "current", scheduledWorkId: null, locked: false, href: "/student/lesson/l2" },
  { contentId: "l3", title: "Comparing fractions", orderInUnit: 3, lessonType: "check", status: "upcoming", scheduledWorkId: null, locked: true, href: "/student/lesson/l3" }] };
await context.route("**/api/**", async (route) => {
  const url = route.request().url();
  const long = mode === "long";
  if (mode === "loading") await new Promise((resolve) => setTimeout(resolve, 1500));
  if (mode === "error" && /next-action|units|lessons|assignments/.test(url)) return route.fulfill({ status: 503, json: { error: "unavailable" } });
  if (mode === "offline" && /next-action|units|lessons|assignments/.test(url)) return route.abort("internetdisconnected");
  if (url.includes("next-action")) {
    if (route.request().method() === "POST") return route.fulfill({ json: { correct: true, learnerState: { mastery: { level: "DEVELOPING", observedScore: 1 }, confidence: { level: "LOW" } } } });
    return route.fulfill({ json: mode === "none" ? { available: false } : mode === "no-resource" ? { available: false, status: "NO_VALID_RESOURCE" } : governed(long ? LONG : undefined) });
  }
  if (url.includes("/units/active")) return route.fulfill({ json: mode === "empty" ? [] : units(long) });
  if (url.includes("/units/u-1")) return route.fulfill({ json: unitDetail });
  if (url.includes("/units/")) return route.fulfill({ status: 404, json: { error: "unit_not_found" } });
  if (url.includes("/lessons")) return route.fulfill({ json: mode === "empty" ? { ...catalog(), items: [], subjectCompletion: [] } : catalog(long) });
  if (url.includes("/assignments")) return mode === "restricted" ? route.fulfill({ status: 403, json: { error: "forbidden" } }) : route.fulfill({ json: mode === "empty" ? { assignments: [] } : assignments(long) });
  if (url.includes("/today")) return route.fulfill({ json: { availability: "current", items: [], catchUpItems: [], completedCount: 2, remainingCount: 0 } });
  if (url.includes("teacher-lessons")) return route.fulfill({ json: { lessons: [] } });
  if (url.includes("inbox")) return route.fulfill({ json: { items: [], unreadCount: 0 } });
  if (url.includes("announcements")) return route.fulfill({ json: { announcements: [] } });
  return route.fulfill({ json: { sessions: [] } });
});
const page = await context.newPage();
page.setDefaultNavigationTimeout(120000); page.setDefaultTimeout(60000);
const errors = []; page.on("pageerror", (error) => errors.push(error.message));
const evidence = { shell: [], learn: [], states: [], a11y: {} };
const overflow = () => page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
const OLD_LAYOUT = ".pdv2-shell :where(.pdv2-today,.pdv2-secondary){max-width:1280px!important;margin-left:auto!important;margin-right:auto!important;padding-left:32px!important;padding-right:32px!important}";
async function gutter() {
  return page.evaluate(() => {
    const rail = document.querySelector(".pdv2-rail").getBoundingClientRect();
    const main = document.querySelector("main.pdv2-today");
    const box = main.getBoundingClientRect(); const style = getComputedStyle(main);
    const contentLeft = box.left + parseFloat(style.paddingLeft); const contentRight = box.right - parseFloat(style.paddingRight);
    return { railRight: Math.round(rail.right), contentLeft: Math.round(contentLeft), gap: Math.round(contentLeft - rail.right), rightSpace: Math.round(innerWidth - contentRight), contentWidth: Math.round(contentRight - contentLeft) };
  });
}

// A. Wide-screen shell: content starts beside the rail; measured before (old CSS re-applied) and after.
for (const route of ["/student/today", "/student/learn"]) for (const width of [1280, 1440, 1600, 1920]) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`${base}${route}?grade=6`);
  await page.locator("main.pdv2-today h1").waitFor();
  const after = await gutter();
  assert.equal(await overflow(), false, `${route}/${width} overflows`);
  assert(after.gap >= 24 && after.gap <= 40, `${route}/${width} gutter ${after.gap}`);
  assert(after.rightSpace >= 24, `${route}/${width} right space ${after.rightSpace}`);
  const style = await page.addStyleTag({ content: OLD_LAYOUT });
  const before = await gutter();
  await style.evaluate((node) => node.remove());
  // B. Visible desktop sign out in the rail utility area, through the safe-logout page.
  const signOut = page.locator(".pdv2-rail-support").getByRole("link", { name: "Sign out", exact: true });
  assert(await signOut.isVisible(), `${route}/${width} sign out hidden`);
  assert.equal(await signOut.getAttribute("href"), "/signout");
  const box = await signOut.boundingBox(); assert(box.y + box.height <= 900, `${route}/${width} sign out below the viewport`);
  assert.equal(await page.locator("nav[aria-label=Student] a").count(), 5);
  assert.equal(await page.locator("nav[aria-label=Student]").getByText("Sign out").count(), 0);
  if (width === 1440 || width === 1920) await page.screenshot({ path: `${out}/shell-${route.split("/").pop()}-${width}.png` });
  evidence.shell.push({ route, width, before, after });
}
// Account and preferences remain; mobile account menu exposes sign out without crowding the nav.
assert(await page.getByText("Account and preferences", { exact: true }).isVisible());
for (const width of [390, 360, 320]) {
  await page.setViewportSize({ width, height: 844 });
  await page.goto(`${base}/student/learn?grade=6`);
  await page.locator("main.pdv2-today h1").waitFor();
  assert.equal(await page.locator(".pdv2-rail-support").isVisible(), false);
  const menu = page.locator(".pdv2-account-menu summary");
  assert(await menu.isVisible(), `${width} account menu hidden`);
  const target = await menu.boundingBox(); assert(target.height >= 44);
  await menu.click();
  const signOut = page.locator(".pdv2-account-menu").getByRole("link", { name: "Sign out", exact: true });
  assert(await signOut.isVisible()); assert.equal(await signOut.getAttribute("href"), "/signout");
  assert.equal(await overflow(), false, `${width} overflows with menu open`);
  if (width === 390) await page.screenshot({ path: `${out}/shell-account-menu-390.png` });
  await page.keyboard.press("Escape"); await menu.click();
  const nav = page.locator("nav[aria-label=Student] a"); assert.equal(await nav.count(), 5);
  for (let i = 0; i < 5; i++) { const b = await nav.nth(i).boundingBox(); assert(b.height >= 48 && b.width >= 44, `${width} nav item ${i} too small`); }
}
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto(`${base}/student/learn?grade=6`);
await page.locator(".pdv2-rail-support").getByRole("link", { name: "Sign out" }).click();
assert.equal(new URL(page.url()).pathname, "/signout");

// D. Learn composition across bands and widths.
for (const grade of [2, 6]) for (const width of [320, 360, 390, 768, 1440]) {
  await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
  await page.goto(`${base}/student/learn?grade=${grade}`);
  await page.locator(".pdv2-learn-option").first().waitFor();
  await page.locator("a[aria-label='Open unit: Fractions on a number line']").waitFor();
  assert.equal(await overflow(), false, `learn ${grade}/${width} overflows`);
  const min = grade === 2 ? 56 : 48;
  const options = page.locator(".pdv2-learn-option");
  for (let i = 0; i < await options.count(); i++) assert((await options.nth(i).boundingBox()).height >= min, `option ${i} below ${min}px at ${grade}/${width}`);
  const submit = await page.getByRole("button", { name: grade === 2 ? "Check answer" : "Submit answer" }).boundingBox();
  assert(submit.height >= min);
  const heading = await page.locator("#current-learning-heading").boundingBox();
  const order = await page.evaluate(() => [...document.querySelectorAll("main h2")].map((h) => h.textContent));
  assert.equal(order.indexOf("Your learning path"), 1, `governed task not first at ${grade}/${width}`);
  const nav = await page.locator(".pdv2-nav").boundingBox();
  if (width < 768) assert(heading.y + heading.height < nav.y, `${grade}/${width} task heading not in first viewport`);
  await page.screenshot({ path: `${out}/learn-g${grade}-${width}.png`, fullPage: true });
  if (width === 390 || width === 1440) await page.screenshot({ path: `${out}/learn-viewport-g${grade}-${width}.png` });
  evidence.learn.push({ grade, width, submitTarget: submit, taskHeadingTop: heading.y });
}
await page.setViewportSize({ width: 1920, height: 1000 });
await page.goto(`${base}/student/learn?grade=6`); await page.locator(".pdv2-learn-option").first().waitFor();
await page.screenshot({ path: `${out}/learn-viewport-g6-1920.png` });
// Direct activation: answer the governed task in place, no chooser or second Start.
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${base}/student/today?grade=6`);
await page.locator(".pdv2-hero .pdv2-action-primary").click();
await page.getByText("Which fraction is equal to 1/2?").waitFor();
await page.getByLabel("2/4").check();
await page.getByRole("button", { name: "Submit answer" }).click();
await page.getByText("✓ Correct. Well done.").waitFor();
assert.equal(new URL(page.url()).pathname, "/student/learn");
// Keyboard: skip link lands in content; the task's first control is reached before discovery; focus is visible.
await page.goto(`${base}/student/learn?grade=6`); await page.locator(".pdv2-learn-option").first().waitFor();
await page.keyboard.press("Tab"); assert.equal(await page.evaluate(() => document.activeElement?.textContent), "Skip to learning");
await page.keyboard.press("Enter");
const sequence = [];
for (let i = 0; i < 6; i++) { await page.keyboard.press("Tab"); sequence.push(await page.evaluate(() => { const el = document.activeElement; return { text: el?.getAttribute("aria-label") ?? el?.textContent?.trim() ?? el?.tagName, inTask: !!el?.closest(".pdv2-learn-current"), outline: getComputedStyle(el).outlineStyle }; })); }
assert(sequence.slice(0, 4).some((step) => step.inTask), `task not reached early by keyboard: ${JSON.stringify(sequence)}`);
assert(sequence.every((step) => step.outline !== "none"), "focus not visible");
evidence.a11y.keyboard = sequence;
// Reduced motion and forced colors.
evidence.a11y.reducedMotionTransition = await page.locator(".pdv2-action").first().evaluate((el) => getComputedStyle(el).transitionDuration);
assert.equal(evidence.a11y.reducedMotionTransition, "0s", `motion not reduced: ${evidence.a11y.reducedMotionTransition}`);
await page.emulateMedia({ forcedColors: "active" });
await page.goto(`${base}/student/learn?grade=6`); await page.locator(".pdv2-learn-option").first().waitFor();
assert(parseFloat(await page.locator(".pdv2-learn-option").first().evaluate((el) => getComputedStyle(el).borderTopWidth)) >= 2);
await page.screenshot({ path: `${out}/learn-forced-colors-390.png`, fullPage: true });
await page.emulateMedia({ forcedColors: "none" });
// 200% zoom of a 1280px desktop (640 CSS px) and 400% (320 CSS px) reflow.
for (const width of [640, 320]) { await page.setViewportSize({ width, height: 800 }); await page.goto(`${base}/student/learn?grade=6`); await page.locator(".pdv2-learn-option").first().waitFor(); assert.equal(await overflow(), false, `zoom ${width} overflows`); }
await page.setViewportSize({ width: 640, height: 800 }); await page.screenshot({ path: `${out}/learn-zoom200-1280.png`, fullPage: true });

// States, captured at 390.
await page.setViewportSize({ width: 390, height: 844 });
const states = {
  loading: async () => page.getByText("Loading your learning activity…").waitFor(),
  none: async () => page.getByText("No activity is ready right now").waitFor(),
  "no-resource": async () => page.getByText("Ask your teacher for your next step", { exact: false }).waitFor(),
  empty: async () => { await page.getByText("No units are scheduled for your class this week.").waitFor(); await page.getByText("No open assignments right now.").waitFor(); },
  error: async () => { await page.getByText("Your units could not load. This does not mean you have none.").waitFor(); assert.equal(await page.getByText("No open assignments right now.").count(), 0); },
  restricted: async () => page.locator("[aria-labelledby=assigned-heading]").getByText("Restricted").waitFor(),
  long: async () => { await page.getByRole("heading", { name: LONG }).waitFor(); assert.equal(await overflow(), false); },
};
for (const [state, check] of Object.entries(states)) {
  mode = state; await page.goto(`${base}/student/learn?grade=6`); await check();
  if (state === "long") for (const width of [320, 1440]) { await page.setViewportSize({ width, height: 844 }); assert.equal(await overflow(), false, `long ${width}`); await page.screenshot({ path: `${out}/state-long-${width}.png`, fullPage: true }); }
  else await page.screenshot({ path: `${out}/state-${state}-390.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  evidence.states.push(state);
}
// Stale: good load, then refresh fails; offline: saved activity is read-only.
mode = "ready"; await page.goto(`${base}/student/learn?grade=6`); await page.locator(".pdv2-learn-option").first().waitFor();
mode = "offline";
await page.evaluate(() => { Object.defineProperty(navigator, "onLine", { configurable: true, value: false }); dispatchEvent(new Event("offline")); });
await page.getByRole("button", { name: "Refresh" }).click();
await page.getByText("Your assignments could not refresh. These may have changed.").waitFor();
await page.getByText("Lists show what was last loaded").waitFor();
await page.screenshot({ path: `${out}/state-stale-offline-390.png`, fullPage: true });
await page.goto(`${base}/student/learn?grade=6`);
await page.getByText("Last saved · read-only").waitFor();
assert(await page.getByRole("button", { name: "Submit answer" }).isDisabled());
assert(await page.getByLabel("2/4").isDisabled());
await page.screenshot({ path: `${out}/state-offline-cached-390.png`, fullPage: true });
evidence.states.push("stale", "offline-cached");
mode = "ready";

// Unit (locked) and lessons pages.
await page.goto(`${base}/student/units/u-1?grade=6`);
await page.getByText("Locked · finish earlier lessons first").waitFor();
assert.equal(await page.locator("a[href='/student/lesson/l3']").count(), 0);
assert.equal(await page.locator("nav[aria-label=Student] a[aria-current=page]").textContent().then((t) => t.includes("Learn")), true);
await page.screenshot({ path: `${out}/unit-locked-390.png`, fullPage: true });
await page.goto(`${base}/student/units/missing?grade=6`); await page.getByText("This unit isn't available", { exact: false }).waitFor();
await page.screenshot({ path: `${out}/unit-unavailable-390.png`, fullPage: true });
await page.goto(`${base}/student/lessons?grade=6`); await page.getByRole("heading", { name: "Math" }).waitFor();
assert.equal(await overflow(), false);
await page.screenshot({ path: `${out}/lessons-390.png`, fullPage: true });

// Automated WCAG 2.2 AA checks on each surface.
const axeRuns = {};
for (const [name, url, ready] of [["learn", "/student/learn?grade=6", ".pdv2-learn-option"], ["learn-young", "/student/learn?grade=2", ".pdv2-learn-option"], ["unit", "/student/units/u-1?grade=6", ".pdv2-learn-steps"], ["lessons", "/student/lessons?grade=6", ".pdv2-learn-group"]]) {
  await page.goto(`${base}${url}`); await page.locator(ready).first().waitFor();
  if (name === "learn") await page.locator(".pdv2-account-menu summary").click();
  await page.addScriptTag({ path: "node_modules/axe-core/axe.min.js" });
  const result = await page.evaluate(async () => axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] } }));
  axeRuns[name] = result.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length }));
  assert.equal(result.violations.filter((v) => ["serious", "critical"].includes(v.impact)).length, 0, `${name}: ${JSON.stringify(axeRuns[name])}`);
}
evidence.a11y.axe = axeRuns;
await fs.writeFile(`${out}/learn-results.json`, JSON.stringify({ ...evidence, errors, caveat: "Production components in an explicit fixture harness with mocked authorized APIs. Server authorization, real devices, screen readers and user studies are not certified here." }, null, 2));
assert.deepEqual(errors, []);
await browser.close();
console.log(`Learn/shell fixtures passed: ${evidence.shell.length} wide-shell layouts, ${evidence.learn.length} Learn layouts, states ${evidence.states.join("/")}, keyboard/forced-colors/reduced-motion/zoom, zero serious/critical axe issues.`);
