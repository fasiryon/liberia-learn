// Chief of Staff independent V4 QA against the REAL Next.js review route (next dev; the route is dev-only by design).
// Reuses T1's learner driver (e2e/learning-v4/run.mjs), adapted at run time; no frontend- or factory-owned file is edited.
// - Server: `next dev` with LAB_REVIEW_HARNESS=1, a throwaway local NEXTAUTH_SECRET and every database/Supabase variable
//   pointed at an unreachable local port, so any database access fails loudly instead of reaching production.
// - Session: a synthetic MOE_OFFICIAL reviewer JWT minted with that local secret (JWT strategy; no database lookup).
// - Lessons: answers come from the shipped learner-projection.json of the selected package; the route itself loads
//   the package through lib/curriculum/v4 (no request interception, no API stubs).
// - Audits: every request host, non-GET writes, and the served HTML/RSC payload for reviewer-only or protected keys.
// Usage: node e2e/cos-v4-qa/next-route.cjs --version 4.0.0-draft.5 [--quick]   |   --reference  (bare fixture keys)
const fs = require("fs"), cp = require("child_process"), crypto = require("crypto");
const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };
const reference = process.argv.includes("--reference");
const version = reference ? "reference" : arg("--version");
if (!version) throw Error("usage: --version <candidateVersion> | --reference");
const PORT = 3215, out = `artifacts/cos-v4/next-route/${version}`;
fs.mkdirSync(`${out}/shots`, { recursive: true });

const drafts = `curriculum/factory-v4/drafts/${version}`;
const keys = reference ? null : fs.readdirSync(drafts).filter((k) => fs.existsSync(`${drafts}/${k}/learner-projection.json`));
const selection = (key) => reference ? key : `factory@${version}@${key}`;

let d = fs.readFileSync("e2e/learning-v4/run.mjs", "utf8").replace(/\r\n/g, "\n");
const swap = (a, b) => { if (!d.includes(a)) throw Error("anchor_missing: " + a.slice(0, 70)); d = d.replace(a, b); };
swap('const out = "artifacts/learning-v4/browser";', `const out = ${JSON.stringify(out)};`);
// Vite is kept only to load the pure model modules the solver needs; it never listens.
d = d.replace("await server.listen();", "");
swap('const lessons = Object.fromEntries(v4.V4_LESSONS.map((lesson) => [lesson.key, { lesson, experience: v4.v4LearnerProjection(lesson) }]));',
  reference
    ? "const lessons = Object.fromEntries(v4.V4_LESSONS.map((lesson) => [lesson.key, { lesson, experience: v4.v4LearnerProjection(lesson) }]));"
    : `const lessons = Object.fromEntries(${JSON.stringify(keys)}.map((key) => [key, { experience: JSON.parse(require("fs").readFileSync(${JSON.stringify(drafts)} + "/" + key + "/learner-projection.json", "utf8")) }]));`);
d = d.replace('import fs from "node:fs/promises";', 'import fs from "node:fs/promises";\nimport { createRequire as __cr } from "node:module";\nconst require = __cr(import.meta.url);');
swap('const BASE = "http://127.0.0.1:3203";', `const BASE = "http://127.0.0.1:${PORT}";\nconst SESSION = process.env.COS_SESSION_TOKEN;\nconst sel = (key) => encodeURIComponent(${reference ? "key" : `"factory@${version}@" + key`});`);
// Real route: no fixture interception, no API stubs; reviewer cookie; record every request host and the document payloads.
swap('  await context.route("**/__v4/*.json", (route) => { const key = decodeURIComponent(new URL(route.request().url()).pathname.split("/").pop().replace(/\\.json$/, "")); return route.fulfill({ json: lessons[key].experience }); });\n  await context.route("**/api/**", (route) => route.fulfill({ json: {} }));\n',
  `  await context.addCookies([{ name: "next-auth.session-token", value: SESSION, domain: "127.0.0.1", path: "/", httpOnly: true }]);\n`);
