export type LearningExperienceSignal = {
  examStyleItemCount: number;
  totalAssessmentItemCount: number;
  inquiryTaskCount: number;
  applicationTaskCount: number;
  openResponseCount: number;
  projectCount: number;
  transferTaskCount: number;
  masteryTargetCount: number;
  masteryTargetsAtBaselineCount: number;
  repeatedPatternCount: number;
};

export type TeachToTestWarning = {
  code: string;
  severity: "INFO" | "WARNING" | "HIGH";
  rationale: string;
  automation: "REPORT_ONLY";
};

export function detectTeachToTestRisk(signal: LearningExperienceSignal): TeachToTestWarning[] {
  const warnings: TeachToTestWarning[] = [];
  const examShare = signal.totalAssessmentItemCount
    ? signal.examStyleItemCount / signal.totalAssessmentItemCount
    : 0;
  if (signal.totalAssessmentItemCount >= 10 && examShare > 0.65) {
    warnings.push({ code: "EXCESSIVE_EXAM_STYLE_SHARE", severity: "HIGH", rationale: "More than 65% of assessment items are exam-style.", automation: "REPORT_ONLY" });
  }
  if (signal.inquiryTaskCount + signal.applicationTaskCount === 0) {
    warnings.push({ code: "NO_INQUIRY_OR_APPLICATION", severity: "HIGH", rationale: "No inquiry or authentic application task is present.", automation: "REPORT_ONLY" });
  }
  if (signal.openResponseCount === 0) {
    warnings.push({ code: "NO_OPEN_RESPONSE", severity: "WARNING", rationale: "No open-response opportunity is present.", automation: "REPORT_ONLY" });
  }
  if (signal.projectCount === 0 && signal.transferTaskCount === 0) {
    warnings.push({ code: "NO_PROJECT_OR_TRANSFER", severity: "WARNING", rationale: "No project or unfamiliar transfer task is present.", automation: "REPORT_ONLY" });
  }
  if (signal.masteryTargetCount > 0 && signal.masteryTargetsAtBaselineCount / signal.masteryTargetCount > 0.5) {
    warnings.push({ code: "MASTERY_COLLAPSES_TO_BASELINE", severity: "HIGH", rationale: "Most platform mastery targets do not exceed the external baseline.", automation: "REPORT_ONLY" });
  }
  if (signal.repeatedPatternCount >= 5) {
    warnings.push({ code: "REPEATED_EXAM_PATTERN", severity: "WARNING", rationale: "Repeated item patterns may reward recognition over understanding.", automation: "REPORT_ONLY" });
  }
  return warnings;
}
