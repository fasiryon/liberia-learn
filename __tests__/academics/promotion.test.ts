import { beforeEach, describe, expect, it, vi } from "vitest";

const mockStudentFindFirst = vi.hoisted(() => vi.fn());
const mockEnrollmentFindFirst = vi.hoisted(() => vi.fn());
const mockEnrollmentFindMany = vi.hoisted(() => vi.fn());
const mockEnrollmentUpdate = vi.hoisted(() => vi.fn());
const mockEnrollmentCreate = vi.hoisted(() => vi.fn());
const mockStudentUpdate = vi.hoisted(() => vi.fn());
const mockTranscriptUpsert = vi.hoisted(() => vi.fn());
const mockTransaction = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: {
    student: {
      findFirst: mockStudentFindFirst,
      update: mockStudentUpdate,
    },
    academicEnrollment: {
      findFirst: mockEnrollmentFindFirst,
      findMany: mockEnrollmentFindMany,
      update: mockEnrollmentUpdate,
      create: mockEnrollmentCreate,
    },
    transcript: { upsert: mockTranscriptUpsert },
    $transaction: mockTransaction,
  },
}));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));

import {
  previewPromotions,
  promoteStudents,
  retainStudents,
  graduateStudents,
} from "@/lib/academics/promotion";

function makeTx() {
  return {
    academicEnrollment: {
      update: mockEnrollmentUpdate,
      create: mockEnrollmentCreate,
      upsert: vi.fn().mockResolvedValue({}),
    },
    student: { update: mockStudentUpdate },
    transcript: { upsert: mockTranscriptUpsert },
  };
}

const SCHOOL = "school-1";
const SOURCE_YEAR = "year-2025";
const TARGET_YEAR = "year-2026";
const STUDENT_1 = "student-1";
const STUDENT_12 = "student-12";
const ACTOR = "admin-1";

const ACTIVE_ENROLLMENT_G1 = {
  id: "enr-1",
  studentId: STUDENT_1,
  schoolId: SCHOOL,
  academicYearId: SOURCE_YEAR,
  grade: 1,
  status: "ACTIVE",
  promotedAt: null,
};

const ACTIVE_ENROLLMENT_G12 = {
  id: "enr-12",
  studentId: STUDENT_12,
  schoolId: SCHOOL,
  academicYearId: SOURCE_YEAR,
  grade: 12,
  status: "ACTIVE",
  promotedAt: null,
};

describe("previewPromotions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns candidates without writing to database", async () => {
    mockEnrollmentFindMany.mockResolvedValueOnce([
      {
        ...ACTIVE_ENROLLMENT_G1,
        student: { user: { name: "Alice", email: "alice@school.lr" } },
      },
    ]);
    const result = await previewPromotions(SCHOOL, SOURCE_YEAR);
    expect(result).toHaveLength(1);
    expect(result[0].currentGrade).toBe(1);
    expect(result[0].nextGrade).toBe(2);
    expect(result[0].willGraduate).toBe(false);
    expect(mockEnrollmentUpdate).not.toHaveBeenCalled();
    expect(mockEnrollmentCreate).not.toHaveBeenCalled();
  });

  it("flags Grade 12 students as graduating", async () => {
    mockEnrollmentFindMany.mockResolvedValueOnce([
      {
        ...ACTIVE_ENROLLMENT_G12,
        student: { user: { name: "Bob", email: "bob@school.lr" } },
      },
    ]);
    const result = await previewPromotions(SCHOOL, SOURCE_YEAR);
    expect(result[0].willGraduate).toBe(true);
    expect(result[0].nextGrade).toBe(12);
  });
});

