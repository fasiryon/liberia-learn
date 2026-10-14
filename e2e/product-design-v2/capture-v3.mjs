import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import { createServer } from "vite";
/**
 * Student Experience V3 screenshot capture: production student components in the fixture harness with
 * mocked authorized API answers. `node e2e/product-design-v2/capture-v3.mjs <label>` writes full-page
 * screenshots and layout metrics to artifacts/student-experience-v3/<label>. Capture only; the
 * assertions live in validate-v3.mjs. Not server authorization, real-device or production evidence.
 */
const label = process.argv[2] ?? "after";
const only = process.argv[3] ?? null;
const out = `artifacts/student-experience-v3/${label}`;
await fs.mkdir(out, { recursive: true });
const base = "http://127.0.0.1:3191";
const WIDTHS = [320, 390, 768, 1024, 1440, 1920];

const server = await createServer({ configFile: "e2e/product-design-v2/vite.config.ts", server: { strictPort: true } });
await server.listen();
const loader = await createServer({ configFile: "e2e/product-design-v2/vite.config.ts", optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true }, appType: "custom" });
const legacy = await loader.ssrLoadModule("/legacyLessonFixtures.ts");
const native = await loader.ssrLoadModule("/lessonFixtures.ts");
await loader.close();

const open = (href) => ({ state: "open", locked: false, href });
const lessonRow = (id, title, subject = "MATH") => ({ ...open(`/student/lesson/${id}`), availability: "current", contentId: id, title, subject, grade: 7 });
const discovery = () => ({
  schemaVersion: "learn-discovery/2", availability: "current", freshness: "current", generatedAt: new Date().toISOString(),
  currentLearning: { availability: "separate", endpoint: "/api/student/learning-authority/next-action" },
  subjects: [{ subject: "MATH", label: "MATH" }, { subject: "ENGLISH", label: "ENGLISH" }],
  subjectCompletion: [{ subject: "MATH", total: 10, completed: 3, completionRate: 30 }, { subject: "ENGLISH", total: 8, completed: 1, completionRate: 13 }],
  lessons: { availability: "current", total: 24, items: [lessonRow(legacy.LEGACY_CONTENT_ID, "Place value in large numbers"), lessonRow("c-2", "Main idea and details", "ENGLISH")] },
  activeUnits: { availability: "current", eligibility: "eligible", items: [{ ...open("/student/units/u-1"), unitId: "u-1", title: "Number sense: whole numbers", subject: "MATH", grade: 7, lessons: [] }] },
  assignedWork: { availability: "current", items: [{ ...open("/student/assignments"), assignmentHref: "/student/assignments", id: "a-1", title: "Place value worksheet", subject: "MATH", dueAt: "2026-10-16T09:00:00Z", content: null }] },
  checks: { availability: "empty", total: 0, items: [] },
  resources: { availability: "empty", items: [], destinations: [{ title: "Textbooks", href: "/student/textbooks" }], compiledBooks: "deferred" },
  search: { availability: "deferred" }, limits: { perSection: 100, linkedContent: 200, catalogBoundReached: false },
});
const today = (empty) => ({ availability: "current", items: empty ? [] : [{ id: legacy.LEGACY_WORK_ID, title: "Place value in large numbers", subject: "MATHEMATICS", lessonHref: `/student/lessons/${legacy.LEGACY_WORK_ID}`, contentId: legacy.LEGACY_CONTENT_ID, status: "not_started" }], catchUpItems: [], completedCount: empty ? 0 : 1, remainingCount: 1 });
let empty = false;
let nativeLesson = false;

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ reducedMotion: "reduce" });
await context.route("**/api/**", async (route) => {
  const url = new URL(route.request().url());
  const p = url.pathname;
  if (p.endsWith("/experience")) return nativeLesson ? route.fulfill({ json: native.runtimeLessonDelivery(6, { labAuthorized: false }) }) : route.fulfill({ status: 404, json: { error: "not_found" } });
  if (p.startsWith("/api/curriculum/")) return route.fulfill({ json: legacy.legacyCurriculumResponse() });
  if (p.startsWith("/api/student/work/")) return route.fulfill({ json: legacy.legacyWorkResponse() });
  if (p === "/api/student/progress") return route.fulfill(empty ? { status: 503, json: { error: "Progress is unavailable." } } : { json: legacy.progressFixture() });
  if (p === "/api/adaptive/mastery") return route.fulfill({ json: { records: empty ? [] : [{ skillKey: "MATHEMATICS:G7:u-1", score: 0.62, consecutiveCorrect: 2, masteredAt: null }] } });
  if (p.includes("next-action")) return route.fulfill({ json: empty ? { available: false } : { available: true, decisionId: "d", sessionId: "s", releaseId: "r", releaseIdentity: "ri", learnerStateRevision: "1", grade: 7, subject: "MATH", conceptLabel: "Place value", action: { kind: "PRACTICE", reason: "Practice the learning question selected by the server." }, item: { id: "i", version: "1", prompt: "What is the value of 3 in 2,350,480?", options: ["300", "300,000", "3,000"] }, toolPolicy: { allowed: [], prohibited: [] }, lessonHref: null } });
  if (p === "/api/student/learn") return route.fulfill({ json: empty ? { ...discovery(), availability: "empty", lessons: { availability: "empty", total: 0, items: [] }, activeUnits: { availability: "empty", eligibility: "eligible", items: [] }, assignedWork: { availability: "empty", items: [] } } : discovery() });
  if (p === "/api/student/classes") return route.fulfill({ json: { schemaVersion: "student-classes/1", classes: [] } });
  if (p.includes("/today")) return route.fulfill({ json: today(empty) });
  if (p.includes("/assignments")) return route.fulfill({ json: { assignments: empty ? [] : [{ id: "a-1", title: "Place value worksheet", subject: "MATH", dueAt: "2026-10-16T09:00:00Z", isOverdue: false, submission: null }] } });
  if (p.includes("teacher-lessons")) return route.fulfill({ json: { lessons: [] } });
  if (p.includes("inbox")) return route.fulfill({ json: { items: [], unreadCount: 0 } });
  if (p.includes("announcements")) return route.fulfill({ json: { announcements: [] } });
  return route.fulfill({ json: { sessions: [] } });
});
const page = await context.newPage();
page.setDefaultNavigationTimeout(120000); page.setDefaultTimeout(60000);
const errors = []; page.on("pageerror", (error) => errors.push(error.message));

