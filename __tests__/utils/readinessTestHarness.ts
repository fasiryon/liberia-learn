import { vi } from "vitest";

type HarnessState = {
  schoolId?: string;
  classIds?: string[];
  scheduledApprovedLessons?: number;
  performanceEvents?: number;
  confusionSignals?: number;
  interventionsGenerated?: number;
  guardianSupportRecommendations?: number;
  assignments?: number;
  homeworks?: number;
  exams?: number;
  deliveredLessons?: number;
  lessonCompletions?: number;
  latestEvalRun?: { runAt: Date; passed: boolean } | null;
  teacherDashboardViews?: number;
  teacherInterventionActions?: number;
  guardianProgressViews?: number;
  teacherCount?: number;
  classCount?: number;
  schoolName?: string | null;
  schoolCounty?: string | null;
  curriculumSubjectCount?: number;
  evalRunnerExists?: boolean;
  queueConfigured?: boolean;
  confusionDetectionEnabled?: boolean;
  interventionEngineEnabled?: boolean;
  promptRegistryEnabled?: boolean;
  auditImmutabilityEnabled?: boolean;
  teacherDashboardEnabled?: boolean;
  guardianProgressEnabled?: boolean;
  pilotReadinessDashboardEnabled?: boolean;
  pilotReadinessEnabled?: boolean;
  evalDbLoggingEnabled?: boolean;
  hasActiveAcademicYear?: boolean;
};

export async function loadReadinessService(overrides: HarnessState = {}) {
  vi.resetModules();

  const state = {
    schoolId: "school-1",
    classIds: ["class-1"],
    scheduledApprovedLessons: 4,
    performanceEvents: 20,
    confusionSignals: 8,
    interventionsGenerated: 4,
    guardianSupportRecommendations: 2,
    assignments: 2,
    homeworks: 2,
    exams: 1,
    deliveredLessons: 3,
    lessonCompletions: 10,
    latestEvalRun: { runAt: new Date("2026-03-28T00:00:00.000Z"), passed: true },
    teacherDashboardViews: 3,
    teacherInterventionActions: 1,
    guardianProgressViews: 2,
    teacherCount: 2,
    classCount: 2,
    schoolName: "Pilot School",
    schoolCounty: "Montserrado",
    curriculumSubjectCount: 3,
    evalRunnerExists: true,
    queueConfigured: true,
    confusionDetectionEnabled: true,
    interventionEngineEnabled: true,
    promptRegistryEnabled: true,
    auditImmutabilityEnabled: true,
    teacherDashboardEnabled: true,
    guardianProgressEnabled: true,
    pilotReadinessDashboardEnabled: true,
    pilotReadinessEnabled: true,
    evalDbLoggingEnabled: false,
    hasActiveAcademicYear: true,
    ...overrides,
  };

  const existsSync = vi.fn(() => state.evalRunnerExists);

  vi.doMock("fs", () => ({
    default: { existsSync },
    existsSync,
  }));
  vi.doMock("@/lib/curriculum/framework", () => ({
    curriculumFramework: {
      subjects: Array.from({ length: state.curriculumSubjectCount }, (_, index) => ({
        id: `subject-${index + 1}`,
      })),
    },
  }));
  vi.doMock("@/lib/queue", () => ({
    isQueueConfigured: vi.fn(() => state.queueConfigured),
  }));
  vi.doMock("@/lib/serverFlags", () => ({
    isAuditImmutabilityEnabled: vi.fn(() => state.auditImmutabilityEnabled),
    isConfusionDetectionEnabled: vi.fn(() => state.confusionDetectionEnabled),
    isEvalDbLoggingEnabled: vi.fn(() => state.evalDbLoggingEnabled),
    isGuardianProgressViewEnabled: vi.fn(() => state.guardianProgressEnabled),
    isInterventionEngineEnabled: vi.fn(() => state.interventionEngineEnabled),
    isPilotReadinessDashboardEnabled: vi.fn(() => state.pilotReadinessDashboardEnabled),
    isPilotReadinessEnabled: vi.fn(() => state.pilotReadinessEnabled),
    isPromptRegistryEnabled: vi.fn(() => state.promptRegistryEnabled),
    isTeacherIntelligenceDashboardEnabled: vi.fn(() => state.teacherDashboardEnabled),
  }));

  const auditLogCount = vi.fn((args?: any) => {
    const action = args?.where?.action;
    if (action === "teacher.performance.viewed") {
      return Promise.resolve(state.teacherDashboardViews);
    }
    if (action === "teacher.intervention.actioned") {
      return Promise.resolve(state.teacherInterventionActions);
    }
    if (Array.isArray(action?.in)) {
      return Promise.resolve(state.guardianProgressViews);
    }
    return Promise.resolve(0);
  });

  vi.doMock("@/lib/db", () => ({
    prisma: {
      class: {
        findMany: vi.fn(async () => state.classIds.map((id) => ({ id }))),
        count: vi.fn(async () => state.classCount),
      },
      school: {
        findUnique: vi.fn(async () => ({
          id: state.schoolId,
          name: state.schoolName,
          county: state.schoolCounty,
        })),
      },
      scheduledWork: {
        count: vi.fn(async (args?: any) => {
          if (args?.where?.isDelivered) return state.deliveredLessons;
          return state.scheduledApprovedLessons;
        }),
      },
      assignment: { count: vi.fn(async () => state.assignments) },
      homework: { count: vi.fn(async () => state.homeworks) },
      exam: { count: vi.fn(async () => state.exams) },
      studentProgress: { count: vi.fn(async () => state.lessonCompletions) },
      user: { count: vi.fn(async () => state.teacherCount) },
      auditLog: { count: auditLogCount },
      studentPerformanceEvent: {
        count: vi.fn(async () => state.performanceEvents),
      },
      confusionSignal: { count: vi.fn(async () => state.confusionSignals) },
      interventionRecommendation: {
        count: vi.fn(async (args?: any) => {
          if (args?.where?.recommendationType === "guardian_support") {
            return state.guardianSupportRecommendations;
          }
          return state.interventionsGenerated;
        }),
      },
      evalRun: {
        findFirst: vi.fn(async () => state.latestEvalRun),
      },
      academicYear: {
        findFirst: vi.fn(async () => (state.hasActiveAcademicYear ? { id: "ay-1" } : null)),
      },
    },
  }));

  const service = await import("@/lib/readiness/readinessService");
  return { ...service, state };
}