describe("promoteStudents", () => {
  beforeEach(() => vi.clearAllMocks());

  it("promotes Grade 1 student to Grade 2 and updates student.currentGrade", async () => {
    mockStudentFindFirst.mockResolvedValueOnce({ id: STUDENT_1, currentGrade: 1 });
    mockEnrollmentFindFirst
      .mockResolvedValueOnce(ACTIVE_ENROLLMENT_G1)
      .mockResolvedValueOnce(null); // no existing in target year

    const tx = makeTx();
    mockTransaction.mockImplementation(async (fn: any) => fn(tx));

    const result = await promoteStudents(SCHOOL, SOURCE_YEAR, TARGET_YEAR, [STUDENT_1], ACTOR);

    expect(result.promoted).toContain(STUDENT_1);
    expect(result.errors).toHaveLength(0);
    expect(mockEnrollmentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "PROMOTED" }) })
    );
    expect(mockStudentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { currentGrade: 2 } })
    );
  });

  it("promotes Grade 11 student to Grade 12", async () => {
    const enr11 = { ...ACTIVE_ENROLLMENT_G1, grade: 11 };
    mockStudentFindFirst.mockResolvedValueOnce({ id: STUDENT_1, currentGrade: 11 });
    mockEnrollmentFindFirst
      .mockResolvedValueOnce(enr11)
      .mockResolvedValueOnce(null);

    const tx = makeTx();
    mockTransaction.mockImplementation(async (fn: any) => fn(tx));

    const result = await promoteStudents(SCHOOL, SOURCE_YEAR, TARGET_YEAR, [STUDENT_1], ACTOR);

    expect(result.promoted).toContain(STUDENT_1);
    expect(mockStudentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { currentGrade: 12 } })
    );
  });

  it("blocks promotion of Grade 12 (must use graduate)", async () => {
    mockStudentFindFirst.mockResolvedValueOnce({ id: STUDENT_12, currentGrade: 12 });
    mockEnrollmentFindFirst.mockResolvedValueOnce(ACTIVE_ENROLLMENT_G12);

    const result = await promoteStudents(SCHOOL, SOURCE_YEAR, TARGET_YEAR, [STUDENT_12], ACTOR);

    expect(result.errors[0].reason).toMatch(/grade 12/i);
    expect(result.promoted).toHaveLength(0);
  });

  it("is idempotent — skips if already promoted to target year", async () => {
    mockStudentFindFirst.mockResolvedValueOnce({ id: STUDENT_1, currentGrade: 1 });
    mockEnrollmentFindFirst
      .mockResolvedValueOnce(ACTIVE_ENROLLMENT_G1)
      .mockResolvedValueOnce({ id: "existing", grade: 2, status: "ACTIVE" }); // already in target

    const result = await promoteStudents(SCHOOL, SOURCE_YEAR, TARGET_YEAR, [STUDENT_1], ACTOR);

    expect(result.skipped).toContain(STUDENT_1);
    expect(result.promoted).toHaveLength(0);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("rejects student from different school", async () => {
    mockStudentFindFirst.mockResolvedValueOnce(null); // not in this school

    const result = await promoteStudents(SCHOOL, SOURCE_YEAR, TARGET_YEAR, [STUDENT_1], ACTOR);

    expect(result.errors[0].reason).toMatch(/not found/i);
  });

  it("logs to AuditLog", async () => {
    mockStudentFindFirst.mockResolvedValueOnce({ id: STUDENT_1, currentGrade: 1 });
    mockEnrollmentFindFirst
      .mockResolvedValueOnce(ACTIVE_ENROLLMENT_G1)
      .mockResolvedValueOnce(null);
    mockTransaction.mockImplementation(async (fn: any) => fn(makeTx()));

    await promoteStudents(SCHOOL, SOURCE_YEAR, TARGET_YEAR, [STUDENT_1], ACTOR);

    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "admin.students.promoted" })
    );
  });
});

describe("retainStudents", () => {
  beforeEach(() => vi.clearAllMocks());

  it("keeps student at same grade and marks old enrollment COMPLETED", async () => {
    mockStudentFindFirst.mockResolvedValueOnce({ id: STUDENT_1 });
    mockEnrollmentFindFirst
      .mockResolvedValueOnce(ACTIVE_ENROLLMENT_G1)
      .mockResolvedValueOnce(null); // not yet in target year

    mockTransaction.mockImplementation(async (fn: any) =>
      fn({
        academicEnrollment: {
          update: mockEnrollmentUpdate,
          create: mockEnrollmentCreate,
        },
      })
    );

    const result = await retainStudents(SCHOOL, SOURCE_YEAR, TARGET_YEAR, [STUDENT_1], ACTOR);

    expect(result.promoted).toContain(STUDENT_1);
    expect(mockEnrollmentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "COMPLETED" }) })
    );
    expect(mockEnrollmentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ grade: 1, status: "ACTIVE" }),
      })
    );
    // student.currentGrade not updated
    expect(mockStudentUpdate).not.toHaveBeenCalled();
  });

  it("historical enrollment is unchanged after retention (old stays in source year)", async () => {
    mockStudentFindFirst.mockResolvedValueOnce({ id: STUDENT_1 });
    mockEnrollmentFindFirst
      .mockResolvedValueOnce(ACTIVE_ENROLLMENT_G1)
      .mockResolvedValueOnce(null);

    mockTransaction.mockImplementation(async (fn: any) =>
      fn({
        academicEnrollment: {
          update: mockEnrollmentUpdate,
          create: mockEnrollmentCreate,
        },
      })
    );

    await retainStudents(SCHOOL, SOURCE_YEAR, TARGET_YEAR, [STUDENT_1], ACTOR);

    expect(mockEnrollmentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: ACTIVE_ENROLLMENT_G1.id } })
    );
  });
});

describe("graduateStudents", () => {
  beforeEach(() => vi.clearAllMocks());

  it("graduates a Grade 12 student", async () => {
    mockStudentFindFirst.mockResolvedValueOnce({ id: STUDENT_12 });
    mockEnrollmentFindFirst.mockResolvedValueOnce(ACTIVE_ENROLLMENT_G12);

    const result = await graduateStudents(SCHOOL, SOURCE_YEAR, [STUDENT_12], ACTOR);

    expect(result.promoted).toContain(STUDENT_12);
    expect(mockEnrollmentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "GRADUATED" }) })
    );
  });

  it("rejects graduation of non-Grade-12 student", async () => {
    mockStudentFindFirst.mockResolvedValueOnce({ id: STUDENT_1 });
    mockEnrollmentFindFirst.mockResolvedValueOnce(ACTIVE_ENROLLMENT_G1);

    const result = await graduateStudents(SCHOOL, SOURCE_YEAR, [STUDENT_1], ACTOR);

    expect(result.errors[0].reason).toMatch(/grade 12/i);
    expect(result.promoted).toHaveLength(0);
  });
});
