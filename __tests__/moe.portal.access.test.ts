import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireRole = vi.hoisted(() => vi.fn());
const mockRequirePlatformAdmin = vi.hoisted(() => vi.fn());
const mockIsMoePortalEnabled = vi.hoisted(() => vi.fn());
const mockGetMoePortalAllowlist = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  requireRole: mockRequireRole,
  requirePlatformAdmin: mockRequirePlatformAdmin,
}));

vi.mock("@/lib/serverFlags", () => ({
  isMoePortalEnabled: mockIsMoePortalEnabled,
  getMoePortalAllowlist: mockGetMoePortalAllowlist,
}));

import { requireMoePlatformAdmin, requireMoePortalUser } from "@/lib/moeAccess";

beforeEach(() => {
  vi.clearAllMocks();
  mockIsMoePortalEnabled.mockReturnValue(true);
  mockGetMoePortalAllowlist.mockReturnValue([]);
});

describe("moe portal access", () => {
  it("returns 404 when flag is off", async () => {
    mockIsMoePortalEnabled.mockReturnValue(false);
    await expect(requireMoePortalUser()).rejects.toMatchObject({ status: 404 });
  });

  it("denies non-platform admins for MOE portal", async () => {
    mockRequireRole.mockResolvedValue({
      id: "admin-1",
      role: "ADMIN",
      schoolId: "school-1",
      isPlatformAdmin: false,
      email: "admin@school.lr",
    });
    await expect(requireMoePortalUser()).rejects.toMatchObject({ status: 403 });
  });

  it("denies non-allowlisted platform admin", async () => {
    mockGetMoePortalAllowlist.mockReturnValue(["gov.lr"]);
    mockRequireRole.mockResolvedValue({
      id: "plat-1",
      role: "ADMIN",
      schoolId: "school-1",
      isPlatformAdmin: true,
      email: "admin@school.lr",
    });
    await expect(requireMoePortalUser()).rejects.toMatchObject({ status: 403 });
  });

  it("allows allowlisted domain", async () => {
    mockGetMoePortalAllowlist.mockReturnValue(["gov.lr"]);
    mockRequireRole.mockResolvedValue({
      id: "plat-1",
      role: "ADMIN",
      schoolId: "school-1",
      isPlatformAdmin: true,
      email: "director@gov.lr",
    });
    const user = await requireMoePortalUser();
    expect(user.id).toBe("plat-1");
  });

  it("blocks non-platform admin on platform-only routes", async () => {
    mockRequirePlatformAdmin.mockRejectedValue(
      Object.assign(new Error("Forbidden — platform admin required"), { status: 403 })
    );
    await expect(requireMoePlatformAdmin()).rejects.toMatchObject({ status: 403 });
  });
});
