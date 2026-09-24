import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockRequireRole, mockFindUnique } = vi.hoisted(() => ({
  mockRequireRole: vi.fn(),
  mockFindUnique: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireRole: mockRequireRole }));
vi.mock("@/lib/db", () => ({ prisma: { offlinePack: { findUnique: mockFindUnique } } }));

import { GET } from "@/app/api/packs/[packId]/download/route";

const READY_PACK = {
  blobUrl: "https://blob.example/offline-packs/teacher-1/pack-1.zip",
  requestedById: "teacher-1",
  status: "ready",
  weekStart: new Date("2026-12-01T00:00:00Z"),
};

describe("GET /api/packs/[packId]/download — ownership (hostile)", () => {
  const fetchSpy = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchSpy);
    fetchSpy.mockResolvedValue(new Response("zip-bytes", { status: 200 }));
    mockFindUnique.mockResolvedValue(READY_PACK);
  });

  it.each([
    ["TEACHER", "teacher-9"],
    ["ADMIN", "admin-9"],
    ["STUDENT", "student-9"],
  ])("%s who did not request the pack cannot download it", async (role, id) => {
    mockRequireRole.mockResolvedValueOnce({ id, role, schoolId: "school-9" });
    const res = await GET(new Request("http://localhost/x"), { params: { packId: "pack-1" } });
    expect(res.status).toBe(404);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("the requester can download their own ready pack", async () => {
    mockRequireRole.mockResolvedValueOnce({ id: "teacher-1", role: "TEACHER", schoolId: "school-1" });
    const res = await GET(new Request("http://localhost/x"), { params: { packId: "pack-1" } });
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });
});
