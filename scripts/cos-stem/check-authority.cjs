#!/usr/bin/env node
/**
 * Planning-authority check (CoS evidence). Reads the other owners' branches read-only (git show) and reports
 * whether each retired plan is still in active use. Writes curriculum/program/stem-v1/authority-check.json.
 * It never edits another owner's branch; it reports so the owner can act.
 *
 *   node scripts/cos-stem/check-authority.cjs
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "../..");
const PROGRAM = path.join(ROOT, "curriculum/program/stem-v1");
const registry = JSON.parse(fs.readFileSync(path.join(PROGRAM, "source/planning-authority.json"), "utf8"));
const git = (...args) => { try { return execFileSync("git", args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }); } catch { return null; } };

const results = registry.retired.map((r) => {
  const [ref, pinned] = r.ref.split("@");
  const commit = (git("rev-parse", "--short=9", pinned ?? ref) ?? "").trim() || null;
  if (!commit) return { id: r.id, owner: r.owner, ref: r.ref, status: "REF_NOT_FOUND" };
  const notes = [];
  let status = "RETIRED";
  if (r.check.symbolMustBeAbsent) {
    const text = git("show", `${commit}:${r.path}`);
    if (text === null) notes.push(`${r.path} not present`);
    else {
      if (text.includes(r.check.symbolMustBeAbsent)) { status = "STILL_ACTIVE"; notes.push(`${r.check.symbolMustBeAbsent} is still defined in ${r.path}`); }
      const dayDir = git("grep", "-l", r.check.mustReference, commit, "--", "lib/learner-experience/day");
      if (!dayDir) { status = "STILL_ACTIVE"; notes.push(`lib/learner-experience/day does not read ${r.check.mustReference}`); }
    }
  }
  if (r.check.mustNotBeBindingSource) {
    const present = git("cat-file", "-e", `${commit}:${r.path}`) !== null;
    notes.push(present ? `${r.path} is present (historical evidence, kept)` : `${r.path} not present`);
    const users = git("grep", "-l", path.basename(r.path), commit, "--", "lib", "app", "components", "scripts");
    const binding = (users ?? "").split("\n").filter((l) => l && !/export-schoolday|schoolday-coverage/.test(l));
    if (binding.length) { status = "STILL_ACTIVE"; notes.push(`code still reads it: ${binding.map((l) => l.replace(`${commit}:`, "")).join(", ")}`); }
  }
  if (r.check.absentFromHead) {
    const still = git("cat-file", "-e", `HEAD:${r.check.absentFromHead}`) !== null;
    if (still) { status = "STILL_ACTIVE"; notes.push(`${r.check.absentFromHead} still in HEAD`); }
  }
  return { id: r.id, owner: r.owner, ref: r.ref, commit, status, notes };
});
const out = { generatedBy: "scripts/cos-stem/check-authority.cjs", authoritative: registry.authoritative, results };
fs.writeFileSync(path.join(PROGRAM, "authority-check.json"), JSON.stringify(out, null, 2) + "\n");
for (const r of results) console.log(`${r.status.padEnd(14)} ${r.id} (${r.owner}, ${r.ref}${r.commit ? ` @${r.commit}` : ""})${r.notes?.length ? `: ${r.notes.join("; ")}` : ""}`);
