import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
/**
 * My Classes / class schedule convergence fixtures, plus the governed-task-first hierarchy on Today
 * and Learn for both age bands at every review width. Production components with mocked authorized
 * APIs and explicit fixture models; server authorization is certified by the server tests, not here.
 */
const out = "artifacts/student-classes-v2";
await fs.mkdir(out, { recursive: true });
const base = "http://127.0.0.1:3191";
const WIDTHS = [320, 360, 390, 768, 1280, 1366, 1440, 1920];
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ reducedMotion: "reduce" });
let classesStatus = 200;
const open = (href) => ({ state: "open", locked: false, href });
const governed = { available: true, decisionId: "fixture-decision", sessionId: "fixture-session", releaseId: "fixture-release", releaseIdentity: "fixture-identity", learnerStateRevision: "1", grade: 4, subject: "MATH", conceptLabel: "Equivalent fractions", action: { kind: "PRACTICE", reason: "Practice the learning question selected by the server." }, item: { id: "fixture-item", version: "1", prompt: "Which fraction is equal to 1/2?", options: ["2/4", "1/3", "3/5"] }, toolPolicy: { allowed: [], prohibited: [] }, lessonHref: null };
const discovery = { schemaVersion: "learn-discovery/2", availability: "current", freshness: "current", generatedAt: new Date().toISOString(),
  currentLearning: { availability: "separate", endpoint: "/api/student/learning-authority/next-action" },
  subjects: [{ subject: "MATH", label: "MATH" }], subjectCompletion: [{ subject: "MATH", total: 10, completed: 3, completionRate: 30 }],
  lessons: { availability: "current", total: 24, items: [] },
  activeUnits: { availability: "current", eligibility: "eligible", items: [{ ...open("/student/units/u-1"), unitId: "u-1", title: "Fractions on a number line", subject: "MATH", grade: 4, lessons: [] }] },
  assignedWork: { availability: "current", items: [{ ...open("/student/assignments"), assignmentHref: "/student/assignments", id: "a-1", title: "Fractions worksheet", subject: "MATH", dueAt: "2026-10-08T09:00:00Z", content: null }] },
  checks: { availability: "current", total: 0, items: [] },
  resources: { availability: "empty", items: [], destinations: [{ title: "Textbooks", href: "/student/textbooks" }], compiledBooks: "deferred" },
  search: { availability: "deferred" }, limits: { perSection: 100, linkedContent: 200, catalogBoundReached: false } };
// GET /api/student/classes from the enrollment authority.
const classes = { classes: [
  { classId: "fixture-math", className: "Grade 6A Mathematics", subject: "MATH", grade: 6, teacher: "Mr. Joseph Kollie", school: "Monrovia Central Public School" },
  { classId: "fixture-social", className: "Grade 6A Social Studies", subject: "SOCIAL_STUDIES", grade: 6, teacher: null, school: "Monrovia Central Public School" }] };
await context.route("**/api/**", async (route) => {
  const url = new URL(route.request().url());
  if (url.pathname.includes("next-action")) return route.fulfill({ json: governed });
  if (url.pathname === "/api/student/learn") return route.fulfill({ json: discovery });
  if (url.pathname === "/api/student/classes") return route.fulfill(classesStatus === 200 ? { json: classes } : { status: classesStatus, json: { error: "Unauthorized" } });
  if (url.pathname.includes("/assignments")) return route.fulfill({ json: { assignments: [{ id: "a-1", title: "Fractions worksheet", subject: "MATH", dueAt: "2026-10-08T09:00:00Z", isOverdue: true, submission: null }] } });
  if (url.pathname.includes("/today")) return route.fulfill({ json: { availability: "current", items: [], catchUpItems: [], completedCount: 2, remainingCount: 0 } });
  if (url.pathname.includes("teacher-lessons")) return route.fulfill({ json: { lessons: [] } });
  if (url.pathname.includes("inbox")) return route.fulfill({ json: { items: [], unreadCount: 0 } });
  if (url.pathname.includes("announcements")) return route.fulfill({ json: { announcements: [] } });
  return route.fulfill({ json: { sessions: [] } });
});
const page = await context.newPage();
page.setDefaultNavigationTimeout(120000); page.setDefaultTimeout(60000);
const errors = []; page.on("pageerror", (error) => errors.push(error.message));
const overflow = () => page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
const evidence = { hierarchy: [], pages: [] };

// A. Governed current-learning task first on Today and Learn, both age bands, every review width.
for (const grade of [2, 6]) for (const width of WIDTHS) {
  await page.setViewportSize({ width, height: width >= 1280 ? 900 : 844 });
  await page.goto(`${base}/student/learn?grade=${grade}`);
  await page.locator(".pdv2-learn-option").first().waitFor();
  await page.locator("[aria-labelledby=my-classes-heading] .pdv2-row-title").first().waitFor();
  const order = await page.evaluate(() => [...document.querySelectorAll("main h2")].map((h) => h.textContent));
  assert.equal(order.indexOf("Your learning path"), 1, `learn: governed task not first at ${grade}/${width}`);
  const [task, path] = await Promise.all([page.locator(".pdv2-learn-current").boundingBox(), page.locator("[aria-labelledby=path-heading]").boundingBox()]);
  assert(task.y < path.y, `learn: governed task not visually first at ${grade}/${width}`);
  assert.equal(await overflow(), false, `learn ${grade}/${width} overflows`);
  await page.goto(`${base}/student/today?grade=${grade}`);
  await page.locator(".pdv2-hero .pdv2-action-primary").first().waitFor();
  const first = await page.evaluate(() => document.querySelector("main.pdv2-today > :not(header)")?.className ?? "");
  assert(first.includes("pdv2-hero"), `today: next step not first at ${grade}/${width} (${first})`);
  assert.equal(await overflow(), false, `today ${grade}/${width} overflows`);
  evidence.hierarchy.push({ grade, width, learnOrder: order.slice(0, 2), todayFirst: "pdv2-hero" });
}

