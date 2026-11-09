// Draft.6 acceptance on the real Next.js route (/lab-review/v4-lessons/factory@4.0.0-draft.6@<key>), Lesson Player V2.
// Nothing is hidden: the PWA lifecycle notice is FORCED visible (update event) in every service-worker-allowed run, and
// appears naturally ("Offline support could not start") when service workers are blocked. Clicks use Playwright's own
// minimal scroll, no centring. Each scene is also walked with Tab to check that no focused control is hidden (WCAG 2.4.11).
// Zoom: 1280x900 at 200% and 400% equals a 640x450 / 320x225 CSS-pixel viewport at device scale 2 / 4 (actual reflow).
// Usage: node e2e/learning-v4/draft6-route.mjs [--quick]   (port 3219; writes artifacts/learning-v4/draft6-route)
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import { chromium } from "@playwright/test";

const require = createRequire(import.meta.url);
const quick = process.argv.includes("--quick");
const PORT = 3219, BASE = `http://localhost:${PORT}`, ROUTE = "/lab-review/v4-lessons", VERSION = "4.0.0-draft.6";
const KEYS = ["g7-math-area-perimeter", "g7-math-fractions", "math-multiplication-models", "g7-science-states-of-matter", "g7-civics-counties-capitals", "g7-english-reading-evidence"];
const out = "artifacts/learning-v4/draft6-route";
await fs.mkdir(`${out}/shots`, { recursive: true });
const DATABASE_URL = process.env.V4_REVIEW_DATABASE_URL ?? "postgresql://t1:t1@127.0.0.1:55441/t1qa";
if (!/^postgresql:\/\/[^@]+@127\.0\.0\.1:\d+\//.test(DATABASE_URL)) throw Error("review database must be a local throwaway on 127.0.0.1");
const REVIEWER_ID = process.env.V4_REVIEWER_ID ?? "t1-qa-reviewer";
const DEAD = "127.0.0.1:9";
const env = { ...process.env, NODE_ENV: "development", LAB_REVIEW_HARNESS: "1", NEXTAUTH_URL: BASE, NEXTAUTH_SECRET: createHash("sha256").update(`t1-d6-${Date.now()}`).digest("hex"),
  DATABASE_URL, DIRECT_URL: DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL: `http://${DEAD}`, SUPABASE_URL: `http://${DEAD}`, NEXT_TELEMETRY_DISABLED: "1" };
delete env.VERCEL;

const driverSource = (await fs.readFile("e2e/learning-v4/run.mjs", "utf8")).replace(/\r\n/g, "\n");
const from = driverSource.indexOf("const continueButton"), to = driverSource.indexOf("async function axe(");
if (from < 0 || to < 0) throw Error("driver_anchor_missing");
const mult = { placeValueParts: (value) => { const d = String(Math.trunc(Math.abs(value))).split("").map(Number); return d.map((x, i) => x * 10 ** (d.length - 1 - i)).filter(Boolean); } };
const { solve, continueButton } = new Function("counties", "mult", `${driverSource.slice(from, to)}\nreturn { solve, continueButton };`)(null, mult);
const axeSource = await fs.readFile(require.resolve("axe-core/axe.min.js"), "utf8");
const geo = JSON.parse(await fs.readFile("lib/learner-experience/geography/liberia-adm1-2021.json", "utf8"));
const county = (id) => geo.counties.find((c) => c.id === id);
// Mirrors lib/learner-experience/geography/draft6Binding.ts task ids → the geometry answer and a deliberate wrong try.
const GEO_TASKS = {
  "find-lofa": { pick: "lofa", wrong: "bong" }, "find-maryland": { pick: "maryland", wrong: "grand-kru" }, "find-nimba": { pick: "nimba", wrong: "grand-gedeh" },
  "farthest-north-three": { choose: "Lofa", wrongChoose: "Nimba" }, "outline-montserrado": { pick: "montserrado", wrong: "bomi" }, "outline-lofa": { pick: "lofa", wrong: "gbarpolu" },
  "lofa-or-maryland": { choose: "Lofa", wrongChoose: "Maryland" }, "maryland-coast": { choose: "Yes, it touches the coast", wrongChoose: "No, it is inland" },
  "lofa-neighbour": { pick: "gbarpolu", wrong: "nimba" },
};

const packages = {};
for (const key of KEYS) {
  const dir = `curriculum/factory-v4/drafts/${VERSION}/${key}`;
  packages[key] = { experience: JSON.parse(await fs.readFile(`${dir}/learner-projection.json`, "utf8")), manifest: JSON.parse(await fs.readFile(`${dir}/manifest.json`, "utf8")) };
}

if (await fetch(BASE, { signal: AbortSignal.timeout(2000) }).then(() => true, () => false)) throw Error(`port ${PORT} is already in use; stop that server first`);
const server = spawn(process.platform === "win32" ? "npx.cmd" : "npx", ["next", "dev", "-p", String(PORT)], { env, shell: process.platform === "win32", stdio: ["ignore", "pipe", "pipe"] });
let serverLog = "";
server.stdout.on("data", (chunk) => { serverLog += chunk; }); server.stderr.on("data", (chunk) => { serverLog += chunk; });
const stop = () => { try { process.platform === "win32" ? spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"]) : server.kill("SIGTERM"); } catch { /* gone */ } };
for (let i = 0; i < 240 && !/Ready in|started server/i.test(serverLog); i++) await new Promise((resolve) => setTimeout(resolve, 1000));

const evidence = { generatedAt: new Date().toISOString(), route: ROUTE, version: VERSION, method: "no element hidden; PWA notice forced visible (SW allowed) or natural (SW blocked); native click scroll; Tab focus audit", plays: [], axe: {}, canaries: {}, errors: [], writes: [], hosts: [] };
const { assertLocalReview } = require("../../scripts/labs/reviewer-session.cjs");
const { encode } = require("next-auth/jwt");
assertLocalReview(`${BASE}/`, env);
const token = await encode({ secret: env.NEXTAUTH_SECRET, token: { id: REVIEWER_ID, name: "Synthetic V4 reviewer", email: "synthetic@example.invalid", role: "MOE_OFFICIAL", isPlatformAdmin: false }, maxAge: 7200 });
const browser = await chromium.launch({ headless: true });
const log = (line) => { process.stdout.write(`${new Date().toISOString().slice(11, 19)} ${line}\n`); };

async function newPage({ width, height, scale = 1, sw = "allow" }) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: scale, reducedMotion: "reduce", bypassCSP: true, serviceWorkers: sw });
  await context.addCookies([{ name: "next-auth.session-token", value: token, url: BASE, httpOnly: true, sameSite: "Lax" }]);
  const page = await context.newPage();
  page.setDefaultTimeout(45000); page.setDefaultNavigationTimeout(300000);
  page.on("pageerror", (error) => evidence.errors.push(`${width}: ${error.message}`));
  page.on("request", (request) => { const url = new URL(request.url()); if (!evidence.hosts.includes(url.host)) evidence.hosts.push(url.host); if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method()) && !url.pathname.startsWith("/_next/")) evidence.writes.push(`${request.method()} ${url.pathname}`); });
  return { context, page };
}
const metrics = (page) => page.evaluate(() => {
  const notice = document.querySelector("[data-pwa-status]"), r = notice?.getBoundingClientRect();
  return { viewport: innerWidth, horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1, notice: notice ? { state: notice.getAttribute("data-pwa-status"), top: Math.round(r.top), height: Math.round(r.height) } : null,
    math: document.querySelectorAll(".ll3-scene math").length, rawTex: /\\(frac|times|text|cdot|dfrac)\b/.test(document.querySelector(".ll3-scene")?.innerText ?? "") };
});
/** Tab through the scene; a control is "hidden" when no sample point of it is the topmost element (2.4.11 minimum). */
async function focusAudit(page) {
  await page.locator("#scene-title").focus();
  const seen = [], hidden = [], partial = [];
  for (let i = 0; i < 70; i++) {
    await page.keyboard.press("Tab");
    const row = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const r = el.getBoundingClientRect(), inset = (v, size) => v + Math.min(4, size / 4);
      const points = [[r.left + r.width / 2, r.top + r.height / 2], [inset(r.left, r.width), inset(r.top, r.height)], [r.right - Math.min(4, r.width / 4), inset(r.top, r.height)], [inset(r.left, r.width), r.bottom - Math.min(4, r.height / 4)], [r.right - Math.min(4, r.width / 4), r.bottom - Math.min(4, r.height / 4)]];
      const covers = points.map(([x, y]) => { const hit = document.elementFromPoint(x, y); return !hit ? "offscreen" : el === hit || el.contains(hit) || hit.contains(el) ? null : (hit.closest("[data-pwa-status]") ? "pwa-notice" : hit.closest("footer") ? "footer" : hit.closest("header,[data-v4-review-bar]") ? "header" : hit.tagName.toLowerCase()); });
      const name = (el.getAttribute("aria-label") || el.innerText || el.tagName).replace(/\s+/g, " ").trim().slice(0, 50);
      return { key: `${el.tagName}:${name}:${Math.round(r.top)}`, name, inScene: Boolean(el.closest(".ll3-scene")), covers };
    });
    if (!row || seen.includes(row.key)) break;
    seen.push(row.key);
    const blocked = row.covers.filter(Boolean);
    if (blocked.length === row.covers.length) hidden.push({ name: row.name, by: [...new Set(blocked)] });
    else if (blocked.length && row.inScene) partial.push({ name: row.name, by: [...new Set(blocked)] });
  }
  return { tabbed: seen.length, hidden, partial };
}

