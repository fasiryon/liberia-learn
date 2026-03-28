import { describe, expect, it } from "vitest";
import { loadReadinessService } from "@/__tests__/utils/readinessTestHarness";

describe("pilot readiness scoring", () => {
  it("computes a weighted readiness score and ready level", async () => {
    const { getPilotReadinessReport } = await loadReadinessService();

    const report = await getPilotReadinessReport("school-1");

    expect(report.readinessScore).toBe(100);
    expect(report.readinessLevel).toBe("ready");
    expect(report.blockingIssues).toHaveLength(0);
  });

  it("classifies blocking vs non-blocking issues", async () => {
    const { getPilotReadinessReport } = await loadReadinessService({
      scheduledApprovedLessons: 0,
      performanceEvents: 5,
      confusionSignals: 0,
      interventionsGenerated: 0,
      guardianSupportRecommendations: 0,
      guardianProgressViews: 0,
      latestEvalRun: { runAt: new Date("2026-03-28T00:00:00.000Z"), passed: false },
    });

    const report = await getPilotReadinessReport("school-1");

    expect(report.readinessLevel).toBe("partial");
    expect(report.blockingIssues.map((entry) => entry.code)).toContain(
      "no_published_lessons"
    );
    expect(report.blockingIssues.map((entry) => entry.code)).toContain("eval_failing");
    expect(report.nonBlockingIssues.map((entry) => entry.code)).toContain(
      "limited_guardian_usage"
    );
    expect(report.nonBlockingIssues.map((entry) => entry.code)).toContain(
      "partial_data_flow"
    );
  });
});
