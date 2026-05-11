import {
  confidenceBand,
  scoreDetectorSignals,
  severityFromConfidence,
} from "@/lib/autonomous/detectors/recommendationScoringService";
import type {
  DetectionFinding,
  DetectorDefinition,
  DetectorEvidence,
  DetectorId,
  DetectorSignal,
} from "@/lib/autonomous/detectors/types";

function finding(
  evidence: DetectorEvidence,
  findingType: string,
  title: string,
  explanation: string,
  signals: DetectorSignal[],
  suggestedActions: string[],
  suggestedInterventions: string[] = [],
  suggestedCurriculumImprovements: string[] = []
): DetectionFinding[] {
  const scored = scoreDetectorSignals(signals);
  if (scored.triggeredSignals.length === 0 || scored.confidence < 0.45) return [];
  const severity = severityFromConfidence(scored.confidence);
  return [
    {
      findingType,
      title,
      severity,
      confidence: scored.confidence,
      riskLevel: severity === "high" ? "medium" : "low",
      explanation: `${explanation} Confidence band: ${confidenceBand(scored.confidence)}.`,
      evidence: scored.triggeredSignals.flatMap((signal) => signal.evidence),
      signals: scored.triggeredSignals,
      recommendation: {
        title,
        summary: explanation,
        suggestedActions,
        suggestedInterventions,
        suggestedCurriculumImprovements,
        approvalRequired: true,
      },
    },
  ];
}

const base = {
  allowedActions: ["recommendation.create", "alert.suggest", "intervention.suggest", "follow_up.suggest"],
  forbiddenActions: ["grade.change", "message.send", "curriculum.publish", "export.raw_pii", "policy.execute"],
  confidenceContract: "Weighted deterministic thresholds with cited evidence; advisory confidence cannot bypass approval.",
};

