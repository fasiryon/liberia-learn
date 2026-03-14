import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireRole = vi.hoisted(() => vi.fn());
const mockIsAdaptiveEngineEnabled = vi.hoisted(() => vi.fn());
const mockDetectMasteryGaps = vi.hoisted(() => vi.fn());
const mockUpdateMasteryProfile = vi.hoisted(() => vi.fn());
const mockGradeToBand = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());
const mockStudentFindFirst = vi.hoisted(() => vi.fn());
const mockAdaptiveAttemptFindMany = vi.hoisted(() => vi.fn());
const mockAdaptiveAttemptCreate = vi.hoisted(() => vi.fn());
const mockAdaptiveAttemptFindFirst = vi.hoisted(() => vi.fn());
const mockMasteryProfileFindFirst = vi.hoisted(() => vi.fn());
const mockStrandCatalogFindFirst = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ requireRole: mockRequireRole }));
vi.mock("@/lib/serverFlags", () => ({ isAdaptiveEngineEnabled: mockIsAdaptiveEngineEnabled }));
vi.mock("@/lib/adaptive/gapDetector", () => ({ detectMasteryGaps: mockDetectMasteryGaps }));
vi.mock("@/lib/mastery/masteryService", () => ({ updateMasteryProfile: mockUpdateMasteryProfile }));
vi.mock("@/lib/moe/alignment-engine", () => ({ gradeToBand: mockGradeToBand }));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));
vi.mock("@/lib/db", () => ({
  prisma: {
    student: { findFirst: mockStudentFindFirst },
    studentAdaptiveAttempt: {
      findMany: mockAdaptiveAttemptFindMany,
      create: mockAdaptiveAttemptCreate,
      findFirst: mockAdaptiveAttemptFindFirst,
    },
    studentMasteryProfile: { findFirst: mockMasteryProfileFindFirst },
    strandCatalog: { findFirst: mockStrandCatalogFindFirst },
  },
}));

import { POST } from "@/app/api/student/adaptive/submit/route";

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/student/adaptive/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as any;
}

const body = {
  strandCode: "fractions",
  practiceSetId: "practice-1",
  answers: [0, 1, 2, 3, 0],
  correctAnswers: [0, 1, 2, 3, 0],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockIsAdaptiveEngineEnabled.mockReturnValue(true);
  mockRequireRole.mockResolvedValue({ id: "user-1", role: "STUDENT", schoolId: "school-1" });
  mockStudentFindFirst.mockResolvedValue({ id: "student-1", currentGrade: 6 });
  mockDetectMasteryGaps.mockResolvedValue([
    {
      strand: "fractions",
      subject: "MATH",
      grade: 6,
      averageScore: 0.45,
      attemptCount: 2,
      lastAttemptAt: new Date("2026-03-10T00:00:00.000Z"),
    },
  ]);
  mockAdaptiveAttemptFindMany
    .mockResolvedValueOnce([
      { score: 0.4, completedAt: new Date("2026-03-12T00:00:00.000Z") },
      { score: 0.5, completedAt: new Date("2026-03-11T00:00:00.000Z") },
    ])
    .mockResolvedValueOnce([
      { score: 1, completedAt: new Date("2026-03-13T00:00:00.000Z") },
      { score: 0.4, completedAt: new Date("2026-03-12T00:00:00.000Z") },
      { score: 0.5, completedAt: new Date("2026-03-11T00:00:00.000Z") },
    ]);
  mockAdaptiveAttemptCreate.mockResolvedValue({ id: "attempt-1" });
  mockUpdateMasteryProfile.mockResolvedValue(undefined);
  mockGradeToBand.mockReturnValue("G4_6");
  mockLogAudit.mockResolvedValue(undefined);
  mockAdaptiveAttemptFindFirst.mockResolvedValue(null);
  mockMasteryProfileFindFirst.mockResolvedValue(null);
  mockStrandCatalogFindFirst.mockResolvedValue(null);
});

describe("POST /api/student/adaptive/submit", () => {
  it("saves attempt and returns score", async () => {
    const response = await POST(makeRequest(body));
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.score).toBe(1);
    expect(mockAdaptiveAttemptCreate).toHaveBeenCalled();
  });

  it("passed=true when score >= 0.70", async () => {
    const response = await POST(makeRequest(body));
    const payload = await response.json();
    expect(payload.passed).toBe(true);
  });

  it("passed=false when score < 0.70", async () => {
    mockAdaptiveAttemptFindMany
      .mockReset()
      .mockResolvedValueOnce([{ score: 0.2, completedAt: new Date("2026-03-12T00:00:00.000Z") }])
      .mockResolvedValueOnce([{ score: 0.2, completedAt: new Date("2026-03-13T00:00:00.000Z") }]);

    const response = await POST(
      makeRequest({
        ...body,
        answers: [0, 1, 1, 3, 2],
      })
    );
    const payload = await response.json();
    expect(payload.passed).toBe(false);
  });

  it("returns nextTier in response", async () => {
    const response = await POST(makeRequest(body));
    const payload = await response.json();
    expect(payload).toHaveProperty("nextTier");
  });

  it("requires STUDENT session", async () => {
    mockRequireRole.mockRejectedValueOnce(Object.assign(new Error("Unauthorized"), { status: 401 }));
    const response = await POST(makeRequest(body));
    expect(response.status).toBe(401);
  });
});
