import { beforeEach, describe, expect, it, vi } from "vitest";

const mockLogAudit = vi.hoisted(() => vi.fn());
const mockDirectiveCreate = vi.hoisted(() => vi.fn());
const mockDirectiveFindMany = vi.hoisted(() => vi.fn());
const mockDirectiveFindUnique = vi.hoisted(() => vi.fn());
const mockDirectiveUpdate = vi.hoisted(() => vi.fn());
const mockApplicationUpsert = vi.hoisted(() => vi.fn());
const mockApplicationUpdateMany = vi.hoisted(() => vi.fn());
const mockSchoolFindMany = vi.hoisted(() => vi.fn());
const mockClassFindMany = vi.hoisted(() => vi.fn());
const mockCurriculumVersionFindFirst = vi.hoisted(() => vi.fn());
const mockCurriculumContentFindMany = vi.hoisted(() => vi.fn());

vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));
vi.mock("@/lib/db", () => ({
  prisma: {
    moePolicyDirective: {
      create: mockDirectiveCreate,
      findMany: mockDirectiveFindMany,
      findUnique: mockDirectiveFindUnique,
      update: mockDirectiveUpdate,
    },
    moeDirectiveApplication: {
      upsert: mockApplicationUpsert,
      updateMany: mockApplicationUpdateMany,
    },
    school: { findMany: mockSchoolFindMany },
    class: { findMany: mockClassFindMany },
    curriculumVersion: { findFirst: mockCurriculumVersionFindFirst },
    curriculumContent: { findMany: mockCurriculumContentFindMany },
  },
}));

function directive(overrides: Record<string, unknown> = {}) {
  return {
    id: "directive-1",
    title: "Grade 6 math pacing",
    description: "Apply the national pacing directive.",
    policyType: "curriculum_directive",
    targetScope: "grade",
    targetFilters: { grade: 6, subject: "MATH" },
    status: "draft",
    schoolId: null,
    applications: [],
    createdBy: { id: "moe-1", name: "MOE Official" },
    approvedBy: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockLogAudit.mockResolvedValue(undefined);
  mockDirectiveCreate.mockImplementation(({ data }) => Promise.resolve(directive(data)));
  mockDirectiveFindMany.mockResolvedValue([directive({ applications: [{ status: "needs_review" }] })]);
  mockDirectiveFindUnique.mockResolvedValue(directive());
  mockDirectiveUpdate.mockImplementation(({ data }) => Promise.resolve(directive(data)));
  mockApplicationUpsert.mockResolvedValue({});
  mockApplicationUpdateMany.mockResolvedValue({ count: 1 });
  mockSchoolFindMany.mockResolvedValue([{ id: "school-1", name: "CHA", county: "Montserrado", districtId: "district-1" }]);
  mockClassFindMany.mockResolvedValue([
    { id: "class-1", schoolId: "school-1", gradeLevel: 6, subject: "MATH" },
    { id: "class-2", schoolId: "school-1", gradeLevel: 7, subject: "SCIENCE" },
  ]);
  mockCurriculumVersionFindFirst.mockResolvedValue({ id: "version-1", versionName: "2026 National" });
  mockCurriculumContentFindMany.mockResolvedValue([{ grade: 6, subject: "MATH" }]);
});

describe("MOE policy governance service", () => {
  it("creates draft policy directives with target filters and audit logging", async () => {
    const { createMoeDirective } = await import("@/lib/moe/policyGovernance");

    const result = await createMoeDirective({
      userId: "moe-1",
      title: "Grade 6 math pacing",
      description: "Apply the national pacing directive.",
      policyType: "curriculum_directive",
      targetScope: "grade",
      targetFilters: { grade: 6, subject: "math" },
    });

    expect(result.status).toBe("draft");
    expect(mockDirectiveCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          targetScope: "grade",
          targetFilters: expect.objectContaining({ grade: 6, subject: "MATH" }),
          createdById: "moe-1",
        }),
      })
    );
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "moe.directive.created", resourceType: "moe_policy_directive" })
    );
  });

  it("enforces review, approval, publish, and apply transitions", async () => {
    const { transitionMoeDirective } = await import("@/lib/moe/policyGovernance");

    mockDirectiveFindUnique.mockResolvedValue(directive({ status: "pending_review" }));
    await transitionMoeDirective({ directiveId: "directive-1", userId: "moe-1", nextStatus: "approved" });
    expect(mockDirectiveUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "approved", approvedById: "moe-1" }) })
    );

    vi.clearAllMocks();
    mockDirectiveUpdate.mockImplementation(({ data }) => Promise.resolve(directive(data)));
    mockDirectiveFindUnique.mockResolvedValue(directive({ status: "approved" }));
    await transitionMoeDirective({ directiveId: "directive-1", userId: "moe-1", nextStatus: "published" });
    expect(mockApplicationUpsert).toHaveBeenCalled();

    vi.clearAllMocks();
    mockDirectiveUpdate.mockImplementation(({ data }) => Promise.resolve(directive(data)));
    mockDirectiveFindUnique.mockResolvedValue(directive({ status: "published" }));
    await transitionMoeDirective({ directiveId: "directive-1", userId: "moe-1", nextStatus: "applied" });

    expect(mockApplicationUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { directiveId: "directive-1", status: { not: "applied" } },
        data: expect.objectContaining({ status: "needs_review" }),
      })
    );
  });

  it("blocks apply before publish", async () => {
    const { transitionMoeDirective } = await import("@/lib/moe/policyGovernance");
    mockDirectiveFindUnique.mockResolvedValueOnce(directive({ status: "approved" }));

    await expect(
      transitionMoeDirective({ directiveId: "directive-1", userId: "moe-1", nextStatus: "applied" })
    ).rejects.toMatchObject({ status: 409 });
  });

  it("builds aggregate version drift without student PII", async () => {
    const { buildCurriculumVersionDriftSummary } = await import("@/lib/moe/policyGovernance");

    const summary = await buildCurriculumVersionDriftSummary();
    const serialized = JSON.stringify(summary);

    expect(summary.activeVersion?.versionName).toBe("2026 National");
    expect(summary.totals.classes).toBe(2);
    expect(summary.totals.needsReviewClasses).toBe(1);
    expect(serialized).not.toContain("student-");
    expect(serialized).not.toContain("email");
  });

  it("summarizes directive applications without exposing student PII", async () => {
    const { listMoeDirectives } = await import("@/lib/moe/policyGovernance");

    const directives = await listMoeDirectives();

    expect(directives[0].applicationSummary).toMatchObject({ total: 1, needsReview: 1 });
    expect(JSON.stringify(directives)).not.toContain("student-");
  });
});
