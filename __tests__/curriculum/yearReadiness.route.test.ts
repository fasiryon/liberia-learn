import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockRequireUser = vi.hoisted(() => vi.fn());
const mockGetYearReadinessReport = vi.hoisted(() => vi.fn());
const mockMapExistingCurriculumToYearPlan = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ requireUser: mockRequireUser }));
vi.mock("@/lib/curriculum/yearPlan", () => ({
  getYearReadinessReport: mockGetYearReadinessReport,
  mapExistingCurriculumToYearPlan: mockMapExistingCurriculumToYearPlan,
}));

describe("/api/admin/curriculum/year-readiness", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUser.mockResolvedValue({ id: "admin-1", role: "ADMIN", isPlatformAdmin: false });
    mockGetYearReadinessReport.mockResolvedValue([
      {
        grade: 4,
        subject: "MATH",
        totalLessons: 60,
        mappedLessons: 60,
        readinessPct: 33,
        weeksCovered: 12,
        unitsCovered: 3,
        missingWeeks: [],
        missingAssessments: 1,
        missingTeacherGuides: 2,
        missingWorksheets: 3,
        missingAudio: 4,
        missingLabs: 0,
        classification: "STRONG",
      },
    ]);
    mockMapExistingCurriculumToYearPlan.mockResolvedValue({ mappedLessons: 1, decisions: [{ contentId: "c1" }] });
  });

  it("renders real readiness data for admins", async () => {
    const { GET } = await import("@/app/api/admin/curriculum/year-readiness/route");
    const res = await GET(new NextRequest("http://localhost/api/admin/curriculum/year-readiness"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.rows[0].subject).toBe("MATH");
  });

  it("exports readiness report as CSV", async () => {
    const { GET } = await import("@/app/api/admin/curriculum/year-readiness/route");
    const res = await GET(new NextRequest("http://localhost/api/admin/curriculum/year-readiness?format=csv"));
    const text = await res.text();

    expect(res.headers.get("Content-Type")).toContain("text/csv");
    expect(text).toContain("grade,subject,readinessPct");
  });

  it("enforces permissions", async () => {
    mockRequireUser.mockResolvedValueOnce({ id: "teacher-1", role: "TEACHER", isPlatformAdmin: false });
    const { GET } = await import("@/app/api/admin/curriculum/year-readiness/route");
    const res = await GET(new NextRequest("http://localhost/api/admin/curriculum/year-readiness"));

    expect(res.status).toBe(403);
  });

  it("maps existing lessons without generation or duplication flags", async () => {
    const { POST } = await import("@/app/api/admin/curriculum/year-readiness/route");
    const res = await POST();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.generatedContent).toBe(false);
    expect(data.duplicatedLessons).toBe(false);
  });
});
