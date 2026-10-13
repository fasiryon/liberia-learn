import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
/**
 * G4 fractions activity experiences, real browser evidence: four activity types in teacher and
 * student mode at phone (320, 390), tablet (768) and desktop (1024, 1440) widths. Checks no
 * horizontal overflow, the teacher fields, no teacher leakage in Student view, visible keyboard
 * focus, keyboard and touch operation, working controls (no dead controls), touch-sized targets and
 * the offline homework presentation. Production components over fixture-resolved display models.
 */
const out = "artifacts/g4-fractions-activity-experience";
await fs.mkdir(out, { recursive: true });
const base = "http://127.0.0.1:3193";
const ACTIVITIES = {
  guided: { id: "fixture.activity.g4-math.fractions.guided-practice", label: "Guided practice" },
  independent: { id: "fixture.activity.g4-math.fractions.independent-practice", label: "Independent practice" },
  classwork: { id: "fixture.activity.g4-math.fractions.classwork", label: "Classwork" },
  homework: { id: "fixture.activity.g4-math.fractions.homework", label: "Homework" },
};
const WIDTHS = [320, 390, 768, 1024, 1440];
const SHOTS = new Set([320, 768, 1440]);
const TEACHER_ONLY = [
  "Step through the worked example with the class", "Do not give the steps", "Listen to each pair explain question 4",
  "Read the self-check aloud before learners leave", "What to look and listen for", "If you see:", "Common mistakes",
  "Classwork facilitation guide", "Facilitation note", "Unit answer key", "Unreviewed candidate",
  "moe-math-g4-s1-p3-number-theory-and-fraction-obj4", "ll-g4-math-fractions-equal-parts-2026.2", "Next-day review", "Scoring guide",
];
const TEACHER_FIELDS = ["Activity type", "Objective", "Duration", "Collaboration", "Evidence intent", "Lesson flow", "Student instructions", "Teacher instructions (teacher only)", "Materials and resources"];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ reducedMotion: "reduce" });
const page = await context.newPage();
page.setDefaultTimeout(60000); page.setDefaultNavigationTimeout(120000);
const errors = []; page.on("pageerror", (e) => errors.push(e.message)); page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
const requests = []; page.on("request", (r) => { if (!r.url().startsWith(base) && !r.url().startsWith("data:")) requests.push(r.url()); });
const overflow = () => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
const open = async (view, key) => { await page.goto(`${base}/?view=${view}&item=${ACTIVITIES[key].id}`); await page.locator("#cbp-item-heading").waitFor(); };
const evidence = { layout: [], teacher: {}, student: {}, keyboard: {}, deadControls: {}, targets: [], homework: {}, network: {} };

// A. Layout and content: every activity, both modes, every width.
for (const width of WIDTHS) {
  await page.setViewportSize({ width, height: width >= 1024 ? 900 : 844 });
  for (const [key, a] of Object.entries(ACTIVITIES)) {
    for (const view of ["teacher", "student"]) {
      await open(view, key);
      assert.equal(await overflow(), false, `${view} ${key} overflows at ${width}`);
      const wideChildren = await page.evaluate(() => [...document.querySelectorAll(".cbx-root *, .cbx-teacher *")].filter((el) => el.getBoundingClientRect().right > window.innerWidth + 0.5).map((el) => el.className).slice(0, 5));
      assert.deepEqual(wideChildren, [], `${view} ${key} content clipped at ${width}`);
      if (view === "teacher") {
        const guide = await page.locator("[data-testid=teacher-activity-guide]").innerText();
        for (const field of TEACHER_FIELDS) assert(guide.includes(field), `${key} teacher view missing ${field}`);
        assert(guide.includes(a.label), `${key} teacher view missing type ${a.label}`);
        evidence.teacher[key] = { fields: TEACHER_FIELDS.length, type: a.label };
      } else {
        const frame = await page.locator("[data-testid=student-preview]").innerText();
        for (const s of TEACHER_ONLY) assert(!frame.includes(s), `student ${key} shows teacher-only "${s}" at ${width}`);
        assert.equal(await page.locator("[data-testid=student-preview] [data-testid=teacher-activity-guide]").count(), 0);
        assert.equal(await page.locator(`[data-testid=learner-experience][data-profile]`).count(), 1);
        evidence.student[key] = { teacherLeaks: 0, profile: await page.locator("[data-testid=learner-experience]").getAttribute("data-profile") };
      }
      evidence.layout.push({ width, key, view, overflow: false });
      if (SHOTS.has(width)) await page.screenshot({ path: `${out}/${view}-${key}-${width}.png`, fullPage: true });
    }
  }
}

