import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
/** Shell polish + Learn V2 fixtures. Production components, mocked authorized APIs; no server auth or real-device certification. */
const out = "artifacts/product-design-v2/learn";
await fs.mkdir(out, { recursive: true });
const base = "http://127.0.0.1:3191";
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ reducedMotion: "reduce" });
const LONG = "Understanding equivalent fractions with number lines, fraction strips and real market examples from Monrovia";
let mode = "ready";
const governed = (label = "Equivalent fractions") => ({ available: true, decisionId: "fixture-decision", sessionId: "fixture-session", releaseId: "fixture-release", releaseIdentity: "fixture-identity", learnerStateRevision: "1", grade: 4, subject: "MATH", conceptLabel: label, action: { kind: "PRACTICE", reason: "Practice the learning question selected by the server." }, item: { id: "fixture-item", version: "1", prompt: "Which fraction is equal to 1/2?", options: ["2/4", "1/3", "3/5"] }, toolPolicy: { allowed: [], prohibited: [] }, lessonHref: "/student/lesson/fixture-lesson" });
const open = (href) => ({ state: "open", locked: false, href });
const lessonRow = (id, title, subject = "MATH") => ({ ...open(`/student/lesson/${id}`), availability: "current", contentId: id, title, subject, grade: 4 });
/** learn-discovery/2 as returned by GET /api/student/learn (lib/student/learnDiscovery.server.ts). */
function discovery(long) {
  const empty = mode === "empty", notEnrolled = mode === "not-enrolled", lessonsDown = mode === "lessons-unavailable";
  return {
    schemaVersion: "learn-discovery/2", availability: empty || notEnrolled ? "empty" : "current", freshness: "current", generatedAt: new Date().toISOString(),
    currentLearning: { availability: "separate", endpoint: "/api/student/learning-authority/next-action" },
    subjects: notEnrolled ? [] : [{ subject: "MATH", label: "MATH" }, { subject: "ENGLISH", label: "ENGLISH" }],
    subjectCompletion: notEnrolled ? [] : [{ subject: "MATH", total: 10, completed: 3, completionRate: 30 }, { subject: "ENGLISH", total: 8, completed: 1, completionRate: 13 }],
    lessons: lessonsDown ? { availability: "unavailable", total: 0, items: [] } : empty || notEnrolled ? { availability: "empty", total: 0, items: [] } : { availability: "current", total: 24, items: [lessonRow("c-1", long ? LONG : "Comparing fractions"), lessonRow("c-2", "Main idea and details", "ENGLISH")] },
    activeUnits: notEnrolled ? { availability: "empty", eligibility: "not_enrolled", items: [] } : empty ? { availability: "empty", eligibility: "eligible", items: [] }
      : { availability: "current", eligibility: "eligible", items: [{ ...open("/student/units/u-1"), unitId: "u-1", title: long ? LONG : "Fractions on a number line", subject: "MATH", grade: 4, lessons: [] }, { ...open("/student/units/u-2"), unitId: "u-2", title: "Reading for meaning", subject: "ENGLISH", grade: 4, lessons: [] }] },
    assignedWork: empty || notEnrolled ? { availability: "empty", items: [] } : { availability: "current", items: [
      { ...open("/student/assignments"), assignmentHref: "/student/assignments", id: "a-1", title: long ? LONG : "Fractions worksheet", subject: "MATH", dueAt: "2026-10-08T09:00:00Z", content: null },
      { state: "unavailable", locked: true, href: null, lessonHref: null, reason: "This activity is not available", assignmentHref: "/student/assignments", id: "a-2", title: "Story summary", subject: "ENGLISH", dueAt: "2026-10-12T09:00:00Z", content: null }] },
    checks: empty || notEnrolled ? { availability: "empty", total: 0, items: [] } : { availability: "current", total: 2, items: [
      { ...open("/student/exams/e-1"), id: "e-1", title: "Fractions check", subject: "MATH", status: "PUBLISHED" },
      { state: "unavailable", locked: true, href: null, reason: "This check is already completed", id: "e-2", title: "Place value check", subject: "MATH", status: "PUBLISHED" }] },
    resources: { availability: empty || notEnrolled ? "empty" : "current", items: empty || notEnrolled ? [] : [{ ...lessonRow("r-1", "Grade 4 reader"), id: "r-1", kind: "reading" }], destinations: [{ title: "Textbooks", href: "/student/textbooks" }], compiledBooks: "deferred" },
    search: { availability: "deferred" }, limits: { perSection: 100, linkedContent: 200, catalogBoundReached: false },
  };
}
const catalog = () => ({ availability: "current", grade: 4, count: 2, total: 2, page: 1, totalPages: 1, subjectCompletion: [], items: [
  { ...lessonRow("c-1", "Comparing fractions"), displayTitle: "Comparing fractions" }, { ...lessonRow("c-2", "Main idea and details", "ENGLISH"), displayTitle: "Main idea and details" }] });