/** Click a county where a learner would: on its printed number (inside the area), not its bounding-box centre. */
async function tapCounty(map, id) {
  const point = await map.locator(`[data-county="${id}"]`).evaluate((path, at) => { const svg = path.ownerSVGElement, m = svg.getScreenCTM(); return { x: at[0] * m.a + m.e, y: at[1] * m.d + m.f }; }, county(id).label);
  const box = await map.locator(`[data-county="${id}"]`).boundingBox();
  await map.locator(`[data-county="${id}"]`).click({ position: { x: point.x - box.x, y: point.y - box.y } });
}
async function solveGeo(page) {
  const notes = [];
  for (const map of await page.locator("[data-geo-map]").all()) {
    const variant = await map.getAttribute("data-geo-map");
    const first = map.locator("[data-county]").first();
    await first.focus(); await page.keyboard.press("ArrowDown"); await page.keyboard.press("ArrowRight");
    const moved = await page.evaluate(() => document.activeElement?.getAttribute("data-county"));
    await page.keyboard.press("Enter");
    notes.push({ variant, keyboardMovedTo: moved, detail: (await map.locator("[data-geo-detail]").innerText()).slice(0, 220), labelsHaveNames: await map.locator("[data-county]").evaluateAll((nodes) => nodes.some((n) => /[A-Z][a-z]/.test(n.getAttribute("aria-label").replace(/^Area/, "")))), attribution: await map.locator("[data-geo-attribution]").innerText() });
    for (let guard = 0; guard < 8; guard++) {
      const taskNode = map.locator("[data-geo-task]");
      if (!(await taskNode.count())) break;
      const id = await taskNode.getAttribute("data-geo-task"), plan = GEO_TASKS[id];
      if (!plan) { notes.push({ unknownTask: id }); break; }
      if (plan.pick) {
        await tapCounty(map, plan.wrong); await taskNode.getByRole("button", { name: /^Check/ }).click();
        const wrong = await taskNode.locator("[role=status]").innerText();
        await tapCounty(map, plan.pick); await taskNode.getByRole("button", { name: /^Check/ }).click();
        notes.push({ task: id, wrongFeedback: wrong, rightFeedback: await taskNode.locator("[role=status]").innerText() });
      } else {
        await taskNode.getByRole("button", { name: plan.wrongChoose, exact: true }).click();
        const wrong = await taskNode.locator("[role=status]").innerText();
        await taskNode.getByRole("button", { name: plan.choose, exact: true }).click();
        notes.push({ task: id, wrongFeedback: wrong, rightFeedback: await taskNode.locator("[role=status]").innerText() });
      }
      await taskNode.getByRole("button", { name: /Next map task|Finish map tasks/ }).click();
    }
    notes.push({ variant, tasksDone: await map.locator("[data-geo-tasks-done]").count() });
  }
  return notes;
}

