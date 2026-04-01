// __tests__/track.route.test.ts
// Verifies that POST /api/track requires authentication and records events.
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireUser = vi.hoisted(() => vi.fn());
const mockAuditCreate = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ requireUser: mockRequireUser }));
vi.mock("@/lib/db", () => ({ prisma: { auditLog: { create: mockAuditCreate } } }));

import { POST } from "@/app/api/track/route";

function makeReq(body: unknown) {
  return new Request("http://localhost/api/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireUser.mockResolvedValue({ id: "user-1", schoolId: "school-1" });
  mockAuditCreate.mockResolvedValue({});
});

describe("POST /api/track", () => {
  it("returns 401 when user is not authenticated", async () => {
    mockRequireUser.mockRejectedValueOnce(new Error("Unauthorized"));
    const res = await POST(makeReq({ eventType: "page_view" }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/unauthorized/i);
  });

  it("returns 200 and records event when authenticated", async () => {
    const res = await POST(makeReq({ eventType: "page_view", contentId: "lesson-1" }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(mockAuditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: "user-1", action: "page_view" }),
      })
    );
  });

  it("returns 200 even when body fails Zod (analytics must not break UX)", async () => {
    const res = await POST(makeReq({ notAnEvent: true }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    // No audit log created for invalid body
    expect(mockAuditCreate).not.toHaveBeenCalled();
  });

  it("records contentId and sessionId when provided", async () => {
    await POST(makeReq({ eventType: "lesson_start", contentId: "content-99", sessionId: "sess-1" }));
    expect(mockAuditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          details: expect.objectContaining({ contentId: "content-99", sessionId: "sess-1" }),
        }),
      })
    );
  });
});
