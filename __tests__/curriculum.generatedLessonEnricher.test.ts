import { describe, expect, it } from "vitest";
import { enrichGeneratedLesson } from "@/lib/curriculum/generatedLessonEnricher";

describe("generated lesson enricher", () => {
  it("expands generated lessons above the promotion word threshold without changing progression metadata", () => {
    const result = enrichGeneratedLesson({
      contentId: "math-g3-1-foundations",
      grade: 3,
      subject: "MATH",
      payload: {
        title: "Addition Strategies",
        grade: 3,
        subject: "MATH",
        lessonFormat: "either",
        objectives: ["Students will use addition strategies to solve problems."],
        body: "Short body",
        body_standard: "Short standard body",
        body_block: "Short block body",
        activities: [],
        labs: [],
        moeAlignments: [],
        metadata: {
          topic: "Addition Strategies",
          locale: "LR",
        },
        primaryConcept: "addition",
        prerequisites: ["counting"],
        nextConcepts: ["subtraction"],
        difficulty: "intro",
      },
    });

    expect(result.wordCount).toBeGreaterThanOrEqual(1200);
    expect(result.belowThreshold).toBe(false);
    expect(result.payload.primaryConcept).toBe("addition");
    expect(result.payload.prerequisites).toEqual(["counting"]);
    expect(result.payload.nextConcepts).toEqual(["subtraction"]);
    expect(result.payload.difficulty).toBe("intro");
    expect(typeof result.payload.body_standard).toBe("string");
    expect(result.payload.body_standard).toContain("## Teacher Explanation");
    expect(result.payload.body_standard).toContain("## Materials and Activity Notes");
  });
});
