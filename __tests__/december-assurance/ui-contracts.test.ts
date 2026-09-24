/**
 * December assurance — deterministic UI/reachability contracts.
 *
 * Source-level checks for defects found in the December audit: unreadable
 * primary buttons, links to routes that do not exist, and privacy defaults
 * that are only visible in source.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(rel, out);
    else if (rel.endsWith(".tsx")) out.push(rel);
  }
  return out;
}

function luminance(hex: string) {
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i + 1, i + 3), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
function token(css: string, name: string) {
  const match = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!match) throw new Error(`token ${name} not found`);
  return match[1];
}

describe("primary buttons meet WCAG AA text contrast", () => {
  const css = read("app/globals.css");

  it("dark text on the yellow accent is at least 4.5:1", () => {
    expect(contrast(token(css, "ll-bg"), token(css, "ll-yellow"))).toBeGreaterThanOrEqual(4.5);
  });

  it("no solid yellow/accent surface uses faint, light, or white text", () => {
    const solid = /(?<![:\w-])bg-\[var\(--ll-(yellow|accent)\)\](?![/\w])/;
    const offenders: string[] = [];
    for (const file of [...walk("app"), ...walk("components")]) {
      const source = read(file);
      // Class lists: quoted strings, and template-literal static text outside ${...}.
      const classLists = [
        ...(source.match(/"[^"\n]*"/g) ?? []),
        ...(source.match(/`[^`]*`/g) ?? []).flatMap((t) => t.split(/\$\{[^{}]*\}/)),
      ];
      for (const list of classLists) {
        if (!solid.test(list)) continue;
        if (/(?<![\w:/-])text-(\[var\(--ll-text(-faint)?\)\]|white\b)/.test(list)) offenders.push(`${file}: ${list.slice(0, 120)}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("navigation targets exist", () => {
  it.each([
    ["app/teacher/homework/page.tsx", "/teacher/homework/create", "app/teacher/homework/new/page.tsx"],
    ["lib/intelligence/teacherAlerts.ts", "/teacher/interventions", "app/teacher/intelligence/page.tsx"],
    ["app/guardian/GuardianDashboardClient.tsx", "/guardian/lessons", "app/guardian/progress/page.tsx"],
    ["app/share/certificate/[id]/page.tsx", "href=\"/register\"", "app/guardian/register/page.tsx"],
    ["app/moe/dashboard/page.tsx", "/moe/audit", "app/moe/dashboard/page.tsx"],
    ["components/GlobalSearch.tsx", "href: \"/events\"", "app/student/events/page.tsx"],
  ])("%s no longer links to %s", (file, deadTarget, replacement) => {
    expect(read(file)).not.toContain(deadTarget);
    expect(fs.existsSync(path.join(root, replacement))).toBe(true);
  });

  it("admin back-links use the admin home that exists", () => {
    const offenders = walk("app/admin").filter((file) => read(file).includes('href="/admin/dashboard"'));
    expect(offenders).toEqual([]);
    expect(fs.existsSync(path.join(root, "app/admin/dashboard/page.tsx"))).toBe(false);
  });
});

describe("privacy defaults visible in source", () => {
  it("the public portfolio page honours the portfolio feature flag", () => {
    expect(read("app/portfolio/[shareCode]/page.tsx")).toMatch(/isPortfolioFlagEnabled\(\)\)\)\s*notFound\(\)/);
  });

  it.each([
    "app/api/messages/upload-attachment/route.ts",
    "app/api/student/portfolio/generate/route.ts",
    "app/api/admin/credentials/bulk-generate/route.ts",
  ])("%s writes public learner blobs at unguessable URLs", (file) => {
    expect(read(file)).toContain("addRandomSuffix: true");
  });

  it("error and offline pages do not claim work was saved", () => {
    for (const file of ["app/error.tsx", "app/offline/page.tsx", "public/offline.html"]) {
      expect(read(file)).not.toMatch(/work has been saved/i);
    }
  });

  it("icon-only calendar controls have accessible names", () => {
    const source = read("components/EventCalendar.tsx");
    expect(source).toContain('aria-label="Previous month"');
    expect(source).toContain('aria-label="Next month"');
  });
});
