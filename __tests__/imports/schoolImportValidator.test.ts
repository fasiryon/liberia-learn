import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Hoisted mocks ───────────────────────────────────────────────────────────

const mockRequireRole = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());
const mockCreateStudentImportBatch = vi.hoisted(() => vi.fn());
const mockGeneratePin = vi.hoisted(() => vi.fn());
const mockNormalizeCredentialPhone = vi.hoisted(() => vi.fn());
const mockNormalizeLoginId = vi.hoisted(() => vi.fn());
const mockSlugifyLoginSeed = vi.hoisted(() => vi.fn());
const mockBcryptHash = vi.hoisted(() => vi.fn());
const mockHandleApiError = vi.hoisted(() =>
  vi.fn((err: any) =>
    new Response(JSON.stringify({ error: err.message ?? "error" }), {
      status: err.status ?? 500,
    })
  )
);

const mockStudentFindFirst = vi.hoisted(() => vi.fn());
const mockUserFindFirst = vi.hoisted(() => vi.fn());
const mockUserCreate = vi.hoisted(() => vi.fn());
const mockStudentGuardianUpsert = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ requireRole: mockRequireRole }));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));
vi.mock("@/lib/errors/apiErrorHandler", () => ({
  handleApiError: mockHandleApiError,
}));
vi.mock("@/lib/school-operations", () => ({
  createStudentImportBatch: mockCreateStudentImportBatch,
}));
vi.mock("@/lib/credentials", () => ({ generatePin: mockGeneratePin }));
vi.mock("@/lib/login-identifiers", () => ({
  normalizeCredentialPhone: mockNormalizeCredentialPhone,
  normalizeLoginId: mockNormalizeLoginId,
  slugifyLoginSeed: mockSlugifyLoginSeed,
}));
vi.mock("bcryptjs", () => ({ default: { hash: mockBcryptHash } }));
vi.mock("@/lib/records/systemOfRecord", () => ({
  resolveAdminSchoolScope: vi.fn((user: any, schoolId?: string) => {
    if (!user.schoolId && !schoolId)
      throw Object.assign(new Error("schoolId required"), { status: 400 });
    return schoolId ?? user.schoolId;
  }),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    student: { findFirst: mockStudentFindFirst },
    user: { findFirst: mockUserFindFirst, create: mockUserCreate },
    studentGuardian: { upsert: mockStudentGuardianUpsert },
  },
}));

// ─── Imports (after mocks) ───────────────────────────────────────────────────

import {
  validateStudentRows,
  validateTeacherRows,
  validateGuardianRows,
  buildErrorCsv,
  type ImportRow,
} from "@/lib/imports/schoolImportValidator";

import { POST as validatePost } from "@/app/api/admin/import/validate/route";
import { POST as confirmPost } from "@/app/api/admin/import/confirm/route";
import { GET as templateGet } from "@/app/api/admin/import/template/[importType]/route";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ADMIN_USER = {
  id: "admin-1",
  role: "ADMIN",
  schoolId: "school-1",
  isPlatformAdmin: false,
};

function makePost(url: string, body: unknown) {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as any;
}

// ─── validateStudentRows ─────────────────────────────────────────────────────