const ANSWER = "I used the model and the evidence in this scene to explain my reasoning step by step, and I checked each part against what the diagram or text actually shows before I wrote this answer.";
async function play(key, opts) {
  const { experience, manifest } = packages[key];
  const label = `${key}--${opts.tag}`;
  const { context, page } = await newPage(opts);
  const record = { key, ...opts, scenes: [], finished: false };
  try {
    const response = await page.goto(`${BASE}${ROUTE}/factory@${VERSION}@${key}`, { waitUntil: "domcontentloaded" });
    record.status = response.status();
    await page.locator("[data-lesson-player-v2]").waitFor();
    const bar = page.locator("[data-v4-review-bar]");
    record.identity = { version: await bar.getAttribute("data-v4-version"), projection: await bar.getAttribute("data-v4-projection"), barText: (await bar.evaluate((node) => node.textContent)).replace(/\s+/g, " ") };
    record.projectionMatchesManifest = record.identity.projection === manifest.learnerProjectionSha256;
    record.packageHashShown = record.identity.barText.includes(manifest.packageHash.slice(0, 12));
    if (opts.forceNotice) await page.evaluate(() => window.dispatchEvent(new CustomEvent("liberialearn-pwa-update-available", { detail: {} })));
    if (opts.offline) await context.setOffline(true);
    for (const [index, scene] of experience.scenes.entries()) {
      await page.locator(`[data-scene-id="${scene.id}"]`).waitFor();
      const notes = [];
      const blocks = [...(scene.teaching?.blocks ?? []), ...(scene.teaching?.visual ? [scene.teaching.visual] : [])];
      for (const block of blocks) { try { notes.push({ block: `${block.type}:${block.id ?? ""}`, notes: await solve(page, block, {}) }); } catch (error) { notes.push({ block: `${block.type}:${block.id ?? ""}`, error: String(error.message).split("\n").filter((line, i) => i === 0 || /intercepts pointer|not visible|outside of the viewport/.test(line)).slice(0, 3).join(" | ") }); } }
      if (await page.locator(".ll3-scene [data-geo-map]").count()) { try { notes.push({ geo: await solveGeo(page) }); } catch (error) { notes.push({ block: "GEO_MAP", error: String(error.message).split("\n").filter((line, i) => i === 0 || /intercepts pointer|not visible/.test(line)).slice(0, 3).join(" | ") }); } }
      if (scene.interaction?.kind === "FREE_RESPONSE") for (const prompt of scene.interaction.prompts) await page.locator(`[id="reflect-${prompt.id}"]`).fill(ANSWER);
      const layout = await metrics(page);
      const focus = opts.audit ? await focusAudit(page) : null;
      if (opts.shots) await page.screenshot({ path: `${out}/shots/${label}--${String(index + 1).padStart(2, "0")}-${scene.id}.png`, fullPage: true });
      if (opts.axe) { await page.addScriptTag({ content: axeSource }); evidence.axe[`${key}/${scene.id}`] = await page.evaluate(async () => { const run = await window.axe.run(document.querySelector("[data-lesson-player-v2]"), { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] } }); return run.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, target: v.nodes[0]?.target })); }); }
      const enabled = !(await continueButton(page).isDisabled());
      record.scenes.push({ id: scene.id, type: scene.type, completed: enabled, layout, focus, notes });
      if (!enabled) break;
      await continueButton(page).click();
      if (index === experience.scenes.length - 1) record.finished = true;
    }
  } catch (error) { record.fatal = String(error.message).split("\n").slice(0, 3).join(" | "); }
  await context.close();
  evidence.plays.push(record);
  const errs = record.scenes.flatMap((s) => s.notes.filter((n) => n.error)).length, hidden = record.scenes.reduce((n, s) => n + (s.focus?.hidden.length ?? 0), 0);
  log(`${label} status=${record.status} scenes=${record.scenes.length}/${experience.scenes.length} blockErrors=${errs} focusHidden=${hidden} ${record.fatal ? `FATAL ${record.fatal}` : ""}`);
}

