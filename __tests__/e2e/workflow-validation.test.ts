/**
 * __tests__/e2e/workflow-validation.test.ts
 *
 * End-to-End Workflow Validation — 8 Steps + Multi-School Isolation
 *
 * Validates the complete workflow chain against the national scale demo data
 * structure. All routes run against mocks — no live DB required.
 *
 * Steps:
 *  1. Teacher schedules lesson          POST /api/teacher/schedule
 *  2. Lab auto-attaches to lesson       (virtual labs flag enabled)
 *  3. Student completes work            POST /api/student/work/[id]/complete
 *  4. Mastery updates after attempt     PATCH /api/student/labs/sessions/[id]
 *  5. Intervention triggers             (guardian dashboard interventionAlerts)
 *  6. Teacher sees delivery report      GET /api/teacher/schedule
 *  7. Guardian sees child's progress    GET /api/guardian/dashboard
 *  8. MOE dashboard shows compliance    GET /api/moe/dashboard
 *
 * Multi-school:
 *  Runs workflows for 3 concurrent schools — confirms cross-school isolation.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const mockRequireRole = vi.hoisted(() => vi.fn());
const mockRequireUser  = vi.hoisted(() => vi.fn());
const mockLogAudit     = vi.hoisted(() => vi.fn());

// Feature flags
const mockIsVirtualLabsEnabled                = vi.hoisted(() => vi.fn());
const mockIsAbBlockSchedulingEnabled          = vi.hoisted(() => vi.fn());
const mockIsAssignmentLessonLinkageEnabled    = vi.hoisted(() => vi.fn());
const mockIsDeliveryComplianceReportingEnabled = vi.hoisted(() => vi.fn());
const mockIsGuardianDashboardEnabled          = vi.hoisted(() => vi.fn());
const mockIsMoePortalEnabled                  = vi.hoisted(() => vi.fn());

// External services
const mockUpdateMasteryProfile = vi.hoisted(() => vi.fn());
const mockGradeToBand          = vi.hoisted(() => vi.fn());

// Prisma — class
const mockClassFindUnique = vi.hoisted(() => vi.fn());
const mockClassFindMany   = vi.hoisted(() => vi.fn());

// Prisma — content + scheduled work
const mockContentFindUnique  = vi.hoisted(() => vi.fn());
const mockSwCreate           = vi.hoisted(() => vi.fn());
const mockSwFindMany         = vi.hoisted(() => vi.fn());
const mockSwFindUnique       = vi.hoisted(() => vi.fn());
const mockSwCount            = vi.hoisted(() => vi.fn());

// Prisma — labs
const mockVirtualLabFindMany  = vi.hoisted(() => vi.fn());
const mockLabSessionFindUnique = vi.hoisted(() => vi.fn());
const mockLabSessionUpdate    = vi.hoisted(() => vi.fn());
const mockLabSessionCount     = vi.hoisted(() => vi.fn());
const mockStrandFindFirst     = vi.hoisted(() => vi.fn());

// Prisma — assignment suggestions
const mockSuggestionCreate = vi.hoisted(() => vi.fn());
const mockSuggestionCount  = vi.hoisted(() => vi.fn());

// Prisma — enrollment + student progress
const mockEnrollmentFindUnique = vi.hoisted(() => vi.fn());
const mockEnrollmentGroupBy    = vi.hoisted(() => vi.fn());
const mockStudentFindUnique    = vi.hoisted(() => vi.fn());
const mockStudentCount         = vi.hoisted(() => vi.fn());
const mockProgressUpsert       = vi.hoisted(() => vi.fn());
const mockProgressFindMany     = vi.hoisted(() => vi.fn());

// Prisma — guardian dashboard
const mockGuardianLinkFindMany = vi.hoisted(() => vi.fn());
const mockHwSubFindMany        = vi.hoisted(() => vi.fn());
const mockAssignSubFindMany    = vi.hoisted(() => vi.fn());
const mockHwFindMany           = vi.hoisted(() => vi.fn());
const mockAssignFindMany       = vi.hoisted(() => vi.fn());
const mockAttendFindMany       = vi.hoisted(() => vi.fn());
const mockMasteryFindMany      = vi.hoisted(() => vi.fn());
const mockMsgCount             = vi.hoisted(() => vi.fn());
const mockPlacementTestFindMany = vi.hoisted(() => vi.fn());
const mockLabSessionFindMany = vi.hoisted(() => vi.fn());

// Prisma — MOE dashboard
const mockSchoolCount       = vi.hoisted(() => vi.fn());
const mockDistrictCount     = vi.hoisted(() => vi.fn());
const mockInterventionCount = vi.hoisted(() => vi.fn());

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock("@/lib/auth", () => ({
  requireRole: mockRequireRole,
  requireUser:  mockRequireUser,
}));

vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));

vi.mock("@/lib/serverFlags", () => ({
  isVirtualLabsEnabled:                mockIsVirtualLabsEnabled,
  isAbBlockSchedulingEnabled:          mockIsAbBlockSchedulingEnabled,
  isAssignmentLessonLinkageEnabled:    mockIsAssignmentLessonLinkageEnabled,
  isDeliveryComplianceReportingEnabled: mockIsDeliveryComplianceReportingEnabled,
  isGuardianDashboardEnabled:          mockIsGuardianDashboardEnabled,
  isMoePortalEnabled:                  mockIsMoePortalEnabled,
}));

vi.mock("@/lib/mastery/masteryService", () => ({
  updateMasteryProfile: mockUpdateMasteryProfile,
}));

vi.mock("@/lib/moe/alignment-engine", () => ({
  gradeToBand: mockGradeToBand,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    class: {
      findUnique: mockClassFindUnique,
      findMany:   mockClassFindMany,
    },
    curriculumContent: { findUnique: mockContentFindUnique },
    scheduledWork: {
      create:    mockSwCreate,
      findMany:  mockSwFindMany,
      findUnique: mockSwFindUnique,
      count:     mockSwCount,
    },
    virtualLab:           { findMany: mockVirtualLabFindMany },
    assignmentSuggestion: { create: mockSuggestionCreate, count: mockSuggestionCount },
    enrollment: {
      findUnique: mockEnrollmentFindUnique,
      groupBy:    mockEnrollmentGroupBy,
    },
    student: {
      findUnique: mockStudentFindUnique,
      count:      mockStudentCount,
    },
    studentProgress:      { upsert: mockProgressUpsert, findMany: mockProgressFindMany },
    labSession: {
      findUnique: mockLabSessionFindUnique,
      update:     mockLabSessionUpdate,
      count:      mockLabSessionCount,
      findMany:   mockLabSessionFindMany,
    },
    strandCatalog:        { findFirst: mockStrandFindFirst },
    studentGuardian:      { findMany: mockGuardianLinkFindMany },
    homeworkSubmission:   { findMany: mockHwSubFindMany },
    assignmentSubmission: { findMany: mockAssignSubFindMany },
    homework:             { findMany: mockHwFindMany },
    assignment:           { findMany: mockAssignFindMany },
    attendanceRecord:     { findMany: mockAttendFindMany },
    studentMasteryProfile: { findMany: mockMasteryFindMany },
    guardianMessage:      { count: mockMsgCount },
    placementTest:        { findMany: mockPlacementTestFindMany },
    school:               { count: mockSchoolCount },
    district:             { count: mockDistrictCount },
    interventionLog:      { count: mockInterventionCount },
  },
}));

// ─── Route imports (after mocks) ──────────────────────────────────────────────

import {
  POST as schedulePost,
  GET  as scheduleGet,
} from "@/app/api/teacher/schedule/route";
import { POST as studentCompletePost } from "@/app/api/student/work/[scheduledWorkId]/complete/route";
import { PATCH as labSessionPatch }    from "@/app/api/student/labs/sessions/[sessionId]/route";
import { GET as guardianDashGet }      from "@/app/api/guardian/dashboard/route";
import { GET as moeDashGet }           from "@/app/api/moe/dashboard/route";

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const SCHOOL_A = "school-alpha";
const SCHOOL_B = "school-beta";
const SCHOOL_C = "school-gamma";

const TEACHER_A  = { id: "teacher-a-1", schoolId: SCHOOL_A, role: "TEACHER", isPlatformAdmin: false };
const TEACHER_B  = { id: "teacher-b-1", schoolId: SCHOOL_B, role: "TEACHER", isPlatformAdmin: false };
const STUDENT_A  = { id: "student-user-a-1", schoolId: SCHOOL_A, role: "STUDENT", isPlatformAdmin: false };
const GUARDIAN_A = { id: "guardian-a-1", schoolId: SCHOOL_A, role: "GUARDIAN", isPlatformAdmin: false };
const MOE_USER   = { id: "moe-1", schoolId: null, role: "MOE_OFFICIAL", isPlatformAdmin: false };

const SCIENCE_CONTENT = {
  id: "content-pk-sci",
  grade: 5,
  subject: "SCIENCE",
  moeAlignments: [{ code: "SCI-G5-ECO-01" }, { code: "SCI-G5-ECO-02" }],
  payload: { title: "Ecosystems of Liberia" },
  deliveryProfile: null,
};

const MATH_CONTENT = {
  id: "content-pk-math",
  grade: 5,
  subject: "MATH",
  moeAlignments: [],
  payload: { title: "Fractions" },
  deliveryProfile: null,
};

// ─── Request helpers ──────────────────────────────────────────────────────────

function makePostReq(body: object): NextRequest {
  return new NextRequest("http://localhost/api/test", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makeGetReq(url: string): Request {
  return new Request(url) as any;
}

function makePatchReq(body: object): NextRequest {
  return new NextRequest("http://localhost/api/test", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 1 — Teacher schedules lesson
// ─────────────────────────────────────────────────────────────────────────────

describe("Step 1 — Teacher schedules lesson (POST /api/teacher/schedule)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireRole.mockResolvedValue(TEACHER_A);
    mockIsAbBlockSchedulingEnabled.mockReturnValue(false);
    mockIsAssignmentLessonLinkageEnabled.mockReturnValue(false);
    mockIsVirtualLabsEnabled.mockReturnValue(false);
    mockClassFindUnique.mockResolvedValue({ schoolId: SCHOOL_A });
    mockContentFindUnique.mockResolvedValue(SCIENCE_CONTENT);
    mockSwCreate.mockResolvedValue({ id: "sw-new-1" });
    mockLogAudit.mockResolvedValue(undefined);
  });

  it("happy path — creates scheduled work and returns id", async () => {
    const req = makePostReq({
      contentId: "demo-content-sci-g4_6",
      classId: "cls-cha-scie-1",
      scheduledDate: "2026-03-10",
    });
    const res = await schedulePost(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveProperty("id", "sw-new-1");
  });

  it("scheduledWork.create receives correct classId and teacherId (createdById)", async () => {
    const req = makePostReq({
      contentId: "demo-content-sci-g4_6",
      classId: "cls-cha-scie-1",
      scheduledDate: "2026-03-10",
    });
    await schedulePost(req);

    expect(mockSwCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          contentId: "demo-content-sci-g4_6",
          classId: "cls-cha-scie-1",
          createdById: TEACHER_A.id,
        }),
      })
    );
  });

  it("creates an audit log entry with action schedule.created and correct schoolId", async () => {
    const req = makePostReq({
      contentId: "demo-content-sci-g4_6",
      classId: "cls-cha-scie-1",
      scheduledDate: "2026-03-10",
    });
    await schedulePost(req);

    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "schedule.created",
        resourceType: "scheduledWork",
        schoolId: SCHOOL_A,
      })
    );
  });

  it("returns 400 when required fields are missing", async () => {
    const req = makePostReq({ classId: "cls-cha-scie-1" }); // missing contentId + scheduledDate
    const res = await schedulePost(req);
    expect(res.status).toBe(400);
    expect(mockSwCreate).not.toHaveBeenCalled();
  });

  it("isolation — teacher cannot schedule for a class in another school (403)", async () => {
    mockClassFindUnique.mockResolvedValue({ schoolId: SCHOOL_B }); // class belongs to School B
    const req = makePostReq({
      contentId: "demo-content-sci-g4_6",
      classId: "cls-mcs-scie-1",
      scheduledDate: "2026-03-10",
    });
    const res = await schedulePost(req);

    expect(res.status).toBe(403);
    expect(mockSwCreate).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2 — Lab auto-attaches to lesson
// ─────────────────────────────────────────────────────────────────────────────

describe("Step 2 — Lab auto-attaches to lesson (virtual labs flag)", () => {
  const LAB_RECORD = {
    id: "lab-1",
    labId: "vlab-sci-eco-g4_6",
    title: "Liberia Ecosystem Simulation",
    labType: "simulation",
    estimatedMinutes: 30,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireRole.mockResolvedValue(TEACHER_A);
    mockIsAbBlockSchedulingEnabled.mockReturnValue(false);
    mockIsAssignmentLessonLinkageEnabled.mockReturnValue(false);
    mockIsVirtualLabsEnabled.mockReturnValue(true);
    mockClassFindUnique.mockResolvedValue({ schoolId: SCHOOL_A });
    mockContentFindUnique.mockResolvedValue(SCIENCE_CONTENT);
    mockVirtualLabFindMany.mockResolvedValue([LAB_RECORD]);
    mockSwCreate.mockResolvedValue({ id: "sw-new-2" });
    mockLogAudit.mockResolvedValue(undefined);
  });

  it("happy path — queries VirtualLab and attaches to schedule when labs enabled + content has MOE codes", async () => {
    const req = makePostReq({
      contentId: "demo-content-sci-g4_6",
      classId: "cls-cha-scie-1",
      scheduledDate: "2026-03-10",
    });
    await schedulePost(req);

    expect(mockVirtualLabFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "published",
          grade: SCIENCE_CONTENT.grade,
        }),
      })
    );
    expect(mockSwCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ suggestedLabs: [LAB_RECORD] }),
      })
    );
  });

  it("lab subject isolation — does NOT attach labs when content has no MOE alignment codes (plain Math)", async () => {
    mockContentFindUnique.mockResolvedValue(MATH_CONTENT); // empty moeAlignments
    const req = makePostReq({
      contentId: "demo-content-math-g4_6",
      classId: "cls-cha-math-0",
      scheduledDate: "2026-03-10",
    });
    await schedulePost(req);

    // No lab query should fire without valid MOE codes
    expect(mockVirtualLabFindMany).not.toHaveBeenCalled();
    // suggestedLabs should be absent from the create call
    const createCall = mockSwCreate.mock.calls[0]?.[0];
    expect(createCall?.data?.suggestedLabs).toBeUndefined();
  });

  it("flag isolation — does NOT query labs when ENABLE_VIRTUAL_LABS is off", async () => {
    mockIsVirtualLabsEnabled.mockReturnValue(false);
    const req = makePostReq({
      contentId: "demo-content-sci-g4_6",
      classId: "cls-cha-scie-1",
      scheduledDate: "2026-03-10",
    });
    await schedulePost(req);

    expect(mockVirtualLabFindMany).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// STEP 3 — Student completes work
// ─────────────────────────────────────────────────────────────────────────────

describe("Step 3 — Student completes work (POST /api/student/work/[id]/complete)", () => {
  const COMPLETED_AT = new Date("2026-03-10T09:30:00Z");

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireRole.mockResolvedValue(STUDENT_A);
    mockSwFindUnique.mockResolvedValue({
      id: "sw-1",
      classId: "cls-cha-math-0",
      class: { schoolId: SCHOOL_A },
    });
    mockStudentFindUnique.mockResolvedValue({ id: "student-rec-a-1" });
    mockEnrollmentFindUnique.mockResolvedValue({ id: "enroll-1" });
    mockProgressUpsert.mockResolvedValue({ completedAt: COMPLETED_AT });
    mockLogAudit.mockResolvedValue(undefined);
  });

  it("happy path — records completion and returns success + completedAt timestamp", async () => {
    const req = makePostReq({});
    const res = await studentCompletePost(req as any, {
      params: Promise.resolve({ scheduledWorkId: "sw-1" }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.completedAt).toBeDefined();
  });

  it("studentProgress.upsert uses correct composite key (studentId + scheduledWorkId)", async () => {
    const req = makePostReq({});
    await studentCompletePost(req as any, {
      params: Promise.resolve({ scheduledWorkId: "sw-1" }),
    });

    expect(mockProgressUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          studentId_scheduledWorkId: {
            studentId: STUDENT_A.id,
            scheduledWorkId: "sw-1",
          },
        },
        create: expect.objectContaining({
          studentId: STUDENT_A.id,
          scheduledWorkId: "sw-1",
        }),
        update: expect.objectContaining({ completedAt: expect.any(Date) }),
      })
    );
  });

  it("creates audit log entry with action lesson.completed", async () => {
    const req = makePostReq({});
    await studentCompletePost(req as any, {
      params: Promise.resolve({ scheduledWorkId: "sw-1" }),
    });

    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "lesson.completed",
        resourceType: "scheduledWork",
        resourceId: "sw-1",
      })
    );
  });

  it("returns 404 when scheduled work does not exist", async () => {
    mockSwFindUnique.mockResolvedValue(null);
    const req = makePostReq({});
    const res = await studentCompletePost(req as any, {
      params: Promise.resolve({ scheduledWorkId: "nonexistent" }),
    });

    expect(res.status).toBe(404);
    expect(mockProgressUpsert).not.toHaveBeenCalled();
  });

  it("isolation — student cannot complete work from another school (403)", async () => {
    mockSwFindUnique.mockResolvedValue({
      id: "sw-b-1",
      classId: "cls-mcs-math-0",
      class: { schoolId: SCHOOL_B }, // different school
    });
    const req = makePostReq({});
    const res = await studentCompletePost(req as any, {
      params: Promise.resolve({ scheduledWorkId: "sw-b-1" }),
    });

    expect(res.status).toBe(403);
    expect(mockProgressUpsert).not.toHaveBeenCalled();
  });

  it("isolation — student cannot complete work they are not enrolled for (403)", async () => {
    mockEnrollmentFindUnique.mockResolvedValue(null);
    const req = makePostReq({});
    const res = await studentCompletePost(req as any, {
      params: Promise.resolve({ scheduledWorkId: "sw-1" }),
    });

    expect(res.status).toBe(403);
    expect(mockProgressUpsert).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// STEP 4 — Mastery updates after attempt
// ─────────────────────────────────────────────────────────────────────────────

describe("Step 4 — Mastery updates after lab session (PATCH /api/student/labs/sessions/[id])", () => {
  const BASE_SESSION = {
    id: "session-1",
    studentId: STUDENT_A.id,
    schoolId: SCHOOL_A,
    labId: "lab-1",
    scheduledWorkId: "sw-1",
    score: null,
    masteryUpdated: false,
  };

  const SW_WITH_SCIENCE = {
    id: "sw-1",
    content: {
      subject: "SCIENCE",
      grade: 5,
      moeAlignments: [{ code: "SCI-G5-ECO-01" }],
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireRole.mockResolvedValue(STUDENT_A);
    mockIsVirtualLabsEnabled.mockReturnValue(true);
    mockLabSessionFindUnique.mockResolvedValue(BASE_SESSION);
    mockLabSessionUpdate.mockImplementation(({ data }) =>
      Promise.resolve({ ...BASE_SESSION, ...data })
    );
    mockStudentFindUnique.mockResolvedValue({ id: "student-rec-a-1" });
    mockSwFindUnique.mockResolvedValue(SW_WITH_SCIENCE);
    mockStrandFindFirst.mockResolvedValue({ strandKey: "ecosystems" });
    mockGradeToBand.mockReturnValue("G4_6");
    mockUpdateMasteryProfile.mockResolvedValue({
      profileId: "profile-1",
      studentId: "student-rec-a-1",
      currentScore: 0.85,
      masteryState: "APPROACHING",
      isAtRisk: false,
    });
    mockLogAudit.mockResolvedValue(undefined);
  });

  it("happy path — calls updateMasteryProfile with normalized score when completing with score", async () => {
    const req = makePatchReq({
      score: 85,
      completedAt: "2026-03-10T10:00:00Z",
      observations: "Observed ecosystem interactions",
      conclusions: "Ecosystems are interconnected",
    });
    const res = await labSessionPatch(req, { params: { sessionId: "session-1" } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveProperty("session");
    expect(mockUpdateMasteryProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        studentId: "student-rec-a-1",
        schoolId: SCHOOL_A,
        subject: "SCIENCE",
        strandKey: "ecosystems",
        gradeBand: "G4_6",
        newScore: 0.85,
        wasAiAssisted: false,
      })
    );
  });

  it("score normalisation — score 100 → newScore 1.0, score 0 → newScore 0.0", async () => {
    const req100 = makePatchReq({ score: 100, completedAt: "2026-03-10T10:00:00Z" });
    await labSessionPatch(req100, { params: { sessionId: "session-1" } });
    expect(mockUpdateMasteryProfile).toHaveBeenLastCalledWith(
      expect.objectContaining({ newScore: 1.0 })
    );

    mockLabSessionFindUnique.mockResolvedValue({ ...BASE_SESSION, masteryUpdated: false });
    const req0 = makePatchReq({ score: 0, completedAt: "2026-03-10T10:00:00Z" });
    await labSessionPatch(req0, { params: { sessionId: "session-1" } });
    expect(mockUpdateMasteryProfile).toHaveBeenLastCalledWith(
      expect.objectContaining({ newScore: 0.0 })
    );
  });

  it("does NOT call updateMasteryProfile for a partial update (no completedAt)", async () => {
    const req = makePatchReq({ observations: "partial notes only" });
    await labSessionPatch(req, { params: { sessionId: "session-1" } });
    expect(mockUpdateMasteryProfile).not.toHaveBeenCalled();
  });

  it("idempotent — does NOT re-trigger mastery when masteryUpdated is already true", async () => {
    mockLabSessionFindUnique.mockResolvedValue({ ...BASE_SESSION, masteryUpdated: true });
    const req = makePatchReq({ score: 90, completedAt: "2026-03-10T10:00:00Z" });
    await labSessionPatch(req, { params: { sessionId: "session-1" } });
    expect(mockUpdateMasteryProfile).not.toHaveBeenCalled();
  });

  it("isolation — student cannot update another student's session (403)", async () => {
    mockLabSessionFindUnique.mockResolvedValue({
      ...BASE_SESSION,
      studentId: "other-student-id", // different student
    });
    const req = makePatchReq({ score: 80, completedAt: "2026-03-10T10:00:00Z" });
    const res = await labSessionPatch(req, { params: { sessionId: "session-1" } });

    expect(res.status).toBe(403);
    expect(mockUpdateMasteryProfile).not.toHaveBeenCalled();
  });

  it("returns 404 when ENABLE_VIRTUAL_LABS is off", async () => {
    mockIsVirtualLabsEnabled.mockReturnValue(false);
    const req = makePatchReq({ score: 80, completedAt: "2026-03-10T10:00:00Z" });
    const res = await labSessionPatch(req, { params: { sessionId: "session-1" } });
    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// STEP 5 — Intervention triggers for at-risk students
// ─────────────────────────────────────────────────────────────────────────────

describe("Step 5 — Interventions for at-risk students (guardian dashboard interventionAlerts)", () => {
  const AT_RISK_STUDENT_RECORD = {
    id: "student-at-risk-1",
    userId: "user-at-risk-1",
    currentGrade: 3,
    county: "Montserrado",
    user: { name: "Flomo Kollie" },
    enrollments: [
      {
        classId: "cls-cha-math-0",
        Class: {
          id: "cls-cha-math-0",
          name: "Mathematics — Capitol Hill",
          subject: "MATH",
          School: { name: "Capitol Hill Academy" },
        },
      },
    ],
  };

  function setupDashboardBase() {
    mockRequireRole.mockResolvedValue(GUARDIAN_A);
    mockIsGuardianDashboardEnabled.mockReturnValue(true);
    mockLogAudit.mockResolvedValue(undefined);
    mockGuardianLinkFindMany.mockResolvedValue([{ studentId: "student-at-risk-1" }]);
    mockStudentFindUnique.mockResolvedValue(AT_RISK_STUDENT_RECORD);
    mockHwSubFindMany.mockResolvedValue([]);
    mockAssignSubFindMany.mockResolvedValue([]);
    mockHwFindMany.mockResolvedValue([]);
    mockAssignFindMany.mockResolvedValue([]);
    mockAttendFindMany.mockResolvedValue([]);
    mockProgressFindMany.mockResolvedValue([]);
    mockLabSessionFindMany.mockResolvedValue([]);
    mockPlacementTestFindMany.mockResolvedValue([]);
    mockMsgCount.mockResolvedValue(0);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    setupDashboardBase();
  });

  it("happy path — DECAYING mastery state creates declining_mastery interventionAlert", async () => {
    // findMany called twice: first for profile data, second for alert rows (DB-filtered)
    mockMasteryFindMany
      .mockResolvedValueOnce([
        { subject: "MATH", strandKey: "number_sense", currentScore: 0.18, baselineScore: 0.40 },
      ])
      .mockResolvedValueOnce([
        {
          subject: "MATH",
          strandKey: "number_sense",
          masteryState: "DECAYING",
          proficiencyState: "BELOW_PROFICIENT",
          updatedAt: new Date("2026-03-01"),
        },
      ]);
    const res = await guardianDashGet();
    const body = await res.json();

    expect(res.status).toBe(200);
    const child = body.children[0];
    expect(child.interventionAlerts).toHaveLength(1);
    expect(child.interventionAlerts[0].alertType).toBe("declining_mastery");
    expect(child.interventionAlerts[0].subject).toBe("MATH");
    expect(child.interventionAlerts[0].strandKey).toBe("number_sense");
  });

  it("BELOW_PROFICIENT proficiency state creates below_proficient interventionAlert", async () => {
    mockMasteryFindMany
      .mockResolvedValueOnce([
        { subject: "SCIENCE", strandKey: "ecosystems", currentScore: 0.35, baselineScore: 0.30 },
      ])
      .mockResolvedValueOnce([
        {
          subject: "SCIENCE",
          strandKey: "ecosystems",
          masteryState: "DEVELOPING",
          proficiencyState: "BELOW_PROFICIENT",
          updatedAt: new Date("2026-03-01"),
        },
      ]);
    const res = await guardianDashGet();
    const body = await res.json();

    expect(body.children[0].interventionAlerts[0].alertType).toBe("below_proficient");
  });

  it("MASTERED / PROFICIENT student produces no interventionAlerts", async () => {
    // First call: profile data; second call: DB filters out proficient → empty alerts
    mockMasteryFindMany
      .mockResolvedValueOnce([
        { subject: "MATH", strandKey: "algebra_basics", currentScore: 0.92, baselineScore: 0.80 },
      ])
      .mockResolvedValueOnce([]); // DB WHERE filters DECAYING/BELOW_PROFICIENT → none returned
    const res = await guardianDashGet();
    const body = await res.json();

    expect(body.children[0].interventionAlerts).toHaveLength(0);
  });

  it("scope enforced — guardian only sees alerts for their linked child, not all at-risk students", async () => {
    mockMasteryFindMany
      .mockResolvedValueOnce([
        { subject: "MATH", strandKey: "number_sense", currentScore: 0.15, baselineScore: 0.38 },
      ])
      .mockResolvedValueOnce([
        {
          subject: "MATH",
          strandKey: "number_sense",
          masteryState: "DECAYING",
          proficiencyState: "BELOW_PROFICIENT",
          updatedAt: new Date("2026-03-01"),
        },
      ]);
    const res = await guardianDashGet();
    const body = await res.json();

    // One child, one alert — not all at-risk students in the system
    expect(body.children).toHaveLength(1);
    expect(body.children[0].interventionAlerts).toHaveLength(1);
    // Confirm the alert is for this guardian's student specifically
    expect(mockStudentFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "student-at-risk-1" } })
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// STEP 6 — Teacher sees delivery report
// ─────────────────────────────────────────────────────────────────────────────

describe("Step 6 — Teacher sees delivery report (GET /api/teacher/schedule)", () => {
  const TEACHER_CLASSES = [{ id: "cls-cha-math-0", name: "Mathematics — Capitol Hill" }];

  const DELIVERED_SW = {
    id: "sw-delivered-1",
    classId: "cls-cha-math-0",
    scheduledDate: new Date("2026-03-03"),
    isDelivered: true,
    deliveredAt: new Date("2026-03-03T09:00:00Z"),
    completionRate: 88,
    classFormat: "standard",
    sessionPairId: null,
    status: "confirmed",
    content: {
      contentId: "demo-content-math-g4_6",
      subject: "MATH",
      payload: { title: "Fractions in Context" },
      moeAlignments: [{ code: "MATH-G5-FRA-01" }],
      grade: 5,
      deliveryProfile: null,
    },
    progress: [{ id: "prog-1" }, { id: "prog-2" }], // 2 students completed
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireRole.mockResolvedValue(TEACHER_A);
    mockIsDeliveryComplianceReportingEnabled.mockReturnValue(false);
    mockClassFindMany.mockResolvedValue(TEACHER_CLASSES);
    mockSwFindMany.mockResolvedValue([DELIVERED_SW]);
    mockEnrollmentGroupBy.mockResolvedValue([{ classId: "cls-cha-math-0", _count: 10 }]);
  });

  it("happy path — returns scheduled items with delivery status and completion data", async () => {
    const req = makeGetReq("http://localhost/api/teacher/schedule");
    const res = await scheduleGet(req as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.items).toHaveLength(1);

    const item = body.items[0];
    expect(item.id).toBe("sw-delivered-1");
    expect(item.isDelivered).toBe(true);
    expect(item.completionRate).toBe(88);
    expect(item.completedCount).toBe(2);    // from progress array length
    expect(item.totalStudents).toBe(10);    // from enrollment groupBy
    expect(item.title).toBe("Fractions in Context");
    expect(item.subject).toBe("MATH");
  });

  it("isolation — class.findMany is filtered by teacherId (teacher only sees own classes)", async () => {
    const req = makeGetReq("http://localhost/api/teacher/schedule");
    await scheduleGet(req as any);

    expect(mockClassFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          schoolId: SCHOOL_A,
          teacherId: TEACHER_A.id,
        }),
      })
    );
  });

  it("returns empty items when teacher has no schedule this week", async () => {
    mockSwFindMany.mockResolvedValue([]);
    const req = makeGetReq("http://localhost/api/teacher/schedule");
    const res = await scheduleGet(req as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.items).toHaveLength(0);
    expect(body.weekStart).toBeDefined();
  });

  it("response includes classes list and weekStart", async () => {
    const req = makeGetReq("http://localhost/api/teacher/schedule");
    const res = await scheduleGet(req as any);
    const body = await res.json();

    expect(body.classes).toEqual([{ id: "cls-cha-math-0", name: "Mathematics — Capitol Hill" }]);
    expect(typeof body.weekStart).toBe("string");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// STEP 7 — Guardian sees child's progress
// ─────────────────────────────────────────────────────────────────────────────

describe("Step 7 — Guardian sees child's progress (GET /api/guardian/dashboard)", () => {
  const STUDENT_RECORD_FULL = {
    id: "student-a-1",
    userId: "user-student-a-1",
    currentGrade: 6,
    county: "Montserrado",
    user: { name: "Korto Flomo" },
    enrollments: [
      {
        classId: "cls-cha-math-0",
        Class: {
          id: "cls-cha-math-0",
          name: "Mathematics — Capitol Hill",
          subject: "MATH",
          School: { name: "Capitol Hill Academy" },
        },
      },
    ],
  };

  const MASTERY_IMPROVING = [
    {
      subject: "MATH",
      strandKey: "algebra_basics",
      masteryState: "DEVELOPING",
      proficiencyState: "APPROACHING",
      currentScore: 0.68,
      baselineScore: 0.50, // trend: up (0.68 > 0.50 + 0.05)
      updatedAt: new Date("2026-03-01"),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireRole.mockResolvedValue(GUARDIAN_A);
    mockIsGuardianDashboardEnabled.mockReturnValue(true);
    mockLogAudit.mockResolvedValue(undefined);
    mockGuardianLinkFindMany.mockResolvedValue([{ studentId: "student-a-1" }]);
    mockStudentFindUnique.mockResolvedValue(STUDENT_RECORD_FULL);
    mockHwSubFindMany.mockResolvedValue([
      {
        teacherScore: 80,
        aiScore: null,
        submittedAt: new Date("2026-03-05"),
        // Route accesses s.Homework (capital H) from Prisma include
        Homework: { title: "Algebra Homework 1", Class: { subject: "MATH" } },
      },
    ]);
    mockAssignSubFindMany.mockResolvedValue([]);
    mockHwFindMany.mockResolvedValue([
      {
        id: "hw-upcoming",
        title: "Fractions Quiz",
        dueAt: new Date("2026-03-20"),
        Class: { subject: "MATH" },
      },
    ]);
    mockAssignFindMany.mockResolvedValue([]);
    mockAttendFindMany.mockResolvedValue([
      { status: "PRESENT" },
      { status: "PRESENT" },
      { status: "ABSENT" },
    ]);
    // findMany called twice: first for profile (select currentScore/baselineScore),
    // second for alert rows (select masteryState/proficiencyState/updatedAt).
    // APPROACHING proficiency → no alerts on second call.
    mockMasteryFindMany
      .mockResolvedValueOnce([
        { subject: "MATH", strandKey: "algebra_basics", currentScore: 0.68, baselineScore: 0.50 },
      ])
      .mockResolvedValueOnce([]); // no DECAYING/BELOW_PROFICIENT → no alerts
    mockProgressFindMany.mockResolvedValue([]);
    mockLabSessionFindMany.mockResolvedValue([]);
    mockPlacementTestFindMany.mockResolvedValue([]);
    mockMsgCount.mockResolvedValue(2);
  });

  it("happy path — returns child data with mastery trend, grades, attendance", async () => {
    const res = await guardianDashGet();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.children).toHaveLength(1);

    const child = body.children[0];
    expect(child.studentName).toBe("Korto Flomo");
    expect(child.grade).toBe(6);
    expect(child.school).toBe("Capitol Hill Academy");
    expect(child.masteryProfile).toHaveLength(1);
    expect(child.masteryProfile[0].trend).toBe("up"); // 0.68 > 0.50 + 0.05
    expect(child.attendance.presentDays).toBe(2);
    expect(child.attendance.absentDays).toBe(1);
    expect(child.recentGrades).toHaveLength(1);
    expect(child.upcomingAssignments).toHaveLength(1);
  });

  it("returns unreadMessages count correctly", async () => {
    // Each test gets fresh mocks from beforeEach (vi.clearAllMocks + setup).
    // Mastery calls use the two mockResolvedValueOnce values from beforeEach.
    const res = await guardianDashGet();
    const body = await res.json();
    expect(body.unreadMessages).toBe(2);
  });

  it("returns 404 when ENABLE_GUARDIAN_DASHBOARD flag is off", async () => {
    mockIsGuardianDashboardEnabled.mockReturnValue(false);
    const res = await guardianDashGet();
    expect(res.status).toBe(404);
  });

  it("returns 403 when guardian has no linked children", async () => {
    mockGuardianLinkFindMany.mockResolvedValue([]);
    const res = await guardianDashGet();
    expect(res.status).toBe(403);
  });

  it("isolation — student.findUnique is called only with guardian's linked studentId", async () => {
    // The beforeEach already sets up mockMasteryFindMany with two mockResolvedValueOnce.
    // This test relies on that setup (no override needed).
    await guardianDashGet();

    expect(mockStudentFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "student-a-1" } })
    );
    // Confirm it was only called once — no cross-student queries
    expect(mockStudentFindUnique).toHaveBeenCalledTimes(1);
  });

  it("mastery profile data reflects recent attempts — trend is 'down' when score falls", async () => {
    // Reset and replace the beforeEach queue with declining data
    mockMasteryFindMany.mockReset();
    mockMasteryFindMany
      .mockResolvedValueOnce([
        // Profile: currentScore 0.30 < baselineScore 0.60 - 0.05 → deriveTrend returns "down"
        { subject: "MATH", strandKey: "algebra_basics", currentScore: 0.30, baselineScore: 0.60 },
      ])
      .mockResolvedValueOnce([]); // alert rows (not relevant to trend assertion)
    const res = await guardianDashGet();
    const body = await res.json();

    expect(body.children[0].masteryProfile[0].trend).toBe("down");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// STEP 8 — MOE dashboard shows compliance data
// ─────────────────────────────────────────────────────────────────────────────

describe("Step 8 — MOE dashboard shows compliance data (GET /api/moe/dashboard)", () => {
  function setupMoeCounts() {
    mockSwCount
      .mockResolvedValueOnce(500)   // total scheduled work
      .mockResolvedValueOnce(425);  // delivered
    mockSchoolCount.mockResolvedValue(10);
    mockDistrictCount.mockResolvedValue(3);
    mockStudentCount.mockResolvedValue(325);
    mockInterventionCount.mockResolvedValue(48);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUser.mockResolvedValue(MOE_USER);
    mockIsMoePortalEnabled.mockReturnValue(true);
    mockLogAudit.mockResolvedValue(undefined);
    setupMoeCounts();
  });

  it("happy path — returns aggregate national metrics without any school-level PII", async () => {
    const res = await moeDashGet();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.schools).toBe(10);
    expect(body.districts).toBe(3);
    expect(body.students).toBe(325);
    expect(body.scheduledWork.total).toBe(500);
    expect(body.scheduledWork.delivered).toBe(425);
    expect(body.scheduledWork.deliveryRatePct).toBe(85); // 425/500 = 85%
    expect(body.interventionsLast30Days).toBe(48);

    // No PII fields in response
    expect(body).not.toHaveProperty("studentNames");
    expect(body).not.toHaveProperty("teacherEmails");
    expect(body).not.toHaveProperty("schoolDetails");
  });

  it("response includes generatedAt timestamp", async () => {
    const before = new Date().toISOString();
    const res = await moeDashGet();
    const body = await res.json();
    const after = new Date().toISOString();

    expect(body.generatedAt).toBeDefined();
    expect(body.generatedAt >= before).toBe(true);
    expect(body.generatedAt <= after).toBe(true);
  });

  it("logs MOE_DASHBOARD_VIEW audit event on successful access", async () => {
    await moeDashGet();

    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: MOE_USER.id,
        action: "MOE_DASHBOARD_VIEW",
        resourceType: "national_dashboard",
      })
    );
  });

  it("isolation — TEACHER role returns 403 (not an MOE_OFFICIAL)", async () => {
    mockRequireUser.mockResolvedValue(TEACHER_A);
    const res = await moeDashGet();

    expect(res.status).toBe(403);
    expect(mockSchoolCount).not.toHaveBeenCalled();
    expect(mockStudentCount).not.toHaveBeenCalled();
  });

  it("isolation — GUARDIAN role returns 403", async () => {
    mockRequireUser.mockResolvedValue(GUARDIAN_A);
    const res = await moeDashGet();
    expect(res.status).toBe(403);
  });

  it("platform admin bypasses role check — ADMIN with isPlatformAdmin=true gets 200", async () => {
    mockRequireUser.mockResolvedValue({
      id: "platform-admin-1",
      role: "ADMIN",
      isPlatformAdmin: true,
    });
    const res = await moeDashGet();
    expect(res.status).toBe(200);
  });

  it("returns 404 when ENABLE_MOE_PORTAL flag is off", async () => {
    mockIsMoePortalEnabled.mockReturnValue(false);
    const res = await moeDashGet();
    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// MULTI-SCHOOL SIMULTANEOUS VALIDATION
// ─────────────────────────────────────────────────────────────────────────────

describe("Multi-school simultaneous validation — 3 concurrent schools (A, B, C)", () => {
  describe("Step 1 cross-school: Teachers in different schools cannot schedule for each other", () => {
    it("School A teacher blocked from scheduling in School B class (403)", async () => {
      vi.clearAllMocks();
      mockRequireRole.mockResolvedValue(TEACHER_A); // schoolId = SCHOOL_A
      mockIsAbBlockSchedulingEnabled.mockReturnValue(false);
      mockIsAssignmentLessonLinkageEnabled.mockReturnValue(false);
      mockIsVirtualLabsEnabled.mockReturnValue(false);
      mockClassFindUnique.mockResolvedValue({ schoolId: SCHOOL_B }); // class in School B
      mockContentFindUnique.mockResolvedValue(SCIENCE_CONTENT);

      const req = makePostReq({
        contentId: "demo-content-sci-g4_6",
        classId: "cls-mcs-scie-1",
        scheduledDate: "2026-03-10",
      });
      const res = await schedulePost(req);

      expect(res.status).toBe(403);
      expect(mockSwCreate).not.toHaveBeenCalled();
    });

    it("School B teacher can independently schedule for their own class (200)", async () => {
      vi.clearAllMocks();
      mockRequireRole.mockResolvedValue(TEACHER_B); // schoolId = SCHOOL_B
      mockIsAbBlockSchedulingEnabled.mockReturnValue(false);
      mockIsAssignmentLessonLinkageEnabled.mockReturnValue(false);
      mockIsVirtualLabsEnabled.mockReturnValue(false);
      mockClassFindUnique.mockResolvedValue({ schoolId: SCHOOL_B }); // matches teacher
      mockContentFindUnique.mockResolvedValue(SCIENCE_CONTENT);
      mockSwCreate.mockResolvedValue({ id: "sw-school-b-1" });
      mockLogAudit.mockResolvedValue(undefined);

      const req = makePostReq({
        contentId: "demo-content-sci-g4_6",
        classId: "cls-mcs-scie-1",
        scheduledDate: "2026-03-10",
      });
      const res = await schedulePost(req);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.id).toBe("sw-school-b-1");
    });
  });

  describe("Step 3 cross-school: Student work completion is strictly school-scoped", () => {
    it("School A student cannot complete scheduled work from School B (403)", async () => {
      vi.clearAllMocks();
      mockRequireRole.mockResolvedValue(STUDENT_A); // schoolId = SCHOOL_A
      mockSwFindUnique.mockResolvedValue({
        id: "sw-b-99",
        classId: "cls-mcs-math-0",
        class: { schoolId: SCHOOL_B }, // different school
      });
      mockStudentFindUnique.mockResolvedValue({ id: "student-rec-a-1" });
      mockLogAudit.mockResolvedValue(undefined);

      const req = makePostReq({});
      const res = await studentCompletePost(req as any, {
        params: Promise.resolve({ scheduledWorkId: "sw-b-99" }),
      });

      expect(res.status).toBe(403);
      expect(mockProgressUpsert).not.toHaveBeenCalled();
    });
  });

  describe("Step 4 cross-school: Mastery update blocked for mismatched student/school", () => {
    it("Lab session PATCH rejected when session belongs to a student in a different school (403)", async () => {
      vi.clearAllMocks();
      mockRequireRole.mockResolvedValue(STUDENT_A); // School A student
      mockIsVirtualLabsEnabled.mockReturnValue(true);
      mockLabSessionFindUnique.mockResolvedValue({
        id: "session-b-99",
        studentId: "student-user-b-99", // different student
        schoolId: SCHOOL_B,             // different school
        labId: "lab-1",
        scheduledWorkId: "sw-b-1",
        score: null,
        masteryUpdated: false,
      });
      mockLogAudit.mockResolvedValue(undefined);

      const req = makePatchReq({ score: 90, completedAt: "2026-03-10T10:00:00Z" });
      const res = await labSessionPatch(req, { params: { sessionId: "session-b-99" } });

      expect(res.status).toBe(403);
      expect(mockUpdateMasteryProfile).not.toHaveBeenCalled();
    });
  });

  describe("Step 7 cross-school: Guardian dashboard strictly isolates by linked children", () => {
    it("School A guardian sees only School A child — School B and C data absent", async () => {
      vi.clearAllMocks();
      mockRequireRole.mockResolvedValue(GUARDIAN_A); // School A guardian
      mockIsGuardianDashboardEnabled.mockReturnValue(true);
      mockLogAudit.mockResolvedValue(undefined);
      // Guardian only linked to School A student
      mockGuardianLinkFindMany.mockResolvedValue([{ studentId: "student-a-1" }]);
      mockStudentFindUnique.mockResolvedValue({
        id: "student-a-1",
        userId: "user-student-a-1",
        currentGrade: 5,
        county: "Montserrado",
        user: { name: "Pewu Kollie" },
        enrollments: [
          {
            classId: "cls-cha-math-0",
            Class: {
              id: "cls-cha-math-0",
              name: "Maths — Capitol Hill",
              subject: "MATH",
              School: { name: "Capitol Hill Academy" }, // School A
            },
          },
        ],
      });
      mockHwSubFindMany.mockResolvedValue([]);
      mockAssignSubFindMany.mockResolvedValue([]);
      mockHwFindMany.mockResolvedValue([]);
      mockAssignFindMany.mockResolvedValue([]);
      mockAttendFindMany.mockResolvedValue([]);
      mockMasteryFindMany.mockResolvedValue([]);
      mockProgressFindMany.mockResolvedValue([]);
      mockLabSessionFindMany.mockResolvedValue([]);
      mockPlacementTestFindMany.mockResolvedValue([]);
      mockMsgCount.mockResolvedValue(0);

      const res = await guardianDashGet();
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.children).toHaveLength(1);
      expect(body.children[0].school).toBe("Capitol Hill Academy");
      // student.findUnique called exactly once, only for the linked student
      expect(mockStudentFindUnique).toHaveBeenCalledTimes(1);
      expect(mockStudentFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "student-a-1" } })
      );
    });
  });

  describe("Step 8 cross-school: MOE dashboard aggregates all 3 schools with no isolation gaps", () => {
    it("MOE dashboard includes aggregate totals across all schools — no per-school breakdown exposed", async () => {
      vi.clearAllMocks();
      mockRequireUser.mockResolvedValue(MOE_USER);
      mockIsMoePortalEnabled.mockReturnValue(true);
      mockLogAudit.mockResolvedValue(undefined);
      // 3 districts, 10 schools, 325 students (matching demo seed totals)
      mockSchoolCount.mockResolvedValue(10);
      mockDistrictCount.mockResolvedValue(3);
      mockStudentCount.mockResolvedValue(325);
      mockSwCount
        .mockResolvedValueOnce(500)
        .mockResolvedValueOnce(425);
      mockInterventionCount.mockResolvedValue(48);

      const res = await moeDashGet();
      const body = await res.json();

      expect(res.status).toBe(200);
      // Aggregate totals reflect all 3 districts / 10 schools
      expect(body.schools).toBe(10);
      expect(body.districts).toBe(3);
      expect(body.students).toBe(325);
      // Response has no school-level breakdown
      expect(body).not.toHaveProperty("schoolBreakdown");
      expect(body).not.toHaveProperty("perDistrict");
    });

    it("School C isolation — STUDENT from School C cannot access MOE dashboard (403)", async () => {
      vi.clearAllMocks();
      mockRequireUser.mockResolvedValue({
        id: "student-c-1",
        role: "STUDENT",
        schoolId: SCHOOL_C,
        isPlatformAdmin: false,
      });
      mockIsMoePortalEnabled.mockReturnValue(true);
      mockLogAudit.mockResolvedValue(undefined);

      const res = await moeDashGet();
      expect(res.status).toBe(403);
      expect(mockSchoolCount).not.toHaveBeenCalled();
    });
  });
});
