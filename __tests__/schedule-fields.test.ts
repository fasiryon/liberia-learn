import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const mockRequireRole = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());
const mockIsLessonDeliveryTrackingEnabled = vi.hoisted(() => vi.fn());

const mockScheduledWorkFindUnique = vi.hoisted(() => vi.fn());
const mockScheduledWorkUpdate = vi.hoisted(() => vi.fn());

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
    isLessonDeliveryTrackingEnabled: mockIsLessonDeliveryTrackingEnabled,
  };
});

vi.mock("@/lib/db", () => ({
  prisma: {
    scheduledWork: {
      findUnique: mockScheduledWorkFindUnique,
      update: mockScheduledWorkUpdate,
    },
  },
}));

import { PATCH } from "@/app/api/teacher/schedule/[id]/deliver/route";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TEACHER_USER = { id: "u1", schoolId: "school-1", role: "TEACHER" };

const SCHEDULED_WORK_RECORD = {
  id: "sw-1",
  classId: "class-1",
  contentId: "content-1",
  isDelivered: false,
  completionRate: null,
  class: { schoolId: "school-1" },
};

function makeReq(body: object = {}) {
  return new Request("http://localhost/api/teacher/schedule/sw-1/deliver", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as any;
}

function makeParams(id = "sw-1") {
  return { params: { id } };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("PATCH /api/teacher/schedule/[id]/deliver", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireRole.mockResolvedValue(TEACHER_USER);
    mockLogAudit.mockResolvedValue(undefined);
    mockIsLessonDeliveryTrackingEnabled.mockReturnValue(true);
    mockScheduledWorkFindUnique.mockResolvedValue(SCHEDULED_WORK_RECORD);
    mockScheduledWorkUpdate.mockResolvedValue({
      ...SCHEDULED_WORK_RECORD,
      isDelivered: true,
      deliveredAt: new Date("2026-03-01T09:00:00Z"),
      completionRate: 85,
    });
  });

  // ── Flag OFF ────────────────────────────────────────────────────────────────

  it("returns 404 when ENABLE_LESSON_DELIVERY_TRACKING flag is OFF", async () => {
    mockIsLessonDeliveryTrackingEnabled.mockReturnValue(false);

    const res = await PATCH(makeReq(), makeParams());

    expect(res.status).toBe(404);
  });

  it("does not call requireRole when flag is OFF", async () => {
    mockIsLessonDeliveryTrackingEnabled.mockReturnValue(false);

    await PATCH(makeReq(), makeParams());

    expect(mockRequireRole).not.toHaveBeenCalled();
  });

  // ── Tenant isolation ────────────────────────────────────────────────────────

  it("returns 403 when scheduled work belongs to a different school", async () => {
    mockScheduledWorkFindUnique.mockResolvedValue({
      ...SCHEDULED_WORK_RECORD,
      class: { schoolId: "school-OTHER" },
    });

    const res = await PATCH(makeReq({ completionRate: 80 }), makeParams());

    expect(res.status).toBe(403);
    expect(mockScheduledWorkUpdate).not.toHaveBeenCalled();
  });

  it("returns 403 when scheduled work is not found (null)", async () => {
    mockScheduledWorkFindUnique.mockResolvedValue(null);

    const res = await PATCH(makeReq(), makeParams());

    expect(res.status).toBe(403);
  });

  // ── Validation ──────────────────────────────────────────────────────────────

  it("returns 400 when completionRate > 100", async () => {
    const res = await PATCH(makeReq({ completionRate: 101 }), makeParams());

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/completionRate/i);
    expect(mockScheduledWorkUpdate).not.toHaveBeenCalled();
  });

  it("returns 400 when completionRate < 0", async () => {
    const res = await PATCH(makeReq({ completionRate: -1 }), makeParams());

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/completionRate/i);
    expect(mockScheduledWorkUpdate).not.toHaveBeenCalled();
  });

  it("accepts completionRate of exactly 0", async () => {
    mockScheduledWorkUpdate.mockResolvedValue({
      ...SCHEDULED_WORK_RECORD,
      isDelivered: true,
      deliveredAt: new Date(),
      completionRate: 0,
    });

    const res = await PATCH(makeReq({ completionRate: 0 }), makeParams());

    expect(res.status).toBe(200);
  });

  it("accepts completionRate of exactly 100", async () => {
    mockScheduledWorkUpdate.mockResolvedValue({
      ...SCHEDULED_WORK_RECORD,
      isDelivered: true,
      deliveredAt: new Date(),
      completionRate: 100,
    });

    const res = await PATCH(makeReq({ completionRate: 100 }), makeParams());

    expect(res.status).toBe(200);
  });

  // ── Success path ────────────────────────────────────────────────────────────

  it("returns 200 and { ok: true } on a valid deliver request", async () => {
    const res = await PATCH(makeReq({ completionRate: 85 }), makeParams());

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
  });

  it("sets isDelivered=true in the DB update", async () => {
    await PATCH(makeReq({ completionRate: 85 }), makeParams());

    expect(mockScheduledWorkUpdate).toHaveBeenCalledOnce();
    const updateArgs = mockScheduledWorkUpdate.mock.calls[0][0];
    expect(updateArgs.data.isDelivered).toBe(true);
  });

  it("passes completionRate through to DB update", async () => {
    await PATCH(makeReq({ completionRate: 72 }), makeParams());

    const updateArgs = mockScheduledWorkUpdate.mock.calls[0][0];
    expect(updateArgs.data.completionRate).toBe(72);
  });

  it("persists optional deliveryNotes in DB update", async () => {
    const notes = "Strong engagement during the fraction activity";
    await PATCH(makeReq({ deliveryNotes: notes, completionRate: 90 }), makeParams());

    const updateArgs = mockScheduledWorkUpdate.mock.calls[0][0];
    expect(updateArgs.data.deliveryNotes).toBe(notes);
  });

  it("calls logAudit with lesson.delivered action on success", async () => {
    await PATCH(makeReq({ completionRate: 85 }), makeParams());

    expect(mockLogAudit).toHaveBeenCalledOnce();
    const auditArgs = mockLogAudit.mock.calls[0][0];
    expect(auditArgs.action).toBe("lesson.delivered");
    expect(auditArgs.resourceType).toBe("scheduledWork");
    expect(auditArgs.resourceId).toBe("sw-1");
    expect(auditArgs.schoolId).toBe("school-1");
  });

  it("uses provided deliveredAt timestamp in the DB update", async () => {
    const deliveredAt = "2026-03-01T08:30:00Z";
    await PATCH(makeReq({ deliveredAt, completionRate: 80 }), makeParams());

    const updateArgs = mockScheduledWorkUpdate.mock.calls[0][0];
    expect(updateArgs.data.deliveredAt).toEqual(new Date(deliveredAt));
  });

  it("falls back to current timestamp when deliveredAt is omitted", async () => {
    const before = Date.now();
    await PATCH(makeReq({ completionRate: 80 }), makeParams());
    const after = Date.now();

    const updateArgs = mockScheduledWorkUpdate.mock.calls[0][0];
    const ts = (updateArgs.data.deliveredAt as Date).getTime();
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });
});
