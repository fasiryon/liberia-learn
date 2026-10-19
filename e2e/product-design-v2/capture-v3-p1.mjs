import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import { createServer } from "vite";
/**
 * Student Experience V3 P1 screenshot capture (fixture harness, production components, mocked API answers).
 * `node e2e/product-design-v2/capture-v3-p1.mjs <before|after>` writes full-page screenshots at 390 and 1440
 * to artifacts/student-experience-v3-p1/<label>. Pages that do not exist in a build (the P1 demo lessons on
 * main) are skipped and listed. Capture only; assertions live in validate-v3-p1.mjs.
 */
const label = process.argv[2] ?? "after";
const out = `artifacts/student-experience-v3-p1/${label}`;
await fs.mkdir(out, { recursive: true });
const port = Number(process.env.HARNESS_PORT ?? 3291);
const base = `http://127.0.0.1:${port}`;
const WIDTHS = [390, 1440];

const server = await createServer({ configFile: "e2e/product-design-v2/vite.config.ts", cacheDir: "node_modules/.vite-lesson-v3", server: { strictPort: true, port } });
await server.listen();
const loader = await createServer({ configFile: "e2e/product-design-v2/vite.config.ts", cacheDir: "node_modules/.vite-lesson-v3", optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true }, appType: "custom" });
const legacy = await loader.ssrLoadModule("/legacyLessonFixtures.ts");
const generated = await loader.ssrLoadModule("/generatedLessonFixture.ts");
const native = await loader.ssrLoadModule("/lessonFixtures.ts");
await loader.close();

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ reducedMotion: "reduce" });
await context.route("**/api/**", async (route) => {
  const p = new URL(route.request().url()).pathname;
  if (p.endsWith("/experience")) return nativeLesson ? route.fulfill({ json: native.runtimeLessonDelivery(6, { labAuthorized: false }) }) : route.fulfill({ status: 404, json: { error: "not_found" } });
  if (p === `/api/curriculum/${generated.GENERATED_CONTENT_ID}`) return route.fulfill({ json: generated.generatedCurriculumResponse() });
  if (p === `/api/curriculum/${generated.LONG_GENERATED_CONTENT_ID}`) return route.fulfill({ json: generated.longGeneratedCurriculumResponse() });
  if (p === `/api/curriculum/${generated.STRESS_CONTENT_ID}`) return route.fulfill({ json: generated.stressCurriculumResponse() });
  if (p.startsWith("/api/curriculum/")) return route.fulfill({ json: legacy.legacyCurriculumResponse() });
  if (p.startsWith("/api/student/work/")) return route.fulfill({ json: legacy.legacyWorkResponse() });
  return route.fulfill({ json: {} });
});
const page = await context.newPage();
page.setDefaultNavigationTimeout(120000); page.setDefaultTimeout(60000);
const errors = []; page.on("pageerror", (error) => errors.push(error.message));
const slides = async (name = "Slides") => page.getByRole("group", { name: "How to use this lesson" }).getByRole("button", { name, exact: true }).click();

