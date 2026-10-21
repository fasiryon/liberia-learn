// Interactive Learning V4 browser acceptance. Plays the six V4 DRAFT candidates in the production Lesson Player V2
// (fixture harness, no server, no database), completing every scene as a learner would: wrong attempts first to
// record the feedback, then correct work. Records page errors, network writes, axe WCAG 2.1 AA results, layout
// metrics at 360/390/768/1024/1440/1920 px, and screenshots. Usage: node e2e/learning-v4/run.mjs [--quick]
import { createServer } from "vite";
import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import { createRequire } from "node:module";

const quick = process.argv.includes("--quick");
const out = "artifacts/learning-v4/browser";
await fs.mkdir(`${out}/shots`, { recursive: true });
process.env.HARNESS_PORT = "3203";
process.env.HARNESS_CACHE_DIR = "node_modules/.vite-learning-v4";
const server = await createServer({ configFile: "e2e/product-design-v2/vite.config.ts", server: { strictPort: true, watch: { ignored: ["**/artifacts/**", "**/.next/**"] } } });
await server.listen();
const root = "/@fs/" + process.cwd().replaceAll("\\", "/");
const v4 = await server.ssrLoadModule(`${root}/lib/curriculum/v4/candidates.ts`);
const counties = await server.ssrLoadModule(`${root}/lib/learner-experience/teaching/models/liberiaCounties.ts`);
const mult = await server.ssrLoadModule(`${root}/lib/learner-experience/teaching/models/multiplication.ts`);
const axeSource = await fs.readFile(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");
const lessons = Object.fromEntries(v4.V4_LESSONS.map((lesson) => [lesson.key, { lesson, experience: v4.v4LearnerProjection(lesson) }]));
const keys = quick ? ["g7-math-area-perimeter"] : Object.keys(lessons);
const BASE = "http://127.0.0.1:3203";

const browser = await chromium.launch({ headless: true });
const evidence = { generatedAt: new Date().toISOString(), harness: "e2e/product-design-v2 (Vite fixture harness, production components)", lessons: {}, responsive: [], errors: [], writes: [], axe: {} };

async function newPage(width, height, reducedMotion = "reduce") {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion });
  await context.route("**/__v4/*.json", (route) => { const key = decodeURIComponent(new URL(route.request().url()).pathname.split("/").pop().replace(/\.json$/, "")); return route.fulfill({ json: lessons[key].experience }); });
  await context.route("**/api/**", (route) => route.fulfill({ json: {} }));
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  page.on("pageerror", (error) => evidence.errors.push(`${width}: ${error.message}`));
  page.on("request", (request) => { if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) evidence.writes.push(`${request.method()} ${new URL(request.url()).pathname}`); });
  return { context, page };
}

const continueButton = (page) => page.locator("footer.ll3-footer button").last();
const feedbackOf = async (locator) => (await locator.locator("[role=status]").evaluateAll((nodes) => nodes.map((node) => node.innerText))).map((text) => text.replace(/\s+/g, " ").trim()).filter(Boolean);
async function pressRange(input, steps) { await input.focus(); await input.press("Home"); for (let i = 0; i < steps; i++) await input.press("ArrowRight"); }
const wordsText = (count, seed) => Array.from({ length: count }, (_, i) => ["the", "particles", "gain", "energy", "and", "move", "faster", "so", "water", "changes", "state", "because", "this", "shows", "town"][(i + seed) % 15]).join(" ");

