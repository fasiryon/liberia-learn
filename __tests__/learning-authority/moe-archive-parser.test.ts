import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseMoeArchive, type MoeArchiveSource } from "@/lib/learning-authority/moeArchiveParser";

const source: MoeArchiveSource = {
  id: "liberia-moe-grade-1-6-archive",
  document: "GRADE-1-6.zip",
  localPath: "curriculum/sources/raw/GRADE-1-6.zip",
  sourceUri: "http://www.moe.gov.lr/wp-content/uploads/2019/09/GRADE-1-6.zip",
  authority: "VERIFIED_LIBERIA_MOE_SOURCE",
  gradeMin: 1,
  gradeMax: 6,
};

describe("Liberia MOE archive parser", () => {
  it("deterministically emits source-traceable intermediate manifests", () => {
    const buffer = readFileSync(source.localPath);
    const first = parseMoeArchive(source, buffer);
    const second = parseMoeArchive(source, buffer);
    expect(first).toEqual(second);
    expect(first).toHaveLength(7);
    expect(first[0].status).toBe("INTERMEDIATE_REVIEW_ONLY");
    expect(first[0].source.sourceChecksum).toMatch(/^[a-f0-9]{64}$/);
    expect(first[0].source.sourceMember).toMatch(/\.pdf$/i);
    expect(first.some((manifest) => manifest.extraction.extractedLineCount > 0)).toBe(true);
    expect(first[0].extraction.pageCount).toBeGreaterThan(1);
    expect(first[0].extraction.pages[0].page).toBe(1);
    expect(first[0].extraction.reviewQueue.length).toBeGreaterThan(0);
    expect(first.reduce((total, manifest) => total + manifest.extraction.objectives.length, 0)).toBeGreaterThan(0);
    expect(first.reduce((total, manifest) => total + manifest.extraction.standards.length, 0)).toBeGreaterThan(0);
  });
});
