import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireRole = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());
const mockFindUnique = vi.hoisted(() => vi.fn());
const mockUpsert = vi.hoisted(() => vi.fn());
const mockStandardFindMany = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ requireRole: mockRequireRole }));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));
vi.mock("@/lib/db", () => ({
  prisma: {
    school: { findUnique: mockFindUnique },
    curriculumContent: { upsert: mockUpsert },
    standard: { findMany: mockStandardFindMany },
  },
}));

import { POST } from "@/app/api/admin/curriculum/generate-full-pack/route";

const ADMIN_USER = { id: "user-1", role: "ADMIN", schoolId: "school-1" };
const MOCK_RECORD = { id: "rec-1", contentId: "full_pack-math-g4-fractions" };

function makeReq(body: object) {
  return new Request("http://localhost/api/admin/curriculum/generate-full-pack", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("generate-full-pack — MOE code auto-lookup (ACTION-9)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireRole.mockResolvedValue(ADMIN_USER);
    mockLogAudit.mockResolvedValue(undefined);
    mockFindUnique.mockResolvedValue(null);
    mockUpsert.mockResolvedValue(MOCK_RECORD);
    mockStandardFindMany.mockResolvedValue([]);
  });

  it("queries Standard table when moeAlignmentCodes not provided", async () => {
    mockStandardFindMany.mockResolvedValueOnce([
      { code: "LR-MATH-G4_6-01" },
      { code: "LR-MATH-G4_6-02" },
    ]);

    const res = await POST(makeReq({ grade: 4, subject: "MATH", topic: "Fractions" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(mockStandardFindMany).toHaveBeenCalledOnce();
    const call = mockStandardFindMany.mock.calls[0][0];
    expect(call.where.subject).toBe("MATH");
    expect(call.where.band).toBe("G4_6"); // gradeToBand(4) = G4_6
  });

  it("queries correct band for grade 1 → G1_3", async () => {
    await POST(makeReq({ grade: 1, subject: "LITERACY", topic: "Alphabet" }));

    const call = mockStandardFindMany.mock.calls[0][0];
    expect(call.where.band).toBe("G1_3");
  });

  it("queries correct band for grade 10 → G10_12", async () => {
    await POST(makeReq({ grade: 10, subject: "MATH", topic: "Quadratics" }));

    const call = mockStandardFindMany.mock.calls[0][0];
    expect(call.where.band).toBe("G10_12");
  });

  it("does NOT query Standard table when caller provides moeAlignmentCodes", async () => {
    const res = await POST(
      makeReq({
        grade: 5,
        subject: "SCIENCE",
        topic: "Ecosystems",
        moeAlignmentCodes: ["LR-SCI-G4_6-01"],
      })
    );

    expect(res.status).toBe(200);
    expect(mockStandardFindMany).not.toHaveBeenCalled();
  });

  it("returns 200 even when Standard table returns empty (no codes for subject)", async () => {
    mockStandardFindMany.mockResolvedValueOnce([]);

    const res = await POST(makeReq({ grade: 7, subject: "CIVICS", topic: "Government" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
  });
});
