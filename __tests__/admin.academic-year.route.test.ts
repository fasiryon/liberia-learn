import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireUser = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());
const mockListAcademicYearsForSchool = vi.hoisted(() => vi.fn());
const mockCreateAcademicYearForSchool = vi.hoisted(() => vi.fn());
const mockActivateAcademicYearForSchool = vi.hoisted(() => vi.fn());

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
    listAcademicYearsForSchool: mockListAcademicYearsForSchool,
    createAcademicYearForSchool: mockCreateAcademicYearForSchool,
    activateAcademicYearForSchool: mockActivateAcademicYearForSchool,
  };
});

import { GET, PATCH, POST } from "@/app/api/admin/academic-year/route";

function makeNextRequest(url: string) {
  return { nextUrl: new URL(url) } as any;
}

describe("/api/admin/academic-year", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUser.mockResolvedValue({
      id: "admin-1",
      role: "ADMIN",
      schoolId: "school-1",
      isPlatformAdmin: false,
    });
    mockLogAudit.mockResolvedValue(undefined);
    mockListAcademicYearsForSchool.mockResolvedValue([
      { id: "ay-1", yearLabel: "2026-2027", isActive: true, terms: [] },
    ]);
    mockCreateAcademicYearForSchool.mockResolvedValue({
      id: "ay-1",
      yearLabel: "2026-2027",
      isActive: true,
      terms: [{ id: "term-1", name: "Term 1" }],
    });
    mockActivateAcademicYearForSchool.mockResolvedValue({
      id: "ay-1",
      yearLabel: "2026-2027",
      isActive: true,
      terms: [],
    });
  });

  it("lists academic years for the requesting admin school", async () => {
    const res = await GET(makeNextRequest("http://localhost/api/admin/academic-year"));
    expect(res.status).toBe(200);
    expect(mockListAcademicYearsForSchool).toHaveBeenCalledWith("school-1");
  });

  it("rejects cross-school access for non-platform admins", async () => {
    const res = await GET(makeNextRequest("http://localhost/api/admin/academic-year?schoolId=school-2"));
    expect(res.status).toBe(403);
    expect(mockListAcademicYearsForSchool).not.toHaveBeenCalled();
  });

  it("creates an academic year and logs an audit event", async () => {
    const res = await POST(
      new Request("http://localhost/api/admin/academic-year", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          yearLabel: "2026-2027",
          startDate: "2026-09-01",
          endDate: "2027-06-30",
          isActive: true,
          terms: [{ name: "Term 1", startDate: "2026-09-01", endDate: "2026-12-20" }],
        }),
      }) as any
    );

    expect(res.status).toBe(201);
    expect(mockCreateAcademicYearForSchool).toHaveBeenCalledWith(
      "school-1",
      expect.objectContaining({ yearLabel: "2026-2027" })
    );
    expect(mockLogAudit).toHaveBeenCalledOnce();
  });

  it("activates an academic year", async () => {
    const res = await PATCH(
      new Request("http://localhost/api/admin/academic-year", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ academicYearId: "ay-1", isActive: true }),
      }) as any
    );

    expect(res.status).toBe(200);
    expect(mockActivateAcademicYearForSchool).toHaveBeenCalledWith("school-1", "ay-1");
  });
});
