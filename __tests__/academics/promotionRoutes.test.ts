import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireUser = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());
const mockPreviewPromotions = vi.hoisted(() => vi.fn());
const mockPromoteStudents = vi.hoisted(() => vi.fn());
const mockRetainStudents = vi.hoisted(() => vi.fn());
const mockGraduateStudents = vi.hoisted(() => vi.fn());
const mockHandleApiError = vi.hoisted(() =>
  vi.fn((err: any) => new Response(JSON.stringify({ error: err.message ?? "error" }), { status: err.status ?? 500 }))
);

vi.mock("@/lib/auth", () => ({ requireUser: mockRequireUser }));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));
vi.mock("@/lib/errors/apiErrorHandler", () => ({ handleApiError: mockHandleApiError }));
vi.mock("@/lib/academics/promotion", () => ({
  previewPromotions: mockPreviewPromotions,
  promoteStudents: mockPromoteStudents,
  retainStudents: mockRetainStudents,
  graduateStudents: mockGraduateStudents,
}));
vi.mock("@/lib/records/systemOfRecord", () => ({
  resolveAdminSchoolScope: vi.fn((user: any) => {
    if (!user.schoolId) throw Object.assign(new Error("schoolId required"), { status: 400 });
    return user.schoolId;
  }),
}));

import { GET as previewGET } from "@/app/api/admin/promotions/preview/route";
import { POST as promotePost } from "@/app/api/admin/promotions/promote/route";
import { POST as retainPost } from "@/app/api/admin/promotions/retain/route";
import { POST as graduatePost } from "@/app/api/admin/promotions/graduate/route";

const ADMIN_USER = { id: "admin-1", role: "ADMIN", schoolId: "school-1", isPlatformAdmin: false };

function makeGet(url: string) {
  return { nextUrl: new URL(url) } as any;
}

function makePost(url: string, body: Record<string, unknown>) {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as any;
}

describe("GET /api/admin/promotions/preview", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns promotion candidates for admin", async () => {
    mockRequireUser.mockResolvedValueOnce(ADMIN_USER);
    mockPreviewPromotions.mockResolvedValueOnce([
      { studentId: "s1", studentName: "Alice", currentGrade: 5, nextGrade: 6, willGraduate: false, enrollmentId: "e1" },
    ]);

    const res = await previewGET(
      makeGet("http://localhost/api/admin/promotions/preview?academicYearId=year-1")
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.candidates).toHaveLength(1);
    expect(data.candidates[0].studentName).toBe("Alice");
  });

  it("rejects non-admin role", async () => {
    mockRequireUser.mockResolvedValueOnce({ ...ADMIN_USER, role: "TEACHER" });

    const res = await previewGET(
      makeGet("http://localhost/api/admin/promotions/preview?academicYearId=year-1")
    );

    expect(res.status).not.toBe(200);
  });

  it("returns 400 when academicYearId is missing", async () => {
    mockRequireUser.mockResolvedValueOnce(ADMIN_USER);

    const res = await previewGET(makeGet("http://localhost/api/admin/promotions/preview"));
    expect(res.status).not.toBe(200);
  });
});

describe("POST /api/admin/promotions/promote", () => {
  beforeEach(() => vi.clearAllMocks());

  it("promotes students and returns result", async () => {
    mockRequireUser.mockResolvedValueOnce(ADMIN_USER);
    mockPromoteStudents.mockResolvedValueOnce({ promoted: ["s1"], skipped: [], errors: [] });

    const res = await promotePost(
      makePost("http://localhost/api/admin/promotions/promote", {
        studentIds: ["s1"],
        sourceAcademicYearId: "year-2025",
        targetAcademicYearId: "year-2026",
      })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.result.promoted).toContain("s1");
  });

  it("rejects non-admin", async () => {
    mockRequireUser.mockResolvedValueOnce({ ...ADMIN_USER, role: "STUDENT" });

    const res = await promotePost(
      makePost("http://localhost/api/admin/promotions/promote", {
        studentIds: ["s1"],
        sourceAcademicYearId: "year-2025",
        targetAcademicYearId: "year-2026",
      })
    );

    expect(res.status).not.toBe(200);
  });

  it("rejects students from different school via tenant scope error", async () => {
    mockRequireUser.mockResolvedValueOnce({ ...ADMIN_USER, schoolId: null });

    const res = await promotePost(
      makePost("http://localhost/api/admin/promotions/promote", {
        studentIds: ["s1"],
        sourceAcademicYearId: "year-2025",
        targetAcademicYearId: "year-2026",
      })
    );

    expect(res.status).not.toBe(200);
  });
});

describe("POST /api/admin/promotions/graduate", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects non-Grade-12 students (service returns error)", async () => {
    mockRequireUser.mockResolvedValueOnce(ADMIN_USER);
    mockGraduateStudents.mockResolvedValueOnce({
      promoted: [],
      skipped: [],
      errors: [{ studentId: "s1", reason: "Only Grade 12 students can be graduated" }],
    });

    const res = await graduatePost(
      makePost("http://localhost/api/admin/promotions/graduate", {
        studentIds: ["s1"],
        academicYearId: "year-2025",
      })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.result.errors[0].reason).toMatch(/grade 12/i);
  });
});
