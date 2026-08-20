import { describe, expect, it } from "vitest";
import { detectTeachToTestRisk } from "@/lib/curriculum/benchmarking/antiTeachToTest";
import { assertSafeExamPreparationLabel, buildOriginalAssessmentContract, LIBERIALEARN_EXAM_PREPARATION_LABEL } from "@/lib/curriculum/benchmarking/originalAssessment";

describe("P2-C original assessment architecture", () => {
  it("labels generated questions as LiberiaLearn content, never past papers", () => {
    expect(buildOriginalAssessmentContract({ examination: "LJHSCE", competencyCodes: ["BASE.G9.MATH.1"], readinessLayer: "BASELINE_READINESS", promptKey: "assessment.original.v1", sourceEvidenceRefs: ["source:v1"] })).toMatchObject({
      label: "LiberiaLearn WAEC Preparation",
      contentOrigin: "LIBERIALEARN_GENERATED_EXAM_STYLE",
      externalAuthorityStatus: "NOT_CLAIMED",
    });
  });

  it("supports a separate deeper LiberiaLearn mastery layer", () => {
    expect(buildOriginalAssessmentContract({ examination: "LSHSCE", competencyCodes: ["LL.G12.BIO.M1"], readinessLayer: "LIBERIALEARN_MASTERY", promptKey: "assessment.original.v1", sourceEvidenceRefs: ["source:v1"] }).readinessLayer).toBe("LIBERIALEARN_MASTERY");
  });

  it("blocks official or approved WAEC labels", () => {
    expect(() => assertSafeExamPreparationLabel("Official WAEC Course")).toThrow("EXTERNAL_AUTHORITY_LABEL_PROHIBITED");
    expect(() => assertSafeExamPreparationLabel("WAEC Approved Practice")).toThrow("EXTERNAL_AUTHORITY_LABEL_PROHIBITED");
    expect(() => assertSafeExamPreparationLabel(LIBERIALEARN_EXAM_PREPARATION_LABEL)).not.toThrow();
  });
});

describe("P2-C anti-teach-to-test report", () => {
  it("reports exam concentration and missing deeper learning without auto-rejecting", () => {
    const warnings = detectTeachToTestRisk({ examStyleItemCount: 18, totalAssessmentItemCount: 20, inquiryTaskCount: 0, applicationTaskCount: 0, openResponseCount: 0, projectCount: 0, transferTaskCount: 0, masteryTargetCount: 4, masteryTargetsAtBaselineCount: 3, repeatedPatternCount: 7 });
    expect(warnings.map((warning) => warning.code)).toEqual(expect.arrayContaining(["EXCESSIVE_EXAM_STYLE_SHARE", "NO_INQUIRY_OR_APPLICATION", "NO_OPEN_RESPONSE", "NO_PROJECT_OR_TRANSFER", "MASTERY_COLLAPSES_TO_BASELINE", "REPEATED_EXAM_PATTERN"]));
    expect(warnings.every((warning) => warning.automation === "REPORT_ONLY")).toBe(true);
  });

  it("does not warn on a broad, balanced learning design", () => {
    expect(detectTeachToTestRisk({ examStyleItemCount: 4, totalAssessmentItemCount: 20, inquiryTaskCount: 3, applicationTaskCount: 5, openResponseCount: 4, projectCount: 2, transferTaskCount: 3, masteryTargetCount: 5, masteryTargetsAtBaselineCount: 1, repeatedPatternCount: 0 })).toEqual([]);
  });
});
