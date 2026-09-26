import fs from "node:fs";
import { describe, expect, it } from "vitest";

const ledger = JSON.parse(fs.readFileSync("curriculum/review/g4-math/review-ledger.json", "utf8")) as Record<string, { decision: string; reviewer: string | null; reviewedAt: string | null; notes: string }>;

describe("Grade 4 Math review ledger", () => {
  it("covers all 44 MOE objectives", () => {
    expect(Object.keys(ledger)).toHaveLength(44);
  });

  it("records only valid decisions, and every non-pending decision names a human reviewer and time", () => {
    for (const [id, entry] of Object.entries(ledger)) {
      expect(["PENDING", "APPROVE", "REVISE", "REJECT"], id).toContain(entry.decision);
      if (entry.decision === "PENDING") continue;
      expect(entry.reviewer?.trim(), id).toBeTruthy();
      expect(entry.reviewer, id).not.toMatch(/claude|ai|system|bot|automat/i);
      expect(Number.isFinite(Date.parse(entry.reviewedAt ?? "")), id).toBe(true);
      if (entry.decision !== "APPROVE") expect(entry.notes.trim(), id).toBeTruthy();
    }
  });
});
