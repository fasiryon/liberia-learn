import { describe, expect, it } from "vitest";
import {
  buildCurriculumExpansionBatch,
  buildCurriculumExpansionRecords,
  summarizeCurriculumExpansion,
  validateCurriculumExpansionBatch,
} from "@/lib/curriculum/factoryExpansion";
import { buildCurriculumChunkSeeds } from "@/lib/ai/rag/curriculumChunkBlueprint";
import { PHASE_ONE_TARGETS } from "@/lib/curriculum/phaseOneScaleCatalog";

describe("curriculum factory expansion", () => {
  it("builds deterministic unit and lesson coverage for targeted gaps", () => {
    const batch = buildCurriculumExpansionBatch();
    const subjects = batch.units.map((unit) => `${unit.subject}-g${unit.gradeLevel}`);
    const grade10MathUnits = batch.units.filter(
      (unit) => unit.subject === "MATH" && unit.gradeLevel === 10
    );
    const unitsByTarget = new Map<string, number>();

    for (const unit of batch.units) {
      const key = `${unit.subject}-g${unit.gradeLevel}`;
      unitsByTarget.set(key, (unitsByTarget.get(key) ?? 0) + 1);
    }

    expect(batch.units.length).toBeGreaterThan(16);
    expect(subjects).toContain("MATH-g7");
    expect(subjects).toContain("MATH-g10");
    expect(subjects).toContain("SCIENCE-g5");
    expect(subjects).toContain("LITERACY-g3");
    expect(subjects).toContain("LITERACY-g6");
    expect(grade10MathUnits).toHaveLength(12);
    expect(unitsByTarget.get("LITERACY-g6")).toBe(1);

    for (const target of PHASE_ONE_TARGETS) {
      expect(unitsByTarget.get(`${target.subjectCode}-g${target.gradeLevel}`)).toBe(12);
    }

    const mathUnit = batch.units.find((unit) => unit.unitId === "math-g7-fractions-ratios");
    expect(mathUnit?.coverage).toBe("full");
    expect(mathUnit?.lessons).toHaveLength(5);
    expect(mathUnit?.unitLabPlan.distributedLabs.some((lab) => lab.priority === "core")).toBe(true);

    const scienceUnit = batch.units.find((unit) => unit.unitId === "science-g5-plants-light-food");
    expect(scienceUnit?.coverage).toBe("full");
    expect(scienceUnit?.lessons).toHaveLength(5);
    expect(scienceUnit?.unitLabPlan.distributedLabs.length).toBeGreaterThanOrEqual(2);
  });

  it("creates retrieval-ready lesson records with answerable chunk inputs", () => {
    const records = buildCurriculumExpansionRecords();
    const mathRecord = records.find((record) => record.contentId === "math-g7-comparing-fractions-benchmarks");
    const grade10Record = records.find(
      (record) => record.contentId === "math-g10-g10-ratio-language-and-rate"
    );
    const grade6InferenceRecord = records.find(
      (record) => record.contentId === "literacy-g6-grade6-making-inferences"
    );

    expect(records.length).toBeGreaterThan(56);
    expect(mathRecord).toBeDefined();
    expect(grade10Record).toBeDefined();
    expect(grade6InferenceRecord).toBeDefined();
    expect(Array.isArray((mathRecord?.payload as any).workedExamples)).toBe(true);
    expect(Array.isArray((mathRecord?.payload as any).guidedPractice)).toBe(true);
    expect(Array.isArray((mathRecord?.payload as any).independentPractice)).toBe(true);
    expect(Array.isArray((mathRecord?.payload as any).conceptTags)).toBe(true);
    expect((mathRecord?.payload as any).generationBatchId).toBe("factory-expansion-2026-03");
    expect((mathRecord?.payload as any).expectedGuardianEffortMinutes).toBeGreaterThan(0);
    expect((mathRecord?.payload as any).supportMode).toBeTruthy();
    expect(Array.isArray((mathRecord?.payload as any).effectivenessSignalKeys)).toBe(true);

    const chunks = buildCurriculumChunkSeeds({
      sourceId: mathRecord!.contentId,
      sourceLabel: mathRecord!.contentId,
      payload: mathRecord!.payload,
      subject: mathRecord!.subject,
      grade: mathRecord!.grade,
      schoolId: null,
      scope: "GLOBAL",
    });

    const conceptChunk = chunks.find((chunk) => (chunk.metadata as any)?.chunkType === "concept");
    const exampleChunk = chunks.find((chunk) => (chunk.metadata as any)?.chunkType === "example");
    const practiceChunk = chunks.find((chunk) => (chunk.metadata as any)?.chunkType === "practice");

    expect(conceptChunk).toBeDefined();
    expect(exampleChunk).toBeDefined();
    expect(practiceChunk).toBeDefined();
    expect((conceptChunk?.metadata as any).conceptTags).toContain("fraction comparison");
    expect((conceptChunk?.metadata as any).skillTags).toContain("comparing fractions");
    expect((conceptChunk?.metadata as any).unitId).toBe("math-g7-fractions-ratios");
    expect((conceptChunk?.metadata as any).lessonId).toBe("comparing-fractions-benchmarks");
    expect((conceptChunk?.metadata as any).difficultyLevel).toBe("standard");
  });

  it("summarizes media, lab, and simulation coverage", () => {
    const summary = summarizeCurriculumExpansion();
    const expectedUnitCount = PHASE_ONE_TARGETS.length * 12 + 13;
    const expectedAdditionalFullCoverageUnits = 12;
    const expectedAdditionalPartialCoverageUnits = 1;

    expect(summary.units).toBe(expectedUnitCount);
    expect(summary.lessons).toBeGreaterThan(expectedUnitCount * 2);
    expect(summary.fullCoverageUnits).toBe(
      PHASE_ONE_TARGETS.filter((target) => target.coverage === "full").length * 12
        + expectedAdditionalFullCoverageUnits
    );
    expect(summary.partialCoverageUnits).toBe(
      PHASE_ONE_TARGETS.filter((target) => target.coverage === "partial").length * 12
        + expectedAdditionalPartialCoverageUnits
    );
    expect(summary.pseudoLabs).toBeGreaterThan(0);
    expect(summary.simulations).toBeGreaterThan(0);
    expect(summary.chunkReadyLessons).toBe(summary.lessons);
  });

  it("validates concept graphs before content is ingest-ready", () => {
    const batch = buildCurriculumExpansionBatch();

    expect(validateCurriculumExpansionBatch(batch)).toEqual({
      valid: true,
      errors: [],
    });

    const invalidBatch = {
      ...batch,
      units: [
        {
          ...batch.units[0],
          lessons: batch.units[0].lessons.map((lesson, index) =>
            index === 0
              ? {
                  ...lesson,
                  conceptGraph: {
                    ...lesson.conceptGraph,
                    prerequisites: [...lesson.conceptGraph.prerequisites, lesson.conceptTags[0]],
                  },
                }
              : lesson
          ),
        },
      ],
    };

    const validation = validateCurriculumExpansionBatch(invalidBatch as typeof batch);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((error) => error.includes("self_dependency"))).toBe(true);
  });

  it("flags missing or out-of-order prerequisite references", () => {
    const batch = buildCurriculumExpansionBatch();
    const unit = batch.units.find((item) => item.unitId === "literacy-g6-main-idea-summary");
    expect(unit).toBeDefined();

    const invalidBatch = {
      ...batch,
      units: batch.units.map((item) =>
        item.unitId !== "literacy-g6-main-idea-summary"
          ? item
          : {
              ...item,
              lessons: item.lessons.map((lesson, index) =>
                index === 1
                  ? {
                      ...lesson,
                      conceptGraph: {
                        ...lesson.conceptGraph,
                        prerequisites: ["inference"],
                      },
                    }
                  : lesson
              ),
            }
      ),
    };

    const validation = validateCurriculumExpansionBatch(invalidBatch as typeof batch);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((error) => error.includes("order_violation"))).toBe(true);
  });

  it("flags broken prerequisite references that do not exist anywhere in the unit", () => {
    const batch = buildCurriculumExpansionBatch();

    const invalidBatch = {
      ...batch,
      units: batch.units.map((item) =>
        item.unitId !== "literacy-g3-sequencing-retelling"
          ? item
          : {
              ...item,
              lessons: item.lessons.map((lesson, index) =>
                index === 1
                  ? {
                      ...lesson,
                      conceptGraph: {
                        ...lesson.conceptGraph,
                        prerequisites: ["missing concept reference"],
                      },
                    }
                  : lesson
              ),
            }
      ),
    };

    const validation = validateCurriculumExpansionBatch(invalidBatch as typeof batch);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((error) => error.includes("broken_reference"))).toBe(true);
  });
});
