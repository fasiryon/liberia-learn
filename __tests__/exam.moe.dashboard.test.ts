import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireUser = vi.hoisted(() => vi.fn());
const mockIsMoePortalEnabled = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());
const mockSchoolCount = vi.hoisted(() => vi.fn());
const mockDistrictCount = vi.hoisted(() => vi.fn());
const mockStudentCount = vi.hoisted(() => vi.fn());
const mockScheduledWorkCount = vi.hoisted(() => vi.fn());
const mockInterventionLogCount = vi.hoisted(() => vi.fn());
const mockExamCount = vi.hoisted(() => vi.fn());
const mockExamAttemptFindMany = vi.hoisted(() => vi.fn());
const mockExamCertificationCount = vi.hoisted(() => vi.fn());
const mockExamAttemptCount = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ requireUser: mockRequireUser }));
vi.mock("@/lib/serverFlags", () => ({ isMoePortalEnabled: mockIsMoePortalEnabled }));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));
vi.mock("@/lib/db", () => ({
  prisma: {
    school: { count: mockSchoolCount },
    district: { count: mockDistrictCount },
    student: { count: mockStudentCount },
    scheduledWork: { count: mockScheduledWorkCount },
    interventionLog: { count: mockInterventionLogCount },
    exam: { count: mockExamCount },
    examAttempt: { findMany: mockExamAttemptFindMany, count: mockExamAttemptCount },
    examCertification: { count: mockExamCertificationCount },
  },
}));

import { GET } from "@/app/api/moe/dashboard/route";

describe("MOE dashboard examStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsMoePortalEnabled.mockReturnValue(true);
    mockRequireUser.mockResolvedValue({ id: "moe-1", role: "MOE_OFFICIAL", isPlatformAdmin: false });
    mockSchoolCount.mockResolvedValue(10);
    mockDistrictCount.mockResolvedValue(2);
    mockStudentCount.mockResolvedValue(100);
    mockScheduledWorkCount.mockResolvedValueOnce(20).mockResolvedValueOnce(10);
    mockInterventionLogCount.mockResolvedValue(3);
    mockExamCount.mockResolvedValue(0);
    mockExamAttemptFindMany.mockResolvedValue([]);
    mockExamCertificationCount.mockResolvedValue(0);
    mockExamAttemptCount.mockResolvedValue(0);
    mockLogAudit.mockResolvedValue(undefined);
  });

  it("examStats returns zeros when no exams exist", async () => {
    const res = await GET();
    const body = await res.json();
    expect(body.examStats.totalExamsPublished).toBe(0);
    expect(body.examStats.totalAttempts).toBe(0);
    expect(body.examStats.nationalPassRate).toBe(0);
  });

  it("nationalPassRate is computed correctly", async () => {
    mockExamCount.mockResolvedValue(2);
    mockExamAttemptFindMany.mockResolvedValue([
      { passed: true, integrityFlags: [], exam: { subject: "MATH" } },
      { passed: false, integrityFlags: ["tab_switch"], exam: { subject: "MATH" } },
      { passed: true, integrityFlags: [], exam: { subject: "SCIENCE" } },
    ]);
    mockExamCertificationCount.mockResolvedValue(2);
    mockExamAttemptCount.mockResolvedValue(1);

    const res = await GET();
    const body = await res.json();
    expect(body.examStats.nationalPassRate).toBeCloseTo(66.67, 2);
  });

  it("subjectBreakdown includes all subjects with attempts", async () => {
    mockExamAttemptFindMany.mockResolvedValue([
      { passed: true, integrityFlags: [], exam: { subject: "MATH" } },
      { passed: false, integrityFlags: [], exam: { subject: "SCIENCE" } },
    ]);

    const res = await GET();
    const body = await res.json();
    expect(body.examStats.subjectBreakdown).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ subject: "MATH", attempts: 1 }),
        expect.objectContaining({ subject: "SCIENCE", attempts: 1 }),
      ])
    );
  });

  it("contains no student PII", async () => {
    mockExamAttemptFindMany.mockResolvedValue([
      { passed: true, integrityFlags: [], exam: { subject: "MATH" } },
    ]);
    const res = await GET();
    const body = await res.json();
    const serialized = JSON.stringify(body.examStats);
    expect(serialized).not.toContain("studentId");
    expect(serialized).not.toContain("email");
    expect(serialized).not.toContain("name");
  });
});
