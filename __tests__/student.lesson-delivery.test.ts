import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireRole = vi.hoisted(() => vi.fn());
const mockScheduledWorkFindUnique = vi.hoisted(() => vi.fn());
const mockStudentFindUnique = vi.hoisted(() => vi.fn());
const mockEnrollmentFindUnique = vi.hoisted(() => vi.fn());
const mockStudentProgressUpsert = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());
const mockNotifyLessonCompletion = vi.hoisted(() => vi.fn());
const mockUpdateMasteryProfile = vi.hoisted(() => vi.fn());
const ROUTE_TIMEOUT_MS = 15_000;

vi.mock("@/lib/auth", () => ({
  requireRole: mockRequireRole,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    scheduledWork: { findUnique: mockScheduledWorkFindUnique },
    student: { findUnique: mockStudentFindUnique },
    enrollment: { findUnique: mockEnrollmentFindUnique },
    studentProgress: { upsert: mockStudentProgressUpsert },
  },
}));

vi.mock("@/lib/audit", () => ({
  logAudit: mockLogAudit,
}));

vi.mock("@/lib/lesson-notifications", () => ({
  notifyLessonCompletion: mockNotifyLessonCompletion,
}));

vi.mock("@/lib/mastery/masteryService", () => ({
  updateMasteryProfile: mockUpdateMasteryProfile,
}));