const unitDetail = { unitId: "u-1", unitName: "Fractions on a number line", subject: "MATH", grade: 4, completedCount: 1, totalCount: 3, completionPct: 33, lessons: [
  { contentId: "l1", title: "What is a fraction?", orderInUnit: 1, lessonType: "lesson", status: "completed", scheduledWorkId: null, locked: false, href: "/student/lesson/l1" },
  { contentId: "l2", title: "Fractions on a number line", orderInUnit: 2, lessonType: "lesson", status: "current", scheduledWorkId: null, locked: false, href: "/student/lesson/l2" },
  { contentId: "l3", title: "Comparing fractions", orderInUnit: 3, lessonType: "check", status: "upcoming", scheduledWorkId: null, locked: true, href: "/student/lesson/l3" }] };
await context.route("**/api/**", async (route) => {
  const url = route.request().url();
  const long = mode === "long";
  if (mode === "loading") await new Promise((resolve) => setTimeout(resolve, 1500));
  const discoveryUrl = ["/api/student/learn", "/api/student/lessons", "/api/student/units/active"].includes(new URL(url).pathname);
  if (mode === "error" && (discoveryUrl || url.includes("next-action"))) return route.fulfill({ status: 503, json: { error: "unavailable" } });
  if (mode === "offline" && (discoveryUrl || url.includes("next-action"))) return route.abort("internetdisconnected");
  if ((mode === "signed-out" || mode === "cross-tenant") && (discoveryUrl || url.includes("next-action"))) return route.fulfill({ status: mode === "signed-out" ? 401 : 403, json: { error: mode === "signed-out" ? "Unauthorized" : "Forbidden" } });
  if (url.includes("next-action")) {
    if (route.request().method() === "POST") return route.fulfill({ json: { correct: true, learnerState: { mastery: { level: "DEVELOPING", observedScore: 1 }, confidence: { level: "LOW" } } } });
    return route.fulfill({ json: mode === "none" ? { available: false } : mode === "no-resource" ? { available: false, status: "NO_VALID_RESOURCE" } : governed(long ? LONG : undefined) });
  }
  if (new URL(url).pathname === "/api/student/learn") return route.fulfill({ json: discovery(long) });
  if (url.includes("/units/u-1")) return route.fulfill({ json: unitDetail });
  if (url.includes("/units/")) return route.fulfill({ status: 404, json: { error: "unit_not_found" } });
  if (url.includes("/api/student/lessons")) return route.fulfill({ json: mode === "lessons-empty" ? { ...catalog(), items: [], count: 0, total: 0, totalPages: 0 } : catalog() });
  if (url.includes("/assignments")) return route.fulfill({ json: { assignments: [{ id: "a-1", title: "Fractions worksheet", subject: "MATH", dueAt: "2026-10-08T09:00:00Z", isOverdue: true, submission: null }] } });
  if (url.includes("/today")) return route.fulfill({ json: { availability: "current", items: [], catchUpItems: [], completedCount: 2, remainingCount: 0 } });
  if (url.includes("teacher-lessons")) return route.fulfill({ json: { lessons: [] } });
  if (url.includes("inbox")) return route.fulfill({ json: { items: [], unreadCount: 0 } });
  if (url.includes("announcements")) return route.fulfill({ json: { announcements: [] } });
  return route.fulfill({ json: { sessions: [] } });
});
const page = await context.newPage();
page.setDefaultNavigationTimeout(120000); page.setDefaultTimeout(60000);
const errors = []; page.on("pageerror", (error) => errors.push(error.message));
const evidence = { shell: [], learn: [], states: [], a11y: {} };
const overflow = () => page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
const OLD_LAYOUT = ".pdv2-shell :where(.pdv2-today,.pdv2-secondary){max-width:1280px!important;margin-left:auto!important;margin-right:auto!important;padding-left:32px!important;padding-right:32px!important}";
async function gutter() {
  return page.evaluate(() => {
    const rail = document.querySelector(".pdv2-rail").getBoundingClientRect();
    const main = document.querySelector("main.pdv2-today");
    const box = main.getBoundingClientRect(); const style = getComputedStyle(main);
    const contentLeft = box.left + parseFloat(style.paddingLeft); const contentRight = box.right - parseFloat(style.paddingRight);
    return { railRight: Math.round(rail.right), contentLeft: Math.round(contentLeft), gap: Math.round(contentLeft - rail.right), rightSpace: Math.round(innerWidth - contentRight), contentWidth: Math.round(contentRight - contentLeft) };
  });
}

