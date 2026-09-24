import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const css = readFileSync("app/globals.css", "utf8");
const token = (name: string) => css.match(new RegExp(`--ll-${name}:\\s*(#[0-9a-fA-F]{6})`))?.[1] ?? "";

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (path.endsWith(".tsx")) out.push(path);
  }
  return out;
}

describe("accent button text contrast (WCAG AA)", () => {
  it("dark text on the yellow accent meets 4.5:1 and faint text does not", () => {
    expect(contrast(token("bg"), token("yellow"))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token("text-faint"), token("yellow"))).toBeLessThan(4.5);
  });

  it("no solid yellow/accent surface uses the faint text token", () => {
    const solid = /(?<![\w:-])bg-\[var\(--ll-(?:accent|yellow)\)\](?!\/)/;
    const faint = /(?<![\w:-])text-\[var\(--ll-text-faint\)\]/;
    const offenders: string[] = [];
    for (const file of [...walk("app"), ...walk("components")]) {
      for (const match of readFileSync(file, "utf8").matchAll(/className=(["`])([^"`]*)\1/g)) {
        if (solid.test(match[2]) && faint.test(match[2])) offenders.push(file.replaceAll("\\", "/"));
      }
    }
    expect(offenders).toEqual([]);
  });
});
