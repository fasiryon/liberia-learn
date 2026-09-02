import { describe, expect, it } from "vitest";
import { computeDisagreement } from "@/lib/quality/calibration";

describe("calibration disagreement", () => {
  it("reports 100% agreement when all reviewers pick the same outcome", () => {
    const result = computeDisagreement([{ reviewerProfileId: "r1", outcome: "PASS" }, { reviewerProfileId: "r2", outcome: "PASS" }]);
    expect(result.agreementRate).toBe(1);
    expect(result.disagreements).toEqual([]);
  });

  it("surfaces every pairwise disagreement rather than hiding it", () => {
    const result = computeDisagreement([{ reviewerProfileId: "r1", outcome: "PASS" }, { reviewerProfileId: "r2", outcome: "FAIL" }]);
    expect(result.agreementRate).toBe(0);
    expect(result.disagreements).toEqual([{ a: "r1", b: "r2" }]);
  });
});
