import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireRole = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());
const mockGeneratePin = vi.hoisted(() => vi.fn());
const mockNormalizeCredentialPhone = vi.hoisted(() => vi.fn());
const mockSlugifyLoginSeed = vi.hoisted(() => vi.fn());
const mockHash = vi.hoisted(() => vi.fn());
const mockClassFindUnique = vi.hoisted(() => vi.fn());
const mockSchoolFindUnique = vi.hoisted(() => vi.fn());
const mockUserCount = vi.hoisted(() => vi.fn());
const mockUserFindFirst = vi.hoisted(() => vi.fn());
const mockUserFindUnique = vi.hoisted(() => vi.fn());
const mockUserCreate = vi.hoisted(() => vi.fn());
const mockStudentCreate = vi.hoisted(() => vi.fn());
const mockEnrollmentCreate = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  requireRole: mockRequireRole,
}));

vi.mock("@/lib/audit", () => ({
  logAudit: mockLogAudit,
}));

vi.mock("@/lib/credentials", () => ({
  generatePin: mockGeneratePin,
}));

vi.mock("@/lib/login-identifiers", () => ({
  normalizeCredentialPhone: mockNormalizeCredentialPhone,
  slugifyLoginSeed: mockSlugifyLoginSeed,
}));

vi.mock("bcryptjs", () => ({
  default: { hash: mockHash },
}));

const mockTransaction = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: {
    class: {
      findUnique: mockClassFindUnique,
    },
    school: {
      findUnique: mockSchoolFindUnique,
    },
    user: {
      count: mockUserCount,
      findFirst: mockUserFindFirst,
      findUnique: mockUserFindUnique,
      create: mockUserCreate,
    },
    student: {
      create: mockStudentCreate,
    },
    enrollment: {
      create: mockEnrollmentCreate,
    },
    $transaction: mockTransaction,
  },
}));

import { POST } from "@/app/api/admin/students/route";

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/admin/students", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/students", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireRole.mockResolvedValue({ id: "admin-1", role: "ADMIN", schoolId: "school-1" });
    mockClassFindUnique.mockResolvedValue({ id: "class-1", schoolId: "school-1" });
    mockSchoolFindUnique.mockResolvedValue({ id: "school-1", code: "CHA" });
    mockUserCount.mockResolvedValue(41);
    mockUserFindFirst.mockResolvedValue(null);
    mockUserFindUnique.mockResolvedValue(null);
    mockGeneratePin.mockReturnValue("123456");
    mockHash.mockResolvedValue("hashed-pin");
    mockNormalizeCredentialPhone.mockImplementation((value: string) => `norm:${value}`);
    mockSlugifyLoginSeed.mockImplementation((value: string) => value.toLowerCase());
    mockUserCreate.mockResolvedValue({
      id: "user-1",
      email: "student@example.lr",
      loginId: "LBR-2026-CHA-0042",
      name: "Martha Doe",
      guardianPhoneE164: "norm:+231770000000",
    });
    mockStudentCreate.mockResolvedValue({ id: "student-1", currentGrade: 6 });
    mockEnrollmentCreate.mockResolvedValue({ id: "enrollment-1" });
    mockLogAudit.mockResolvedValue(undefined);
    mockTransaction.mockImplementation(async (cb: any) => {
      const tx = {
        user: { create: mockUserCreate },
        student: { create: mockStudentCreate },
        enrollment: { create: mockEnrollmentCreate },
      };
      return cb(tx);
    });
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-13T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("generates LBR-YYYY-CODE-SEQUENCE from school code and student count", async () => {
    const response = await POST(
      makeRequest({
        firstName: "Martha",
        lastName: "Doe",
        grade: 6,
        classId: "class-1",
        phone: "+231770000000",
      })
    );

    expect(response.status).toBe(200);
    expect(mockUserCount).toHaveBeenCalledWith({ where: { schoolId: "school-1", role: "STUDENT" } });
    expect(mockUserCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          loginId: "LBR-2026-CHA-0042",
        }),
      })
    );
  });

  it("increments the sequence when the next generated ID already exists", async () => {
    mockUserFindFirst.mockResolvedValueOnce({ id: "existing-user" }).mockResolvedValueOnce(null);
    mockUserCreate.mockResolvedValue({
      id: "user-1",
      email: "student@example.lr",
      loginId: "LBR-2026-CHA-0043",
      name: "Martha Doe",
      guardianPhoneE164: null,
    });

    const response = await POST(
      makeRequest({
        firstName: "Martha",
        lastName: "Doe",
        grade: 6,
        classId: "class-1",
      })
    );

    expect(response.status).toBe(200);
    expect(mockUserFindFirst).toHaveBeenNthCalledWith(1, {
      where: { loginId: "LBR-2026-CHA-0042" },
      select: { id: true },
    });
    expect(mockUserFindFirst).toHaveBeenNthCalledWith(2, {
      where: { loginId: "LBR-2026-CHA-0043" },
      select: { id: true },
    });
  });

  it("returns 400 when the school has no configured code", async () => {
    mockSchoolFindUnique.mockResolvedValue({ id: "school-1", code: null });

    const response = await POST(
      makeRequest({
        firstName: "Martha",
        lastName: "Doe",
        grade: 6,
        classId: "class-1",
      })
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("School code is required");
    expect(mockUserCreate).not.toHaveBeenCalled();
  });
});
