import { describe, expect, it } from "vitest";
import * as legacy from "@/app/api/student/learning-authority/grade4-math/route";
import * as governed from "@/app/api/student/learning-authority/next-action/route";

describe("legacy Grade 4 route containment", () => {
  it("uses the exact governed decision and submission handlers", () => {
    expect(legacy.GET).toBe(governed.GET);
    expect(legacy.POST).toBe(governed.POST);
  });
});
