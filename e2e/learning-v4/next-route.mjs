// Interactive Learning V4 review route on the real Next.js app (R7). Starts gated `next dev` with no reachable database,
// signs a synthetic local reviewer session (scripts/labs/reviewer-session.cjs, JWT only), then checks the gallery labels
// and version links, plays the newest verified factory geometry lesson end to end at 1440 and 390 px with the learner
// driver from run.mjs (read at run time so that file stays byte-identical for the T2/CoS adapters), opens the reference
// fixture, and confirms invalid selections play nothing. Records screenshots, axe, layout, requests and payload canaries.
// Usage: node e2e/learning-v4/next-route.mjs   (port 3217; writes artifacts/learning-v4/next-route)
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import { chromium } from "@playwright/test";

const require = createRequire(import.meta.url);
const PORT = 3217, BASE = `http://localhost:${PORT}`, ROUTE = "/lab-review/v4-lessons", KEY = "g7-math-area-perimeter";
const out = "artifacts/learning-v4/next-route";
await fs.mkdir(`${out}/shots`, { recursive: true });
// The root layout's ConsentGate reads DataPolicyAcceptance for any signed-in user (CoS finding D1), so the route needs a
// database. Only a throwaway local one is accepted (CoS `cos-v4-qa-pg`, one synthetic consent row for the reviewer id);
// these values override .env.local, so the production database is never contacted.
const DATABASE_URL = process.env.V4_REVIEW_DATABASE_URL ?? "postgresql://cos:cos@127.0.0.1:55439/cosqa";
if (!/^postgresql:\/\/[^@]+@127\.0\.0\.1:\d+\//.test(DATABASE_URL)) throw Error("review database must be a local throwaway on 127.0.0.1");
const REVIEWER_ID = process.env.V4_REVIEWER_ID ?? "cos-qa-reviewer";
const DEAD = "127.0.0.1:9";
const env = { ...process.env, NODE_ENV: "development", LAB_REVIEW_HARNESS: "1", NEXTAUTH_URL: BASE, NEXTAUTH_SECRET: createHash("sha256").update(`t1-local-${Date.now()}`).digest("hex"),
  DATABASE_URL, DIRECT_URL: DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL: `http://${DEAD}`, SUPABASE_URL: `http://${DEAD}`, NEXT_TELEMETRY_DISABLED: "1" };
delete env.VERCEL;

// The learner driver from run.mjs: helpers + solve(), evaluated with the two model modules it needs (unused by geometry).
const driverSource = (await fs.readFile("e2e/learning-v4/run.mjs", "utf8")).replace(/\r\n/g, "\n");
const from = driverSource.indexOf("const continueButton"), to = driverSource.indexOf("async function axe(");
if (from < 0 || to < 0) throw Error("driver_anchor_missing");
const { solve, continueButton } = new Function("counties", "mult", `${driverSource.slice(from, to)}\nreturn { solve, continueButton };`)(null, null);
const axeSource = await fs.readFile(require.resolve("axe-core/axe.min.js"), "utf8");

// Answers come from the shipped package projection; the route's own hash is compared with the manifest.
const versions = (await fs.readdir("curriculum/factory-v4/drafts")).filter((name) => /^4\.0\.0-draft\.\d+$/.test(name)).sort((a, b) => +b.split(".").pop() - +a.split(".").pop());
const playable = [];
for (const version of versions) { try { await fs.access(`curriculum/factory-v4/drafts/${version}/${KEY}/manifest.json`); playable.push(version); } catch { /* not generated for this lesson */ } }
if (!playable.length) throw Error("no_factory_geometry_package");
const VERSION = playable[0];
const pkg = `curriculum/factory-v4/drafts/${VERSION}/${KEY}`;
const experience = JSON.parse(await fs.readFile(`${pkg}/learner-projection.json`, "utf8"));
const manifest = JSON.parse(await fs.readFile(`${pkg}/manifest.json`, "utf8"));
const SELECTION = `factory@${VERSION}@${KEY}`;

// Never drive a server this run did not start (an orphaned dev server would answer instead).
if (await fetch(BASE, { signal: AbortSignal.timeout(2000) }).then(() => true, () => false)) throw Error(`port ${PORT} is already in use; stop that server first`);
const server = spawn(process.platform === "win32" ? "npx.cmd" : "npx", ["next", "dev", "-p", String(PORT)], { env, shell: process.platform === "win32", stdio: ["ignore", "pipe", "pipe"] });
let serverLog = "";
server.stdout.on("data", (chunk) => { serverLog += chunk; }); server.stderr.on("data", (chunk) => { serverLog += chunk; });
const stop = () => { try { process.platform === "win32" ? spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"]) : server.kill("SIGTERM"); } catch { /* already gone */ } };
for (let i = 0; i < 240 && !/Ready in|started server/i.test(serverLog); i++) await new Promise((resolve) => setTimeout(resolve, 1000));

const evidence = { generatedAt: new Date().toISOString(), route: ROUTE, selection: SELECTION, versionsOnDisk: versions, manifest: { candidateVersion: manifest.candidateVersion, packageHash: manifest.packageHash, learnerProjectionSha256: manifest.learnerProjectionSha256 }, gallery: {}, plays: {}, reference: {}, invalid: {}, canaries: {}, axe: {}, errors: [], writes: [], hosts: [] };
const { assertLocalReview } = require("../../scripts/labs/reviewer-session.cjs");
const { encode } = require("next-auth/jwt");
assertLocalReview(`${BASE}/`, env);
const reviewerToken = await encode({ secret: env.NEXTAUTH_SECRET, token: { id: REVIEWER_ID, name: "Synthetic V4 reviewer", email: "synthetic@example.invalid", role: "MOE_OFFICIAL", isPlatformAdmin: false }, maxAge: 3600 });
const browser = await chromium.launch({ headless: true });

async function newPage(width, height) {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: "reduce", serviceWorkers: "block", bypassCSP: true }); // CSP bypass only so axe can be injected
  await context.addCookies([{ name: "next-auth.session-token", value: reviewerToken, url: BASE, httpOnly: true, sameSite: "Lax" }]);
  const page = await context.newPage();
  page.setDefaultTimeout(60000); page.setDefaultNavigationTimeout(300000);
  page.on("pageerror", (error) => evidence.errors.push(`${width}: ${error.message}`));
  page.on("request", (request) => { const url = new URL(request.url()); if (!evidence.hosts.includes(url.host)) evidence.hosts.push(url.host); if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method()) && !url.pathname.startsWith("/_next/")) evidence.writes.push(`${request.method()} ${url.pathname}`); });
  return { context, page };
}
const metrics = (page) => page.evaluate(() => ({ viewport: innerWidth, horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1, bar: document.querySelector("[data-v4-review-bar]")?.getBoundingClientRect().height ?? null, stage: Math.round(document.querySelector(".ll3-stage-main")?.getBoundingClientRect().width ?? 0) }));
async function axe(page, label, selector) {
  await page.addScriptTag({ content: axeSource });
  evidence.axe[label] = await page.evaluate(async (scope) => { const run = await window.axe.run(document.querySelector(scope) ?? document.body, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } }); return { violations: run.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, target: v.nodes[0]?.target })), incomplete: run.incomplete.length }; }, selector);
}