describe("validateStudentRows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStudentFindFirst.mockResolvedValue(null);
  });

  it("passes valid rows through", async () => {
    const rows: ImportRow[] = [
      {
        firstName: "Fatu",
        lastName: "Kollie",
        grade: "7",
        dateOfBirth: "2012-03-15",
        guardianPhone: "+231770123456",
      },
      {
        firstName: "Emmanuel",
        lastName: "Pewu",
        grade: "9",
        dateOfBirth: "2010-07-22",
        guardianPhone: "+231880234567",
      },
    ];

    const result = await validateStudentRows(rows, "school-1");

    expect(result.valid).toHaveLength(2);
    expect(result.invalid).toHaveLength(0);
    expect(result.summary.validCount).toBe(2);
    expect(result.summary.invalidCount).toBe(0);
  });

  it("returns clear error for missing required column", async () => {
    // rows without 'grade' column
    const rows: ImportRow[] = [
      { firstName: "Fatu", lastName: "Kollie", dateOfBirth: "2012-03-15" },
    ];

    const result = await validateStudentRows(rows, "school-1");

    expect(result.valid).toHaveLength(0);
    expect(result.invalid).toHaveLength(1);
    expect(result.invalid[0].errors[0]).toMatch(/missing.*'grade'/i);
  });

  it("returns clear error when grade is outside 1-12", async () => {
    const rows: ImportRow[] = [
      {
        firstName: "Boima",
        lastName: "Nimely",
        grade: "13",
        dateOfBirth: "2006-06-12",
      },
    ];

    const result = await validateStudentRows(rows, "school-1");

    expect(result.invalid).toHaveLength(1);
    expect(result.invalid[0].errors[0]).toMatch(/grade.*13.*not valid/i);
  });

  it("returns clear error with example for invalid date format", async () => {
    const rows: ImportRow[] = [
      {
        firstName: "Musu",
        lastName: "Varney",
        grade: "8",
        dateOfBirth: "15-03-2012",
      },
    ];

    const result = await validateStudentRows(rows, "school-1");

    expect(result.invalid).toHaveLength(1);
    const errMsg = result.invalid[0].errors[0];
    expect(errMsg).toMatch(/YYYY-MM-DD/);
    expect(errMsg).toMatch(/2012-03-15/); // example in error
  });

  it("detects within-CSV duplicates (same name + DOB)", async () => {
    const rows: ImportRow[] = [
      {
        firstName: "Fatu",
        lastName: "Kollie",
        grade: "7",
        dateOfBirth: "2012-03-15",
      },
      {
        firstName: "Fatu",
        lastName: "Kollie",
        grade: "7",
        dateOfBirth: "2012-03-15",
      },
    ];

    const result = await validateStudentRows(rows, "school-1");

    // First row valid, second flagged as duplicate
    expect(result.invalid).toHaveLength(1);
    expect(result.invalid[0].errors[0]).toMatch(/appears more than once/i);
  });

  it("detects DB duplicate at same school", async () => {
    mockStudentFindFirst.mockResolvedValueOnce({ id: "existing-student" });

    const rows: ImportRow[] = [
      {
        firstName: "Fatu",
        lastName: "Kollie",
        grade: "7",
        dateOfBirth: "2012-03-15",
      },
    ];

    const result = await validateStudentRows(rows, "school-1");

    expect(result.valid).toHaveLength(0);
    expect(result.invalid).toHaveLength(1);
    expect(result.invalid[0].errors[0]).toMatch(/already enrolled/i);
  });

  it("does not flag student from a different school as duplicate (tenant scoping)", async () => {
    // DB check uses schoolId in WHERE — mock returns null for school-1 (no match)
    mockStudentFindFirst.mockImplementation(({ where }: any) => {
      if (where.user?.schoolId === "school-1") return Promise.resolve(null);
      return Promise.resolve({ id: "other-school-student" });
    });

    const rows: ImportRow[] = [
      {
        firstName: "Fatu",
        lastName: "Kollie",
        grade: "7",
        dateOfBirth: "2012-03-15",
      },
    ];

    const result = await validateStudentRows(rows, "school-1");

    expect(result.valid).toHaveLength(1);
    expect(result.invalid).toHaveLength(0);
  });
});

// ─── validateTeacherRows ─────────────────────────────────────────────────────

describe("validateTeacherRows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserFindFirst.mockResolvedValue(null);
  });

  it("passes valid teacher rows through", async () => {
    const rows: ImportRow[] = [
      {
        firstName: "Mulbah",
        lastName: "Sirleaf",
        email: "mulbah.sirleaf@school.edu.lr",
        subject: "MATH",
      },
    ];

    const result = await validateTeacherRows(rows, "school-1");

    expect(result.valid).toHaveLength(1);
    expect(result.invalid).toHaveLength(0);
  });

  it("returns clear error for invalid subject", async () => {
    const rows: ImportRow[] = [
      {
        firstName: "Alice",
        lastName: "Johnson",
        email: "alice@school.edu.lr",
        subject: "ENGLISH",
      },
    ];

    const result = await validateTeacherRows(rows, "school-1");

    expect(result.invalid).toHaveLength(1);
    expect(result.invalid[0].errors[0]).toMatch(/subject.*ENGLISH.*not valid/i);
    expect(result.invalid[0].errors[0]).toMatch(/MATH/); // lists valid options
  });

  it("detects duplicate teacher email within the same CSV", async () => {
    const rows: ImportRow[] = [
      {
        firstName: "Alice",
        lastName: "Johnson",
        email: "alice@school.edu.lr",
        subject: "MATH",
      },
      {
        firstName: "Alice",
        lastName: "Smith",
        email: "alice@school.edu.lr",
        subject: "SCIENCE",
      },
    ];

    const result = await validateTeacherRows(rows, "school-1");

    expect(result.invalid).toHaveLength(1);
    expect(result.invalid[0].errors[0]).toMatch(/appears more than once/i);
    expect(result.summary.duplicateEmails).toContain("alice@school.edu.lr");
  });

  it("flags DB duplicate teacher at same school", async () => {
    mockUserFindFirst.mockResolvedValueOnce({ id: "existing-teacher" });

    const rows: ImportRow[] = [
      {
        firstName: "Mary",
        lastName: "Pewee",
        email: "mary.pewee@school.edu.lr",
        subject: "LITERACY",
      },
    ];

    const result = await validateTeacherRows(rows, "school-1");

    expect(result.valid).toHaveLength(0);
    expect(result.invalid).toHaveLength(1);
    expect(result.invalid[0].errors[0]).toMatch(/already exists at this school/i);
  });

  it("does not flag teacher from a different school as duplicate", async () => {
    // DB check uses schoolId — returns null for school-1
    mockUserFindFirst.mockImplementation(({ where }: any) => {
      if (where.schoolId === "school-1") return Promise.resolve(null);
      return Promise.resolve({ id: "teacher-at-other-school" });
    });

    const rows: ImportRow[] = [
      {
        firstName: "Mary",
        lastName: "Pewee",
        email: "mary.pewee@school.edu.lr",
        subject: "LITERACY",
      },
    ];

    const result = await validateTeacherRows(rows, "school-1");

    expect(result.valid).toHaveLength(1);
    expect(result.invalid).toHaveLength(0);
  });
});

