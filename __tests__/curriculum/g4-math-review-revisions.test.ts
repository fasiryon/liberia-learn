/**
 * Pins the curriculum/product review CPR-2026-09-26 revisions to the Grade 4
 * Math lessons, and keeps reviewer recommendations separate from founder
 * decisions: a recommendation never writes the ledger and never claims
 * founder or MOE approval.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { GRADE4_MATH_DRAFT_LESSONS, type DraftLesson } from "@/lib/curriculum/authority/grade4Math";
import { GRADE4_FRACTIONS_LESSON_2026_2 } from "@/lib/curriculum/authority/grade4FractionsLesson";

const DIR = "curriculum/review/g4-math";
const ledger = JSON.parse(fs.readFileSync(`${DIR}/review-ledger.json`, "utf8")) as Record<string, { decision: string; reviewer: string | null }>;
const recs = JSON.parse(fs.readFileSync(`${DIR}/reviewer-recommendations.json`, "utf8")) as {
  review: { id: string; isFounderApproval: boolean; isMoeApproval: boolean };
  objectives: Record<string, { recommendation: string; reviewedContent: { contentId: string; version: string; payloadSha256: string } }>;
};
const lesson = (suffix: string): DraftLesson => GRADE4_MATH_DRAFT_LESSONS.find((l) => l.moeObjectiveId.endsWith(suffix))!;
const text = (l: DraftLesson) => JSON.stringify(l.payload);
const items = (l: DraftLesson) => [...l.payload.practice, ...l.payload.homework, ...l.payload.quiz, l.payload.diagnosticCheck, l.payload.assessment];

describe("reviewer recommendations (CPR-2026-09-26)", () => {
  it("cover all 44 objectives with valid values and claim neither founder nor MOE approval", () => {
    expect(recs.review).toMatchObject({ id: "CPR-2026-09-26", isFounderApproval: false, isMoeApproval: false });
    expect(Object.keys(recs.objectives).sort()).toEqual(Object.keys(ledger).sort());
    for (const rec of Object.values(recs.objectives)) {
      expect(["READY_FOR_FOUNDER_APPROVAL", "REVISE", "BLOCKED_SOURCE", "BLOCKED_POLICY"]).toContain(rec.recommendation);
    }
  });

  it("never write the founder ledger", () => {
    for (const [id, entry] of Object.entries(ledger)) {
      expect(entry.decision, id).toBe("PENDING");
      expect(entry.reviewer, id).toBeNull();
    }
  });

  it("each pin the exact content they assessed", () => {
    for (const [id, rec] of Object.entries(recs.objectives)) {
      const content = GRADE4_MATH_DRAFT_LESSONS.find((l) => l.moeObjectiveId === id) ?? GRADE4_FRACTIONS_LESSON_2026_2;
      expect(rec.reviewedContent, id).toEqual({
        contentId: content.contentId, version: content.version,
        payloadSha256: createHash("sha256").update(JSON.stringify(content.payload)).digest("hex"),
      });
    }
  });
});

describe("CPR-2026-09-26 content revisions", () => {
  it("1.4 uses a defensible estimate and labels every population figure as example data", () => {
    const l = lesson("p1-numeration-addition-and-subtraction-obj4");
    expect(l.payload.body).toContain("48,000 + 1,400 - 400 = 49,000");
    expect(l.payload.body).not.toContain("48,600");
    for (const item of items(l).filter((entry) => /people|population/.test(entry.prompt))) expect(item.prompt).toMatch(/^Example data:/);
  });

  it("3.2 teaches prime factors with factor trees; 3.3 stays listing-based", () => {
    const l = lesson("p3-number-theory-and-fraction-obj2");
    expect(l.payload.body).toContain("12 = 2 x 2 x 3");
    expect(l.payload.body).toContain("30 = 2 x 3 x 5");
    expect(l.payload.practice).toEqual(expect.arrayContaining([
      { prompt: "Write 12 as a product of prime factors.", answer: "2 x 2 x 3" },
      { prompt: "Write 30 as a product of prime factors.", answer: "2 x 3 x 5" },
    ]));
    expect(l.payload.quiz.some((q) => q.prompt.includes("prime factors") && q.answer === "2 x 3 x 3")).toBe(true);
    expect(lesson("p3-number-theory-and-fraction-obj3").payload.objectives.join(" ")).toMatch(/by listing multiples.*by listing factors/);
  });

  it("3.7 and 3.8 use like denominators only, with no zero denominator and no MOE attribution of LiberiaLearn examples", () => {
    const fractionPairs = (l: DraftLesson) => items(l).flatMap((entry) => [...entry.prompt.matchAll(/(\d+)\/(\d+) [+-] (\d+)\/(\d+)/g)]);
    for (const suffix of ["p3-number-theory-and-fraction-obj7", "p3-number-theory-and-fraction-obj8"]) {
      const l = lesson(suffix);
      for (const m of fractionPairs(l)) expect(m[2], `${suffix}: ${m[0]}`).toBe(m[4]);
      expect(text(l)).not.toMatch(/related denominators by|\b\d+\/0\b/);
      expect(l.payload.objectives.join(" ")).not.toMatch(/related denominators/);
    }
    expect(lesson("p3-number-theory-and-fraction-obj7").payload.body).toContain("The MOE curriculum suggests base-10 counters");
    expect(lesson("p3-number-theory-and-fraction-obj7").payload.body).not.toContain("The MOE activity uses counters");
  });

  it("5.5 teaches mass with unambiguous benchmarks", () => {
    const l = lesson("p5-measurement-obj5");
    expect(l.payload.body.startsWith("Mass tells how heavy something is. People often call it weight.")).toBe(true);
    expect(text(l)).not.toMatch(/sugar/i);
  });

  it("5.2 and 5.8 have only well-formed distractors", () => {
    expect(text(lesson("p5-measurement-obj8"))).not.toMatch(/120 cm only|2,1000/);
    expect(text(lesson("p5-measurement-obj2"))).not.toContain("5:65");
  });

  it("6.1 and 6.7 record the LiberiaLearn interpretation without correcting the MOE text", () => {
    expect(lesson("p6-geometry-and-statistics-obj1").payload.teacherNotes).toContain("reads \"interesting lines\"; LiberiaLearn interprets this as \"intersecting lines\"");
    const notes = lesson("p6-geometry-and-statistics-obj7").payload.teacherNotes;
    expect(notes).toContain("LiberiaLearn interprets \"medium\" as \"median\"");
    expect(notes).toContain("The MOE source text itself is unchanged");
  });

  it("6.5 uses closed models and never presents 3D as implemented", () => {
    const l = lesson("p6-geometry-and-statistics-obj5");
    expect(text(l)).not.toMatch(/funnel\b(?! is open)|\bcup\b(?! has no top)/i);
    expect(l.payload.materials).toEqual(expect.arrayContaining(["Closed tin", "Paper cone hat with a closed paper base"]));
    expect(l.payload.teacherNotes).toContain("does not exist today");
  });

  it("6.6 uses voluntary, anonymous family-size data and assesses reading the mode from a graph", () => {
    const l = lesson("p6-geometry-and-statistics-obj6");
    expect(l.payload.activities[0]).toMatch(/voluntary and anonymous/);
    expect(l.payload.practice.some((entry) => /bar graph/.test(entry.prompt) && /mode is 5/.test(entry.answer))).toBe(true);
    expect(l.payload.quiz.some((q) => /mode family size/.test(q.prompt) && q.answer === "6 people" && q.options.includes("8 people"))).toBe(true);
  });
});
