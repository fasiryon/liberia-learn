import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// Every literal in-app portal link must resolve to a page. Dynamic links
// (template strings with ${...}) are out of scope for this static check.
const ROOTS = ["app", "components"];
const LINK = /href[=:]\s*["{`]*"?(\/(?:student|teacher|guardian|admin|moe)(?:\/[A-Za-z0-9_-]+)*)\/?["`]/g;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (name === "node_modules" || name === "api") continue;
    if (statSync(path).isDirectory()) walk(path, out);
    else if (path.endsWith(".tsx")) out.push(path);
  }
  return out;
}

function pageExists(route: string): boolean {
  const segments = route.split("/").filter(Boolean);
  // Match static segments exactly, falling back to a dynamic [param] folder.
  function resolve(dir: string, rest: string[]): boolean {
    if (rest.length === 0) return existsSync(join(dir, "page.tsx")) || existsSync(join(dir, "page.ts"));
    const [head, ...tail] = rest;
    if (existsSync(join(dir, head)) && resolve(join(dir, head), tail)) return true;
    if (!existsSync(dir)) return false;
    return readdirSync(dir)
      .filter((name) => /^\[[^.\]]+\]$/.test(name))
      .some((name) => resolve(join(dir, name), tail));
  }
  return resolve("app", segments);
}

describe("portal navigation reachability", () => {
  it("has no literal portal links to missing pages", () => {
    const broken: string[] = [];
    for (const file of ROOTS.flatMap((root) => walk(root))) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(LINK)) {
        if (!pageExists(match[1])) broken.push(`${file.replaceAll("\\", "/")} -> ${match[1]}`);
      }
    }
    expect(broken).toEqual([]);
  });
});