describe("student lesson delivery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // First test in this file to dynamically import @/lib/lessons, which now
  // pulls in isomorphic-dompurify (jsdom) for HTML sanitization. The cold jsdom
  // import can exceed the default 5s budget under full-suite parallel load, so
  // this case gets the same generous timeout the route tests use.
  it("selects the standard lesson body for standard formats", async () => {
    const { selectLessonBody } = await import("@/lib/lessons");
    expect(
      selectLessonBody(
        {
          body_standard: "## Opening\nStandard lesson body",
          body_block: "## Opening\nBlock lesson body",
        },
        "standard"
      )
    ).toContain("Standard lesson body");
  }, ROUTE_TIMEOUT_MS);

  it("selects the block lesson body for block formats", async () => {
    const { selectLessonBody } = await import("@/lib/lessons");
    expect(
      selectLessonBody(
        {
          body_standard: "## Opening\nStandard lesson body",
          body_block: "## Opening\nBlock lesson body",
        },
        "block_a"
      )
    ).toContain("Block lesson body");
  });

  it("marks the lesson complete and sends guardian notification", async () => {
    mockScheduledWorkFindUnique.mockResolvedValue({
      id: "sw-1",
      classId: "class-1",
      class: { schoolId: "school-1", School: { name: "Capitol Hill Academy" } },
      content: {
        grade: 6,
        subject: "MATH",
        payload: {},
        deliveryProfile: {
          exitTicket: {
            questions: [{ question: "2 + 2 = ?", standardCode: "math-basics", correctAnswer: "1" }],
          },
        },
        moeAlignments: [{ code: "MATH-G6-01" }],
      },
    });
    mockStudentFindUnique.mockResolvedValue({ id: "student-1", user: { name: "Student One" } });
    mockEnrollmentFindUnique.mockResolvedValue({ id: "enroll-1" });
    mockStudentProgressUpsert.mockResolvedValue({ completedAt: new Date("2026-03-13T12:00:00.000Z") });
    mockLogAudit.mockResolvedValue(undefined);
    mockNotifyLessonCompletion.mockResolvedValue(undefined);
    mockUpdateMasteryProfile.mockResolvedValue(undefined);
    mockRequireRole.mockResolvedValue({ id: "user-1", role: "STUDENT", schoolId: "school-1" });

    const { POST } = await import("@/app/api/student/lessons/[id]/complete/route");
    const response = await POST(
      new Request("http://localhost/api/student/lessons/sw-1/complete", {
        method: "POST",
        body: JSON.stringify({ exitTicketAnswers: [{ questionIndex: 0, answer: "1" }] }),
        headers: { "Content-Type": "application/json" },
      }) as any,
      { params: { id: "sw-1" } }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ success: true, exitTicketScore: 100 });
    expect(mockNotifyLessonCompletion).toHaveBeenCalledOnce();
    expect(mockUpdateMasteryProfile).toHaveBeenCalledOnce();
  }, ROUTE_TIMEOUT_MS);

  it("does not fail the lesson completion flow when guardian SMS fails", async () => {
    mockScheduledWorkFindUnique.mockResolvedValue({
      id: "sw-1",
      classId: "class-1",
      class: { schoolId: "school-1", School: { name: "Capitol Hill Academy" } },
      content: {
        grade: 6,
        subject: "SCIENCE",
        payload: {},
        deliveryProfile: { exitTicket: { questions: [] } },
        moeAlignments: [],
      },
    });
    mockStudentFindUnique.mockResolvedValue({ id: "student-1", user: { name: "Student One" } });
    mockEnrollmentFindUnique.mockResolvedValue({ id: "enroll-1" });
    mockStudentProgressUpsert.mockResolvedValue({ completedAt: new Date("2026-03-13T12:00:00.000Z") });
    mockLogAudit.mockResolvedValue(undefined);
    mockNotifyLessonCompletion.mockRejectedValue(new Error("sms failed"));
    mockRequireRole.mockResolvedValue({ id: "user-1", role: "STUDENT", schoolId: "school-1" });

    const { POST } = await import("@/app/api/student/lessons/[id]/complete/route");
    const response = await POST(
      new Request("http://localhost/api/student/lessons/sw-1/complete", {
        method: "POST",
        body: JSON.stringify({ exitTicketAnswers: [] }),
        headers: { "Content-Type": "application/json" },
      }) as any,
      { params: { id: "sw-1" } }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ success: true });
  });

  it("builds sequential playable audio parts from generated audioParts", async () => {
    const { getPlayableAudioParts } = await import("@/components/student/LessonAudioPlayer");

    const parts = getPlayableAudioParts({
      status: "GENERATED",
      storageUrl: "https://cdn.example/fallback.mp3",
      audioParts: [
        { partNumber: 2, storageUrl: "https://cdn.example/part-2.mp3", status: "GENERATED" },
        { partNumber: 1, storageUrl: "https://cdn.example/part-1.mp3", status: "GENERATED" },
        { partNumber: 3, storageUrl: "https://cdn.example/failed.mp3", status: "FAILED" },
      ],
    });

    expect(parts).toEqual([
      { partNumber: 1, storageUrl: "https://cdn.example/part-1.mp3" },
      { partNumber: 2, storageUrl: "https://cdn.example/part-2.mp3" },
    ]);
  });

  it("falls back to storageUrl when audioParts are empty", async () => {
    const { getPlayableAudioParts } = await import("@/components/student/LessonAudioPlayer");

    expect(
      getPlayableAudioParts({
        status: "GENERATED",
        storageUrl: "https://cdn.example/full-lesson.mp3",
        audioParts: [],
      })
    ).toEqual([{ partNumber: 1, storageUrl: "https://cdn.example/full-lesson.mp3" }]);
  });

  it("moves next and previous audio sections within bounds", async () => {
    const { getAdjacentAudioPartIndex } = await import("@/components/student/LessonAudioPlayer");

    expect(getAdjacentAudioPartIndex(0, "next", 3)).toBe(1);
    expect(getAdjacentAudioPartIndex(1, "previous", 3)).toBe(0);
    expect(getAdjacentAudioPartIndex(2, "next", 3)).toBe(2);
    expect(getAdjacentAudioPartIndex(0, "previous", 3)).toBe(0);
  });

  it("returns no playable audio when generated audio is unavailable", async () => {
    const { getPlayableAudioParts } = await import("@/components/student/LessonAudioPlayer");

    expect(getPlayableAudioParts({ status: "PENDING", storageUrl: "https://cdn.example/pending.mp3" })).toEqual([]);
    expect(getPlayableAudioParts({ status: "GENERATED", storageUrl: null, audioParts: [] })).toEqual([]);
  });
});
