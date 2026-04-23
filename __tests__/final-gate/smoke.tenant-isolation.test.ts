import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const state = vi.hoisted(() => ({
  currentUser: { id: "student-user-a", role: "STUDENT", schoolId: "school-a", isPlatformAdmin: false } as any,
  flags: { deliveryCompliance: true, moePortal: true, examSystem: true, confusion: true, guardianProgress: true, teacherIntelligence: true },
}));

function req(url: string) {
  return new NextRequest(url);
}

vi.mock("@/lib/auth", () => ({
  requireRole: vi.fn(async (...roles: string[]) => {
    if (!roles.includes(state.currentUser.role)) throw Object.assign(new Error("Forbidden"), { status: 403 });
    return state.currentUser;
  }),
  requireUser: vi.fn(async () => state.currentUser),
}));

vi.mock("@/lib/audit", () => ({ logAudit: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/intelligence/performanceAggregator", () => ({
  getStudentPerformanceSummary: vi.fn(async () => ({ avgScore: 84, masteryLevel: "developing", improvementTrend: "improving" })),
  getClassPerformanceSummary: vi.fn(async () => ({ avgScore: 0.76 })),
}));
vi.mock("@/lib/reporting/teacherClassPerformance", () => ({
  buildTeacherClassPerformance: vi.fn(async () => []),
}));
vi.mock("@/lib/intelligence/teacherScope", () => ({
  getTeacherScope: vi.fn(async () => ({
    studentIds: ["student-a"],
    students: new Map([["student-a", { id: "student-a", name: "Student A", className: "JSS 1A", currentGrade: 7 }]]),
  })),
}));
vi.mock("@/lib/serverFlags", () => ({
  isDeliveryComplianceReportingEnabled: () => state.flags.deliveryCompliance,
  isMoePortalEnabled: () => state.flags.moePortal,
  isExamSystemEnabled: () => state.flags.examSystem,
  isConfusionDetectionEnabled: () => state.flags.confusion,
  isGuardianProgressViewEnabled: () => state.flags.guardianProgress,
  isTeacherIntelligenceDashboardEnabled: () => state.flags.teacherIntelligence,
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    student: {
      findMany: vi.fn(async () => [{ id: "student-a", currentGrade: 7, user: { id: "student-user-a", name: "Student A", email: "a@example.com", loginId: "stu-a", guardianPhoneE164: "+2311" } }]),
      findUnique: vi.fn(async () => ({ id: "student-a", currentGrade: 7, user: { schoolId: "school-a" }, enrollments: [{ classId: "class-a" }] })),
      count: vi.fn(async () => 100),
    },
    class: { findMany: vi.fn(async (args: any) => args.where.schoolId === "school-a" ? [{ id: "class-a", name: "JSS 1A", subject: "MATH" }] : [{ id: "class-b", name: "JSS 1B", subject: "MATH" }]) },
    scheduledWork: {
      findMany: vi.fn(async () => [{ id: "sw-a", classId: "class-a", scheduledDate: new Date(), progress: [], content: { contentId: "content-1", subject: "MATH", payload: { title: "Fractions" }, moeAlignments: [{ code: "M1" }], grade: 7, deliveryProfile: null } }]),
      count: vi.fn(async () => 10),
    },
    enrollment: { groupBy: vi.fn(async () => [{ classId: "class-a", _count: 20 }]) },
    school: { count: vi.fn(async () => 2), findMany: vi.fn(async () => [{ id: "school-a", districtId: "district-a", district: "District A", District: { id: "district-a", name: "District A" } }]) },
    district: { count: vi.fn(async () => 1) },
    interventionLog: { count: vi.fn(async () => 2) },
    exam: { count: vi.fn(async () => 1), findFirst: vi.fn(async (args: any) => args.where.schoolId === "school-a" && args.where.id === "exam-a" ? { id: "exam-a", questions: [{}, {}, {}, {}, {}], _count: { questions: 5 } } : null) },
    examAttempt: { findMany: vi.fn(async () => []), count: vi.fn(async () => 0), findFirst: vi.fn(async () => null), create: vi.fn(async () => ({ id: "attempt-a" })) },
    examCertification: { count: vi.fn(async () => 0) },
    studentGuardian: { findFirst: vi.fn(async () => ({ studentId: "student-a" })) },
    placementTest: { findMany: vi.fn(async () => [{ band: "7-9", teacherDecision: "accepted", teacherReason: null, details: { confidence: "high" }, student: { user: { schoolId: "school-a" } } }]) },
    curriculumContent: { findMany: vi.fn(async () => [{ moeAlignments: { standards: [{ code: "M1" }] } }]) },
    standard: { findMany: vi.fn(async () => [{ code: "M1", subject: "MATH", band: "7-9" }]) },
    confusionSignal: { findMany: vi.fn(async () => [{ id: "conf-a", studentId: "student-a", lessonId: "lesson-a", conceptTag: "MATH::fractions", confusionType: "misconception", severity: "medium", detectedAt: new Date() }]) },
    interventionRecommendation: { count: vi.fn(async () => 1), findMany: vi.fn(async () => []) },
    labSession: { count: vi.fn(async () => 0) },
    assignment: { count: vi.fn(async () => 0) },
  },
}));

