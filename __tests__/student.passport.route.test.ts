import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireRole = vi.hoisted(() => vi.fn());
const mockBuildStudentPassport = vi.hoisted(() => vi.fn());
const mockLogLearningEvent = vi.hoisted(() => vi.fn());
const mockLogDataAccess = vi.hoisted(() => vi.fn());
const mockHandleApiError = vi.hoisted(() => vi.fn());
const mockStudentFindUnique = vi.hoisted(() => vi.fn());
const mockStudentGuardianFindFirst = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ requireRole: mockRequireRole }));
vi.mock("@/lib/passport/buildStudentPassport", () => ({
  buildStudentPassport: mockBuildStudentPassport,
}));
vi.mock("@/lib/events/logLearningEvent", () => ({ logLearningEvent: mockLogLearningEvent }));
vi.mock("@/lib/dataAccess/logDataAccess", () => ({ logDataAccess: mockLogDataAccess }));
vi.mock("@/lib/errors/apiErrorHandler", () => ({ handleApiError: mockHandleApiError }));
vi.mock("@/lib/db", () => ({
  prisma: {
    student: { findUnique: mockStudentFindUnique },
    studentGuardian: { findFirst: mockStudentGuardianFindFirst },
  },
}));

import { GET } from "@/app/api/student/passport/route";

function makeReq(url: string) {
  return { nextUrl: new URL(url) } as any;
}

const PASSPORT_STUB = {
  studentId: "student-1",
  generatedAt: new Date().toISOString(),
  totalStrands: 10,
  masteredStrands: 6,
  overallMasteryPct: 60,
  avgCurrentScore: 72.5,
  subjects: [],
  interventionSummary: { total: 2, open: 1, inProgress: 0, closed: 1 },
  latestActivityAt: new Date().toISOString(),
};

describe("GET /api/student/passport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLogLearningEvent.mockResolvedValue(undefined);
    mockLogDataAccess.mockResolvedValue(undefined);
    mockHandleApiError.mockImplementation((err: unknown) =>
      Response.json({ error: "error" }, { status: (err as { status?: number })?.status ?? 500 })
    );
    mockBuildStudentPassport.mockResolvedValue(PASSPORT_STUB);
  });

  describe("STUDENT access", () => {
    beforeEach(() => {
      mockRequireRole.mockResolvedValue({ id: "user-1", role: "STUDENT", schoolId: "school-1" });
      mockStudentFindUnique.mockResolvedValue({ id: "student-1" });
    });

    it("returns 200 with passport data", async () => {
      const res = await GET(makeReq("http://localhost/api/student/passport"));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.studentId).toBe("student-1");
      expect(body.totalStrands).toBe(10);
    });

    it("calls buildStudentPassport with resolved student.id", async () => {
      await GET(makeReq("http://localhost/api/student/passport"));
      expect(mockBuildStudentPassport).toHaveBeenCalledWith("student-1");
    });

    it("fires logLearningEvent with student.passport.viewed", async () => {
      await GET(makeReq("http://localhost/api/student/passport"));
      expect(mockLogLearningEvent).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: "student.passport.viewed", userId: "user-1" })
      );
    });

    it("writes a DataAccessLog entry for passport reads", async () => {
      await GET(makeReq("http://localhost/api/student/passport"));
      expect(mockLogDataAccess).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-1",
          resourceType: "student_passport",
          resourceId: "student-1",
          action: "view",
          scope: "own_student",
        })
      );
    });

    it("returns 404 when student record not found", async () => {
      mockStudentFindUnique.mockResolvedValueOnce(null);
      const res = await GET(makeReq("http://localhost/api/student/passport"));
      expect(res.status).toBe(404);
    });
  });

  describe("GUARDIAN access", () => {
    beforeEach(() => {
      mockRequireRole.mockResolvedValue({ id: "guardian-1", role: "GUARDIAN", schoolId: null });
      mockStudentGuardianFindFirst.mockResolvedValue({ studentId: "student-1" });
    });

    it("returns 200 for linked student", async () => {
      const res = await GET(
        makeReq("http://localhost/api/student/passport?studentId=student-1")
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.studentId).toBe("student-1");
    });

    it("returns 400 when no studentId param", async () => {
      const res = await GET(makeReq("http://localhost/api/student/passport"));
      expect(res.status).toBe(400);
    });

    it("returns 403 when guardian is not linked to the student", async () => {
      mockStudentGuardianFindFirst.mockResolvedValueOnce(null);
      const res = await GET(
        makeReq("http://localhost/api/student/passport?studentId=other-student")
      );
      expect(res.status).toBe(403);
    });

    it("writes guardian-linked scope in DataAccessLog", async () => {
      await GET(makeReq("http://localhost/api/student/passport?studentId=student-1"));
      expect(mockLogDataAccess).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "guardian-1",
          resourceId: "student-1",
          scope: "guardian_linked_student",
        })
      );
    });

    it("does NOT call student.findUnique for guardian", async () => {
      await GET(makeReq("http://localhost/api/student/passport?studentId=student-1"));
      expect(mockStudentFindUnique).not.toHaveBeenCalled();
    });
  });

  describe("Auth errors", () => {
    it("returns 403 when requireRole throws auth error", async () => {
      mockRequireRole.mockRejectedValueOnce(
        Object.assign(new Error("Forbidden"), { status: 403 })
      );
      const res = await GET(makeReq("http://localhost/api/student/passport"));
      expect(res.status).toBe(403);
    });
  });
});