try {
  if (!/Ready in|started server/i.test(serverLog)) throw Error(`next_dev_not_ready\n${serverLog.slice(-2000)}`);
  const widths = quick ? [[390, 844]] : [[360, 740], [390, 844], [768, 1024], [1024, 768], [1440, 900], [1920, 1080]];
  // 1. Every lesson at every width, notice forced visible.
  for (const key of quick ? ["g7-civics-counties-capitals"] : KEYS) for (const [width, height] of widths)
    await play(key, { tag: `${width}`, width, height, forceNotice: true, audit: width <= 1024, shots: [390, 1440, 1920].includes(width) || key === "g7-civics-counties-capitals", axe: width === 1440 });
  if (!quick) {
    // 2. #199: service workers unavailable, so the natural failure notice is mounted; 320-1024 px.
    for (const key of ["g7-math-area-perimeter", "math-multiplication-models", "g7-civics-counties-capitals"]) for (const [width, height] of [[320, 640], [360, 740], [390, 844], [768, 1024], [1024, 768]])
      await play(key, { tag: `noSW-${width}`, width, height, sw: "block", audit: true, shots: width === 320 });
    // 3. Actual reflow zoom: 1280x900 at 200% and 400%.
    for (const key of KEYS) for (const [zoom, scale] of [["200", 2], ["400", 4]])
      await play(key, { tag: `zoom${zoom}`, width: 1280 / scale, height: 900 / scale, scale, forceNotice: true, audit: zoom === "400", shots: true });
    // 4. Offline after load: the lesson (and the county map) keep working with no network.
    for (const key of ["g7-civics-counties-capitals", "g7-math-fractions"]) await play(key, { tag: "offline-390", width: 390, height: 844, offline: true, shots: true });
  }
  // 5. Learner-payload canaries: no protected assessment, teacher guidance or package internals in served HTML/RSC.
  const { context, page } = await newPage({ width: 1440, height: 900 });
  for (const key of KEYS) {
    const body = await (await page.goto(`${BASE}${ROUTE}/factory@${VERSION}@${key}`, { waitUntil: "domcontentloaded" })).text();
    evidence.canaries[key] = ["acceptableReasoning", "freeResponseAndWritingGuidance", "scoringSpec", "assessmentRequests", "labProposals", "feedbackReveal", "paper-alternative", "sourceVerification", "inputPins", "blueprintHash", "academic-review"].filter((canary) => body.includes(canary));
  }
  await context.close();
} finally {
  await fs.writeFile(`${out}/evidence.json`, JSON.stringify(evidence, null, 2));
  await fs.writeFile(`${out}/next-dev.log`, serverLog);
  await browser.close();
  stop();
}

