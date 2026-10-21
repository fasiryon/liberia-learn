// Interactive Learning V4 before/after for the EXISTING legacy lesson routes (Read mode), at 360/390/768/1024/1440/1920.
// Runs unchanged in a checkout of main (before) and of this branch (after): node e2e/learning-v4/capture-legacy.mjs <label>
//   - civics: a real hero lesson body captured from the catalog (e2e/fullscreen-slides-v2/civics-lesson.json)
//   - notation: a labelled reconstruction of the geometry hero lesson's sections 5 and 7 (e2e/learning-v4/notation-fixture.json)
import { createServer } from "vite";
import { chromium } from "@playwright/test";
import fs from "node:fs/promises";

const label = process.argv[2] ?? "after";
const out = `artifacts/learning-v4/legacy/${label}`;
await fs.mkdir(out, { recursive: true });
const fixtures = {
  civics: JSON.parse(await fs.readFile("e2e/fullscreen-slides-v2/civics-lesson.json", "utf8")),
  notation: JSON.parse(await fs.readFile("e2e/learning-v4/notation-fixture.json", "utf8")),
};
process.env.HARNESS_PORT = "3204";
process.env.HARNESS_CACHE_DIR = `node_modules/.vite-learning-v4-${label}`;
const server = await createServer({ configFile: "e2e/product-design-v2/vite.config.ts", server: { strictPort: true, watch: { ignored: ["**/artifacts/**", "**/.next/**"] } } });
await server.listen();
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const [name, fixture] of Object.entries(fixtures)) {
    for (const [width, height] of [[360, 780], [390, 844], [768, 1024], [1024, 768], [1440, 900], [1920, 1080]]) {
      const context = await browser.newContext({ viewport: { width, height }, reducedMotion: "reduce" });
      await context.route("**/api/**", (route) => {
        const path = new URL(route.request().url()).pathname;
        if (path === `/api/curriculum/${fixture.source.contentId}`) return route.fulfill({ json: fixture.response });
        if (path.endsWith("/experience")) return route.fulfill({ status: 404, json: { error: "not_found" } });
        return route.fulfill({ json: {} });
      });
      const page = await context.newPage();
      page.setDefaultTimeout(60000);
      await page.goto(`http://127.0.0.1:3204/student/lesson/${fixture.source.contentId}?grade=7${name === "notation" ? "&section=7-worked-example-2-triangular-garden-bed" : ""}`, { waitUntil: "domcontentloaded" });
      await page.locator("#lesson-title").waitFor();
      await page.locator("[data-read-section]:not([hidden])").first().waitFor();
      const metrics = await page.evaluate(() => {
        const box = (selector) => { const element = [...document.querySelectorAll(selector)].find((candidate) => candidate.getBoundingClientRect().width > 0 && !candidate.closest("[hidden]")); if (!element) return null; const rect = element.getBoundingClientRect(); return { left: Math.round(rect.left), right: Math.round(innerWidth - rect.right), width: Math.round(rect.width) }; };
        const visibleSection = [...document.querySelectorAll("[data-read-section]")].find((section) => !section.hidden);
        return {
          viewport: innerWidth,
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
          stage: box(".ll3-stage-main"), readStage: box(".ll4-read-stage"), rail: box(".ll4-read-rail"), support: box(".ll3-stage-support"),
          readingColumn: box(".ll4-read-stage .ll3-reading"),
          rawTeX: /\\(frac|times|text)\b|_\{/.test(visibleSection?.innerText ?? ""),
          mathElements: visibleSection ? visibleSection.querySelectorAll("math").length : 0,
          currencyIntact: (visibleSection?.innerText ?? "").includes("L$500") || !(visibleSection?.innerText ?? "").includes("palm oil"),
        };
      });
      await page.screenshot({ path: `${out}/${name}--${width}.png` });
      results.push({ fixture: name, width, ...metrics });
      await context.close();
    }
  }
} finally {
  await fs.writeFile(`${out}/metrics.json`, JSON.stringify(results, null, 2));
  await browser.close();
  await server.close();
}
console.log(JSON.stringify(results.map((row) => ({ f: row.fixture, w: row.width, column: row.readingColumn?.width, stage: row.readStage?.width, rail: row.rail?.width, support: row.support?.width, leftGutter: row.stage?.left, rawTeX: row.rawTeX, math: row.mathElements, overflow: row.overflow }))));
