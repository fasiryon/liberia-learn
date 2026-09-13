import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireRole = vi.hoisted(() => vi.fn());
const mockStudentFindFirst = vi.hoisted(() => vi.fn());
const mockScheduledWorkFindUnique = vi.hoisted(() => vi.fn());
const mockEnrollmentFindUnique = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ requireRole: mockRequireRole }));
vi.mock("@/lib/db", () => ({
  prisma: {
    student: { findFirst: mockStudentFindFirst },
    scheduledWork: { findUnique: mockScheduledWorkFindUnique },
    enrollment: { findUnique: mockEnrollmentFindUnique },
  },
}));

import { GET } from "@/app/api/student/work/[scheduledWorkId]/problem-answer/[problemSetId]/route";

describe("server-governed student answer release", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireRole.mockResolvedValue({ id: "user-1", role: "STUDENT", schoolId: "school-1" });
    mockStudentFindFirst.mockResolvedValue({ id: "student-1" });
    mockEnrollmentFindUnique.mockResolvedValue({ id: "enrollment-1" });
  });

  function work(answerRelease?: { mode: "NEVER" | "AFTER_COMPLETION" | "AFTER_TIME"; releaseAt?: string }, completedAt: Date | null = null) {
    return {
      classId: "class-1",
      class: { schoolId: "school-1" },
      content: {
        status: "published",
        payload: { problemSets: [{ id: "set-1", answerKey: "server-answer", answerRelease }] },
      },
      progress: completedAt ? [{ completedAt }] : [],
    };
  }

  async function request() {
    return GET(new Request("http://localhost/answer") as any, {
      params: Promise.resolve({ scheduledWorkId: "work-1", problemSetId: "set-1" }),
    });
  }

  it("denies a known route and id when no release policy exists", async () => {
    mockScheduledWorkFindUnique.mockResolvedValue(work());
    const response = await request();
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Answer not released" });
  });

  it("releases only after server-held completion state satisfies policy", async () => {
    mockScheduledWorkFindUnique.mockResolvedValue(work({ mode: "AFTER_COMPLETION" }, new Date()));
    const response = await request();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ answerKey: "server-answer" });
    expect(mockScheduledWorkFindUnique).toHaveBeenCalledWith(expect.objectContaining({
      select: expect.objectContaining({
        progress: expect.objectContaining({ where: { studentId: "user-1" } }),
      }),
    }));
  });

  it("fails closed across schools even if the caller knows both ids", async () => {
    mockScheduledWorkFindUnique.mockResolvedValue({
      ...work({ mode: "AFTER_COMPLETION" }, new Date()),
      class: { schoolId: "school-2" },
    });
    const response = await request();
    expect(response.status).toBe(403);
    expect(mockEnrollmentFindUnique).not.toHaveBeenCalled();
  });

  it("denies missing or stale class enrollment", async () => {
    mockScheduledWorkFindUnique.mockResolvedValue(work({ mode: "AFTER_COMPLETION" }, new Date()));
    mockEnrollmentFindUnique.mockResolvedValue(null);
    const response = await request();
    expect(response.status).toBe(403);
  });
});