// A. Wide-screen shell: content starts beside the rail; measured before (old CSS re-applied) and after.
for (const route of ["/student/today", "/student/learn"]) for (const width of [1280, 1440, 1600, 1920]) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`${base}${route}?grade=6`);
  await page.locator("main.pdv2-today h1").waitFor();
  const after = await gutter();
  assert.equal(await overflow(), false, `${route}/${width} overflows`);
  assert(after.gap >= 24 && after.gap <= 40, `${route}/${width} gutter ${after.gap}`);
  assert(after.rightSpace >= 24, `${route}/${width} right space ${after.rightSpace}`);
  const style = await page.addStyleTag({ content: OLD_LAYOUT });
  const before = await gutter();
  await style.evaluate((node) => node.remove());
  // B. Visible desktop sign out in the rail utility area, through the safe-logout page.
  const signOut = page.locator(".pdv2-rail-support").getByRole("link", { name: "Sign out", exact: true });
  assert(await signOut.isVisible(), `${route}/${width} sign out hidden`);
  assert.equal(await signOut.getAttribute("href"), "/signout");
  const box = await signOut.boundingBox(); assert(box.y + box.height <= 900, `${route}/${width} sign out below the viewport`);
  assert.equal(await page.locator("nav[aria-label=Student] a").count(), 5);
  assert.equal(await page.locator("nav[aria-label=Student]").getByText("Sign out").count(), 0);
  if (width === 1440 || width === 1920) await page.screenshot({ path: `${out}/shell-${route.split("/").pop()}-${width}.png` });
  evidence.shell.push({ route, width, before, after });
}
// Account and preferences remain; mobile account menu exposes sign out without crowding the nav.
assert(await page.getByText("Account and preferences", { exact: true }).isVisible());
for (const width of [390, 360, 320]) {
  await page.setViewportSize({ width, height: 844 });
  await page.goto(`${base}/student/learn?grade=6`);
  await page.locator("main.pdv2-today h1").waitFor();
  assert.equal(await page.locator(".pdv2-rail-support").isVisible(), false);
  const menu = page.locator(".pdv2-account-menu summary");
  assert(await menu.isVisible(), `${width} account menu hidden`);
  const target = await menu.boundingBox(); assert(target.height >= 44);
  await menu.click();
  const signOut = page.locator(".pdv2-account-menu").getByRole("link", { name: "Sign out", exact: true });
  assert(await signOut.isVisible()); assert.equal(await signOut.getAttribute("href"), "/signout");
  assert.equal(await overflow(), false, `${width} overflows with menu open`);
  if (width === 390) await page.screenshot({ path: `${out}/shell-account-menu-390.png` });
  await page.keyboard.press("Escape"); await menu.click();
  const nav = page.locator("nav[aria-label=Student] a"); assert.equal(await nav.count(), 5);
  for (let i = 0; i < 5; i++) { const b = await nav.nth(i).boundingBox(); assert(b.height >= 48 && b.width >= 44, `${width} nav item ${i} too small`); }
}
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto(`${base}/student/learn?grade=6`);
await page.locator(".pdv2-rail-support").getByRole("link", { name: "Sign out" }).click();
assert.equal(new URL(page.url()).pathname, "/signout");

