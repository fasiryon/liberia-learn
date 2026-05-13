import { afterEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  learningEvent: {
    findFirst: vi.fn(),
    create: vi.fn(),
    findMany: vi.fn(),
  },
  agentDecision: { findMany: vi.fn() },
  masterySnapshot: { findMany: vi.fn() },
  attendance: { findMany: vi.fn() },
  assessmentAttempt: { findMany: vi.fn() },
  studentProgress: { findMany: vi.fn() },
  interventionRecommendation: { findMany: vi.fn() },
  curriculumFlag: { findMany: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

const range = {
  from: new Date("2026-05-01T00:00:00.000Z"),
  to: new Date("2026-05-31T23:59:59.999Z"),
};

function event(id: string, eventType: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    eventType,
    schoolId: "school-1",
    classId: "class-1",
    studentId: "student-1",
    occurredAt: new Date("2026-05-12T10:00:00.000Z"),
    metadata: {},
    ...overrides,
  };
}

function resetMocks() {
  mockPrisma.learningEvent.findFirst.mockResolvedValue(null);
  mockPrisma.learningEvent.create.mockResolvedValue({ id: "event-created" });
  mockPrisma.learningEvent.findMany.mockResolvedValue([]);
  mockPrisma.agentDecision.findMany.mockResolvedValue([]);
  mockPrisma.masterySnapshot.findMany.mockResolvedValue([]);
  mockPrisma.attendance.findMany.mockResolvedValue([]);
  mockPrisma.assessmentAttempt.findMany.mockResolvedValue([]);
  mockPrisma.studentProgress.findMany.mockResolvedValue([]);
  mockPrisma.interventionRecommendation.findMany.mockResolvedValue([]);
  mockPrisma.curriculumFlag.findMany.mockResolvedValue([]);
}

afterEach(() => {
  vi.clearAllMocks();
  delete process.env.ENABLE_AUTONOMOUS_SIGNAL_INTEGRATION;
});

describe("Autonomous OS Phase 13 product signal logging", () => {
  it("logs sanitized, tenant-scoped LearningEvent product signals", async () => {
    resetMocks();
    const { logProductSignal } = await import("@/lib/autonomous/signals/productSignalService");

    await logProductSignal({
      schoolId: "school-1",
      classId: "class-1",
      userId: "teacher-1",
      studentId: "student-1",
      actor: { type: "user", id: "teacher-1", role: "TEACHER" },
      target: { type: "assignment_submission", id: "submission-1" },
      eventType: "teacher.feedback.created",
      source: "test",
      dedupeKey: "signal-1",
      metadata: {
        feedback: "Raw teacher comment should not be stored",
        email: "student@example.com",
        feedbackLength: 42,
      },
    });

    expect(mockPrisma.learningEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          schoolId: "school-1",
          classId: "class-1",
          userId: "teacher-1",
          studentId: "student-1",
          eventType: "teacher.feedback.created",
          metadata: expect.objectContaining({
            signalCategory: "teacher_feedback",
            feedbackLength: 42,
          }),
          qualityMarkers: expect.objectContaining({
            signalIntegrated: true,
            metadataSanitized: true,
          }),
        }),
      })
    );
    const metadata = mockPrisma.learningEvent.create.mock.calls[0][0].data.metadata;
    expect(metadata.feedback).toBeUndefined();
    expect(metadata.email).toBeUndefined();
  });

  it("is idempotent when a dedupe key already exists", async () => {
    resetMocks();
    mockPrisma.learningEvent.findFirst.mockResolvedValueOnce({ id: "existing-event" });
    const { logProductSignal } = await import("@/lib/autonomous/signals/productSignalService");

    const result = await logProductSignal({
      schoolId: "school-1",
      eventType: "assignment.submitted",
      dedupeKey: "assignment.submitted:school-1:submission-1",
    });

    expect(result).toEqual({ id: "existing-event" });
    expect(mockPrisma.learningEvent.create).not.toHaveBeenCalled();
  });

  it("does not write product signals when the integration flag is disabled", async () => {
    resetMocks();
    process.env.ENABLE_AUTONOMOUS_SIGNAL_INTEGRATION = "false";
    const { logProductSignal } = await import("@/lib/autonomous/signals/productSignalService");

    const result = await logProductSignal({ schoolId: "school-1", eventType: "lesson.completed" });

    expect(result).toBeNull();
    expect(mockPrisma.learningEvent.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.learningEvent.create).not.toHaveBeenCalled();
  });
});

describe("Autonomous OS Phase 13 signal coverage", () => {
  it("scopes signal coverage to the school tenant and reports detector evidence coverage", async () => {
    resetMocks();
    mockPrisma.learningEvent.findMany.mockResolvedValueOnce([
      event("e1", "assignment.submitted"),
      event("e2", "assignment.graded"),
      event("e3", "guardian.report_card.viewed"),
    ]);
    mockPrisma.agentDecision.findMany.mockResolvedValueOnce([
      { id: "d1", evidenceRefs: { refs: [{ type: "LearningEvent", id: "e1", schoolId: "school-1" }] } },
      { id: "d2", evidenceRefs: { refs: [{ type: "MasterySnapshot", id: "m1", schoolId: "school-1" }] } },
    ]);

    const { getSignalCoverage } = await import("@/lib/autonomous/signals/signalCoverageService");
    const coverage = await getSignalCoverage({ scope: { schoolId: "school-1" }, range });

    expect(mockPrisma.learningEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ schoolId: "school-1" }),
    }));
    expect(coverage.totalEvents).toBe(3);
    expect(coverage.byCategory.find((row) => row.category === "assignment")?.count).toBe(2);
    expect(coverage.coverage.detectorEvidenceCoverage).toBe(0.5);
    expect(coverage.coverage.schoolCount).toBe(1);
  });

  it("hides school and class coverage in aggregate-safe views", async () => {
    resetMocks();
    mockPrisma.learningEvent.findMany.mockResolvedValueOnce([event("e1", "report_card.published")]);

    const { getSignalCoverage } = await import("@/lib/autonomous/signals/signalCoverageService");
    const coverage = await getSignalCoverage({ scope: { aggregateSafe: true }, range });

    expect(coverage.coverage.schoolCount).toBeNull();
    expect(coverage.coverage.classCount).toBeNull();
  });
});

describe("Autonomous OS Phase 13 detector evidence improvements", () => {
  it("adds real product LearningEvent signals to detector evidence", async () => {
    resetMocks();
    mockPrisma.learningEvent.findMany.mockResolvedValueOnce([
      event("submitted-1", "assignment.submitted"),
      event("submitted-2", "assignment.submitted"),
      event("completed-1", "lesson.completed"),
      event("ai-1", "ai.interaction", { metadata: { feature: "tutor" } }),
      event("guardian-1", "guardian.report_card.viewed"),
    ]);

    const { resolveDetectorEvidence } = await import("@/lib/autonomous/detectors/detectorEvidenceResolver");
    const evidence = await resolveDetectorEvidence({ schoolId: "school-1", targetType: "student", targetId: "student-1" });

    expect(evidence.signals.some((signal) => signal.key === "ungradedSubmissionCount")).toBe(true);
    expect(evidence.signals.some((signal) => signal.key === "curriculumBottleneckCount")).toBe(true);
    expect(evidence.summary.productSignalCategories).toContain("assignment");
    expect(evidence.summary.productSignalCategories).toContain("guardian");
    expect(evidence.signals.flatMap((signal) => signal.evidence).some((ref) => ref.type === "LearningEvent")).toBe(true);
  });
});