// B. Class pages at every review width; screenshots for product review.
const PAGES = [["classes", "/student/classes", "Learn"], ["detail", "/student/classes/fixture-math", "Learn"], ["schedule", "/student/schedule", "Today"], ["week", "/student/schedule?view=week", "Today"]];
for (const [name, route, active] of PAGES) for (const width of WIDTHS) {
  await page.setViewportSize({ width, height: width >= 1280 ? 900 : 844 });
  await page.goto(`${base}${route}${route.includes("?") ? "&" : "?"}grade=6`);
  await page.locator("main h1").waitFor();
  assert.equal(await overflow(), false, `${name}/${width} overflows`);
  const nav = page.locator("nav[aria-label=Student] a"); assert.equal(await nav.count(), 5, `${name}/${width} primary nav`);
  assert((await page.locator("nav[aria-label=Student] a[aria-current=page]").textContent()).includes(active), `${name}/${width} active destination`);
  const hrefs = await page.evaluate(() => [...document.querySelectorAll("main a[href]")].map((a) => a.getAttribute("href")));
  assert(hrefs.every((href) => /^\/student\//.test(href)), `${name}/${width} non-learner link: ${hrefs.join(", ")}`);
  // Action labels never break inside a word ("Ope / n"): single-line button heights only.
  const tall = await page.evaluate(() => [...document.querySelectorAll(".pdv2-class-card-head .pdv2-action, main .pdv2-plan-list > li > .pdv2-action")].filter((el) => el.getBoundingClientRect().height > 64).length);
  assert.equal(tall, 0, `${name}/${width} wrapped action button`);
  await page.screenshot({ path: `${out}/${name}-${width}.png`, fullPage: true });
  evidence.pages.push({ name, width, overflow: false });
}
for (const [name, route] of [["schedule-no-timetable", "/student/schedule?timetable=none"], ["detail-no-timetable", "/student/classes/fixture-math?timetable=none"]]) for (const width of [390, 1366]) {
  await page.setViewportSize({ width, height: 844 });
  await page.goto(`${base}${route}&grade=6`); await page.locator("main h1").waitFor();
  await page.getByText(/has not set up a (class )?timetable/).first().waitFor();
  assert.equal(await overflow(), false, `${name}/${width} overflows`);
  await page.screenshot({ path: `${out}/${name}-${width}.png`, fullPage: true });
}
await page.setViewportSize({ width: 1366, height: 900 });
await page.goto(`${base}/student/classes?grade=6`);
await page.getByText("Teacher not listed").waitFor();
await page.goto(`${base}/student/schedule?grade=6`);
assert.equal(await page.locator("a[href='/student/work/sw-2']").count(), 1);

// C. Authorization failure on Refresh clears class rows; a transient failure keeps them as history.
for (const status of [401, 403]) {
  classesStatus = 200;
  await page.goto(`${base}/student/learn?grade=6`);
  await page.locator("[aria-labelledby=my-classes-heading] .pdv2-row-title").first().waitFor();
  classesStatus = status;
  await page.getByRole("button", { name: "Refresh" }).click();
  await page.locator("[aria-labelledby=my-classes-heading]").getByText(status === 401 ? "Signed out" : "Restricted").waitFor();
  assert.equal(await page.locator("[aria-labelledby=my-classes-heading] .pdv2-row-title").count(), 0, `class rows survived ${status}`);
}
classesStatus = 200;
await page.goto(`${base}/student/learn?grade=6`);
await page.locator("[aria-labelledby=my-classes-heading] .pdv2-row-title").first().waitFor();
classesStatus = 503;
await page.getByRole("button", { name: "Refresh" }).click();
await page.locator("[aria-labelledby=my-classes-heading]").getByText("Your classes could not be checked just now", { exact: false }).waitFor();
assert.equal(await page.locator("[aria-labelledby=my-classes-heading] .pdv2-row-title").count(), 2);
classesStatus = 200;

// D. Automated WCAG 2.2 AA checks on each class surface.
const axe = {};
for (const [name, route] of PAGES) {
  await page.goto(`${base}${route}${route.includes("?") ? "&" : "?"}grade=6`); await page.locator("main h1").waitFor();
  await page.addScriptTag({ path: "node_modules/axe-core/axe.min.js" });
  const result = await page.evaluate(async () => axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] } }));
  axe[name] = result.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length }));
  assert.equal(result.violations.filter((v) => ["serious", "critical"].includes(v.impact)).length, 0, `${name}: ${JSON.stringify(axe[name])}`);
}
await fs.writeFile(`${out}/results.json`, JSON.stringify({ ...evidence, axe, errors, caveat: "Production components with explicit fixture models and mocked authorized APIs. Server authorization, real devices and screen readers are not certified here." }, null, 2));
assert.deepEqual(errors, []);
await browser.close();
console.log(`Class fixtures passed: governed task first on Today and Learn for ${evidence.hierarchy.length} band/width layouts, ${evidence.pages.length} class page layouts, no-timetable states, 401/403 clear and 503 stale on Refresh, zero serious/critical axe issues.`);
