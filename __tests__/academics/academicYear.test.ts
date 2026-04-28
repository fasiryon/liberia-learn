import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAcademicYearFindFirst = vi.hoisted(() => vi.fn());
const mockAcademicYearFindMany = vi.hoisted(() => vi.fn());
const mockAcademicYearUpdateMany = vi.hoisted(() => vi.fn());
const mockAcademicYearCreate = vi.hoisted(() => vi.fn());
const mockAcademicYearUpdate = vi.hoisted(() => vi.fn());
const mockTransaction = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: {
    academicYear: {
      findFirst: mockAcademicYearFindFirst,
      findMany: mockAcademicYearFindMany,
      updateMany: mockAcademicYearUpdateMany,
      create: mockAcademicYearCreate,
      update: mockAcademicYearUpdate,
    },
    $transaction: mockTransaction,
  },
}));

import {
  getActiveAcademicYear,
  createAcademicYear,
  setActiveAcademicYear,
} from "@/lib/academics/academicYear";

const BASE_YEAR = {
  id: "year-1",
  schoolId: "school-1",
  yearLabel: "2026-2027",
  startDate: new Date("2026-09-01"),
  endDate: new Date("2027-06-30"),
  isActive: true,
  createdAt: new Date(),
  terms: [],
};

describe("getActiveAcademicYear", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null when no active year", async () => {
    mockAcademicYearFindFirst.mockResolvedValueOnce(null);
    const result = await getActiveAcademicYear("school-1");
    expect(result).toBeNull();
  });

  it("returns active year", async () => {
    mockAcademicYearFindFirst.mockResolvedValueOnce(BASE_YEAR);
    const result = await getActiveAcademicYear("school-1");
    expect(result?.id).toBe("year-1");
    expect(result?.isActive).toBe(true);
  });
});

describe("createAcademicYear", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates with isActive false by default", async () => {
    mockTransaction.mockImplementation(async (fn: any) =>
      fn({
        academicYear: {
          updateMany: mockAcademicYearUpdateMany,
          create: mockAcademicYearCreate,
        },
      })
    );
    mockAcademicYearCreate.mockResolvedValueOnce({ ...BASE_YEAR, isActive: false, terms: [] });

    const result = await createAcademicYear("school-1", {
      yearLabel: "2026-2027",
      startDate: new Date("2026-09-01"),
      endDate: new Date("2027-06-30"),
      isActive: false,
      terms: [{ name: "Term 1", startDate: new Date("2026-09-01"), endDate: new Date("2026-12-15") }],
    });
    expect(result.isActive).toBe(false);
  });
});

describe("setActiveAcademicYear", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deactivates previous active year and activates specified year", async () => {
    mockAcademicYearFindFirst.mockResolvedValueOnce({ ...BASE_YEAR, terms: [] });
    mockTransaction.mockImplementation(async (fn: any) =>
      fn({
        academicYear: {
          updateMany: mockAcademicYearUpdateMany,
          update: mockAcademicYearUpdate,
        },
      })
    );
    mockAcademicYearUpdate.mockResolvedValueOnce({ ...BASE_YEAR, terms: [] });

    const result = await setActiveAcademicYear("school-1", "year-1");
    expect(mockAcademicYearUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isActive: false } })
    );
    expect(result.isActive).toBe(true);
  });
});
