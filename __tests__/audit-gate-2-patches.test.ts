/**
 * __tests__/audit-gate-2-patches.test.ts
 * Audit Gate 2 — surgical patch verification tests.
 *
 * Covers every gap fixed in phase5/audit-gate-2:
 *  1. logAudit schoolId present in curriculum approve/reject
 *  2. logAudit called on CurriculumUnit create
 *  3. logAudit called on LabSession start
 *  4. logAudit called on LabSession complete
 *  5. Flag-off → 404 (not 200 / 500) for all new routes that lacked explicit tests
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Hoisted mocks ─────────────────────────────────────────────────────────────

const mockRequireRole = vi.hoisted(() => vi.fn());
const mockRequireUser = vi.hoisted(() => vi.fn());
const mockLogAudit   = vi.hoisted(() => vi.fn());

// feature flags
const mockIsUnitGroupingEnabled            = vi.hoisted(() => vi.fn());
const mockIsUnitAssemblyEnabled            = vi.hoisted(() => vi.fn());
const mockIsVirtualLabsEnabled             = vi.hoisted(() => vi.fn());
const mockIsLessonDeliveryTrackingEnabled  = vi.hoisted(() => vi.fn());
const mockIsCurriculumFeedbackEnabled      = vi.hoisted(() => vi.fn());

// prisma operations
const mockCurriculumContentFindUnique  = vi.hoisted(() => vi.fn());
const mockCurriculumContentUpdate      = vi.hoisted(() => vi.fn());
const mockCurriculumFeedbackCreate     = vi.hoisted(() => vi.fn());
const mockCurriculumUnitCreate         = vi.hoisted(() => vi.fn());
const mockCurriculumUnitFindMany       = vi.hoisted(() => vi.fn());
const mockCurriculumContentGroupBy     = vi.hoisted(() => vi.fn());
const mockAuditLogCount                = vi.hoisted(() => vi.fn());
const mockLabSessionFindFirst          = vi.hoisted(() => vi.fn());
const mockLabSessionFindUnique         = vi.hoisted(() => vi.fn());
const mockLabSessionUpdate             = vi.hoisted(() => vi.fn());
const mockScheduledWorkFindUnique      = vi.hoisted(() => vi.fn());
const mockEnrollmentFindMany           = vi.hoisted(() => vi.fn());
const mockStudentFindUnique            = vi.hoisted(() => vi.fn());
const mockStrandCatalogFindFirst       = vi.hoisted(() => vi.fn());
const mockScheduledWorkUpdate          = vi.hoisted(() => vi.fn());
const mockAssembleUnit                 = vi.hoisted(() => vi.fn());

// ─── Module mocks ──────────────────────────────────────────────────────────────

vi.mock("@/lib/auth", () => ({
  requireRole: mockRequireRole,
  requireUser: mockRequireUser,
}));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));

vi.mock("@/lib/serverFlags", async () => {
  const actual = await vi.importActual<any>("@/lib/serverFlags");
  return {
    ...actual,
    isUnitGroupingEnabled:           mockIsUnitGroupingEnabled,
    isUnitAssemblyEnabled:           mockIsUnitAssemblyEnabled,
    isVirtualLabsEnabled:            mockIsVirtualLabsEnabled,
    isLessonDeliveryTrackingEnabled: mockIsLessonDeliveryTrackingEnabled,
    isCurriculumFeedbackEnabled:     mockIsCurriculumFeedbackEnabled,
  };
});

vi.mock("@/lib/ai/units/unitAssembler", () => ({
  assembleUnit: mockAssembleUnit,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    curriculumContent: {
      findUnique: mockCurriculumContentFindUnique,
      update:     mockCurriculumContentUpdate,
    },
    curriculumFeedback: {
      create: mockCurriculumFeedbackCreate,
    },
    curriculumUnit: {
      create:   mockCurriculumUnitCreate,
      findMany: mockCurriculumUnitFindMany,
    },
    auditLog: {
      count: mockAuditLogCount,
    },
    curriculumContent_groupBy: mockCurriculumContentGroupBy, // alias resolved below
    labSession: {
      findFirst:  mockLabSessionFindFirst,
      findUnique: mockLabSessionFindUnique,
      update:     mockLabSessionUpdate,
    },
    scheduledWork: {
      findUnique: mockScheduledWorkFindUnique,
      update:     mockScheduledWorkUpdate,
    },
    enrollment:    { findMany: mockEnrollmentFindMany },
    student:       { findUnique: mockStudentFindUnique },
    strandCatalog: { findFirst: mockStrandCatalogFindFirst },
  },
}));

vi.mock("@/lib/moe/alignment-engine", () => ({ gradeToBand: vi.fn(() => "7-9") }));
vi.mock("@/lib/mastery/masteryService", () => ({ updateMasteryProfile: vi.fn() }));

// ─── Route imports (after mocks are registered) ────────────────────────────────

import { POST as approvePost } from "@/app/api/admin/curriculum/approve/route";
import { POST as rejectPost }  from "@/app/api/admin/curriculum/reject/route";
import { POST as unitsPost }   from "@/app/api/admin/curriculum/units/route";
import { GET  as unitsGet }    from "@/app/api/teacher/curriculum/units/route";
import { POST as labSessionStartPost }    from "@/app/api/student/labs/[labId]/session/route";
import { PATCH as labSessionUpdatePatch } from "@/app/api/student/labs/sessions/[sessionId]/route";

// ─── Fixture data ──────────────────────────────────────────────────────────────

const ADMIN_USER   = { id: "user-admin-1",   schoolId: "school-1", role: "ADMIN"   };
const TEACHER_USER = { id: "user-teacher-1", schoolId: "school-1", role: "TEACHER" };
const STUDENT_USER = { id: "user-student-1", schoolId: "school-1", role: "STUDENT" };

const CONTENT_RECORD = {
  contentId: "content-1",
  status: "accepted",
  grade: 7,
  subject: "MATH",
  payload: { type: "full_pack" },
};

const UNIT_RECORD = {
  id: "unit-db-id-1",
  unitId: "unit-uuid-1",
  name: "Fractions",
  subject: "MATH",
  grade: 4,
  schoolId: "school-1",
  targetStandardCodes: [],
  weekStart: 1,
  weekEnd: 2,
  createdById: "user-admin-1",
  createdAt: new Date(),
};

const ASSEMBLED_UNIT = {
  unit: { unitId: "unit-uuid-1" },
  lessons: Array.from({ length: 7 }, (_, index) => ({ id: `lesson-${index + 1}` })),
};

const LAB_SESSION = {
  id: "sess-1",
  labId: "lab-sci-1",
  studentId: "user-student-1",
  schoolId: "school-1",
  scheduledWorkId: null,
  startedAt: null,
  completedAt: null,
  score: null,
  masteryUpdated: false,
};

function req(method: string, url: string, body?: object) {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  }) as any;
}

// ══════════════════════════════════════════════════════════════════════════════
// CATEGORY 4 — Audit Logging Patch Verification
// ══════════════════════════════════════════════════════════════════════════════

describe("Audit Gate 2 — Category 4: logAudit patch verification", () => {

  // ── curriculum approve ────────────────────────────────────────────────────

  describe("POST /api/admin/curriculum/approve — logAudit includes schoolId", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockRequireUser.mockResolvedValue(ADMIN_USER);
      mockIsCurriculumFeedbackEnabled.mockReturnValue(false);
      mockCurriculumContentFindUnique.mockResolvedValue(CONTENT_RECORD);
      mockCurriculumContentUpdate.mockResolvedValue({ ...CONTENT_RECORD, status: "published" });
      mockLogAudit.mockResolvedValue(undefined);
    });

    it("calls logAudit with schoolId on successful approval", async () => {
      const res = await approvePost(
        req("POST", "http://localhost/api/admin/curriculum/approve", { contentId: "content-1" })
      );

      expect(res.status).toBe(200);
      expect(mockLogAudit).toHaveBeenCalledOnce();

      const auditArg = mockLogAudit.mock.calls[0][0];
      expect(auditArg.action).toBe("curriculum.approve");
      expect(auditArg.schoolId).toBe("school-1");
      expect(auditArg.resourceId).toBe("content-1");
    });

    it("logAudit is called before telemetry block — audit always runs", async () => {
      // logAudit has its own internal try/catch in production so it never throws.
      // This test verifies that logAudit is invoked regardless of whether
      // telemetry (isCurriculumFeedbackEnabled) is enabled.
      mockIsCurriculumFeedbackEnabled.mockReturnValue(true);
      mockCurriculumFeedbackCreate.mockResolvedValue({});

      await approvePost(
        req("POST", "http://localhost/api/admin/curriculum/approve", { contentId: "content-1" })
      );

      // logAudit called first, then telemetry
      expect(mockLogAudit).toHaveBeenCalledOnce();
      expect(mockCurriculumFeedbackCreate).toHaveBeenCalledOnce();
    });
  });

  // ── curriculum reject ─────────────────────────────────────────────────────

  describe("POST /api/admin/curriculum/reject — logAudit includes schoolId", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockRequireUser.mockResolvedValue(ADMIN_USER);
      mockIsCurriculumFeedbackEnabled.mockReturnValue(false);
      mockCurriculumContentFindUnique.mockResolvedValue(CONTENT_RECORD);
      mockCurriculumContentUpdate.mockResolvedValue({ ...CONTENT_RECORD, status: "rejected" });
      mockLogAudit.mockResolvedValue(undefined);
    });

    it("calls logAudit with schoolId on successful rejection", async () => {
      const res = await rejectPost(
        req("POST", "http://localhost/api/admin/curriculum/reject", {
          contentId: "content-1",
          rejectionReason: "Missing objectives",
        })
      );

      expect(res.status).toBe(200);
      expect(mockLogAudit).toHaveBeenCalledOnce();

      const auditArg = mockLogAudit.mock.calls[0][0];
      expect(auditArg.action).toBe("curriculum.reject");
      expect(auditArg.schoolId).toBe("school-1");
      expect(auditArg.resourceId).toBe("content-1");
    });

    it("includes hasRejectionReason in details when reason provided", async () => {
      await rejectPost(
        req("POST", "http://localhost/api/admin/curriculum/reject", {
          contentId: "content-1",
          rejectionReason: "Reason text",
        })
      );

      const auditArg = mockLogAudit.mock.calls[0][0];
      expect(auditArg.details?.hasRejectionReason).toBe(true);
    });

    it("hasRejectionReason is false when no reason provided", async () => {
      await rejectPost(
        req("POST", "http://localhost/api/admin/curriculum/reject", { contentId: "content-1" })
      );

      const auditArg = mockLogAudit.mock.calls[0][0];
      expect(auditArg.details?.hasRejectionReason).toBe(false);
    });
  });

  // ── curriculum unit create ────────────────────────────────────────────────

  describe("POST /api/admin/curriculum/units — logAudit on create", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockRequireUser.mockResolvedValue({ ...ADMIN_USER, isPlatformAdmin: false });
      mockIsUnitAssemblyEnabled.mockReturnValue(true);
      mockAuditLogCount.mockResolvedValue(0);
      mockAssembleUnit.mockResolvedValue(ASSEMBLED_UNIT);
      mockLogAudit.mockResolvedValue(undefined);
    });

    it("calls logAudit with action admin.unit.assembled and schoolId", async () => {
      const res = await unitsPost(
        req("POST", "http://localhost/api/admin/curriculum/units", {
          subject: "MATH",
          gradeLevel: 4,
          unitTitle: "Fractions",
        })
      );

      expect(res.status).toBe(200);
      expect(mockLogAudit).toHaveBeenCalledOnce();

      const auditArg = mockLogAudit.mock.calls[0][0];
      expect(auditArg.action).toBe("admin.unit.assembled");
      expect(auditArg.resourceType).toBe("curriculum_unit");
      expect(auditArg.schoolId).toBe("school-1");
    });

    it("returns 503 when ENABLE_UNIT_ASSEMBLY flag is OFF", async () => {
      mockIsUnitAssemblyEnabled.mockReturnValue(false);
      const res = await unitsPost(
        req("POST", "http://localhost/api/admin/curriculum/units", {
          subject: "MATH",
          gradeLevel: 4,
          unitTitle: "X",
        })
      );
      expect(res.status).toBe(503);
      expect(mockLogAudit).not.toHaveBeenCalled();
    });
  });

  // ── lab session start ─────────────────────────────────────────────────────

  describe("POST /api/student/labs/[labId]/session — logAudit on start", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockRequireRole.mockResolvedValue(STUDENT_USER);
      mockIsVirtualLabsEnabled.mockReturnValue(true);
      mockLabSessionFindFirst.mockResolvedValue({ ...LAB_SESSION });
      mockLabSessionUpdate.mockResolvedValue({ ...LAB_SESSION, startedAt: new Date() });
      mockLogAudit.mockResolvedValue(undefined);
    });

    it("calls logAudit with action lab.session.start on successful start", async () => {
      const res = await labSessionStartPost(
        req("POST", "http://localhost/api/student/labs/lab-sci-1/session"),
        { params: { labId: "lab-sci-1" } }
      );

      expect(res.status).toBe(200);
      expect(mockLogAudit).toHaveBeenCalledOnce();

      const auditArg = mockLogAudit.mock.calls[0][0];
      expect(auditArg.action).toBe("lab.session.start");
      expect(auditArg.resourceType).toBe("labSession");
      expect(auditArg.schoolId).toBe("school-1");
      expect(auditArg.details?.labId).toBe("lab-sci-1");
    });

    it("does NOT call logAudit when session already completed (returns early)", async () => {
      mockLabSessionFindFirst.mockResolvedValue({
        ...LAB_SESSION,
        completedAt: new Date(),
      });

      const res = await labSessionStartPost(
        req("POST", "http://localhost/api/student/labs/lab-sci-1/session"),
        { params: { labId: "lab-sci-1" } }
      );

      // Returns the session without calling update or logAudit
      expect(res.status).toBe(200);
      expect(mockLabSessionUpdate).not.toHaveBeenCalled();
      expect(mockLogAudit).not.toHaveBeenCalled();
    });

    it("returns 404 when ENABLE_VIRTUAL_LABS flag is OFF", async () => {
      mockIsVirtualLabsEnabled.mockReturnValue(false);
      const res = await labSessionStartPost(
        req("POST", "http://localhost/api/student/labs/lab-sci-1/session"),
        { params: { labId: "lab-sci-1" } }
      );
      expect(res.status).toBe(404);
      expect(mockLogAudit).not.toHaveBeenCalled();
    });

    it("returns 404 when no session exists for the student", async () => {
      mockLabSessionFindFirst.mockResolvedValue(null);
      const res = await labSessionStartPost(
        req("POST", "http://localhost/api/student/labs/lab-sci-1/session"),
        { params: { labId: "lab-sci-1" } }
      );
      expect(res.status).toBe(404);
    });
  });

  // ── lab session complete ──────────────────────────────────────────────────

  describe("PATCH /api/student/labs/sessions/[sessionId] — logAudit on complete/update", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockRequireRole.mockResolvedValue(STUDENT_USER);
      mockIsVirtualLabsEnabled.mockReturnValue(true);
      mockLabSessionFindUnique.mockResolvedValue({ ...LAB_SESSION });
      mockLabSessionUpdate.mockResolvedValue({ ...LAB_SESSION, score: 85, completedAt: new Date() });
      mockLogAudit.mockResolvedValue(undefined);
    });

    it("calls logAudit with action lab.session.complete when completing with score", async () => {
      const res = await labSessionUpdatePatch(
        req("PATCH", "http://localhost/api/student/labs/sessions/sess-1", {
          score: 85,
          completedAt: new Date().toISOString(),
        }),
        { params: { sessionId: "sess-1" } }
      );

      expect(res.status).toBe(200);
      expect(mockLogAudit).toHaveBeenCalledOnce();

      const auditArg = mockLogAudit.mock.calls[0][0];
      expect(auditArg.action).toBe("lab.session.complete");
      expect(auditArg.resourceType).toBe("labSession");
      expect(auditArg.resourceId).toBe("sess-1");
      expect(auditArg.schoolId).toBe("school-1");
      expect(auditArg.details?.isCompleting).toBe(true);
    });

    it("calls logAudit with action lab.session.update for partial update (no score/completedAt)", async () => {
      const res = await labSessionUpdatePatch(
        req("PATCH", "http://localhost/api/student/labs/sessions/sess-1", {
          observations: "Cells divided as expected",
        }),
        { params: { sessionId: "sess-1" } }
      );

      expect(res.status).toBe(200);
      expect(mockLogAudit).toHaveBeenCalledOnce();

      const auditArg = mockLogAudit.mock.calls[0][0];
      expect(auditArg.action).toBe("lab.session.update");
      expect(auditArg.details?.isCompleting).toBe(false);
    });

    it("returns 403 when session belongs to a different student", async () => {
      mockLabSessionFindUnique.mockResolvedValue({
        ...LAB_SESSION,
        studentId: "user-other-student",
      });

      const res = await labSessionUpdatePatch(
        req("PATCH", "http://localhost/api/student/labs/sessions/sess-1", { score: 80 }),
        { params: { sessionId: "sess-1" } }
      );

      expect(res.status).toBe(403);
      expect(mockLogAudit).not.toHaveBeenCalled();
    });

    it("returns 403 when session belongs to a different school", async () => {
      mockLabSessionFindUnique.mockResolvedValue({
        ...LAB_SESSION,
        schoolId: "school-other",
      });

      const res = await labSessionUpdatePatch(
        req("PATCH", "http://localhost/api/student/labs/sessions/sess-1", { score: 80 }),
        { params: { sessionId: "sess-1" } }
      );

      expect(res.status).toBe(403);
      expect(mockLogAudit).not.toHaveBeenCalled();
    });

    it("returns 404 when ENABLE_VIRTUAL_LABS flag is OFF", async () => {
      mockIsVirtualLabsEnabled.mockReturnValue(false);
      const res = await labSessionUpdatePatch(
        req("PATCH", "http://localhost/api/student/labs/sessions/sess-1", { score: 80 }),
        { params: { sessionId: "sess-1" } }
      );
      expect(res.status).toBe(404);
      expect(mockLogAudit).not.toHaveBeenCalled();
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// CATEGORY 5 — Feature Flag Enforcement (flag-off → 404)
// ══════════════════════════════════════════════════════════════════════════════

describe("Audit Gate 2 — Category 5: Feature flag OFF returns 404", () => {

  describe("GET /api/teacher/curriculum/units — flag OFF", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockRequireRole.mockResolvedValue(TEACHER_USER);
      mockIsUnitGroupingEnabled.mockReturnValue(false);
    });

    it("returns 404 and never calls requireRole when flag is OFF", async () => {
      const res = await unitsGet(
        req("GET", "http://localhost/api/teacher/curriculum/units")
      );
      expect(res.status).toBe(404);
      // auth is bypassed — route returns early before auth check
      expect(mockRequireRole).not.toHaveBeenCalled();
    });

    it("returns JSON error body", async () => {
      const res = await unitsGet(
        req("GET", "http://localhost/api/teacher/curriculum/units")
      );
      const json = await res.json();
      expect(json).toHaveProperty("error");
    });
  });

  describe("POST /api/admin/curriculum/units — flag OFF", () => {
    it("returns 503 (not 500) when ENABLE_UNIT_ASSEMBLY is OFF", async () => {
      vi.clearAllMocks();
      mockIsUnitAssemblyEnabled.mockReturnValue(false);
      const res = await unitsPost(
        req("POST", "http://localhost/api/admin/curriculum/units", {
          subject: "MATH",
          gradeLevel: 4,
          unitTitle: "X",
        })
      );
      expect(res.status).toBe(503);
    });
  });

  describe("POST /api/student/labs/[labId]/session — flag OFF", () => {
    it("returns 404 (not 500) when ENABLE_VIRTUAL_LABS is OFF", async () => {
      vi.clearAllMocks();
      mockIsVirtualLabsEnabled.mockReturnValue(false);
      const res = await labSessionStartPost(
        req("POST", "http://localhost/api/student/labs/lab-sci-1/session"),
        { params: { labId: "lab-sci-1" } }
      );
      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /api/student/labs/sessions/[sessionId] — flag OFF", () => {
    it("returns 404 (not 500) when ENABLE_VIRTUAL_LABS is OFF", async () => {
      vi.clearAllMocks();
      mockIsVirtualLabsEnabled.mockReturnValue(false);
      const res = await labSessionUpdatePatch(
        req("PATCH", "http://localhost/api/student/labs/sessions/sess-1", { score: 80 }),
        { params: { sessionId: "sess-1" } }
      );
      expect(res.status).toBe(404);
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// CATEGORY 2 — RBAC: role mismatch returns 403
// ══════════════════════════════════════════════════════════════════════════════

describe("Audit Gate 2 — Category 2: RBAC enforcement", () => {

  describe("POST /api/admin/curriculum/units — requires ADMIN role", () => {
    it("returns 403 when a STUDENT tries to access the admin units route", async () => {
      vi.clearAllMocks();
      mockIsUnitAssemblyEnabled.mockReturnValue(true);
      const authError = Object.assign(new Error("Forbidden"), { status: 403 });
      mockRequireUser.mockRejectedValueOnce(authError);

      const res = await unitsPost(
        req("POST", "http://localhost/api/admin/curriculum/units", {
          subject: "MATH",
          gradeLevel: 4,
          unitTitle: "X",
        })
      );
      expect(res.status).toBe(403);
    });
  });

  describe("PATCH /api/student/labs/sessions/[sessionId] — requires STUDENT role", () => {
    it("returns 403 when a TEACHER tries to complete a student lab session", async () => {
      vi.clearAllMocks();
      mockIsVirtualLabsEnabled.mockReturnValue(true);
      const authError = Object.assign(new Error("Forbidden"), { status: 403 });
      mockRequireRole.mockRejectedValueOnce(authError);

      const res = await labSessionUpdatePatch(
        req("PATCH", "http://localhost/api/student/labs/sessions/sess-1", { score: 90 }),
        { params: { sessionId: "sess-1" } }
      );
      expect(res.status).toBe(403);
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// CATEGORY 1 — Tenant Isolation: schoolId enforcement
// ══════════════════════════════════════════════════════════════════════════════

describe("Audit Gate 2 — Category 1: Tenant isolation", () => {

  describe("POST /api/admin/curriculum/units — scoped to user.schoolId", () => {
    it("passes schoolId from the authenticated user into unit assembly", async () => {
      vi.clearAllMocks();
      mockRequireUser.mockResolvedValue({ ...ADMIN_USER, isPlatformAdmin: false });
      mockIsUnitAssemblyEnabled.mockReturnValue(true);
      mockAuditLogCount.mockResolvedValue(0);
      mockAssembleUnit.mockResolvedValue(ASSEMBLED_UNIT);
      mockLogAudit.mockResolvedValue(undefined);

      await unitsPost(
        req("POST", "http://localhost/api/admin/curriculum/units", {
          subject: "MATH",
          gradeLevel: 4,
          unitTitle: "Fractions",
        })
      );

      expect(mockAssembleUnit).toHaveBeenCalledWith(
        expect.objectContaining({
          schoolId: "school-1",
          createdById: "user-admin-1",
        })
      );
    });
  });

  describe("PATCH /api/student/labs/sessions/[sessionId] — rejects cross-school access", () => {
    it("returns 403 when session schoolId does not match student schoolId", async () => {
      vi.clearAllMocks();
      mockRequireRole.mockResolvedValue(STUDENT_USER);
      mockIsVirtualLabsEnabled.mockReturnValue(true);
      mockLabSessionFindUnique.mockResolvedValue({
        ...LAB_SESSION,
        schoolId: "school-EVIL",  // different school
      });

      const res = await labSessionUpdatePatch(
        req("PATCH", "http://localhost/api/student/labs/sessions/sess-1", { score: 99 }),
        { params: { sessionId: "sess-1" } }
      );

      expect(res.status).toBe(403);
      expect(mockLabSessionUpdate).not.toHaveBeenCalled();
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// CATEGORY 3 — PII Governance: no student identifiers above scope
// ══════════════════════════════════════════════════════════════════════════════

describe("Audit Gate 2 — Category 3: PII governance", () => {

  describe("POST /api/admin/curriculum/approve — no PII in response", () => {
    it("response contains only ok, contentId, status — no student or user data", async () => {
      vi.clearAllMocks();
      mockRequireUser.mockResolvedValue(ADMIN_USER);
      mockIsCurriculumFeedbackEnabled.mockReturnValue(false);
      mockCurriculumContentFindUnique.mockResolvedValue(CONTENT_RECORD);
      mockCurriculumContentUpdate.mockResolvedValue({ ...CONTENT_RECORD, status: "published" });
      mockLogAudit.mockResolvedValue(undefined);

      const res = await approvePost(
        req("POST", "http://localhost/api/admin/curriculum/approve", { contentId: "content-1" })
      );
      const body = await res.json();

      expect(body.ok).toBe(true);
      expect(body.contentId).toBe("content-1");
      expect(body.status).toBe("published");
      // No PII fields
      expect(body).not.toHaveProperty("userId");
      expect(body).not.toHaveProperty("studentId");
      expect(body).not.toHaveProperty("email");
      expect(body).not.toHaveProperty("phone");
    });
  });

  describe("PATCH /api/student/labs/sessions/[sessionId] — response has no cross-student data", () => {
    it("returns only the updated session fields — no other students' data", async () => {
      vi.clearAllMocks();
      mockRequireRole.mockResolvedValue(STUDENT_USER);
      mockIsVirtualLabsEnabled.mockReturnValue(true);
      mockLabSessionFindUnique.mockResolvedValue({ ...LAB_SESSION });
      const updatedSession = {
        ...LAB_SESSION,
        score: 85,
        completedAt: new Date().toISOString(),
        observations: "Mitosis completed in 3 phases",
      };
      mockLabSessionUpdate.mockResolvedValue(updatedSession);
      mockLogAudit.mockResolvedValue(undefined);

      const res = await labSessionUpdatePatch(
        req("PATCH", "http://localhost/api/student/labs/sessions/sess-1", {
          score: 85,
          completedAt: new Date().toISOString(),
        }),
        { params: { sessionId: "sess-1" } }
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      // Response contains session data — no other students' identifiers
      expect(body.session).toBeDefined();
      expect(body).not.toHaveProperty("otherStudents");
      expect(body).not.toHaveProperty("email");
      expect(body).not.toHaveProperty("name");
    });
  });
});