// B. Touch targets at 320px: every learner control at least 44px tall and 24px wide.
await page.setViewportSize({ width: 320, height: 700 });
for (const key of Object.keys(ACTIVITIES)) {
  await open("student", key);
  const small = await page.evaluate(() => [...document.querySelectorAll("[data-testid=learner-experience] :is(button, summary, label.cbx-check)")].map((el) => ({ t: el.getAttribute("aria-label") ?? el.textContent, r: el.getBoundingClientRect() })).filter(({ r }) => r.height < 44 || r.width < 24).map(({ t, r }) => `${t} ${Math.round(r.width)}x${Math.round(r.height)}`));
  assert.deepEqual(small, [], `${key}: controls under target size: ${small.join(", ")}`);
  const minWidth = await page.evaluate(() => { const w = [...document.querySelectorAll("[data-testid=learner-experience] button")].map((b) => b.getBoundingClientRect().width); return w.length ? Math.min(...w) : null; });
  evidence.targets.push({ key, width: 320, undersized: 0, narrowestButtonPx: minWidth === null ? "no buttons (paper-based)" : Math.round(minWidth) });
}

// C. Keyboard: visible focus, Space/Enter operate toggles, Check announces feedback.
await page.setViewportSize({ width: 1440, height: 900 });
await open("student", "guided");
const firstCap = page.locator("[data-testid=practice-item]").first().locator("[role=group] button").first();
await firstCap.focus();
await page.keyboard.press("Tab"); await page.keyboard.press("Shift+Tab");
const focusStyle = await page.evaluate(() => { const s = getComputedStyle(document.activeElement); return { outline: s.outlineWidth, style: s.outlineStyle, label: document.activeElement.getAttribute("aria-label") }; });
assert.equal(focusStyle.outline, "3px", "cap button focus ring not visible");
assert.equal(focusStyle.style, "solid");
await page.keyboard.press("Space");
assert.equal(await firstCap.getAttribute("aria-pressed"), "true", "Space did not toggle cap");
await page.keyboard.press("Tab");
await page.keyboard.press("Enter");
const secondCap = page.locator("[data-testid=practice-item]").first().locator("[role=group] button").nth(1);
assert.equal(await secondCap.getAttribute("aria-pressed"), "true", "Enter did not toggle cap");
await page.locator("[data-testid=practice-item]").first().getByRole("button", { name: "Check", exact: true }).focus();
const checkFocus = await page.evaluate(() => getComputedStyle(document.activeElement).outlineWidth);
assert.equal(checkFocus, "3px", "Check button focus ring not visible");
await page.keyboard.press("Enter");
const kbFeedback = await page.locator("[data-testid=practice-item]").first().locator("[data-testid=item-feedback]").innerText();
assert(kbFeedback.includes("Yes."), `keyboard check did not give match feedback: ${kbFeedback}`);
await page.locator("[data-testid=practice-item]").first().getByRole("button", { name: /Show hint 1 of 3/ }).click();
await page.screenshot({ path: `${out}/student-guided-keyboard-feedback-1440.png`, fullPage: false, clip: await page.locator("[data-testid=practice-item]").first().boundingBox() });
// Strip part focus inside the clipped strip remains visible (inset outline).
await open("student", "independent");
await page.locator("[data-testid=practice-item][data-task=SHADE_STRIP] [role=group] button").first().focus();
await page.keyboard.press("Tab"); await page.keyboard.press("Shift+Tab");
const stripFocus = await page.evaluate(() => { const s = getComputedStyle(document.activeElement); return { w: s.outlineWidth, offset: s.outlineOffset }; });
assert.equal(stripFocus.w, "3px");
evidence.keyboard = { focusOutline: focusStyle.outline, checkFocusOutline: checkFocus, stripPartFocus: stripFocus, spaceToggles: true, enterToggles: true, enterChecks: true, feedback: kbFeedback };

