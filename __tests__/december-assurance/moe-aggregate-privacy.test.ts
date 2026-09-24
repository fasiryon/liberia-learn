/**
 * December assurance — MOE aggregate surfaces must not publish individual
 * learner facts, and unknown must not render as zero.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireUser = vi.hoisted(() => vi.fn());
const mockPlacementFindMany = vi.hoisted(() => vi.fn());
const mockSchoolFindMany = vi.hoisted(() => vi.fn());
const mockStudentFindMany = vi.hoisted(() => vi.fn());
const mockMasteryFindMany = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ requireUser: mockRequireUser }));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }));
vi.mock("@/lib/serverFlags", () => ({ isMoePortalEnabled: () => true }));
vi.mock("@/lib/logging/requestLogger", () => ({ withRequestLogging: (_route: string, handler: any) => handler }));
vi.mock("@/lib/db", () => ({
  prisma: {
    placementTest: { findMany: mockPlacementFindMany },
    school: { findMany: mockSchoolFindMany },
    student: { findMany: mockStudentFindMany },
    studentMasteryProfile: { findMany: mockMasteryFindMany },
  },
}));
vi.mock("@/lib/waec/syllabus", () => ({
  getWaecSubjects: () => [{ id: "waec_math", name: "Mathematics", masterySubject: "MATH" }],
}));
vi.mock("@/lib/waec/readiness", () => ({
  computeSubjectReadiness: (_id: string, map: Record<string, { current: number }>) => ({ readiness: map.s?.current ?? null }),
}));

const school = { id: "school-1", districtId: "d-1", district: "District 1", District: { id: "d-1", name: "District 1" } };

function placement(i: number, reason: string | null) {
  return {
    id: `p-${i}`,
    band: "developing",
    details: { confidence: "medium" },
    teacherDecision: reason ? "overridden" : null,
    teacherReason: reason,
    student: { user: { schoolId: "school-1" } },
  };
}

describe("MOE placement analytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUser.mockResolvedValue({ id: "moe-1", role: "MOE_OFFICIAL", isPlatformAdmin: false });
    mockSchoolFindMany.mockResolvedValue([school]);
  });

  it("does not publish a single teacher's free-text reason about one child", async () => {
    const note = "Musu Kollie cannot read yet; her family moved from Lofa last month";
    mockPlacementFindMany.mockResolvedValue([placement(1, note), placement(2, null)]);
    const { GET } = await import("@/app/api/moe/placements/route");
    const payload = await (await GET()).json();
    expect(JSON.stringify(payload)).not.toContain("Musu");
    expect(payload.byDistrict[0].topOverrideReason).toBeNull();
  });

  it("publishes a reason only when enough overrides share it", async () => {
    const shared = "Learner performed above the placement estimate in class work";
    mockPlacementFindMany.mockResolvedValue(Array.from({ length: 5 }, (_, i) => placement(i, shared)));
    const { GET } = await import("@/app/api/moe/placements/route");
    const payload = await (await GET()).json();
    expect(payload.byDistrict[0].topOverrideReason).toBe(shared);
  });

  it("reports an unknown override rate as null, not 0%", async () => {
    mockPlacementFindMany.mockResolvedValue([placement(1, null)]);
    const { GET } = await import("@/app/api/moe/placements/route");
    const payload = await (await GET()).json();
    expect(payload.byDistrict[0].overrideRate).toBeNull();
    expect(payload.nationalOverrideRate).toBeNull();
  });
});

describe("national WAEC readiness", () => {
  beforeEach(() => vi.clearAllMocks());

  function learners(county: string, n: number, score: number) {
    return Array.from({ length: n }, (_, i) => ({ id: `${county}-${i}`, county, enrollments: [], score }));
  }

  it("suppresses county averages below the small-cell threshold", async () => {
    const all = [...learners("Bomi", 1, 30), ...learners("Montserrado", 6, 80)];
    mockStudentFindMany.mockResolvedValue(all.map(({ score: _s, ...rest }) => rest));
    mockMasteryFindMany.mockResolvedValue(all.map((l) => ({ studentId: l.id, strandKey: "s", currentScore: l.score, baselineScore: 0 })));
    const { getNationalWaecReadiness } = await import("@/lib/waec/aggregate");
    const result = await getNationalWaecReadiness();
    const bomi = result.byCounty.find((c) => c.county === "Bomi");
    const montserrado = result.byCounty.find((c) => c.county === "Montserrado");
    expect(bomi).toEqual({ county: "Bomi", assessedStudents: null, avgReadiness: null, suppressed: true });
    expect(montserrado).toEqual({ county: "Montserrado", assessedStudents: 6, avgReadiness: 80 });
  });

  it("is not available to a school admin", async () => {
    mockRequireUser.mockResolvedValue({ id: "admin-1", role: "ADMIN", schoolId: "school-1", isPlatformAdmin: false });
    const { GET } = await import("@/app/api/moe/waec-readiness/route");
    const res = await GET();
    expect(res.status).toBe(403);
    expect(mockStudentFindMany).not.toHaveBeenCalled();
  });
});
