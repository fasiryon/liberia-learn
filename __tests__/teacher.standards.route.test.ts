import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireRole = vi.hoisted(() => vi.fn());
const mockBuildStandardsBrowser = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ requireRole: mockRequireRole }));
vi.mock("@/lib/moe/standardsBrowser", () => ({ buildStandardsBrowser: mockBuildStandardsBrowser }));

import { GET } from "@/app/api/teacher/standards/route";

describe("GET /api/teacher/standards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires TEACHER or ADMIN role", async () => {
    mockRequireRole.mockRejectedValueOnce(Object.assign(new Error("Forbidden"), { status: 403 }));
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns the standards browser scoped to the requester's school", async () => {
    mockRequireRole.mockResolvedValue({ id: "teacher-1", role: "TEACHER", schoolId: "school-cha" });
    mockBuildStandardsBrowser.mockResolvedValue({ subjects: [], generatedAt: "2026-07-22T00:00:00.000Z" });

    const res = await GET();
    expect(res.status).toBe(200);
    expect(mockBuildStandardsBrowser).toHaveBeenCalledWith("school-cha");
  });

  it("passes null when the requester has no school context", async () => {
    mockRequireRole.mockResolvedValue({ id: "admin-1", role: "ADMIN", schoolId: null });
    mockBuildStandardsBrowser.mockResolvedValue({ subjects: [], generatedAt: "2026-07-22T00:00:00.000Z" });

    await GET();
    expect(mockBuildStandardsBrowser).toHaveBeenCalledWith(null);
  });
});
