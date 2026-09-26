import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { normalizePageText, parseMoeTopicTables } from "@/lib/learning-authority/moeTopicTableParser";

const intermediate = JSON.parse(fs.readFileSync(path.join(process.cwd(), "curriculum/sources/intermediate/GRADE-1-6.json"), "utf8"));
const math16 = intermediate.manifests.find((m: { source: { sourceMember: string } }) => /Math 1-6/.test(m.source.sourceMember));

describe("normalizePageText", () => {
  it("repairs drop-cap splits and hyphenated words, keeps bullets, strips the page header", () => {
    const raw = "Page \n43\n9.\nSolve\nproblems\ninvolving multi\n-\nstep\nproblems.\n\nU\nnderstand\n- \nQuiz";
    expect(normalizePageText(raw, 43)).toBe("9. Solve problems involving multi-step problems. • Understand - Quiz");
  });

  it("does not eat a list number that follows the page number", () => {
    expect(normalizePageText("Page\n43\n9.\nSolve", 43)).toBe("9. Solve");
  });
});

describe("parseMoeTopicTables on the real Grade 1-6 Math source", () => {
  const parsed = parseMoeTopicTables(math16.extraction.pages);
  const grade4 = parsed.blocks.filter((block) => block.grade === 4);

  it("finds all six Grade 4 periods in order", () => {
    expect(grade4.map((block) => block.period)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(grade4.map((block) => block.pages[0])).toEqual([38, 40, 42, 44, 46, 48]);
  });

  it("parses Period III (number theory and fractions) objectives across the page break", () => {
    const period3 = grade4[2]!;
    expect(period3.topic).toBe("NUMBER THEORY AND FRACTION");
    expect(period3.objectives.map((entry) => entry.text)).toEqual([
      "Identify even and odd numbers.",
      "Identify factors and multiples.",
      "Find LCM and GCF of numbers.",
      "Find parts of a set.",
      "Write equivalent fractions.",
      "Simplify fractions.",
      "Add fractions.",
      "Subtract fractions.",
      "Solve problems involving multi-step problems.",
    ]);
    // Objective 9 continues on page 43 and is flagged as a continuation assignment.
    expect(period3.objectives[8]).toMatchObject({ page: 43, confidence: "MEDIUM", flags: ["CONTINUATION_PAGE_ASSIGNMENT"] });
    // Activity numbering resumes at 5 on page 43, next to objective 9.
    expect(period3.activities.map((entry) => entry.ordinal)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(period3.activities[4]).toMatchObject({ page: 43, text: "Use base 10 counters to illustrate division addition and subtraction of fractions." });
    expect(period3.contents.map((entry) => entry.text)).toContain("Equivalent fraction");
    expect(period3.materials.some((entry) => /Fraction Strips/.test(entry.text))).toBe(true);
    expect(period3.assessments.map((entry) => entry.text)).toEqual(expect.arrayContaining(["Quiz", "Test", "Exams", "Observation"]));
  });

  it("separates numbered outcomes from bulleted objectives (Period I)", () => {
    const period1 = grade4[0]!;
    expect(period1.outcomes.map((entry) => entry.text)).toEqual([
      "Use population data of births and death to add and subtract whole numbers.",
      "Apply computation skills of addition and subtraction to real life situation.",
    ]);
    expect(period1.objectives.map((entry) => entry.text)).toEqual([
      "Read and write whole numbers up to hundred thousand",
      "Compare and order whole numbers to hundred thousand",
      "Round whole numbers up to thousand",
      "Add and subtract whole numbers using population data on births, deaths, and migration",
    ]);
    expect(period1.objectives[3]!.flags).toContain("TAIL_BOUNDARY_UNCERTAIN");
  });

  it("does not treat an outcomes intro as the objectives cue (Period II)", () => {
    const period2 = grade4[1]!;
    expect(period2.outcomes).toHaveLength(3);
    expect(period2.objectives[0]!.text).toBe("Identify multiplication facts and properties.");
  });

  it("parses 44 Grade 4 objectives in total, every one page-located", () => {
    const objectives = grade4.flatMap((block) => block.objectives);
    expect(objectives).toHaveLength(44);
    expect(objectives.every((entry) => entry.page >= 38 && entry.page <= 49)).toBe(true);
  });
});
