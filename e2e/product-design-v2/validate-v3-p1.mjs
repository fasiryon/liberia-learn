import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { createServer } from "vite";
/**
 * Student Experience V3 P1 browser acceptance (fixture harness: production lesson components, mocked API
 * answers). Covers: Read as a playlist on both lesson routes (one section on the stage, bounded rail with its
 * own scroll, phone drawer, deep link, Back/Forward, refresh, keyboard, final-section assessment hand-off, no
 * lost input), legacy slides (teacher notes, reading cards, number tool), the native V2 player (flow diagram,
 * bounded outline, phone drawer, feedback questions), the Grade 7 and cross-subject teaching demos (zero API
 * calls, zero storage), overflow/targets at 390/768/1440/1920 and axe. Not server authorization, production
 * content or real-device evidence.
 * Run: node e2e/product-design-v2/validate-v3-p1.mjs   (HARNESS_PORT overrides 3191)
 */
const out = "artifacts/student-experience-v3-p1/validation";
await fs.mkdir(out, { recursive: true });
const port = Number(process.env.HARNESS_PORT ?? 3191);
const base = `http://127.0.0.1:${port}`;
const server = await createServer({ configFile: "e2e/product-design-v2/vite.config.ts", server: { strictPort: true, port } });
await server.listen();
const loader = await createServer({ configFile: "e2e/product-design-v2/vite.config.ts", optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true }, appType: "custom" });
const legacy = await loader.ssrLoadModule("/legacyLessonFixtures.ts");
const generated = await loader.ssrLoadModule("/generatedLessonFixture.ts");
const native = await loader.ssrLoadModule("/lessonFixtures.ts");
await loader.close();

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ reducedMotion: "reduce" });
const apiCalls = [];
let nativeLesson = false;
await context.route("**/api/**", async (route) => {
  const request = route.request(); const p = new URL(request.url()).pathname;
  apiCalls.push(`${request.method()} ${p}`);
  if (p.endsWith("/experience")) return nativeLesson ? route.fulfill({ json: native.runtimeLessonDelivery(6, { labAuthorized: false }) }) : route.fulfill({ status: 404, json: { error: "not_found" } });
  if (p === `/api/curriculum/${generated.GENERATED_CONTENT_ID}`) return route.fulfill({ json: generated.generatedCurriculumResponse() });
  if (p === `/api/curriculum/${generated.LONG_GENERATED_CONTENT_ID}`) return route.fulfill({ json: generated.longGeneratedCurriculumResponse() });
  if (p === `/api/curriculum/${generated.STRESS_CONTENT_ID}`) return route.fulfill({ json: generated.stressCurriculumResponse() });
  if (p.startsWith("/api/curriculum/")) return route.fulfill({ json: legacy.legacyCurriculumResponse() });
  if (p.startsWith("/api/student/work/")) return route.fulfill({ json: legacy.legacyWorkResponse() });
  return route.fulfill({ json: {} });
});
const page = await context.newPage();
page.setDefaultNavigationTimeout(180000); page.setDefaultTimeout(60000);
const errors = []; page.on("pageerror", (error) => errors.push(error.message));
const evidence = { playlist: [], heights: [], keyboard: {}, assigned: {}, slides: {}, native: {}, demos: {}, axe: {} };
const viewport = (width) => page.setViewportSize({ width, height: width >= 1440 ? 900 : width >= 768 ? 1024 : 844 });
const go = async (url, ready = "#lesson-title") => { await page.goto(`${base}${url}`, { waitUntil: "domcontentloaded" }); await page.locator(ready).first().waitFor(); };
const overflow = () => page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
const smallTargets = (selector, min = 44) => page.evaluate(([sel, m]) => [...document.querySelectorAll(sel)].filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.height < m && getComputedStyle(el).visibility !== "hidden"; }).map((el) => `${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 40)}:${Math.round(el.getBoundingClientRect().height)}`), [selector, min]);
const TARGETS = ".ll3-btn, .ll3-back, .ll3-choice, .ll3-outline-list button, .ll4-drawer-trigger, .ll4-icon-btn, .ll4-digit-card, .ll4-slot, .ll4-word-card, .ll4-cycle-node, .ll4-timeline-dot, .ll4-diagram-node:not([disabled])";
async function axe(name) {
  await page.addScriptTag({ path: "node_modules/axe-core/axe.min.js" });
  const result = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] } })).violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, target: v.nodes[0]?.target })));
  evidence.axe[name] = result;
  assert.equal(result.filter((v) => ["serious", "critical"].includes(v.impact)).length, 0, `${name} axe: ${JSON.stringify(result)}`);
}
const visibleSection = () => page.evaluate(() => [...document.querySelectorAll("[data-read-section]")].filter((s) => !s.hidden).map((s) => s.getAttribute("data-read-section")));
const stress = `/student/lesson/${generated.STRESS_CONTENT_ID}?grade=7`;
const S17 = "section-17-the-section-a-learner-opens-directly";

