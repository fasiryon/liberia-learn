import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PilotReadinessScreen } from "@/components/intelligence/PilotReadinessScreen";

vi.setConfig({ testTimeout: 15_000 });

describe("pilot readiness page", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("shows readiness sections", () => {
    const html = renderToStaticMarkup(
      <PilotReadinessScreen
        readinessScore={75}
        readinessLevel="partial"
        blockingIssues={[]}
        nonBlockingIssues={[]}
        teacherActivationStatus="active"
        dataFlowStatus="partial"
        guardianStatus="inactive"
        sections={[
          {
            id: "curriculum",
            title: "Curriculum Readiness",
            ready: true,
            score: 100,
            weight: 30,
            checks: [{ label: "Published lessons present", ready: true, detail: "3 approved lessons scheduled" }],
          },
          {
            id: "ops",
            title: "Ops Readiness",
            ready: false,
            score: 33,
            weight: 10,
            checks: [{ label: "Worker queue present", ready: false, detail: "SQS_QUEUE_URL is not configured" }],
          },
        ]}
        latestEval={{ runAt: "2026-03-28T00:00:00.000Z", passed: true }}
      />
    );

    expect(html).toContain("Curriculum Readiness");
    expect(html).toContain("Ops Readiness");
    expect(html).toContain("Worker queue present");
  });

  it("handles incomplete readiness state", () => {
    const html = renderToStaticMarkup(
      <PilotReadinessScreen
        readinessScore={35}
        readinessLevel="not_ready"
        blockingIssues={[
          {
            code: "eval_failing",
            label: "Eval failing",
            detail: "Latest eval run failed. Fix eval regressions before pilot launch.",
          },
        ]}
        nonBlockingIssues={[]}
        teacherActivationStatus="not_started"
        dataFlowStatus="inactive"
        guardianStatus="inactive"
        sections={[
          {
            id: "ops",
            title: "Ops Readiness",
            ready: false,
            score: 0,
            weight: 10,
            checks: [{ label: "Latest eval pass status", ready: false, detail: "No eval run recorded" }],
          },
        ]}
        latestEval={null}
      />
    );

    expect(html).toContain("Needs work");
    expect(html).toContain("No eval run has been recorded yet.");
  });

  it("returns 404 when feature flag off", async () => {
    const notFound = vi.fn(() => {
      throw new Error("NOT_FOUND");
    });

    vi.doMock("next/navigation", () => ({
      notFound,
      redirect: vi.fn(),
    }));
    vi.doMock("@/lib/auth", () => ({
      getOptionalUser: vi.fn(),
    }));
    vi.doMock("@/lib/serverFlags", () => ({
      isPilotReadinessDashboardEnabled: vi.fn(() => false),
      isPilotReadinessEnabled: vi.fn(() => true),
    }));

    const mod = await import("@/app/admin/pilot-readiness/page");
    await expect(mod.default()).rejects.toThrow("NOT_FOUND");
    expect(notFound).toHaveBeenCalled();
  });
});
