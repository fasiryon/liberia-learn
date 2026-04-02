import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireRole = vi.hoisted(() => vi.fn());
const mockUserFindUnique = vi.hoisted(() => vi.fn());
const mockUserUpdate = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  requireRole: mockRequireRole,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: mockUserFindUnique,
      update: mockUserUpdate,
    },
  },
}));

vi.mock("@/lib/audit", () => ({
  logAudit: mockLogAudit,
}));

describe("GET/PATCH /api/guardian/settings", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockRequireRole.mockResolvedValue({
      id: "guardian-1",
      role: "GUARDIAN",
      schoolId: "school-1",
    });
    mockUserFindUnique.mockResolvedValue({
      guardianPhoneE164: "+231770000111",
      preferredChannel: "SMS",
      smsOptIn: true,
      guardianSmsPreferences: {
        attendance: true,
        examResults: false,
        lowPerformance: true,
      },
    });
    mockUserUpdate.mockResolvedValue({ id: "guardian-1" });
  });

  it("returns current guardian settings", async () => {
    const { GET } = await import("@/app/api/guardian/settings/route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.phoneNumber).toBe("+231770000111");
    expect(body.preferences.examResults).toBe(false);
  }, 15_000);

  it("updates guardian sms preferences", async () => {
    const { PATCH } = await import("@/app/api/guardian/settings/route");
    const response = await PATCH(
      new Request("http://localhost/api/guardian/settings", {
        method: "PATCH",
        body: JSON.stringify({
          attendance: false,
          examResults: true,
          lowPerformance: false,
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(mockUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          smsOptIn: true,
          guardianSmsPreferences: {
            attendance: false,
            examResults: true,
            lowPerformance: false,
          },
        }),
      })
    );
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "guardian.settings.updated",
      })
    );
  }, 15_000);
});