// 1. Playlist geometry at 390/768/1440/1920 on a 22-section lesson: one section shown, no overflow, the rail is
//    bounded by the viewport and scrolls itself, and the document is not as tall as the contents list.
for (const width of [390, 768, 1440, 1920]) {
  await viewport(width);
  await go(stress);
  await page.locator("[data-reading-layout=playlist]").waitFor();
  assert.equal(await overflow(), false, `stress/${width} overflows`);
  assert.equal((await visibleSection()).length, 1, `stress/${width} shows one section`);
  assert.equal(await page.locator("[data-read-section]").count(), generated.STRESS_SECTION_COUNT, "all sections stay mounted");
  const geometry = await page.evaluate(() => {
    const rail = document.querySelector(".ll4-read-rail");
    const list = rail?.querySelector("ol");
    const railVisible = rail && getComputedStyle(rail).display !== "none";
    return { docHeight: document.documentElement.scrollHeight, innerHeight, railVisible: Boolean(railVisible), railHeight: railVisible ? Math.round(rail.getBoundingClientRect().height) : 0, listScrolls: railVisible ? list.scrollHeight > list.clientHeight : null, drawerVisible: getComputedStyle(document.querySelector(".ll4-read-drawer")).display !== "none" };
  });
  if (width >= 1440) {
    assert(geometry.railVisible && !geometry.drawerVisible, `rail (not drawer) at ${width}`);
    assert(geometry.railHeight <= geometry.innerHeight, `rail ${geometry.railHeight}px taller than viewport at ${width}`);
    assert.equal(geometry.listScrolls, true, "22 entries scroll inside the rail");
  } else assert(geometry.drawerVisible && !geometry.railVisible, `drawer (not rail) at ${width}`);
  assert(geometry.docHeight < 3 * geometry.innerHeight, `document ${geometry.docHeight}px is driven by more than one section at ${width}`);
  assert.deepEqual(await smallTargets(TARGETS), [], `stress/${width} small targets`);
  evidence.heights.push({ width, ...geometry });
}

// 2. Section 17 of 22 opens immediately from a deep link, and from the rail (1440) or the drawer (390).
await viewport(1440);
await go(`${stress}&section=${S17}`);
await page.locator(`[data-read-section='${S17}']:visible`).waitFor();
assert.deepEqual(await visibleSection(), [S17], "deep link opens section 17");
const railActiveInView = await page.evaluate(() => { const list = document.querySelector(".ll4-read-rail ol"); const a = list.querySelector("[aria-current]"); const l = list.getBoundingClientRect(), r = a.getBoundingClientRect(); return r.top >= l.top - 1 && r.bottom <= l.bottom + 1; });
assert(railActiveInView, "selected entry is visible inside the rail");
await page.screenshot({ path: `${out}/section-17-1440.png` });
await go(stress);
await page.locator(".ll4-read-rail button", { hasText: "Section 17:" }).click();
assert.deepEqual(await visibleSection(), [S17]);
assert.equal(await page.evaluate(() => document.activeElement?.id), `${S17}-h`, "focus moves to the section heading");
assert.equal(new URL(page.url()).searchParams.get("section"), S17);
const pageY = await page.evaluate(() => scrollY);
assert(pageY < 400, `opening a section does not scroll through the lesson (scrollY ${pageY})`);
// Keyboard: Next/Previous by Enter; ArrowDown/Up move focus along the rail.
await page.locator(".ll4-read-pager button").nth(1).focus(); await page.keyboard.press("Enter");
assert.equal((await visibleSection())[0], "section-18-fixture-topic-18");
await page.locator(".ll4-read-pager button").nth(0).focus(); await page.keyboard.press("Enter");
assert.equal((await visibleSection())[0], S17);
await page.locator(".ll4-read-rail button[aria-current]").focus(); await page.keyboard.press("ArrowDown"); await page.keyboard.press("Enter");
assert.equal((await visibleSection())[0], "section-18-fixture-topic-18");
// Browser Back/Forward and refresh.
await page.goBack(); await page.waitForFunction((id) => !document.getElementById(id)?.hidden, S17);
await page.goForward(); await page.waitForFunction(() => !document.getElementById("section-18-fixture-topic-18")?.hidden);
await page.reload({ waitUntil: "domcontentloaded" }); await page.locator("#lesson-title").waitFor();
await page.waitForFunction(() => !document.getElementById("section-18-fixture-topic-18")?.hidden);
evidence.keyboard.playlist = "rail click, deep link, Enter on Next/Previous, ArrowDown+Enter in rail, Back, Forward, refresh";
await axe("read-playlist-1440");
// Hiding lesson help returns its width to the reading stage.
const before = (await page.locator(".ll4-read-stage").boundingBox()).width;
await page.locator(".ll3-support").getByRole("button", { name: "Hide" }).click();
const after = (await page.locator(".ll4-read-stage").boundingBox()).width;
assert(after > before + 150, `hiding help widens the stage (${before} → ${after})`);
evidence.playlist.push({ stageWithHelp: Math.round(before), stageWithoutHelp: Math.round(after) });

