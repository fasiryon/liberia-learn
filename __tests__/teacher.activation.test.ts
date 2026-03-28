import { describe, expect, it } from "vitest";
import { loadReadinessService } from "@/__tests__/utils/readinessTestHarness";

describe("teacher activation", () => {
  it("marks activation as not_started without recent dashboard use", async () => {
    const { getPilotReadinessReport } = await loadReadinessService({
      teacherDashboardViews: 0,
      teacherInterventionActions: 0,
    });

    const report = await getPilotReadinessReport("school-1");

    expect(report.teacherActivationStatus).toBe("not_started");
  });

  it("marks activation as engaged when teachers review and act", async () => {
    const { getPilotReadinessReport } = await loadReadinessService({
      teacherDashboardViews: 2,
      performanceEvents: 12,
      interventionsGenerated: 3,
      teacherInterventionActions: 1,
    });

    const report = await getPilotReadinessReport("school-1");

    expect(report.teacherActivationStatus).toBe("engaged");
  });
});
