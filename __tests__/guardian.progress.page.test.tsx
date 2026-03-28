import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { GuardianProgressScreen } from "@/components/intelligence/GuardianProgressScreen";

describe("guardian progress page", () => {
  it("renders guardian-friendly summary", () => {
    const html = renderToStaticMarkup(
      <GuardianProgressScreen
        data={{
          avgScore: 0.71,
          masteryLevel: "developing",
          improvementTrend: "improving",
          hasSuggestedSupport: true,
          supportSuggestions: ["Ask your child to explain one thing they learned today."],
        }}
      />
    );

    expect(html).toContain("Your child&#x27;s progress");
    expect(html).toContain("71%");
    expect(html).toContain("Building confidence");
  });

  it("does not expose confusion internals", () => {
    const html = renderToStaticMarkup(
      <GuardianProgressScreen
        data={{
          avgScore: 0.5,
          masteryLevel: "struggling",
          improvementTrend: "declining",
          hasSuggestedSupport: false,
          supportSuggestions: [],
        }}
      />
    );

    expect(html).not.toContain("ConfusionSignal");
    expect(html).not.toContain("severity");
    expect(html).not.toContain("intervention");
  });

  it("handles no-data state", () => {
    const html = renderToStaticMarkup(<GuardianProgressScreen data={null} />);
    expect(html).toContain("Progress details will appear here once your child starts completing learning work.");
  });
});
