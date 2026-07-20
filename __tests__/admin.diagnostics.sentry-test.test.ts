import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequirePlatformAdmin = vi.hoisted(() => vi.fn());
const mockCaptureException = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  requirePlatformAdmin: mockRequirePlatformAdmin,
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: mockCaptureException,
}));

describe("GET /api/admin/diagnostics/sentry-test", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects non-platform-admins with 403, never reaching Sentry", async () => {
    mockRequirePlatformAdmin.mockRejectedValueOnce(
      Object.assign(new Error("Forbidden - platform admin required"), { status: 403 })
    );

    const { GET } = await import("@/app/api/admin/diagnostics/sentry-test/route");
    const res = await GET();

    expect(res.status).toBe(403);
    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it("throws a harmless error for platform admins and routes it through Sentry.captureException", async () => {
    mockRequirePlatformAdmin.mockResolvedValueOnce({ id: "admin-1", isPlatformAdmin: true });

    const { GET } = await import("@/app/api/admin/diagnostics/sentry-test/route");
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.code).toBe("INTERNAL_ERROR");
    expect(mockCaptureException).toHaveBeenCalledTimes(1);
    const [capturedError] = mockCaptureException.mock.calls[0];
    expect(capturedError.message).toMatch(/Sprint 6\.9 Sentry verification probe/);
  });
});