// ─── validateGuardianRows ─────────────────────────────────────────────────────

describe("validateGuardianRows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserFindFirst.mockResolvedValue(null);
    mockStudentFindFirst.mockResolvedValue(null);
  });

  it("links to matching student (no warning when student found)", async () => {
    mockStudentFindFirst.mockResolvedValueOnce({ id: "student-1" });

    const rows: ImportRow[] = [
      {
        firstName: "Joy",
        lastName: "Gongloe",
        email: "joy@email.com",
        studentFirstName: "Mary",
        studentLastName: "Gongloe",
        relationship: "Mother",
      },
    ];

    const result = await validateGuardianRows(rows, "school-1");

    expect(result.valid).toHaveLength(1);
    expect(result.summary.warnings).toHaveLength(0);
  });

  it("imports with warning when student not found", async () => {
    // user findFirst (dup guardian check) returns null; student findFirst returns null
    mockUserFindFirst.mockResolvedValueOnce(null);
    mockStudentFindFirst.mockResolvedValueOnce(null);

    const rows: ImportRow[] = [
      {
        firstName: "Isaac",
        lastName: "Pewu",
        email: "isaac@email.com",
        studentFirstName: "Emmanuel",
        studentLastName: "Pewu",
        relationship: "Father",
      },
    ];

    const result = await validateGuardianRows(rows, "school-1");

    expect(result.valid).toHaveLength(1); // still valid, just a warning
    expect(result.summary.warnings).toHaveLength(1);
    expect(result.summary.warnings[0]).toMatch(/imported without a student link/i);
  });

  it("catches duplicate guardian email in DB", async () => {
    mockUserFindFirst.mockResolvedValueOnce({ id: "existing-guardian" });

    const rows: ImportRow[] = [
      {
        firstName: "Joy",
        lastName: "Gongloe",
        email: "joy@email.com",
        studentFirstName: "Mary",
        studentLastName: "Gongloe",
        relationship: "Mother",
      },
    ];

    const result = await validateGuardianRows(rows, "school-1");

    expect(result.valid).toHaveLength(0);
    expect(result.invalid).toHaveLength(1);
    expect(result.invalid[0].errors[0]).toMatch(/already registered/i);
  });
});

// ─── buildErrorCsv ───────────────────────────────────────────────────────────

describe("buildErrorCsv", () => {
  it("produces CSV with error_reason appended column", () => {
    const headers = ["firstName", "lastName", "grade"];
    const invalid = [
      {
        row: { firstName: "Fatu", lastName: "Kollie", grade: "99" },
        rowNumber: 2,
        errors: ["Grade '99' is not valid. Use a number from 1 to 12."],
      },
    ];

    const csv = buildErrorCsv(headers, invalid);
    const lines = csv.split("\n");

    expect(lines[0]).toBe("firstName,lastName,grade,error_reason");
    expect(lines[1]).toMatch(/Fatu/);
    expect(lines[1]).toMatch(/error_reason|Grade '99'/i);
  });
});

// ─── POST /api/admin/import/validate ─────────────────────────────────────────

describe("POST /api/admin/import/validate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStudentFindFirst.mockResolvedValue(null);
    mockUserFindFirst.mockResolvedValue(null);
  });

  it("returns validation result without writing to DB", async () => {
    mockRequireRole.mockResolvedValueOnce(ADMIN_USER);

    const res = await validatePost(
      makePost("http://localhost/api/admin/import/validate", {
        importType: "students",
        schoolId: "school-1",
        rows: [
          {
            firstName: "Fatu",
            lastName: "Kollie",
            grade: "7",
            dateOfBirth: "2012-03-15",
          },
        ],
      })
    );

    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.result).toBeDefined();
    expect(data.result.summary.total).toBe(1);
    // No create calls
    expect(mockUserCreate).not.toHaveBeenCalled();
    expect(mockCreateStudentImportBatch).not.toHaveBeenCalled();
  });

  it("rejects non-admin with 403", async () => {
    mockRequireRole.mockRejectedValueOnce(
      Object.assign(new Error("Forbidden"), { status: 403 })
    );

    const res = await validatePost(
      makePost("http://localhost/api/admin/import/validate", {
        importType: "students",
        schoolId: "school-1",
        rows: [{ firstName: "x", lastName: "y", grade: "7", dateOfBirth: "2012-01-01" }],
      })
    );

    expect(res.status).toBe(403);
  });
});

