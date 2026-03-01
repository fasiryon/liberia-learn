import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const mockRequireRole = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());
const mockIsAbBlockSchedulingEnabled = vi.hoisted(() => vi.fn());
const mockIsAssignmentLessonLinkageEnabled = vi.hoisted(() => vi.fn());
const mockIsVirtualLabsEnabled = vi.hoisted(() => vi.fn());
const mockIsDeliveryComplianceReportingEnabled = vi.hoisted(() => vi.fn());

const mockClassFindUnique = vi.hoisted(() => vi.fn());
const mockContentFindUnique = vi.hoisted(() => vi.fn());
const mockScheduledWorkCreate = vi.hoisted(() => vi.fn());
const mockAssignmentSuggestionCreate = vi.hoisted(() => vi.fn());
const mockVirtualLabFindMany = vi.hoisted(() => vi.fn());

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
    isAbBlockSchedulingEnabled: mockIsAbBlockSchedulingEnabled,
    isAssignmentLessonLinkageEnabled: mockIsAssignmentLessonLinkageEnabled,
    isVirtualLabsEnabled: mockIsVirtualLabsEnabled,
    isDeliveryComplianceReportingEnabled: mockIsDeliveryComplianceReportingEnabled,
  };
});

vi.mock("@/lib/db", () => ({
  prisma: {
    class: { findUnique: mockClassFindUnique },
    curriculumContent: { findUnique: mockContentFindUnique },
    scheduledWork: { create: mockScheduledWorkCreate },
    assignmentSuggestion: { create: mockAssignmentSuggestionCreate },
    virtualLab: { findMany: mockVirtualLabFindMany },
  },
}));

import { POST } from "@/app/api/teacher/schedule/route";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TEACHER_USER = { id: "u1", schoolId: "school-1", role: "TEACHER" };

const CLASS_RECORD = { schoolId: "school-1" };

// Content with a splitPoint — required for A/B pairing to fire
const CONTENT_WITH_SPLIT = {
  id: "content-pk-1",
  grade: 8,
  subject: "SCIENCE",
  moeAlignments: [{ code: "SCI-G8-LIF-01" }],
  payload: { title: "Cell Division" },
  deliveryProfile: {
    estimatedMinutes: 90,
    splitPoint: { afterPhase: "Instruction", day2Opening: "Review key vocabulary" },
    exitTicket: { questions: [{ question: "Q1" }, { question: "Q2" }] },
  },
};

// Content without a splitPoint — pairing must NOT fire even with block format
const CONTENT_WITHOUT_SPLIT = {
  id: "content-pk-2",
  grade: 8,
  subject: "SCIENCE",
  moeAlignments: [{ code: "SCI-G8-LIF-01" }],
  payload: { title: "Short Lesson" },
  deliveryProfile: {
    estimatedMinutes: 45,
    // no splitPoint key
    exitTicket: { questions: [{ question: "Q1" }, { question: "Q2" }] },
  },
};

// Content with no deliveryProfile at all
const CONTENT_NO_PROFILE = {
  id: "content-pk-3",
  grade: 5,
  subject: "MATH",
  moeAlignments: [],
  payload: { title: "Addition" },
  deliveryProfile: null,
};

let createCallCount = 0;