// Both age bands at every required width, with the platform font and with a wide fallback font
// (Verdana where installed) that reproduces Linux CI metrics; offending elements are named on failure.
const WIDE_FONT = "*{font-family:Verdana,'DejaVu Sans',sans-serif !important}";
evidence.bands = [];
for (const route of ["/student/today", "/student/learn"]) for (const grade of [2, 6]) for (const width of [320, 360, 390, 768, 1440, 1920]) for (const wide of [false, true]) {
  await page.setViewportSize({ width, height: width >= 1440 ? 900 : 844 });
  await page.goto(`${base}${route}?grade=${grade}`);
  await page.locator(route === "/student/today" ? ".pdv2-hero .pdv2-action-primary" : ".pdv2-learn-option").first().waitFor();
  if (wide) await page.addStyleTag({ content: WIDE_FONT });
  const offenders = await page.evaluate(() => [...document.querySelectorAll("body *")].filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.right > document.documentElement.clientWidth + 0.5; }).map((el) => el.tagName.toLowerCase() + "." + String(el.className).trim().split(/\s+/).join(".")).slice(0, 6));
  assert.equal(await overflow(), false, `${route} ${grade}/${width}${wide ? " wide font" : ""} overflows: ${offenders.join(", ")}`);
  const nav = page.locator("nav[aria-label=Student] a"); assert.equal(await nav.count(), 5);
  const primary = await page.locator(route === "/student/today" ? ".pdv2-hero .pdv2-action-primary" : ".pdv2-learn-option").first().boundingBox();
  assert(primary.height >= (grade === 2 ? 56 : 48), `${route} ${grade}/${width} target ${primary.height}`);
  if (width < 768) { const menu = await page.locator(".pdv2-account-menu summary").boundingBox(); assert(menu && menu.height >= 44 && menu.x + menu.width <= width, `${route} ${grade}/${width} account menu`); }
  else assert(await page.locator(".pdv2-rail-support").getByRole("link", { name: "Sign out", exact: true }).isVisible());
  if (route === "/student/today" && width <= 390) {
    const due = await page.getByRole("link", { name: /^Open due work:/ }).boundingBox(); const navBox = await page.locator(".pdv2-nav").boundingBox();
    assert(due.y + due.height <= navBox.y, `today ${grade}/${width}${wide ? " wide font" : ""}: critical due CTA below the first viewport`);
  }
  if (wide && width === 320) await page.screenshot({ path: `${out}/wide-font-${route.split("/").pop()}-g${grade}-320.png`, fullPage: true });
  evidence.bands.push({ route, grade, width, wideFont: wide, overflow: false, primaryTarget: Math.round(primary.height) });
}