swap('page.on("request", (request) => {', 'page.on("request", (request) => { const u = new URL(request.url()); evidence.hosts[u.host] = (evidence.hosts[u.host] ?? 0) + 1; ');
swap('  page.on("pageerror"', '  page.on("response", async (response) => { const type = response.headers()["content-type"] ?? ""; if (response.request().resourceType() === "document" || type.includes("text/x-component")) { try { payloadAudit(response.url(), await response.text()); } catch {} } });\n  page.on("pageerror"');
swap("const evidence = {", `const CANARIES = ["assessmentRequests", "labProposals", "releaseBlockers", "feedbackReveal", "paperAlternative", "paper-alternative", "factoryStatus", "generation-receipt", "factory-receipt", "visual-teaching.json", "blueprint.json", "answerKey", "rubric", "teacherNotes", "markScheme", "acceptedAnswers"];
function payloadAudit(url, text) {
  const hits = CANARIES.filter((c) => text.includes(c));
  const governed = [...text.matchAll(/governedItems\\\\?":\\s*\\[([^\\]]{0,40})/g)].map((m) => m[1]).filter((x) => x.trim() !== "");
  evidence.payload.push({ url: new URL(url).pathname + new URL(url).search, bytes: text.length, canaryHits: hits, nonEmptyGovernedItems: governed.length });
}
const evidence = {`);
// The app-wide PWA lifecycle toast (components/PwaLifecycleStatus.tsx: fixed, z-50, no dismiss) can sit over controls
// just above the fixed footer at narrow widths and intercept clicks. It is outside V4 (finding D4); hide only that
// element. Service workers stay enabled (real behaviour).
swap("const page = await context.newPage();", "await context.addInitScript(() => { const css = 'div.fixed.z-50[role=status][aria-live=polite]{display:none!important}'; const add = () => { const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s); }; if (document.head) add(); else document.addEventListener('DOMContentLoaded', add); });\n  const page = await context.newPage();");
swap("await page.addScriptTag({ content: axeSource });", "await page.evaluate(axeSource);"); // CSP forbids inline script tags; evaluate is not subject to CSP.
swap('lessons: {}, responsive: []', 'lessons: {}, payload: [], hosts: {}, responsive: []');
swap('harness: "e2e/product-design-v2 (Vite fixture harness, production components)"', `harness: "Next.js dev server, real route /lab-review/v4-lessons (${version})"`);
swap('await page.goto(`${BASE}/lab-review/v4-lessons/${key}`, { waitUntil: "domcontentloaded" });\n      await page.locator("[data-lesson-player-v2]").waitFor();',
  'const response = await page.goto(`${BASE}/lab-review/v4-lessons/${sel(key)}`, { waitUntil: "domcontentloaded" });\n      record.status = response.status();\n      await page.locator("[data-lesson-player-v2]").waitFor();');
// Geometry at six widths; the others at desktop.
swap('key === "g7-math-area-perimeter" ? [[1440, 900], [390, 844]] : [[1440, 900]]', 'key === "g7-math-area-perimeter" ? [[1440, 900], [360, 780], [390, 844], [768, 1024], [1024, 768], [1920, 1080]] : [[1440, 900]]');
swap("record.scenes.push({ id: scene.id,", "record.scenes.push({ overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), id: scene.id,");
// FREE_RESPONSE scene prompts (factory scenes) must be filled before Continue.
swap("const shot = `${out}/shots/", `if (scene.interaction?.kind === "FREE_RESPONSE") for (const prompt of scene.interaction.prompts) await page.locator('[id="reflect-' + prompt.id + '"]').fill("Synthetic QA input: I compared the labelled diagram with my working and checked it a second way.");\n        const shot = \`\${out}/shots/`);
swap("`The story says ${quote} and more.`", "`The story says ${quote}. ${wordsText(field.minWords + 2, i)}. Synthetic QA input.`");
// Sections 2/3 of T1's driver address fixture scene ids and the Vite URL; replace them with a gallery audit.
const s2 = d.indexOf("  // 2. Responsive layout"), fin = d.indexOf("} finally {", s2);
if (s2 < 0 || fin < 0) throw Error("driver_sections_missing");
d = d.slice(0, s2) + `  // 2. Gallery on the real route: labels, sections, selectable entries, at phone and desktop.
  for (const [width, height] of [[390, 844], [1440, 900]]) {
    const { context, page } = await newPage(width, height);
    const response = await page.goto(\`\${BASE}/lab-review/v4-lessons\`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});
    const text = (await page.locator("main, body").first().innerText()).replace(/\\s+/g, " ");
    const links = await page.locator('a[href*="/lab-review/v4-lessons/"]').evaluateAll((as) => as.map((a) => decodeURIComponent(a.getAttribute("href"))));
    await page.screenshot({ path: \`\${out}/shots/gallery-\${width}.png\`, fullPage: true });
    evidence.gallery = evidence.gallery ?? [];
    evidence.gallery.push({ width, status: response.status(), factoryLabel: /Factory-generated/i.test(text), fixtureLabel: /Hand-authored reference fixture/i.test(text), mentionsVersion: text.includes(${JSON.stringify(version)}), links, overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), axe: width === 1440 ? await axe(page, "gallery") : null });
    await context.close();
  }
  // 3. Rejections: unknown, version-less and traversal selections must not render a lesson.
  { const { context, page } = await newPage(1440, 900);
    evidence.rejections = [];
    for (const bad of ["factory@latest@g7-math-area-perimeter", "factory@4.0.0-draft.99@g7-math-area-perimeter", "factory@${version}@../g7-math-area-perimeter", "factory@${version}@unknown"]) {
      const r = await page.goto(\`\${BASE}/lab-review/v4-lessons/\${encodeURIComponent(bad)}\`, { waitUntil: "domcontentloaded" });
      evidence.rejections.push({ selection: bad, status: r.status(), playerRendered: await page.locator("[data-lesson-player-v2]").count() > 0 });
    }
    await context.close(); }
` + d.slice(fin);
swap("await server.close();", "await server.close();");
swap("console.log(JSON.stringify({ lessons:", "console.log(JSON.stringify({ hosts: evidence.hosts, payloadCanaryHits: evidence.payload.filter((p) => p.canaryHits.length || p.nonEmptyGovernedItems).length, gallery: evidence.gallery?.map((g) => ({ width: g.width, status: g.status, factoryLabel: g.factoryLabel, fixtureLabel: g.fixtureLabel, links: g.links.length })), rejections: evidence.rejections, lessons:");
d = d.replace(", overflow: evidence.responsive.filter((row) => row.seeIt.horizontalOverflow || row.solve.horizontalOverflow).map((row) => row.width) }", ", overflow: Object.entries(evidence.lessons).filter(([, r]) => r.scenes.some((s) => s.overflow)).map(([k]) => k) }");
d = d.replace('process.env.HARNESS_PORT = "3203";', 'process.env.HARNESS_PORT = "3216";').replace(".vite-learning-v4", ".vite-cos-v4-next");
if (!reference) d = d.replace("const keys = quick ? [\"g7-math-area-perimeter\"] : Object.keys(lessons);", "const keys = quick ? [\"g7-math-area-perimeter\"] : Object.keys(lessons);");
fs.writeFileSync(`${out}/driver.mjs`, d);

