import { vi, describe, it, expect, beforeEach } from "vitest";

// NR-7 — Systematic Tenant Access Guard.
//
// Extends the __tests__/growth.tenant-isolation.test.ts /
// __tests__/security/school-isolation.test.ts pattern to a broader critical
// API sample. Group A regression-tests the three genuine cross-tenant gaps
// found and fixed this sprint (LessonVideo admin scoping x3, post-change-eval
// GET). Group B/C exercise the shared scope-resolution functions that back
// the remaining admin/ops + admin/training routes audited this sprint —
// testing the exact enforcement code path each route delegates to.

// ─── Group A1/A2: teacher/lessons/[contentId]/video/[videoId] (PATCH/DELETE) ──

const mockRequireRoleVideo = vi.hoisted(() => vi.fn());
const mockVideoFindUnique = vi.hoisted(() => vi.fn());
const mockVideoUpdate = vi.hoisted(() => vi.fn());
const mockVideoUpdateMany = vi.hoisted(() => vi.fn());
const mockVideoDelete = vi.hoisted(() => vi.fn());
const mockBlobDel = vi.hoisted(() => vi.fn());

vi.mock("@vercel/blob", () => ({ del: mockBlobDel, put: vi.fn() }));
vi.mock("@/lib/auth", () => ({
  requireRole: mockRequireRoleVideo,
  requireUser: vi.fn(),
  requirePlatformAdmin: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    lessonVideo: {
      findUnique: mockVideoFindUnique,
      update: mockVideoUpdate,
      updateMany: mockVideoUpdateMany,
      delete: mockVideoDelete,
    },
    schoolStorageQuota: { findUnique: vi.fn().mockResolvedValue(null) },
    postChangeEvaluationPlan: { findUnique: vi.fn() },
  },
}));

describe("teacher/lessons/[contentId]/video/[videoId] — cross-school admin (NR-7 fix)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBlobDel.mockResolvedValue(undefined);
  });

  it("13. PATCH: admin from a different school than the video's uploader is blocked", async () => {
    mockRequireRoleVideo.mockResolvedValue({ id: "admin-2", role: "ADMIN", schoolId: "school-b", isPlatformAdmin: false });
    mockVideoFindUnique.mockResolvedValue({ id: "video-1", lessonId: "lesson-1", uploadedBy: "teacher-1", schoolId: "school-a" });
    const { PATCH } = await import("@/app/api/teacher/lessons/[contentId]/video/[videoId]/route");
    const req = new Request("http://localhost/x", { method: "PATCH", body: JSON.stringify({ isActive: true }) });
    const res = await PATCH(req as any, { params: { contentId: "lesson-1", videoId: "video-1" } });
    expect(res.status).toBe(403);
    expect(mockVideoUpdate).not.toHaveBeenCalled();
  });

  it("14. PATCH: admin from the same school as the video's uploader is allowed", async () => {
    mockRequireRoleVideo.mockResolvedValue({ id: "admin-1", role: "ADMIN", schoolId: "school-a", isPlatformAdmin: false });
    mockVideoFindUnique.mockResolvedValue({ id: "video-1", lessonId: "lesson-1", uploadedBy: "teacher-1", schoolId: "school-a" });
    mockVideoUpdate.mockResolvedValue({ id: "video-1", isActive: true });
    const { PATCH } = await import("@/app/api/teacher/lessons/[contentId]/video/[videoId]/route");
    const req = new Request("http://localhost/x", { method: "PATCH", body: JSON.stringify({ isActive: true }) });
    const res = await PATCH(req as any, { params: { contentId: "lesson-1", videoId: "video-1" } });
    expect(res.status).toBe(200);
    expect(mockVideoUpdate).toHaveBeenCalled();
  });

  it("15. DELETE: admin from a different school than the video's uploader is blocked", async () => {
    mockRequireRoleVideo.mockResolvedValue({ id: "admin-2", role: "ADMIN", schoolId: "school-b", isPlatformAdmin: false });
    mockVideoFindUnique.mockResolvedValue({ id: "video-1", lessonId: "lesson-1", uploadedBy: "teacher-1", schoolId: "school-a", storageUrl: "https://blob/x" });
    const { DELETE } = await import("@/app/api/teacher/lessons/[contentId]/video/[videoId]/route");
    const res = await DELETE({} as any, { params: { contentId: "lesson-1", videoId: "video-1" } });
    expect(res.status).toBe(403);
    expect(mockVideoDelete).not.toHaveBeenCalled();
    expect(mockBlobDel).not.toHaveBeenCalled();
  });

  it("16. DELETE: platform admin can delete a video in any school", async () => {
    mockRequireRoleVideo.mockResolvedValue({ id: "platform-1", role: "ADMIN", schoolId: null, isPlatformAdmin: true });
    mockVideoFindUnique.mockResolvedValue({ id: "video-1", lessonId: "lesson-1", uploadedBy: "teacher-1", schoolId: "school-a", storageUrl: "https://blob/x" });
    mockVideoDelete.mockResolvedValue({ id: "video-1" });
    const { DELETE } = await import("@/app/api/teacher/lessons/[contentId]/video/[videoId]/route");
    const res = await DELETE({} as any, { params: { contentId: "lesson-1", videoId: "video-1" } });
    expect(res.status).toBe(200);
    expect(mockVideoDelete).toHaveBeenCalled();
  });
});

