import { describe, expect, it } from "vitest";
import { learnerExperienceAuthority } from "@/lib/student/learnerExperienceAuthority";

describe("learner experience authority boundary", () => {
  it("uses the Learning Orchestrator for a governed release learner", () => {
    expect(learnerExperienceAuthority(4, "MATH")).toEqual({
      mode: "GOVERNED",
      nextActionAuthority: "LEARNING_ORCHESTRATOR",
      releaseId: "lr-moe-g4-math-fractions-2026.1",
    });
  });

  it("uses ordinary schoolwork when no release is registered", () => {
    expect(learnerExperienceAuthority(7, "MATH")).toEqual({
      mode: "ORDINARY_SCHOOLWORK",
      nextActionAuthority: "SCHEDULE_AND_ASSIGNMENTS",
      releaseId: null,
    });
  });

  it("does not give the legacy adaptive recommender learner authority", () => {
    expect(learnerExperienceAuthority(4, "MATH").nextActionAuthority).not.toBe("LEGACY_ADAPTIVE_RECOMMENDER");
    expect(learnerExperienceAuthority(7, "MATH").nextActionAuthority).not.toBe("LEGACY_ADAPTIVE_RECOMMENDER");
  });
});
