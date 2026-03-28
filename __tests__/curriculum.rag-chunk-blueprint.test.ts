import { describe, expect, it } from "vitest";
import { buildCurriculumChunkSeeds } from "@/lib/ai/rag/curriculumChunkBlueprint";
import { generateMediaArtifacts } from "@/lib/curriculum/mediaGeneration";
import { generateLessonLabSimulationBundle } from "@/lib/curriculum/labSimulation";

describe("curriculum RAG chunk blueprint", () => {
  it("extracts structured chunk types for lesson, guardian, media, and labs", () => {
    const media = generateMediaArtifacts({
      sourceLessonId: "content-1",
      subject: "MATH",
      grade: 7,
      unitTitle: "Fractions and Ratio",
      lessonTitle: "Comparing Fractions",
      objective: "Compare fractions correctly.",
      teacherExplanation: "Use number lines and benchmarks.",
      workedExamples: ["3/4 is greater than 5/8 after converting to eighths."],
      guidedPractice: ["Compare 2/3 and 3/5."],
      groupWorkTask: "Create a comparison poster.",
      guardianSupportNote: "Ask your child to explain which fraction is larger.",
      homePracticeSuggestion: "Compare food portions at home.",
      realWorldApplication: "Useful for budgeting and sharing.",
      digitalConnection: "Use a fraction visualizer when devices exist.",
      materialsNeeded: ["paper strips", "exercise books"],
    });
    const lessonLabBundle = generateLessonLabSimulationBundle({
      sourceLessonId: "content-1",
      subject: "MATH",
      gradeLevel: 7,
      unitTitle: "Fractions and Ratio",
      lessonTitle: "Comparing Fractions",
      lessonObjective: "Compare fractions correctly.",
    });

    const chunks = buildCurriculumChunkSeeds({
      sourceId: "content-1",
      sourceLabel: "math-g7-fractions",
      payload: {
        title: "Comparing Fractions",
        unitTitle: "Fractions and Ratio",
        objective: "Compare fractions correctly.",
        teacherExplanation: "Use number lines and benchmarks.",
        workedExamples: ["3/4 is greater than 5/8 after converting to eighths."],
        guidedPractice: ["Compare 2/3 and 3/5."],
        independentPractice: ["Compare 7/10 and 5/6."],
        lessonOpeningRoutine: "Retrieve equivalent fraction knowledge.",
        classroomActivities: ["Place fraction cards on a rope number line."],
        guardianSupportNote: "Ask your child to explain which fraction is larger.",
        homePracticeSuggestion: "Compare food portions at home.",
        whatToLookFor: "Listen for method, not guessing.",
        quickChecks: ["Hinge question on 5/6 vs 7/9"],
        realWorldApplication: "Useful for budgeting and sharing.",
        visualAssetSpecs: media.visualAssetSpecs,
        audioScriptSpecs: media.audioScriptSpecs,
        slideDeckSpecs: media.slideDeckSpecs,
        videoStoryboardSpecs: media.videoStoryboardSpecs,
        labDefinitionSpecs: media.labDefinitionSpecs,
        pseudoLabs: lessonLabBundle.pseudoLabs,
        simulationDefinitions: lessonLabBundle.simulationDefinitions,
        threeDLabDefinitions: lessonLabBundle.threeDLabDefinitions,
        unitId: "math-g7-fractions-ratios",
        lessonId: "comparing-fractions",
        conceptTags: ["fraction comparison", "benchmarks"],
        skillTags: ["comparing fractions", "explaining reasoning"],
        difficultyLevel: "standard",
        curriculumVersion: "2026.1",
        generationBatchId: "factory-expansion-2026-03",
        weicTags: ["W", "I"],
        waecAlignment: { required: false, examStyle: "intro" },
      },
      subject: "MATH",
      grade: 7,
      schoolId: "school-1",
      scope: "SCHOOL",
    });

    const chunkTypes = chunks.map((chunk) => (chunk.metadata as any)?.chunkType);
    expect(chunkTypes).toContain("concept");
    expect(chunkTypes).toContain("guardian_support");
    expect(chunkTypes).toContain("media_support");
    expect(chunkTypes).toContain("lab_support");
    expect(chunkTypes).toContain("simulation_support");
    expect(chunkTypes).toContain("teacher_lab_support");
    expect(chunkTypes).toContain("guardian_lab_support");

    const guardianChunk = chunks.find((chunk) => (chunk.metadata as any)?.chunkType === "guardian_support");
    expect(guardianChunk?.content).toContain("Ask your child");
    expect((guardianChunk?.metadata as any)?.lessonTitle).toBe("Comparing Fractions");

    const simulationChunk = chunks.find((chunk) => (chunk.metadata as any)?.chunkType === "simulation_support");
    expect(simulationChunk?.content).toContain("fraction_bar_visualizer");
    expect((simulationChunk?.metadata as any)?.unitTitle).toBe("Fractions and Ratio");
    expect((simulationChunk?.metadata as any)?.subject).toBe("MATH");
    expect((simulationChunk?.metadata as any)?.gradeLevel).toBe(7);
    expect((simulationChunk?.metadata as any)?.unitId).toBe("math-g7-fractions-ratios");
    expect((simulationChunk?.metadata as any)?.lessonId).toBe("comparing-fractions");
    expect((simulationChunk?.metadata as any)?.conceptTags).toContain("fraction comparison");
    expect((simulationChunk?.metadata as any)?.difficultyLevel).toBe("standard");
  });
});
