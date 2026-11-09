#!/usr/bin/env node
/**
 * Dependency security release gate (CoS evidence). Founder decision 10: the security findings are a separate
 * release gate, and the critical findings are never dismissed without evidence.
 *
 *   node scripts/cos-stem/security-gate.cjs <git ref> [<git ref> ...]
 *
 * For each ref it extracts package.json and package-lock.json with `git show` into a temporary directory and
 * runs `npm audit --json --package-lock-only` twice (all dependencies; production only, --omit=dev). Nothing
 * is installed and the repository is not modified. Results are pinned to
 * curriculum/program/stem-v1/security/npm-audit-<ref>.json; the gate status is written to
 * curriculum/program/stem-v1/security/gate.json.
 *
 * Gate rule (CoS): PASS only when production dependencies have 0 critical findings and every production
 * high finding has a recorded disposition in security/dispositions.json (FIXED in a named commit, or
 * NOT_REACHABLE with evidence). The npm advisory database changes over time, so every snapshot records its
 * capture time and npm version; re-run before any release decision.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync, spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "../..");
const DIR = path.join(ROOT, "curriculum/program/stem-v1/security");
const refs = process.argv.slice(2);
if (!refs.length) { console.error("usage: security-gate.cjs <git ref> ..."); process.exit(2); }
fs.mkdirSync(DIR, { recursive: true });
// npm is a .cmd shim on Windows, so it runs through the shell; every command string below is a fixed constant, never input.
const run = (command, cwd) => spawnSync(command, { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, shell: true });
const npmVersion = run("npm --version").stdout.trim();

function audit(dir, prodOnly) {
  const r = run(prodOnly ? "npm audit --json --package-lock-only --omit=dev" : "npm audit --json --package-lock-only", dir);
  const j = JSON.parse(r.stdout);
  if (!j.metadata) throw new Error(`npm audit returned no metadata: ${r.stderr.slice(0, 200)}`);
  const findings = Object.values(j.vulnerabilities).map((v) => ({
    name: v.name, severity: v.severity, direct: v.isDirect, range: v.range,
    advisories: v.via.filter((x) => typeof x === "object").map((x) => ({ title: x.title, url: x.url, severity: x.severity })),
    via: v.via.filter((x) => typeof x === "string"),
    fixAvailable: v.fixAvailable === true ? true : v.fixAvailable ? { name: v.fixAvailable.name, version: v.fixAvailable.version, isSemVerMajor: v.fixAvailable.isSemVerMajor } : false,
  })).sort((a, b) => a.name.localeCompare(b.name));
  return { counts: j.metadata.vulnerabilities, dependencies: j.metadata.dependencies?.total ?? null, findings };
}

const dispositionsFile = path.join(DIR, "dispositions.json");
const dispositions = fs.existsSync(dispositionsFile) ? JSON.parse(fs.readFileSync(dispositionsFile, "utf8")).dispositions : [];
const snapshots = [];
for (const ref of refs) {
  const commit = execFileSync("git", ["rev-parse", "--short=9", ref], { cwd: ROOT, encoding: "utf8" }).trim();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cos-audit-"));
  for (const f of ["package.json", "package-lock.json"]) fs.writeFileSync(path.join(tmp, f), execFileSync("git", ["show", `${commit}:${f}`], { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 }));
  const all = audit(tmp, false);
  const production = audit(tmp, true);
  fs.rmSync(tmp, { recursive: true, force: true });
  const prodCritical = production.findings.filter((f) => f.severity === "critical");
  const prodHigh = production.findings.filter((f) => f.severity === "high");
  const undisposed = prodHigh.filter((f) => !dispositions.some((d) => d.package === f.name && d.commit === commit && ["FIXED", "NOT_REACHABLE"].includes(d.disposition) && d.evidence));
  const status = prodCritical.length === 0 && undisposed.length === 0 ? "PASS" : "OPEN";
  const snap = { ref, commit, capturedAt: new Date().toISOString(), npmVersion, command: "npm audit --json --package-lock-only [--omit=dev]", status, productionCritical: prodCritical.map((f) => f.name), productionHighWithoutDisposition: undisposed.map((f) => f.name), all, production };
  fs.writeFileSync(path.join(DIR, `npm-audit-${commit}.json`), JSON.stringify(snap, null, 2) + "\n");
  snapshots.push({ ref, commit, capturedAt: snap.capturedAt, status, allCounts: all.counts, productionCounts: production.counts, productionCritical: snap.productionCritical, productionHighWithoutDisposition: snap.productionHighWithoutDisposition, file: `security/npm-audit-${commit}.json` });
  console.log(`${ref} @${commit}: ${status} | all ${JSON.stringify(all.counts)} | production critical ${prodCritical.length}, high ${prodHigh.length} (${undisposed.length} without disposition)`);
}
const gateFile = path.join(DIR, "gate.json");
const prior = fs.existsSync(gateFile) ? JSON.parse(fs.readFileSync(gateFile, "utf8")).snapshots : [];
const merged = [...prior.filter((p) => !snapshots.some((s) => s.commit === p.commit)), ...snapshots];
fs.writeFileSync(gateFile, JSON.stringify({ generatedBy: "scripts/cos-stem/security-gate.cjs", rule: "PASS only with 0 production critical findings and a recorded FIXED/NOT_REACHABLE disposition, with evidence, for every production high finding", owner: "T2 (dependency disposition); CoS verifies", snapshots: merged }, null, 2) + "\n");
