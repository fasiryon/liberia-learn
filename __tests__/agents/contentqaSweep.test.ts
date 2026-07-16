import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma, mockRunAgent, mockEnqueueEscalation, mockNotifySchoolSafeguarding } = vi.hoisted(() => ({
  mockPrisma: {
    curriculumContent: { findMany: vi.fn() },
    lessonVideo: { findMany: vi.fn() },
    gradedSubmission: { findMany: vi.fn() },
    contentQaReview: { findFirst: vi.fn(), create: vi.fn() },
  },
  mockRunAgent: vi.fn(),
  mockEnqueueEscalation: vi.fn(),
  mockNotifySchoolSafeguarding: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/agents/runtime", () => ({ runAgent: mockRunAgent }));
vi.mock("@/lib/agents/escalation", () => ({ enqueueEscalation: mockEnqueueEscalation }));
vi.mock("@/lib/agents/safeguarding/notify", () => ({ notifySchoolSafeguarding: mockNotifySchoolSafeguarding }));

import { runContentQaSweep } from "@/lib/agents/contentqa/sweep";

function resetAll() {
  Object.values(mockPrisma).forEach((delegate) =>
    Object.values(delegate).forEach((fn) => (fn as ReturnType<typeof vi.fn>).mockReset())
  );
  mockRunAgent.mockReset();
  mockEnqueueEscalation.mockReset();
  mockNotifySchoolSafeguarding.mockReset();

  mockPrisma.curriculumContent.findMany.mockResolvedValue([]);
  mockPrisma.lessonVideo.findMany.mockResolvedValue([]);
  mockPrisma.gradedSubmission.findMany.mockResolvedValue([]);
  mockPrisma.contentQaReview.findFirst.mockResolvedValue(null);
  mockPrisma.contentQaReview.create.mockResolvedValue({ id: "review-1" });
  mockEnqueueEscalation.mockResolvedValue({ id: "esc-1" });
  mockRunAgent.mockResolvedValue({ invocationId: "inv-1", status: "SUCCESS", response: "ok" });
}

describe("content-qa sweep: lesson query scope", () => {
  beforeEach(resetAll);

  it("matches the exact filter the /admin/content-review queue itself uses", async () => {
    await runContentQaSweep();
    expect(mockPrisma.curriculumContent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { editReviewStatus: "PENDING", editedById: { not: null } } })
    );
  });

  it("invokes the agent once per un-reviewed lesson", async () => {
    mockPrisma.curriculumContent.findMany.mockResolvedValue([{ contentId: "content-1" }, { contentId: "content-2" }]);
    await runContentQaSweep();
    expect(mockRunAgent).toHaveBeenCalledWith("content-qa", expect.stringContaining("content-1"), expect.any(Object));
    expect(mockRunAgent).toHaveBeenCalledWith("content-qa", expect.stringContaining("content-2"), expect.any(Object));
  });

  it("skips a lesson that already has a ContentQaReview row", async () => {
    mockPrisma.curriculumContent.findMany.mockResolvedValue([{ contentId: "content-1" }]);
    mockPrisma.contentQaReview.findFirst.mockResolvedValue({ id: "existing" });
    await runContentQaSweep();
    expect(mockRunAgent).not.toHaveBeenCalled();
  });

  it("invokes with triggeredBy SCHEDULE and userRole system, matching the system-caller design", async () => {
    mockPrisma.curriculumContent.findMany.mockResolvedValue([{ contentId: "content-1" }]);
    await runContentQaSweep();
    expect(mockRunAgent).toHaveBeenCalledWith(
      "content-qa",
      expect.any(String),
      expect.objectContaining({ userRole: "system", triggeredBy: "SCHEDULE" })
    );
  });
});

describe("content-qa sweep: video safety routing (Escalation Point 3)", () => {
  beforeEach(resetAll);

  it("bypasses the LLM entirely and escalates directly on a keyword-gate match", async () => {
    mockPrisma.lessonVideo.findMany.mockResolvedValue([
      { id: "video-1", title: "Lesson video", description: "he threatened to hurt me if I told anyone", schoolId: "school-1" },
    ]);

    const result = await runContentQaSweep();

    expect(mockRunAgent).not.toHaveBeenCalled();
    expect(mockEnqueueEscalation).toHaveBeenCalledWith(
      expect.objectContaining({ priority: "HIGH", agentName: "content-qa", schoolId: "school-1" })
    );
    expect(mockNotifySchoolSafeguarding).toHaveBeenCalledWith("school-1", expect.any(String));
    expect(result.items.find((i) => i.submissionId === "video-1")?.outcome).toBe("safeguarding_escalated");
  });

  it("still records a ContentQaReview audit row when bypassing the LLM on a keyword match", async () => {
    mockPrisma.lessonVideo.findMany.mockResolvedValue([
      { id: "video-1", title: "x", description: "threatened to hurt me", schoolId: "school-1" },
    ]);
    await runContentQaSweep();
    expect(mockPrisma.contentQaReview.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ submissionType: "video", confidence: 1 }) })
    );
  });

  it("invokes the LLM normally for a video with no keyword match, so its own soft-signal judgment can still run", async () => {
    mockPrisma.lessonVideo.findMany.mockResolvedValue([
      { id: "video-1", title: "Cell Division", description: "explains mitosis", schoolId: "school-1" },
    ]);

    const result = await runContentQaSweep();

    expect(mockRunAgent).toHaveBeenCalledWith("content-qa", expect.stringContaining("video-1"), expect.any(Object));
    expect(mockEnqueueEscalation).not.toHaveBeenCalled();
    expect(result.items.find((i) => i.submissionId === "video-1")?.outcome).toBe("reviewed");
  });

  it("does not notify when a keyword-matched video has no resolvable schoolId", async () => {
    mockPrisma.lessonVideo.findMany.mockResolvedValue([
      { id: "video-1", title: "x", description: "abusive language toward a child", schoolId: null },
    ]);
    await runContentQaSweep();
    expect(mockEnqueueEscalation).toHaveBeenCalledWith(expect.objectContaining({ schoolId: null }));
    expect(mockNotifySchoolSafeguarding).not.toHaveBeenCalled();
  });

  it("skips a video that already has a ContentQaReview row, even with a keyword match", async () => {
    mockPrisma.lessonVideo.findMany.mockResolvedValue([
      { id: "video-1", title: "x", description: "threatened to hurt me", schoolId: "school-1" },
    ]);
    mockPrisma.contentQaReview.findFirst.mockResolvedValue({ id: "existing" });
    await runContentQaSweep();
    expect(mockEnqueueEscalation).not.toHaveBeenCalled();
    expect(mockRunAgent).not.toHaveBeenCalled();
  });
});

