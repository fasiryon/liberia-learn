import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireRole = vi.hoisted(() => vi.fn());
const mockIsGuardianPortalEnabled = vi.hoisted(() => vi.fn());
const prismaMock = vi.hoisted(() => ({
  studentGuardian: { findFirst: vi.fn() },
  student: { findUnique: vi.fn() },
  homeworkSubmission: { findMany: vi.fn() },
  attendanceRecord: { findMany: vi.fn() },
  auditLog: { count: vi.fn() },
}));

vi.mock("@/lib/auth", () => ({ requireRole: mockRequireRole }));
vi.mock("@/lib/serverFlags", () => ({ isGuardianPortalEnabled: mockIsGuardianPortalEnabled }));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { GET as guardianStudentGET } from "@/app/api/guardian/student/[studentId]/route";

const GUARDIAN = { id: "guardian-1", role: "GUARDIAN", schoolId: "school-1" };

function makeReq() {
  return new Request("http://localhost/api/guardian/student/student-1") as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockIsGuardianPortalEnabled.mockReturnValue(true);
  mockRequireRole.mockResolvedValue(GUARDIAN);
  prismaMock.studentGuardian.findFirst.mockResolvedValue(null);
  prismaMock.student.findUnique.mockResolvedValue(null);
  prismaMock.homeworkSubmission.findMany.mockResolvedValue([]);
  prismaMock.attendanceRecord.findMany.mockResolvedValue([]);
  prismaMock.auditLog.count.mockResolvedValue(0);
});

describe("Guardian portal access", () => {
  it("returns 403 when guardian is not linked to student", async () => {
    prismaMock.studentGuardian.findFirst.mockResolvedValue(null);

    const res = await guardianStudentGET(makeReq(), { params: { studentId: "student-1" } });
    expect(res.status).toBe(403);
    expect(prismaMock.student.findUnique).not.toHaveBeenCalled();
  });

  it("returns 200 when guardian is linked to student", async () => {
    prismaMock.studentGuardian.findFirst.mockResolvedValue({ id: "link-1", relation: "Parent" });
    prismaMock.student.findUnique.mockResolvedValue({
      id: "student-1",
      userId: "user-1",
      currentGrade: 5,
      user: { name: "Student A", email: "student@school.lr" },
      placementTests: [],
    });

    const res = await guardianStudentGET(makeReq(), { params: { studentId: "student-1" } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.student.id).toBe("student-1");
    expect(body.student.relation).toBe("Parent");
  });
});
