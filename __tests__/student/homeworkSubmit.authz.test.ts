import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockRequireRole, mockPrisma } = vi.hoisted(() => ({
  mockRequireRole: vi.fn(),
  mockPrisma: {
    student: { findFirst: vi.fn() },
    homework: { findFirst: vi.fn(), findUnique: vi.fn() },
    homeworkSubmission: { upsert: vi.fn() },
  },
}));

vi.mock("@/lib/auth", () => ({ requireRole: mockRequireRole }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/push/sendPush", () => ({ sendPushToUser: vi.fn() }));
vi.mock("@/lib/alert-prefs", () => ({ getTeacherAlertPref: vi.fn().mockResolvedValue({ alertNewSubmission: false }) }));

import { POST } from "@/app/api/student/homework/[id]/submit/route";

describe("POST /api/student/homework/[id]/submit — enrollment scope (hostile)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireRole.mockResolvedValue({ id: "stu-user-1", role: "STUDENT", schoolId: "school-1" });
    mockPrisma.student.findFirst.mockResolvedValue({ id: "stu-1" });
  });

  it("only resolves homework from a class the student is enrolled in", async () => {
    mockPrisma.homework.findFirst.mockResolvedValueOnce(null);
    const form = new FormData();
    form.set("answer-0", "x");
    const res = await POST(new Request("http://localhost/x", { method: "POST", body: form }), {
      params: { id: "hw-other-class" },
    });
    expect(res.status).toBe(404);
    expect(mockPrisma.homework.findFirst).toHaveBeenCalledWith({
      where: {
        id: "hw-other-class",
        Class: { schoolId: "school-1", enrollments: { some: { studentId: "stu-1" } } },
      },
    });
    expect(mockPrisma.homeworkSubmission.upsert).not.toHaveBeenCalled();
  });
});