// D. No dead controls: every learner control does something observable.
async function auditItems(key) {
  await open("student", key);
  const results = [];
  const items = page.locator("[data-testid=practice-item]");
  for (let i = 0; i < await items.count(); i++) {
    const item = items.nth(i);
    const task = await item.getAttribute("data-task");
    const feedback = item.locator("[data-testid=item-feedback]");
    await item.getByRole("button", { name: "Check", exact: true }).click();
    assert((await feedback.innerText()).length > 0, `${key} item ${i} Check is dead`);
    const before = await item.innerHTML();
    if (task === "MARK_SET" || task === "SHADE_STRIP") await item.locator("[role=group] button").first().click();
    if (task === "NAME_FRACTION") await item.getByRole("button", { name: "Top number: one more" }).click();
    if (task === "EQUAL_PARTS") await item.locator(".cbx-choice").first().click();
    assert.notEqual(await item.innerHTML(), before, `${key} item ${i} ${task} input is dead`);
    if (task === "NAME_FRACTION") {
      await item.getByRole("button", { name: "Bottom number: one more" }).click();
      await item.getByRole("button", { name: "Top number: one less" }).click();
      assert.equal(await item.locator("output").first().innerText(), "0", `${key} item ${i} minus is dead`);
    }
    await item.getByRole("button", { name: "Check", exact: true }).click();
    const after = await feedback.innerText();
    assert(/^(✓|↻|•)/.test(after), `${key} item ${i} feedback missing after input`);
    await item.getByRole("button", { name: "Start again", exact: true }).click();
    assert.equal(await feedback.innerText(), "", `${key} item ${i} Start again is dead`);
    const hint = item.getByRole("button", { name: /hint/i });
    if (await hint.count()) {
      const n = await item.locator(".cbx-hints li").count();
      await hint.click();
      assert.equal(await item.locator(".cbx-hints li").count(), n + 1, `${key} item ${i} hint is dead`);
    }
    results.push(task);
  }
  return results;
}
evidence.deadControls.guided = await auditItems("guided");
const example = page.locator("[data-testid=worked-example]");
for (let s = 2; s <= 4; s++) { await example.getByRole("button", { name: "Next step" }).click(); assert((await example.innerText()).includes(`Step ${s} of 4`), "Next step is dead"); }
await example.getByRole("button", { name: "Back" }).click(); assert((await example.innerText()).includes("Step 3 of 4"), "Back is dead");
await example.getByRole("button", { name: "Next step" }).click();
await example.getByRole("button", { name: "Watch again" }).click(); assert((await example.innerText()).includes("Step 1 of 4"), "Watch again is dead");
evidence.deadControls.workedExample = ["Next step", "Back", "Watch again"];
evidence.deadControls.independent = await auditItems("independent");
await page.setViewportSize({ width: 390, height: 844 });
await open("student", "independent");
const ip2 = page.locator("[data-testid=practice-item]").nth(1);
for (const n of [0, 1, 2, 3]) await ip2.locator("[role=group] button").nth(n).click();
await ip2.getByRole("button", { name: "Check", exact: true }).click();
await ip2.scrollIntoViewIfNeeded();
await page.screenshot({ path: `${out}/student-independent-feedback-390.png`, fullPage: false, clip: await ip2.boundingBox() });
for (const key of ["classwork", "homework"]) {
  await open("student", key);
  const boxes = page.locator("[data-testid=learner-experience] input[type=checkbox]");
  for (let i = 0; i < await boxes.count(); i++) { await boxes.nth(i).click(); assert.equal(await boxes.nth(i).isChecked(), true, `${key} self-check ${i} is dead`); }
  const details = page.locator("[data-testid=learner-experience] details");
  for (let i = 0; i < await details.count(); i++) { await details.nth(i).locator("summary").click(); assert.equal(await details.nth(i).getAttribute("open"), "", `${key} hint ${i} is dead`); }
  evidence.deadControls[key] = { selfChecks: await boxes.count(), hintDetails: await details.count() };
}

