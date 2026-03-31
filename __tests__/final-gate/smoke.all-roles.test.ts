import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const state = vi.hoisted(() => ({
  currentUser: { id: "student-user-1", role: "STUDENT", schoolId: "school-a", isPlatformAdmin: false } as any,
  platformAdmin: { id: "platform-admin-1", role: "ADMIN", schoolId: null, isPlatformAdmin: true } as any,
  gapScore: 0.42,
  interventionStatus: "pending",
  flags: {
    adaptive: true,
    confusion: true,
    guardianDash: true,
    guardianProgress: true,
    interventionEngine: true,
    interventionWorkflow: true,
    moePortal: true,
    pilotDashboard: true,
    pilotReadiness: true,
    promptRegistry: true,
    teacherIntelligence: true,
    deliveryCompliance: true,
    examSystem: true,
  },
}));

const QUESTIONS = [
  { id: "q1", prompt: "2+2", options: ["3", "4", "5", "6"], correctIndex: 1, explanation: "4", moeCode: "M1", points: 1 },
  { id: "q2", prompt: "3+3", options: ["5", "6", "7", "8"], correctIndex: 1, explanation: "6", moeCode: "M2", points: 1 },
  { id: "q3", prompt: "4+4", options: ["7", "8", "9", "10"], correctIndex: 1, explanation: "8", moeCode: "M3", points: 1 },
  { id: "q4", prompt: "5+5", options: ["9", "10", "11", "12"], correctIndex: 1, explanation: "10", moeCode: "M4", points: 1 },
  { id: "q5", prompt: "6+6", options: ["11", "12", "13", "14"], correctIndex: 1, explanation: "12", moeCode: "M5", points: 1 },
];

function req(method: string, url: string, body?: object) {
  return new NextRequest(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: { "Content-Type": "application/json" },
  });
}

function setUser(role: "STUDENT" | "TEACHER" | "GUARDIAN" | "ADMIN" | "MOE_OFFICIAL", extras: Record<string, unknown> = {}) {
  state.currentUser = {
    id: `${role.toLowerCase()}-user-1`,
    role,
    schoolId: role === "MOE_OFFICIAL" ? null : "school-a",
    isPlatformAdmin: false,
    ...extras,
  };
}

