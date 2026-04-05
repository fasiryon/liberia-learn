import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireUser = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());
const mockListTranscriptsForSchool = vi.hoisted(() => vi.fn());
const mockUpsertTranscriptForSchool = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  requireUser: mockRequireUser,
}));

vi.mock("@/lib/audit", () => ({
  logAudit: mockLogAudit,
}));

vi.mock("@/lib/records/systemOfRecord", async () => {
  const actual = await vi.importActual<typeof import("@/lib/records/systemOfRecord")>("@/lib/records/systemOfRecord");
  return {
    ...actual,
    listTranscriptsForSchool: mockListTranscriptsForSchool,
    upsertTranscriptForSchool: mockUpsertTranscriptForSchool,
  };
});

import { GET, POST } from "@/app/api/admin/transcripts/route";

function makeNextRequest(url: string) {
  return { nextUrl: new URL(url) } as any;
}

describe("/api/admin/transcripts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUser.mockResolvedValue({
      id: "admin-1",
      role: "ADMIN",
      schoolId: "school-1",
      isPlatformAdmin: false,
    });
    mockLogAudit.mockResolvedValue(undefined);
    mockListTranscriptsForSchool.mockResolvedValue([
      { id: "tr-1", studentId: "student-1", academicYearId: "ay-1", grade: 6, academicYearLabel: "2026-2027" },
    ]);
    mockUpsertTranscriptForSchool.mockResolvedValue({
      id: "tr-1",
      studentId: "student-1",
      academicYearId: "ay-1",
      grade: 6,
      academicYearLabel: "2026-2027",
      summary: { attendance: "Strong" },
      gpa: 3.4,
    });
  });

  it("lists transcripts scoped to the requesting school", async () => {
    const res = await GET(makeNextRequest("http://localhost/api/admin/transcripts?studentId=student-1"));
    expect(res.status).toBe(200);
    expect(mockListTranscriptsForSchool).toHaveBeenCalledWith("school-1", "student-1");
  });

  it("prevents non-platform admins from reading another school", async () => {
    const res = await GET(makeNextRequest("http://localhost/api/admin/transcripts?schoolId=school-2"));
    expect(res.status).toBe(403);
  });

  it("upserts transcript summary and GPA", async () => {
    const res = await POST(
      new Request("http://localhost/api/admin/transcripts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: "student-1",
          academicYearId: "ay-1",
          grade: 6,
          gpa: 3.4,
          summary: { attendance: "Strong" },
        }),
      }) as any
    );

    expect(res.status).toBe(201);
    expect(mockUpsertTranscriptForSchool).toHaveBeenCalledWith(
      "school-1",
      expect.objectContaining({ studentId: "student-1", academicYearId: "ay-1", grade: 6 })
    );
  });
});
