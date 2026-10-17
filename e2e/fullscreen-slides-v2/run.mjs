import { createServer } from "vite";
import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
const fixture = JSON.parse(await fs.readFile("e2e/fullscreen-slides-v2/civics-lesson.json", "utf8"));
const baseline = process.argv.includes("--baseline");
const quick = process.argv.includes("--quick");
assert.equal(createHash("sha256").update(fixture.response.payload.body_standard).digest("hex"), fixture.source.learnerBodySha256);
const out = `artifacts/fullscreen-slides-v2/${baseline ? "before" : quick ? "smoke" : "after"}`;
await fs.mkdir(out, { recursive: true });
process.env.HARNESS_PORT = "3201";
process.env.HARNESS_CACHE_DIR = "node_modules/.vite-fullscreen-slides";
const server = await createServer({ configFile: "e2e/product-design-v2/vite.config.ts", server: { strictPort: true, watch: { ignored: ["**/artifacts/**", "**/.next/**"] } } });
await server.listen();
const { parseToSlides } = await server.ssrLoadModule("/@fs/" + process.cwd().replaceAll("\\", "/") + "/lib/lessons/parseToSlides.ts");
const { slideBlocks } = await server.ssrLoadModule("/@fs/" + process.cwd().replaceAll("\\", "/") + "/lib/learner-experience/lessonText.ts");
const { LessonBlocks } = await server.ssrLoadModule("/@fs/" + process.cwd().replaceAll("\\", "/") + "/components/experience/LessonText.tsx");
const legacy = await server.ssrLoadModule("/legacyLessonFixtures.ts");
const slides = parseToSlides({ title: fixture.source.title, content: fixture.response.payload.body_standard });
assert.equal(slides.length, 17);
const sourceHtml = slides.map(slide => renderToStaticMarkup(createElement(LessonBlocks, { blocks: slideBlocks(slide.title, slide.content) })));
const browser = await chromium.launch({ headless: true });
const results = [], errors = [], scans = [], flows = [], writes = [];
try {
  for (const [width, height] of [[390,844], [768,900], [1440,720], [1440,900], [1920,720], [1920,900]]) {
    if (quick && (width !== 1440 || height !== 720)) continue;
    const context = await browser.newContext({ viewport: { width, height }, screen: { width, height }, reducedMotion: "reduce" });
    await context.route("**/api/**", route => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith("/experience")) return route.fulfill({ status: 404, json: { error: "not_found" } });
      if (path === `/api/curriculum/${fixture.source.contentId}`) return route.fulfill({ json: fixture.response });
      // Existing synthetic assignment only verifies the assessment hand-off; Civics content above is real.
      if (path.startsWith("/api/student/work/")) return route.fulfill({ json: legacy.legacyWorkResponse() });
      if (path.startsWith("/api/curriculum/")) return route.fulfill({ json: legacy.legacyCurriculumResponse() });
      return route.fulfill({ json: {} });
    });
    const page = await context.newPage(); page.setDefaultTimeout(60000); page.setDefaultNavigationTimeout(180000);
    page.on("pageerror", error => errors.push(error.message));
    page.on("request", request => { if (request.method() === "POST") writes.push(new URL(request.url()).pathname); });
    await page.goto(`http://127.0.0.1:3201/student/lesson/${fixture.source.contentId}?grade=7`, { waitUntil: "domcontentloaded" });
    await page.locator("#lesson-title").waitFor();
    const readBefore = await page.locator("[data-read-section]").allTextContents();
    await page.getByRole("group", { name: "How to use this lesson" }).getByRole("button", { name: "Slides", exact: true }).click();
    await page.getByRole("button", { name: "View slides fullscreen" }).click();
    await page.waitForFunction(() => !!document.fullscreenElement);
    const root = page.locator("[data-legacy-slides]");
    await root.getByRole("button", { name: "Next", exact: true }).click();
    const m = await root.evaluate(root => {
      const text = root.querySelector(".ll5-slide-content .ll5-fragment, .ll4-read-card p:last-child, .ll3-scene-lead");
      const content = root.querySelector(".ll5-slide-content, .ll3-scene-text").getBoundingClientRect();
      const controls = root.querySelector(".ll5-slide-nav, .ll3-slide-nav").getBoundingClientRect();
      return { font: parseFloat(getComputedStyle(text).fontSize), rootScrolls: root.scrollHeight > root.clientHeight + 1,
        nestedScrolls: [...root.querySelectorAll("*")].filter(el => /auto|scroll/.test(getComputedStyle(el).overflowY) && el.scrollHeight > el.clientHeight + 1).length,
        contentWidth: content.width, contentLeft: content.left, contentRight: content.right, controlsBottom: controls.bottom, viewport: { width: innerWidth, height: innerHeight } };
    });
    results.push({ width, height, ...m });
    await page.screenshot({ path: `${out}/hook-${width}-${height}.png` });
    if (!baseline) {
      assert(m.font >= (width >= 1024 ? 26 : 20), `presentation text too small: ${JSON.stringify(m)}`);
      assert(!m.rootScrolls && m.nestedScrolls === 0, `vertical scrolling: ${JSON.stringify(m)}`);
      assert(m.controlsBottom <= m.viewport.height, "controls below viewport");
      await page.keyboard.press("ArrowLeft");
      await page.waitForFunction(() => document.querySelector("[data-presentation-page]")?.getAttribute("data-presentation-page") === "0");
      const expected = await page.evaluate(html => html.map(value => new DOMParser().parseFromString(value, "text/html").body.textContent.replace(/\s/g, "")), sourceHtml);
      const collected = slides.map(() => "");
      const captured = new Set();
      const total = Number(await page.locator("[data-presentation-total]").getAttribute("data-presentation-total"));
      assert(total > 17, "long source sections were not divided");
      for (let index = 0; index < total; index++) {
        const metrics = await root.evaluate(root => {
          const frame = root.querySelector(".ll5-slide-content"), r = frame.getBoundingClientRect();
          const units = [...frame.querySelectorAll(".ll5-fragment")];
          const title = root.querySelector("#presentation-title").getBoundingClientRect();
          const nav = root.querySelector(".ll5-slide-nav").getBoundingClientRect();
          return { page: Number(root.querySelector("[data-presentation-page]").dataset.presentationPage), source: Number(root.dataset.slideIndex),
            text: frame.textContent.replace(/\s/g, ""), font: parseFloat(getComputedStyle(units[0]).fontSize),
            clipped: units.some(element => { const b = element.getBoundingClientRect(); return b.top < r.top - 1 || b.bottom > r.bottom + 1; }),
            overflow: root.scrollHeight > root.clientHeight + 1 || document.documentElement.scrollWidth > innerWidth,
            nestedScrolls: [...root.querySelectorAll("*")].filter(element => getComputedStyle(element).visibility !== "hidden" && /auto|scroll/.test(getComputedStyle(element).overflowY) && element.scrollHeight > element.clientHeight + 1).length,
            titleFits: title.top >= 0 && title.bottom <= nav.top, controlsFit: nav.bottom <= innerHeight,
            whitespaceDifference: Math.abs(r.left - (innerWidth - r.right)), contentWidth: r.width, viewport: innerWidth };
        });
        assert.equal(metrics.page, index, "pagination skipped a page");
        assert(!metrics.clipped && !metrics.overflow && metrics.nestedScrolls === 0 && metrics.titleFits && metrics.controlsFit, `clipped/scrolling content at ${width}x${height}: ${JSON.stringify(metrics)}`);
        assert(metrics.font >= (width >= 1024 ? 26 : 20), "text was scaled down");
        assert(metrics.whitespaceDifference <= 2, "unbalanced teaching area");
        assert(metrics.contentWidth >= Math.min(metrics.viewport - 64, 1360) - 2, "narrow teaching area");
        collected[metrics.source] += metrics.text;
        if ([1,2,3,4].includes(metrics.source) && !captured.has(metrics.source)) {
          captured.add(metrics.source);
          await page.screenshot({ path: `${out}/section-${metrics.source}-${width}-${height}.png` });
        }
        results.push({ width, height, ...metrics, text: undefined });
        if (index < total - 1) {
          await root.getByRole("button", { name: "Next", exact: true }).click();
          await page.waitForFunction(next => Number(document.querySelector("[data-presentation-page]")?.getAttribute("data-presentation-page")) === next, index + 1).catch(async error => {
            const observed = await root.evaluate(root => ({ source: root.dataset.slideIndex, page: root.querySelector("[data-presentation-page]")?.getAttribute("data-presentation-page"), total: root.querySelector("[data-presentation-total]")?.getAttribute("data-presentation-total"), text: root.querySelector(".ll5-slide-content")?.textContent }));
            await page.screenshot({ path: `${out}/navigation-failure-${width}-${height}.png` });
            error.message += ` observed ${JSON.stringify(observed)}`; throw error;
          });
        }
      }
      assert.deepEqual(collected, expected, "learner-visible wording/order changed or text was omitted/duplicated");
      assert.equal(captured.size, 4, "Hook/Objectives/Prior Knowledge/Core Concept not reached");
      await page.keyboard.press("ArrowLeft");
      await page.waitForFunction(last => Number(document.querySelector("[data-presentation-page]")?.getAttribute("data-presentation-page")) === last, total - 2);
      await page.keyboard.press("ArrowRight");
      await page.goBack();
      await page.waitForFunction(last => Number(document.querySelector("[data-presentation-page]")?.getAttribute("data-presentation-page")) === last, total - 2);
      await page.addScriptTag({ path: "node_modules/axe-core/axe.min.js" });
      const violations = await root.evaluate(async root => (await window.axe.run(root, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] } })).violations.map(v => ({ id: v.id, impact: v.impact })));
      scans.push({ width, height, violations });
      assert(!violations.some(v => ["serious", "critical"].includes(v.impact)), JSON.stringify(violations));
      await page.getByRole("button", { name: "Exit fullscreen slides" }).click();
      await page.waitForFunction(() => !document.fullscreenElement);
      await page.waitForFunction(() => document.activeElement?.getAttribute("aria-label") === "View slides fullscreen");
      await page.getByRole("group", { name: "How to use this lesson" }).getByRole("button", { name: "Read", exact: true }).click();
      assert.deepEqual(await page.locator("[data-read-section]").allTextContents(), readBefore, "Read mode changed");
      if (width === 1440 && height === 720) {
        await page.getByRole("group", { name: "How to use this lesson" }).getByRole("button", { name: "Slides", exact: true }).click();
        await page.evaluate(() => { const url = new URL(location.href); url.searchParams.delete("slide"); history.replaceState(history.state, "", url); });
        const entrySource = await root.getAttribute("data-slide-index");
        await page.getByRole("button", { name: "View slides fullscreen" }).click();
        await page.waitForFunction(() => Number(document.querySelector("[data-presentation-total]")?.getAttribute("data-presentation-total")) > 0);
        // Fullscreen entry can reflow pagination; history must restore the source fragment, not a transient page number.
        const entryFragment = await root.locator(".ll5-slide-content [data-fragment-id]").first().getAttribute("data-fragment-id");
        await root.getByRole("button", { name: "Next", exact: true }).click();
        await page.waitForFunction(previous => document.querySelector(".ll5-slide-content [data-fragment-id]")?.getAttribute("data-fragment-id") !== previous, entryFragment);
        await page.goBack();
        await page.waitForFunction(expected => document.querySelector(".ll5-slide-content [data-fragment-id]")?.getAttribute("data-fragment-id") === expected, entryFragment);
        assert.equal(await root.getAttribute("data-slide-index"), entrySource, "Back lost the section where fullscreen opened");
        await page.goForward();
        await page.waitForFunction(previous => document.querySelector(".ll5-slide-content [data-fragment-id]")?.getAttribute("data-fragment-id") !== previous, entryFragment);
        await page.getByRole("button", { name: "Exit fullscreen slides" }).click();
        await page.waitForFunction(() => !document.fullscreenElement);
      }
      flows.push({ width, height, pages: total, sourceSlides: 17, exactTextAndOrder: true, keyboardAndBack: true, readUnchanged: true, exitFocusReturned: true });
      console.log(`${width}x${height}: ${total} fullscreen pages, exact text/order, no clipping/scrolling, controls, keyboard/Back, Read unchanged`);
      if (width === 1440 && height === 720) {
        await page.goto(`http://127.0.0.1:3201/student/lessons/${legacy.LEGACY_WORK_ID}?grade=7`, { waitUntil: "domcontentloaded" });
        await page.getByRole("group", { name: "How to use this lesson" }).getByRole("button", { name: /^Slides$/i }).click();
        await page.getByRole("button", { name: "View slides fullscreen" }).click();
        await page.waitForFunction(() => !!document.fullscreenElement && Number(document.querySelector("[data-presentation-total]")?.getAttribute("data-presentation-total")) > 0);
        assert.equal(await root.getByRole("button", { name: "Go to assessment" }).count(), 0);
        for (let i = 0; i < 40 && !await root.getByRole("button", { name: "Go to assessment" }).count(); i++) await root.getByRole("button", { name: "Next", exact: true }).click();
        await root.getByRole("button", { name: "Go to assessment" }).click();
        await page.waitForFunction(() => !document.fullscreenElement);
        await page.getByPlaceholder("Write your answer here").waitFor();
        await page.getByPlaceholder("Write your answer here").fill("Existing assessment input remains editable.");
        flows.push({ assessmentFixture: "existing synthetic Grade 7 assigned-work fixture", lastPageOnly: true, fullscreenExit: true, inputEditable: true });
        console.log("Existing assigned lesson: final fullscreen page exits to the unchanged assessment; input editable, no submission");
      }
    }
    await context.close();
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(writes.filter(path => path !== "/api/track"), [], "presentation wrote educational state");
  if (baseline) assert(results.every(m => !m.rootScrolls && m.font >= (m.width >= 1024 ? 26 : 20)), "reproduced scrolling/tiny typography on the actual Civics lesson");
} finally {
  await fs.writeFile(`${out}/results.json`, JSON.stringify({ source: fixture.source, results, scans, flows, errors, writes }, null, 2));
  await browser.close(); await server.close();
}