async function dbReturn(model: string, method: string, args: any) {
  if (model === "user" && method === "findUnique") {
    if (args?.where?.email === "student@example.com") return { id: "student-user-1", email: "student@example.com", hashedPwd: "hash", name: "Student A", role: "STUDENT" };
    return null;
  }
  if (model === "user" && method === "findMany") return [{ id: "teacher-user-1", name: "Teacher A", email: "teacher@example.com", loginId: "tch-a", guardianPhoneE164: "+2317701", TeacherProfile: { fullName: "Teacher A", phone: "+2317701", permissions: { active: true, subjectSpecialty: "Math" } }, teacherOf: [{ id: "class-a-1", name: "JSS 1A", subject: "MATH" }] }];
  if (model === "school" && method === "findUnique") return { id: "school-a", name: "School A", county: "Montserrado", motto: "Learn", contactName: "Admin A", primaryHex: "#005522", logoUrl: null, onboardingStep: 5 };
  if (model === "school" && method === "findMany") return [{ id: "school-a", name: "School A", status: "ACTIVE", county: "Montserrado", district: "District 1", contactName: "Admin A", contactEmail: "admin@schoola.edu", contactPhone: "+2317700", motto: "Learn", logoUrl: null, primaryHex: "#005522", createdAt: new Date(), _count: { users: 200, classes: 12 } }];
  if (model === "school" && method === "create") return { id: "school-c", name: "School C", county: "Bong", status: "ACTIVE" };
  if (model === "school" && method === "count") return 2;
  if (model === "district" && method === "count") return 1;
  if (model === "student" && (method === "findUnique" || method === "findFirst")) return { id: "student-rec-1", userId: "student-user-1", currentGrade: 7, user: { schoolId: "school-a", name: "Student A" }, enrollments: [{ classId: "class-a-1", Class: { id: "class-a-1", name: "JSS 1A", subject: "MATH", School: { name: "School A" } } }], placementTests: [] };
  if (model === "student" && method === "findMany") return [{ id: "student-rec-1", currentGrade: 7, user: { id: "student-user-1", name: "Student A", email: "student@example.com", loginId: "stu-a", guardianPhoneE164: "+2317702" } }];
  if (model === "student" && method === "count") return 5000;
  if (model === "class" && method === "findMany") return [{ id: "class-a-1", name: "JSS 1A", subject: "MATH" }];
  if (model === "scheduledWork" && method === "findMany") return [{ id: "sw-1", classId: "class-a-1", contentId: "content-1", scheduledDate: new Date("2026-03-28T09:00:00.000Z"), classFormat: null, isDelivered: true, deliveredAt: new Date("2026-03-28T10:00:00.000Z"), completionRate: 0.9, sessionPairId: null, status: "delivered", periodNumber: 1, startTime: "09:00", endTime: "09:45", progress: [{ completedAt: new Date(), startedAt: new Date(), exitTicketScore: 4, id: "prog-1" }], class: { id: "class-a-1", name: "JSS 1A", teacherId: "teacher-user-1", Teacher: { name: "Teacher A" } }, content: { contentId: "content-1", subject: "MATH", grade: 7, contentType: "LESSON", payload: { title: "Fractions", durationMins: 45 }, moeAlignments: [{ code: "M1" }], deliveryProfile: null } }];
  if (model === "scheduledWork" && method === "count") return 100;
  if (model === "enrollment" && method === "groupBy") return [{ classId: "class-a-1", _count: 20 }];
  if (model === "enrollment" && method === "count") return 20;
  if (model === "studentProgress" && method === "count") return 1;
  if (model === "studentProgress" && method === "findMany") return [{ scheduledWorkId: "sw-1", startedAt: new Date(), completedAt: new Date(), exitTicketScore: 4, scheduledWork: { content: { payload: { title: "Fractions" } }, class: { subject: "MATH" } } }];
  if (model === "assignment" && method === "findUnique") return { id: "assignment-1", classId: "class-a-1", title: "Fractions HW", Class: { schoolId: "school-a", School: { name: "School A" } } };
  if (model === "assignment" && method === "findMany") return [];
  if (model === "assignment" && method === "count") return 4;
  if (model === "assignmentSubmission" && method === "findMany") return [{ id: "submission-1", assignmentId: "assignment-1", studentId: "student-rec-1", score: null, feedback: "", content: "Work", turnedInAt: new Date(), Assignment: { id: "assignment-1", title: "Fractions HW", points: 10, dueAt: new Date(), Class: { id: "class-a-1", name: "JSS 1A", subject: "MATH", schoolId: "school-a", teacherId: "teacher-user-1", School: { name: "School A" } } }, Student: { id: "student-rec-1", user: { id: "student-user-1", name: "Student A", email: "student@example.com" } } }];
  if (model === "assignmentSubmission" && method === "count") return 1;
  if (model === "assignmentSubmission" && method === "findUnique") return { id: "submission-1", Assignment: { id: "assignment-1", title: "Fractions HW", Class: { schoolId: "school-a", teacherId: "teacher-user-1", School: { name: "School A" } } }, Student: { id: "student-rec-1", user: { id: "student-user-1", name: "Student A", email: "student@example.com" } } };
  if (model === "assignmentSubmission" && method === "update") return { id: "submission-1", score: 88, feedback: "Good work", gradedAt: new Date() };
  if (model === "assignmentSubmission" && method === "upsert") return { id: "submission-1", turnedInAt: new Date() };
  if (model === "homework" && method === "findMany") return [];
  if (model === "homeworkSubmission" && method === "findMany") return [];
  if (model === "attendanceRecord" && method === "findMany") return [{ status: "PRESENT" }, { status: "PRESENT" }, { status: "ABSENT" }];
  if (model === "curriculumContent" && method === "findMany") return [{ contentId: "content-1", payload: { title: "Fractions" }, status: "APPROVED", createdAt: new Date(), moeAlignments: { standards: [{ code: "M1" }] } }];
  if (model === "curriculumContent" && method === "findUnique") return { id: "content-db-1", grade: 7, subject: "MATH", moeAlignments: [{ code: "M1" }], payload: { title: "Fractions" }, deliveryProfile: null };
  if (model === "aiInteractionLog" && method === "aggregate") return { _sum: { estimatedCostUSD: 1 } };
  if (model === "studentAdaptiveAttempt" && method === "findMany") return [{ score: state.gapScore, completedAt: new Date() }];
  if (model === "studentAdaptiveAttempt" && method === "findFirst") return null;
  if (model === "strandCatalog" && method === "findFirst") return { subject: "MATH", strandKey: "MATH.NUM.1" };
  if (model === "exam" && method === "findMany") return [{ id: "exam-1", title: "Midterm Mathematics", subject: "MATH", grade: 7, status: "PUBLISHED", timeLimit: 45, passingScore: 0.7, moeStandards: ["M1"], questions: QUESTIONS, attempts: [{ passed: true, score: 0.8, integrityFlags: [] }], _count: { questions: QUESTIONS.length }, createdAt: new Date() }];
  if (model === "exam" && method === "findFirst") return { id: "exam-1", title: "Midterm Mathematics", subject: "MATH", grade: 7, status: "PUBLISHED", schoolId: "school-a", timeLimit: 45, passingScore: 0.7, questions: QUESTIONS, _count: { questions: QUESTIONS.length } };
  if (model === "exam" && method === "create") return { id: "exam-created-1" };
  if (model === "exam" && method === "update") return { id: "exam-created-1", status: "PUBLISHED" };
  if (model === "exam" && method === "count") return 3;
  if (model === "examAttempt" && method === "findFirst") {
    if (args?.where?.passed === true) return null;
    if (args?.where?.id && args?.where?.examId) {
      return { id: "attempt-1", examId: "exam-1", studentId: "student-rec-1", startedAt: new Date(Date.now() - 60_000), submittedAt: null, exam: { id: "exam-1", subject: "MATH", grade: 7, passingScore: 0.7, timeLimit: 45, questions: QUESTIONS } };
    }
    return null;
  }
  if (model === "examAttempt" && method === "findMany") return [{ passed: true, integrityFlags: [], exam: { subject: "MATH" } }];
  if (model === "examAttempt" && method === "create") return { id: "attempt-1" };
  if (model === "examAttempt" && method === "count") return 0;
  if (model === "examCertification" && method === "findMany") return [{ id: "cert-1", examId: "exam-1", subject: "MATH", grade: 7, score: 0.8, issuedAt: new Date(), certCode: "CERT-2026-STUDENT-EXAM", exam: { title: "Midterm Mathematics" } }];
  if (model === "examCertification" && method === "count") return 1;
  if (model === "confusionSignal" && method === "findMany") return [{ id: "conf-1", studentId: "student-rec-1", lessonId: "lesson-1", conceptTag: "MATH::fractions", confusionType: "misconception", severity: "medium", detectedAt: new Date() }];
  if (model === "interventionRecommendation" && method === "findMany") return [{ id: "int-1", studentId: "student-rec-1", schoolId: "school-a", status: state.interventionStatus, recommendationType: "guardian_support", createdAt: new Date(), reason: "Needs practice", confidenceScore: 0.8, expiresAt: null }];
  if (model === "interventionRecommendation" && method === "findFirst") return { id: "int-1", studentId: "student-rec-1", schoolId: "school-a", status: state.interventionStatus, recommendationType: "guardian_support", createdAt: new Date(), reason: "Needs practice", confidenceScore: 0.8, expiresAt: null };
  if (model === "interventionRecommendation" && method === "updateMany") { state.interventionStatus = args.data.status; return { count: 1 }; }
  if (model === "interventionRecommendation" && method === "count") return 1;
  if (model === "studentGuardian" && method === "findMany") return [{ studentId: "student-rec-1" }];
  if (model === "studentGuardian" && method === "findFirst") return { studentId: "student-rec-1" };
  if (model === "labSession" && method === "findMany") return [];
  if (model === "studentMasteryProfile" && method === "findMany") return [{ subject: "MATH", strandKey: "MATH.NUM.1", currentScore: 0.62, baselineScore: 0.5, masteryState: "STABLE", proficiencyState: "DEVELOPING", updatedAt: new Date() }];
  if (model === "placementTest" && method === "findMany") return [{ id: "placement-1", band: "7-9", estimatedGrade: 7, teacherDecision: "accepted", teacherReason: null, levelLabel: "At grade", details: { confidence: "high" }, createdAt: new Date(), reviewedAt: new Date(), student: { user: { schoolId: "school-a" } } }];
  if (model === "standard" && method === "findMany") return [{ code: "M1", subject: "MATH", band: "7-9" }];
  if (model === "labSession" && method === "count") return 1;
  if (model === "interventionLog" && method === "count") return 4;
  if (model === "guardianMessage" && method === "count") return 0;
  if (model === "assignmentSuggestion" && method === "count") return 0;
  return null;
}

