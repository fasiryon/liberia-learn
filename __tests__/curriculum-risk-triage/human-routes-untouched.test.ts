import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const HUMAN_ROUTES = [
  "app/api/admin/curriculum/approve/route.ts",
  "app/api/admin/curriculum/reject/route.ts",
  "app/api/admin/ops/curriculum-review/route.ts",
  "lib/curriculum/regenerationAdmin.ts",
];

describe("human-driven curriculum routes never invoke automated triage", () => {
  it.each(HUMAN_ROUTES)("%s does not import triageAndApprove", (relativePath) => {
    const source = readFileSync(path.join(process.cwd(), relativePath), "utf8");
    expect(source).not.toMatch(/\btriageAndApprove\b/);
  });
});
