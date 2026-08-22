import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAppendGovernance = vi.hoisted(() => vi.fn().mockResolvedValue({ id: "event-1" }));

vi.mock("../lib/curriculum/nationalFactory", () => ({
  validatePayloadQuality: vi.fn().mockReturnValue({ passed: true }),
  generateNationalBatch: vi.fn(),
  auditNationalCoverage: vi.fn().mockResolvedValue({ entries: [] }),
}));

// PrismaClient constructor is never called because we inject mockDb directly
vi.mock("@prisma/client", () => ({
  PrismaClient: class {
    $disconnect = vi.fn();
  },
}));
vi.mock("../lib/curriculum/mutations/governanceWriter", () => ({
  appendCurriculumGovernanceEvent: mockAppendGovernance,
}));

import { runQualityGate, approveSafely, passesQualityGate } from "../scripts/factory-gap-closure";
import { validatePayloadQuality } from "../lib/curriculum/nationalFactory";

const mockValidate = validatePayloadQuality as ReturnType<typeof vi.fn>;

function makePassingRow(i: number) {
  return {
    id: `id-${i}`,
    contentId: `content-${i}`,
    grade: 5,
    subject: "CIVICS",
    payload: {
      body: "In liberia, students learn about civics and citizenship. ## Teacher Explanation\nTeach this lesson with examples.",
      teacherNote: "Guide students through Liberian civic examples.",
      assessment: "Ask students to name three government branches.",
      workedExamples: ["Example 1"],
    },
  };
}

function makeFailingRow(i: number) {
  return {
    id: `id-fail-${i}`,
    contentId: `content-fail-${i}`,
    grade: 5,
    subject: "CIVICS",
    payload: {
      body: "Civics lesson without country context.",
      teacherNote: "",
      assessment: "",
      workedExamples: [],
    },
  };
}

describe("factory-gap-closure quality gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidate.mockReturnValue({ passed: true });
  });

  it("runQualityGate paginates through all 600 rows and validates each one", async () => {
    const TOTAL = 600;
    const BATCH = 100;
    const mockFindMany = vi.fn();

    // Return 100 rows per call for 6 batches, then empty
    let call = 0;
    mockFindMany.mockImplementation(async ({ skip }: { skip: number }) => {
      call++;
      if (skip < TOTAL) {
        return Array.from({ length: BATCH }, (_, i) => makePassingRow(skip + i));
      }
      return [];
    });

    const mockDb = { curriculumContent: { findMany: mockFindMany } };
    const { failed, total } = await runQualityGate(mockDb);

    expect(total).toBe(TOTAL);
    expect(failed).toHaveLength(0);
    // 6 pages with rows + 1 empty terminator = 7 findMany calls
    expect(mockFindMany).toHaveBeenCalledTimes(7);
    // Verify skip progression
    expect(mockFindMany).toHaveBeenNthCalledWith(1, expect.objectContaining({ skip: 0, take: 100 }));
    expect(mockFindMany).toHaveBeenNthCalledWith(6, expect.objectContaining({ skip: 500, take: 100 }));
    expect(mockFindMany).toHaveBeenNthCalledWith(7, expect.objectContaining({ skip: 600, take: 100 }));
  });

  it("runQualityGate returns contentIds of rows that fail the gate", async () => {
    const mockFindMany = vi.fn();
    const rows = [
      makePassingRow(0),
      makeFailingRow(1),
      makePassingRow(2),
      makeFailingRow(3),
    ];

    mockFindMany
      .mockResolvedValueOnce(rows)
      .mockResolvedValueOnce([]);

    // Failing rows have empty teacherNote/assessment/workedExamples and no "liber" in body
    const mockDb = { curriculumContent: { findMany: mockFindMany } };
    const { failed, total } = await runQualityGate(mockDb);

    expect(total).toBe(4);
    expect(failed).toContain("content-fail-1");
    expect(failed).toContain("content-fail-3");
    expect(failed).toHaveLength(2);
  });

  it("approveSafely excludes failed contentIds and approves each row through governance", async () => {
    const mockFindMany = vi.fn().mockResolvedValue([{ contentId: "content-pass-1" }, { contentId: "content-pass-2" }]);
    const mockDb = { curriculumContent: { findMany: mockFindMany } };

    const failedIds = ["content-fail-1", "content-fail-2"];
    const count = await approveSafely(failedIds, mockDb);

    expect(count).toBe(2);
    expect(mockFindMany).toHaveBeenCalledOnce();
    const callArg = mockFindMany.mock.calls[0][0];
    expect(callArg.where.contentId).toEqual({ notIn: failedIds });
    expect(mockAppendGovernance).toHaveBeenCalledTimes(2);
    expect(mockAppendGovernance).toHaveBeenCalledWith(expect.objectContaining({
      eventType: "APPROVED",
      approvalBasis: "AUTOMATED_RISK_POLICY",
    }));
  });

  it("approveSafely does not add contentId filter when no rows failed", async () => {
    const mockFindMany = vi.fn().mockResolvedValue([{ contentId: "content-pass-1" }]);
    const mockDb = { curriculumContent: { findMany: mockFindMany } };

    const count = await approveSafely([], mockDb);

    expect(count).toBe(1);
    const callArg = mockFindMany.mock.calls[0][0];
    expect(callArg.where.contentId).toBeUndefined();
  });

  it("passesQualityGate returns false when validatePayloadQuality fails", () => {
    mockValidate.mockReturnValueOnce({ passed: false, reason: "too_short" });
    const result = passesQualityGate(makePassingRow(0));
    expect(result).toBe(false);
  });

  it("passesQualityGate returns false when body has no Liberian context", () => {
    const row = makePassingRow(0);
    (row.payload as Record<string, unknown>).body =
      "A lesson about civic duties without any country references. ## Teacher Explanation\nTeach this.";
    expect(passesQualityGate(row)).toBe(false);
  });
});