const PAGES = [
  { id: "long-read", url: `/student/lesson/${generated.LONG_GENERATED_CONTENT_ID}?grade=7`, ready: "#lesson-title" },
  { id: "stress-read", url: `/student/lesson/${generated.STRESS_CONTENT_ID}?grade=7`, ready: "#lesson-title", widths: [390, 768, 1440, 1920] },
  { id: "stress-section-17", url: `/student/lesson/${generated.STRESS_CONTENT_ID}?grade=7&section=section-17-the-section-a-learner-opens-directly`, ready: "#lesson-title", widths: [390, 1440] },
  { id: "assigned-read", url: `/student/lessons/${legacy.LEGACY_WORK_ID}?grade=7`, ready: "#lesson-title" },
  { id: "hosted-shape-slides", url: `/student/lesson/${generated.GENERATED_CONTENT_ID}?grade=7`, ready: "#lesson-title", then: () => slides() },
  { id: "hosted-shape-slides-example", url: `/student/lesson/${generated.GENERATED_CONTENT_ID}?grade=7`, ready: "#lesson-title", then: async () => { await slides(); await page.locator("[data-legacy-slides] .ll3-slide-nav").getByRole("button", { name: "Next", exact: true }).click(); await page.locator("[data-legacy-slides] .ll3-slide-nav").getByRole("button", { name: "Next", exact: true }).click(); } },
  { id: "hosted-shape-read", url: `/student/lesson/${generated.GENERATED_CONTENT_ID}?grade=7`, ready: "#lesson-title" },
  { id: "legacy-slides-table", url: `/student/lesson/${legacy.LEGACY_CONTENT_ID}?grade=7`, ready: "#lesson-title", then: async () => { await slides(); for (let n = 0; n < 2; n++) await page.locator("[data-legacy-slides] .ll3-slide-nav").getByRole("button", { name: "Next", exact: true }).click(); } },
  { id: "assigned-slides-example", url: `/student/lessons/${legacy.LEGACY_WORK_ID}?grade=7`, ready: "#lesson-title", then: async () => { await slides("slides"); for (let n = 0; n < 3; n++) await page.locator("[data-legacy-slides] .ll3-slide-nav").getByRole("button", { name: "Next", exact: true }).click(); } },
  { id: "native", url: "/student/lesson/fixture-levers-g6?grade=6", ready: "[data-lesson-player-v2]", native: true },
  { id: "native-scene-3", url: "/student/lesson/fixture-levers-g6?grade=6", ready: "[data-lesson-player-v2]", native: true, then: async () => { for (let n = 0; n < 2; n++) await page.locator("footer").getByRole("button", { name: /^(Next|Continue)/ }).click(); } },
  { id: "g7-intro", url: "/design-preview/grade-7-place-value", ready: "h1" },
  { id: "g7-explain", url: "/design-preview/grade-7-place-value", ready: "h1", then: () => page.locator("footer").getByRole("button", { name: /^Continue/ }).click() },
  { id: "g7-digit-cards", url: "/design-preview/grade-7-place-value?scene=digits", ready: "[data-scene-id=digits]", optional: true },
  { id: "g7-practice", url: "/design-preview/grade-7-place-value?scene=practice", ready: "[data-scene-id=practice]", optional: true },
  { id: "gallery", url: "/design-preview/lessons", ready: "h1", optional: true },
  { id: "science-cycle", url: "/design-preview/lessons/grade-5-water-cycle?scene=cycle", ready: "[data-scene-id=cycle]", optional: true },
  { id: "english-sort", url: "/design-preview/lessons/grade-4-parts-of-speech?scene=sort", ready: "[data-scene-id=sort]", optional: true },
  { id: "social-timeline", url: "/design-preview/lessons/grade-6-liberia-timeline?scene=order", ready: "[data-scene-id=order]", optional: true },
];

const captured = [], skipped = [];
let nativeLesson = false;
const heights = [];
// Warm the dependency optimizer once so the first measured page is not a cold start.
await page.goto(`${base}/student/lesson/${legacy.LEGACY_CONTENT_ID}?grade=7`, { waitUntil: "domcontentloaded", timeout: 300000 });
await page.locator("#lesson-title").waitFor({ timeout: 300000 }).catch(() => undefined);
for (const entry of PAGES) for (const width of entry.widths ?? WIDTHS) {
  nativeLesson = Boolean(entry.native);
  await page.setViewportSize({ width, height: width >= 1440 ? 900 : 844 });
  await page.goto("about:blank");
  await page.goto(`${base}${entry.url}`, { waitUntil: "domcontentloaded" });
  try { await page.locator(entry.ready).first().waitFor({ timeout: entry.optional ? 8000 : 60000 }); } catch (error) { if (entry.optional) { skipped.push(entry.id); break; } throw error; }
  if (entry.then) await entry.then();
  await page.waitForTimeout(400);
  heights.push({ page: entry.id, width, documentHeight: await page.evaluate(() => document.documentElement.scrollHeight), overflowX: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1) });
  await page.screenshot({ path: `${out}/${entry.id}-${width}.png`, fullPage: true });
  captured.push(`${entry.id}-${width}`);
}
await fs.writeFile(`${out}/capture.json`, JSON.stringify({ label, captured, skipped, heights, errors, caveat: "Fixture harness with production components and mocked API answers; not production, server authorization or real-device evidence." }, null, 2));
console.log(`captured ${captured.length}; skipped ${skipped.join(", ") || "none"}; errors ${errors.length}`, errors.slice(0, 3));
await browser.close();
await server.close();
