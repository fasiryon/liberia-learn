#!/usr/bin/env node
/**
 * Regression test for the programOrderId binding contract (CoS).
 *
 *   node scripts/cos-stem/test-intake.cjs <a clean sealed package dir, e.g. drafts/4.0.0-draft.6/g7-math-fractions>
 *
 * Builds properly re-sealed fixture batches from a copy of a real package, runs intake-batch.cjs against a
 * temporary copy of the program directory (COS_STEM_PROGRAM), and checks that a valid batch registers and
 * every contract violation is refused for the right reason. Never writes to the real program or factory output.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const { canonicalizeJson, sha256 } = require("./lib/package-integrity.cjs");

const ROOT = path.resolve(__dirname, "../..");
const source = process.argv[2];
if (!source || !fs.existsSync(path.join(source, "manifest.json"))) { console.error("usage: test-intake.cjs <sealed package dir>"); process.exit(2); }
const tmp = fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR ? path.join(process.env.CLAUDE_JOB_DIR, "tmp") : os.tmpdir(), "cos-intake-"));
const program = path.join(tmp, "program");
fs.cpSync(path.join(ROOT, "curriculum/program/stem-v1"), program, { recursive: true });

/** Copy the source package as `key`, apply manifest/file edits, and re-seal it the way the factory does. */
function fixture(version, key, { manifest = {}, candidateEdit = null, reseal = true } = {}) {
  const dir = path.join(tmp, "batches", version);
  const pkg = path.join(dir, key);
  fs.cpSync(source, pkg, { recursive: true });
  const m = JSON.parse(fs.readFileSync(path.join(pkg, "manifest.json"), "utf8"));
  if (candidateEdit) {
    const file = path.join(pkg, "candidate.json");
    fs.writeFileSync(file, candidateEdit(fs.readFileSync(file, "utf8")));
    if (reseal) m.files["candidate.json"] = sha256(fs.readFileSync(file));
  }
  Object.assign(m, { key, candidateVersion: version, lessonId: `test-${key}` }, manifest);
  const { packageHash: _old, ...body } = m;
  m.packageHash = sha256(canonicalizeJson({ domain: m.manifestVersion, value: body }));
  fs.writeFileSync(path.join(pkg, "manifest.json"), JSON.stringify(m, null, 2));
  fs.writeFileSync(path.join(dir, "generation-receipt.json"), JSON.stringify({ version, published: false, packages: [{ key, packageHash: m.packageHash, candidateSha256: m.candidateSha256 }] }));
  return dir;
}