// D. Learn composition across bands and widths.
for (const grade of [2, 6]) for (const width of [320, 360, 390, 768, 1440]) {
  await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
  await page.goto(`${base}/student/learn?grade=${grade}`);
  await page.locator(".pdv2-learn-option").first().waitFor();
  await page.locator("a[aria-label='Open unit: Fractions on a number line']").waitFor();
  assert.equal(await overflow(), false, `learn ${grade}/${width} overflows`);
  const min = grade === 2 ? 56 : 48;
  const options = page.locator(".pdv2-learn-option");
  for (let i = 0; i < await options.count(); i++) assert((await options.nth(i).boundingBox()).height >= min, `option ${i} below ${min}px at ${grade}/${width}`);
  const submit = await page.getByRole("button", { name: grade === 2 ? "Check answer" : "Submit answer" }).boundingBox();
  assert(submit.height >= min);
  const heading = await page.locator("#current-learning-heading").boundingBox();
  const order = await page.evaluate(() => [...document.querySelectorAll("main h2")].map((h) => h.textContent));
  assert.equal(order.indexOf("Your learning path"), 1, `governed task not first at ${grade}/${width}`);
  const nav = await page.locator(".pdv2-nav").boundingBox();
  if (width < 768) assert(heading.y + heading.height < nav.y, `${grade}/${width} task heading not in first viewport`);
  await page.screenshot({ path: `${out}/learn-g${grade}-${width}.png`, fullPage: true });
  if (width === 390 || width === 1440) await page.screenshot({ path: `${out}/learn-viewport-g${grade}-${width}.png` });
  evidence.learn.push({ grade, width, submitTarget: submit, taskHeadingTop: heading.y });
}
await page.setViewportSize({ width: 1920, height: 1000 });
await page.goto(`${base}/student/learn?grade=6`); await page.locator(".pdv2-learn-option").first().waitFor();
await page.screenshot({ path: `${out}/learn-viewport-g6-1920.png` });
// Integrated discovery: server rows, checks summary, server locks/reasons, server total.
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto(`${base}/student/learn?grade=6`); await page.locator("a[aria-label='Open check: Fractions check']").waitFor();
assert.equal(await page.locator("a[aria-label='Open check: Fractions check']").getAttribute("href"), "/student/exams/e-1");
await page.getByText("This check is already completed").waitFor(); await page.getByText("This activity is not available").waitFor();
assert.equal(await page.locator("a[aria-label='Open check: Place value check']").count(), 0);
assert.equal(await page.locator("a[aria-label='Open assignment: Story summary']").count(), 0);
await page.getByText("24 lessons available to you.").waitFor();
assert.equal(await page.locator("main a[href='/student/textbooks']").count(), 1);
assert.equal(await page.locator("input[type=search], [role=search]").count(), 0);
evidence.integrated = { checksSummary: true, serverLocks: true, serverTotal: 24, searchDeferred: true };
// Direct activation: answer the governed task in place, no chooser or second Start.
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${base}/student/today?grade=6`);
await page.locator(".pdv2-hero .pdv2-action-primary").click();
await page.getByText("Which fraction is equal to 1/2?").waitFor();
await page.getByLabel("2/4").check();
await page.getByRole("button", { name: "Submit answer" }).click();
await page.getByText("✓ Correct. Well done.").waitFor();
assert.equal(new URL(page.url()).pathname, "/student/learn");
// Keyboard: skip link lands in content; the task's first control is reached before discovery; focus is visible.
await page.goto(`${base}/student/learn?grade=6`); await page.locator(".pdv2-learn-option").first().waitFor();
await page.keyboard.press("Tab"); assert.equal(await page.evaluate(() => document.activeElement?.textContent), "Skip to learning");
await page.keyboard.press("Enter");
const sequence = [];
for (let i = 0; i < 6; i++) { await page.keyboard.press("Tab"); sequence.push(await page.evaluate(() => { const el = document.activeElement; return { text: el?.getAttribute("aria-label") ?? el?.textContent?.trim() ?? el?.tagName, inTask: !!el?.closest(".pdv2-learn-current"), outline: getComputedStyle(el).outlineStyle }; })); }
assert(sequence.slice(0, 4).some((step) => step.inTask), `task not reached early by keyboard: ${JSON.stringify(sequence)}`);
assert(sequence.every((step) => step.outline !== "none"), "focus not visible");
evidence.a11y.keyboard = sequence;
// Reduced motion and forced colors.
evidence.a11y.reducedMotionTransition = await page.locator(".pdv2-action").first().evaluate((el) => getComputedStyle(el).transitionDuration);
assert.equal(evidence.a11y.reducedMotionTransition, "0s", `motion not reduced: ${evidence.a11y.reducedMotionTransition}`);
await page.emulateMedia({ forcedColors: "active" });
await page.goto(`${base}/student/learn?grade=6`); await page.locator(".pdv2-learn-option").first().waitFor();
assert(parseFloat(await page.locator(".pdv2-learn-option").first().evaluate((el) => getComputedStyle(el).borderTopWidth)) >= 2);
await page.screenshot({ path: `${out}/learn-forced-colors-390.png`, fullPage: true });
await page.emulateMedia({ forcedColors: "none" });
// 200% zoom of a 1280px desktop (640 CSS px) and 400% (320 CSS px) reflow.
for (const width of [640, 320]) { await page.setViewportSize({ width, height: 800 }); await page.goto(`${base}/student/learn?grade=6`); await page.locator(".pdv2-learn-option").first().waitFor(); assert.equal(await overflow(), false, `zoom ${width} overflows`); }
await page.setViewportSize({ width: 640, height: 800 }); await page.screenshot({ path: `${out}/learn-zoom200-1280.png`, fullPage: true });

// States, captured at 390.
await page.setViewportSize({ width: 390, height: 844 });
const states = {
  loading: async () => page.getByText("Loading your learning activity…").waitFor(),
  none: async () => page.getByText("No activity is ready right now").waitFor(),
  "no-resource": async () => page.getByText("Ask your teacher for your next step", { exact: false }).waitFor(),
  empty: async () => { await page.getByText("No units are scheduled for your class this week.").waitFor(); await page.getByText("No assignments right now.").waitFor(); await page.getByText("No lessons are published for your grade and classes yet.", { exact: false }).waitFor(); },
  "not-enrolled": async () => { await page.getByText("You are not enrolled in a class yet", { exact: false }).waitFor(); assert.equal(await page.getByText("No units are scheduled").count(), 0); },
  "lessons-unavailable": async () => { await page.getByText("Your lessons could not load. This does not mean you have none.").waitFor(); assert.equal(await page.getByText("No lessons are published", { exact: false }).count(), 0); },
  error: async () => { await page.getByText("Your units could not load. This does not mean you have none.").waitFor(); assert.equal(await page.getByText("No assignments right now.").count(), 0); },
  "signed-out": async () => { await page.getByRole("link", { name: "Sign in →" }).waitFor(); await page.locator("[aria-labelledby=path-heading]").getByText("Signed out").first().waitFor(); assert.equal(await page.locator("a[aria-label^='Open lesson']").count(), 0); },
  "cross-tenant": async () => { await page.getByText("This activity isn't available for your account.").waitFor(); await page.locator("[aria-labelledby=assigned-heading]").getByText("Restricted").first().waitFor(); assert.equal(await page.locator("a[aria-label^='Open assignment']").count(), 0); },
  long: async () => { await page.getByRole("heading", { name: LONG }).waitFor(); assert.equal(await overflow(), false); },
};
for (const [state, check] of Object.entries(states)) {
  mode = state; await page.goto(`${base}/student/learn?grade=6`); await check();
  if (state === "long") for (const width of [320, 1440]) { await page.setViewportSize({ width, height: 844 }); assert.equal(await overflow(), false, `long ${width}`); await page.screenshot({ path: `${out}/state-long-${width}.png`, fullPage: true }); }
  else await page.screenshot({ path: `${out}/state-${state}-390.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  evidence.states.push(state);
}
// Stale: good load, then refresh fails; offline: saved activity is read-only.
mode = "ready"; await page.goto(`${base}/student/learn?grade=6`); await page.locator(".pdv2-learn-option").first().waitFor();
mode = "offline";
await page.evaluate(() => { Object.defineProperty(navigator, "onLine", { configurable: true, value: false }); dispatchEvent(new Event("offline")); });
await page.getByRole("button", { name: "Refresh" }).click();
await page.getByText("Your assignments could not be checked just now. These are from the last check and may have changed.").waitFor();
await page.getByText("Lists show what was last loaded").waitFor();
await page.screenshot({ path: `${out}/state-stale-offline-390.png`, fullPage: true });
// Stale empty (gate P1): a confirmed-empty snapshot followed by a 503 refresh must not keep claiming emptiness.
mode = "empty"; await page.goto(`${base}/student/learn?grade=6`); await page.getByText("No assignments right now.").waitFor();
mode = "error"; await page.getByRole("button", { name: "Refresh" }).click();
await page.getByText("When last checked, you had no assignments.", { exact: false }).waitFor();
for (const claim of ["No assignments right now.", "No units are scheduled for your class this week.", "No checks are open for you right now."]) assert.equal(await page.getByText(claim).count(), 0, `stale empty still claims: ${claim}`);
await page.screenshot({ path: `${out}/state-stale-empty-390.png`, fullPage: true });
mode = "empty"; await page.getByRole("button", { name: "Refresh" }).click();
await page.getByText("No assignments right now.").waitFor();
assert.equal(await page.getByText("Last checked earlier").count(), 0, "stale warning survived recovery");
evidence.states.push("stale-empty", "stale-empty-recovered");
mode = "offline";
await page.goto(`${base}/student/learn?grade=6`);
await page.getByText("Last saved · read-only").waitFor();
assert(await page.getByRole("button", { name: "Submit answer" }).isDisabled());
assert(await page.getByLabel("2/4").isDisabled());
await page.screenshot({ path: `${out}/state-offline-cached-390.png`, fullPage: true });
evidence.states.push("stale", "offline-cached");
mode = "lessons-empty"; await page.goto(`${base}/student/lessons?grade=6`); await page.getByText("No lessons are published for your grade yet.", { exact: false }).waitFor();
await page.screenshot({ path: `${out}/lessons-empty-390.png`, fullPage: true }); evidence.states.push("lessons-empty");
mode = "ready";

