import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireUser = vi.hoisted(() => vi.fn());
const mockIsPromptRegistryEnabled = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  requireUser: mockRequireUser,
}));

vi.mock("@/lib/serverFlags", () => ({
  isPromptRegistryEnabled: mockIsPromptRegistryEnabled,
}));

import { GET } from "@/app/api/admin/prompts/route";

describe("GET /api/admin/prompts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsPromptRegistryEnabled.mockReturnValue(true);
    mockRequireUser.mockResolvedValue({
      id: "admin-1",
      role: "ADMIN",
      isPlatformAdmin: false,
    });
  });

  it("returns preview-only prompt metadata", async () => {
    const response = await GET();
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
    expect(body[0]).toHaveProperty("key");
    expect(body[0]).toHaveProperty("version");
    expect(body[0]).toHaveProperty("hash");
    expect(body[0]).toHaveProperty("preview");
    expect(body[0]).not.toHaveProperty("template");
  });

  it("returns 403 for non-admins", async () => {
    mockRequireUser.mockResolvedValue({
      id: "teacher-1",
      role: "TEACHER",
      isPlatformAdmin: false,
    });

    const response = await GET();
    expect(response.status).toBe(403);
  });
});