function intake(dir, extra = []) {
  try {
    const out = execFileSync(process.execPath, [path.join(__dirname, "intake-batch.cjs"), dir, "--commit", "abcdef1", "--branch", "test/intake", "--validation", "TEST", ...extra], { env: { ...process.env, COS_STEM_PROGRAM: program }, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { ok: true, out };
  } catch (e) { return { ok: false, out: String(e.stderr) }; }
}

const cases = [
  ["end-of-day activity registers without a course subject", () => fixture("9.9.9-e.1", "g8-eod", { manifest: { programOrderId: "GO-G08-EOD", grade: 8, subject: "ENGLISH" } }), true, /registered/],
  ["held trial registers", () => fixture("9.9.9-s.1", "g8-sci-trial", { manifest: { programOrderId: "GO-G08-P2-SCIENCE-U1", grade: 8, subject: "SCIENCE" } }), true, /registered/, ["--hold", "trial"]],
  ["corrected package without supersedesPackage is refused", () => fixture("9.9.9-s.2", "g8-sci-fixed", { manifest: { programOrderId: "GO-G08-P2-SCIENCE-U1", grade: 8, subject: "SCIENCE" } }), false, /must name it in manifest.supersedesPackage/],
  ["supersedesPackage naming the wrong package is refused", () => fixture("9.9.9-s.3", "g8-sci-fixed", { manifest: { programOrderId: "GO-G08-P2-SCIENCE-U1", grade: 8, subject: "SCIENCE", supersedesPackage: "9.9.9-s.1@nope" } }), false, /not the current holder/],
  ["explicit supersession of a held package registers", () => fixture("9.9.9-s.4", "g8-sci-fixed", { manifest: { programOrderId: "GO-G08-P2-SCIENCE-U1", grade: 8, subject: "SCIENCE", supersedesPackage: "9.9.9-s.1@g8-sci-trial" } }), true, /registered/],
  ["superseding a package that is neither held nor G3_REVISE is refused", () => fixture("9.9.9-s.5", "g8-sci-again", { manifest: { programOrderId: "GO-G08-P2-SCIENCE-U1", grade: 8, subject: "SCIENCE", supersedesPackage: "9.9.9-s.4@g8-sci-fixed" } }), false, /neither held by T2 nor G3_REVISE/],
  ["valid lesson batch registers", () => fixture("9.9.9-t.1", "g8-math-test", { manifest: { programOrderId: "GO-G08-P1-MATH-U1", grade: 8, subject: "MATH" } }), true, /registered/],
  ["idempotent re-intake of the same sealed batch", () => path.join(tmp, "batches", "9.9.9-t.1"), true, /registered/],
  ["missing programOrderId", () => fixture("9.9.9-t.2", "g8-x", { manifest: { grade: 8 } }), false, /no programOrderId/],
  ["order is not a program order", () => fixture("9.9.9-t.3", "g8-x", { manifest: { programOrderId: "GO-NOPE", grade: 8 } }), false, /not a program order/],
  ["grade differs from the order", () => fixture("9.9.9-t.4", "g8-x", { manifest: { programOrderId: "GO-G08-P2-SCIENCE-U1", grade: 9, subject: "SCIENCE" } }), false, /grade/],
  ["Computing recorded as SCIENCE", () => fixture("9.9.9-t.5", "g8-x", { manifest: { programOrderId: "GO-G08-P5-COMPUTING-U1", grade: 8, subject: "SCIENCE" } }), false, /subject SCIENCE does not match COMPUTING/],
  ["order already fulfilled by another version", () => fixture("9.9.9-t.6", "g8-other", { manifest: { programOrderId: "GO-G08-P1-MATH-U1", grade: 8, subject: "MATH" } }), false, /already fulfilled/],
  ["file bytes changed after sealing", () => fixture("9.9.9-t.7", "g8-x", { manifest: { programOrderId: "GO-G08-P3-ENGLISH-U1", grade: 8, subject: "ENGLISH" }, candidateEdit: (t) => t.replace(/"title": "/, '"title": "X'), reseal: false }), false, /bytes do not match/],
  ["mis-decoded text, even when re-sealed", () => fixture("9.9.9-t.8", "g8-x", { manifest: { programOrderId: "GO-G08-P3-ENGLISH-U1", grade: 8, subject: "ENGLISH" }, candidateEdit: (t) => t.replace(/"title": "/, '"title": "â€” ') }), false, /mis-decoded/],
  ["manifest packageHash forged", () => { const d = fixture("9.9.9-t.9", "g8-x", { manifest: { programOrderId: "GO-G08-P3-ENGLISH-U1", grade: 8, subject: "ENGLISH" } }); const f = path.join(d, "g8-x", "manifest.json"); const m = JSON.parse(fs.readFileSync(f, "utf8")); m.packageHash = "0".repeat(64); fs.writeFileSync(f, JSON.stringify(m)); return d; }, false, /does not recompute|differ from the sealed receipt/],
];

let failures = 0;
for (const [name, make, expectOk, pattern, extra] of cases) {
  const r = intake(make(), extra);
  const pass = r.ok === expectOk && pattern.test(r.out);
  if (!pass) failures += 1;
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${pass ? "" : `\n      got ok=${r.ok}: ${r.out.trim().split("\n")[0]}`}`);
}
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`${cases.length - failures}/${cases.length} intake contract cases pass`);
process.exit(failures ? 1 : 0);
