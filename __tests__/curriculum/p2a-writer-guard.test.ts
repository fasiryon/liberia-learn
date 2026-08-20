import { describe, expect, it } from "vitest";
import {
  containsUnauthorizedCurriculumMutation,
  findUnauthorizedCurriculumWriters,
} from "@/scripts/p2a-writer-guard";

describe("P2-A curriculum writer architecture", () => {
  it("rejects every uncontrolled runtime or maintenance writer", () => {
    expect(findUnauthorizedCurriculumWriters()).toEqual([]);
  }, 20_000);

  it.each([
    "prisma.curriculumContent.update({ where, data })",
    "scopedTx.curriculumContent.updateMany({ where, data })",
    "db.curriculumContent.create({ data })",
    "(db as any).curriculumContent.deleteMany({})",
    'await db.$executeRaw`UPDATE "CurriculumContent" SET "status" = \'x\'`',
  ])("detects aliased and raw writer bypass: %s", (source) => {
    expect(containsUnauthorizedCurriculumMutation(source)).toBe(true);
  });

  it("does not confuse immutable revision writes with projection writes", () => {
    expect(
      containsUnauthorizedCurriculumMutation(
        "tx.curriculumContentRevision.create({ data })",
      ),
    ).toBe(false);
  });
});