describe("content-qa sweep: essay/code query scope", () => {
  beforeEach(resetAll);

  it("only considers graded submissions", async () => {
    await runContentQaSweep();
    expect(mockPrisma.gradedSubmission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "graded" } })
    );
  });

  it("routes exerciseType code to submissionType code and everything else to essay", async () => {
    mockPrisma.gradedSubmission.findMany.mockResolvedValue([
      { id: "sub-1", exerciseType: "code" },
      { id: "sub-2", exerciseType: "essay" },
    ]);
    await runContentQaSweep();
    expect(mockRunAgent).toHaveBeenCalledWith("content-qa", expect.stringContaining("submissionType: code"), expect.any(Object));
    expect(mockRunAgent).toHaveBeenCalledWith("content-qa", expect.stringContaining("submissionType: essay"), expect.any(Object));
  });
});

describe("content-qa sweep: failure handling", () => {
  beforeEach(resetAll);

  it("records invoke_failed and continues the sweep when runAgent throws", async () => {
    mockPrisma.curriculumContent.findMany.mockResolvedValue([{ contentId: "content-1" }]);
    mockRunAgent.mockRejectedValueOnce(new Error("cost capped"));

    const result = await runContentQaSweep();

    expect(result.items[0]).toMatchObject({ submissionId: "content-1", outcome: "invoke_failed" });
  });
});