/** Complete one block as a learner; returns notes (feedback captured on wrong attempts). */
async function solve(page, block, sources) {
  const notes = [];
  const at = (attr) => page.locator(`[${attr}="${block.id}"]`).first();
  switch (block.type) {
    case "WORKED_SOLUTION": case "STEP_REVEAL": {
      const root = at(block.type === "WORKED_SOLUTION" ? "data-worked-solution" : "data-step-reveal");
      for (let i = 0; i < 12 && !(await root.getByText("All steps shown").count()); i++) await root.locator("button").first().click();
      break;
    }
    case "NUMERIC_RESPONSE": {
      const root = at("data-numeric-response");
      const answers = root.locator(".ll5-answer");
      const first = block.parts[0];
      const wrong = first.misconceptions[0]?.value ?? (first.quantity === "AREA" && block.shape?.kind === "RECTANGLE" ? 2 * (block.shape.length + block.shape.width) : first.formativeKey.value + 1);
      const unit = (part) => part.unit.kind === "AREA" ? `${part.unit.base}²` : part.unit.base;
      const fmt = (value) => Number.isInteger(value) ? String(value) : { 0.75: "3/4", 0.375: "3/8", 0.875: "7/8", 0.5: "1/2", 1.25: "5/4", 0.333333333333: "2/6", 1: "4/4", 0.4: "4/10", 1.333333333333: "4/3", 0.666666666667: "4/6" }[value] ?? String(value);
      for (let i = 0; i < block.parts.length; i++) {
        const part = block.parts[i];
        await answers.nth(i).locator("input").fill(fmt(i === 0 ? wrong : part.formativeKey.value));
        if (part.unit.kind !== "NONE") await answers.nth(i).locator("select").selectOption(unit(part));
      }
      await root.getByRole("button", { name: /^Check/ }).click();
      notes.push({ attempt: `wrong ${fmt(wrong)}`, feedback: await feedbackOf(answers.nth(0)) });
      if (block.mode === "INDEPENDENT") notes.push({ solutionHiddenAfterOneWrong: (await root.locator(".ll5-solution").count()) === 0 });
      if (first.unit.kind !== "NONE") { await answers.nth(0).locator("input").fill(fmt(first.formativeKey.value)); await answers.nth(0).locator("select").selectOption(first.unit.kind === "AREA" ? first.unit.base : `${first.unit.base}²`); await root.getByRole("button", { name: /^Check/ }).click(); notes.push({ attempt: "right number, wrong unit", feedback: await feedbackOf(answers.nth(0)) }); await answers.nth(0).locator("select").selectOption(unit(first)); }
      else await answers.nth(0).locator("input").fill(fmt(first.formativeKey.value));
      await root.getByRole("button", { name: /^Check/ }).click();
      notes.push({ solutionShown: (await root.locator(".ll5-solution").count()) > 0 });
      break;
    }
    case "CHECK": {
      const root = at("data-choice-check");
      for (let i = 0; i < block.items.length; i++) {
        const item = block.items[i];
        const fieldset = root.locator("fieldset").nth(i);
        const right = item.options.findIndex((option) => option.id === item.formativeKey.expectedOptionId);
        if (i === 0) { await fieldset.locator("label").nth(right === 0 ? 1 : 0).click(); notes.push({ wrongChoice: await feedbackOf(fieldset) }); }
        await fieldset.locator("label").nth(right).click();
      }
      break;
    }
    case "MISTAKE_ANALYSIS": {
      const root = at("data-mistake-analysis");
      const right = block.options.findIndex((option) => option.id === block.formativeKey.expectedOptionId);
      await root.locator("label").nth(right === 0 ? 1 : 0).click();
      notes.push({ wrongDiagnosis: await feedbackOf(root) });
      await root.locator("label").nth(right).click();
      notes.push({ correctionShown: (await root.locator(".ll5-solution").count()) > 0 });
      break;
    }
    case "FRACTION_MODEL": {
      if (block.interaction !== "SHADE_TARGET") break;
      const root = at("data-fraction-model");
      const { numerator, denominator } = block.target;
      let parts = await root.locator(".ll5-fpart").count();
      while (parts % denominator !== 0) { await root.getByRole("button", { name: parts > denominator ? "Fewer parts" : "More parts" }).click(); parts = await root.locator(".ll5-fpart").count(); }
      await root.locator(".ll5-fpart").nth(0).click(); await root.getByRole("button", { name: "Check my model" }).click(); notes.push({ wrongShading: await feedbackOf(root) }); await root.locator(".ll5-fpart").nth(0).click();
      for (let i = 0; i < numerator * (parts / denominator); i++) await root.locator(".ll5-fpart").nth(i).click();
      await root.getByRole("button", { name: "Check my model" }).click();
      notes.push({ shaded: `${numerator * (parts / denominator)}/${parts}`, feedback: await feedbackOf(root) });
      break;
    }
    case "FRACTION_NUMBER_LINE": {
      const root = at("data-number-line");
      const input = root.locator("input[type=range]");
      await pressRange(input, 1); await root.getByRole("button", { name: "Check the point" }).click(); notes.push({ wrongPoint: await feedbackOf(root) });
      await pressRange(input, block.formativeKey.numerator * (block.denominator / block.formativeKey.denominator));
      await root.getByRole("button", { name: "Check the point" }).click();
      break;
    }
    case "FRACTION_COMPARE": {
      const root = at("data-fraction-compare");
      const label = { "<": "is less than", "=": "is equal to", ">": "is greater than" };
      const wrong = block.formativeKey.relation === ">" ? "<" : ">";
      await root.getByRole("button", { name: label[wrong] }).click(); notes.push({ wrongRelation: await feedbackOf(root) });
      await root.getByRole("button", { name: label[block.formativeKey.relation] }).click();
      break;
    }
    case "AREA_MODEL": {
      if (block.mode !== "FILL") break;
      const root = at("data-area-model");
      const rows = block.splitB ?? [block.factorB], cols = block.splitA ?? mult.placeValueParts(block.factorA);
      const inputs = root.locator(".ll5-am-input");
      let index = 0;
      for (const row of rows) for (const col of cols) { const strip = (v) => Number(String(v).replace(/0+$/, "")) || v; await inputs.nth(index).fill(String(index === 0 ? strip(row) * strip(col) : row * col)); index++; }
      await root.locator(".ll5-answer input").fill(String(block.factorA * block.factorB));
      await root.getByRole("button", { name: "Check" }).click(); notes.push({ placeValueDropped: await feedbackOf(root) });
      await inputs.nth(0).fill(String(rows[0] * cols[0]));
      await root.getByRole("button", { name: "Check" }).click();
      break;
    }
    case "PREDICT_OBSERVE": {
      const root = at("data-predict-observe");
      const right = block.options.findIndex((option) => option.id === block.formativeKey.expectedOptionId);
      await root.locator("label").nth(right === 0 ? 1 : 0).click();
      await root.getByRole("button", { name: "Lock in my prediction" }).click();
      notes.push({ observationHiddenBeforeRun: (await root.getByText(block.observation.slice(0, 40)).count()) === 0 });
      await root.getByRole("button", { name: /Run the experiment/ }).click();
      await root.locator("textarea").waitFor();
      notes.push({ predictionFeedback: await feedbackOf(root) });
      await root.locator("textarea").fill("The particles gain energy and move faster, but the particles themselves stay the same size.");
      break;
    }
    case "MAP_EXPLORER": {
      if (!block.task) { await page.locator(`[data-map-explorer="${block.id}"] button.ll5-county`).first().click(); break; }
      const root = at("data-map-explorer");
      const target = counties.countyById(block.task.formativeKey.regionId);
      const wrong = counties.LIBERIA_COUNTIES.find((county) => county.id !== target.id && Math.abs(county.tile.col - target.tile.col) + Math.abs(county.tile.row - target.tile.row) === 1) ?? counties.LIBERIA_COUNTIES[0];
      await root.getByRole("button", { name: `${wrong.name} County`, exact: true }).click(); await root.getByRole("button", { name: /^Answer:/ }).click(); notes.push({ wrongCounty: wrong.name, feedback: await feedbackOf(root) });
      await root.getByRole("button", { name: `${target.name} County`, exact: true }).click(); await root.getByRole("button", { name: /^Answer:/ }).click();
      break;
    }
    case "SOURCE_EVIDENCE": {
      const root = at("data-source-evidence");
      const sentences = root.locator(".ll5-sentence");
      const distractor = block.sentences.findIndex((sentence) => !sentence.supports);
      await sentences.nth(distractor).click(); await root.getByRole("button", { name: "Check my evidence" }).click(); notes.push({ wrongEvidence: await feedbackOf(root) }); await sentences.nth(distractor).click();
      for (let i = 0; i < block.sentences.length; i++) if (block.sentences[i].supports) await sentences.nth(i).click();
      await root.getByRole("button", { name: "Check my evidence" }).click();
      break;
    }
    case "SORT": {
      const root = at("data-sort");
      for (const card of block.cards) {
        await root.locator(".ll4-card-tray button", { hasText: card.text }).first().click();
        await root.getByRole("button", { name: `Put “${card.text}” in ${block.groups.find((group) => group.id === card.group).label}` }).click();
      }
      break;
    }
    case "SENTENCE_BUILDER": {
      const root = at("data-sentence-builder");
      const [order] = block.formativeKey.orders;
      for (const word of [...order].reverse().slice(0, 2)) await root.locator(".ll5-tile-bank button", { hasText: new RegExp(`^${word}$`) }).first().click();
      await root.getByRole("button", { name: "Check my sentence" }).click(); notes.push({ incomplete: await feedbackOf(root) });
      await root.getByRole("button", { name: /Clear/ }).click();
      for (const word of order) await root.locator(".ll5-tile-bank button:not([disabled])", { hasText: new RegExp(`^${word}$`) }).first().click();
      await root.getByRole("button", { name: "Check my sentence" }).click();
      break;
    }
    case "WRITING_ORGANIZER": {
      const root = at("data-writing-organizer");
      const source = block.sourceBlockId ? sources[block.sourceBlockId] : null;
      const quote = source ? `"${source.split(". ")[5]?.split(" ").slice(0, 8).join(" ")}"` : null;
      for (let i = 0; i < block.fields.length; i++) {
        const field = block.fields[i];
        const text = /evidence/i.test(field.id) && quote ? `The story says ${quote} and more.` : `${wordsText(field.minWords + 2, i)} this shows the idea.`;
        await root.locator("textarea").nth(i).fill(text);
      }
      await root.getByRole("button", { name: "Check my draft" }).click();
      notes.push({ draftNotes: (await root.locator(".ll5-solution").allTextContents()).join(" ").slice(0, 300) });
      const boxes = root.locator("input[type=checkbox]");
      for (let i = 0; i < (await boxes.count()); i++) await boxes.nth(i).check();
      break;
    }
    default: break;
  }
  return notes;
}