// ─── Group A3: teacher/lessons/[contentId]/video (GET listing) ───────────────

vi.mock("@/lib/events/logLearningEvent", () => ({ logLearningEvent: vi.fn() }));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }));
vi.mock("@/lib/push/sendPush", () => ({ sendPushToMany: vi.fn(), sendPushToUser: vi.fn() }));

describe("teacher/lessons/[contentId]/video GET — admin listing scoped to own school (NR-7 fix)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("17. school ADMIN's video listing is filtered to their own school, not uploadedBy-unfiltered", async () => {
    mockRequireRoleVideo.mockResolvedValue({ id: "admin-1", role: "ADMIN", schoolId: "school-a", isPlatformAdmin: false });
    const findMany = vi.fn().mockResolvedValue([]);
    vi.doMock("@/lib/db", () => ({
      prisma: {
        lessonVideo: { findMany },
        schoolStorageQuota: { findUnique: vi.fn().mockResolvedValue(null) },
      },
    }));
    vi.resetModules();
    const { GET } = await import("@/app/api/teacher/lessons/[contentId]/video/route");
    const res = await GET({} as any, { params: { contentId: "lesson-1" } });
    expect(res.status).toBe(200);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ lessonId: "lesson-1", schoolId: "school-a" }) })
    );
  });
});

// ─── Group A4: admin/ops/optimization/change-requests/[id]/post-change-eval ──

describe("admin/ops/optimization/change-requests/[id]/post-change-eval GET — tenant check (NR-7 fix)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("18. ADMIN from a different school than the change request is blocked", async () => {
    const requireUser = vi.fn().mockResolvedValue({ id: "admin-2", role: "ADMIN", schoolId: "school-b", isPlatformAdmin: false });
    const findUniquePlan = vi.fn().mockResolvedValue({
      id: "plan-1",
      changeRequestId: "cr-1",
      status: "BASELINE_RECORDED",
      changeRequest: { schoolId: "school-a" },
    });
    vi.doMock("@/lib/auth", () => ({ requireUser, requirePlatformAdmin: vi.fn() }));
    vi.doMock("@/lib/db", () => ({ prisma: { postChangeEvaluationPlan: { findUnique: findUniquePlan } } }));
    vi.resetModules();
    const { GET } = await import(
      "@/app/api/admin/ops/optimization/change-requests/[changeRequestId]/post-change-eval/route"
    );
    const res = await GET({} as any, { params: { changeRequestId: "cr-1" } });
    expect(res.status).toBe(403);
  });

  it("19. ADMIN from the same school as the change request can read the plan", async () => {
    const requireUser = vi.fn().mockResolvedValue({ id: "admin-1", role: "ADMIN", schoolId: "school-a", isPlatformAdmin: false });
    const findUniquePlan = vi.fn().mockResolvedValue({
      id: "plan-1",
      changeRequestId: "cr-1",
      status: "BASELINE_RECORDED",
      changeRequest: { schoolId: "school-a" },
    });
    vi.doMock("@/lib/auth", () => ({ requireUser, requirePlatformAdmin: vi.fn() }));
    vi.doMock("@/lib/db", () => ({ prisma: { postChangeEvaluationPlan: { findUnique: findUniquePlan } } }));
    vi.resetModules();
    const { GET } = await import(
      "@/app/api/admin/ops/optimization/change-requests/[changeRequestId]/post-change-eval/route"
    );
    const res = await GET({} as any, { params: { changeRequestId: "cr-1" } });
    expect(res.status).toBe(200);
    expect((await res.json()).evalPlan.id).toBe("plan-1");
  });
});

