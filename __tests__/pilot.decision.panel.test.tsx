import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PilotReadinessScreen } from "@/components/intelligence/PilotReadinessScreen";

describe("pilot decision panel", () => {
  it("renders the readiness decision state", () => {
    const html = renderToStaticMarkup(
      <PilotReadinessScreen
        readinessScore={88}
        readinessLevel="ready"
        blockingIssues={[]}
        nonBlockingIssues={[]}
        teacherActivationStatus="engaged"
        dataFlowStatus="active"
        guardianStatus="active"
        sections={[]}
        latestEval={{ runAt: "2026-03-28T00:00:00.000Z", passed: true }}
      />
    );

    expect(html).toContain("88/100");
    expect(html).toContain("Pilot Ready");
    expect(html).toContain("Safe to start pilot.");
  });

  it("renders blocking issues when not ready", () => {
    const html = renderToStaticMarkup(
      <PilotReadinessScreen
        readinessScore={42}
        readinessLevel="partial"
        blockingIssues={[
          {
            code: "no_published_lessons",
            label: "No published lessons",
            detail: "Publish approved lessons before starting a pilot.",
          },
        ]}
        nonBlockingIssues={[]}
        teacherActivationStatus="active"
        dataFlowStatus="partial"
        guardianStatus="inactive"
        sections={[]}
        latestEval={null}
      />
    );

    expect(html).toContain("Fix blockers before pilot.");
    expect(html).toContain("No published lessons");
    expect(html).toContain("Blocking issues");
  });
});