await viewport(390);
await go(stress);
await page.locator(".ll4-read-drawer .ll4-drawer-trigger").click();
const dialog = page.getByRole("dialog", { name: "Contents" });
await dialog.waitFor();
const sheet = await page.evaluate(() => { const list = document.querySelector(".ll4-drawer-list"); return { scrolls: list.scrollHeight > list.clientHeight, bodyLocked: document.body.style.overflow === "hidden", fits: document.querySelector(".ll4-drawer-sheet").getBoundingClientRect().height <= innerHeight }; });
assert(sheet.scrolls && sheet.bodyLocked && sheet.fits, `drawer scrolls itself and locks the page: ${JSON.stringify(sheet)}`);
await page.screenshot({ path: `${out}/drawer-390.png` });
await dialog.getByRole("button", { name: /Section 17:/ }).click();
await dialog.waitFor({ state: "detached" });
assert.deepEqual(await visibleSection(), [S17], "choosing in the drawer shows that section");
assert.equal(await page.evaluate(() => document.body.style.overflow), "", "page scroll restored");
await page.locator(".ll4-read-drawer .ll4-drawer-trigger").click(); await page.keyboard.press("Escape");
await dialog.waitFor({ state: "detached" });
assert.equal(await page.evaluate(() => document.activeElement?.classList.contains("ll4-drawer-trigger")), true, "Escape returns focus to Contents");
await axe("read-playlist-390");
evidence.playlist.push({ drawer: sheet, section17: "drawer → section 17 → drawer closed" });

// 3. The long hosted-shape Grade 7 Literacy lesson (17+ authored sections): switching replaces the stage and
//    the shown text is exactly the authored section text.
await viewport(1440);
await go(`/student/lesson/${generated.LONG_GENERATED_CONTENT_ID}?grade=7`);
const longCount = await page.locator("[data-read-section]").count();
assert(longCount >= 17, `long lesson has ${longCount} sections`);
const heightOne = await page.evaluate(() => document.documentElement.scrollHeight);
await page.locator(".ll4-read-rail button").nth(longCount - 3).click();
const shown = await page.locator("[data-read-section]:visible").innerText();
assert(shown.length > 40 && (await visibleSection()).length === 1);
evidence.playlist.push({ longLessonSections: longCount, documentHeight: heightOne });
await axe("long-literacy-read");

// 4. Assigned route: the existing "Go to assessment" appears only with the final section and still reaches the
//    existing exit ticket; nothing new is written.
await go(`/student/lessons/${legacy.LEGACY_WORK_ID}?grade=7`);
await page.locator("[data-reading-layout=playlist]").waitFor();
assert.equal(await page.locator("[data-read-final]:visible").count(), 0, "hand-off hidden before the final section");
await page.locator(".ll4-read-rail button").last().click();
await page.locator("[data-read-final]:visible").getByRole("button", { name: "Go to assessment" }).click();
await page.getByPlaceholder("Write your answer here").waitFor();
const writes = apiCalls.filter((call) => call.startsWith("POST") && !call.endsWith("/api/track"));
assert.deepEqual(writes, [], `reading made writes: ${writes}`);
evidence.assigned = { handOff: "final section only → existing exit ticket", writes };
await axe("assigned-read");

