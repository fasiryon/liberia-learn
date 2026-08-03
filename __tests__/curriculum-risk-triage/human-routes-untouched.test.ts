import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

// Curriculum risk-triage (lib/curriculum/riskTriage.ts) must only ever be
// called from automated/script-driven approval paths. A human clicking
// Approve/Reject on these three routes already IS the review — triage must
// never intercept that path. This locks the boundary in as a regression
// guard, since a future edit adding an import here would silently reintroduce
// automated status changes on a human-driven route.
const HUMAN_ROUTES = [
  "app/api/admin/curriculum/approve/route.ts",
  "app/api/admin/curriculum/reject/route.ts",
  "app/api/admin/ops/curriculum-review/route.ts",
  "lib/curriculum/regenerationAdmin.ts",
];

describe("human-driven curriculum routes never import risk-triage", () => {
  it.each(HUMAN_ROUTES)("%s has no riskTriage import", (relativePath) => {
    const source = readFileSync(path.join(process.cwd(), relativePath), "utf8");
    expect(source).not.toMatch(/riskTriage/);
  });
});
