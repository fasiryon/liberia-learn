import { describe, expect, it } from "vitest";
import { loadReadinessService } from "@/__tests__/utils/readinessTestHarness";

describe("guardian activation", () => {
  it("stays inactive without guardian usage", async () => {
    const { getPilotReadinessReport } = await loadReadinessService({
      guardianProgressViews: 0,
      guardianSupportRecommendations: 1,
    });

    const report = await getPilotReadinessReport("school-1");

    expect(report.guardianStatus).toBe("inactive");
  });

  it("becomes active when guardian usage and support suggestions exist", async () => {
    const { getPilotReadinessReport } = await loadReadinessService({
      guardianProgressViews: 2,
      guardianSupportRecommendations: 2,
    });

    const report = await getPilotReadinessReport("school-1");

    expect(report.guardianStatus).toBe("active");
  });
});
