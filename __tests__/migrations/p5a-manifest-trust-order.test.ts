import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(
    process.cwd(),
    "prisma/canonical/migrations/20260826_000001_p5a_manifest_trust_order/migration.sql",
  ),
  "utf8",
);

describe("P5-A manifest trust ordering migration", () => {
  it("keeps initial pointer establishment but rejects null, older, and non-latest revisions", () => {
    expect(sql).toContain("currentRevisionId cannot regress to NULL");
    expect(sql).toContain("new_sequence IS DISTINCT FROM maximum_sequence");
    expect(sql).toContain("new_sequence <= old_sequence");
    expect(sql).toContain("does not belong to CurriculumProvenance");
  });

  it("replaces only the existing current-revision guard function", () => {
    expect(sql).toContain("CREATE OR REPLACE FUNCTION p2a_validate_current_curriculum_revision()");
    expect(sql).not.toContain("ALTER TABLE");
    expect(sql).not.toContain("DROP TABLE");
  });
});
