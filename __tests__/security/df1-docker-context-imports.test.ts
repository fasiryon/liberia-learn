// DF-1: the web image's `next build` runs inside the Docker build context, so no runtime module may
// import a file that .dockerignore excludes. Found 2026-11-13 by the SEC-27 container gate: an excluded
// docs/ JSON imported by lib/learner-experience/candidateReview.ts made `docker build --target runner` fail.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..", "..");
const RUNTIME_DIRS = ["app", "lib", "components", "hooks"];
const SOURCE = /\.(ts|tsx|js|jsx|mjs)$/;

type Rule = { negate: boolean; re: RegExp };

// Minimal .dockerignore semantics: ordered rules, last match wins, "!" re-includes,
// "**" any depth, "*" within a segment; a pattern also matches everything under a matched directory.
export function parseDockerignore(text: string): Rule[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((line) => {
      const negate = line.startsWith("!");
      const pat = (negate ? line.slice(1) : line).replace(/^\/+/, "").replace(/\/+$/, "");
      const body = pat
        .split("/")
        .map((seg) => (seg === "**" ? "(?:.*)" : seg.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*").replace(/\?/g, "[^/]")))
        .join("/")
        .replace(/\(\?:\.\*\)\//g, "(?:.*/)?");
      return { negate, re: new RegExp(`^${body}(?:/.*)?$`) };
    });
}

export function isExcluded(rules: Rule[], file: string): boolean {
  let excluded = false;
  for (const r of rules) if (r.re.test(file)) excluded = !r.negate;
  return excluded;
}

function walk(dir: string, out: string[]) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name.startsWith(".")) continue;
      walk(p, out);
    } else if (SOURCE.test(e.name) && !/\.test\./.test(e.name)) out.push(p);
  }
}

function runtimeImportsOfRepoFiles(): { from: string; target: string }[] {
  const files: string[] = [];
  for (const d of RUNTIME_DIRS) if (fs.existsSync(path.join(ROOT, d))) walk(path.join(ROOT, d), files);
  const found: { from: string; target: string }[] = [];
  const spec = /(?:from\s*|import\(\s*|require\(\s*)["']([^"']+)["']/g;
  for (const f of files) {
    const src = fs.readFileSync(f, "utf8");
    for (const m of src.matchAll(spec)) {
      const s = m[1];
      let abs: string | null = null;
      if (s.startsWith("@/")) abs = path.join(ROOT, s.slice(2));
      else if (s.startsWith(".")) abs = path.resolve(path.dirname(f), s);
      if (!abs) continue;
      const cands = [abs, ...[".ts", ".tsx", ".js", ".jsx", ".mjs", ".json", "/index.ts", "/index.tsx", "/index.js"].map((e) => abs + e)];
      const hit = cands.find((c) => fs.existsSync(c) && fs.statSync(c).isFile());
      if (hit) found.push({ from: path.relative(ROOT, f).split(path.sep).join("/"), target: path.relative(ROOT, hit).split(path.sep).join("/") });
    }
  }
  return found;
}

describe("DF-1: runtime imports stay inside the Docker build context", () => {
  const rules = parseDockerignore(fs.readFileSync(path.join(ROOT, ".dockerignore"), "utf8"));

  it("matcher controls: docs and env files excluded, a re-included path is kept, app code kept", () => {
    const r = parseDockerignore("docs\n**/.env*\n!docs/keep/one.json\n");
    expect(isExcluded(r, "docs/a/b.json")).toBe(true);
    expect(isExcluded(r, "nested/dir/.env.local")).toBe(true);
    expect(isExcluded(r, "docs/keep/one.json")).toBe(false);
    expect(isExcluded(r, "lib/db.ts")).toBe(false);
  });

  it("the repository .dockerignore still excludes secrets, worktrees and general docs", () => {
    for (const f of [".env", "app/.env.local", ".aws/credentials", ".task-worktrees/x/a.ts", "docs/README.md"]) {
      expect(isExcluded(rules, f), f).toBe(true);
    }
  });

  it("no app/lib/components/hooks module imports an excluded file", () => {
    const offenders = runtimeImportsOfRepoFiles().filter((i) => isExcluded(rules, i.target));
    expect(offenders).toEqual([]);
  });
});
