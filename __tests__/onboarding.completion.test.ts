import { describe, expect, it } from "vitest";
import { loadReadinessService } from "@/__tests__/utils/readinessTestHarness";

describe("onboarding completion", () => {
  it("computes completion percent and missing steps from real status", async () => {
    const { getOnboardingReadinessReport } = await loadReadinessService({
      teacherDashboardViews: 0,
      teacherInterventionActions: 0,
      guardianProgressViews: 0,
      guardianSupportRecommendations: 0,
      scheduledApprovedLessons: 0,
    });

    const report = await getOnboardingReadinessReport("school-1");

    expect(report.percentComplete).toBeLessThan(100);
    expect(report.missingSteps).toContain("Curriculum published");
    expect(report.missingSteps).toContain("Teacher engaged");
    expect(report.missingSteps).toContain("Guardian ready");
  });

  it("marks readiness achieved when all steps are complete", async () => {
    const { getOnboardingReadinessReport } = await loadReadinessService();

    const report = await getOnboardingReadinessReport("school-1");

    expect(report.ready).toBe(true);
    expect(report.percentComplete).toBe(100);
    expect(report.missingSteps).toEqual([]);
  });
});
