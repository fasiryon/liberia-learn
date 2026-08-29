import { describe, expect, it } from "vitest";
import {
  buildCoverageGenerationPlan,
  summarizeCoverageGenerationPlan,
  GENERATED_CURRICULUM_STATUS,
} from "@/lib/curriculum/generationEngine";

describe("curriculum generation engine", () => {
  it("builds deterministic generated lesson shells for a scoped core batch", () => {
    const records = buildCoverageGenerationPlan({
      grade: 3,
      allCore: true,
      limit: 12,
    });

    expect(records).toHaveLength(12);
    for (const record of records) {
      expect(record.status).toBe(GENERATED_CURRICULUM_STATUS);
      expect(record.contentType).toBe("lesson");
      expect(record.subject).toBeTruthy();
      expect(record.unitId).toBeTruthy();
      expect(record.hash).toHaveLength(40);
      expect((record.payload as any).objective).toBeTruthy();
      expect((record.payload as any).explanation).toBeTruthy();
      expect(Array.isArray((record.payload as any).workedExamples)).toBe(true);
      expect(Array.isArray((record.payload as any).guidedPractice)).toBe(true);
      expect(Array.isArray((record.payload as any).independentPractice)).toBe(true);
      expect((record.payload as any).assessment).toBeTruthy();
      expect((record.payload as any).remediation).toBeTruthy();
      expect((record.payload as any).extension).toBeTruthy();
      expect((record.payload as any).guardianSupport).toBeTruthy();
      expect((record.payload as any).generationStage).toBe("generated");
    }
  });

  it("supports the English subject alias and plan summaries", () => {
    const records = buildCoverageGenerationPlan({
      grade: 7,
      subject: "english",
      limit: 5,
    });
    const summary = summarizeCoverageGenerationPlan({
      grade: 7,
      subject: "english",
      limit: 5,
    });

    expect(records).toHaveLength(5);
    expect(records.every((record) => record.subject === "ENGLISH")).toBe(true);
    expect(summary.selectedLessons).toBe(5);
    expect(summary.selectedUnits).toBe(2);
    expect(summary.bySubject.ENGLISH).toBe(5);
    expect(summary.byGrade["7"]).toBe(5);
  });
});
