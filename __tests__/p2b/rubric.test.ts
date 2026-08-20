import { describe, expect, it } from "vitest";
import { P2B_RUBRIC_V1, validateRubricResponses } from "@/lib/curriculum/review/rubric";

describe("P2-B rubric", () => {
  it("distinguishes NOT_APPLICABLE from a missing response", () => {
    const complete = Object.fromEntries(P2B_RUBRIC_V1.map((dimension) => [dimension, { value: "NOT_APPLICABLE" as const }]));
    expect(validateRubricResponses(complete)).toEqual([]);
    delete complete.language_quality;
    expect(validateRubricResponses(complete)).toContain("MISSING_RUBRIC_RESPONSE:language_quality");
  });
});
