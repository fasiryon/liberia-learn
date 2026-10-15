import { createServer } from "vite";
import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
const label = process.argv[2] ?? "after";
const verify = label === "after";
const flowOnly = process.argv.includes("--flows-only");
const out = `artifacts/student-shell-v3/${label}`;
await fs.mkdir(out, { recursive: true });
const server = await createServer({ configFile: "e2e/student-shell-v3/vite.config.ts", server: { strictPort: true } });
await server.listen();
const loader = await createServer({ configFile: "e2e/student-shell-v3/vite.config.ts", optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true }, appType: "custom" });
const legacy = await loader.ssrLoadModule("/../product-design-v2/legacyLessonFixtures.ts");
await loader.close();
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ reducedMotion: "reduce" });
await context.route("**/api/**", async (route) => {
  const url = new URL(route.request().url()); const p = url.pathname;
  if (p === "/api/student/progress") return route.fulfill({ json: legacy.progressFixture() });
  if (p === "/api/adaptive/mastery") return route.fulfill({ json: { records: [] } });
  if (p.includes("next-action")) return route.fulfill({ json: { available: false } });
  if (p === "/api/student/learn") return route.fulfill({ json: {
    schemaVersion: "learn-discovery/2", availability: "current", freshness: "current", generatedAt: "2026-10-14T12:00:00Z",
    currentLearning: { availability: "separate", endpoint: "/api/student/learning-authority/next-action" }, subjects: [{ subject: "MATH", label: "Mathematics" }], subjectCompletion: [],
    lessons: { availability: "current", total: 1, items: [{ state: "open", locked: false, href: "/student/lesson/fixture-g7-place-value-legacy", availability: "current", contentId: "fixture-g7-place-value-legacy", title: "Place value component fixture", subject: "MATH", grade: 7 }] },
    activeUnits: { availability: "empty", eligibility: "eligible", items: [] }, assignedWork: { availability: "empty", items: [] }, checks: { availability: "empty", total: 0, items: [] },
    resources: { availability: "empty", items: [], destinations: [{ title: "Textbooks", href: "/student/textbooks" }], compiledBooks: "deferred" }, search: { availability: "deferred" }, limits: { perSection: 100, linkedContent: 200, catalogBoundReached: false },
  } });
  if (p.includes("/today")) return route.fulfill({ json: { availability: "current", items: [], catchUpItems: [], completedCount: 0, remainingCount: 0 } });
  if (p.includes("/assignments")) return route.fulfill({ json: { assignments: [] } });
  if (p.includes("teacher-lessons")) return route.fulfill({ json: { lessons: [] } });
  if (p.includes("inbox")) return route.fulfill({ json: { items: [], unreadCount: 0 } });
  if (p.includes("announcements")) return route.fulfill({ json: { announcements: [] } });
  if (p.includes("rag/query")) return route.fulfill({ json: { answer: "Synthetic grounded-response fixture.", sources: [], retrievalWeak: true, hadFallback: false, isWeakGrounding: true, actions: [] } });
  return route.fulfill({ json: { sessions: [] } });
});
const page = await context.newPage();
page.setDefaultTimeout(180000); page.setDefaultNavigationTimeout(180000);
const errors = []; page.on("pageerror", (error) => { errors.push(error.message); console.error(error.message); });
const metrics = [];
const navigationResults = [];
const accessibility = [];
try {
  for (const width of flowOnly ? [] : [390, 768, 1440, 1920]) {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 });
    for (const [id, path, active] of [["today", "/student/today", "Today"], ["learn", "/student/learn", "Learn"], ["labs", "/student/labs", "Labs"], ["progress", "/student/progress", "Progress"], ["help", "/student/ai-tutor", "Help"]]) {
      await page.goto(`http://127.0.0.1:3195${path}`, { waitUntil: "domcontentloaded" }); await page.locator("h1").first().waitFor();
      if (id === "help") await page.locator("textarea").waitFor();
      await page.waitForTimeout(300);
      const m = await page.evaluate(() => {
        const body = document.querySelector(".pdv2-body").getBoundingClientRect();
        const element = document.querySelector(".pdv2-body main > .mx-auto") ?? document.querySelector(".pdv2-body main");
        const frame = element.getBoundingClientRect();
        const box = getComputedStyle(element);
        const left = frame.left - body.left + parseFloat(box.paddingLeft);
        const right = body.right - frame.right + parseFloat(box.paddingRight);
        const nav = [...document.querySelectorAll('.pdv2-nav a')].map((link) => { const r = link.getBoundingClientRect(); return { label: link.textContent.trim().replace(/→$/, "").trim(), active: link.getAttribute("aria-current"), visible: r.top >= 0 && r.bottom <= innerHeight && document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest("a") === link }; });
        return { bodyLeft: body.left, bodyWidth: body.width, frameWidth: frame.width, leftWhitespace: Math.round(left), rightWhitespace: Math.round(right), contentUtilization: Math.round((body.width - left - right) / body.width * 100), overflow: document.documentElement.scrollWidth > innerWidth + 1, nav };
      });
      metrics.push({ page: id, width, ...m });
      if (verify) { assert(!m.overflow, `${id}/${width} overflow`); assert(Math.abs(m.leftWhitespace - m.rightWhitespace) <= 2, `${id}/${width} unbalanced margins: ${JSON.stringify(m)}`); assert(m.nav.every((link) => link.visible), `${id}/${width} navigation obscured`); assert(m.nav.some((link) => link.label === active && link.active === "page"), `${id}/${width} active navigation`); }
      await page.screenshot({ path: `${out}/${id}-${width}.png`, fullPage: true });
    }
  }
  if (verify) {
    for (const width of [390, 768, 1440, 1920]) {
      await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 });
      await page.goto("http://127.0.0.1:3195/student/today", { waitUntil: "domcontentloaded" }); await page.locator("h1").waitFor();
      const nav = page.getByRole("navigation", { name: "Student", exact: true });
      await nav.getByRole("link", { name: /^Help/ }).click(); await page.locator("textarea").waitFor();
      await page.locator("textarea").fill("Explain place value without giving an answer.");
      assert.equal(await page.locator("[data-assistant-presentation=page]").evaluate((node) => getComputedStyle(node).position), "static");
      if (width === 390 || width === 1440) {
        await page.addScriptTag({ path: "node_modules/axe-core/axe.min.js" });
        const violations = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] } })).violations.map(({ id, impact, nodes }) => ({ id, impact, nodes: nodes.length })));
        accessibility.push({ page: "help", width, violations });
        assert.equal(violations.filter(({ impact }) => ["serious", "critical"].includes(impact)).length, 0, `Help/${width}: ${JSON.stringify(violations)}`);
      }
      await page.locator("textarea").focus();
      let reachedLearn = false;
      for (let tab = 0; tab < 30; tab++) {
        await page.keyboard.press("Shift+Tab");
        if (await page.evaluate(() => document.activeElement?.getAttribute("href") === "/student/learn")) { reachedLearn = true; break; }
      }
      assert(reachedLearn, `Help/${width}: keyboard focus cannot reach Learn`);
      await page.keyboard.press("Enter");
      await page.waitForURL("**/student/learn"); assert.equal(await page.locator("[data-assistant-presentation=page]").count(), 0);
      await nav.getByRole("link", { name: /^Help/ }).focus(); await page.keyboard.press("Enter"); await page.locator("textarea").waitFor();
      await page.locator("textarea").focus();
      let reachedToday = false;
      for (let tab = 0; tab < 30; tab++) {
        await page.keyboard.press("Shift+Tab");
        if (await page.evaluate(() => document.activeElement?.getAttribute("href") === "/student/today")) { reachedToday = true; break; }
      }
      assert(reachedToday, `Help/${width}: keyboard focus cannot reach Today`);
      await page.keyboard.press("Enter"); await page.waitForURL("**/student/today");
      const floating = page.locator("[data-assistant-presentation=floating]");
      if (await floating.locator("textarea").count()) {
        await floating.locator("textarea").focus(); await page.keyboard.press("Escape");
        assert.equal(await floating.locator("textarea").count(), 0, "Escape closes the non-modal assistant");
        assert(await floating.getByRole("button", { name: /Assistant/ }).evaluate((node) => document.activeElement === node), "Escape returns focus to launcher");
      }
      await nav.getByRole("link", { name: /^Labs/ }).click(); await page.waitForURL("**/student/labs");
      await nav.getByRole("link", { name: /^Progress/ }).click(); await page.waitForURL("**/student/progress");
      navigationResults.push({ width, todayToHelpToLearn: "pass", helpToToday: "pass", keyboardTabReachesNavigation: "pass", labsAndProgressReachable: "pass" });
    }
    assert.deepEqual(errors, []);
  }
} finally {
  await fs.writeFile(`${out}/${flowOnly ? "navigation" : "results"}.json`, JSON.stringify({ label, metrics, navigationResults, accessibility, errors, caveat: "Production components, synthetic API data; component browser evidence, not production authentication or real student records." }, null, 2));
  await browser.close(); await server.close();
}
console.log(JSON.stringify(metrics.map(({ page, width, leftWhitespace, rightWhitespace, contentUtilization, overflow }) => ({ page, width, leftWhitespace, rightWhitespace, contentUtilization, overflow })), null, 2));