const summary = {
  plays: evidence.plays.length, finished: evidence.plays.filter((p) => p.finished).length, fatal: evidence.plays.filter((p) => p.fatal).map((p) => `${p.key}--${p.tag}: ${p.fatal}`),
  incomplete: evidence.plays.filter((p) => !p.finished).map((p) => `${p.key}--${p.tag}@${p.scenes.at(-1)?.id}`),
  identity: evidence.plays.every((p) => p.projectionMatchesManifest && p.packageHashShown),
  blockErrors: evidence.plays.flatMap((p) => p.scenes.flatMap((s) => s.notes.filter((n) => n.error).map((n) => `${p.key}--${p.tag}:${s.id}:${n.block}: ${n.error.slice(0, 160)}`))),
  focusHidden: evidence.plays.flatMap((p) => p.scenes.flatMap((s) => (s.focus?.hidden ?? []).map((h) => `${p.key}--${p.tag}:${s.id}:${h.name} by ${h.by}`))),
  overflow: evidence.plays.flatMap((p) => p.scenes.filter((s) => s.layout.horizontalOverflow).map((s) => `${p.key}--${p.tag}:${s.id}`)),
  rawTex: evidence.plays.flatMap((p) => p.scenes.filter((s) => s.layout.rawTex).map((s) => `${p.key}--${p.tag}:${s.id}`)),
  noticeSeen: evidence.plays.filter((p) => p.scenes.some((s) => s.layout.notice)).length,
  axe: Object.entries(evidence.axe).filter(([, v]) => v.length).map(([k, v]) => `${k}: ${v.map((x) => `${x.id}(${x.nodes})`).join(",")}`),
  canaries: Object.entries(evidence.canaries).filter(([, v]) => v.length), pageErrors: evidence.errors.slice(0, 10), writes: evidence.writes, hosts: evidence.hosts,
};
await fs.writeFile(`${out}/summary.json`, JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 1));
