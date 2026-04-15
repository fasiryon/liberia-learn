import { describe, expect, it } from "vitest";

import {
  STUDENT_LESSON_HELP_SUGGESTIONS,
  gradeToTutorBand,
} from "@/lib/ai/studentLessonSupport";

describe("student lesson AI support helpers", () => {
  it("returns the Sprint 10 suggested lesson help prompts", () => {
    expect(STUDENT_LESSON_HELP_SUGGESTIONS).toEqual([
      "Explain this lesson in simpler words",
      "Give me a real-life example of this",
      "What should I know before this lesson?",
    ]);
  });

  it("maps grade levels to the expected tutor bands", () => {
    expect(gradeToTutorBand(2)).toBe("lower_primary");
    expect(gradeToTutorBand(5)).toBe("upper_primary");
    expect(gradeToTutorBand(10)).toBe("secondary");
  });
});
