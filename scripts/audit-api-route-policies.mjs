import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

export const LEGACY_BASE = "84dd5417a9b6485821c5eeecf48a3322f58c1b79";
const DIRECTIVE = /route-policy:\s*auth=([^;\s]+);\s*scope=([^;\s]+);\s*authority=([^;]+);\s*rationale=(.+)$/m;
const AUTH = new Set(["session", "provider", "cron", "public"]);
const SCOPE = new Set(["tenant", "record", "platform", "national", "none"]);

export function auditRouteSource(source, path = "fixture/route.ts") {
  const match = source.match(DIRECTIVE);
  if (!match) return [`${path}: missing route-policy declaration`];
  const [, auth, scope, authorityRaw, rationaleRaw] = match;
  const authority = authorityRaw.trim();
  const rationale = rationaleRaw.trim();
  const errors = [];
  if (!AUTH.has(auth)) errors.push(`${path}: invalid auth declaration`);
  if (!SCOPE.has(scope)) errors.push(`${path}: invalid scope declaration`);
  if (!authority || !rationale) errors.push(`${path}: authority and rationale are required`);
  if (auth === "session" && scope === "none") errors.push(`${path}: session auth requires explicit tenant/record/platform/national scope`);
  if (auth !== "session" && scope !== "none") errors.push(`${path}: public/provider/cron routes must declare scope=none`);
  if (scope === "national" && authority !== "elevated") errors.push(`${path}: national scope requires authority=elevated`);
  return errors;
}

function walk(directory) {
  const files = [];
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) files.push(...walk(path));
    else if (/route\.[cm]?[jt]s$/.test(name)) files.push(relative(process.cwd(), path).replaceAll("\\", "/"));
  }
  return files;
}

function git(args) {
  try { return execFileSync("git", args, { encoding: "utf8" }).trim().split(/\r?\n/).filter(Boolean); }
  catch { return []; }
}

export function changedApiRoutes() {
  const committed = git(["diff", "--name-only", "--diff-filter=AMR", `${LEGACY_BASE}...HEAD`]);
  const working = git(["diff", "--name-only", "--diff-filter=AMR"]);
  const staged = git(["diff", "--cached", "--name-only", "--diff-filter=AMR"]);
  const untracked = git(["ls-files", "--others", "--exclude-standard"]);
  return [...new Set([...committed, ...working, ...staged, ...untracked])]
    .map((path) => path.replaceAll("\\", "/"))
    .filter((path) => /^app\/api\/.+\/route\.[cm]?[jt]s$/.test(path) && existsSync(path));
}

export function auditChangedRoutes() {
  const routes = changedApiRoutes();
  return routes.flatMap((path) => auditRouteSource(readFileSync(path, "utf8"), path));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const allRoutes = walk("app/api");
  const changed = changedApiRoutes();
  const errors = auditChangedRoutes();
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exit(1);
  }
  console.log(`API route policy audit PASS: ${changed.length} changed routes declared; ${allRoutes.length - changed.length} legacy routes frozen at ${LEGACY_BASE.slice(0, 8)}.`);
}