const PAGES = [
  { id: "today", url: "/student/today?grade=7", ready: "#today-heading" },
  { id: "today-empty", url: "/student/today?grade=7", ready: "#today-heading", empty: true, widths: [390, 1440] },
  { id: "learn", url: "/student/learn?grade=7", ready: "#learn-heading" },
  { id: "progress", url: "/student/progress?grade=7&progress=1", ready: "h1" },
  { id: "progress-error", url: "/student/progress?grade=7&progress=1", ready: "h1", empty: true, widths: [390, 1440] },
  { id: "legacy-read", url: `/student/lesson/${legacy.LEGACY_CONTENT_ID}?grade=7`, ready: "h1" },
  { id: "legacy-slides", url: `/student/lesson/${legacy.LEGACY_CONTENT_ID}?grade=7`, ready: "h1", mode: "Slides" },
  { id: "assigned-read", url: `/student/lessons/${legacy.LEGACY_WORK_ID}?grade=7`, ready: "h1" },
  { id: "assigned-slides", url: `/student/lessons/${legacy.LEGACY_WORK_ID}?grade=7`, ready: "h1", mode: "slides" },
  { id: "native", url: "/student/lesson/fixture-levers-g6?grade=6", ready: "[data-lesson-player-v2]", native: true },
  { id: "demo", url: "/design-preview/grade-7-place-value", ready: "h1", optional: true },
];

const metrics = [];
for (const entry of PAGES) {
  if (only && entry.id !== only) continue;
  empty = Boolean(entry.empty); nativeLesson = Boolean(entry.native);
  for (const width of entry.widths ?? WIDTHS) {
    await page.setViewportSize({ width, height: width >= 1440 ? 900 : width >= 768 ? 1024 : 844 });
    await page.goto("about:blank");
    await page.goto(`${base}${entry.url}`);
    await page.evaluate(() => { try { localStorage.clear(); } catch { /* none */ } });
    try { await page.locator(entry.ready).first().waitFor({ timeout: entry.optional ? 8000 : 60000 }); } catch (error) { if (entry.optional) { console.log(`skip ${entry.id}: not present`); break; } throw error; }
    if (entry.mode) await page.getByRole("button", { name: new RegExp(`^${entry.mode}$`, "i") }).first().click();
    await page.waitForTimeout(400);
    const m = await page.evaluate(() => {
      const main = document.querySelector("main, [data-lesson-player-v2]");
      const box = main?.getBoundingClientRect();
      // The widest block of real text-bearing content: how much of the canvas teaches.
      const blocks = [...document.querySelectorAll("main p, main li, main h1, main h2, main table, main img, main svg")].map((el) => el.getBoundingClientRect()).filter((r) => r.width > 0);
      const left = Math.min(...blocks.map((r) => r.left)), right = Math.max(...blocks.map((r) => r.right));
      return { overflow: document.documentElement.scrollWidth > innerWidth + 1, mainWidth: Math.round(box?.width ?? 0), contentSpan: Math.round(right - left), viewport: innerWidth, pageHeight: document.documentElement.scrollHeight };
    });
    metrics.push({ page: entry.id, width, ...m });
    await page.screenshot({ path: `${out}/${entry.id}-${width}.png`, fullPage: true });
  }
}
await fs.writeFile(`${out}/metrics.json`, JSON.stringify({ label, metrics, errors }, null, 2));
console.log(JSON.stringify(metrics.filter((m) => m.width === 1440 || m.width === 320), null, 0));
console.log(`errors: ${errors.length}`, errors.slice(0, 5));
await browser.close();
await server.close();
