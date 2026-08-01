import { vi, describe, it, expect, beforeEach } from "vitest";

// NR-8 — RBAC Expansion. These 4 MOE routes had no prior test coverage and
// each had a real RBAC bug fixed this sprint:
//
// - align: gated with requireRole("MOE_OFFICIAL"), which throws before the
//   subsequent `!actor.isPlatformAdmin` fallback check could ever run for a
//   real platform admin (whose role field is "ADMIN", not "MOE_OFFICIAL").
// - teacher-lessons: same requireRole("MOE_OFFICIAL") shape, no platform
//   admin or MOE_SUPER_ADMIN bypass at all.
// - submissions / submissions/[id]/review: gated with
//   requireRole("MOE_OFFICIAL", "PLATFORM_ADMIN") — "PLATFORM_ADMIN" is not
//   a value in the Prisma Role enum, so that branch could never match any
//   real user; a real platform admin's role is "ADMIN" with a separate
//   isPlatformAdmin flag, so this was dead code guaranteed to 403 every
//   platform admin.
//
// All 4 now use requireUser() + isMoeSuperRole()/isPlatformAdmin, matching
// the pattern already used correctly by requireMoeActor-backed routes.

const mockRequireUser = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());
const mockIsMoePortalEnabled = vi.hoisted(() => vi.fn());
const mockAlignAllContent = vi.hoisted(() => vi.fn());
const mockAlignContentToMOE = vi.hoisted(() => vi.fn());
const mockCurriculumContentCount = vi.hoisted(() => vi.fn());
const mockCurriculumContentFindMany = vi.hoisted(() => vi.fn());
const mockCurriculumContentGroupBy = vi.hoisted(() => vi.fn());
const mockStandardFindMany = vi.hoisted(() => vi.fn());
const mockSchoolFindMany = vi.hoisted(() => vi.fn());
const mockTeacherLessonAssignmentGroupBy = vi.hoisted(() => vi.fn());
const mockMoeSubmissionFindMany = vi.hoisted(() => vi.fn());
const mockMoeSubmissionFindUnique = vi.hoisted(() => vi.fn());
const mockMoeSubmissionUpdate = vi.hoisted(() => vi.fn());
const mockUserFindMany = vi.hoisted(() => vi.fn());
const mockNotificationInboxCreateMany = vi.hoisted(() => vi.fn());
const mockSendPushToUser = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ requireUser: mockRequireUser }));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));
vi.mock("@/lib/serverFlags", () => ({ isMoePortalEnabled: mockIsMoePortalEnabled }));
vi.mock("@/lib/moe/alignment-engine", () => ({
  alignAllContent: mockAlignAllContent,
  alignContentToMOE: mockAlignContentToMOE,
}));
vi.mock("@/lib/moe/alignmentReader", () => ({ hasGenuineMoeAlignment: () => false }));
vi.mock("@/lib/push/sendPush", () => ({ sendPushToUser: mockSendPushToUser }));
vi.mock("@/lib/db", () => ({
  prisma: {
    curriculumContent: {
      count: mockCurriculumContentCount,
      findMany: mockCurriculumContentFindMany,
      groupBy: mockCurriculumContentGroupBy,
    },
    standard: { findMany: mockStandardFindMany },
    school: { findMany: mockSchoolFindMany },
    teacherLessonAssignment: { groupBy: mockTeacherLessonAssignmentGroupBy },
    moeSubmission: {
      findMany: mockMoeSubmissionFindMany,
      findUnique: mockMoeSubmissionFindUnique,
      update: mockMoeSubmissionUpdate,
    },
    user: { findMany: mockUserFindMany },
    notificationInboxItem: { createMany: mockNotificationInboxCreateMany },
  },
}));

const STUDENT = { id: "s-1", role: "STUDENT", isPlatformAdmin: false, schoolId: "school-1" };
const PLATFORM_ADMIN = { id: "pa-1", role: "ADMIN", isPlatformAdmin: true, schoolId: null };
const MOE_SUPER_ADMIN = { id: "moe-super-1", role: "MOE_SUPER_ADMIN", isPlatformAdmin: false, schoolId: null };

beforeEach(() => {
  vi.clearAllMocks();
  mockIsMoePortalEnabled.mockReturnValue(true);
  mockLogAudit.mockResolvedValue(undefined);
  mockAlignAllContent.mockResolvedValue(undefined);
  mockCurriculumContentCount.mockResolvedValue(0);
  mockCurriculumContentFindMany.mockResolvedValue([]);
  mockCurriculumContentGroupBy.mockResolvedValue([]);
  mockStandardFindMany.mockResolvedValue([]);
  mockSchoolFindMany.mockResolvedValue([]);
  mockTeacherLessonAssignmentGroupBy.mockResolvedValue([]);
  mockMoeSubmissionFindMany.mockResolvedValue([]);
  mockUserFindMany.mockResolvedValue([]);
  mockNotificationInboxCreateMany.mockResolvedValue({ count: 0 });
  mockSendPushToUser.mockResolvedValue(undefined);
});