// 5. Legacy slides: teacher notes labelled and skippable, paragraphs as reading cards, number tool on maths.
await go(`/student/lesson/${generated.GENERATED_CONTENT_ID}?grade=7`);
await page.getByRole("group", { name: "How to use this lesson" }).getByRole("button", { name: "Slides", exact: true }).click();
const nextSlide = () => page.locator("[data-legacy-slides] .ll3-slide-nav").getByRole("button", { name: "Next", exact: true }).click();
await nextSlide(); await nextSlide();
await page.locator(".ll4-audience[data-audience=TEACHER]").waitFor();
assert(await page.locator(".ll4-read-card").count() >= 2, "teacher explanation paragraphs become reading cards");
await page.getByRole("button", { name: /Skip notes for teachers/ }).click();
const slideTitle = await page.locator("[data-legacy-slides] .ll3-scene-title").innerText();
assert.equal(slideTitle.trim(), "Worked Examples or Demonstrations", "skipping moves on from the note slide to the next learner slide");
assert.equal(await page.locator(".ll4-read-card[data-labelled]").count() >= 3, true, "worked examples keep their authored labels as card headings");
await axe("hosted-slides");
await go(`/student/lesson/${legacy.LEGACY_CONTENT_ID}?grade=7`);
await page.getByRole("group", { name: "How to use this lesson" }).getByRole("button", { name: "Slides", exact: true }).click();
for (let n = 0; n < 3; n++) await nextSlide();
await page.locator("[data-number-lens]").waitFor();
assert(await page.locator("[data-number-lens]").getByText("two million, three hundred fifty thousand, four hundred eighty").isVisible());
evidence.slides = { teacherNotes: "labelled + skippable", cards: "reading cards with authored labels", numberLens: "2,350,480 from the worked-example slide" };
await axe("legacy-slides-lens");

// 6. Native V2 player: flow diagram, bounded outline (1440), phone Contents drawer (390), feedback questions.
nativeLesson = true;
await go("/student/lesson/fixture-levers-g6?grade=6", "[data-lesson-player-v2]");
const outlineBounded = await page.evaluate(() => { const o = document.querySelector(".ll3-stage-outline > div"); return o ? o.getBoundingClientRect().height <= innerHeight : false; });
assert(outlineBounded, "native outline rail is bounded by the viewport");
const continueBtn = page.locator("footer").getByRole("button", { name: /^Continue/ });
while (await page.locator("[data-diagram-reveal]").count() === 0) { await continueBtn.click(); }
for (const label of ["Effort", "Fulcrum", "Load"]) await page.locator("button[aria-expanded]", { hasText: label }).click();
assert.equal(await page.locator(".ll4-diagram-steps > li[data-state=open]").count(), 3);
const flowRow = await page.evaluate(() => { const items = [...document.querySelectorAll(".ll4-diagram-steps > li")].map((li) => li.getBoundingClientRect().top); return new Set(items.map(Math.round)).size === 1; });
assert(flowRow, "wide stage shows the diagram as a left-to-right flow");
await page.screenshot({ path: `${out}/native-diagram-1440.png` });
await axe("native-diagram");
await viewport(390);
await page.locator(".ll4-stage-drawer .ll4-drawer-trigger").click();
await page.getByRole("dialog", { name: "Contents" }).getByRole("button", { name: /Lifting heavy things/ }).click();
await page.locator("[data-lesson-player-v2][data-scene-id]").waitFor();
assert.equal(await overflow(), false, "native/390 overflow");
evidence.native = { outlineBounded, diagram: "flow, 3 stages opened in order", drawer: "phone contents drawer navigates" };
nativeLesson = false;

