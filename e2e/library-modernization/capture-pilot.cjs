/**
 * Library Modernization V1 pilot: learner walkthrough and layout evidence in the existing Lesson Player V2.
 *
 * Usage (dev server must already run with the harness enabled):
 *   LAB_REVIEW_HARNESS=1 npx next dev -p 3297
 *   node e2e/library-modernization/capture-pilot.cjs [baseUrl] [outDir]
 *
 * Plays each pilot candidate's packaged learner projection at 390, 768, 1440 and 1920 px wide, doing what a
 * learner does (reveal steps, answer, write), and records per scene: horizontal overflow, the smallest
 * rendered text size, scroll height in viewports, the share of the viewport width the content uses, Continue
 * gating, and console errors. Answers use the candidate's formative keys. Nothing is sent or saved.
 * Fullscreen Slides V2 is not on this base, so this measures Lesson Player V2 only.
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const BASE = process.argv[2] || "http://localhost:3297";
const OUT = process.argv[3] || "artifacts/library-modernization-v1/browser";
const PILOT = "curriculum/modernization/v1/pilot";
const VIEWPORTS = [
  { name: "390", width: 390, height: 844 }, { name: "768", width: 768, height: 1024 },
  { name: "1440", width: 1440, height: 900 }, { name: "1920", width: 1920, height: 1080 },
];

(async () => {
  const browser = await chromium.launch();
  const flow = { capturedAt: new Date().toISOString(), base: BASE, player: "Lesson Player V2 (/lab-review/experience)", fullscreenSlidesV2: "NOT_AVAILABLE_ON_BASE", runs: [] };
  for (const key of fs.readdirSync(PILOT).filter((entry) => fs.existsSync(path.join(PILOT, entry, "spec.json")))) {
    const spec = JSON.parse(fs.readFileSync(path.join(PILOT, key, "spec.json"), "utf8"));
    const candidate = JSON.parse(fs.readFileSync(path.join(PILOT, key, "candidate.json"), "utf8"));
    const keyIndex = {};
    for (const scene of candidate.scenes) if (scene.interaction.kind === "SINGLE_CHOICE") for (const item of scene.interaction.items) keyIndex[item.id] = item.options.findIndex((option) => option.id === item.formativeKey.expectedOptionId);
    for (const viewport of VIEWPORTS) {
      const dir = path.join(OUT, key, viewport.name);
      fs.mkdirSync(dir, { recursive: true });
      const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1, serviceWorkers: "block" });
      const page = await context.newPage();
      const errors = [];
      page.on("console", (message) => { if (message.type() === "error") errors.push(message.text().slice(0, 300)); });
      page.on("pageerror", (error) => errors.push(String(error).slice(0, 300)));
      const response = await page.goto(`${BASE}/lab-review/experience/${spec.candidateId}`, { waitUntil: "networkidle", timeout: 240_000 });
      const run = { lesson: key, candidateId: spec.candidateId, viewport: viewport.name, httpStatus: response.status(), scenes: [], errors };
      if (response.status() !== 200) { flow.runs.push(run); await context.close(); console.log(`${key} ${viewport.name}: HTTP ${response.status()}`); continue; }
      // A dev-server recompile can leave the first load unhydrated; reload once before giving up.
      await page.waitForSelector("[data-scene-id]", { timeout: 60_000 }).catch(async () => {
        run.reloaded = true;
        await page.reload({ waitUntil: "networkidle", timeout: 240_000 });
        await page.waitForSelector("[data-scene-id]", { timeout: 120_000 });
      });
      await page.addStyleTag({ content: 'div.fixed[role="status"][aria-live="polite"] { display: none !important; }' });
      for (let position = 1; position <= candidate.scenes.length; position++) {
        const sceneId = await page.getAttribute("[data-scene-id]", "data-scene-id");
        const continueButton = page.locator("button[data-primary]").last();
        const gatedBefore = await continueButton.isDisabled();
        const actions = [];
        for (;;) {
          const next = page.locator("article button[aria-expanded='false']:not([disabled])").first();
          if (!(await next.count())) break;
          await next.click(); actions.push("reveal-step");
        }
        const groups = page.locator("article fieldset");
        for (let g = 0; g < (await groups.count()); g++) {
          const radios = groups.nth(g).locator("input[type=radio]");
          const name = await radios.first().getAttribute("name");
          await radios.nth(Math.max(0, keyIndex[name] ?? 0)).check(); actions.push(`answer:${name}`);
        }
        const boxes = page.locator("article textarea");
        for (let t = 0; t < (await boxes.count()); t++) { await boxes.nth(t).fill("A full answer written by the learner in their own words, with a reason."); actions.push("write"); }
        await page.waitForTimeout(200);
        const layout = await page.evaluate(() => {
          const article = document.querySelector("article") || document.body;
          const sizes = Array.from(article.querySelectorAll("p, li, label, h1, h2, h3, span, button"))
            .filter((element) => element.textContent && element.textContent.trim().length > 2 && element.getClientRects().length)
            .map((element) => parseFloat(getComputedStyle(element).fontSize));
          const rect = article.getBoundingClientRect();
          return {
            horizontalOverflowPx: document.documentElement.scrollWidth - window.innerWidth,
            minFontPx: sizes.length ? Math.min(...sizes) : null,
            scrollViewports: Math.round((document.documentElement.scrollHeight / window.innerHeight) * 100) / 100,
            contentWidthShare: Math.round((rect.width / window.innerWidth) * 100) / 100,
          };
        });
        const shot = `${String(position).padStart(2, "0")}-${sceneId}.jpg`;
        await page.screenshot({ path: path.join(dir, shot), type: "jpeg", quality: 70, fullPage: true });
        const gatedAfter = await continueButton.isDisabled();
        run.scenes.push({ position, sceneId, continueGatedBeforeAction: gatedBefore, continueEnabledAfterAction: !gatedAfter, actions, ...layout, screenshot: path.join(key, viewport.name, shot).replace(/\\/g, "/") });
        if (gatedAfter) { run.stoppedAt = sceneId; break; }
        await continueButton.click();
        if (position === candidate.scenes.length) {
          await page.waitForSelector("[data-finish-state]", { timeout: 10_000 }).catch(() => {});
          run.finishState = await page.getAttribute("[data-finish-state]", "data-finish-state").catch(() => null);
        } else {
          await page.waitForFunction((previous) => document.querySelector("[data-scene-id]")?.getAttribute("data-scene-id") !== previous, sceneId);
        }
      }
      flow.runs.push(run);
      await context.close();
      const worst = run.scenes.reduce((acc, scene) => ({ overflow: Math.max(acc.overflow, scene.horizontalOverflowPx), minFont: Math.min(acc.minFont, scene.minFontPx ?? 99), scroll: Math.max(acc.scroll, scene.scrollViewports) }), { overflow: 0, minFont: 99, scroll: 0 });
      console.log(`${key} ${viewport.name}: ${run.scenes.length}/${candidate.scenes.length} scenes, finish=${run.finishState}, stopped=${run.stoppedAt || "-"}, overflow=${worst.overflow}px, minFont=${worst.minFont}px, maxScroll=${worst.scroll}vh, errors=${errors.length}`);
    }
  }
  await browser.close();
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "flow.json"), `${JSON.stringify(flow, null, 2)}\n`);
})().catch((error) => { console.error(error); process.exit(1); });
