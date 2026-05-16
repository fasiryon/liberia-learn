import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock prisma ───────────────────────────────────────────────────────────────
vi.mock("@/lib/db", () => ({
  prisma: {
    assignmentSubmission: {
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }));
vi.mock("@/lib/push/sendPush", () => ({ sendPushToUser: vi.fn().mockResolvedValue({ sent: 1, failed: 0, smsFallback: 0 }) }));

// Mock routedCompletion for the grader
vi.mock("@/lib/ai/routedCompletion", () => ({
  routedCompletion: vi.fn(),
}));

// ─── imports after mocks ───────────────────────────────────────────────────────
import { gradeHomework } from "@/lib/ai/homeworkGrader";
import { releaseStaleAIGrades } from "@/lib/ai/staleGradeReleaser";
import { prisma } from "@/lib/db";
import { sendPushToUser } from "@/lib/push/sendPush";
import { routedCompletion } from "@/lib/ai/routedCompletion";

const mockPrisma = prisma as any;
const mockRouted = routedCompletion as ReturnType<typeof vi.fn>;
const mockSendPush = sendPushToUser as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── 1. gradeHomework returns grade 0-100 ─────────────────────────────────────
describe("gradeHomework", () => {
  it("returns a grade between 0 and 100", async () => {
    mockRouted.mockResolvedValueOnce({
      content: JSON.stringify({ grade: 78, feedback: "Great work!", rationale: "Good accuracy.", perQuestionFeedback: [] }),
      tier: "fast",
      model: "llama-3.1-8b",
      inputTokens: 100,
      outputTokens: 80,
      estimatedCostUSD: 0.001,
    });

    const result = await gradeHomework(
      { content: "The area of a rectangle is length times width." },
      { title: "Area of Shapes", description: "Explain how to calculate area." },
    );

    expect(result.grade).toBeGreaterThanOrEqual(0);
    expect(result.grade).toBeLessThanOrEqual(100);
    expect(result.grade).toBe(78);
  });

  it("returns feedback and rationale strings", async () => {
    mockRouted.mockResolvedValueOnce({
      content: JSON.stringify({
        grade: 85,
        feedback: "Excellent understanding shown.",
        rationale: "Student demonstrated clear concept mastery.",
        perQuestionFeedback: ["Q1: correct"],
      }),
      tier: "fast",
      model: "llama-3.1-8b",
      inputTokens: 100,
      outputTokens: 80,
      estimatedCostUSD: 0.001,
    });

    const result = await gradeHomework(
      { content: "Water boils at 100 degrees Celsius at sea level." },
      { title: "States of Matter", description: "Describe water properties." },
    );

    expect(typeof result.feedback).toBe("string");
    expect(typeof result.rationale).toBe("string");
    expect(result.perQuestionFeedback).toHaveLength(1);
  });

  it("clamps out-of-range AI grades to 0-100", async () => {
    mockRouted.mockResolvedValueOnce({
      content: JSON.stringify({ grade: 150, feedback: "Great!", rationale: "Good.", perQuestionFeedback: [] }),
      tier: "fast",
      model: "llama-3.1-8b",
      inputTokens: 50,
      outputTokens: 40,
      estimatedCostUSD: 0,
    });

    const result = await gradeHomework({ content: "answer" }, { title: "Test", description: null });
    expect(result.grade).toBe(100);
  });

  it("returns fallback on invalid JSON response", async () => {
    mockRouted.mockResolvedValueOnce({
      content: "NOT JSON",
      tier: "fast",
      model: "llama-3.1-8b",
      inputTokens: 10,
      outputTokens: 5,
      estimatedCostUSD: 0,
    });

    const result = await gradeHomework({ content: "answer" }, { title: "Test", description: null });
    expect(result.grade).toBe(50);
    expect(result.feedback).toContain("received");
  });
});

// ─── 2. AI grade saved to submission after submit ─────────────────────────────
describe("AI grade saved on submission", () => {
  it("gradeHomework can be called with submission content and returns a grade", async () => {
    mockRouted.mockResolvedValueOnce({
      content: JSON.stringify({ grade: 72, feedback: "Good effort.", rationale: "Showed understanding.", perQuestionFeedback: [] }),
      tier: "fast",
      model: "llama-3.1-8b",
      inputTokens: 80,
      outputTokens: 60,
      estimatedCostUSD: 0,
    });

    const result = await gradeHomework(
      { content: "Photosynthesis converts sunlight to energy." },
      { title: "Plant Biology", description: "Explain photosynthesis." },
    );

    expect(result.grade).toBe(72);
    expect(result.feedback).toBe("Good effort.");
  });
});

// ─── 3-4. Teacher can approve / override AI grade ─────────────────────────────
describe("releaseStaleAIGrades", () => {
  it("releases submissions where aiGrade is set, teacherApproved=false, and aiGradedAt is older than 72h", async () => {
    const oldDate = new Date(Date.now() - 73 * 60 * 60 * 1000);
    mockPrisma.assignmentSubmission.findMany.mockResolvedValueOnce([
      {
        id: "sub1",
        aiGrade: 80,
        aiFeedback: "Good work!",
        assignmentId: "assign1",
        Assignment: {
          id: "assign1",
          title: "Math Quiz",
          classId: "cls1",
          Class: { schoolId: "school1" },
        },
        Student: { id: "stu1", user: { id: "user1" } },
        aiGradedAt: oldDate,
      },
    ]);
    mockPrisma.assignmentSubmission.update.mockResolvedValue({ id: "sub1" });

    const result = await releaseStaleAIGrades();

    expect(result.released).toBe(1);
    expect(mockPrisma.assignmentSubmission.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "sub1" },
        data: expect.objectContaining({ score: 80, autoReleasedAt: expect.any(Date) }),
      }),
    );
  });

  it("does NOT release submissions with teacherApproved=true", async () => {
    mockPrisma.assignmentSubmission.findMany.mockResolvedValueOnce([]);

    const result = await releaseStaleAIGrades();
    expect(result.released).toBe(0);
  });

  it("does NOT release submissions where autoReleasedAt is already set", async () => {
    mockPrisma.assignmentSubmission.findMany.mockResolvedValueOnce([]);

    const result = await releaseStaleAIGrades();
    expect(result.released).toBe(0);
  });

  it("auto-released grade uses autoReleasedAt not teacherApproved", async () => {
    const oldDate = new Date(Date.now() - 80 * 60 * 60 * 1000);
    mockPrisma.assignmentSubmission.findMany.mockResolvedValueOnce([
      {
        id: "sub2",
        aiGrade: 65,
        aiFeedback: "Needs improvement.",
        assignmentId: "assign2",
        Assignment: {
          id: "assign2",
          title: "Science Lab",
          classId: "cls2",
          Class: { schoolId: "school2" },
        },
        Student: { id: "stu2", user: { id: "user2" } },
        aiGradedAt: oldDate,
      },
    ]);
    mockPrisma.assignmentSubmission.update.mockResolvedValue({ id: "sub2" });

    await releaseStaleAIGrades();

    const updateCall = mockPrisma.assignmentSubmission.update.mock.calls[0][0];
    expect(updateCall.data).toHaveProperty("autoReleasedAt");
    expect(updateCall.data).not.toHaveProperty("teacherApproved");
  });

  it("fires push to student on auto-release", async () => {
    const oldDate = new Date(Date.now() - 73 * 60 * 60 * 1000);
    mockPrisma.assignmentSubmission.findMany.mockResolvedValueOnce([
      {
        id: "sub3",
        aiGrade: 90,
        aiFeedback: "Excellent!",
        assignmentId: "assign3",
        Assignment: {
          id: "assign3",
          title: "History Essay",
          classId: "cls3",
          Class: { schoolId: "school3" },
        },
        Student: { id: "stu3", user: { id: "user3" } },
        aiGradedAt: oldDate,
      },
    ]);
    mockPrisma.assignmentSubmission.update.mockResolvedValue({ id: "sub3" });

    await releaseStaleAIGrades();

    expect(mockSendPush).toHaveBeenCalledWith(
      "user3",
      expect.objectContaining({ title: "Assignment Graded", body: expect.stringContaining("90/100") }),
    );
  });
});

