/**
 * Sprint 16C: Student and Guardian Self-Registration
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────
const mockCheckRateLimit = vi.hoisted(() => vi.fn());
const mockRateLimitExceededResponse = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());
const mockLogLearningEvent = vi.hoisted(() => vi.fn());
const mockSendStudentWelcome = vi.hoisted(() => vi.fn());
const mockBcryptHash = vi.hoisted(() => vi.fn());

const mockSchoolFindUnique = vi.hoisted(() => vi.fn());
const mockUserFindFirst = vi.hoisted(() => vi.fn());
const mockClassFindFirst = vi.hoisted(() => vi.fn());
const mockStudentFindFirst = vi.hoisted(() => vi.fn());
const mockPrismaTransaction = vi.hoisted(() => vi.fn());

vi.mock("@/lib/rateLimit", () => ({
  checkRateLimit: mockCheckRateLimit,
  rateLimitExceededResponse: mockRateLimitExceededResponse,
  RATE_LIMIT_POLICIES: { AI_HEAVY: { windowMs: 3_600_000, student: 20, teacher: 50, admin: 100 } },
  getRateLimitHeaders: vi.fn(() => ({})),
}));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));
vi.mock("@/lib/events/logLearningEvent", () => ({ logLearningEvent: mockLogLearningEvent }));
vi.mock("@/lib/email", () => ({ sendStudentWelcome: mockSendStudentWelcome }));
vi.mock("bcryptjs", () => ({ default: { hash: mockBcryptHash } }));
vi.mock("@/lib/db", () => ({
  prisma: {
    school: { findUnique: mockSchoolFindUnique },
    user: { findFirst: mockUserFindFirst, create: vi.fn() },
    class: { findFirst: mockClassFindFirst },
    student: { findFirst: mockStudentFindFirst, create: vi.fn() },
    enrollment: { create: vi.fn() },
    studentGuardian: { create: vi.fn() },
    $transaction: mockPrismaTransaction,
  },
}));

import { POST as studentPOST } from "@/app/api/register/student/route";
import { POST as guardianPOST } from "@/app/api/register/guardian/route";

// ── Test helpers ──────────────────────────────────────────────────────────────
function makeStudentRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/register/student", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as any;
}

function makeGuardianRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/register/guardian", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as any;
}

const ACTIVE_SCHOOL = { id: "school-1", name: "CHA Demo School", status: "ACTIVE" };
const VALID_STUDENT_BODY = {
  fullName: "James Kollie",
  dateOfBirth: "2010-06-15",
  grade: "7",
  schoolCode: "LIB-MONT-AB12",
  email: "james@cha.edu.lr",
  phone: "",
  password: "SecurePass1",
  confirmPassword: "SecurePass1",
};
const VALID_GUARDIAN_BODY = {
  fullName: "Mary Kollie",
  email: "mary@family.lr",
  phone: "",
  schoolCode: "LIB-MONT-AB12",
  studentFullName: "James Kollie",
  studentDateOfBirth: "2010-06-15",
  password: "GuardianPass1",
  confirmPassword: "GuardianPass1",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 9, resetAt: Date.now() + 3600000, limit: 10, retryAfter: 0, backend: "memory", scope: "instance", namespace: "reg" });
  mockBcryptHash.mockResolvedValue("$2b$10$hashed");
  mockLogAudit.mockResolvedValue(undefined);
  mockLogLearningEvent.mockResolvedValue(undefined);
  mockSendStudentWelcome.mockResolvedValue({ ok: true });
});

// ── Student registration ──────────────────────────────────────────────────────
describe("POST /api/register/student", () => {
  it("creates student in correct school when school code is valid", async () => {
    mockSchoolFindUnique.mockResolvedValue(ACTIVE_SCHOOL);
    mockUserFindFirst.mockResolvedValue(null); // no duplicate
    mockClassFindFirst.mockResolvedValue({ id: "class-1" });
    mockPrismaTransaction.mockImplementation(async (fn: Function) => {
      return fn({
        user: { create: vi.fn().mockResolvedValue({ id: "user-1", email: "james@cha.edu.lr", loginId: "JAMES-KOLLIE" }) },
        student: { create: vi.fn().mockResolvedValue({ id: "student-1" }), findUnique: vi.fn().mockResolvedValue(null) },
        enrollment: { create: vi.fn().mockResolvedValue({}) },
      });
    });

    const res = await studentPOST(makeStudentRequest(VALID_STUDENT_BODY));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.loginId).toBe("JAMES-KOLLIE");
    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "USER_CREATED" }));
    expect(mockLogLearningEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: "STUDENT_SELF_REGISTERED" }));
  });

  it("rejects invalid school code", async () => {
    mockSchoolFindUnique.mockResolvedValue(null);

    const res = await studentPOST(makeStudentRequest(VALID_STUDENT_BODY));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/invalid or inactive school code/i);
  });

  it("rejects inactive school code", async () => {
    mockSchoolFindUnique.mockResolvedValue({ id: "school-1", name: "Old School", status: "PENDING" });

    const res = await studentPOST(makeStudentRequest(VALID_STUDENT_BODY));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/invalid or inactive school code/i);
  });

  it("rejects duplicate email with clear error", async () => {
    mockSchoolFindUnique.mockResolvedValue(ACTIVE_SCHOOL);
    mockUserFindFirst.mockResolvedValue({ id: "existing-user" }); // duplicate

    const res = await studentPOST(makeStudentRequest(VALID_STUDENT_BODY));
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.error).toMatch(/email already exists/i);
  });

  it("rejects password shorter than 8 characters", async () => {
    const res = await studentPOST(makeStudentRequest({ ...VALID_STUDENT_BODY, password: "short", confirmPassword: "short" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/8 characters/i);
  });

  it("rejects mismatched passwords", async () => {
    const res = await studentPOST(makeStudentRequest({ ...VALID_STUDENT_BODY, confirmPassword: "DifferentPass" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/do not match/i);
  });

  it("rejects grade out of range", async () => {
    const res = await studentPOST(makeStudentRequest({ ...VALID_STUDENT_BODY, grade: "13" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/grade/i);
  });

  it("enforces rate limit", async () => {
    mockCheckRateLimit.mockResolvedValue({ allowed: false, remaining: 0, resetAt: Date.now() + 3600000, limit: 10, retryAfter: 3600, backend: "memory", scope: "instance", namespace: "reg" });
    mockRateLimitExceededResponse.mockReturnValue(new Response(JSON.stringify({ error: "Too many requests" }), { status: 429 }));

    const res = await studentPOST(makeStudentRequest(VALID_STUDENT_BODY));
    expect(res.status).toBe(429);
  });

  it("sends welcome email when email is provided", async () => {
    mockSchoolFindUnique.mockResolvedValue(ACTIVE_SCHOOL);
    mockUserFindFirst.mockResolvedValue(null);
    mockClassFindFirst.mockResolvedValue(null);
    mockPrismaTransaction.mockImplementation(async (fn: Function) => {
      return fn({
        user: { create: vi.fn().mockResolvedValue({ id: "user-1", email: "james@cha.edu.lr", loginId: "JAMES-KOLLIE" }) },
        student: { create: vi.fn().mockResolvedValue({ id: "student-1" }), findUnique: vi.fn().mockResolvedValue(null) },
        enrollment: { create: vi.fn().mockResolvedValue({}) },
      });
    });

    await studentPOST(makeStudentRequest(VALID_STUDENT_BODY));
    expect(mockSendStudentWelcome).toHaveBeenCalledWith(expect.objectContaining({ to: "james@cha.edu.lr" }));
  });

  it("does not send welcome email when no email provided", async () => {
    mockSchoolFindUnique.mockResolvedValue(ACTIVE_SCHOOL);
    mockUserFindFirst.mockResolvedValue(null);
    mockClassFindFirst.mockResolvedValue(null);
    mockPrismaTransaction.mockImplementation(async (fn: Function) => {
      return fn({
        user: { create: vi.fn().mockResolvedValue({ id: "user-1", email: "james-kollie@no-email.liberialearn.internal", loginId: "JAMES-KOLLIE" }) },
        student: { create: vi.fn().mockResolvedValue({ id: "student-1" }), findUnique: vi.fn().mockResolvedValue(null) },
        enrollment: { create: vi.fn().mockResolvedValue({}) },
      });
    });

    await studentPOST(makeStudentRequest({ ...VALID_STUDENT_BODY, email: "" }));
    expect(mockSendStudentWelcome).not.toHaveBeenCalled();
  });
});

// ── Guardian registration ─────────────────────────────────────────────────────
describe("POST /api/register/guardian", () => {
  it("creates guardian account linked to student when name + DOB + school code match", async () => {
    mockSchoolFindUnique.mockResolvedValue(ACTIVE_SCHOOL);
    mockUserFindFirst.mockResolvedValue(null);
    mockStudentFindFirst.mockResolvedValue({ id: "student-1", userId: "user-1" });
    mockPrismaTransaction.mockImplementation(async (fn: Function) => {
      return fn({
        user: { create: vi.fn().mockResolvedValue({ id: "guardian-1", loginId: "MARY-KOLLIE" }) },
        studentGuardian: { create: vi.fn().mockResolvedValue({}) },
      });
    });

    const res = await guardianPOST(makeGuardianRequest(VALID_GUARDIAN_BODY));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.loginId).toBe("MARY-KOLLIE");
    expect(mockLogLearningEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: "GUARDIAN_SELF_REGISTERED" }));
  });

  it("returns same error for school code mismatch as student mismatch — no enumeration", async () => {
    mockSchoolFindUnique.mockResolvedValue(null); // school not found

    const res = await guardianPOST(makeGuardianRequest(VALID_GUARDIAN_BODY));
    expect(res.status).toBe(400);
    const data = await res.json();
    // Must NOT say "school not found" — same message as student mismatch
    expect(data.error).toMatch(/could not verify student details/i);
  });

  it("returns same error when student name/DOB does not match — no existence leak", async () => {
    mockSchoolFindUnique.mockResolvedValue(ACTIVE_SCHOOL);
    mockUserFindFirst.mockResolvedValue(null);
    mockStudentFindFirst.mockResolvedValue(null); // no match

    const res = await guardianPOST(makeGuardianRequest(VALID_GUARDIAN_BODY));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/could not verify student details/i);
    // Critically, the error does NOT reveal student existence
    expect(data.error).not.toMatch(/student not found/i);
    expect(data.error).not.toMatch(/no student/i);
  });

  it("rejects when neither email nor phone is provided", async () => {
    const res = await guardianPOST(makeGuardianRequest({ ...VALID_GUARDIAN_BODY, email: "", phone: "" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/email or phone/i);
  });

  it("rejects duplicate guardian email", async () => {
    mockSchoolFindUnique.mockResolvedValue(ACTIVE_SCHOOL);
    mockUserFindFirst.mockResolvedValue({ id: "existing" }); // duplicate

    const res = await guardianPOST(makeGuardianRequest(VALID_GUARDIAN_BODY));
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.error).toMatch(/email already exists/i);
  });

  it("enforces rate limit", async () => {
    mockCheckRateLimit.mockResolvedValue({ allowed: false, remaining: 0, resetAt: Date.now() + 3600000, limit: 10, retryAfter: 3600, backend: "memory", scope: "instance", namespace: "reg" });
    mockRateLimitExceededResponse.mockReturnValue(new Response(JSON.stringify({ error: "Too many requests" }), { status: 429 }));

    const res = await guardianPOST(makeGuardianRequest(VALID_GUARDIAN_BODY));
    expect(res.status).toBe(429);
  });
});
