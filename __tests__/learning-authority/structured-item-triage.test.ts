import { describe, expect, it } from "vitest";
import {
  buildVocabulary, cutHeadingBleed, isTruncated, repairLetterSpacing, triageObjective, triageUnassigned,
} from "@/lib/learning-authority/structuredItemTriage";
import { validateStructuredItem, type StructuredCurriculumItem } from "@/lib/learning-authority/structuredCurriculumAuthority";

const clean = [
  "Describe the weather and explain the effects of wind. Identify sources of light. Classify plants. Identify soluble substances.",
  "Learners will describe the seasons, identify plants, classify animals, explain light and describe weather again.",
  "Describe weather. Identify light. Classify matter. Explain effects. Soluble and insoluble substances. As a class, work in to groups.",
  "as a result in to the as a in to and and and of of of the the the light light sources sources effects",
].concat(Array.from({ length: 5 }, () => "identify identify describe classify explain soluble insoluble weather light sources effects the of and in to as a"));
const vocabulary = buildVocabulary(clean);

function objective(text: string, overrides: Partial<StructuredCurriculumItem> = {}): StructuredCurriculumItem {
  return {
    id: "moe-science-g1-s2-p5-weather-obj1", kind: "OBJECTIVE", grade: 1, subject: "SCIENCE", sourceSubject: "GENERAL_SCIENCE",
    semester: 2, period: 5, unit: null, topic: "WEATHER", topicKey: "moe-science-g1-s2-p5-weather", ordinal: 1, text,
    confidence: "HIGH", qualityFlags: [],
    provenance: {
      sourceAuthority: "VERIFIED_LIBERIA_MOE_SOURCE", archiveId: "liberia-moe-grade-1-6-archive", archiveDocument: "GRADE-1-6.zip",
      sourceUri: "http://www.moe.gov.lr/", archiveChecksum: "abc", sourceMember: "GRADE-1-6/General Science1-6.pdf", memberChecksum: "def",
      pages: [10], extractionMethod: "PDF_TEXT_DECODED", parser: "moe-topic-table-v1",
    },
    liberiaLearnReviewState: "UNREVIEWED", moeApprovalState: "NOT_CLAIMED", moeApprovalEvidence: null,
    ...overrides,
  };
}

describe("repairLetterSpacing", () => {
  it("joins split words", () => {
    expect(repairLetterSpacing("Descr i be the weathe r", vocabulary)).toBe("Describe the weather");
    expect(repairLetterSpacing("Ident ify sour c es o f li g ht", vocabulary)).toBe("Identify sources of light");
    expect(repairLetterSpacing("Class i fy plants", vocabulary)).toBe("Classify plants");
  });

  it("keeps runs of real words apart", () => {
    expect(repairLetterSpacing("work in to groups as a class", vocabulary)).toBe("work in to groups as a class");
  });
});

describe("cutHeadingBleed / isTruncated", () => {
  it("cuts an ALL-CAPS column heading that bled into the text", () => {
    expect(cutHeadingBleed("Discuss the characteristics of prose and poetry COMPOSITION DEVELOPMENT I Kinds")).toBe("Discuss the characteristics of prose and poetry");
  });
  it("detects text that stops mid-phrase", () => {
    expect(isTruncated("Discuss the impacts of the")).toBe(true);
    expect(isTruncated("Discuss the solar system.")).toBe(false);
  });
});

describe("triageObjective", () => {
  it("corrects letter-spacing and keeps the objective", () => {
    const { item, record } = triageObjective({ item: objective("Descr i be the weathe r", { qualityFlags: ["LETTER_SPACING_ARTIFACTS"] }), vocabulary });
    expect(record.decision).toBe("CORRECTED");
    expect(item).toMatchObject({ kind: "OBJECTIVE", text: "Describe the weather", qualityFlags: [] });
    expect(item!.triage).toMatchObject({ decision: "CORRECTED", originalText: "Descr i be the weathe r" });
  });

  it("reclassifies a numbered CONTENTS cell, an assessment strategy, a competency and an activity", () => {
    expect(triageObjective({ item: objective("Stem and leaf plot"), vocabulary }).item).toMatchObject({ kind: "CONTENT" });
    expect(triageObjective({ item: objective("Class Assignment and Participation"), vocabulary }).item).toMatchObject({ kind: "ASSESSMENT_REFERENCE" });
    expect(triageObjective({ item: objective("Digital Skills"), vocabulary }).item).toMatchObject({ kind: "COMPETENCY" });
    expect(triageObjective({ item: objective("Lead learners to discuss plant growth."), vocabulary }).item).toMatchObject({ kind: "ACTIVITY" });
  });

  it("suppresses truncated and ambiguous items", () => {
    expect(triageObjective({ item: objective("Discuss the impacts of the"), vocabulary })).toMatchObject({ item: null, record: { decision: "SUPPRESSED", rule: "objective_text_truncated" } });
    expect(triageObjective({ item: objective("Rape Gender issues in rape", { confidence: "LOW", qualityFlags: ["AMBIGUOUS_COLUMN_ASSIGNMENT"] }), vocabulary }).record.decision).toBe("SUPPRESSED");
  });

  it("never touches review or MOE approval state", () => {
    const { item } = triageObjective({ item: objective("Explain the effects of wind."), vocabulary });
    expect(item).toMatchObject({ liberiaLearnReviewState: "UNREVIEWED", moeApprovalState: "NOT_CLAIMED", moeApprovalEvidence: null });
    expect(validateStructuredItem(item!)).toEqual([]);
  });
});

describe("triageUnassigned", () => {
  it("salvages assessment strategies and material references, suppresses the rest", () => {
    const outcomes = triageUnassigned("Tests • Attendance • Oral presentation • Peer assessment • www.khanacademy.org • learners compare notes about the");
    expect(outcomes).toEqual([
      { decision: "RECLASSIFIED", kind: "ASSESSMENT_REFERENCE", parts: ["Tests", "Attendance", "Oral presentation", "Peer assessment"], rule: "assessment_vocabulary" },
      { decision: "RECLASSIFIED", kind: "MATERIAL", parts: ["www.khanacademy.org"], rule: "material_reference" },
      { decision: "SUPPRESSED", rule: "remaining_text_column_not_determinable" },
    ]);
  });
});

describe("validateStructuredItem", () => {
  it("rejects MOE approval without evidence and OCR text without the OCR flag", () => {
    expect(validateStructuredItem(objective("Describe the weather", { moeApprovalState: "MOE_APPROVED" })).map((v) => v.rule)).toContain("moe_approval_requires_evidence");
    const ocr = objective("Describe the weather", { provenance: { ...objective("x").provenance, extractionMethod: "OCR_WINDOWS_MEDIA" } });
    expect(validateStructuredItem(ocr).map((v) => v.rule)).toContain("ocr_text_flag_required");
  });
});
