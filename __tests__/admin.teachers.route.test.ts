import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireRole = vi.hoisted(() => vi.fn());
const mockUserFindMany = vi.hoisted(() => vi.fn());
const mockUserFindFirst = vi.hoisted(() => vi.fn());
const mockUserFindUnique = vi.hoisted(() => vi.fn());
const mockUserCreate = vi.hoisted(() => vi.fn());
const mockUserUpdate = vi.hoisted(() => vi.fn());
const mockTeacherProfileUpdate = vi.hoisted(() => vi.fn());
const mockHash = vi.hoisted(() => vi.fn());
const mockGeneratePin = vi.hoisted(() => vi.fn());
const mockNormalizePhone = vi.hoisted(() => vi.fn());
const mockNormalizeLoginId = vi.hoisted(() => vi.fn());
const mockSlugifyLoginSeed = vi.hoisted(() => vi.fn());
const mockTransaction = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ requireRole: mockRequireRole }));
vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findMany: mockUserFindMany,
      findFirst: mockUserFindFirst,
      findUnique: mockUserFindUnique,
      create: mockUserCreate,
      update: mockUserUpdate,
    },
    teacherProfile: {
      update: mockTeacherProfileUpdate,
    },
    $transaction: mockTransaction,
  },
}));
vi.mock("bcryptjs", () => ({ default: { hash: mockHash } }));
vi.mock("@/lib/credentials", () => ({ generatePin: mockGeneratePin }));
vi.mock("@/lib/login-identifiers", () => ({
  normalizeCredentialPhone: mockNormalizePhone,
  normalizeLoginId: mockNormalizeLoginId,
  slugifyLoginSeed: mockSlugifyLoginSeed,
}));

import { GET, PATCH, POST } from "@/app/api/admin/teachers/route";

function makeReq(method: string, body?: unknown) {
  return new Request("http://localhost/api/admin/teachers", {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireRole.mockResolvedValue({ id: "admin-1", role: "ADMIN", schoolId: "school-1" });
  mockHash.mockResolvedValue("hashed-pin");
  mockGeneratePin.mockReturnValue("123456");
  mockNormalizePhone.mockImplementation((value: string) => `norm-${value}`);
  mockNormalizeLoginId.mockImplementation((value: string) => value.toLowerCase());
  mockSlugifyLoginSeed.mockImplementation((value: string) => value.toLowerCase().replace(/\s+/g, "-"));
  mockUserFindFirst.mockResolvedValue(null);
  mockUserFindUnique.mockResolvedValue(null);
  mockTransaction.mockImplementation(async (cbOrArray: any) => {
    if (typeof cbOrArray === "function") {
      const tx = {
        user: { update: mockUserUpdate },
        teacherProfile: { update: mockTeacherProfileUpdate },
      };
      return cbOrArray(tx);
    }
    return Promise.all(cbOrArray);
  });
});

describe("GET /api/admin/teachers", () => {
  it("returns teacher roster rows with status and classes", async () => {
    mockUserFindMany.mockResolvedValue([
      {
        id: "teacher-1",
        name: "Mary Doe",
        email: "mary@example.com",
        loginId: "tch-2026-mary",
        guardianPhoneE164: "+231770000111",
        TeacherProfile: {
          fullName: "Mary Doe",
          phone: "+231770000111",
          permissions: { active: true, subjectSpecialty: "Math" },
        },
        teacherOf: [{ id: "class-1", name: "Grade 6 Math", subject: "MATH" }],
      },
    ]);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.teachers[0].name).toBe("Mary Doe");
    expect(body.teachers[0].status).toBe("ACTIVE");
    expect(body.teachers[0].classes).toHaveLength(1);
  });
});

describe("POST /api/admin/teachers", () => {
  it("creates a teacher and returns credentials payload", async () => {
    mockUserCreate.mockResolvedValue({
      id: "teacher-1",
      email: "mary@example.com",
      loginId: "tch-2026-mary",
      name: "Mary Doe",
      guardianPhoneE164: "norm-+231770000111",
    });

    const res = await POST(
      makeReq("POST", {
        fullName: "Mary Doe",
        phone: "+231770000111",
        subjectSpecialty: "Math",
      })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.userId).toBe("teacher-1");
    expect(body.tempPin).toBe("123456");
    expect(mockUserCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          role: "TEACHER",
        }),
      })
    );
  });
});

describe("PATCH /api/admin/teachers", () => {
  beforeEach(() => {
    mockUserFindFirst.mockResolvedValue({
      id: "teacher-1",
      email: "mary@example.com",
      loginId: "tch-2026-mary",
      guardianPhoneE164: "norm-+231770000111",
      TeacherProfile: {
        fullName: "Mary Doe",
        phone: "norm-+231770000111",
        permissions: { active: true, subjectSpecialty: "Math" },
      },
    });
  });

  it("deactivates a teacher", async () => {
    const res = await PATCH(makeReq("PATCH", { id: "teacher-1", action: "deactivate" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("INACTIVE");
    expect(mockTeacherProfileUpdate).toHaveBeenCalled();
  });

  it("resends invite by rotating the temp pin", async () => {
    const res = await PATCH(makeReq("PATCH", { id: "teacher-1", action: "resendInvite" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.tempPin).toBe("123456");
    expect(mockUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "teacher-1" },
      })
    );
  });
});