describe("POST /api/moe/align — RBAC (NR-8 fix)", () => {
  it("STUDENT is forbidden", async () => {
    mockRequireUser.mockResolvedValue(STUDENT);
    const { POST } = await import("@/app/api/moe/align/route");
    const res = await POST(new Request("http://x", { method: "POST", body: JSON.stringify({ batch: true }) }) as any);
    expect(res.status).toBe(403);
  });

  it("a real platform admin (role=ADMIN, isPlatformAdmin=true) is now allowed", async () => {
    mockRequireUser.mockResolvedValue(PLATFORM_ADMIN);
    const { POST } = await import("@/app/api/moe/align/route");
    const res = await POST(new Request("http://x", { method: "POST", body: JSON.stringify({ batch: true }) }) as any);
    expect(res.status).toBe(200);
  });

  it("MOE_SUPER_ADMIN is now allowed", async () => {
    mockRequireUser.mockResolvedValue(MOE_SUPER_ADMIN);
    const { POST } = await import("@/app/api/moe/align/route");
    const res = await POST(new Request("http://x", { method: "POST", body: JSON.stringify({ batch: true }) }) as any);
    expect(res.status).toBe(200);
  });
});

describe("GET /api/moe/teacher-lessons — RBAC (NR-8 fix)", () => {
  it("STUDENT is forbidden", async () => {
    mockRequireUser.mockResolvedValue(STUDENT);
    const { GET } = await import("@/app/api/moe/teacher-lessons/route");
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("a real platform admin (role=ADMIN, isPlatformAdmin=true) is now allowed", async () => {
    mockRequireUser.mockResolvedValue(PLATFORM_ADMIN);
    const { GET } = await import("@/app/api/moe/teacher-lessons/route");
    const res = await GET();
    expect(res.status).toBe(200);
  });

  it("MOE_SUPER_ADMIN is now allowed", async () => {
    mockRequireUser.mockResolvedValue(MOE_SUPER_ADMIN);
    const { GET } = await import("@/app/api/moe/teacher-lessons/route");
    const res = await GET();
    expect(res.status).toBe(200);
  });
});

describe("GET /api/moe/submissions — RBAC (NR-8 fix)", () => {
  it("STUDENT is forbidden", async () => {
    mockRequireUser.mockResolvedValue(STUDENT);
    const { GET } = await import("@/app/api/moe/submissions/route");
    const res = await GET(new Request("http://x/api/moe/submissions") as any);
    expect(res.status).toBe(403);
  });

  it("a real platform admin is now allowed (the 'PLATFORM_ADMIN' role string could never match a real user)", async () => {
    mockRequireUser.mockResolvedValue(PLATFORM_ADMIN);
    const { GET } = await import("@/app/api/moe/submissions/route");
    const res = await GET(new Request("http://x/api/moe/submissions") as any);
    expect(res.status).toBe(200);
  });

  it("MOE_SUPER_ADMIN is now allowed", async () => {
    mockRequireUser.mockResolvedValue(MOE_SUPER_ADMIN);
    const { GET } = await import("@/app/api/moe/submissions/route");
    const res = await GET(new Request("http://x/api/moe/submissions") as any);
    expect(res.status).toBe(200);
  });
});

describe("PATCH /api/moe/submissions/[id]/review — RBAC (NR-8 fix)", () => {
  beforeEach(() => {
    mockMoeSubmissionFindUnique.mockResolvedValue({ id: "sub-1", schoolId: "school-1", title: "Q1 report" });
    mockMoeSubmissionUpdate.mockResolvedValue({ id: "sub-1", status: "ACKNOWLEDGED" });
  });

  function patchReq() {
    return new Request("http://x", {
      method: "PATCH",
      body: JSON.stringify({ status: "ACKNOWLEDGED" }),
    }) as any;
  }

  it("STUDENT is forbidden", async () => {
    mockRequireUser.mockResolvedValue(STUDENT);
    const { PATCH } = await import("@/app/api/moe/submissions/[id]/review/route");
    const res = await PATCH(patchReq(), { params: { id: "sub-1" } });
    expect(res.status).toBe(403);
  });

  it("a real platform admin is now allowed (the 'PLATFORM_ADMIN' role string could never match a real user)", async () => {
    mockRequireUser.mockResolvedValue(PLATFORM_ADMIN);
    const { PATCH } = await import("@/app/api/moe/submissions/[id]/review/route");
    const res = await PATCH(patchReq(), { params: { id: "sub-1" } });
    expect(res.status).toBe(200);
  });

  it("MOE_SUPER_ADMIN is now allowed", async () => {
    mockRequireUser.mockResolvedValue(MOE_SUPER_ADMIN);
    const { PATCH } = await import("@/app/api/moe/submissions/[id]/review/route");
    const res = await PATCH(patchReq(), { params: { id: "sub-1" } });
    expect(res.status).toBe(200);
  });
});
