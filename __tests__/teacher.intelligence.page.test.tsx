import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TeacherDashboardScreen } from "@/components/intelligence/TeacherDashboardScreen";

describe("teacher intelligence page", () => {
  it("renders summary cards", () => {
    const html = renderToStaticMarkup(
      <TeacherDashboardScreen
        summary={{
          teacherId: "teacher-1",
          schoolId: "school-1",
          studentCount: 12,
          avgScore: 0.67,
          studentsStruggling: 3,
          activeInterventions: 2,
          topConfusionTags: ["fractions", "reading"],
        }}
        confusions={[]}
        interventions={[]}
      />
    );

    expect(html).toContain("Class average score");
    expect(html).toContain("67%");
    expect(html).toContain("Students struggling");
    expect(html).toContain("fractions, reading");
  });

  it("renders empty state", () => {
    const html = renderToStaticMarkup(
      <TeacherDashboardScreen
        summary={null}
        confusions={[]}
        interventions={[]}
      />
    );

    expect(html).toContain("No confusion signals need attention right now.");
    expect(html).toContain("No pending interventions at the moment.");
  });

  it("renders interventions list", () => {
    const html = renderToStaticMarkup(
      <TeacherDashboardScreen
        summary={null}
        confusions={[]}
        interventions={[
          {
            id: "int-1",
            studentId: "student-1",
            studentName: "Mariama",
            recommendationType: "extra_practice",
            reason: "Student is struggling with repeated low scores",
            confidenceScore: 0.85,
            status: "pending",
            createdAt: new Date().toISOString(),
            workflowState: "Needs review",
          },
        ]}
        onAction={vi.fn(async () => undefined)}
      />
    );

    expect(html).toContain("Mariama");
    expect(html).toContain("extra practice");
    expect(html).toContain("Mark actioned");
  });
});