vi.mock("@/lib/auth", () => ({
  requireRole: vi.fn(async (...roles: string[]) => {
    if (!roles.includes(state.currentUser.role)) throw Object.assign(new Error("Forbidden"), { status: 403 });
    return state.currentUser;
  }),
  requireUser: vi.fn(async () => state.currentUser),
}));

vi.mock("@/lib/moeAccess", () => ({
  requireMoePlatformAdmin: vi.fn(async () => state.platformAdmin),
}));

vi.mock("@/lib/audit", () => ({ logAudit: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/metrics/events", () => ({ recordMetricEvent: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/intelligence/recordPerformanceEvent", () => ({ recordPerformanceEvent: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/adaptive/gapDetector", () => ({
  detectMasteryGaps: vi.fn(async () => [{ strand: "MATH.NUM.1", subject: "MATH", grade: 7, averageScore: state.gapScore, attemptCount: 2, lastAttemptAt: new Date() }]),
}));
vi.mock("@/lib/adaptive/practiceGenerator", () => ({
  generateTargetedPracticeWithUsage: vi.fn(async () => ({ practice: { id: "practice-1", questions: Array.from({ length: 5 }, (_, index) => ({ id: `pq-${index + 1}` })) }, estimatedCostUSD: 0.12 })),
}));
vi.mock("@/lib/adaptive/difficultyAdapter", () => ({ computeDifficultyTier: vi.fn(() => "core") }));
vi.mock("@/lib/mastery/masteryService", () => ({ updateMasteryProfile: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/exams/examGenerator", () => ({
  generateExam: vi.fn(async () => ({ title: "Midterm Mathematics", subject: "MATH", grade: 7, moeStandards: ["M1"], timeLimit: 45, passingScore: 0.7, questions: QUESTIONS })),
  generateExamWithUsage: vi.fn(async () => ({
    exam: { title: "Midterm Mathematics", subject: "MATH", grade: 7, moeStandards: ["M1"], timeLimit: 45, passingScore: 0.7, questions: QUESTIONS },
    tokensUsed: 240,
    estimatedCostUSD: 0.12,
  })),
}));
vi.mock("@/lib/exams/gradingPipeline", () => ({ gradeAttempt: vi.fn(() => ({ score: 0.8, passed: true, weakMoeCodes: [] })) }));
vi.mock("@/lib/ai/promptRegistry", () => ({ listPrompts: vi.fn(() => [{ id: "adaptive.practice", version: 1 }, { id: "exam.generate", version: 3 }]) }));
vi.mock("@/lib/readiness/readinessService", () => ({
  getPilotReadinessReport: vi.fn(async () => ({ ready: true, readinessScore: 88, readinessLevel: "ready", sections: [] })),
  getOnboardingReadinessReport: vi.fn(async () => ({ ready: true, percentComplete: 100, readinessScore: 92, readinessLevel: "ready", steps: [] })),
}));
vi.mock("@/lib/intelligence/performanceAggregator", () => ({
  getClassPerformanceSummary: vi.fn(async () => ({ avgScore: 0.76, strugglingStudents: 2, trend: "improving" })),
  getStudentPerformanceSummary: vi.fn(async () => ({ avgScore: 84, masteryLevel: "developing", improvementTrend: "improving" })),
}));
vi.mock("@/lib/intelligence/teacherScope", () => ({
  getTeacherScope: vi.fn(async () => ({
    studentIds: ["student-rec-1"],
    students: new Map([["student-rec-1", { id: "student-rec-1", name: "Student A", currentGrade: 7, className: "JSS 1A" }]]),
  })),
}));
vi.mock("bcryptjs", () => ({ default: { compare: vi.fn(async () => true) } }));
vi.mock("jose", () => ({
  SignJWT: class {
    setProtectedHeader() { return this; }
    setExpirationTime() { return this; }
    async sign() { return "signed.jwt.token"; }
  },
}));
vi.mock("@/lib/serverFlags", () => ({
  isAdaptiveEngineEnabled: () => state.flags.adaptive,
  isConfusionDetectionEnabled: () => state.flags.confusion,
  isGuardianDashboardEnabled: () => state.flags.guardianDash,
  isGuardianProgressViewEnabled: () => state.flags.guardianProgress,
  isInterventionEngineEnabled: () => state.flags.interventionEngine,
  isInterventionWorkflowEnabled: () => state.flags.interventionWorkflow,
  isMoePortalEnabled: () => state.flags.moePortal,
  isPilotReadinessDashboardEnabled: () => state.flags.pilotDashboard,
  isPilotReadinessEnabled: () => state.flags.pilotReadiness,
  isPromptRegistryEnabled: () => state.flags.promptRegistry,
  isTeacherIntelligenceDashboardEnabled: () => state.flags.teacherIntelligence,
  isDeliveryComplianceReportingEnabled: () => state.flags.deliveryCompliance,
  isExamSystemEnabled: () => state.flags.examSystem,
  getAiBudgetMonthlyCap: () => 100,
  isAbBlockSchedulingEnabled: () => false,
  isAssignmentLessonLinkageEnabled: () => false,
  isVirtualLabsEnabled: () => false,
}));

vi.mock("@/lib/db", () => ({
  prisma: new Proxy({}, {
    get(_target, model: string) {
      return new Proxy({}, {
        get(_inner, method: string) {
          return (args: any) => dbReturn(model, method, args);
        },
      });
    },
  }),
}));

import { POST as authLoginPost } from "@/app/api/auth/login/route";
import { GET as studentTodayGet } from "@/app/api/student/today/route";
import { GET as studentGapsGet } from "@/app/api/student/adaptive/gaps/route";
import { POST as studentPracticePost } from "@/app/api/student/adaptive/practice/route";
import { POST as studentAdaptiveSubmitPost } from "@/app/api/student/adaptive/submit/route";
import { GET as studentExamsGet } from "@/app/api/student/exams/route";
import { POST as studentExamStartPost } from "@/app/api/student/exams/[examId]/start/route";
import { POST as studentExamSubmitPost } from "@/app/api/student/exams/[examId]/submit/route";
import { GET as studentCertsGet } from "@/app/api/student/certifications/route";
import { GET as teacherDashboardGet } from "@/app/api/teacher/dashboard/route";
import { GET as teacherScheduleGet } from "@/app/api/teacher/schedule/route";
import { GET as teacherAssignmentsGet } from "@/app/api/teacher/assignments/route";
import { PATCH as teacherGradePatch } from "@/app/api/teacher/assignments/[id]/grade/route";
import { GET as teacherPerformanceGet } from "@/app/api/teacher/performance/route";
import { GET as teacherConfusionsGet } from "@/app/api/teacher/confusions/route";
import { GET as teacherInterventionsGet, PATCH as teacherInterventionsPatch } from "@/app/api/teacher/interventions/route";
import { GET as teacherExamsGet } from "@/app/api/teacher/exams/route";
import { GET as guardianDashboardGet } from "@/app/api/guardian/dashboard/route";
import { GET as guardianPerformanceGet } from "@/app/api/guardian/performance/route";
import { GET as adminStudentsGet } from "@/app/api/admin/students/route";
import { GET as adminTeachersGet } from "@/app/api/admin/teachers/route";
import { GET as adminDeliveryReportGet } from "@/app/api/admin/compliance/delivery-report/route";
import { GET as adminPilotReadinessGet } from "@/app/api/admin/pilot-readiness/route";
import { GET as adminOnboardingReadinessGet } from "@/app/api/admin/onboarding/readiness/route";
import { POST as adminGenerateExamPost } from "@/app/api/admin/exams/generate/route";
import { POST as adminPublishExamPost } from "@/app/api/admin/exams/[examId]/publish/route";
import { GET as moeDashboardGet } from "@/app/api/moe/dashboard/route";
import { GET as moePlacementsGet } from "@/app/api/moe/placements/route";
import { GET as moeStandardsCoverageGet } from "@/app/api/moe/standards-coverage/route";
import { GET as platformSchoolsGet, POST as platformSchoolsPost } from "@/app/api/platform/schools/route";
import { GET as platformStatsGet } from "@/app/api/platform/stats/route";
import { GET as adminPromptsGet } from "@/app/api/admin/prompts/route";
import { GET as teacherIntelligenceGet } from "@/app/api/teacher/intelligence/[studentId]/route";

beforeEach(() => {
  vi.clearAllMocks();
  state.currentUser = { id: "student-user-1", role: "STUDENT", schoolId: "school-a", isPlatformAdmin: false };
  state.platformAdmin = { id: "platform-admin-1", role: "ADMIN", schoolId: null, isPlatformAdmin: true };
  state.gapScore = 0.42;
  state.interventionStatus = "pending";
  state.flags = {
    adaptive: true,
    confusion: true,
    guardianDash: true,
    guardianProgress: true,
    interventionEngine: true,
    interventionWorkflow: true,
    moePortal: true,
    pilotDashboard: true,
    pilotReadiness: true,
    promptRegistry: true,
    teacherIntelligence: true,
    deliveryCompliance: true,
    examSystem: true,
  };
});

describe("Final gate all-roles smoke", () => {
  it("covers the student role", async () => {
    const loginRes = await authLoginPost(req("POST", "http://localhost/api/auth/login", { email: "student@example.com", password: "secret" }));
    expect(loginRes.status).toBe(200);
    expect((await loginRes.json()).user.role).toBe("STUDENT");

    setUser("STUDENT");
    expect((await studentTodayGet()).status).toBe(200);
    expect((await (await studentGapsGet()).json()).gaps[0].strand).toBe("MATH.NUM.1");
    expect((await (await studentPracticePost(req("POST", "http://localhost/api/student/adaptive/practice", { strandCode: "MATH.NUM.1" }))).json()).practice.questions).toHaveLength(5);
    expect((await (await studentAdaptiveSubmitPost(req("POST", "http://localhost/api/student/adaptive/submit", { strandCode: "MATH.NUM.1", practiceSetId: "practice-1", answers: [1, 1, 1, 1, 1], correctAnswers: [1, 1, 1, 1, 1] }))).json()).passed).toBe(true);
    expect((await (await studentExamsGet()).json()).exams[0].questions[0].correctIndex).toBeUndefined();
    expect((await (await studentExamStartPost(req("POST", "http://localhost/api/student/exams/exam-1/start"), { params: { examId: "exam-1" } })).json()).attemptId).toBe("attempt-1");
    expect((await (await studentExamSubmitPost(req("POST", "http://localhost/api/student/exams/exam-1/submit", { attemptId: "attempt-1", answers: [1, 1, 1, 1, 1] }), { params: { examId: "exam-1" } })).json()).certCode).toContain("CERT-");
    expect((await (await studentCertsGet()).json()).certifications[0].examTitle).toBe("Midterm Mathematics");

    state.gapScore = 0.71;
    expect((await (await studentGapsGet()).json()).gaps[0].averageScore).toBe(0.71);
  });

  it("covers the teacher role", async () => {
    setUser("TEACHER");
    expect((await teacherDashboardGet()).status).toBe(200);
    expect((await (await teacherScheduleGet(req("GET", "http://localhost/api/teacher/schedule?weekOf=2026-03-24"))).json()).items[0].classId).toBe("class-a-1");
    expect((await (await teacherAssignmentsGet()).json()).submissions[0].assignmentTitle).toBe("Fractions HW");
    expect((await (await teacherGradePatch(req("PATCH", "http://localhost/api/teacher/assignments/submission-1/grade", { grade: 88, feedback: "Good work" }), { params: { id: "submission-1" } })).json()).submission.score).toBe(88);
    expect((await teacherPerformanceGet()).status).toBe(200);
    expect((await (await teacherConfusionsGet(req("GET", "http://localhost/api/teacher/confusions"))).json())[0].studentId).toBe("student-rec-1");
    expect((await (await teacherInterventionsGet()).json())[0].workflowState).toBeTruthy();
    expect((await (await teacherInterventionsPatch(req("PATCH", "http://localhost/api/teacher/interventions", { id: "int-1", status: "actioned" }))).json()).status).toBe("actioned");
    expect((await (await teacherExamsGet()).json()).exams[0].attemptCount).toBe(1);
    expect((await (await adminGenerateExamPost(req("POST", "http://localhost/api/admin/exams/generate", { subject: "MATH", grade: 7, moeStandards: ["M1"] }))).json()).examId).toBe("exam-created-1");
  });

  it("covers guardian, admin, moe, and platform roles", async () => {
    setUser("GUARDIAN");
    const guardianPerf = await guardianPerformanceGet();
    expect(guardianPerf.status).toBe(200);
    expect(JSON.stringify(await guardianPerf.json())).not.toContain("confusionType");
    expect((await guardianDashboardGet()).status).toBe(200);

    setUser("ADMIN");
    expect((await (await adminStudentsGet()).json()).students[0].loginId).toBe("stu-a");
    expect((await (await adminTeachersGet()).json()).teachers[0].status).toBe("ACTIVE");
    expect((await adminDeliveryReportGet(req("GET", "http://localhost/api/admin/compliance/delivery-report?weekOf=2026-03-24"))).status).toBe(200);
    expect((await (await adminPilotReadinessGet()).json()).readinessScore).toBe(88);
    expect((await (await adminOnboardingReadinessGet()).json()).percentComplete).toBe(100);
    expect((await (await adminPublishExamPost(req("POST", "http://localhost/api/admin/exams/exam-created-1/publish"), { params: { examId: "exam-created-1" } })).json()).ok).toBe(true);

    setUser("MOE_OFFICIAL");
    const moeDashboard = await moeDashboardGet();
    expect(moeDashboard.status).toBe(200);
    expect((await moeDashboard.json())).toHaveProperty("examStats");
    expect((await moePlacementsGet()).status).toBe(200);
    expect((await moeStandardsCoverageGet()).status).toBe(200);

    state.currentUser = { id: "platform-admin-1", role: "ADMIN", schoolId: null, isPlatformAdmin: true };
    expect((await platformSchoolsGet()).status).toBe(200);
    expect((await platformSchoolsPost(req("POST", "http://localhost/api/platform/schools", { name: "School C", county: "Bong" }))).status).toBe(201);
    expect((await platformStatsGet()).status).toBe(200);
    expect((await (await adminPromptsGet()).json())).toHaveLength(2);
  });
});

describe("Feature-flag certification", () => {
  it("404s disabled Sprint 9 surfaces", async () => {
    state.flags.teacherIntelligence = false;
    state.flags.guardianProgress = false;
    state.flags.pilotDashboard = false;
    state.flags.pilotReadiness = false;
    state.flags.promptRegistry = false;

    setUser("TEACHER");
    expect((await teacherIntelligenceGet(new Request("http://localhost/api/teacher/intelligence/student-rec-1"), { params: { studentId: "student-rec-1" } })).status).toBe(404);
    setUser("GUARDIAN");
    expect((await guardianPerformanceGet()).status).toBe(404);
    setUser("ADMIN");
    expect((await adminPilotReadinessGet()).status).toBe(404);
    expect((await adminOnboardingReadinessGet()).status).toBe(404);
    expect((await adminPromptsGet()).status).toBe(404);
  });
});
