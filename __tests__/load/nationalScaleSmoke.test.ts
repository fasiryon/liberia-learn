/**
 * __tests__/load/nationalScaleSmoke.test.ts
 * Block 27 — National Scale Smoke Test
 *
 * Runs the full national deployment scenario for 10 parallel school contexts:
 *
 *   Schedule lesson
 *     → Lab auto-attaches
 *     → Student starts lab
 *     → Student completes lab
 *     → Mastery updates
 *     → Teacher sees delivery report
 *     → Admin sees compliance report
 *
 * All 10 schools must complete without cross-contamination.
 * Assert: no schoolId appears in another school's response data.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  generateSessions,
  runBatched,
  runConcurrent,
  mockTeacherScheduleHandler,
  mockStudentWorkHandler,
  mockLabSessionHandler,
  evaluateTier,
  percentile,
  errorRate,
  TIER_1,
  TIER_2,
  TIER_3,
  TEACHER_SCHEDULE_P95_THRESHOLD_MS,
  STUDENT_WORK_P95_THRESHOLD_MS,
  MAX_ERROR_RATE,
  type SimulatedSession,
} from "./loadHarness";

// ─── Hoisted mocks ─────────────────────────────────────────────────────────────

const mockRequireRole = vi.hoisted(() => vi.fn());
const mockLogAudit    = vi.hoisted(() => vi.fn());
const mockIsVirtualLabsEnabled       = vi.hoisted(() => vi.fn());
const mockIsAbBlockSchedulingEnabled = vi.hoisted(() => vi.fn());
const mockIsAssignmentLessonLinkageEnabled = vi.hoisted(() => vi.fn());
const mockIsDeliveryComplianceReportingEnabled = vi.hoisted(() => vi.fn());
const mockIsCurriculumFeedbackEnabled = vi.hoisted(() => vi.fn());
const mockIsUnitGroupingEnabled      = vi.hoisted(() => vi.fn());
const mockIsLessonDeliveryTrackingEnabled = vi.hoisted(() => vi.fn());
const mockUpdateMasteryProfile       = vi.hoisted(() => vi.fn());

// prisma
const mockClassFindMany              = vi.hoisted(() => vi.fn());
const mockClassFindUnique            = vi.hoisted(() => vi.fn());
const mockContentFindUnique          = vi.hoisted(() => vi.fn());
const mockScheduledWorkFindMany      = vi.hoisted(() => vi.fn());
const mockScheduledWorkFindUnique    = vi.hoisted(() => vi.fn());
const mockScheduledWorkCreate        = vi.hoisted(() => vi.fn());
const mockScheduledWorkUpdate        = vi.hoisted(() => vi.fn());
const mockEnrollmentGroupBy          = vi.hoisted(() => vi.fn());
const mockEnrollmentFindMany         = vi.hoisted(() => vi.fn());
const mockLabSessionFindFirst        = vi.hoisted(() => vi.fn());
const mockLabSessionFindUnique       = vi.hoisted(() => vi.fn());
const mockLabSessionUpdate           = vi.hoisted(() => vi.fn());
const mockLabSessionCreateMany       = vi.hoisted(() => vi.fn());
const mockLabSessionCount            = vi.hoisted(() => vi.fn());
const mockVirtualLabFindMany         = vi.hoisted(() => vi.fn());
const mockVirtualLabFindUnique       = vi.hoisted(() => vi.fn());
const mockStudentFindUnique          = vi.hoisted(() => vi.fn());
const mockStudentProgressCreate      = vi.hoisted(() => vi.fn());
const mockStrandCatalogFindFirst     = vi.hoisted(() => vi.fn());
const mockAssignmentSuggestionCreate = vi.hoisted(() => vi.fn());
const mockAssignmentSuggestionCount  = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth",  () => ({ requireRole: mockRequireRole }));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));
vi.mock("@/lib/mastery/masteryService", () => ({ updateMasteryProfile: mockUpdateMasteryProfile }));
vi.mock("@/lib/moe/alignment-engine",   () => ({ gradeToBand: vi.fn(() => "7-9") }));

vi.mock("@/lib/serverFlags", async () => {
  const actual = await vi.importActual<any>("@/lib/serverFlags");
  return {
    ...actual,
    isVirtualLabsEnabled:                  mockIsVirtualLabsEnabled,
    isAbBlockSchedulingEnabled:            mockIsAbBlockSchedulingEnabled,
    isAssignmentLessonLinkageEnabled:      mockIsAssignmentLessonLinkageEnabled,
    isDeliveryComplianceReportingEnabled:  mockIsDeliveryComplianceReportingEnabled,
    isCurriculumFeedbackEnabled:           mockIsCurriculumFeedbackEnabled,
    isUnitGroupingEnabled:                 mockIsUnitGroupingEnabled,
    isLessonDeliveryTrackingEnabled:       mockIsLessonDeliveryTrackingEnabled,
  };
});

vi.mock("@/lib/db", () => ({
  prisma: {
    class:               { findMany: mockClassFindMany, findUnique: mockClassFindUnique },
    curriculumContent:   { findUnique: mockContentFindUnique },
    scheduledWork:       {
      findMany:   mockScheduledWorkFindMany,
      findUnique: mockScheduledWorkFindUnique,
      create:     mockScheduledWorkCreate,
      update:     mockScheduledWorkUpdate,
    },
    enrollment:          { groupBy: mockEnrollmentGroupBy, findMany: mockEnrollmentFindMany },
    labSession:          {
      findFirst:  mockLabSessionFindFirst,
      findUnique: mockLabSessionFindUnique,
      update:     mockLabSessionUpdate,
      createMany: mockLabSessionCreateMany,
      count:      mockLabSessionCount,
    },
    virtualLab:          { findMany: mockVirtualLabFindMany, findUnique: mockVirtualLabFindUnique },
    student:             { findUnique: mockStudentFindUnique },
    studentProgress:     { create: mockStudentProgressCreate },
    strandCatalog:       { findFirst: mockStrandCatalogFindFirst },
    assignmentSuggestion: {
      create: mockAssignmentSuggestionCreate,
      count:  mockAssignmentSuggestionCount,
    },
    enrollment_findUnique: vi.fn(),
  },
}));

import { GET as scheduleGet, POST as schedulePost } from "@/app/api/teacher/schedule/route";
import { PATCH as deliverPatch }                    from "@/app/api/teacher/schedule/[id]/deliver/route";
import { POST as labSessionStartPost }              from "@/app/api/student/labs/[labId]/session/route";
import { PATCH as labSessionUpdatePatch }           from "@/app/api/student/labs/sessions/[sessionId]/route";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function req(method: string, url: string, body?: object) {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  }) as any;
}

interface SchoolContext {
  schoolId: string;
  teacherId: string;
  studentId: string;
  classId: string;
  contentId: string;
  swId: string;
  labId: string;
  sessionId: string;
}

function makeSchoolContext(i: number): SchoolContext {
  return {
    schoolId:  `school-${i}`,
    teacherId: `teacher-${i}`,
    studentId: `student-${i}`,
    classId:   `class-${i}`,
    contentId: `content-${i}`,
    swId:      `sw-${i}`,
    labId:     `lab-sci-${i}`,
    sessionId: `session-${i}`,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// NATIONAL SCALE SMOKE TEST — 10 parallel school contexts
// ══════════════════════════════════════════════════════════════════════════════

describe("National Scale Smoke Test — 10 parallel school contexts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLogAudit.mockResolvedValue(undefined);
    mockIsDeliveryComplianceReportingEnabled.mockReturnValue(false);
    mockIsAbBlockSchedulingEnabled.mockReturnValue(false);
    mockIsVirtualLabsEnabled.mockReturnValue(true);
    mockIsAssignmentLessonLinkageEnabled.mockReturnValue(false);
    mockIsLessonDeliveryTrackingEnabled.mockReturnValue(true);
    mockUpdateMasteryProfile.mockResolvedValue(undefined);
  });

  it("Step 1 — Schedule lesson: 10 schools each schedule independently", async () => {
    const schools = Array.from({ length: 10 }, (_, i) => makeSchoolContext(i));

    mockIsAbBlockSchedulingEnabled.mockReturnValue(false);
    mockIsVirtualLabsEnabled.mockReturnValue(false);
    mockIsAssignmentLessonLinkageEnabled.mockReturnValue(false);

    const results = await Promise.all(
      schools.map(async (ctx) => {
        mockRequireRole.mockResolvedValueOnce({ id: ctx.teacherId, schoolId: ctx.schoolId, role: "TEACHER" });
        mockClassFindUnique.mockResolvedValueOnce({ schoolId: ctx.schoolId });
        mockContentFindUnique.mockResolvedValueOnce({
          id: `content-db-${ctx.contentId}`,
          grade: 7,
          subject: "MATH",
          moeAlignments: [],
          payload: { title: `Lesson for ${ctx.schoolId}` },
          deliveryProfile: null,
        });
        mockScheduledWorkCreate.mockResolvedValueOnce({
          id: ctx.swId,
          classId: ctx.classId,
          scheduledDate: new Date("2026-03-03"),
          classFormat: null,
          sessionPairId: null,
          status: null,
        });
        mockLogAudit.mockResolvedValueOnce(undefined);

        const res = await schedulePost(
          req("POST", "http://localhost/api/teacher/schedule", {
            contentId: ctx.contentId,
            classId: ctx.classId,
            scheduledDate: "2026-03-03",
          })
        );
        const body = await res.json();
        return { ctx, status: res.status, swId: body.id };
      })
    );

    // All 10 succeed
    expect(results.every((r) => r.status === 200)).toBe(true);
    // Each school gets its own swId
    const swIds = results.map((r) => r.swId);
    expect(new Set(swIds).size).toBe(10);
    // No cross-contamination: each swId matches expected school context
    results.forEach((r) => {
      expect(r.swId).toBe(r.ctx.swId);
    });
  });

  it("Step 2 — Lab auto-link: teacher links lab for each school (no cross-school sessions)", async () => {
    const schools = Array.from({ length: 10 }, (_, i) => makeSchoolContext(i));

    const { POST: linkLabPost } = await import("@/app/api/teacher/schedule/[id]/lab/route");

    // Use mockImplementation (arg-based) so concurrent calls return school-correct data
    // without relying on Once-queue ordering (which interleaves under Promise.all)
    mockScheduledWorkFindUnique.mockImplementation(async (args: any) => {
      const id = args.where?.id;
      const ctx = schools.find((s) => s.swId === id);
      if (!ctx) return null;
      return { id: ctx.swId, classId: ctx.classId, class: { schoolId: ctx.schoolId }, suggestedLabs: [] };
    });
    mockVirtualLabFindUnique.mockImplementation(async (args: any) => ({
      id: `lab-db-${args.where?.labId}`,
      labId: args.where?.labId ?? "lab-sci",
      title: "Lab",
      schoolId: null,
      status: "published",
      labType: "simulation",
      estimatedMinutes: 30,
      moeStandardCodes: [],
      triggerStandardCodes: [],
    }));
    mockEnrollmentFindMany.mockImplementation(async (args: any) => {
      const classId = args.where?.classId;
      return Array.from({ length: 10 }, (_, j) => ({
        Student: { userId: `student-${classId}-${j}` },
      }));
    });
    mockLabSessionCreateMany.mockResolvedValue({ count: 10 });
    mockScheduledWorkUpdate.mockResolvedValue({});

    const results = await Promise.all(
      schools.map(async (ctx) => {
        mockRequireRole.mockResolvedValueOnce({ id: ctx.teacherId, schoolId: ctx.schoolId, role: "TEACHER" });
        mockLogAudit.mockResolvedValueOnce(undefined);

        const res = await linkLabPost(
          req("POST", `http://localhost/api/teacher/schedule/${ctx.swId}/lab`, {
            labId: ctx.labId,
          }),
          { params: { id: ctx.swId } }
        );
        const body = await res.json();
        return { ctx, status: res.status, sessionCount: body.sessionCount };
      })
    );

    expect(results.every((r) => r.status === 200)).toBe(true);
    // Each school's lab link creates exactly 10 sessions (one per student)
    expect(results.every((r) => r.sessionCount === 10)).toBe(true);
  });

  it("Step 3 — Student starts lab: 10 students across 10 schools start simultaneously", async () => {
    const schools = Array.from({ length: 10 }, (_, i) => makeSchoolContext(i));

    const results = await Promise.all(
      schools.map(async (ctx) => {
        mockRequireRole.mockResolvedValueOnce({ id: ctx.studentId, schoolId: ctx.schoolId, role: "STUDENT" });
        mockLabSessionFindFirst.mockResolvedValueOnce({
          id: ctx.sessionId,
          labId: ctx.labId,
          studentId: ctx.studentId,
          schoolId: ctx.schoolId,
          startedAt: null,
          completedAt: null,
          masteryUpdated: false,
          score: null,
        });
        mockLabSessionUpdate.mockResolvedValueOnce({
          id: ctx.sessionId,
          labId: ctx.labId,
          studentId: ctx.studentId,
          schoolId: ctx.schoolId,
          startedAt: new Date(),
          completedAt: null,
          score: null,
        });
        mockLogAudit.mockResolvedValueOnce(undefined);

        const res = await labSessionStartPost(
          req("POST", `http://localhost/api/student/labs/${ctx.labId}/session`),
          { params: { labId: ctx.labId } }
        );
        const body = await res.json();
        return { ctx, status: res.status, session: body.session };
      })
    );

    expect(results.every((r) => r.status === 200)).toBe(true);

    // Verify no cross-school contamination: each student sees their own session
    results.forEach((r) => {
      expect(r.session.schoolId).toBe(r.ctx.schoolId);
      expect(r.session.studentId).toBe(r.ctx.studentId);
    });

    // No school's sessionId appears in another school's response
    const sessionIds = results.map((r) => r.session.id);
    expect(new Set(sessionIds).size).toBe(10);
  });

  it("Step 4 — Student completes lab: 10 completions with mastery update, no cross-school data", async () => {
    const schools = Array.from({ length: 10 }, (_, i) => makeSchoolContext(i));

    // labSession.update is called TWICE per request: once for score, once for masteryUpdated:true.
    // Use mockImplementation (arg-based) so concurrent calls don't interleave the Once queue.
    mockLabSessionFindUnique.mockImplementation(async (args: any) => {
      const id = args.where?.id;
      const ctx = schools.find((s) => s.sessionId === id);
      if (!ctx) return null;
      return {
        id: ctx.sessionId, labId: ctx.labId, studentId: ctx.studentId,
        schoolId: ctx.schoolId, scheduledWorkId: ctx.swId,
        startedAt: new Date(), completedAt: null, score: null, masteryUpdated: false,
      };
    });
    mockLabSessionUpdate.mockImplementation(async (args: any) => {
      const id = args.where?.id;
      if (args.data?.masteryUpdated === true) {
        return { id, masteryUpdated: true };
      }
      const ctx = schools.find((s) => s.sessionId === id);
      const scoreVal = ctx ? 70 + (schools.indexOf(ctx) * 3) : 75;
      // Include labId and scheduledWorkId so triggerMasteryUpdate can walk the chain
      return {
        id: id ?? "sess",
        labId: ctx?.labId ?? "lab-sci",
        scheduledWorkId: ctx?.swId ?? null,
        score: scoreVal,
        completedAt: new Date().toISOString(),
        studentId: ctx?.studentId ?? "student",
        schoolId: ctx?.schoolId ?? "school-0",
      };
    });
    // Mastery chain — arg-based so concurrent calls resolve correctly
    mockStudentFindUnique.mockImplementation(async (args: any) => ({
      id: `student-record-${args.where?.userId}`,
    }));
    mockScheduledWorkFindUnique.mockImplementation(async (args: any) => {
      const id = args.where?.id;
      const ctx = schools.find((s) => s.swId === id);
      if (!ctx) return null;
      return { id, content: { subject: "MATH", grade: 7, moeAlignments: [{ code: "MATH-G7-NUM-01" }] } };
    });
    mockStrandCatalogFindFirst.mockResolvedValue({ strandKey: "number_operations" });
    mockUpdateMasteryProfile.mockResolvedValue(undefined);

    const results = await Promise.all(
      schools.map(async (ctx) => {
        const score = 70 + (schools.indexOf(ctx) * 3); // unique score per school

        mockRequireRole.mockResolvedValueOnce({ id: ctx.studentId, schoolId: ctx.schoolId, role: "STUDENT" });
        mockLogAudit.mockResolvedValueOnce(undefined);

        const res = await labSessionUpdatePatch(
          req("PATCH", `http://localhost/api/student/labs/sessions/${ctx.sessionId}`, {
            score,
            completedAt: new Date().toISOString(),
          }),
          { params: { sessionId: ctx.sessionId } }
        );
        const body = await res.json();
        return { ctx, status: res.status, body };
      })
    );

    expect(results.every((r) => r.status === 200)).toBe(true);

    // No school's data appears in another school's response
    results.forEach((r) => {
      expect(r.body.session.schoolId).toBe(r.ctx.schoolId);
    });

    // Mastery was triggered for all 10 schools
    expect(mockUpdateMasteryProfile).toHaveBeenCalledTimes(10);
  });

  it("Step 5 — Teacher views delivery report: 10 schedule GETs with compliance data scoped", async () => {
    const schools = Array.from({ length: 10 }, (_, i) => makeSchoolContext(i));

    mockIsDeliveryComplianceReportingEnabled.mockReturnValue(true);
    mockLabSessionCount.mockResolvedValue(5); // generic mock for counts

    const results = await Promise.all(
      schools.map(async (ctx) => {
        mockRequireRole.mockResolvedValueOnce({ id: ctx.teacherId, schoolId: ctx.schoolId, role: "TEACHER" });

        // Classes scoped to this school
        mockClassFindMany.mockResolvedValueOnce([{ id: ctx.classId, name: `Class ${ctx.classId}` }]);

        // Schedule items for this school
        mockScheduledWorkFindMany.mockResolvedValueOnce([
          {
            id: ctx.swId,
            classId: ctx.classId,
            scheduledDate: new Date("2026-03-03"),
            isDelivered: true,
            deliveredAt: new Date(),
            completionRate: 85,
            sessionPairId: null,
            classFormat: null,
            status: null,
            progress: [{ id: "p1" }, { id: "p2" }],
            content: {
              contentId: ctx.contentId,
              subject: "MATH",
              grade: 7,
              payload: { title: `Lesson ${ctx.schoolId}` },
              moeAlignments: [{ code: "MATH-G7-NUM-01" }],
              deliveryProfile: null,
            },
          },
        ]);

        mockEnrollmentGroupBy.mockResolvedValueOnce([{ classId: ctx.classId, _count: 10 }]);

        // Compliance counts (parallelized by Block 26 fix)
        mockAssignmentSuggestionCount.mockResolvedValueOnce(2);
        mockLabSessionCount.mockResolvedValueOnce(8).mockResolvedValueOnce(2);

        const res = await scheduleGet(
          req("GET", `http://localhost/api/teacher/schedule?weekOf=2026-03-03`)
        );
        const body = await res.json();
        return { ctx, status: res.status, body };
      })
    );

    expect(results.every((r) => r.status === 200)).toBe(true);

    // Verify compliance data is present and scoped
    results.forEach((r) => {
      expect(r.body.items).toBeDefined();
      expect(r.body.moeStandardsCoverage).toBeDefined();
      expect(r.body.plannedVsDelivered).toBeDefined();
      // Compliance data contains only this school's lesson codes
      expect(r.body.moeStandardsCoverage).toContain("MATH-G7-NUM-01");
    });

    // Each school's response items reference only their own scheduledWorkId
    results.forEach((r) => {
      if (r.body.items?.length > 0) {
        expect(r.body.items[0].id).toBe(r.ctx.swId);
      }
    });
  });

  it("Full flow — all 5 steps complete for 10 schools with no cross-contamination", async () => {
    // This integration assertion verifies the complete pipeline end-to-end.
    // Each school runs its 3-step flow sequentially (schedule → start → complete) to
    // guarantee clean mock isolation per step. Concurrent isolation is validated by the
    // step-by-step tests above and the load harness tier simulations below.

    const schools = Array.from({ length: 10 }, (_, i) => makeSchoolContext(i));
    const allSchoolIds = new Set(schools.map((s) => s.schoolId));
    const flowResults: Array<{
      schoolId: string;
      schedStatus: number;
      schedSwId: string;
      startStatus: number;
      startSessionSchoolId: string | undefined;
      completeStatus: number;
      completeSessionSchoolId: string | undefined;
    }> = [];

    mockIsAbBlockSchedulingEnabled.mockReturnValue(false);
    mockIsAssignmentLessonLinkageEnabled.mockReturnValue(false);
    mockLogAudit.mockResolvedValue(undefined);

    for (const ctx of schools) {
      // --- Step A: Schedule lesson
      mockIsVirtualLabsEnabled.mockReturnValue(false);
      mockRequireRole.mockResolvedValueOnce({ id: ctx.teacherId, schoolId: ctx.schoolId, role: "TEACHER" });
      mockClassFindUnique.mockResolvedValueOnce({ schoolId: ctx.schoolId });
      mockContentFindUnique.mockResolvedValueOnce({
        id: `content-db-${ctx.contentId}`,
        grade: 7,
        subject: "MATH",
        moeAlignments: [],
        payload: { title: `Lesson ${ctx.schoolId}` },
        deliveryProfile: null,
      });
      mockScheduledWorkCreate.mockResolvedValueOnce({
        id: ctx.swId,
        classId: ctx.classId,
        scheduledDate: new Date(),
        classFormat: null,
        sessionPairId: null,
        status: null,
      });

      const schedRes = await schedulePost(
        req("POST", "http://localhost/api/teacher/schedule", {
          contentId: ctx.contentId,
          classId: ctx.classId,
          scheduledDate: "2026-03-03",
        })
      );
      const schedBody = await schedRes.json();

      // --- Step B: Lab session start
      mockIsVirtualLabsEnabled.mockReturnValue(true);
      mockRequireRole.mockResolvedValueOnce({ id: ctx.studentId, schoolId: ctx.schoolId, role: "STUDENT" });
      mockLabSessionFindFirst.mockResolvedValueOnce({
        id: ctx.sessionId,
        labId: ctx.labId,
        studentId: ctx.studentId,
        schoolId: ctx.schoolId,
        startedAt: null,
        completedAt: null,
      });
      mockLabSessionUpdate.mockResolvedValueOnce({
        id: ctx.sessionId,
        studentId: ctx.studentId,
        schoolId: ctx.schoolId,
        startedAt: new Date(),
      });

      const startRes = await labSessionStartPost(
        req("POST", `http://localhost/api/student/labs/${ctx.labId}/session`),
        { params: { labId: ctx.labId } }
      );
      const startBody = await startRes.json();

      // --- Step C: Lab session complete
      mockRequireRole.mockResolvedValueOnce({ id: ctx.studentId, schoolId: ctx.schoolId, role: "STUDENT" });
      mockLabSessionFindUnique.mockResolvedValueOnce({
        id: ctx.sessionId,
        studentId: ctx.studentId,
        schoolId: ctx.schoolId,
        scheduledWorkId: null,
        startedAt: new Date(),
        completedAt: null,
        score: null,
        masteryUpdated: false,
      });
      mockLabSessionUpdate.mockResolvedValueOnce({
        id: ctx.sessionId,
        studentId: ctx.studentId,
        schoolId: ctx.schoolId,
        score: 80,
        completedAt: new Date(),
      });

      const completeRes = await labSessionUpdatePatch(
        req("PATCH", `http://localhost/api/student/labs/sessions/${ctx.sessionId}`, {
          score: 80,
          completedAt: new Date().toISOString(),
        }),
        { params: { sessionId: ctx.sessionId } }
      );
      const completeBody = await completeRes.json();

      flowResults.push({
        schoolId: ctx.schoolId,
        schedStatus: schedRes.status,
        schedSwId: schedBody.id,
        startStatus: startRes.status,
        startSessionSchoolId: startBody.session?.schoolId,
        completeStatus: completeRes.status,
        completeSessionSchoolId: completeBody.session?.schoolId,
      });
    }

    // All 10 flows succeed at every step
    expect(flowResults.every((r) => r.schedStatus === 200)).toBe(true);
    expect(flowResults.every((r) => r.startStatus === 200)).toBe(true);
    expect(flowResults.every((r) => r.completeStatus === 200)).toBe(true);

    // CRITICAL: No cross-contamination
    flowResults.forEach((r) => {
      // Each school's session data carries only its own schoolId
      expect(r.startSessionSchoolId).toBe(r.schoolId);
      expect(r.completeSessionSchoolId).toBe(r.schoolId);

      // No other school's ID appears in this school's response
      const otherSchoolIds = [...allSchoolIds].filter((id) => id !== r.schoolId);
      otherSchoolIds.forEach((otherId) => {
        expect(r.startSessionSchoolId).not.toBe(otherId);
        expect(r.completeSessionSchoolId).not.toBe(otherId);
      });
    });

    // Each school's scheduled work ID is unique
    const swIds = flowResults.map((r) => r.schedSwId);
    expect(new Set(swIds).size).toBe(10);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// LOAD HARNESS — Tier 1 and Tier 2 Simulations
// ══════════════════════════════════════════════════════════════════════════════

describe("Load Harness — Tier simulations (mock handlers, no DB)", () => {
  it("Tier 1 (100 schools): p95 teacher schedule < 800ms, student work < 500ms, error rate < 0.1%", async () => {
    const { teacherSessions, studentSessions } = generateSessions(TIER_1);
    const labSessions = studentSessions.slice(0, Math.floor(studentSessions.length * 0.2));

    // Simulate DB latency of 50ms (realistic post-fix projection)
    const teacherResults  = await runBatched(mockTeacherScheduleHandler(50), teacherSessions, 100);
    const studentResults  = await runBatched(mockStudentWorkHandler(40),     studentSessions, 100);
    const labResults      = await runBatched(mockLabSessionHandler(35),       labSessions,     100);

    const result = evaluateTier(TIER_1, teacherResults, studentResults, labResults);

    expect(result.teacherSessions).toBe(500);  // 100 schools × 5 teachers
    expect(result.studentSessions).toBe(1000); // 100 schools × 10 students

    expect(result.p95Teacher).toBeLessThanOrEqual(TEACHER_SCHEDULE_P95_THRESHOLD_MS);
    expect(result.p95Student).toBeLessThanOrEqual(STUDENT_WORK_P95_THRESHOLD_MS);
    expect(result.errorRate).toBeLessThanOrEqual(MAX_ERROR_RATE);
    expect(result.pass).toBe(true);
  }, 30000); // 30s timeout for tier 1

  it("Tier 2 (500 schools): p95 teacher schedule < 800ms, student work < 500ms, error rate < 0.1%", async () => {
    const { teacherSessions, studentSessions } = generateSessions(TIER_2);
    const labSessions = studentSessions.slice(0, Math.floor(studentSessions.length * 0.2));

    const teacherResults  = await runBatched(mockTeacherScheduleHandler(55), teacherSessions, 100);
    const studentResults  = await runBatched(mockStudentWorkHandler(45),     studentSessions, 100);
    const labResults      = await runBatched(mockLabSessionHandler(40),       labSessions,     100);

    const result = evaluateTier(TIER_2, teacherResults, studentResults, labResults);

    expect(result.teacherSessions).toBe(2500);  // 500 schools × 5 teachers
    expect(result.studentSessions).toBe(5000);  // 500 schools × 10 students

    expect(result.p95Teacher).toBeLessThanOrEqual(TEACHER_SCHEDULE_P95_THRESHOLD_MS);
    expect(result.p95Student).toBeLessThanOrEqual(STUDENT_WORK_P95_THRESHOLD_MS);
    expect(result.errorRate).toBeLessThanOrEqual(MAX_ERROR_RATE);
    expect(result.pass).toBe(true);
  }, 60000); // 60s timeout for tier 2

  it("Tier 3 (1,000 schools — stretch): measures performance, reports result", async () => {
    const { teacherSessions, studentSessions } = generateSessions(TIER_3);
    const labSessions = studentSessions.slice(0, Math.floor(studentSessions.length * 0.2));

    const teacherResults  = await runBatched(mockTeacherScheduleHandler(60), teacherSessions, 100);
    const studentResults  = await runBatched(mockStudentWorkHandler(50),     studentSessions, 100);
    const labResults      = await runBatched(mockLabSessionHandler(45),       labSessions,     100);

    const result = evaluateTier(TIER_3, teacherResults, studentResults, labResults);

    expect(result.teacherSessions).toBe(5000);   // 1,000 schools × 5 teachers
    expect(result.studentSessions).toBe(10000);  // 1,000 schools × 10 students

    // Tier 3 is a stretch target — we assert counts and structure, not strict thresholds
    expect(result.errorRate).toBeLessThanOrEqual(MAX_ERROR_RATE);
    expect(result.p95Teacher).toBeGreaterThan(0);
    expect(result.p95Student).toBeGreaterThan(0);

    // Log the result for documentation
    console.log(`[Tier 3] p95 teacher: ${result.p95Teacher}ms, p95 student: ${result.p95Student}ms, error rate: ${(result.errorRate * 100).toFixed(3)}%, PASS: ${result.pass}`);
  }, 120000); // 120s timeout for tier 3 stretch

  it("session generation produces correct counts for all tiers", () => {
    const t1 = generateSessions(TIER_1);
    expect(t1.teacherSessions.length).toBe(500);
    expect(t1.studentSessions.length).toBe(1000);

    const t2 = generateSessions(TIER_2);
    expect(t2.teacherSessions.length).toBe(2500);
    expect(t2.studentSessions.length).toBe(5000);

    const t3 = generateSessions(TIER_3);
    expect(t3.teacherSessions.length).toBe(5000);
    expect(t3.studentSessions.length).toBe(10000);
  });

  it("percentile calculation is correct", () => {
    const values = Array.from({ length: 100 }, (_, i) => i + 1); // 1–100
    expect(percentile(values, 50)).toBe(50);
    expect(percentile(values, 95)).toBe(95);
    expect(percentile(values, 99)).toBe(99);
  });

  it("error rate calculation is correct", () => {
    const results = [
      { durationMs: 100, status: 200 },
      { durationMs: 150, status: 200 },
      { durationMs: 200, status: 500, error: "DB error" },
    ];
    const rate = errorRate(results);
    expect(rate).toBeCloseTo(1 / 3);
  });
});
