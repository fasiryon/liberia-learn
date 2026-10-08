import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
const out = "artifacts/product-design-v2";
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ reducedMotion: "reduce" });
let mode = "ready";
const governed = { available: true, decisionId: "fixture-decision", sessionId: "fixture-decision", releaseId: "fixture-release", releaseIdentity: "fixture-release-identity", learnerStateRevision: "1", grade: 4, subject: "MATH", conceptLabel: "Addition and subtraction reasoning", action: { kind: "PRACTICE", reason: "Practice the learning question selected by the server." }, item: { id: "fixture-item", version: "1", prompt: "What is 2 + 3?", options: ["4", "5", "6"] }, toolPolicy: { allowed: [], prohibited: [] }, lessonHref: null };
await context.route("**/api/**", async (route) => {
  const url = route.request().url();
  if (mode === "loading") await new Promise((resolve) => setTimeout(resolve, 1500));
  if (mode === "error" && /today|next-action/.test(url)) return route.fulfill({ status: 503, json: { error: "unavailable" } });
  if (url.includes("next-action")) return route.fulfill({ json: mode === "empty" ? { available: false } : governed });
  if (url.includes("/today")) return route.fulfill({ json: { availability: mode === "stale" ? "stale" : "current", items: [], catchUpItems: [], completedCount: 2, remainingCount: 0 } });
  if (url.includes("/assignments")) return route.fulfill({ json: { assignments: mode === "empty" ? [] : [{ id: "assignment-fixture", title: "Reading for meaning", subject: "ENGLISH", dueAt: "2026-10-08T09:00:00Z", isOverdue: true, submission: null }] } });
  if (url.includes("teacher-lessons")) return route.fulfill({ json: { lessons: [] } });
  if (url.includes("inbox")) return route.fulfill({ json: { items: [], unreadCount: 0 } });
  if (url.includes("announcements")) return route.fulfill({ json: { announcements: [] } });
  return route.fulfill({ json: { sessions: [] } });
});
const page = await context.newPage();
page.setDefaultNavigationTimeout(120000);
page.setDefaultTimeout(60000);
const errors = []; page.on("pageerror", (error) => errors.push(error.message));
const results = [];
for (const grade of [2, 6]) for (const width of [320, 360, 390, 768, 1440]) {
  await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
  await page.goto(`http://127.0.0.1:3191/student/today?grade=${grade}`);
  await page.locator(".pdv2-hero .pdv2-action-primary").waitFor();
  await page.locator(".pdv2-plan-list h3").first().waitFor();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  assert.equal(overflow, false, `${grade}/${width} overflows`);
  const target = await page.locator(".pdv2-hero .pdv2-action-primary").boundingBox();
  assert(target.height >= (grade === 2 ? 56 : 48));
  const due = await page.getByRole("link", { name: "Open due work: Reading for meaning" }).boundingBox();
  const nav = await page.locator(".pdv2-nav").boundingBox();
  if (width <= 390) assert(due.y + due.height <= nav.y, `${grade}/${width} critical due CTA is below the first viewport: ${JSON.stringify({ due, nav })}`);
  const navCount = await page.locator("nav[aria-label=Student] a").count(); assert.equal(navCount, 5);
  await page.screenshot({ path: `${out}/today-g${grade}-${width}.png`, fullPage: true });
  if (width === 390 || width === 1440) await page.screenshot({ path: `${out}/viewport-g${grade}-${width}.png` });
  results.push({ grade, width, overflow, primaryTarget: target, firstDueTarget: due });
}
await page.setViewportSize({ width: 390, height: 844 });
await page.goto("http://127.0.0.1:3191/student/today?grade=6");
await page.locator(".pdv2-hero .pdv2-action-primary").click();
await page.getByText("What is 2 + 3?").waitFor();
assert.equal(new URL(page.url()).pathname, "/student/learn");
await page.getByRole("link", { name: "← Today", exact: true }).click();
await page.locator(".pdv2-hero .pdv2-action-primary").waitFor();
await page.getByRole("link", { name: "Open assignment: Reading for meaning" }).click();
assert(page.url().includes("/student/assignments/assignment-fixture"));
await page.goto("http://127.0.0.1:3191/student/today");
for (const label of ["Labs", "Progress", "Help"]) {
  await page.getByRole("navigation", { name: "Student", exact: true }).getByRole("link", { name: new RegExp(label) }).click();
  assert(page.url().includes(label === "Help" ? "ai-tutor" : label.toLowerCase()));
  await page.getByRole("link", { name: "Back to Today", exact: true }).click();
}
for (const state of ["empty", "error", "stale", "loading"]) {
  mode = state; await page.goto("http://127.0.0.1:3191/student/today");
  if (state === "loading") await page.getByText("Loading learning action…").waitFor();
  else if (state === "error") await page.getByText("Your next step is unavailable", { exact: true }).waitFor();
  else await page.locator(".pdv2-hero .pdv2-action-primary").waitFor();
  await page.screenshot({ path: `${out}/${state}-390.png`, fullPage: true });
}
mode = "ready"; await page.goto("http://127.0.0.1:3191/student/today");
await page.locator(".pdv2-hero .pdv2-action-primary").waitFor();
await page.evaluate(() => { Object.defineProperty(navigator, "onLine", { configurable: true, value: false }); dispatchEvent(new Event("offline")); });
await page.getByRole("button", { name: "Reconnect to continue" }).waitFor();
await page.screenshot({ path: `${out}/offline-390.png`, fullPage: true });
await page.addScriptTag({ path: "node_modules/axe-core/axe.min.js" });
const axe = await page.evaluate(async () => axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] } }));
await fs.writeFile(`${out}/browser-results.json`, JSON.stringify({ results, errors, axe: axe.violations, caveat: "Production components in explicit fixture harness; server destination/auth tests separate. No user study or real phone certification." }, null, 2));
assert.deepEqual(errors, []); assert.equal(axe.violations.filter((v) => ["serious", "critical"].includes(v.impact)).length, 0);
await browser.close(); console.log(`Browser fixtures passed: ${results.length} layouts, resume/return, assignment, five-nav, error/empty/stale/loading/offline; zero serious/critical axe issues.`);