async function axe(page, label) {
  await page.addScriptTag({ content: axeSource });
  const result = await page.evaluate(async () => {
    const run = await window.axe.run(document.querySelector("[data-lesson-player-v2]") ?? document.body, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } });
    return { violations: run.violations.map((violation) => ({ id: violation.id, impact: violation.impact, nodes: violation.nodes.length, target: violation.nodes[0]?.target })), incomplete: run.incomplete.length };
  });
  evidence.axe[label] = result;
  return result;
}

const metrics = (page) => page.evaluate(() => {
  const box = (selector) => { const element = document.querySelector(selector); if (!element) return null; const rect = element.getBoundingClientRect(); return rect.width > 0 ? { left: Math.round(rect.left), width: Math.round(rect.width) } : null; };
  return { viewport: innerWidth, horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1, outline: box(".ll3-stage-outline"), main: box(".ll3-stage-main"), support: box(".ll3-stage-support"), sceneText: box(".ll3-scene-text"), contentsDrawer: box(".ll4-stage-drawer .ll4-drawer-trigger"), toolsDrawer: box(".ll5-support-drawer .ll4-drawer-trigger"), footer: box("footer.ll3-footer") };
});

try {
  // 1. Every lesson end to end at desktop 1440, with axe per scene; geometry also on a 390 phone.
  for (const key of keys) {
    const { experience } = lessons[key];
    const sources = Object.fromEntries(experience.scenes.flatMap((scene) => [...(scene.teaching?.blocks ?? []), ...(scene.teaching?.visual ? [scene.teaching.visual] : [])]).filter((block) => block.type === "READING_PASSAGE").map((block) => [block.id, `${block.title}. ${block.paragraphs.join(" ")}`]));
    for (const [width, height] of key === "g7-math-area-perimeter" ? [[1440, 900], [390, 844]] : [[1440, 900]]) {
      const { context, page } = await newPage(width, height);
      const record = { scenes: [], finished: false, writesBefore: evidence.writes.length };
      await page.goto(`${BASE}/lab-review/v4-lessons/${key}`, { waitUntil: "domcontentloaded" });
      await page.locator("[data-lesson-player-v2]").waitFor();
      for (const scene of experience.scenes) {
        await page.locator(`[data-scene-id="${scene.id}"]`).waitFor();
        const blocks = [...(scene.teaching?.blocks ?? []), ...(scene.teaching?.visual ? [scene.teaching.visual] : [])];
        const gatedBefore = blocks.length > 0 ? await continueButton(page).isDisabled() : null;
        const notes = [];
        for (const block of blocks) { try { notes.push({ block: `${block.type}:${block.id ?? ""}`, notes: await solve(page, block, sources) }); } catch (error) { notes.push({ block: `${block.type}:${block.id ?? ""}`, error: String(error.message).split("\n")[0] }); } }
        const shot = `${out}/shots/${key}--${width}--${String(experience.scenes.indexOf(scene) + 1).padStart(2, "0")}-${scene.id}.png`;
        await page.screenshot({ path: shot, fullPage: true });
        if (width === 1440) await axe(page, `${key}/${scene.id}`);
        const math = await page.locator("[data-scene-id] .ll3-scene math").count();
        const rawTex = await page.evaluate(() => /\\(frac|times|text|cdot)\b/.test(document.querySelector(".ll3-scene")?.innerText ?? ""));
        const enabled = !(await continueButton(page).isDisabled());
        record.scenes.push({ id: scene.id, phase: scene.teaching?.phase ?? null, gatedUntilDone: gatedBefore, completed: enabled, mathElements: math, rawTexVisible: rawTex, notes, screenshot: shot.replace(`${out}/`, "") });
        if (!enabled) break;
        if (scene !== experience.scenes.at(-1)) await continueButton(page).click(); else { await continueButton(page).click(); record.finished = true; }
      }
      record.newWrites = evidence.writes.slice(record.writesBefore);
      evidence.lessons[`${key}@${width}`] = record;
      await context.close();
    }
  }

  // 2. Responsive layout of the reference lesson at six widths (two scenes each), plus rail collapse at 1440.
  if (!quick) for (const [width, height] of [[360, 780], [390, 844], [768, 1024], [1024, 768], [1440, 900], [1920, 1080]]) {
    const { context, page } = await newPage(width, height);
    await page.goto(`${BASE}/lab-review/v4-lessons/g7-math-area-perimeter`, { waitUntil: "domcontentloaded" });
    await page.locator("[data-scene-id=field]").waitFor();
    await continueButton(page).click();
    await page.locator("[data-scene-id=see-it]").waitFor();
    const seeIt = await metrics(page);
    await page.screenshot({ path: `${out}/shots/responsive--${width}--see-it.png` });
    await continueButton(page).click(); await solve(page, lessons["g7-math-area-perimeter"].experience.scenes[2].teaching.blocks[0], {}); await continueButton(page).click();
    await page.locator("[data-scene-id=solve-classroom]").waitFor();
    await page.screenshot({ path: `${out}/shots/responsive--${width}--solve-classroom.png` });
    const row = { width, seeIt, solve: await metrics(page) };
    if (width === 1440) {
      await page.getByRole("button", { name: "Hide" }).first().click();
      await page.getByRole("button", { name: "Hide" }).first().click();
      row.railsCollapsed = await metrics(page);
      row.sceneKeptAfterCollapse = await page.locator("[data-scene-id=solve-classroom]").count() === 1;
      await page.screenshot({ path: `${out}/shots/responsive--1440--rails-collapsed.png` });
    }
    if (width === 768) {
      await page.locator(".ll5-support-drawer .ll4-drawer-trigger").click();
      row.toolsDrawerOpens = await page.getByRole("dialog", { name: "Lesson help" }).isVisible();
      await page.screenshot({ path: `${out}/shots/responsive--768--tools-drawer.png` });
      await page.keyboard.press("Escape");
    }
    evidence.responsive.push(row);
    await context.close();
  }

  // 3. Keyboard: the reference lesson's first activity is reachable and operable without a pointer.
  if (!quick) {
    const { context, page } = await newPage(1440, 900);
    await page.goto(`${BASE}/lab-review/v4-lessons/g7-math-area-perimeter`, { waitUntil: "domcontentloaded" });
    await page.locator("[data-scene-id=field]").waitFor();
    await continueButton(page).focus(); await page.keyboard.press("Enter");
    await page.locator("[data-scene-id=see-it]").waitFor();
    const perimeter = page.getByRole("button", { name: "Perimeter (edge)" });
    await perimeter.focus(); await page.keyboard.press("Space");
    const slider = page.getByLabel(/^Length/);
    await slider.focus(); await page.keyboard.press("ArrowRight"); await page.keyboard.press("ArrowRight");
    evidence.keyboard = { perimeterToggled: await perimeter.getAttribute("aria-pressed"), lengthAfterTwoArrows: await page.locator(".ll5-slider strong").first().textContent(), readout: (await page.locator(".ll5-readout").first().innerText()).replace(/\s+/g, " ") };
    await context.close();
  }
} finally {
  await fs.writeFile(`${out}/evidence.json`, JSON.stringify(evidence, null, 2));
  await browser.close();
  await server.close();
}
const failures = Object.entries(evidence.lessons).filter(([, record]) => !record.finished || record.scenes.some((scene) => scene.rawTexVisible || scene.notes.some((note) => note.error)));
const axeFailures = Object.entries(evidence.axe).filter(([, result]) => result.violations.length);
console.log(JSON.stringify({ lessons: Object.keys(evidence.lessons).length, finished: Object.values(evidence.lessons).filter((record) => record.finished).length, failures: failures.map(([key]) => key), axeViolations: axeFailures.length, pageErrors: evidence.errors.length, writes: evidence.writes.length, overflow: evidence.responsive.filter((row) => row.seeIt.horizontalOverflow || row.solve.horizontalOverflow).map((row) => row.width) }, null, 1));