// 7. Teaching demos (DEMO-labelled): Grade 7 digit cards + cross-subject blocks with zero API calls and storage.
apiCalls.length = 0;
for (const width of [390, 1440]) {
  await viewport(width);
  await go("/design-preview/lessons/grade-5-water-cycle?scene=cycle", "[data-scene-id=cycle]");
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  for (const stage of ["Condensation", "Precipitation", "Collection"]) { await page.locator(".ll4-cycle-node", { hasText: stage }).click(); await page.locator(".ll4-cycle-detail-title", { hasText: stage }).waitFor(); }
  await page.getByText("4 of 4 stages opened").waitFor();
  assert.equal(await overflow(), false, `cycle/${width} overflow`);
  assert.deepEqual(await smallTargets(TARGETS), [], `cycle/${width} small targets`);
  await axe(`science-cycle-${width}`);
  await go("/design-preview/lessons/grade-4-parts-of-speech?scene=sort", "[data-scene-id=sort]");
  await page.locator(".ll4-card-tray .ll4-word-card", { hasText: "tall" }).click();
  await page.getByRole("button", { name: "Put “tall” in Noun" }).click();
  await page.getByText(/“tall” is not a noun here/).waitFor();
  await page.getByRole("button", { name: /tall: not yet/ }).click();
  for (const [word, group] of [["farmer", "Noun"], ["plants", "Verb"], ["tall", "Adjective"], ["rice", "Noun"], ["green", "Adjective"], ["field", "Noun"]]) {
    await page.locator(".ll4-card-tray .ll4-word-card", { hasText: new RegExp(`^${word}$`) }).click();
    await page.getByRole("button", { name: `Put “${word}” in ${group}` }).click();
  }
  await page.getByText("All sorted.").waitFor();
  assert.equal(await page.locator("footer").getByRole("button", { name: /^Continue/ }).isDisabled(), false);
  assert.equal(await overflow(), false, `sort/${width} overflow`);
  await axe(`english-sort-${width}`);
  await go("/design-preview/lessons/grade-6-liberia-timeline?scene=order", "[data-scene-id=order]");
  await page.getByRole("button", { name: "Check the order" }).click();
  await page.getByText(/Not yet\./).waitFor();
  // Sort by year with Move up only (keyboard-operable buttons).
  for (let pass = 0; pass < 4; pass++) for (let i = 1; i < 4; i++) {
    const years = await page.locator(".ll4-order-marker").allInnerTexts();
    if (Number(years[i]) < Number(years[i - 1])) await page.locator(".ll4-order > li").nth(i).getByRole("button", { name: /Move .* up/ }).click();
  }
  await page.getByRole("button", { name: "Check the order" }).click();
  await page.locator(".ll4-timeline").waitFor();
  await page.locator(".ll4-timeline-dot", { hasText: "1847" }).click();
  await page.getByText("26 July 1847").waitFor();
  assert.equal(await overflow(), false, `timeline/${width} overflow`);
  await axe(`social-timeline-${width}`);
  await page.screenshot({ path: `${out}/timeline-${width}.png`, fullPage: true });
}
await viewport(1440);
await go("/design-preview/lessons", "h1");
assert.equal(await page.locator(".ll4-gallery-card").count(), 4);
await page.getByText("Content status inventory").waitFor();
await axe("preview-gallery");
// The harness itself keeps "fixture-grade" in sessionStorage on every load (main.tsx); anything else is the page's.
const storage = await page.evaluate(() => ({ local: Object.keys(localStorage), session: Object.keys(sessionStorage).filter((key) => key !== "fixture-grade") }));
assert.deepEqual(apiCalls, [], `demos made API requests: ${apiCalls}`);
assert.deepEqual([...storage.local, ...storage.session], [], `demos wrote browser storage: ${JSON.stringify(storage)}`);
evidence.demos = { apiCalls: 0, storage, covered: "science cycle (4 stages), English sort (wrong placement feedback + all sorted), Social Studies order + timeline, gallery inventory" };

await fs.writeFile(`${out}/results.json`, JSON.stringify({ evidence, errors, caveat: "Fixture harness with production lesson components and mocked API answers; not server authorization, production content, or real-device certification." }, null, 2));
assert.deepEqual(errors, []);
await browser.close(); await server.close();
console.log(`Student Experience V3 P1 passed: playlist at 390/768/1440/1920 (doc heights ${evidence.heights.map((h) => `${h.width}:${h.docHeight}`).join(", ")}), section 17 via deep link/rail/drawer, keyboard + Back/Forward/refresh, final-section assessment hand-off, slides notes/cards/number tool, native flow + drawer, 3 cross-subject demos with zero API calls, ${Object.keys(evidence.axe).length} axe scans with zero serious/critical.`);