// E. Offline-safe homework: works with JavaScript disabled and with the network cut.
const noJs = await browser.newContext({ javaScriptEnabled: false });
const staticPage = await noJs.newPage();
await staticPage.setContent(await page.evaluate(() => document.documentElement.outerHTML));
const staticText = await staticPage.locator("[data-testid=learner-experience]").innerText();
assert(staticText.includes("Draw a rectangle. Divide it into 4 equal parts."), "homework not readable as static HTML");
await noJs.close();
await context.setOffline(true);
await page.locator("[data-testid=learner-experience] details").first().locator("summary").click();
await page.locator("button", { hasText: "Teacher overview" }).click();
await page.locator("button", { hasText: "Student view" }).click();
assert.equal(await page.locator("[data-testid=learner-experience][data-profile=HOMEWORK]").count(), 1, "homework did not survive offline");
await context.setOffline(false);
evidence.homework = { paperItems: await page.locator("[data-testid=paper-item]").count(), interactiveItems: await page.locator("[data-testid=practice-item]").count(), staticHtmlReadable: true, survivesOffline: true, offlineBadge: await page.locator("[data-testid=offline-badge]").innerText() };
assert.equal(evidence.homework.interactiveItems, 0);
await page.emulateMedia({ media: "print" });
await page.screenshot({ path: `${out}/student-homework-print-390.png`, fullPage: true });
await page.emulateMedia({ media: "screen" });

// F. Close-up phone captures for review (element screenshots at 320px).
await page.setViewportSize({ width: 320, height: 800 });
for (const key of Object.keys(ACTIVITIES)) {
  await open("student", key);
  await page.locator("[data-testid=learner-experience] .cbx-hero").screenshot({ path: `${out}/closeup-student-${key}-hero-320.png` });
  const first = page.locator("[data-testid=worked-example], [data-testid=practice-item], [data-testid=paper-item]").first();
  await first.screenshot({ path: `${out}/closeup-student-${key}-first-320.png` });
  await open("teacher", key);
  await page.locator("[data-testid=teacher-activity-guide]").screenshot({ path: `${out}/closeup-teacher-${key}-guide-320.png` });
}

assert.deepEqual(errors, [], `page errors: ${errors.join("\n")}`);
evidence.network = { externalRequests: requests.length };
assert.deepEqual(requests, [], `unexpected external requests: ${requests.join(", ")}`);
await fs.writeFile(`${out}/results.json`, JSON.stringify({
  generatedBy: "e2e/g4-fractions-activities/validate.mjs",
  integration: "fixture resolver -> seal -> learner projection -> buildPreviewModels -> production Teacher Preview components (Vite harness)",
  fixture: "fixture.bundle.g4-math-fractions-activities@1.0.0-fixture (synthetic governed candidate; not curriculum, not reviewed, not released)",
  authenticatedNextMiddleware: "Not exercised: localhost Vite harness; route authorization is unit-tested",
  widths: WIDTHS,
  ...evidence,
}, null, 2));
await browser.close();
console.log(`g4 fractions activity browser checks passed: ${evidence.layout.length} layouts, 4 activities x 2 modes`);
