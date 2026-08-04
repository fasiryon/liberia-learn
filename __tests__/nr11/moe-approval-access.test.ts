import { beforeEach, describe, expect, it, vi } from "vitest";

// NR-11 — MOE Published Backlog Approval Sprint.
//
// Investigation found the real backlog target (389 "published, awaiting
// approval" lessons per the 2026-04-23 audit) was resolved by automated
// scripts (bulk-approve-published.ts, promote-enriched-lessons.ts), not by
// human MOE review — see those scripts' header comments for the production
// evidence. The plan's numeric gate ("<50 remaining") is already satisfied
// by live data. The real, concrete gap this sprint closes: MOE_OFFICIAL and
// MOE_SUPER_ADMIN already hold PERMISSIONS.CURRICULUM_APPROVE in
// lib/permissions.ts, but every route that lets a human actually approve or
// reject curriculum content hard-required role === "ADMIN" (or
// isPlatformAdmin), silently locking MOE roles out despite the plan saying
// NR-11 "may be MOE-led" — the same class of bug NR-8 found across
// /api/moe/* routes. This file locks in that MOE roles can now use the
// approve/reject/bulk-review surfaces, and that roles without the
// permission (TEACHER, STUDENT) are still denied.

const mockRequireUser = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn(async () => {}));
const mockCurriculumContentFindUnique = vi.hoisted(() => vi.fn());
const mockCurriculumContentUpdate = vi.hoisted(() => vi.fn());
const mockListCurriculumDrafts = vi.hoisted(() => vi.fn(async () => []));
const mockReviewCurriculumDraft = vi.hoisted(() => vi.fn());
const mockCountRiskFlaggedAwaitingReview = vi.hoisted(() => vi.fn(async () => 0));

vi.mock("@/lib/auth", () => ({ requireUser: mockRequireUser }));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));
vi.mock("@/lib/serverFlags", () => ({ isCurriculumFeedbackEnabled: () => false }));
vi.mock("@/lib/ai/rag/embeddingService", () => ({ embedLesson: vi.fn(async () => {}) }));
vi.mock("@/lib/ai/rag/ragIngestionService", () => ({
  syncCurriculumContentRagChunks: vi.fn(async () => {}),
  deleteCurriculumContentRagChunks: vi.fn(async () => {}),
}));
vi.mock("@/lib/queue", () => ({ isQueueConfigured: () => false, enqueueJob: vi.fn(), JobType: { GENERATE_EMBEDDINGS: "GENERATE_EMBEDDINGS" } }));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn() } }));
vi.mock("@upstash/redis", () => ({ Redis: { fromEnv: () => null } }));
vi.mock("@/lib/db", () => ({
  prisma: {
    curriculumContent: {
      findUnique: mockCurriculumContentFindUnique,
      update: mockCurriculumContentUpdate,
    },
  },
}));
vi.mock("@/lib/curriculum/regenerationAdmin", () => ({
  listCurriculumDrafts: mockListCurriculumDrafts,
  reviewCurriculumDraft: mockReviewCurriculumDraft,
}));
vi.mock("@/lib/curriculum/riskTriage", () => ({
  countRiskFlaggedAwaitingReview: mockCountRiskFlaggedAwaitingReview,
}));

import { POST as approvePost } from "@/app/api/admin/curriculum/approve/route";
import { POST as rejectPost } from "@/app/api/admin/curriculum/reject/route";
import { GET as reviewGet, POST as reviewPost } from "@/app/api/admin/ops/curriculum-review/route";

const ADMIN = { id: "u-admin", role: "ADMIN", schoolId: "school-1" };
const MOE_OFFICIAL = { id: "u-moe", role: "MOE_OFFICIAL", schoolId: null };
const MOE_SUPER_ADMIN = { id: "u-moe-super", role: "MOE_SUPER_ADMIN", schoolId: null };
const TEACHER = { id: "u-teacher", role: "TEACHER", schoolId: "school-1" };
const STUDENT = { id: "u-student", role: "STUDENT", schoolId: "school-1" };

const CONTENT_RECORD = {
  id: "row-1",
  contentId: "content-1",
  grade: 5,
  subject: "MATH",
  payload: {},
};