// ─── Group B: shared scope-resolution functions (unit level, real code) ──────
//
// These back admin/ops/metrics/events, admin/ops/metrics/summary,
// admin/training/export, and admin/training/summary — verified by grep to
// import resolveScopeParams from lib/reporting/scope.ts before this test was
// written. No route-specific business logic sits between the route and this
// function, so exercising it directly covers the tenant-isolation contract
// all four routes depend on.

import { resolveScopeParams } from "@/lib/reporting/scope";

describe("resolveScopeParams — backs admin/ops/metrics/{events,summary} + admin/training/{export,summary}", () => {
  it("20. school ADMIN requesting their own school's scopeId passes", () => {
    const user = { id: "a1", role: "ADMIN", schoolId: "school-a", isPlatformAdmin: false } as any;
    expect(resolveScopeParams({ scopeParam: "school", scopeIdParam: "school-a", user })).toEqual({
      scope: "school",
      scopeId: "school-a",
    });
  });

  it("21. school ADMIN requesting a different school's scopeId is forbidden", () => {
    const user = { id: "a1", role: "ADMIN", schoolId: "school-a", isPlatformAdmin: false } as any;
    expect(() => resolveScopeParams({ scopeParam: "school", scopeIdParam: "school-b", user })).toThrow(/Forbidden/);
  });

  it("22. school ADMIN requesting district/county/national scope is forbidden", () => {
    const user = { id: "a1", role: "ADMIN", schoolId: "school-a", isPlatformAdmin: false } as any;
    expect(() => resolveScopeParams({ scopeParam: "district", scopeIdParam: "d1", user })).toThrow(/Forbidden/);
    expect(() => resolveScopeParams({ scopeParam: "national", user })).toThrow(/Forbidden/);
  });

  it("23. platform admin can request any school's scopeId or national scope", () => {
    const user = { id: "p1", role: "ADMIN", schoolId: null, isPlatformAdmin: true } as any;
    expect(resolveScopeParams({ scopeParam: "school", scopeIdParam: "school-z", user }).scopeId).toBe("school-z");
    expect(resolveScopeParams({ scopeParam: "national", user })).toEqual({ scope: "national", scopeId: null });
  });
});

// ─── Group C: forecastScopeForUser (unit level, real code) ───────────────────
//
// Backs admin/ops/early-warnings, admin/ops/forecasting,
// admin/ops/forecast-calibration, admin/ops/predictions,
// admin/ops/trajectories — verified by grep before this test was written.
// The scope is always derived from the caller's own identity (no
// client-supplied schoolId param exists on these routes), so the guarantee
// worth regression-testing is that a school-tenant user can never receive an
// aggregate-safe / cross-school scope.

import { forecastScopeForUser } from "@/lib/autonomous/predictions/access";

