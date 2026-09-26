import { describe, expect, it } from "vitest";
import { ocrPageToText } from "@/lib/learning-authority/ocrTableLayout";
import { parseMoeTopicTables } from "@/lib/learning-authority/moeTopicTableParser";

// Geometry recorded from Windows OCR of GRADE 7-9/English 7-9.pdf page 2 (trimmed).
const lines = [
  { text: "SEMESTER", x: 1858, y: 373 }, { text: "ONE", x: 2232, y: 374 },
  { text: "GRADE:", x: 365, y: 442 }, { text: "7", x: 754, y: 443 },
  { text: "PERIOD:", x: 363, y: 512 }, { text: "1", x: 756, y: 511 },
  { text: "SUBJECT:", x: 365, y: 580 }, { text: "LANGUAGE ARTS", x: 714, y: 580 },
  { text: "TOPIC:", x: 364, y: 650 }, { text: "CONSTRUCTING SENTENCES", x: 710, y: 650 },
  { text: "LEARNING", x: 283, y: 754 }, { text: "OUTCOMES", x: 272, y: 818 },
  { text: "Learners are able to", x: 245, y: 891 }, { text: "construct sentences.", x: 246, y: 963 },
  { text: "LEARNING", x: 812, y: 754 }, { text: "OBJECTIVES:", x: 778, y: 818 },
  { text: "Upon completion of this", x: 673, y: 892 }, { text: "topic, learners will:", x: 672, y: 965 },
  { text: "l.", x: 678, y: 1086 }, { text: "2.", x: 672, y: 1315 },
  { text: "Construct sentences", x: 763, y: 1086 }, { text: "and punctuate them", x: 763, y: 1149 }, { text: "correctly.", x: 763, y: 1212 },
  { text: "Write friendly letters.", x: 762, y: 1314 },
  { text: "CONTENT", x: 1444, y: 800 },
  { text: "Constructing effective", x: 1354, y: 893 }, { text: "sentences.", x: 1355, y: 962 },
  { text: "Writing friendly", x: 1354, y: 1087 }, { text: "letters.", x: 1355, y: 1160 },
  { text: "Page 2", x: 2000, y: 2900 },
];

describe("ocrPageToText", () => {
  it("pairs header labels with values, attaches OCR list markers, and orders columns", () => {
    const text = ocrPageToText(lines);
    expect(text).toContain("GRADE: 7");
    expect(text).toContain("PERIOD: 1");
    expect(text).toContain("TOPIC: CONSTRUCTING SENTENCES");
    expect(text).toContain("1. Construct sentences");
    expect(text).not.toContain("Page 2");
    expect(text.indexOf("1. Construct")).toBeLessThan(text.indexOf("Constructing effective"));
  });

  it("produces text the topic-table parser reads", () => {
    const parsed = parseMoeTopicTables([{ page: 2, rawText: ocrPageToText(lines) }]);
    expect(parsed.blocks).toHaveLength(1);
    expect(parsed.blocks[0]).toMatchObject({ grade: 7, period: 1, topic: "CONSTRUCTING SENTENCES" });
    expect(parsed.blocks[0]!.objectives.map((entry) => entry.text)).toEqual(["Construct sentences and punctuate them correctly.", "Write friendly letters."]);
    expect(parsed.blocks[0]!.contents.map((entry) => entry.text)).toEqual(["Constructing effective sentences.", "Writing friendly letters."]);
  });
});
