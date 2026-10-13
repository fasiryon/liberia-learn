import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
/**
 * Teacher Preview browser evidence: phone/tablet/desktop layout without horizontal overflow,
 * real keyboard navigation, learner-safe Student View and truthful lab state. Production
 * component over fixture-resolved display models; server authorization is covered by unit tests.
 */
const out = "artifacts/content-bundle-teacher-preview";
await fs.mkdir(out, { recursive: true });
const base = "http://127.0.0.1:3192";
const WIDTHS = [320, 390, 768, 1024, 1280, 1440, 1920];
const SHOTS = new Set([390, 768, 1440]);
const TEACHER_ONLY = ["Model the first sharing", "Facilitation note", "Unit answer key", "enforcement", "calculator", "Not allowed", "Teacher guide", "fixture.provenance", "fixture.assessment-item.", "Scoring guide"];
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ reducedMotion: "reduce" });
const page = await context.newPage();
page.setDefaultTimeout(60000); page.setDefaultNavigationTimeout(120000);
const errors = []; page.on("pageerror", (e) => errors.push(e.message)); page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
const overflow = () => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
const box = (sel) => page.locator(sel).first().boundingBox();
const evidence = { layout: [], keyboard: {}, student: {}, lab: {}, targets: {} };

// A. Layout at every review width, both modes.
for (const width of WIDTHS) {
  await page.setViewportSize({ width, height: width >= 1024 ? 900 : 844 });
  for (const view of ["teacher", "student"]) {
    await page.goto(`${base}/?view=${view}&item=fixture.assessment.g4-math.fractions.unit-assessment`);
    await page.locator("#cbp-item-heading").waitFor();
    assert.equal(await overflow(), false, `${view} overflows at ${width}`);
    const [nav, main, aside] = await Promise.all([box(".cbp-col-nav"), box(".cbp-col-main"), box(".cbp-col-aside")]);
    const layout = width >= 1024 ? "three-column" : width >= 768 ? "two-column" : "stacked";
    if (layout === "three-column") { assert(nav.x < main.x && main.x < aside.x, `columns out of order at ${width}`); assert(Math.abs(nav.y - main.y) < 2 && Math.abs(main.y - aside.y) < 2, `columns not side by side at ${width}`); }
    if (layout === "two-column") { assert(nav.x < main.x, `nav not left at ${width}`); assert(aside.y > main.y && Math.abs(aside.x - main.x) < 2, `aside not under main at ${width}`); }
    if (layout === "stacked") { assert(nav.y < main.y && main.y < aside.y, `not stacked at ${width}`); assert(Math.abs(nav.width - main.width) < 2, `stacked widths differ at ${width}`); }
    evidence.layout.push({ width, view, layout, overflow: false });
    if (SHOTS.has(width)) await page.screenshot({ path: `${out}/${view}-unit-assessment-${width}.png`, fullPage: true });
  }
}

// B. Keyboard: Tab into the sequence, Arrow to an item, Enter selects; Space toggles the mode.
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto(base); await page.locator("#cbp-item-heading").waitFor();
await page.keyboard.press("Tab");
assert.equal(await page.evaluate(() => document.activeElement?.className), "cbp-skip", "skip link is not first in tab order");
await page.keyboard.press("Tab");
assert.equal(await page.evaluate(() => document.activeElement?.textContent), "Teacher overview");
const outline = await page.evaluate(() => getComputedStyle(document.activeElement).outlineWidth);
assert.equal(outline, "3px", "focus ring not visible on keyboard focus");
await page.keyboard.press("Tab"); await page.keyboard.press("Tab");
assert.equal(await page.evaluate(() => document.activeElement?.textContent), "Bundle overview");
await page.keyboard.press("ArrowDown"); await page.keyboard.press("ArrowDown");
await page.keyboard.press("Enter");
assert.equal(await page.locator("#cbp-item-heading").textContent(), "Guided practice: share bottle caps into equal groups");
assert.equal(await page.locator("nav[aria-label='Bundle sequence'] [aria-current=true]").count(), 1);
await page.keyboard.press("End"); await page.keyboard.press("Enter");
assert.equal(await page.locator("#cbp-item-heading").textContent(), "Unit assessment: fractions");
await page.locator("button", { hasText: "Student view" }).focus();
await page.keyboard.press("Space");
assert.equal(await page.locator("button", { hasText: "Student view" }).getAttribute("aria-pressed"), "true");
assert.equal(await page.locator("#cbp-item-heading").textContent(), "Unit assessment: fractions", "selection lost when switching mode");
evidence.keyboard = { skipLinkFirst: true, focusOutline: outline, arrowEnterSelects: true, endSelectsLast: true, spaceTogglesMode: true };

// C. Student View never shows teacher-only material on any page.
await page.goto(`${base}/?view=student`); await page.locator("#cbp-item-heading").waitFor();
const studentButtons = page.locator("nav[aria-label='Student sequence'] button");
const count = await studentButtons.count();
for (let i = 0; i < count; i++) {
  await studentButtons.nth(i).click();
  const frame = await page.locator("[data-testid=student-preview]").innerText();
  for (const s of TEACHER_ONLY) assert(!frame.includes(s), `student page ${i} shows "${s}"`);
}
evidence.student = { pagesChecked: count, leaks: 0 };
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${base}/?view=student&item=fixture.activity.g4-math.fractions.guided-practice`); await page.locator("#cbp-item-heading").waitFor();
await page.screenshot({ path: `${out}/student-guided-practice-390.png`, fullPage: true });

// D. Lab non-runnable state, teacher and student.
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto(`${base}/?fixture=lab&item=fixture.member.lab.test`); await page.locator("[data-testid=lab-readiness]").waitFor();
const labText = await page.locator("[data-testid=lab-readiness]").innerText();
assert(labText.startsWith("Not runnable"), "lab shown as runnable");
await page.screenshot({ path: `${out}/teacher-lab-not-runnable-1440.png`, fullPage: true });
await page.locator("button", { hasText: "Student view" }).click();
const studentLab = await page.locator("[data-testid=student-lab-state]").innerText();
assert.equal(studentLab, "Students will see this lab as not available yet.");
evidence.lab = { teacher: labText.split("\n")[0], student: studentLab };

// E. Touch targets on phone: every control at least 44px tall.
await page.setViewportSize({ width: 320, height: 700 });
await page.goto(`${base}/?item=fixture.activity.g4-math.fractions.homework`); await page.locator("#cbp-item-heading").waitFor();
const small = await page.evaluate(() => [...document.querySelectorAll(".cbp-root button, .cbp-root summary")].filter((el) => el.getBoundingClientRect().height < 44).map((el) => el.textContent));
assert.deepEqual(small, [], `controls under 44px: ${small.join(", ")}`);
evidence.targets = { width: 320, under44px: 0 };

assert.deepEqual(errors, [], `page errors: ${errors.join("\n")}`);
await fs.writeFile(`${out}/results.json`, JSON.stringify({ generatedBy: "e2e/content-bundle-teacher-preview/validate.mjs", fixture: "fixture.bundle.g4-math-fractions@1.0.0-fixture (synthetic)", ...evidence }, null, 2));
await browser.close();
console.log(`teacher preview browser checks passed: ${evidence.layout.length} layouts, ${count} student pages`);