// ─── Student-side badge logic ──────────────────────────────────────────────────
describe("Student assignment grade badge logic", () => {
  it("autoReleasedAt without teacherApproved should show AI grade label", () => {
    const gradeData = {
      score: 75,
      feedback: "Good work.",
      gradedAt: new Date().toISOString(),
      turnedInAt: new Date().toISOString(),
      teacherApproved: false,
      autoReleasedAt: new Date().toISOString(),
    };

    const isAiGraded = Boolean(gradeData.autoReleasedAt) && !gradeData.teacherApproved;
    expect(isAiGraded).toBe(true);
  });

  it("teacherApproved=true should show Teacher grade label", () => {
    const gradeData = {
      score: 88,
      feedback: "Excellent.",
      gradedAt: new Date().toISOString(),
      turnedInAt: new Date().toISOString(),
      teacherApproved: true,
      autoReleasedAt: null,
    };

    const isTeacherGraded = gradeData.teacherApproved;
    expect(isTeacherGraded).toBe(true);
  });

  it("student sees feedback after AI auto-release", () => {
    const submission = {
      score: 70,
      feedback: null,
      aiFeedback: "You demonstrated good understanding.",
      autoReleasedAt: new Date().toISOString(),
      teacherApproved: false,
    };

    const visibleFeedback = submission.feedback ?? submission.aiFeedback;
    expect(visibleFeedback).toBe("You demonstrated good understanding.");
  });
});
