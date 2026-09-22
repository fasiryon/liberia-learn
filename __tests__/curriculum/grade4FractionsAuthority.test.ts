import { describe, expect, it } from "vitest";
import { GRADE4_FRACTIONS_LESSON } from "@/lib/curriculum/authority/grade4FractionsLesson";
import { GRADE4_MATH_ONTOLOGY_RELEASE, validateOntologyRelease } from "@/lib/learning-authority/governedGrade4Math";

describe("Grade 4 fractions lesson authority", () => {
  it("contains a complete exact-version lesson for the released concept", () => {
    const binding = GRADE4_MATH_ONTOLOGY_RELEASE.contentBindings[0];
    expect(binding.contentId).toBe(GRADE4_FRACTIONS_LESSON.contentId);
    expect(binding.contentVersion).toBe(GRADE4_FRACTIONS_LESSON.version);
    expect(GRADE4_FRACTIONS_LESSON.standardCode).toBe("LR-MATH-G4_6-02");
    expect(GRADE4_FRACTIONS_LESSON.payload.body.length).toBeGreaterThan(500);
    expect(GRADE4_FRACTIONS_LESSON.payload.objectives.length).toBeGreaterThanOrEqual(3);
    expect(GRADE4_FRACTIONS_LESSON.payload.activities.length).toBeGreaterThanOrEqual(3);
    expect(GRADE4_FRACTIONS_LESSON.provenance.authority).toBe("LIBERIALEARN_FOUNDER_REVIEW");
    expect(GRADE4_FRACTIONS_LESSON.provenance.authorityScope).toContain("not MOE approval");
  });

  it("pins the lesson to the governed instruction ToolPolicy", () => {
    expect(() => validateOntologyRelease(GRADE4_MATH_ONTOLOGY_RELEASE)).not.toThrow();
    expect(GRADE4_MATH_ONTOLOGY_RELEASE.contentBindings[0].toolPolicyId).toBe("g4-math-instruction-tools");
  });
});