// ─── POST /api/admin/import/confirm ──────────────────────────────────────────

describe("POST /api/admin/import/confirm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStudentFindFirst.mockResolvedValue(null);
    mockUserFindFirst.mockResolvedValue(null);
    mockGeneratePin.mockReturnValue("1234");
    mockBcryptHash.mockResolvedValue("hashed-pin");
    mockSlugifyLoginSeed.mockReturnValue("fatu-kollie");
    mockNormalizeLoginId.mockReturnValue("tch-2026-fatu-kollie");
    mockNormalizeCredentialPhone.mockReturnValue("+231770000000");
  });

  it("calls createStudentImportBatch for valid student rows", async () => {
    mockRequireRole.mockResolvedValueOnce(ADMIN_USER);
    mockCreateStudentImportBatch.mockResolvedValueOnce({ batchId: "batch-1" });

    const res = await confirmPost(
      makePost("http://localhost/api/admin/import/confirm", {
        importType: "students",
        schoolId: "school-1",
        rows: [
          {
            firstName: "Fatu",
            lastName: "Kollie",
            grade: "7",
            dateOfBirth: "2012-03-15",
          },
        ],
      })
    );

    const data = await res.json();
    expect(res.status).toBe(200);
    expect(mockCreateStudentImportBatch).toHaveBeenCalledOnce();
    expect(data.imported).toBe(1);
    expect(data.skipped).toBe(0);
  });

  it("skips invalid rows and only writes valid ones", async () => {
    mockRequireRole.mockResolvedValueOnce(ADMIN_USER);
    mockCreateStudentImportBatch.mockResolvedValueOnce({ batchId: "batch-2" });

    const res = await confirmPost(
      makePost("http://localhost/api/admin/import/confirm", {
        importType: "students",
        schoolId: "school-1",
        rows: [
          // valid
          {
            firstName: "Fatu",
            lastName: "Kollie",
            grade: "7",
            dateOfBirth: "2012-03-15",
          },
          // invalid grade
          {
            firstName: "Bad",
            lastName: "Row",
            grade: "99",
            dateOfBirth: "2012-03-15",
          },
        ],
      })
    );

    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.imported).toBe(1);
    expect(data.skipped).toBe(1);
    expect(data.failedRowsCsv).toBeTruthy();
  });

  it("rejects non-admin with 403", async () => {
    mockRequireRole.mockRejectedValueOnce(
      Object.assign(new Error("Forbidden"), { status: 403 })
    );

    const res = await confirmPost(
      makePost("http://localhost/api/admin/import/confirm", {
        importType: "students",
        schoolId: "school-1",
        rows: [{ firstName: "x", lastName: "y", grade: "7", dateOfBirth: "2012-01-01" }],
      })
    );

    expect(res.status).toBe(403);
  });
});

// ─── GET /api/admin/import/template/[importType] ─────────────────────────────

describe("GET /api/admin/import/template/:importType", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns students CSV template with correct headers", async () => {
    mockRequireRole.mockResolvedValueOnce(ADMIN_USER);

    const res = await templateGet(
      { nextUrl: new URL("http://localhost/api/admin/import/template/students") } as any,
      { params: { importType: "students" } }
    );

    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toMatch(/firstName,lastName,grade,dateOfBirth/);
  });

  it("returns teachers CSV template with correct headers", async () => {
    mockRequireRole.mockResolvedValueOnce(ADMIN_USER);

    const res = await templateGet(
      { nextUrl: new URL("http://localhost/api/admin/import/template/teachers") } as any,
      { params: { importType: "teachers" } }
    );

    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toMatch(/firstName,lastName,email,subject/);
  });

  it("returns 400 for unknown import type", async () => {
    mockRequireRole.mockResolvedValueOnce(ADMIN_USER);

    const res = await templateGet(
      { nextUrl: new URL("http://localhost/api/admin/import/template/unknown") } as any,
      { params: { importType: "unknown" } }
    );

    expect(res.status).toBe(400);
  });

  it("rejects non-admin with 403", async () => {
    mockRequireRole.mockRejectedValueOnce(
      Object.assign(new Error("Forbidden"), { status: 403 })
    );

    const res = await templateGet(
      { nextUrl: new URL("http://localhost/api/admin/import/template/students") } as any,
      { params: { importType: "students" } }
    );

    expect(res.status).toBe(403);
  });
});