import { GET as adminStudentsGet } from "@/app/api/admin/students/route";
import { GET as teacherScheduleGet } from "@/app/api/teacher/schedule/route";
import { GET as adminDeliveryReportGet } from "@/app/api/admin/compliance/delivery-report/route";
import { GET as moeDashboardGet } from "@/app/api/moe/dashboard/route";
import { GET as guardianPerformanceGet } from "@/app/api/guardian/performance/route";
import { POST as studentExamStartPost } from "@/app/api/student/exams/[examId]/start/route";
import { GET as teacherPerformanceGet } from "@/app/api/teacher/performance/route";
import { GET as teacherConfusionsGet } from "@/app/api/teacher/confusions/route";
import { GET as teacherIntelligenceGet } from "@/app/api/teacher/intelligence/[studentId]/route";

beforeEach(() => {
  vi.clearAllMocks();
  state.currentUser = { id: "student-user-a", role: "STUDENT", schoolId: "school-a", isPlatformAdmin: false };
  state.flags = { deliveryCompliance: true, moePortal: true, examSystem: true, confusion: true, guardianProgress: true, teacherIntelligence: true };
});

describe("Final gate tenant isolation certification", () => {
  it("enforces student, teacher, admin, moe, guardian, exam, adaptive, confusion, and teacher-detail boundaries", async () => {
    state.currentUser = { id: "student-user-a", role: "ADMIN", schoolId: "school-a", isPlatformAdmin: false };
    expect((await (await adminStudentsGet()).json()).students.every((student: any) => student.loginId === "stu-a")).toBe(true);

    state.currentUser = { id: "teacher-user-a", role: "TEACHER", schoolId: "school-a", isPlatformAdmin: false };
    state.flags.deliveryCompliance = false;
    expect((await (await teacherScheduleGet(req("http://localhost/api/teacher/schedule?weekOf=2026-03-24"))).json()).items.every((item: any) => item.classId === "class-a")).toBe(true);
    state.flags.deliveryCompliance = true;

    state.currentUser = { id: "admin-user-a", role: "ADMIN", schoolId: "school-a", isPlatformAdmin: false };
    expect((await adminDeliveryReportGet(req("http://localhost/api/admin/compliance/delivery-report?schoolId=school-b&weekOf=2026-03-24"))).status).toBe(403);

    state.currentUser = { id: "moe-user-1", role: "MOE_OFFICIAL", schoolId: null, isPlatformAdmin: false };
    const moeBody = await (await moeDashboardGet()).json();
    expect(moeBody).toHaveProperty("examStats");
    expect(JSON.stringify(moeBody)).not.toContain("a@example.com");

    state.currentUser = { id: "guardian-user-a", role: "GUARDIAN", schoolId: "school-a", isPlatformAdmin: false };
    const guardianBody = await (await guardianPerformanceGet()).json();
    expect(guardianBody).toHaveProperty("avgScore");
    expect(JSON.stringify(guardianBody)).not.toContain("conceptTag");

    state.currentUser = { id: "student-user-a", role: "STUDENT", schoolId: "school-a", isPlatformAdmin: false };
    expect((await studentExamStartPost(req("http://localhost/api/student/exams/exam-b/start"), { params: { examId: "exam-b" } })).status).toBe(404);

    state.currentUser = { id: "teacher-user-a", role: "TEACHER", schoolId: "school-a", isPlatformAdmin: false };
    expect((await teacherPerformanceGet()).status).toBe(200);
    expect((await (await teacherConfusionsGet(req("http://localhost/api/teacher/confusions"))).json()).every((row: any) => row.studentId === "student-a")).toBe(true);
    expect((await teacherIntelligenceGet(new Request("http://localhost/api/teacher/intelligence/student-b"), { params: { studentId: "student-b" } })).status).toBe(404);
  });
});
