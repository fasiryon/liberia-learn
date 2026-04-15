import { describe, expect, it } from "vitest";
import { resolveLessonTitle } from "@/lib/lessons/resolveLessonTitle";

describe("resolveLessonTitle", () => {
  it("prefers a real lesson title from payload", () => {
    expect(
      resolveLessonTitle({
        payload: { title: "Fractions in Everyday Markets" },
        subject: "MATH",
        fallbackTitle: "content_math_001",
      })
    ).toBe("Fractions in Everyday Markets");
  });

  it("falls back to topic before subject label", () => {
    expect(
      resolveLessonTitle({
        payload: { topic: "Balancing Equations" },
        subject: "MATH",
      })
    ).toBe("Balancing Equations");
  });

  it("rejects raw identifier fallbacks and returns a subject-based title", () => {
    expect(
      resolveLessonTitle({
        payload: {},
        subject: "COMPUTER_SCIENCE",
        fallbackTitle: "lesson_db_01af98ce",
      })
    ).toBe("COMPUTER SCIENCE Lesson");
  });
});