describe("forecastScopeForUser — backs admin/ops/{early-warnings,forecasting,forecast-calibration,predictions,trajectories}", () => {
  it("24. school ADMIN always gets scoped to their own schoolId, never aggregate-safe", () => {
    const user = { id: "a1", role: "ADMIN", schoolId: "school-a", isPlatformAdmin: false } as any;
    const result = forecastScopeForUser(user);
    expect(result.scope).toEqual({ schoolId: "school-a", aggregateSafe: false });
  });

  it("25. MOE_OFFICIAL / DISTRICT_ADMIN / platform admin get the aggregate-safe (cross-school) view", () => {
    expect(forecastScopeForUser({ id: "m1", role: "MOE_OFFICIAL", schoolId: null, isPlatformAdmin: false } as any).scope).toEqual({
      aggregateSafe: true,
    });
    expect(forecastScopeForUser({ id: "d1", role: "DISTRICT_ADMIN", schoolId: null, isPlatformAdmin: false } as any).scope).toEqual({
      aggregateSafe: true,
    });
    expect(forecastScopeForUser({ id: "p1", role: "ADMIN", schoolId: "school-a", isPlatformAdmin: true } as any).scope).toEqual({
      aggregateSafe: true,
    });
  });
});

// ─── Group D: admin/ops/approvals/[approvalRequestId]/{approve,reject} ───────

const mockApprovalFindUnique = vi.hoisted(() => vi.fn());
const mockActionExecutionFindUnique = vi.hoisted(() => vi.fn());

vi.mock("@/lib/serverFlags", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/serverFlags")>();
  return { ...actual, isActionGovernanceEnabled: () => true };
});

describe("admin/ops/approvals/[id]/{approve,reject} — cross-school approver is forbidden", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.doMock("@/lib/db", () => ({
      prisma: {
        approvalRequest: { findUnique: mockApprovalFindUnique },
        actionExecution: { findUnique: mockActionExecutionFindUnique },
      },
    }));
    vi.doMock("@/lib/auth", () => ({ requireUser: vi.fn(), requirePlatformAdmin: vi.fn() }));
  });

  it("26. POST approve: ADMIN from a different school than the approval request is forbidden", async () => {
    const requireUser = vi.fn().mockResolvedValue({ id: "admin-2", role: "ADMIN", schoolId: "school-b", isPlatformAdmin: false });
    vi.doMock("@/lib/auth", () => ({ requireUser, requirePlatformAdmin: vi.fn() }));
    mockApprovalFindUnique.mockResolvedValue({ id: "appr-1", schoolId: "school-a", status: "PENDING", approverRole: "ADMIN", actionExecutionId: "ax-1", expiresAt: null });
    mockActionExecutionFindUnique.mockResolvedValue({ id: "ax-1", agentDecisionId: null });
    vi.resetModules();
    const { POST } = await import("@/app/api/admin/ops/approvals/[approvalRequestId]/approve/route");
    const req = new Request("http://localhost/x", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    const res = await POST(req as any, { params: { approvalRequestId: "appr-1" } });
    expect(res.status).toBe(403);
  });

  it("27. POST reject: ADMIN from a different school than the approval request is forbidden", async () => {
    const requireUser = vi.fn().mockResolvedValue({ id: "admin-2", role: "ADMIN", schoolId: "school-b", isPlatformAdmin: false });
    vi.doMock("@/lib/auth", () => ({ requireUser, requirePlatformAdmin: vi.fn() }));
    mockApprovalFindUnique.mockResolvedValue({ id: "appr-1", schoolId: "school-a", status: "PENDING", approverRole: "ADMIN", actionExecutionId: "ax-1", expiresAt: null });
    mockActionExecutionFindUnique.mockResolvedValue({ id: "ax-1", agentDecisionId: null });
    vi.resetModules();
    const { POST } = await import("@/app/api/admin/ops/approvals/[approvalRequestId]/reject/route");
    const req = new Request("http://localhost/x", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    const res = await POST(req as any, { params: { approvalRequestId: "appr-1" } });
    expect(res.status).toBe(403);
  });
});
