import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { OnboardingReadinessScreen } from "@/components/intelligence/OnboardingReadinessScreen";

describe("onboarding readiness page", () => {
  it("shows real next steps", () => {
    const html = renderToStaticMarkup(
      <OnboardingReadinessScreen
        percentComplete={50}
        missingSteps={["Configure school"]}
        readinessScore={58}
        readinessLevel="partial"
        steps={[
          {
            id: "configure-school",
            title: "Configure school",
            complete: false,
            href: "/admin/onboarding",
            missing: ["Add at least one teacher"],
          },
          {
            id: "publish-lessons",
            title: "Publish lessons",
            complete: true,
            href: "/admin/curriculum",
            missing: [],
          },
        ]}
      />
    );

    expect(html).toContain("Configure school");
    expect(html).toContain("Publish lessons");
    expect(html).toContain("Add at least one teacher");
  });

  it("does not render fake completion states", () => {
    const html = renderToStaticMarkup(
      <OnboardingReadinessScreen
        percentComplete={0}
        missingSteps={["Verify delivery"]}
        readinessScore={20}
        readinessLevel="not_ready"
        steps={[
          {
            id: "verify-delivery",
            title: "Verify delivery",
            complete: false,
            href: "/teacher/delivery-report",
            missing: ["Verify lesson delivery is active"],
          },
        ]}
      />
    );

    expect(html).toContain("Incomplete");
    expect(html).toContain("Verify lesson delivery is active");
    expect(html).not.toContain("All set");
  });
});
