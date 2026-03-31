import { describe, expect, it } from "vitest";
import {
  buildProgressionPatch,
  validateProgressionRows,
} from "@/lib/curriculum/progressionEnforcer";

describe("curriculum progression enforcer", () => {
  it("adds progression metadata to generated lesson payloads", () => {
    const patch = buildProgressionPatch({
      id: "row-1",
      grade: 4,
      subject: "SCIENCE",
      status: "generated",
      unitId: "science-g4-1-observation-and-scientific-thinking",
      orderInUnit: 1,
      payload: {
        title: "Observation and Scientific Thinking: Foundations",
        unitTitle: "Observation and Scientific Thinking",
      },
    });

    expect(patch.payload.primaryConcept).toBe("scientific_observation");
    expect(patch.payload.prerequisites).toEqual([]);
    expect(patch.payload.nextConcepts).toEqual(["living_things"]);
    expect(patch.payload.difficulty).toBe("intro");
  });

  it("validates patched rows without progression violations", () => {
    const rows = [
      {
        id: "row-1",
        grade: 4,
        subject: "SCIENCE",
        status: "generated",
        unitId: "science-g4-1-observation-and-scientific-thinking",
        orderInUnit: 1,
        payload: {
          title: "Observation and Scientific Thinking: Foundations",
          unitTitle: "Observation and Scientific Thinking",
          primaryConcept: "scientific_observation",
          prerequisites: [],
          nextConcepts: ["living_things"],
          difficulty: "intro",
        },
      },
      {
        id: "row-2",
        grade: 4,
        subject: "SCIENCE",
        status: "generated",
        unitId: "science-g4-1-observation-and-scientific-thinking",
        orderInUnit: 5,
        payload: {
          title: "Observation and Scientific Thinking: Assessment and Reflection",
          unitTitle: "Observation and Scientific Thinking",
          primaryConcept: "scientific_observation",
          prerequisites: ["scientific_observation"],
          nextConcepts: ["living_things"],
          difficulty: "advanced",
        },
      },
    ];

    const validations = validateProgressionRows(rows);
    expect(validations.SCIENCE).toEqual([]);
  });
});
