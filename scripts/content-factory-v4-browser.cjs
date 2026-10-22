// Reuse T1's interaction driver against exact factory output, without editing frontend-owned files.
const fs = require("fs"), path = require("path"), crypto = require("crypto"), cp = require("child_process");
const source = "e2e/learning-v4/run.mjs";
let driver = fs.readFileSync(source, "utf8").replace(/\r\n/g, "\n");
const sha = value => crypto.createHash("sha256").update(value).digest("hex");
// Structural anchors below fail closed if the reviewed interaction driver changes. Record its hash as evidence, rather than pinning an obsolete frontend commit.
const version = process.argv.find(arg => arg.startsWith("--candidate-version="))?.split("=")[1] ?? "4.0.0-draft.4";
if (!["4.0.0-draft.4", "4.0.0-draft.5"].includes(version)) throw Error("unsupported_candidate_version");
const root = `curriculum/factory-v4/drafts/${version}`;
const out = `artifacts/content-factory-v4/browser/${version}`;
const receiptKeys = JSON.parse(fs.readFileSync(`${root}/generation-receipt.json`, "utf8")).candidates.map(c => c.key);
const replace = (before, after) => { if (!driver.includes(before)) throw Error("driver_adapter_anchor_missing"); driver = driver.replace(before, after); };
replace('const out = "artifacts/learning-v4/browser";', `const out = ${JSON.stringify(out)};`);
driver = driver.replaceAll("3203", "3209").replace(".vite-learning-v4", ".vite-content-factory-v4");
replace('page.setDefaultTimeout(30000);', 'page.setDefaultTimeout(60000); page.setDefaultNavigationTimeout(120000);');
replace('const lessons = Object.fromEntries(v4.V4_LESSONS.map((lesson) => [lesson.key, { lesson, experience: v4.v4LearnerProjection(lesson) }]));',
  `const factoryModule = await server.ssrLoadModule(\`\${root}/lib/curriculum/v4/factoryReview.ts\`);
const lessons = Object.fromEntries(${JSON.stringify(receiptKeys)}.map(key => {
  const lesson = v4.V4_LESSONS.find(l => l.key === key);
  return [key, { lesson, experience: factoryModule.loadFactoryReview("factory@" + ${JSON.stringify(version)} + "@" + key).experience }];
}));`);
// The original driver was for reference fixtures with no scene-level free-response tasks.
replace('const shot = `${out}/shots/', `if (scene.interaction.kind === "FREE_RESPONSE") for (const prompt of scene.interaction.prompts) await page.locator('[id="reflect-' + prompt.id + '"]').fill("I compared the labelled representation with the evidence and checked a second explanation. This is synthetic browser test input, never learner evidence.");\n        const shot = \x60\x24{out}/shots/`);
replace('record.scenes.push({ id: scene.id,', 'record.scenes.push({ layout: await metrics(page), id: scene.id,');
replace('`The story says ${quote} and more.`', '`The story says ${quote}. ${wordsText(field.minWords + 2, i)}. This is synthetic browser input, not academic evidence.`');
// Responsive scene-id fixtures belong to T1. This run visits generated scenes, including phone geometry.
const section = driver.indexOf("  // 2. Responsive layout"), finalizer = driver.indexOf("} finally {", section);
if (section < 0 || finalizer < 0) throw Error("driver_sections_missing");
driver = driver.slice(0, section) + driver.slice(finalizer);
fs.mkdirSync(out, { recursive: true });
const adapted = `artifacts/content-factory-v4/generated-browser-${version}.mjs`;
fs.writeFileSync(adapted, driver);
const run = cp.spawnSync(process.execPath, [adapted], { stdio: "inherit", env: process.env });
if (run.error) throw run.error;
if (run.status !== 0) process.exit(run.status ?? 1);
const evidence = JSON.parse(fs.readFileSync(path.join(out, "evidence.json"), "utf8"));
const lessons = Object.entries(evidence.lessons);
const issues = lessons.flatMap(([key, record]) => !record.finished || record.scenes.some(s => !s.completed || s.rawTexVisible || s.layout?.horizontalOverflow || s.notes.some(n => n.error)) ? [key] : []);
const axeViolations = Object.values(evidence.axe).reduce((sum, result) => sum + result.violations.length, 0);
const manifestPins = [...new Set(lessons.map(([key]) => key.split("@")[0]))].map(key => ({ key, manifestSha256: sha(fs.readFileSync(`${root}/${key}/manifest.json`)), learnerProjectionSha256: sha(fs.readFileSync(`${root}/${key}/learner-projection.json`)) }));
const receipt = { candidateVersion: version, sourceDriverSha256: sha(fs.readFileSync(source, "utf8").replace(/\r\n/g, "\n")), manifests: manifestPins,
  runs: lessons.length, completed: lessons.filter(([, record]) => record.finished).length, scenes: lessons.reduce((sum, [, r]) => sum + r.scenes.length, 0),
  axeViolations, axeIncomplete: Object.values(evidence.axe).reduce((sum, r) => sum + r.incomplete, 0), pageErrors: evidence.errors, writes: evidence.writes, issues };
fs.writeFileSync(path.join(out, "receipt.json"), JSON.stringify(receipt, null, 2) + "\n");
console.log(JSON.stringify(receipt, null, 2));
if (issues.length || axeViolations || evidence.errors.length || evidence.writes.length || lessons.length !== receiptKeys.length + (receiptKeys.includes("g7-math-area-perimeter") ? 1 : 0)) process.exitCode = 1;
