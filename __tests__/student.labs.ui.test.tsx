import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LabSessionClient } from "@/app/student/labs/LabSessionClient";

describe("LabSessionClient", () => {
  it("renders the lab title and materials", () => {
    const html = renderToStaticMarkup(
      <LabSessionClient
        sessionId="session-1"
        initialCompleted={false}
        lab={{
          labId: "lab-1",
          title: "Plant Growth Lab",
          estimatedMinutes: 25,
          payload: {
            labObjective: "Measure and compare plant growth.",
            materialsNeeded: ["paper", "pencil"],
            procedure: [
              { stepNumber: 1, instruction: "Gather the materials.", teacherNote: null, durationMinutes: 5 },
            ],
            observationForm: [
              { field: "height", prompt: "What height did you record?", inputType: "number", choices: null },
            ],
            analysisQuestions: [{ question: "What did you notice?" }],
          },
        }}
      />
    );

    expect(html).toContain("Plant Growth Lab");
    expect(html).toContain("Measure and compare plant growth.");
    expect(html).toContain("paper");
    expect(html).toContain("Begin Lab");
  });
});