try {
  if (!/Ready in|started server/i.test(serverLog)) throw Error(`next_dev_not_ready\n${serverLog.slice(-2000)}`);

  // 1. Gallery at both widths: origin labels, factory first, geometry featured, explicit version links.
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    const { context, page } = await newPage(width, height);
    const response = await page.goto(`${BASE}${ROUTE}`, { waitUntil: "networkidle" });
    const html = await page.content();
    evidence.gallery[width] = {
      status: response.status(), factoryLabel: html.includes("Factory-generated DRAFT"), referenceLabel: html.includes("Hand-authored reference fixture"),
      factoryBeforeReference: html.indexOf('data-v4-origin="FACTORY_GENERATED"') > -1 && html.indexOf('data-v4-origin="FACTORY_GENERATED"') < html.indexOf('data-v4-origin="HAND_AUTHORED_FIXTURE"'),
      featured: await page.locator(`[data-featured][data-v4-lesson="${KEY}"]`).count(), selections: await page.locator("[data-v4-selection]").evaluateAll((links) => [...new Set(links.map((link) => link.getAttribute("data-v4-selection")))]),
      rejected: await page.locator("[data-v4-rejected] li").allInnerTexts(), layout: await metrics(page),
    };
    await page.screenshot({ path: `${out}/shots/gallery--${width}.png`, fullPage: true });
    if (width === 1440) await axe(page, "gallery", "main");
    await context.close();
  }

  // 2. The factory geometry lesson end to end through the real route.
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    const { context, page } = await newPage(width, height);
    const record = { scenes: [], finished: false };
    await page.goto(`${BASE}${ROUTE}/${SELECTION}`, { waitUntil: "domcontentloaded" });
    await page.locator("[data-lesson-player-v2]").waitFor();
    const bar = page.locator("[data-v4-review-bar]");
    record.bar = { origin: await bar.getAttribute("data-v4-origin"), version: await bar.getAttribute("data-v4-version"), projection: await bar.getAttribute("data-v4-projection"), text: (await bar.innerText()).replace(/\s+/g, " ").slice(0, 400) };
    record.projectionMatchesManifest = record.bar.projection === manifest.learnerProjectionSha256;
    record.barOutsidePlayer = await page.evaluate(() => !document.querySelector("[data-lesson-player-v2] [data-v4-review-bar]"));
    await bar.locator("summary").click();
    record.provenanceOpens = await bar.locator("details").evaluate((node) => node.open);
    await page.screenshot({ path: `${out}/shots/geometry--${width}--00-provenance.png` });
    await bar.locator("summary").click();
    for (const [index, scene] of experience.scenes.entries()) {
      await page.locator(`[data-scene-id="${scene.id}"]`).waitFor();
      const blocks = [...(scene.teaching?.blocks ?? []), ...(scene.teaching?.visual ? [scene.teaching.visual] : [])];
      const notes = [];
      for (const block of blocks) { try { notes.push({ block: `${block.type}:${block.id ?? ""}`, notes: await solve(page, block, {}) }); } catch (error) { notes.push({ block: `${block.type}:${block.id ?? ""}`, error: String(error.message).split("\n")[0] }); } }
      if (scene.interaction?.kind === "FREE_RESPONSE") for (const prompt of scene.interaction.prompts) {
        const box = page.locator(`[id="reflect-${prompt.id}"]`);
        notes.push({ freeResponse: prompt.prompt, labelled: await box.evaluate((node) => Boolean(node.labels?.length || node.getAttribute("aria-label") || node.getAttribute("aria-labelledby"))) });
        await box.fill("Area counts the unit squares that cover the inside, so its unit is square metres (m²). Perimeter is a length around the edge, so it is in metres (m).");
      }
      if (scene.interaction?.kind === "ASSESSMENT_HANDOFF") notes.push({ handoff: (await page.locator(`[data-scene-id="${scene.id}"]`).innerText()).replace(/\s+/g, " ").slice(0, 200) });
      const shot = `${out}/shots/geometry--${width}--${String(index + 1).padStart(2, "0")}-${scene.id}.png`;
      await page.screenshot({ path: shot, fullPage: true });
      if (width === 1440) await axe(page, `geometry/${scene.id}`, "[data-lesson-player-v2]");
      const rawTex = await page.evaluate(() => /\\(frac|times|text|cdot)\b/.test(document.querySelector(".ll3-scene")?.innerText ?? ""));
      const enabled = !(await continueButton(page).isDisabled());
      record.scenes.push({ id: scene.id, title: scene.title, completed: enabled, rawTexVisible: rawTex, layout: await metrics(page), notes, screenshot: shot.replace(`${out}/`, "") });
      if (!enabled) break;
      await continueButton(page).click();
      if (index === experience.scenes.length - 1) record.finished = true;
    }
    if (width === 1440) {
      // Collapsible rails still work with the reviewer bar above the player.
      await page.goto(`${BASE}${ROUTE}/${SELECTION}`, { waitUntil: "domcontentloaded" });
      await page.locator("[data-lesson-player-v2]").waitFor();
      const before = await metrics(page);
      await page.getByRole("button", { name: "Hide" }).first().click();
      record.railCollapse = { before: before.stage, after: (await metrics(page)).stage };
      await page.screenshot({ path: `${out}/shots/geometry--1440--rail-collapsed.png` });
    }
    evidence.plays[width] = record;
    await context.close();
  }

  // 3. Reference fixture: separately labelled, links back to the factory version for comparison.
  {
    const { context, page } = await newPage(1440, 900);
    await page.goto(`${BASE}${ROUTE}/${KEY}`, { waitUntil: "domcontentloaded" });
    await page.locator("[data-lesson-player-v2]").waitFor();
    const bar = page.locator("[data-v4-review-bar]");
    evidence.reference = { origin: await bar.getAttribute("data-v4-origin"), version: await bar.getAttribute("data-v4-version"), compareFactory: await bar.locator("[data-v4-selection]").evaluateAll((links) => links.map((link) => link.getAttribute("data-v4-selection"))) };
    await page.screenshot({ path: `${out}/shots/reference--1440.png` });
    await context.close();
  }

  // 4. Invalid selections: nothing plays, nothing is substituted.
  {
    const { context, page } = await newPage(1440, 900);
    for (const selection of [`factory@4.0.0-draft.99@${KEY}`, `factory@${KEY}`, `factory@${VERSION.toUpperCase()}@${KEY}`, `factory@${VERSION}@..%2F..%2Fpackage.json`, "not-a-lesson"]) {
      const response = await page.goto(`${BASE}${ROUTE}/${selection}`, { waitUntil: "domcontentloaded" });
      evidence.invalid[selection] = { status: response.status(), player: await page.locator("[data-lesson-player-v2]").count(), rejection: await page.locator("[data-v4-rejection]").getAttribute("data-v4-rejection").catch(() => null) };
    }
    await context.close();
  }

  // 5. Student-payload canaries in the served HTML/RSC of the factory page (reviewer bar excluded by design: blocker codes are reviewer chrome).
  {
    const { context, page } = await newPage(1440, 900);
    const response = await page.goto(`${BASE}${ROUTE}/${SELECTION}`, { waitUntil: "domcontentloaded" });
    const body = await response.text();
    for (const canary of ["assessmentRequests", "labProposals", "releaseBlockers", "feedbackReveal", "paper-alternative", "factoryStatus", "sourceVerification", "inputPins", "blueprintHash"]) evidence.canaries[canary] = body.includes(canary);
    await context.close();
  }
} finally {
  await fs.writeFile(`${out}/evidence.json`, JSON.stringify(evidence, null, 2));
  await fs.writeFile(`${out}/next-dev.log`, serverLog);
  await browser.close();
  stop();
}

