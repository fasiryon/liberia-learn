import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireRole = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());
const mockIsCurriculumFeedbackEnabled = vi.hoisted(() => vi.fn());

const mockFindUnique = vi.hoisted(() => vi.fn());
const mockUpdate = vi.hoisted(() => vi.fn());
const mockFeedbackCreate = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  requireRole: mockRequireRole,
}));

vi.mock("@/lib/audit", () => ({
  logAudit: mockLogAudit,
}));

vi.mock("@/lib/serverFlags", async () => {
  const actual = await vi.importActual<any>("@/lib/serverFlags");
  return {
    ...actual,
    isCurriculumFeedbackEnabled: mockIsCurriculumFeedbackEnabled,
  };
});

vi.mock("@/lib/db", () => ({
  prisma: {
    curriculumContent: {
      findUnique: mockFindUnique,
      update: mockUpdate,
    },
    curriculumFeedback: {
      create: mockFeedbackCreate,
    },
  },
}));

import { POST as approvePost } from "@/app/api/admin/curriculum/approve/route";
import { POST as rejectPost } from "@/app/api/admin/curriculum/reject/route";

const ADMIN_USER = { id: "user-admin-1", role: "ADMIN", schoolId: "school-1" };

const CURRICULUM_RECORD = {
  contentId: "full_pack-math-g4-fractions",
  grade: 4,
  subject: "MATH",
  status: "pending_approval",
  payload: { type: "full_pack" },
};

function makeReq(body: object) {
  return new Request("http://localhost/api/admin/curriculum/approve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("curriculum approve — telemetry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireRole.mockResolvedValue(ADMIN_USER);
    mockLogAudit.mockResolvedValue(undefined);
    mockFindUnique.mockResolvedValue(CURRICULUM_RECORD);
    mockUpdate.mockResolvedValue({ ...CURRICULUM_RECORD, status: "published" });
    mockFeedbackCreate.mockResolvedValue({ id: "fb-1" });
  });

  it("records approved telemetry when flag is enabled", async () => {
    mockIsCurriculumFeedbackEnabled.mockReturnValue(true);

    const res = await approvePost(makeReq({ contentId: CURRICULUM_RECORD.contentId }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(mockFeedbackCreate).toHaveBeenCalledOnce();

    const call = mockFeedbackCreate.mock.calls[0][0].data;
    expect(call.curriculumId).toBe(CURRICULUM_RECORD.contentId);
    expect(call.action).toBe("approved");
    expect(call.grade).toBe(4);
    expect(call.subject).toBe("MATH");
    expect(call.generationMethod).toBe("deterministic");
  });

  it("does not record telemetry when flag is disabled", async () => {
    mockIsCurriculumFeedbackEnabled.mockReturnValue(false);

    const res = await approvePost(makeReq({ contentId: CURRICULUM_RECORD.contentId }));

    expect(res.status).toBe(200);
    expect(mockFeedbackCreate).not.toHaveBeenCalled();
  });

  it("approval succeeds even when telemetry write throws", async () => {
    mockIsCurriculumFeedbackEnabled.mockReturnValue(true);
    mockFeedbackCreate.mockRejectedValue(new Error("DB down"));

    const res = await approvePost(makeReq({ contentId: CURRICULUM_RECORD.contentId }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
  });

  it("telemetry does not include PII fields", async () => {
    mockIsCurriculumFeedbackEnabled.mockReturnValue(true);

    await approvePost(makeReq({ contentId: CURRICULUM_RECORD.contentId }));

    const call = mockFeedbackCreate.mock.calls[0][0].data;
    expect(call).not.toHaveProperty("userId");
    expect(call).not.toHaveProperty("approvedByUserId");
    expect(call).not.toHaveProperty("teacherName");
    expect(call).not.toHaveProperty("studentId");
  });
});

describe("curriculum reject — telemetry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireRole.mockResolvedValue(ADMIN_USER);
    mockLogAudit.mockResolvedValue(undefined);
    mockFindUnique.mockResolvedValue(CURRICULUM_RECORD);
    mockUpdate.mockResolvedValue({ ...CURRICULUM_RECORD, status: "rejected" });
    mockFeedbackCreate.mockResolvedValue({ id: "fb-2" });
  });

  it("records rejected telemetry with reason when flag is enabled", async () => {
    mockIsCurriculumFeedbackEnabled.mockReturnValue(true);

    const res = await rejectPost(
      makeReq({
        contentId: CURRICULUM_RECORD.contentId,
        rejectionReason: "Content not aligned with MOE Grade 4 curriculum",
      })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(mockFeedbackCreate).toHaveBeenCalledOnce();

    const call = mockFeedbackCreate.mock.calls[0][0].data;
    expect(call.action).toBe("rejected");
    expect(call.rejectionReason).toBe("Content not aligned with MOE Grade 4 curriculum");
    expect(call.curriculumId).toBe(CURRICULUM_RECORD.contentId);
  });

  it("rejection succeeds even when telemetry write throws", async () => {
    mockIsCurriculumFeedbackEnabled.mockReturnValue(true);
    mockFeedbackCreate.mockRejectedValue(new Error("DB down"));

    const res = await rejectPost(makeReq({ contentId: CURRICULUM_RECORD.contentId }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
  });

  it("rejection reason is optional — succeeds without it", async () => {
    mockIsCurriculumFeedbackEnabled.mockReturnValue(true);

    const res = await rejectPost(makeReq({ contentId: CURRICULUM_RECORD.contentId }));
    const json = await res.json();

    expect(res.status).toBe(200);
    const call = mockFeedbackCreate.mock.calls[0][0].data;
    expect(call.rejectionReason).toBeNull();
  });
});
