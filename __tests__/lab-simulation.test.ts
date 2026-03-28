import { describe, expect, it } from "vitest";
import {
  PseudoLabSchema,
  SimulationDefinitionSchema,
  ThreeDLabDefinitionSchema,
} from "@/lib/schemas/labSimulation";
import {
  generateLessonLabSimulationBundle,
  generateLessonLabSimulationBundleBestEffort,
  validateLab,
} from "@/lib/curriculum/labSimulation";

describe("lab simulation framework", () => {
  it("validates a generated grade 7 math pseudo lab, simulation, and 3D stub", () => {
    const result = generateLessonLabSimulationBundle({
      sourceLessonId: "lesson-math-g7",
      subject: "MATH",
      gradeLevel: 7,
      unitTitle: "Fractions and Ratio Reasoning",
      lessonTitle: "Comparing Fractions with Shared Benchmarks",
      lessonObjective: "Students compare fractions using benchmarks and common denominators.",
    });

    expect(result.pseudoLabs).toHaveLength(1);
    expect(result.simulationDefinitions).toHaveLength(1);
    expect(result.threeDLabDefinitions).toHaveLength(1);

    expect(PseudoLabSchema.parse(result.pseudoLabs[0]).lessonObjective).toBe(
      "Students compare fractions using benchmarks and common denominators."
    );
    expect(result.pseudoLabs[0].sourceLessonId).toBe("lesson-math-g7");
    expect(result.pseudoLabs[0].renderStatus).toBe("ready");
    expect(result.pseudoLabs[0].approved).toBe(true);
    expect(SimulationDefinitionSchema.parse(result.simulationDefinitions[0]).rendererKey).toBe("fraction_bar_visualizer");
    expect(result.simulationDefinitions[0].sourceLessonId).toBe("lesson-math-g7");
    expect(result.simulationDefinitions[0].approved).toBe(true);
    expect(ThreeDLabDefinitionSchema.parse(result.threeDLabDefinitions[0]).status).toBe("simulation_ready");
  });

  it("enforces lesson linkage, fallback coverage, and teacher guardrails", () => {
    const result = generateLessonLabSimulationBundle({
      sourceLessonId: "lesson-science-g5",
      subject: "SCIENCE",
      gradeLevel: 5,
      unitTitle: "Plants and Food Making",
      lessonTitle: "How Plants Make Food",
      lessonObjective: "Students explain that plants need light and water to make food.",
    });

    const pseudoLab = result.pseudoLabs[0];
    const simulation = result.simulationDefinitions[0];

    expect(pseudoLab.lessonTitle).toBe("How Plants Make Food");
    expect(pseudoLab.lessonObjective).toBe("Students explain that plants need light and water to make food.");
    expect(pseudoLab.requiredMaterials.length).toBeLessThanOrEqual(6);
    expect(pseudoLab.setupTimeMinutes + pseudoLab.runTimeMinutes + pseudoLab.cleanupTimeMinutes).toBeLessThanOrEqual(60);
    expect(pseudoLab.guardianHomeVariant).toBeTruthy();
    expect(pseudoLab.fallbackIfNoMaterials.length).toBeGreaterThan(10);
    expect(simulation.fallbackStaticVisual.length).toBeGreaterThan(10);
    expect(simulation.guardianGuide).toContain("guardian");
    expect(validateLab(pseudoLab, {
      sourceLessonId: "lesson-science-g5",
      subject: "SCIENCE",
      gradeLevel: 5,
      unitTitle: "Plants and Food Making",
      lessonTitle: "How Plants Make Food",
      lessonObjective: "Students explain that plants need light and water to make food.",
    })).toBeNull();
  });

  it("fails softly when lab generation input is incomplete", () => {
    const result = generateLessonLabSimulationBundleBestEffort({
      sourceLessonId: "lesson-bad",
      subject: "MATH",
      gradeLevel: 7,
      unitTitle: "Fractions",
      lessonTitle: "Fractions",
      lessonObjective: "",
    });

    expect(result.generationStatus).toBe("deferred");
    expect(result.pseudoLabs).toHaveLength(0);
    expect(result.simulationDefinitions).toHaveLength(0);
    expect(result.generationErrors.length).toBeGreaterThan(0);
  });

  it("returns no generated labs for framework-only areas in this phase", () => {
    const result = generateLessonLabSimulationBundle({
      sourceLessonId: "lesson-cs-g8",
      subject: "COMPUTER_SCIENCE",
      gradeLevel: 8,
      unitTitle: "Algorithms",
      lessonTitle: "Intro to Sequencing",
      lessonObjective: "Students explain a simple algorithm.",
    });

    expect(result.pseudoLabs).toHaveLength(0);
    expect(result.simulationDefinitions).toHaveLength(0);
    expect(result.threeDLabDefinitions).toHaveLength(0);
  });
});
