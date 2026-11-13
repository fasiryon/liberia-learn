#!/usr/bin/env node
/**
 * Register a sealed Content Factory batch with the program (CoS).
 *
 *   node scripts/cos-stem/intake-batch.cjs <drafts/<version> dir> --commit <sha> --branch <name> \
 *        --validation "<record path and result>" [--hold "<reason>"]
 *
 * Read-only on the factory output. For every package in the batch's generation receipt it checks that the
 * manifest's packageHash and candidateSha256 equal the receipt's, that the manifest names the program
 * generation order it fulfils (`programOrderId`), and that the order exists in
 * curriculum/program/stem-v1/generation-backlog.json for the same grade. It then writes
 * curriculum/program/stem-v1/source/batches/<version>.json. A batch already registered is immutable: re-intake
 * with any different hash is refused. After intake, run g3-audit.cjs on the batch, then build-program.cjs;
 * matching gaps are bound automatically.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "../..");
// COS_STEM_PROGRAM points intake at a temporary copy of the program (used only by test-intake.cjs).
const PROGRAM = process.env.COS_STEM_PROGRAM ? path.resolve(process.env.COS_STEM_PROGRAM) : path.join(ROOT, "curriculum/program/stem-v1");
const args = process.argv.slice(2);
const dir = args[0];
const opt = (name) => { const i = args.indexOf(`--${name}`); return i > 0 ? args[i + 1] : null; };
const die = (msg) => { console.error(`REFUSED: ${msg}`); process.exit(1); };

if (!dir || !opt("commit") || !opt("branch") || !opt("validation")) die("usage: intake-batch.cjs <dir> --commit <sha> --branch <name> --validation <record> [--hold <reason>]");
if (!/^[0-9a-f]{7,40}$/.test(opt("commit"))) die("commit must be a git SHA");
const receipt = JSON.parse(fs.readFileSync(path.join(dir, "generation-receipt.json"), "utf8"));
const version = receipt.version;
if (!/^[0-9]+\.[0-9]+\.[0-9]+-[a-z0-9.-]+$/.test(version)) die(`unexpected version ${version}`);
if (receipt.published || receipt.released || receipt.activated || receipt.previewEnabled) die("receipt claims publication, release, activation or preview; a sealed review batch must not");

const backlog = JSON.parse(fs.readFileSync(path.join(PROGRAM, "generation-backlog.json"), "utf8")).orders;
const extraOrders = JSON.parse(fs.readFileSync(path.join(PROGRAM, "production-orders.json"), "utf8")).orders;
const { verifyPackage } = require("./lib/package-integrity.cjs");
const { COURSE_FAMILY } = require(path.join(PROGRAM, "source/standards.cjs"));
const { loadPackages } = require("./lib/pins.cjs");
const pinned = loadPackages(PROGRAM).filter((p) => p.version !== version);
const packages = [];
const lessonIds = new Set();
for (const r of receipt.packages) {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(r.key)) die(`${r.key}: package key is not a plain lowercase identifier`);
  // Immutable hash: recompute packageHash and every file digest from the bytes; text must be clean UTF-8.
  const v = verifyPackage(path.join(dir, r.key));
  if (!v.ok) die(`${r.key}: integrity failed: ${v.errors.slice(0, 3).join("; ")}`);
  const m = v.manifest;
  const c = JSON.parse(fs.readFileSync(path.join(dir, r.key, "candidate.json"), "utf8"));
  if (m.packageHash !== r.packageHash || m.candidateSha256 !== r.candidateSha256) die(`${r.key}: manifest hashes differ from the sealed receipt`);
  if (m.published || m.released || m.approved === true) die(`${r.key}: manifest claims approval or release`);
  // Lesson identity: key, lesson id and version are the receipt's, and nothing already pinned reuses them.
  if (m.key !== r.key) die(`${r.key}: manifest key ${m.key} differs from the receipt`);
  if (m.candidateVersion !== version) die(`${r.key}: manifest candidateVersion ${m.candidateVersion} differs from batch ${version}`);
  if (!m.lessonId || lessonIds.has(m.lessonId)) die(`${r.key}: lessonId missing or duplicated in the batch`);
  lessonIds.add(m.lessonId);
  if (pinned.some((p) => p.packageHash === r.packageHash)) die(`${r.key}: this package hash is already pinned under another version`);
  // Source order: the manifest names exactly one program order, for this grade.
  const orderId = m.programOrderId;
  if (!orderId) die(`${r.key}: manifest has no programOrderId; the batch cannot be bound to the program`);
  const order = backlog.find((o) => o.orderId === orderId) ?? extraOrders.find((o) => o.orderId === orderId);
  if (!order) die(`${r.key}: ${orderId} is not a program order`);
  if (order.grade !== m.grade) die(`${r.key}: order ${orderId} is grade ${order.grade}, package is grade ${m.grade}`);
  // Explicit supersession (CoS ruling on T2-SUPPORT-INTAKE-PREFLIGHT.md): a corrected package may replace an
  // earlier package for the same order only by naming it in manifest.supersedesPackage ("<version>@<key>"),
  // and only when that package cannot reach review (its batch is held by T2, or CoS G3 returned G3_REVISE).
  // History is kept: the earlier pin stays registered. There is no automatic latest-version fallback.
  const holders = pinned.filter((p) => p.orderId === orderId && !pinned.some((q) => q.supersedes === `${p.version}@${p.key}`));
  if (holders.length) {
    const target = m.supersedesPackage;
    if (!target) die(`${r.key}: order ${orderId} is already fulfilled by ${holders.map((p) => `${p.version}@${p.key}`).join(", ")}; a corrected package must name it in manifest.supersedesPackage`);
    const prior = holders.find((p) => `${p.version}@${p.key}` === target);
    if (!prior) die(`${r.key}: supersedesPackage ${target} is not the current holder of ${orderId}`);
    const g3File = path.join(PROGRAM, "g3-audit.json");
    const g3 = fs.existsSync(g3File) ? JSON.parse(fs.readFileSync(g3File, "utf8")).lessons.find((l) => l.version === prior.version && l.key === prior.key) : null;
    if (!prior.hold && g3?.g3 !== "G3_REVISE") die(`${r.key}: ${target} is neither held by T2 nor G3_REVISE; it cannot be superseded`);
  } else if (m.supersedesPackage) {
    die(`${r.key}: supersedesPackage ${m.supersedesPackage} names no current holder of ${orderId}`);
  }
  const course = order.courseId ? order.courseId.replace(/^stem1-(k|g\d+)-/, "").replace(/-/g, "_").toUpperCase() : null;
  // Subject: lesson orders must record the course family's subject code (Computing is never SCIENCE).
  if ((order.kind ?? "LESSON") === "LESSON") {
    const fam = COURSE_FAMILY[course];
    if (!fam) die(`${r.key}: order ${orderId} has no known course`);
    if (!fam.recordedSubjects.includes(m.subject)) die(`${r.key}: subject ${m.subject} does not match ${course} (expected ${fam.recordedSubjects.join("/")})`);
    if (order.recordedSubject && m.subject !== order.recordedSubject && !fam.recordedSubjects.includes(m.subject)) die(`${r.key}: subject differs from the order`);
  }
  packages.push({
    key: r.key, lessonId: m.lessonId, grade: m.grade, orderId, orderKind: order.kind ?? "LESSON", supersedes: m.supersedesPackage ?? null,
    course, unit: order.unit ?? null, recordedSubject: m.subject, title: c.title,
    phases: c.scenes.map((s) => s.teaching?.phase ?? s.type),
    packageHash: r.packageHash, candidateSha256: r.candidateSha256,
  });
}
const seen = new Set();
for (const p of packages) { if (seen.has(p.orderId)) die(`two packages claim order ${p.orderId}`); seen.add(p.orderId); }

const out = path.join(PROGRAM, "source/batches", `${version}.json`);
const batch = {
  source: `factory output ${path.basename(dir)} on ${opt("branch")} @${opt("commit")} (read-only intake)`,
  version, state: "SEALED", commit: opt("commit"), branch: opt("branch"),
  officialStatus: "NOT_APPROVED",
  factoryValidation: { status: "PASS", record: opt("validation"), commit: opt("commit") },
  hold: opt("hold"),
  receiptInputsSha256: receipt.inputsSha256 ?? null,
  packages,
};
if (fs.existsSync(out)) {
  const prior = JSON.parse(fs.readFileSync(out, "utf8"));
  const sig = (b) => JSON.stringify(b.packages.map((p) => [p.key, p.packageHash, p.candidateSha256]).sort());
  if (sig(prior) !== sig(batch)) die(`${version} is already registered with different packages; a sealed batch is immutable (seal a new version)`);
}
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(batch, null, 2) + "\n");
console.log(`registered ${version}: ${packages.length} package(s) → ${path.relative(ROOT, out)}`);