function jsonReq(url: string, body: unknown) {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCurriculumContentFindUnique.mockResolvedValue(CONTENT_RECORD);
  mockCurriculumContentUpdate.mockResolvedValue({ ...CONTENT_RECORD, status: "published" });
  mockListCurriculumDrafts.mockResolvedValue([]);
  mockReviewCurriculumDraft.mockResolvedValue({ contentId: "content-1", ok: true, status: "published" });
});

describe.each([
  ["ADMIN", ADMIN],
  ["MOE_OFFICIAL", MOE_OFFICIAL],
  ["MOE_SUPER_ADMIN", MOE_SUPER_ADMIN],
])("roles holding CURRICULUM_APPROVE can use every review surface — %s", (_label, user) => {
  it("POST /api/admin/curriculum/approve succeeds", async () => {
    mockRequireUser.mockResolvedValue(user);
    const res = await approvePost(
      jsonReq("http://localhost/api/admin/curriculum/approve", { contentId: "content-1" }) as any
    );
    expect(res.status).toBe(200);
  });

  it("POST /api/admin/curriculum/reject succeeds", async () => {
    mockRequireUser.mockResolvedValue(user);
    const res = await rejectPost(
      jsonReq("http://localhost/api/admin/curriculum/reject", { contentId: "content-1" }) as any
    );
    expect(res.status).toBe(200);
  });

  it("GET /api/admin/ops/curriculum-review succeeds", async () => {
    mockRequireUser.mockResolvedValue(user);
    const res = await reviewGet(new Request("http://localhost/api/admin/ops/curriculum-review") as any);
    expect(res.status).toBe(200);
  });

  it("GET /api/admin/ops/curriculum-review includes the risk-triage backlog count", async () => {
    mockRequireUser.mockResolvedValue(user);
    mockCountRiskFlaggedAwaitingReview.mockResolvedValue(3);
    const res = await reviewGet(new Request("http://localhost/api/admin/ops/curriculum-review") as any);
    await expect(res.json()).resolves.toEqual(
      expect.objectContaining({ riskFlaggedAwaitingReview: 3 })
    );
  });

  it("POST /api/admin/ops/curriculum-review (bulk_approve) succeeds", async () => {
    mockRequireUser.mockResolvedValue(user);
    const res = await reviewPost(
      jsonReq("http://localhost/api/admin/ops/curriculum-review", {
        action: "bulk_approve",
        contentIds: ["content-1", "content-2"],
      }) as any
    );
    expect(res.status).toBe(200);
    expect(mockReviewCurriculumDraft).toHaveBeenCalledWith(
      expect.objectContaining({ action: "bulk_approve", contentIds: ["content-1", "content-2"], actor: user })
    );
  });
});

describe.each([
  ["TEACHER", TEACHER],
  ["STUDENT", STUDENT],
])("roles without CURRICULUM_APPROVE are denied on every review surface — %s", (_label, user) => {
  it("POST /api/admin/curriculum/approve returns 403", async () => {
    mockRequireUser.mockResolvedValue(user);
    const res = await approvePost(
      jsonReq("http://localhost/api/admin/curriculum/approve", { contentId: "content-1" }) as any
    );
    expect(res.status).toBe(403);
    expect(mockCurriculumContentUpdate).not.toHaveBeenCalled();
  });

  it("POST /api/admin/curriculum/reject returns 403", async () => {
    mockRequireUser.mockResolvedValue(user);
    const res = await rejectPost(
      jsonReq("http://localhost/api/admin/curriculum/reject", { contentId: "content-1" }) as any
    );
    expect(res.status).toBe(403);
  });

  it("GET /api/admin/ops/curriculum-review returns 403", async () => {
    mockRequireUser.mockResolvedValue(user);
    const res = await reviewGet(new Request("http://localhost/api/admin/ops/curriculum-review") as any);
    expect(res.status).toBe(403);
  });

  it("POST /api/admin/ops/curriculum-review returns 403", async () => {
    mockRequireUser.mockResolvedValue(user);
    const res = await reviewPost(
      jsonReq("http://localhost/api/admin/ops/curriculum-review", {
        action: "bulk_approve",
        contentIds: ["content-1"],
      }) as any
    );
    expect(res.status).toBe(403);
    expect(mockReviewCurriculumDraft).not.toHaveBeenCalled();
  });
});
