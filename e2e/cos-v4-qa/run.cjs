// Chief of Staff independent V4 integration QA. Plays the exact Content Factory V4 packages in Lesson Player V2
// through T1's interaction driver, adapted at run time (no frontend- or factory-owned file is edited).
// Differences from the T1/T2 harnesses: each experience is rebuilt from the package's candidate.json through the
// frontend's own projection (v4LearnerProjection) and must equal the package's learner-projection.json; the
// geometry lesson is played end to end at six widths with layout metrics; protected-answer and request audits.
// Usage: node e2e/cos-v4-qa/run.cjs   (port 3211; writes artifacts/cos-v4/browser)
const fs = require("fs"), path = require("path"), cp = require("child_process");
const root = "curriculum/factory-v4/drafts/4.0.0-draft.4";
const out = "artifacts/cos-v4/browser";
let d = fs.readFileSync("e2e/learning-v4/run.mjs", "utf8").replace(/\r\n/g, "\n");
const swap = (a, b) => { if (!d.includes(a)) throw Error("anchor_missing: " + a.slice(0, 60)); d = d.replace(a, b); };
swap('const out = "artifacts/learning-v4/browser";', `const out = ${JSON.stringify(out)};`);
d = d.replaceAll("3203", "3211").replace(".vite-learning-v4", ".vite-cos-v4-qa");
swap('const lessons = Object.fromEntries(v4.V4_LESSONS.map((lesson) => [lesson.key, { lesson, experience: v4.v4LearnerProjection(lesson) }]));', `
const parse = await server.ssrLoadModule(\`\${root}/lib/curriculum/v2/parse.ts\`);
const canon = (v) => JSON.stringify(v, (k, x) => x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map((key) => [key, x[key]])) : x);
const projectionCheck = {};
const lessons = Object.fromEntries(await Promise.all(v4.V4_LESSONS.map(async (lesson) => {
  const dir = ${JSON.stringify(root)} + "/" + lesson.key;
  const candidate = parse.parseCandidateLessonV2(await fs.readFile(dir + "/candidate.json", "utf8"));
  const experience = v4.v4LearnerProjection(lesson, candidate);
  const shipped = JSON.parse(await fs.readFile(dir + "/learner-projection.json", "utf8"));
  projectionCheck[lesson.key] = { equalsShippedProjection: canon(experience) === canon(shipped), title: experience.title ?? candidate.title, scenes: experience.scenes.length };
  return [lesson.key, { lesson, experience }];
})));`);
// Factory scenes may carry scene-level free-response prompts (the T1 fixtures had none).
swap("const shot = `${out}/shots/", `if (scene.interaction?.kind === "FREE_RESPONSE") for (const prompt of scene.interaction.prompts) await page.locator('[id="reflect-' + prompt.id + '"]').fill("Synthetic QA input: I compared the labelled diagram with my working and checked it a second way.");\n        const shot = \`\${out}/shots/`);
swap("record.scenes.push({ id: scene.id,", "record.scenes.push({ layout: await metrics(page), focus: await focusAudit(page), id: scene.id,");
swap("`The story says ${quote} and more.`", "`The story says ${quote}. ${wordsText(field.minWords + 2, i)}. Synthetic QA input.`");
// Geometry at every width (phone, tablet, laptop, desktop); the other five at desktop 1440.
swap('key === "g7-math-area-perimeter" ? [[1440, 900], [390, 844]] : [[1440, 900]]', 'key === "g7-math-area-perimeter" ? [[1440, 900], [360, 780], [390, 844], [768, 1024], [1024, 768], [1920, 1080]] : [[1440, 900]]');
// Every interactive control in the player is keyboard-focusable and has an accessible name.
swap("try {\n  // 1.", `const focusAudit = (page) => page.evaluate(() => {
  const scope = document.querySelector("[data-lesson-player-v2]") ?? document.body;
  const controls = [...scope.querySelectorAll("button, input, select, textarea, [role=button], [role=slider], [tabindex]")].filter((el) => el.getClientRects().length);
  const unnamed = controls.filter((el) => !(el.getAttribute("aria-label") || el.getAttribute("aria-labelledby") || el.labels?.length || el.innerText.trim() || el.getAttribute("title")));
  const unfocusable = controls.filter((el) => el.tabIndex < 0 && !el.disabled && el.getAttribute("aria-hidden") !== "true");
  return { controls: controls.length, unnamed: unnamed.map((el) => el.outerHTML.slice(0, 120)), unfocusable: unfocusable.map((el) => el.outerHTML.slice(0, 120)) };
});
const served = [];
try {
  // 1.`);
swap("page.on(\"request\", (request) => {", "page.on(\"request\", (request) => { served.push(new URL(request.url()).pathname); ");
// T1's sections 2 and 3 address fixture scene ids; responsive coverage is in section 1 above.
const s2 = d.indexOf("  // 2. Responsive layout"), fin = d.indexOf("} finally {", s2);
if (s2 < 0 || fin < 0) throw Error("driver_sections_missing");
d = d.slice(0, s2) + d.slice(fin);
swap("await fs.writeFile(`${out}/evidence.json`, JSON.stringify(evidence, null, 2));", "evidence.projectionCheck = projectionCheck; evidence.requests = [...new Set(served)].filter((p) => !p.startsWith('/@') && !p.startsWith('/node_modules/')); await fs.writeFile(`${out}/evidence.json`, JSON.stringify(evidence, null, 2));");
fs.mkdirSync(out + "/shots", { recursive: true });
fs.writeFileSync("artifacts/cos-v4/qa-browser.mjs", d);
const run = cp.spawnSync(process.execPath, ["artifacts/cos-v4/qa-browser.mjs"], { stdio: "inherit" });
process.exit(run.status ?? 1);
