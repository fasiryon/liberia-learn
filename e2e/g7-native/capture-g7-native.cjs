/**
 * Grade 7 native V1 — instructional-flow walkthrough and screenshots of the dev-only preview.
 *
 * Usage (dev server must already run with the harness enabled):
 *   LAB_REVIEW_HARNESS=1 npx next dev -p 3197
 *   node e2e/g7-native/capture-g7-native.cjs [baseUrl] [outDir]
 *
 * Walks every scene of both candidate lessons at desktop (1440×900) and phone (390×844) widths in the
 * existing Lesson Player V2, doing what a learner does (open steps, answer, write), and writes one JPEG
 * per scene plus flow.json (scene order, interactions, Continue gating, horizontal overflow, console
 * errors). Answers use the reviewer-only keys so the right-answer feedback is visible; the misconception
 * scene also records a wrong-answer feedback frame. Nothing is sent: the preview has no runtime.
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const BASE = process.argv[2] || "http://localhost:3197";
const OUT = process.argv[3] || "artifacts/g7-native-curriculum-v1";
const PKG = "curriculum/review/g7-native-v1";
const LESSONS = [
  { key: "math-number-sense-place-value", id: "cv2-cand-g7-math-number-sense-place-value" },
  { key: "literacy-essay-structure-argument", id: "cv2-cand-g7-literacy-essay-structure-argument" },
];
const VIEWPORTS = [{ name: "desktop", width: 1440, height: 900 }, { name: "mobile", width: 390, height: 844 }];
const WRITTEN = {
  "build-number": "3,406,029.508",
  "reflect-place-value": "The 4 in 40,000 is in the ten-thousands place, so its value is 40,000. The 4 in 0.04 is in the hundredths place, so its value is four hundredths. Same digit, different place, different value.",
  "order-peel": "B, D, C, A. B is the topic sentence.",
  "write-thesis": "Every community should have a public library because it gives children books to read and gives adults a quiet place to study.",
  "write-peel": "A public library gives children books they cannot buy at home. For example, in my town many families share one or two books, so children read the same pages again and again. This shows that a library would give them new stories and information every week, which helps them read better in school. So a library is one important reason every community should have one.",
  "counter-exchange": "There were 14 counters in the hundredths column. Ten of them became 1 counter in the tenths column, so the chart shows 1 tenth and 4 hundredths. The number did not change: it is still 0.14, because 10 hundredths make 1 tenth.",
  "counter-partner-number": "1,203,045.6; the 1 is worth 1,000,000",
  "plan-brainstorm": "Children get new books to read\nAdults get a quiet place to study\nIt keeps young people busy after school\nPeople can read newspapers there",
  "plan-reasons": "Claim: every community should have a public library. Reason 1: children get new books; evidence: in my town families share one or two books (what I see at home). Reason 2: adults get a place to study; evidence: my aunt studies for her exams at the church because our house is noisy.",
  "write-conclusion-garden": "For these reasons, a school garden is worth the land it uses. It teaches learners real farming and science skills, and it puts fresh food on the lunch table, even if the work takes a little time each week. Every school with empty land should plant a garden this year.",
  "peer-strength": "One strength is the evidence, because it is real and specific: 'in my town many families share one or two books' names a place and something the writer has seen.",
  "peer-next-step": "The paragraph does not yet name a source for its numbers. Next time, try saying who told you or where you read the figure, so the reader can check it.",
  "reflect-writing": "The evidence is hardest for me because I often write my opinion again. Next time I will test each piece of evidence with the four questions before I use it.",
  // v0.3.0 (Curriculum Excellence V1) prompts.
  "reason-compare": "Tamba is not right. 0.9 has 9 tenths and 0.85 has only 8 tenths, so 0.9 is greater. I checked by writing 0.9 as 0.90: 90 hundredths is more than 85 hundredths.",
  "reason-value": "The first 3 is worth 300, the middle 3 is worth 3 and the last 3 is worth 0.03. The first 3 is 100 times the 3 in the ones place because it is two places to the left.",
  "ready-paragraph": "The Waterside market is the busiest place in my community. Every morning traders arrive early to set out fish, greens and pepper. Buyers come from many streets to bargain for good prices. By noon the market is so full that it is hard to walk between the tables.",
  "ready-two-sides": "Yes: a longer break gives students time to eat and rest. No: it would make the school day end later.",
  "solo-thesis": "Every school should have a reading corner because it helps students read more and gives them a quiet place to study.",
  "solo-peel": "A reading corner helps students read more. For example, in my class the teacher keeps a box of old storybooks, and during break many of us read them instead of playing. This shows that when books are close by, students choose to read on their own, which builds their vocabulary. So a reading corner is one reason every school should make space for books.",
  "solo-labels": "Point, Evidence, Explain, Link",
};

(async () => {
  const browser = await chromium.launch();
  const flow = { capturedAt: new Date().toISOString(), base: BASE, runs: [] };
  for (const lesson of LESSONS) {
    const projection = JSON.parse(fs.readFileSync(path.join(PKG, lesson.key, "learner-projection.json"), "utf8"));
    const review = JSON.parse(fs.readFileSync(path.join(PKG, lesson.key, "assessment-review.json"), "utf8"));
    const keyFor = (itemId) => {
      for (const scene of projection.scenes) if (scene.interaction.kind === "MULTIPLE_CHOICE") for (const item of scene.interaction.items) if (item.id === itemId) return item.correctIndex;
      const exit = review.items.find((entry) => entry.item.id === itemId);
      return exit ? exit.item.correctIndex : 0;
    };
    for (const viewport of VIEWPORTS) {
      const dir = path.join(OUT, "screenshots", lesson.key, viewport.name);
      fs.mkdirSync(dir, { recursive: true });
      // Service workers are blocked so the dev-only "app update" toast cannot cover lesson controls.
      const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1, serviceWorkers: "block" });
      const page = await context.newPage();
      const errors = [];
      page.on("console", (message) => { if (message.type() === "error") errors.push(message.text().slice(0, 300)); });
      page.on("pageerror", (error) => errors.push(String(error).slice(0, 300)));
      const response = await page.goto(`${BASE}/lab-review/experience/${lesson.id}`, { waitUntil: "networkidle", timeout: 180_000 });
      await page.waitForSelector("[data-scene-id]", { timeout: 120_000 });
      // Blocking service workers makes the shell show "Offline support could not start" in a fixed
      // status toast that can sit over the last answer choice. It is a capture artifact, so hide it.
      await page.addStyleTag({ content: 'div.fixed[role="status"][aria-live="polite"] { display: none !important; }' });
      const run = { lesson: lesson.key, viewport: viewport.name, httpStatus: response.status(), scenes: [], errors };
      for (let position = 1; position <= projection.scenes.length; position++) {
        const sceneId = await page.getAttribute("[data-scene-id]", "data-scene-id");
        const sceneType = await page.getAttribute("[data-scene-id]", "data-scene-type");
        const title = (await page.textContent("#scene-title"))?.trim();
        const continueButton = page.locator("button[data-primary]").last();
        const gatedBefore = await continueButton.isDisabled();
        const actions = [];
        // Open diagram steps in order.
        for (;;) {
          const next = page.locator("article button[aria-expanded='false']:not([disabled])").first();
          if (!(await next.count())) break;
          await next.click(); actions.push("reveal-step");
        }
        // Answer every question group, recording a wrong-answer frame on the misconception scene.
        const groups = page.locator("article fieldset");
        for (let g = 0; g < (await groups.count()); g++) {
          const radios = groups.nth(g).locator("input[type=radio]");
          const name = await radios.first().getAttribute("name");
          const key = keyFor(name);
          if (sceneId === "misconceptions" && g === 0) {
            await radios.nth(key === 0 ? 1 : 0).check(); actions.push(`answer-wrong:${name}`);
            await page.waitForTimeout(150);
            await page.screenshot({ path: path.join(dir, `${String(position).padStart(2, "0")}-${sceneId}-wrong-answer-feedback.jpg`), type: "jpeg", quality: 72, fullPage: true });
          }
          await radios.nth(key).check(); actions.push(`answer:${name}`);
        }
        const boxes = page.locator("article textarea");
        for (let t = 0; t < (await boxes.count()); t++) {
          const id = (await boxes.nth(t).getAttribute("id")).replace(/^reflect-/, "");
          await boxes.nth(t).fill(WRITTEN[id] || "A full written answer from the learner, long enough to continue."); actions.push(`write:${id}`);
        }
        await page.waitForTimeout(200);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        const shot = `${String(position).padStart(2, "0")}-${sceneId}.jpg`;
        await page.screenshot({ path: path.join(dir, shot), type: "jpeg", quality: 72, fullPage: true });
        const media = await page.locator("article figure[data-media-kind] img").count();
        const gatedAfter = await continueButton.isDisabled();
        run.scenes.push({ position, sceneId, sceneType, title, continueGatedBeforeAction: gatedBefore, continueEnabledAfterAction: !gatedAfter, actions, diagramsRendered: media, horizontalOverflowPx: overflow, screenshot: path.join("screenshots", lesson.key, viewport.name, shot).replace(/\\/g, "/") });
        if (gatedAfter) { run.stoppedAt = sceneId; break; }
        await continueButton.click();
        if (position === projection.scenes.length) {
          await page.waitForSelector("[data-finish-state]", { timeout: 10_000 });
          run.finishState = await page.getAttribute("[data-finish-state]", "data-finish-state");
          run.evidenceDispositions = await page.getAttribute("[data-evidence-dispositions]", "data-evidence-dispositions");
          await page.screenshot({ path: path.join(dir, `${String(position + 1).padStart(2, "0")}-finished.jpg`), type: "jpeg", quality: 72, fullPage: true });
        } else {
          await page.waitForFunction((previous) => document.querySelector("[data-scene-id]")?.getAttribute("data-scene-id") !== previous, sceneId);
        }
      }
      flow.runs.push(run);
      await context.close();
      console.log(`${lesson.key} ${viewport.name}: ${run.scenes.length} scenes, finish=${run.finishState}, errors=${errors.length}`);
    }
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, "flow.json"), `${JSON.stringify(flow, null, 2)}\n`);
})().catch((error) => { console.error(error); process.exit(1); });
