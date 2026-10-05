import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SURFACE_TIME_PERIOD_SECONDS } from "@/components/interactive-labs/v2/threeSurfaces";

describe("RX-005 A9: determinism", () => {
  it("never uses Math.random, and renders without the wall clock", () => {
    const files = execFileSync("git", ["ls-files", "--", "components/interactive-labs", "lib/interactive-labs"], { cwd: process.cwd(), encoding: "utf8" }).split("\n").filter((file) => /\.(ts|tsx)$/.test(file));
    expect(files.length).toBeGreaterThan(40);
    const source = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");
    expect(files.filter((file) => /Math\.random\s*\(/.test(source(file)))).toEqual([]);
    // Rendering and presentation use the review clock or rAF time, never the wall clock (evidence timestamps may).
    const rendering = files.filter((file) => file.startsWith("components/interactive-labs/") || file.startsWith("lib/interactive-labs/v2/fidelity/"));
    expect(rendering.filter((file) => /new Date\(\s*\)|Date\.now\s*\(/.test(source(file)))).toEqual([]);
  });

  it("wraps shader time to a declared tileable period", () => {
    expect(Number.isInteger(SURFACE_TIME_PERIOD_SECONDS)).toBe(true);
    expect(SURFACE_TIME_PERIOD_SECONDS).toBeGreaterThan(0);
  });
});
