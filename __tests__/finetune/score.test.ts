import { describe, it, expect } from "vitest";
import { scoreLessonBody } from "@/lib/finetune/score";

describe("scoreLessonBody", () => {
  it("scores a rich, complete lesson higher than a stub", () => {
    const rich =
      "## Objective\n" +
      "word ".repeat(1500) +
      "\nWorked Example: Fatu in Monrovia buys rice. " +
      "\nGuided Practice: ... Independent Practice: ... Assessment: ...";
    const stub = "Do the lesson.";
    expect(scoreLessonBody(rich, 5)).toBeGreaterThan(scoreLessonBody(stub, 5));
    expect(scoreLessonBody(rich, 5)).toBeGreaterThan(60);
  });

  it("returns 0 for empty content", () => {
    expect(scoreLessonBody("", 5)).toBe(0);
    expect(scoreLessonBody("   ", 5)).toBe(0);
  });

  it("is bounded 0..100", () => {
    const s = scoreLessonBody("word ".repeat(5000) + "objective example practice assessment Monrovia", 8);
    expect(s).toBeLessThanOrEqual(100);
    expect(s).toBeGreaterThanOrEqual(0);
  });
});
