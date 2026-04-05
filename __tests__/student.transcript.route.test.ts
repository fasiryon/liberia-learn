import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireRole = vi.hoisted(() => vi.fn());
const mockListStudentTranscriptsForUser = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  requireRole: mockRequireRole,
}));

vi.mock("@/lib/records/systemOfRecord", () => ({
  listStudentTranscriptsForUser: mockListStudentTranscriptsForUser,
}));

import { GET } from "@/app/api/student/transcript/route";

describe("GET /api/student/transcript", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireRole.mockResolvedValue({ id: "user-1", role: "STUDENT" });
    mockListStudentTranscriptsForUser.mockResolvedValue([
      {
        id: "tr-1",
        academicYearLabel: "2026-2027",
        grade: 6,
        gpa: 3.6,
        summary: { attendance: "Excellent" },
      },
    ]);
  });

  it("returns transcripts for the authenticated student only", async () => {
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockListStudentTranscriptsForUser).toHaveBeenCalledWith("user-1");
    expect(body.transcripts).toHaveLength(1);
  });

  it("denies unauthenticated access", async () => {
    mockRequireRole.mockRejectedValueOnce(Object.assign(new Error("Unauthorized"), { status: 401 }));
    const res = await GET();
    expect(res.status).toBe(401);
  });
});
