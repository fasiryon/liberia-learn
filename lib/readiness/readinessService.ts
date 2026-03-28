import fs from "fs";
import path from "path";
import { prisma } from "@/lib/db";
import { curriculumFramework } from "@/lib/curriculum/framework";
import {
  isAuditImmutabilityEnabled,
  isConfusionDetectionEnabled,
  isEvalDbLoggingEnabled,
  isGuardianProgressViewEnabled,
  isInterventionEngineEnabled,
  isPilotReadinessDashboardEnabled,
  isPromptRegistryEnabled,
  isTeacherIntelligenceDashboardEnabled,
} from "@/lib/serverFlags";
import { isQueueConfigured } from "@/lib/queue";

export type ReadinessCheck = {
  label: string;
  ready: boolean;
  detail: string;
};

export type ReadinessSection = {
  id: string;
  title: string;
  ready: boolean;
  score: number;
  weight: number;
  checks: ReadinessCheck[];
};

export type ReadinessIssue = {
  code: string;
  label: string;
  detail: string;
};

export type PilotReadinessReport = {
  schoolId: string;
  ready: boolean;
  readinessScore: number;
  readinessLevel: "not_ready" | "partial" | "ready";
  blockingIssues: ReadinessIssue[];
  nonBlockingIssues: ReadinessIssue[];
  teacherActivationStatus: "not_started" | "active" | "engaged";
  dataFlowStatus: "inactive" | "partial" | "active";
  guardianStatus: "inactive" | "active";
  sections: ReadinessSection[];
  latestEval:
    | {
        runAt: string;
        passed: boolean;
      }
    | null;
};

export type OnboardingReadinessStep = {
  id: string;
  title: string;
  complete: boolean;
  href: string;
  missing: string[];
};

export type OnboardingReadinessReport = {
  schoolId: string;
  ready: boolean;
  percentComplete: number;
  missingSteps: string[];
  readinessScore: number;
  readinessLevel: "not_ready" | "partial" | "ready";
  steps: OnboardingReadinessStep[];
};

const CATEGORY_WEIGHTS = {
  curriculum: 30,
  delivery: 25,
  intelligence: 20,
  governance: 15,
  ops: 10,
} as const;

function makeCheck(label: string, ready: boolean, detail: string): ReadinessCheck {
  return { label, ready, detail };
}

function scoreChecks(checks: ReadinessCheck[]): number {
  if (checks.length === 0) return 0;
  const passingChecks = checks.filter((check) => check.ready).length;
  return Math.round((passingChecks / checks.length) * 100);
}

function makeSection(
  id: keyof typeof CATEGORY_WEIGHTS,
  title: string,
  checks: ReadinessCheck[]
): ReadinessSection {
  return {
    id,
    title,
    ready: checks.every((check) => check.ready),
    score: scoreChecks(checks),
    weight: CATEGORY_WEIGHTS[id],
    checks,
  };
}

function weightedReadinessScore(sections: ReadinessSection[]): number {
  const score = sections.reduce((total, section) => {
    return total + (section.score / 100) * section.weight;
  }, 0);
  return Math.max(0, Math.min(100, Math.round(score)));
}

function readinessLevelForScore(
  score: number,
  blockingIssues: ReadinessIssue[]
): PilotReadinessReport["readinessLevel"] {
  if (blockingIssues.length > 0 || score < 70) {
    return score >= 40 ? "partial" : "not_ready";
  }
  return score >= 85 ? "ready" : "partial";
}

