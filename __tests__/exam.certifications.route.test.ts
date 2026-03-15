import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireRole = vi.hoisted(() => vi.fn());
const mockIsExamSystemEnabled = vi.hoisted(() => vi.fn());
const mockStudentFindUnique = vi.hoisted(() => vi.fn());
const mockExamCertificationFindMany = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ requireRole: mockRequireRole }));
vi.mock("@/lib/serverFlags", () => ({ isExamSystemEnabled: mockIsExamSystemEnabled }));
vi.mock("@/lib/db", () => ({
  prisma: {
    student: { findUnique: mockStudentFindUnique },
    examCertification: { findMany: mockExamCertificationFindMany },
  },
}));

import { GET } from "@/app/api/student/certifications/route";

describe("GET /api/student/certifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsExamSystemEnabled.mockReturnValue(true);
    mockRequireRole.mockResolvedValue({ id: "user-1", role: "STUDENT" });
    mockStudentFindUnique.mockResolvedValue({ id: "student-1" });
  });

  it("returns certifications for authenticated student only", async () => {
    mockExamCertificationFindMany.mockResolvedValue([
      {
        id: "cert-1",
        examId: "exam-1",
        subject: "MATH",
        grade: 6,
        score: 0.8,
        issuedAt: new Date("2026-03-14T00:00:00.000Z"),
        certCode: "CERT-2026-studen-exam",
        exam: { title: "Math Exam", subject: "MATH", grade: 6 },
      },
    ]);

    const res = await GET();
    const body = await res.json();

    expect(mockExamCertificationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { studentId: "student-1" },
      })
    );
    expect(body.certifications).toHaveLength(1);
  });

  it("returns empty array when no certifications exist", async () => {
    mockExamCertificationFindMany.mockResolvedValue([]);
    const res = await GET();
    const body = await res.json();
    expect(body.certifications).toEqual([]);
  });

  it("requires STUDENT session", async () => {
    mockRequireRole.mockRejectedValueOnce(Object.assign(new Error("Unauthorized"), { status: 401 }));
    const res = await GET();
    expect(res.status).toBe(401);
  });
});
