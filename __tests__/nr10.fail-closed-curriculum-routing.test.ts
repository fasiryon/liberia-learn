import { beforeEach, describe, expect, it, vi } from "vitest";

// NR-10 — Student Fail-Closed Curriculum Routing.
// Locks in that the student lesson catalog and the adaptive-recommendation
// engine only ever query CurriculumContent scoped to approved-equivalent
// statuses ("APPROVED" / "published"). Draft, pending_approval, and
// needs_review content must never be reachable from these surfaces.
// The /api/student/today regression lives in __tests__/timetable/todayEndpoint.test.ts.

const mockRequireRole = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ requireRole: mockRequireRole }));
vi.mock("@/lib/curriculum/title", () => ({
  buildCurriculumDisplayTitle: () => "Display Title",
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    student: { findUnique: vi.fn() },
    curriculumContent: { count: vi.fn(), findMany: vi.fn() },
    scheduledWork: { findMany: vi.fn() },
    studentProgress: { findMany: vi.fn() },
  },
}));

import { GET } from "@/app/api/student/lessons/route";
import { prisma } from "@/lib/db";

const mockPrisma = prisma as any;

function makeRequest(url = "https://liberia-learn.test/api/student/lessons") {
  return { nextUrl: new URL(url) } as any;
}

describe("/api/student/lessons — fail-closed curriculum routing (NR-10)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireRole.mockResolvedValue({ id: "user-1", schoolId: "school-1", role: "STUDENT" });
    mockPrisma.student.findUnique.mockResolvedValue({
      id: "student-1",
      currentGrade: 9,
      enrollments: [{ Class: { subject: "MATH" } }],
    });
    mockPrisma.curriculumContent.count.mockResolvedValue(0);
    mockPrisma.curriculumContent.findMany.mockResolvedValue([]);
    mockPrisma.scheduledWork.findMany.mockResolvedValue([]);
    mockPrisma.studentProgress.findMany.mockResolvedValue([]);
  });

  it("scopes the catalog query to approved-equivalent statuses only", async () => {
    await GET(makeRequest());

    expect(mockPrisma.curriculumContent.findMany).toHaveBeenCalledTimes(1);
    const where = mockPrisma.curriculumContent.findMany.mock.calls[0][0].where;
    expect(where.status.in).toEqual(expect.arrayContaining(["published", "APPROVED"]));
    expect(where.status.in).toHaveLength(2);

    const countWhere = mockPrisma.curriculumContent.count.mock.calls[0][0].where;
    expect(countWhere.status.in).toHaveLength(2);
  });

  it("never returns a draft or pending_approval lesson to a student", async () => {
    mockPrisma.curriculumContent.findMany.mockImplementation(async ({ where }: any) => {
      const allowed: string[] = where?.status?.in ?? [];
      const rows = [
        { contentId: "approved-1", title: "Ratios", grade: 9, subject: "MATH", contentType: "LESSON", status: "APPROVED", thumbnailUrl: null, thumbnailStatus: null, payload: { content: "x".repeat(400) } },
        { contentId: "draft-1", title: "Unfinished", grade: 9, subject: "MATH", contentType: "LESSON", status: "DRAFT", thumbnailUrl: null, thumbnailStatus: null, payload: { content: "x".repeat(400) } },
        { contentId: "pending-1", title: "Awaiting review", grade: 9, subject: "MATH", contentType: "LESSON", status: "pending_approval", thumbnailUrl: null, thumbnailStatus: null, payload: { content: "x".repeat(400) } },
      ];
      return rows.filter((r) => allowed.includes(r.status));
    });

    const res = await GET(makeRequest());
    const data = await res.json();

    const ids = (data.items ?? []).map((item: any) => item.contentId);
    expect(ids).toContain("approved-1");
    expect(ids).not.toContain("draft-1");
    expect(ids).not.toContain("pending-1");
  });
});