// --- Server with database isolation -------------------------------------------------------------------------------
const secret = crypto.randomBytes(32).toString("hex");
// The root layout's ConsentGate reads DataPolicyAcceptance for any signed-in user, so a throwaway local Postgres
// (docker container cos-v4-qa-pg, one table, one synthetic consent row, log_statement=all) answers it; the statement
// log is the evidence of every query the review made. Without it, every other database variable stays unreachable.
const dead = process.env.COS_QA_DATABASE_URL ?? "postgresql://cos:cos@127.0.0.1:9/cos_unreachable?connect_timeout=1";
const env = { ...process.env, NODE_ENV: "development", LAB_REVIEW_HARNESS: "1", NEXTAUTH_SECRET: secret, NEXTAUTH_URL: `http://127.0.0.1:${PORT}`,
  DATABASE_URL: dead, DIRECT_URL: dead, POSTGRES_URL: dead, POSTGRES_PRISMA_URL: dead, POSTGRES_URL_NON_POOLING: dead,
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:9", SUPABASE_URL: "http://127.0.0.1:9", SUPABASE_SERVICE_ROLE_KEY: "cos-invalid", NEXT_PUBLIC_SUPABASE_ANON_KEY: "cos-invalid",
  VERCEL: "", NEXT_TELEMETRY_DISABLED: "1" };
delete env.VERCEL;
const { encode } = require("next-auth/jwt");
(async () => {
  const token = await encode({ secret, token: { id: "cos-qa-reviewer", role: "MOE_OFFICIAL", name: "CoS QA reviewer", isPlatformAdmin: false, schoolId: null } });
  const log = fs.openSync(`${out}/next-dev.log`, "w");
  const server = cp.spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "-p", String(PORT), "-H", "127.0.0.1"], { env, stdio: ["ignore", log, log] });
  try {
    for (let i = 0; ; i++) { try { const r = await fetch(`http://127.0.0.1:${PORT}/lab-review/v4-lessons`, { headers: { cookie: `next-auth.session-token=${token}` } }); if (r.status) break; } catch {} if (i > 400) throw Error("next_dev_not_ready"); await new Promise((r) => setTimeout(r, 1500)); }
    const noCookie = await fetch(`http://127.0.0.1:${PORT}/lab-review/v4-lessons`, { redirect: "manual" });
    fs.writeFileSync(`${out}/gate.json`, JSON.stringify({ withoutSession: noCookie.status }, null, 2));
    const run = cp.spawnSync(process.execPath, [`${out}/driver.mjs`, ...(process.argv.includes("--quick") ? ["--quick"] : [])], { stdio: "inherit", env: { ...process.env, COS_SESSION_TOKEN: token } });
    process.exitCode = run.status ?? 1;
  } finally {
    server.kill();
    cp.spawnSync("taskkill", ["/pid", String(server.pid), "/t", "/f"], { stdio: "ignore" });
    const devLog = fs.readFileSync(`${out}/next-dev.log`, "utf8");
    let statements = [];
    if (process.env.COS_QA_DATABASE_URL) {
      const pgLog = cp.spawnSync("docker", ["logs", "cos-v4-qa-pg"], { encoding: "utf8" });
      statements = `${pgLog.stdout}${pgLog.stderr}`.split("\n").filter((l) => / (statement|execute [^:]*):/.test(l)).map((l) => l.replace(/^.* (statement|execute [^:]*):\s*/, "").trim());
    }
    const writes = statements.filter((s) => /^(insert|update|delete|create|alter|drop|truncate)\b/i.test(s) && !s.includes("cos-qa-consent") && !/^alter system/i.test(s));
    fs.writeFileSync(`${out}/db-audit.json`, JSON.stringify({ databaseUrl: new URL(dead).host + " (local throwaway or unreachable; never production)", prismaErrors: (devLog.match(/PrismaClientInitializationError|P1001|Can't reach database/g) ?? []).length, supabaseRefs: (devLog.match(/supabase\.co/g) ?? []).length, statementsLogged: statements.length, distinctStatements: [...new Set(statements.map((s) => s.slice(0, 160)))], writeStatements: writes }, null, 2));
  }
})();
