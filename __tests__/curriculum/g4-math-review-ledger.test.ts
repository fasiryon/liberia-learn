import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { GRADE4_FRACTIONS_LESSON, GRADE4_FRACTIONS_LESSON_2026_2 } from "@/lib/curriculum/authority/grade4FractionsLesson";
import { GRADE4_MATH_DRAFT_LESSONS } from "@/lib/curriculum/authority/grade4Math";

const ledger = JSON.parse(fs.readFileSync("curriculum/review/g4-math/review-ledger.json", "utf8")) as Record<string, { decision: string; reviewer: string | null; reviewedAt: string | null; notes: string; reviewedContentId?: string }>;

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

  it("names a real lesson when a decision records which content was reviewed", () => {
    const lessons = new Map<string, string[]>([["moe-math-g4-s1-p3-number-theory-and-fraction-obj4", [GRADE4_FRACTIONS_LESSON.contentId, GRADE4_FRACTIONS_LESSON_2026_2.contentId]]]);
    for (const draft of GRADE4_MATH_DRAFT_LESSONS) lessons.set(draft.moeObjectiveId, [draft.contentId]);
    for (const [id, entry] of Object.entries(ledger)) {
      if (entry.reviewedContentId === undefined) continue;
      expect(lessons.get(id), id).toContain(entry.reviewedContentId);
    }
  });
});