// Unit (locked) and lessons pages.
await page.goto(`${base}/student/units/u-1?grade=6`);
await page.getByText("Locked · finish earlier lessons first").waitFor();
assert.equal(await page.locator("a[href='/student/lesson/l3']").count(), 0);
assert.equal(await page.locator("nav[aria-label=Student] a[aria-current=page]").textContent().then((t) => t.includes("Learn")), true);
await page.screenshot({ path: `${out}/unit-locked-390.png`, fullPage: true });
await page.goto(`${base}/student/units/missing?grade=6`); await page.getByText("This unit isn't available", { exact: false }).waitFor();
await page.screenshot({ path: `${out}/unit-unavailable-390.png`, fullPage: true });
await page.goto(`${base}/student/lessons?grade=6`); await page.getByRole("heading", { name: "Math" }).waitFor();
assert.equal(await overflow(), false);
await page.screenshot({ path: `${out}/lessons-390.png`, fullPage: true });

// Automated WCAG 2.2 AA checks on each surface.
const axeRuns = {};
for (const [name, url, ready] of [["learn", "/student/learn?grade=6", ".pdv2-learn-option"], ["learn-young", "/student/learn?grade=2", ".pdv2-learn-option"], ["unit", "/student/units/u-1?grade=6", ".pdv2-learn-steps"], ["lessons", "/student/lessons?grade=6", ".pdv2-learn-group"]]) {
  await page.goto(`${base}${url}`); await page.locator(ready).first().waitFor();
  if (name === "learn") await page.locator(".pdv2-account-menu summary").click();
  await page.addScriptTag({ path: "node_modules/axe-core/axe.min.js" });
  const result = await page.evaluate(async () => axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] } }));
  axeRuns[name] = result.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length }));
  assert.equal(result.violations.filter((v) => ["serious", "critical"].includes(v.impact)).length, 0, `${name}: ${JSON.stringify(axeRuns[name])}`);
}
evidence.a11y.axe = axeRuns;
await fs.writeFile(`${out}/learn-results.json`, JSON.stringify({ ...evidence, errors, caveat: "Production components in an explicit fixture harness with mocked authorized APIs. Server authorization, real devices, screen readers and user studies are not certified here." }, null, 2));
assert.deepEqual(errors, []);
await browser.close();
console.log(`Learn/shell fixtures passed: ${evidence.shell.length} wide-shell layouts, ${evidence.bands.length} band/width/font layouts, ${evidence.learn.length} Learn layouts, states ${evidence.states.join("/")}, keyboard/forced-colors/reduced-motion/zoom, zero serious/critical axe issues.`);