export const detectorRegistry: Record<DetectorId, DetectorDefinition> = {
  "student-risk": {
    ...base,
    id: "student-risk",
    name: "Student Risk Detector",
    ownerDomain: "learning_intelligence",
    featureFlag: "ENABLE_DETECTOR_EXECUTION",
    scope: "student",
    allowedTenantScopes: ["school"],
    allowedEventTriggers: ["mastery.snapshot.created", "attendance.recorded", "assessment.submitted", "assignment.updated"],
    requiredEvidence: ["MasterySnapshot", "Attendance", "AssessmentAttempt", "StudentProgress"],
    riskCeiling: "medium",
    escalationRoute: "teacher_or_school_admin",
    evaluationMetric: "risk_recommendation_outcome",
    detect: (evidence) =>
      [
        ...finding(
          evidence,
          "mastery_collapse",
          "Review mastery collapse",
          "Recent mastery, attendance, assessment, or assignment signals crossed deterministic risk thresholds.",
          evidence.signals.filter((s) =>
            ["masteryCollapsePct", "attendanceDeclinePct", "failedAssessmentCount", "assignmentAvoidanceCount", "disengagementEventCount"].includes(s.key)
          ),
          ["Teacher reviews the student history", "Confirm whether a current intervention is already active"],
          ["Open or update a targeted intervention cycle", "Schedule a short formative reassessment"]
        ),
      ],
  },
  "teacher-support": {
    ...base,
    id: "teacher-support",
    name: "Teacher Support Detector",
    ownerDomain: "teacher_operations",
    featureFlag: "ENABLE_DETECTOR_EXECUTION",
    scope: "teacher",
    allowedTenantScopes: ["school"],
    allowedEventTriggers: ["assignment.created", "intervention.updated", "curriculum.flag.created"],
    requiredEvidence: ["TeacherAssignment", "InterventionRecommendation", "CurriculumFlag", "LearningEvent"],
    riskCeiling: "medium",
    escalationRoute: "school_admin",
    evaluationMetric: "teacher_support_resolution_time",
    detect: (evidence) =>
      finding(
        evidence,
        "teacher_support_needed",
        "Review teacher support load",
        "Teacher workload or classroom support signals crossed deterministic support thresholds.",
        evidence.signals.filter((s) =>
          ["ungradedSubmissionCount", "slowInterventionResponseDays", "classPerformanceDeclinePct", "curriculumFrictionCount"].includes(s.key)
        ),
        ["School admin reviews grading and intervention queue", "Offer planning or grading support"],
        ["Prioritize pending intervention responses"]
      ),
  },
  "curriculum-gap": {
    ...base,
    id: "curriculum-gap",
    name: "Curriculum Gap Detector",
    ownerDomain: "curriculum_intelligence",
    featureFlag: "ENABLE_DETECTOR_EXECUTION",
    scope: "curriculum",
    allowedTenantScopes: ["school", "district", "national_aggregate"],
    allowedEventTriggers: ["assessment.submitted", "curriculum.flag.created", "lesson.completed"],
    requiredEvidence: ["AssessmentAttempt", "CurriculumContent", "CurriculumFlag", "LearningEvent"],
    riskCeiling: "medium",
    escalationRoute: "curriculum_reviewer",
    evaluationMetric: "lesson_effectiveness_delta",
    detect: (evidence) =>
      finding(
        evidence,
        "curriculum_gap",
        "Review curriculum bottleneck",
        "Comprehension, assessment, bottleneck, or lesson effectiveness signals crossed deterministic thresholds.",
        evidence.signals.filter((s) =>
          ["lowComprehensionPct", "repeatedAssessmentFailurePct", "curriculumBottleneckCount", "weakLessonEffectivenessPct"].includes(s.key)
        ),
        ["Curriculum reviewer inspects the lesson evidence", "Compare nearby lessons before changing content"],
        [],
        ["Draft a lesson clarification", "Add practice examples", "Review assessment alignment"]
      ),
  },
  "school-compliance": {
    ...base,
    id: "school-compliance",
    name: "School Compliance Detector",
    ownerDomain: "school_operations",
    featureFlag: "ENABLE_DETECTOR_EXECUTION",
    scope: "school",
    allowedTenantScopes: ["school"],
    allowedEventTriggers: ["workflow.checkpointed", "lesson.delivered", "report.generated"],
    requiredEvidence: ["ScheduledWork", "InterventionRecommendation", "LearningEvent", "AuditLog"],
    riskCeiling: "medium",
    escalationRoute: "school_admin",
    evaluationMetric: "compliance_gap_closed",
    detect: (evidence) =>
      finding(
        evidence,
        "school_compliance_gap",
        "Review school compliance gap",
        "Coverage, reporting, intervention inactivity, or operational consistency signals crossed deterministic thresholds.",
        evidence.signals.filter((s) =>
          ["curriculumCoveragePct", "reportingGapDays", "interventionInactivityDays", "operationalInconsistencyCount"].includes(s.key)
        ),
        ["School admin reviews coverage and reporting backlog", "Assign a responsible staff follow-up"]
      ),
  },
  "guardian-communication": {
    ...base,
    id: "guardian-communication",
    name: "Guardian Communication Detector",
    ownerDomain: "guardian_engagement",
    featureFlag: "ENABLE_GUARDIAN_RECOMMENDATIONS",
    scope: "guardian",
    allowedTenantScopes: ["school"],
    allowedEventTriggers: ["mastery.snapshot.created", "attendance.recorded", "intervention.updated"],
    requiredEvidence: ["MasterySnapshot", "Attendance", "Intervention", "GuardianMessage"],
    riskCeiling: "medium",
    escalationRoute: "teacher_approval",
    evaluationMetric: "guardian_followup_completion",
    detect: (evidence) =>
      finding(
        evidence,
        "guardian_followup_needed",
        "Review guardian follow-up draft",
        "Sustained decline, attendance concern, or intervention follow-up signals crossed deterministic thresholds.",
        evidence.signals.filter((s) =>
          ["sustainedDeclinePct", "attendanceConcernCount", "interventionFollowupDays"].includes(s.key)
        ),
        ["Teacher reviews whether guardian outreach is appropriate", "Draft message only after school policy check"],
        ["Update intervention follow-up notes"]
      ),
  },
  "moe-governance": {
    ...base,
    id: "moe-governance",
    name: "MOE Governance Detector",
    ownerDomain: "moe_governance",
    featureFlag: "ENABLE_DETECTOR_MOE_AGGREGATION",
    scope: "moe",
    allowedTenantScopes: ["district", "national_aggregate"],
    allowedEventTriggers: ["aggregate.metric.updated", "policy.check.completed"],
    requiredEvidence: ["ImpactSnapshot", "InterventionLog", "LearningEvent", "AuditLog"],
    riskCeiling: "high",
    escalationRoute: "moe_official_and_platform_admin",
    evaluationMetric: "governance_recommendation_reviewed",
    detect: (evidence) =>
      finding(
        evidence,
        "moe_governance_signal",
        "Review MOE governance signal",
        "Aggregate district performance, policy compliance, school anomaly, or national concern thresholds were crossed.",
        evidence.signals.filter((s) =>
          ["districtPerformanceDeclinePct", "policyComplianceRiskCount", "schoolAnomalyCount", "nationalConcernScore"].includes(s.key)
        ),
        ["MOE reviewer inspects aggregate evidence", "Request school-level review through governed channels"]
      ),
  },
  "national-trend": {
    ...base,
    id: "national-trend",
    name: "National Trend Detector",
    ownerDomain: "national_intelligence",
    featureFlag: "ENABLE_NATIONAL_TREND_ANALYSIS",
    scope: "national",
    allowedTenantScopes: ["national_aggregate"],
    allowedEventTriggers: ["aggregate.metric.updated"],
    requiredEvidence: ["ImpactSnapshot", "LearningEvent", "InterventionLog"],
    riskCeiling: "high",
    escalationRoute: "moe_policy_review",
    evaluationMetric: "trend_review_resolution",
    detect: (evidence) =>
      finding(
        evidence,
        "national_trend_shift",
        "Review national trend shift",
        "Aggregate literacy, dropout cluster, regional curriculum weakness, or systemic performance signals crossed thresholds.",
        evidence.signals.filter((s) =>
          ["literacyDeclinePct", "dropoutRiskClusterCount", "curriculumWeaknessRegionCount", "systemicPerformanceShiftPct"].includes(s.key)
        ),
        ["MOE reviews aggregate trend evidence", "Open policy analysis without exposing raw student records"],
        [],
        ["Prioritize national curriculum review in affected subjects or regions"]
      ),
  },
};

export function listDetectors() {
  return Object.values(detectorRegistry);
}

export function getDetector(detectorId: DetectorId) {
  return detectorRegistry[detectorId];
}
