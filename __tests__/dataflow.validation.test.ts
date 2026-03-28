import { describe, expect, it } from "vitest";
import { loadReadinessService } from "@/__tests__/utils/readinessTestHarness";

describe("data flow validation", () => {
  it("reports inactive when no signals exist", async () => {
    const { getPilotReadinessReport } = await loadReadinessService({
      performanceEvents: 0,
      confusionSignals: 0,
      interventionsGenerated: 0,
    });

    const report = await getPilotReadinessReport("school-1");

    expect(report.dataFlowStatus).toBe("inactive");
  });

  it("reports partial when only some signals exist", async () => {
    const { getPilotReadinessReport } = await loadReadinessService({
      performanceEvents: 6,
      confusionSignals: 0,
      interventionsGenerated: 0,
    });

    const report = await getPilotReadinessReport("school-1");

    expect(report.dataFlowStatus).toBe("partial");
  });

  it("reports active when events, signals, and interventions all exist", async () => {
    const { getPilotReadinessReport } = await loadReadinessService({
      performanceEvents: 10,
      confusionSignals: 4,
      interventionsGenerated: 2,
    });

    const report = await getPilotReadinessReport("school-1");

    expect(report.dataFlowStatus).toBe("active");
  });
});
