import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireRole = vi.hoisted(() => vi.fn());
const mockFind = vi.hoisted(() => vi.fn());
const mockUpdate = vi.hoisted(() => vi.fn());
const mockAudit = vi.hoisted(() => vi.fn());
const mockEnqueue = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ requireRole: mockRequireRole }));
vi.mock("@/lib/audit", () => ({ logAudit: mockAudit }));
vi.mock("@/lib/serverFlags", () => ({ isVirtualLabsEnabled: () => true }));
vi.mock("@/lib/offline/offlineQueue", () => ({ enqueue: mockEnqueue }));
vi.mock("@/lib/db", () => ({ prisma: { labSession: { findUnique: mockFind, update: mockUpdate } } }));

import { PATCH } from "@/app/api/student/labs/sessions/[sessionId]/route";

function request(score: number) {
  return new Request("http://localhost/lab", {
    method: "PATCH",
    body: JSON.stringify({ score, completedAt: "2026-09-12T00:00:00.000Z" }),
  }) as any;
}

describe("client lab-score containment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireRole.mockResolvedValue({ id: "user-a", role: "STUDENT", schoolId: "school-a" });
    mockFind.mockResolvedValue({ id: "session-a", studentId: "user-a", schoolId: "school-a", masteryUpdated: false });
    mockUpdate.mockImplementation(async ({ data }: any) => ({ id: "session-a", ...data }));
  });

  it("keeps a forged 100 percent score provisional and never marks mastery", async () => {
    const response = await PATCH(request(100), { params: { sessionId: "session-a" } });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ evidenceStatus: "PROVISIONAL", masteryUpdated: false });
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdate.mock.calls[0][0].data.masteryUpdated).toBe(false);
  });

  it("fails closed on a cross-tenant or wrong-user session", async () => {
    mockFind.mockResolvedValue({ id: "session-a", studentId: "other-user", schoolId: "school-b" });
    const response = await PATCH(request(100), { params: { sessionId: "session-a" } });
    expect(response.status).toBe(403);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("rejects an out-of-range client score", async () => {
    const response = await PATCH(request(101), { params: { sessionId: "session-a" } });
    expect(response.status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