function makePostRequest(body: object) {
  return new Request("http://localhost/api/teacher/schedule", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as any;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("POST /api/teacher/schedule — A/B block pairing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createCallCount = 0;
    mockRequireRole.mockResolvedValue(TEACHER_USER);
    mockLogAudit.mockResolvedValue(undefined);
    mockIsAbBlockSchedulingEnabled.mockReturnValue(true);
    mockIsAssignmentLessonLinkageEnabled.mockReturnValue(false);
    mockIsVirtualLabsEnabled.mockReturnValue(false);
    mockIsDeliveryComplianceReportingEnabled.mockReturnValue(false);
    mockClassFindUnique.mockResolvedValue(CLASS_RECORD);
    mockContentFindUnique.mockResolvedValue(CONTENT_WITH_SPLIT);
    mockVirtualLabFindMany.mockResolvedValue([]);
    mockAssignmentSuggestionCreate.mockResolvedValue({ id: "as-1" });

    // Track call count to differentiate primary vs sibling
    mockScheduledWorkCreate.mockImplementation(() => {
      createCallCount += 1;
      return Promise.resolve({
        id: `sw-${createCallCount}`,
        classId: "class-1",
        scheduledDate: new Date("2026-03-03"),
        classFormat: createCallCount === 1 ? "block_a" : "block_b",
        status: createCallCount === 1 ? "confirmed" : "suggested",
        sessionPairId: "pair-uuid-1",
        suggestedLabs: null,
      });
    });
  });

  // ── Flag OFF ────────────────────────────────────────────────────────────────

  it("returns no suggestedPair in response when A/B flag is OFF", async () => {
    mockIsAbBlockSchedulingEnabled.mockReturnValue(false);

    const res = await POST(
      makePostRequest({
        contentId: "content-pk-1",
        classId: "class-1",
        scheduledDate: "2026-03-03",
        classFormat: "block_a",
      })
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.suggestedPair).toBeUndefined();
    // Only one create call (no sibling)
    expect(mockScheduledWorkCreate).toHaveBeenCalledTimes(1);
  });

  // ── classFormat=standard ────────────────────────────────────────────────────

  it("does not create sibling when classFormat=standard", async () => {
    const res = await POST(
      makePostRequest({
        contentId: "content-pk-1",
        classId: "class-1",
        scheduledDate: "2026-03-03",
        classFormat: "standard",
      })
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.suggestedPair).toBeUndefined();
    expect(mockScheduledWorkCreate).toHaveBeenCalledTimes(1);
  });

  it("does not create sibling when classFormat is omitted", async () => {
    const res = await POST(
      makePostRequest({
        contentId: "content-pk-1",
        classId: "class-1",
        scheduledDate: "2026-03-03",
      })
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.suggestedPair).toBeUndefined();
    expect(mockScheduledWorkCreate).toHaveBeenCalledTimes(1);
  });

  // ── No splitPoint in deliveryProfile ────────────────────────────────────────

  it("does not create sibling when classFormat=block_a but content has no splitPoint", async () => {
    mockContentFindUnique.mockResolvedValue(CONTENT_WITHOUT_SPLIT);

    const res = await POST(
      makePostRequest({
        contentId: "content-pk-2",
        classId: "class-1",
        scheduledDate: "2026-03-03",
        classFormat: "block_a",
      })
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.suggestedPair).toBeUndefined();
    expect(mockScheduledWorkCreate).toHaveBeenCalledTimes(1);
  });

  it("does not create sibling when content has no deliveryProfile at all", async () => {
    mockContentFindUnique.mockResolvedValue(CONTENT_NO_PROFILE);

    const res = await POST(
      makePostRequest({
        contentId: "content-pk-3",
        classId: "class-1",
        scheduledDate: "2026-03-03",
        classFormat: "block_a",
      })
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.suggestedPair).toBeUndefined();
    expect(mockScheduledWorkCreate).toHaveBeenCalledTimes(1);
  });

  // ── block_a pairing ─────────────────────────────────────────────────────────

  it("creates sibling when classFormat=block_a, splitPoint present, flag ON", async () => {
    const res = await POST(
      makePostRequest({
        contentId: "content-pk-1",
        classId: "class-1",
        scheduledDate: "2026-03-03",
        classFormat: "block_a",
      })
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.suggestedPair).toBeDefined();
    // Two scheduledWork.create calls: primary + sibling
    expect(mockScheduledWorkCreate).toHaveBeenCalledTimes(2);
  });

  it("sibling has classFormat=block_b when primary is block_a", async () => {
    await POST(
      makePostRequest({
        contentId: "content-pk-1",
        classId: "class-1",
        scheduledDate: "2026-03-03",
        classFormat: "block_a",
      })
    );

    const siblingCreateCall = mockScheduledWorkCreate.mock.calls[1][0];
    expect(siblingCreateCall.data.classFormat).toBe("block_b");
  });

  it("sibling date is +2 days from primary scheduledDate", async () => {
    const primaryDate = "2026-03-03";
    await POST(
      makePostRequest({
        contentId: "content-pk-1",
        classId: "class-1",
        scheduledDate: primaryDate,
        classFormat: "block_a",
      })
    );

    const siblingCreateCall = mockScheduledWorkCreate.mock.calls[1][0];
    const siblingDate: Date = siblingCreateCall.data.scheduledDate;
    const expectedDate = new Date("2026-03-05");
    expect(siblingDate.toDateString()).toBe(expectedDate.toDateString());
  });

  it("both primary and sibling share the same sessionPairId", async () => {
    await POST(
      makePostRequest({
        contentId: "content-pk-1",
        classId: "class-1",
        scheduledDate: "2026-03-03",
        classFormat: "block_a",
      })
    );

    const primaryPairId = mockScheduledWorkCreate.mock.calls[0][0].data.sessionPairId;
    const siblingPairId = mockScheduledWorkCreate.mock.calls[1][0].data.sessionPairId;
    expect(primaryPairId).toBeDefined();
    expect(primaryPairId).toBe(siblingPairId);
  });

  it("primary has status=confirmed, sibling has status=suggested", async () => {
    await POST(
      makePostRequest({
        contentId: "content-pk-1",
        classId: "class-1",
        scheduledDate: "2026-03-03",
        classFormat: "block_a",
      })
    );

    const primaryStatus = mockScheduledWorkCreate.mock.calls[0][0].data.status;
    const siblingStatus = mockScheduledWorkCreate.mock.calls[1][0].data.status;
    expect(primaryStatus).toBe("confirmed");
    expect(siblingStatus).toBe("suggested");
  });

  it("response includes suggestedPair with id, classFormat, scheduledDate, status", async () => {
    const res = await POST(
      makePostRequest({
        contentId: "content-pk-1",
        classId: "class-1",
        scheduledDate: "2026-03-03",
        classFormat: "block_a",
      })
    );

    const json = await res.json();
    expect(json.suggestedPair).toHaveProperty("id");
    expect(json.suggestedPair).toHaveProperty("classFormat");
    expect(json.suggestedPair).toHaveProperty("scheduledDate");
    expect(json.suggestedPair).toHaveProperty("status");
  });

  // ── block_b pairing ─────────────────────────────────────────────────────────

  it("sibling has classFormat=block_a when primary is block_b", async () => {
    // Override create mock to return block_b primary, block_a sibling
    createCallCount = 0;
    mockScheduledWorkCreate.mockImplementation(() => {
      createCallCount += 1;
      return Promise.resolve({
        id: `sw-${createCallCount}`,
        classId: "class-1",
        scheduledDate: new Date("2026-03-05"),
        classFormat: createCallCount === 1 ? "block_b" : "block_a",
        status: createCallCount === 1 ? "confirmed" : "suggested",
        sessionPairId: "pair-uuid-2",
        suggestedLabs: null,
      });
    });

    await POST(
      makePostRequest({
        contentId: "content-pk-1",
        classId: "class-1",
        scheduledDate: "2026-03-05",
        classFormat: "block_b",
      })
    );

    const siblingCreateCall = mockScheduledWorkCreate.mock.calls[1][0];
    expect(siblingCreateCall.data.classFormat).toBe("block_a");
  });
});