function issue(code: string, label: string, detail: string): ReadinessIssue {
  return { code, label, detail };
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export async function getPilotReadinessReport(
  schoolId: string
): Promise<PilotReadinessReport> {
  const classes = await prisma.class.findMany({
    where: { schoolId },
    select: { id: true },
  });
  const classIds = classes.map((entry) => entry.id);
  const sevenDaysAgo = daysAgo(7);

  const [
    school,
    scheduledApprovedLessons,
    performanceEvents,
    confusionSignals,
    interventionsGenerated,
    guardianSupportRecommendations,
    assignments,
    homeworks,
    exams,
    deliveredLessons,
    lessonCompletions,
    latestEvalRun,
    teacherDashboardViews,
    teacherInterventionActions,
    guardianProgressViews,
  ] = await Promise.all([
    prisma.school.findUnique({
      where: { id: schoolId },
      select: { id: true },
    }),
    classIds.length > 0
      ? prisma.scheduledWork.count({
          where: {
            classId: { in: classIds },
            content: { status: "APPROVED" },
          },
        })
      : Promise.resolve(0),
    (prisma as any).studentPerformanceEvent.count({ where: { schoolId } }),
    (prisma as any).confusionSignal.count({ where: { schoolId } }),
    (prisma as any).interventionRecommendation.count({ where: { schoolId } }),
    (prisma as any).interventionRecommendation.count({
      where: { schoolId, recommendationType: "guardian_support" },
    }),
    classIds.length > 0
      ? prisma.assignment.count({ where: { classId: { in: classIds } } })
      : Promise.resolve(0),
    classIds.length > 0
      ? prisma.homework.count({ where: { classId: { in: classIds } } })
      : Promise.resolve(0),
    prisma.exam.count({ where: { schoolId } }),
    classIds.length > 0
      ? prisma.scheduledWork.count({
          where: { classId: { in: classIds }, isDelivered: true },
        })
      : Promise.resolve(0),
    classIds.length > 0
      ? prisma.studentProgress.count({
          where: {
            scheduledWork: { classId: { in: classIds } },
            completedAt: { not: null },
          },
        })
      : Promise.resolve(0),
    (prisma as any).evalRun.findFirst({
      orderBy: { runAt: "desc" },
      select: { runAt: true, passed: true },
    }),
    prisma.auditLog.count({
      where: {
        schoolId,
        action: "teacher.performance.viewed",
        createdAt: { gte: sevenDaysAgo },
      },
    }),
    prisma.auditLog.count({
      where: {
        schoolId,
        action: "teacher.intervention.actioned",
        createdAt: { gte: sevenDaysAgo },
      },
    }),
    prisma.auditLog.count({
      where: {
        schoolId,
        action: { in: ["guardian.progress.viewed", "guardian.dashboard.viewed"] },
        createdAt: { gte: sevenDaysAgo },
      },
    }),
  ]);

  const hasPublishedLessons = scheduledApprovedLessons > 0;
  const hasPerformanceEvents = performanceEvents > 0;
  const intelligenceEnabled =
    isConfusionDetectionEnabled() && isInterventionEngineEnabled();
  const evalFailing = latestEvalRun ? !latestEvalRun.passed : false;

  const dataFlowStatus: PilotReadinessReport["dataFlowStatus"] =
    performanceEvents > 0 && confusionSignals > 0 && interventionsGenerated > 0
      ? "active"
      : performanceEvents > 0 || confusionSignals > 0 || interventionsGenerated > 0
        ? "partial"
        : "inactive";

  const teacherActivationStatus: PilotReadinessReport["teacherActivationStatus"] =
    teacherDashboardViews === 0
      ? "not_started"
      : performanceEvents > 0 && interventionsGenerated > 0 && teacherInterventionActions > 0
        ? "engaged"
        : "active";

  const guardianStatus: PilotReadinessReport["guardianStatus"] =
    guardianProgressViews > 0 && guardianSupportRecommendations > 0 ? "active" : "inactive";

  const curriculumChecks = [
    makeCheck(
      "Curriculum framework available",
      Boolean(curriculumFramework?.subjects?.length),
      Boolean(curriculumFramework?.subjects?.length)
        ? `${curriculumFramework.subjects.length} subjects in framework`
        : "Curriculum framework not available"
    ),
    makeCheck(
      "Published lessons present",
      hasPublishedLessons,
      hasPublishedLessons
        ? `${scheduledApprovedLessons} approved lesson schedules found`
        : "No approved lessons scheduled for this school"
    ),
  ];

  const intelligenceChecks = [
    makeCheck(
      "Performance events flowing",
      hasPerformanceEvents,
      hasPerformanceEvents
        ? `${performanceEvents} performance events recorded`
        : "No student performance events recorded yet"
    ),
    makeCheck(
      "Confusion signals generated",
      confusionSignals > 0,
      confusionSignals > 0
        ? `${confusionSignals} confusion signals detected`
        : "No confusion signals detected yet"
    ),
    makeCheck(
      "Interventions generated",
      interventionsGenerated > 0,
      interventionsGenerated > 0
        ? `${interventionsGenerated} interventions created`
        : "No intervention recommendations generated yet"
    ),
    makeCheck(
      "Confusion detection enabled",
      isConfusionDetectionEnabled(),
      isConfusionDetectionEnabled()
        ? "Confusion detection flag enabled"
        : "ENABLE_CONFUSION_DETECTION is off"
    ),
    makeCheck(
      "Intervention engine enabled",
      isInterventionEngineEnabled(),
      isInterventionEngineEnabled()
        ? "Intervention engine flag enabled"
        : "ENABLE_INTERVENTION_ENGINE is off"
    ),
  ];

  const deliveryChecks = [
    makeCheck(
      "Assignment flow present",
      assignments + homeworks > 0,
      assignments + homeworks > 0
        ? `${assignments + homeworks} assignment or homework items configured`
        : "No assignments or homework found for this school"
    ),
    makeCheck(
      "Exam flow present",
      exams > 0,
      exams > 0 ? `${exams} exams configured` : "No exams configured for this school"
    ),
    makeCheck(
      "Lesson delivery working",
      deliveredLessons > 0 || lessonCompletions > 0,
      deliveredLessons > 0 || lessonCompletions > 0
        ? `${deliveredLessons} delivered lessons and ${lessonCompletions} completions recorded`
        : "No delivered lessons or student completions recorded yet"
    ),
  ];

  const governanceChecks = [
    makeCheck(
      "Prompt registry enabled",
      isPromptRegistryEnabled(),
      isPromptRegistryEnabled()
        ? "Prompt registry flag enabled"
        : "ENABLE_PROMPT_REGISTRY is off"
    ),
    makeCheck(
      "Audit immutability enabled",
      isAuditImmutabilityEnabled(),
      isAuditImmutabilityEnabled()
        ? "Audit log immutability is enabled"
        : "ENABLE_AUDIT_IMMUTABILITY is off"
    ),
  ];

  const evalRunnerExists = fs.existsSync(path.join(process.cwd(), "scripts", "run-evals.ts"));
  const opsChecks = [
    makeCheck(
      "Eval system enabled",
      isEvalDbLoggingEnabled() || evalRunnerExists,
      isEvalDbLoggingEnabled()
        ? "Eval logging flag enabled"
        : evalRunnerExists
          ? "Eval runner script present"
          : "Eval runner script not found"
    ),
    makeCheck(
      "Latest eval pass status",
      latestEvalRun ? latestEvalRun.passed : false,
      latestEvalRun
        ? latestEvalRun.passed
          ? `Latest eval passed on ${latestEvalRun.runAt.toISOString()}`
          : `Latest eval failed on ${latestEvalRun.runAt.toISOString()}`
        : "No eval run recorded"
    ),
    makeCheck(
      "Worker queue present",
      isQueueConfigured(),
      isQueueConfigured()
        ? "SQS queue is configured"
        : "SQS_QUEUE_URL is not configured"
    ),
  ];

  const sections = [
    makeSection("curriculum", "Curriculum Readiness", curriculumChecks),
    makeSection("delivery", "Delivery Readiness", deliveryChecks),
    makeSection("intelligence", "Intelligence Readiness", intelligenceChecks),
    makeSection("governance", "Governance Readiness", governanceChecks),
    makeSection("ops", "Ops Readiness", opsChecks),
  ];

  const blockingIssues: ReadinessIssue[] = [];
  const nonBlockingIssues: ReadinessIssue[] = [];

  if (!hasPublishedLessons) {
    blockingIssues.push(
      issue(
        "no_published_lessons",
        "No published lessons",
        "Publish approved lessons before starting a pilot."
      )
    );
  }
  if (!hasPerformanceEvents) {
    blockingIssues.push(
      issue(
        "no_performance_events",
        "No performance events",
        "Students need to complete learning activity before pilot monitoring is usable."
      )
    );
  }
  if (!intelligenceEnabled) {
    blockingIssues.push(
      issue(
        "intelligence_disabled",
        "Intelligence is disabled",
        "Enable confusion detection and intervention engine before pilot launch."
      )
    );
  }
  if (evalFailing) {
    blockingIssues.push(
      issue(
        "eval_failing",
        "Eval failing",
        "Latest eval run failed. Fix eval regressions before pilot launch."
      )
    );
  }

  if (performanceEvents > 0 && performanceEvents < 10) {
    nonBlockingIssues.push(
      issue(
        "low_activity",
        "Low activity",
        "Performance events are flowing, but activity volume is still low."
      )
    );
  }
  if (guardianStatus === "inactive") {
    nonBlockingIssues.push(
      issue(
        "limited_guardian_usage",
        "Limited guardian usage",
        "Guardian progress has not been actively used yet."
      )
    );
  }
  if (dataFlowStatus === "partial") {
    nonBlockingIssues.push(
      issue(
        "partial_data_flow",
        "Partial signal coverage",
        "Events are present, but confusion signals and interventions are not fully flowing yet."
      )
    );
  }
  if (!sections.find((section) => section.id === "delivery")?.ready) {
    nonBlockingIssues.push(
      issue(
        "partial_delivery_coverage",
        "Partial delivery coverage",
        "Assignment, exam, or lesson delivery coverage is still incomplete."
      )
    );
  }

  const readinessScore = weightedReadinessScore(sections);
  const readinessLevel = readinessLevelForScore(readinessScore, blockingIssues);

  return {
    schoolId: school?.id ?? schoolId,
    ready: readinessLevel === "ready",
    readinessScore,
    readinessLevel,
    blockingIssues,
    nonBlockingIssues,
    teacherActivationStatus,
    dataFlowStatus,
    guardianStatus,
    sections,
    latestEval: latestEvalRun
      ? {
          runAt: latestEvalRun.runAt.toISOString(),
          passed: latestEvalRun.passed,
        }
      : null,
  };
}

export async function getOnboardingReadinessReport(
  schoolId: string
): Promise<OnboardingReadinessReport> {
  const [school, teacherCount, classCount, pilotReadiness] = await Promise.all([
    prisma.school.findUnique({
      where: { id: schoolId },
      select: {
        id: true,
        name: true,
        county: true,
      },
    }),
    prisma.user.count({ where: { schoolId, role: "TEACHER" } }),
    prisma.class.count({ where: { schoolId } }),
    getPilotReadinessReport(schoolId),
  ]);

  const curriculumSection = pilotReadiness.sections.find(
    (section) => section.id === "curriculum"
  );
  const deliverySection = pilotReadiness.sections.find(
    (section) => section.id === "delivery"
  );

  const steps: OnboardingReadinessStep[] = [
    {
      id: "configure-school",
      title: "School configured",
      href: "/admin/onboarding",
      complete: Boolean(school?.name && school?.county && teacherCount > 0 && classCount > 0),
      missing: [
        ...(school?.name ? [] : ["School name is missing"]),
        ...(school?.county ? [] : ["County is missing"]),
        ...(teacherCount > 0 ? [] : ["Add at least one teacher"]),
        ...(classCount > 0 ? [] : ["Create at least one class"]),
      ],
    },
    {
      id: "curriculum-published",
      title: "Curriculum published",
      href: "/admin/curriculum",
      complete: Boolean(curriculumSection?.checks.some((check) => check.label === "Published lessons present" && check.ready)),
      missing:
        curriculumSection?.checks.some(
          (check) => check.label === "Published lessons present" && check.ready
        )
          ? []
          : [
              curriculumSection?.checks.find(
                (check) => check.label === "Published lessons present"
              )?.detail ?? "Publish approved lessons",
            ],
    },
    {
      id: "delivery-verified",
      title: "Delivery verified",
      href: "/teacher/delivery-report",
      complete: Boolean(deliverySection?.checks[2]?.ready),
      missing: deliverySection?.checks[2]?.ready
        ? []
        : [deliverySection?.checks[2]?.detail ?? "Verify lesson delivery is active"],
    },
    {
      id: "teacher-engaged",
      title: "Teacher engaged",
      href: "/teacher/intelligence",
      complete:
        isTeacherIntelligenceDashboardEnabled() &&
        pilotReadiness.teacherActivationStatus === "engaged",
      missing: [
        ...(isTeacherIntelligenceDashboardEnabled()
          ? []
          : ["ENABLE_TEACHER_INTELLIGENCE_DASHBOARD is off"]),
        ...(pilotReadiness.teacherActivationStatus === "engaged"
          ? []
          : [
              pilotReadiness.teacherActivationStatus === "active"
                ? "A teacher has opened the dashboard, but no intervention follow-through is recorded yet"
                : "No teacher dashboard activity recorded in the last 7 days",
            ]),
      ],
    },
    {
      id: "guardian-ready",
      title: "Guardian ready",
      href: "/guardian/progress",
      complete:
        isGuardianProgressViewEnabled() && pilotReadiness.guardianStatus === "active",
      missing: [
        ...(isGuardianProgressViewEnabled()
          ? []
          : ["ENABLE_GUARDIAN_PROGRESS_VIEW is off"]),
        ...(pilotReadiness.guardianStatus === "active"
          ? []
          : ["No recent guardian progress usage with support suggestions detected"]),
      ],
    },
    {
      id: "readiness-achieved",
      title: "Readiness achieved",
      href: "/admin/pilot-readiness",
      complete:
        isPilotReadinessDashboardEnabled() &&
        pilotReadiness.readinessLevel === "ready",
      missing: [
        ...(isPilotReadinessDashboardEnabled()
          ? []
          : ["ENABLE_PILOT_READINESS_DASHBOARD is off"]),
        ...pilotReadiness.blockingIssues.map((entry) => entry.label),
        ...(pilotReadiness.readinessLevel === "ready"
          ? []
          : [`Current readiness score is ${pilotReadiness.readinessScore}/100`]),
      ],
    },
  ];

  const completedSteps = steps.filter((step) => step.complete).length;
  const percentComplete = Math.round((completedSteps / steps.length) * 100);

  return {
    schoolId: school?.id ?? schoolId,
    ready: steps.every((step) => step.complete),
    percentComplete,
    missingSteps: steps.filter((step) => !step.complete).map((step) => step.title),
    readinessScore: pilotReadiness.readinessScore,
    readinessLevel: pilotReadiness.readinessLevel,
    steps,
  };
}