const plays = Object.values(evidence.plays);
const summary = {
  selection: SELECTION, gallery: Object.values(evidence.gallery).every((row) => row.status === 200 && row.factoryLabel && row.referenceLabel && row.factoryBeforeReference && row.featured === 1 && !row.layout.horizontalOverflow),
  finished: plays.filter((record) => record.finished).length, projectionMatchesManifest: plays.every((record) => record.projectionMatchesManifest),
  blockErrors: plays.flatMap((record) => record.scenes.flatMap((scene) => scene.notes.filter((note) => note.error).map((note) => `${scene.id}:${note.block}`))),
  overflow: plays.flatMap((record) => record.scenes.filter((scene) => scene.layout.horizontalOverflow).map((scene) => `${scene.layout.viewport}:${scene.id}`)),
  invalidPlayed: Object.entries(evidence.invalid).filter(([, row]) => row.player).map(([key]) => key),
  canaries: Object.entries(evidence.canaries).filter(([, hit]) => hit).map(([key]) => key),
  axeViolations: Object.values(evidence.axe).reduce((sum, result) => sum + result.violations.length, 0), pageErrors: evidence.errors.length, writes: evidence.writes, hosts: evidence.hosts,
};
console.log(JSON.stringify(summary, null, 1));
if (!summary.gallery || summary.finished !== 2 || !summary.projectionMatchesManifest || summary.blockErrors.length || summary.overflow.length || summary.invalidPlayed.length || summary.canaries.length || summary.axeViolations || summary.pageErrors || summary.writes.length) process.exitCode = 1;
