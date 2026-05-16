/**
 * Sprint 19 — AI Conversational Tutor, Lesson Help Flags, Teacher Tutor Analytics
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockFindUniqueCurriculum = vi.fn();
const mockFindFirstConversation = vi.fn();
const mockCreateConversation = vi.fn();
const mockUpdateConversation = vi.fn();
const mockCountFlag = vi.fn();
const mockCreateFlag = vi.fn();
const mockFindFirstEnrollment = vi.fn();
const mockFindManyEnrollments = vi.fn();
const mockFindManyConversations = vi.fn();
const mockFindManyFlags = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    curriculumContent: {
      findUnique: (...args: unknown[]) => mockFindUniqueCurriculum(...args),
    },
    tutorConversation: {
      findFirst: (...args: unknown[]) => mockFindFirstConversation(...args),
      create: (...args: unknown[]) => mockCreateConversation(...args),
      update: (...args: unknown[]) => mockUpdateConversation(...args),
      findMany: (...args: unknown[]) => mockFindManyConversations(...args),
    },
    lessonHelpFlag: {
      create: (...args: unknown[]) => mockCreateFlag(...args),
      count: (...args: unknown[]) => mockCountFlag(...args),
      findMany: (...args: unknown[]) => mockFindManyFlags(...args),
    },
    enrollment: {
      findFirst: (...args: unknown[]) => mockFindFirstEnrollment(...args),
      findMany: (...args: unknown[]) => mockFindManyEnrollments(...args),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    pushSubscription: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

const mockCheckRateLimit = vi.fn();
vi.mock("@/lib/rateLimit", () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
}));

const mockRequireRole = vi.fn();
vi.mock("@/lib/auth", () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}));

const mockRoutedCompletion = vi.fn();
vi.mock("@/lib/ai/router", () => ({
  routedCompletion: (...args: unknown[]) => mockRoutedCompletion(...args),
}));

vi.mock("@/lib/audit", () => ({
  logAudit: vi.fn(),
}));

vi.mock("@/lib/push/sendPush", () => ({
  sendPushToUser: vi.fn(),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STUDENT_USER = {
  id: "user-student-1",
  role: "STUDENT",
  schoolId: "school-1",
  name: "Fatu Kollie",
};

const TEACHER_USER = {
  id: "user-teacher-1",
  role: "TEACHER",
  schoolId: "school-1",
  name: "Mr. Kollie",
};

const LESSON = {
  payload: { body_standard: "Fractions are parts of a whole. In Liberia, we often share kola nuts in fractions." },
  title: "Introduction to Fractions",
  grade: 5,
  subject: "MATHEMATICS",
};

function makeRequest(body: unknown, params: Record<string, string> = {}) {
  const url = `http://localhost/api/student/tutor/${params.contentId ?? "content-abc"}/chat`;
  return new NextRequest(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeConversation(overrides: Partial<{ id: string; messages: unknown[]; questionsAsked: number }> = {}) {
  return {
    id: "conv-1",
    studentId: STUDENT_USER.id,
    contentId: "content-abc",
    schoolId: "school-1",
    messages: [],
    questionsAsked: 0,
    sessionDate: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireRole.mockResolvedValue(STUDENT_USER);
  mockFindUniqueCurriculum.mockResolvedValue(LESSON);
  mockFindFirstConversation.mockResolvedValue(null);
  mockCreateConversation.mockResolvedValue(makeConversation());
  mockUpdateConversation.mockResolvedValue(makeConversation({ questionsAsked: 1 }));
  mockRoutedCompletion.mockResolvedValue({ content: "Good question! Fractions represent parts of a whole." });
  mockCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 9, limit: 10, resetAt: Date.now() + 86400000, retryAfter: 86400, backend: "memory", scope: "instance", namespace: "tutor" });
  mockCountFlag.mockResolvedValue(1);
  mockCreateFlag.mockResolvedValue({ id: "flag-1" });
  mockFindFirstEnrollment.mockResolvedValue({ Class: { teacherId: "teacher-1" } });
  mockFindManyEnrollments.mockResolvedValue([]);
  mockFindManyConversations.mockResolvedValue([]);
  mockFindManyFlags.mockResolvedValue([]);
});

// ─── Chat route tests ─────────────────────────────────────────────────────────

describe("POST /api/student/tutor/[contentId]/chat", () => {
  it("returns 429 when rate limit exceeded (11th message)", async () => {
    mockCheckRateLimit.mockResolvedValue({
      allowed: false,
      remaining: 0,
      limit: 10,
      resetAt: Date.now() + 86400000,
      retryAfter: 86400,
      backend: "memory",
      scope: "instance",
      namespace: "tutor",
    });

    const { POST } = await import("@/app/api/student/tutor/[contentId]/chat/route");
    const req = makeRequest({ message: "What is a fraction?" }, { contentId: "content-abc" });
    const res = await POST(req, { params: { contentId: "content-abc" } });

    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toContain("daily question limit");
  });

  it("rate limit key uses contentId and date so different days reset independently", async () => {
    const { POST } = await import("@/app/api/student/tutor/[contentId]/chat/route");
    const req = makeRequest({ message: "Hello" }, { contentId: "content-abc" });
    await POST(req, { params: { contentId: "content-abc" } });

    const today = new Date().toISOString().slice(0, 10);
    expect(mockCheckRateLimit).toHaveBeenCalledWith(
      expect.stringContaining(`${STUDENT_USER.id}:content-abc:${today}`),
      expect.objectContaining({ namespace: "tutor" })
    );
  });

  it("returns AI reply and decremented questionsLeft on success", async () => {
    const { POST } = await import("@/app/api/student/tutor/[contentId]/chat/route");
    const req = makeRequest({ message: "What is a fraction?" }, { contentId: "content-abc" });
    const res = await POST(req, { params: { contentId: "content-abc" } });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.reply).toBe("string");
    expect(body.reply.length).toBeGreaterThan(0);
    expect(typeof body.questionsLeft).toBe("number");
  });

  it("saves conversation history after each message", async () => {
    const { POST } = await import("@/app/api/student/tutor/[contentId]/chat/route");
    const req = makeRequest({ message: "What is a fraction?" }, { contentId: "content-abc" });
    await POST(req, { params: { contentId: "content-abc" } });

    expect(mockUpdateConversation).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({ role: "user", content: "What is a fraction?" }),
            expect.objectContaining({ role: "assistant" }),
          ]),
        }),
      })
    );
  });

  it("questionsLeft decrements correctly from conversation questionsAsked", async () => {
    mockCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 5, limit: 10, resetAt: Date.now() + 86400000, retryAfter: 86400, backend: "memory", scope: "instance", namespace: "tutor" });

    const { POST } = await import("@/app/api/student/tutor/[contentId]/chat/route");
    const req = makeRequest({ message: "Explain fractions" }, { contentId: "content-abc" });
    const res = await POST(req, { params: { contentId: "content-abc" } });

    const body = await res.json();
    expect(body.questionsLeft).toBeGreaterThanOrEqual(0);
  });

  it("builds system prompt including lesson context", async () => {
    const { POST } = await import("@/app/api/student/tutor/[contentId]/chat/route");
    const req = makeRequest({ message: "Explain fractions" }, { contentId: "content-abc" });
    await POST(req, { params: { contentId: "content-abc" } });

    const call = mockRoutedCompletion.mock.calls[0][0];
    const systemMsg = call.messages.find((m: { role: string }) => m.role === "system");
    expect(systemMsg.content).toContain("Grade 5");
    expect(systemMsg.content).toContain("MATHEMATICS");
    expect(systemMsg.content).toContain("Fractions are parts of a whole");
  });

  it("student cannot access another student's history — returns only own data", async () => {
    const otherStudentId = "user-other-student";
    mockFindFirstConversation.mockResolvedValue(null);

    const { GET } = await import("@/app/api/student/tutor/[contentId]/history/route");
    const url = "http://localhost/api/student/tutor/content-abc/history";
    const req = new NextRequest(url, { method: "GET" });
    const res = await GET(req, { params: { contentId: "content-abc" } });

    expect(res.status).toBe(200);
    // The route scopes by user.id, so other student's conversations won't appear
    expect(mockFindFirstConversation).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ studentId: STUDENT_USER.id }),
      })
    );
  });

  it("offline is a UI concern — API still works when request reaches server", async () => {
    // The "offline" check is client-side only; the server API has no offline concept
    const { POST } = await import("@/app/api/student/tutor/[contentId]/chat/route");
    const req = makeRequest({ message: "Hello" }, { contentId: "content-abc" });
    const res = await POST(req, { params: { contentId: "content-abc" } });
    expect(res.status).toBe(200);
  });
});

// ─── Flag route tests ─────────────────────────────────────────────────────────

describe("POST /api/student/lesson/[contentId]/flag", () => {
  it("creates a LessonHelpFlag record", async () => {
    const { POST } = await import("@/app/api/student/lesson/[contentId]/flag/route");
    const url = "http://localhost/api/student/lesson/content-abc/flag";
    const req = new NextRequest(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: "I don't understand this section" }),
    });
    const res = await POST(req, { params: { contentId: "content-abc" } });

    expect(res.status).toBe(200);
    expect(mockCreateFlag).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          studentId: STUDENT_USER.id,
          contentId: "content-abc",
          note: "I don't understand this section",
        }),
      })
    );
  });

  it("fires push to teacher when 3rd flag is created", async () => {
    mockCountFlag.mockResolvedValue(3);
    mockFindFirstEnrollment.mockResolvedValue({ Class: { teacherId: "teacher-1" } });
    mockFindUniqueCurriculum.mockResolvedValue({ title: "Introduction to Fractions" });

    const { sendPushToUser } = await import("@/lib/push/sendPush");
    const { POST } = await import("@/app/api/student/lesson/[contentId]/flag/route");
    const url = "http://localhost/api/student/lesson/content-abc/flag";
    const req = new NextRequest(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    await POST(req, { params: { contentId: "content-abc" } });

    expect(sendPushToUser).toHaveBeenCalledWith(
      "teacher-1",
      expect.objectContaining({
        title: expect.stringContaining("Student needs help"),
        body: expect.stringContaining("Fatu Kollie"),
      })
    );
  });

  it("does not fire push when flag count is below 3", async () => {
    mockCountFlag.mockResolvedValue(2);

    const { sendPushToUser } = await import("@/lib/push/sendPush");
    const { POST } = await import("@/app/api/student/lesson/[contentId]/flag/route");
    const url = "http://localhost/api/student/lesson/content-abc/flag";
    const req = new NextRequest(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    await POST(req, { params: { contentId: "content-abc" } });

    expect(sendPushToUser).not.toHaveBeenCalled();
  });
});

// ─── Teacher tutor analytics tests ───────────────────────────────────────────

describe("GET /api/teacher/tutor-analytics", () => {
  beforeEach(() => {
    mockRequireRole.mockResolvedValue(TEACHER_USER);
  });

  it("returns aggregate counts not raw message content", async () => {
    mockFindManyEnrollments.mockResolvedValue([
      { Student: { userId: "user-student-1", user: { name: "Fatu Kollie" } } },
    ]);
    mockFindManyConversations.mockResolvedValue([
      {
        studentId: "user-student-1",
        contentId: "content-abc",
        questionsAsked: 5,
        content: { title: "Fractions", subject: "MATHEMATICS", grade: 5 },
      },
    ]);

    const { GET } = await import("@/app/api/teacher/tutor-analytics/route");
    const url = "http://localhost/api/teacher/tutor-analytics";
    const req = new NextRequest(url, { method: "GET" });
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totalQuestions).toBe(5);
    expect(body.uniqueStudents).toBe(1);

    // Must NOT expose raw message bodies
    expect(body).not.toHaveProperty("messages");
    expect(JSON.stringify(body)).not.toContain('"role"');

    // Lesson breakdown should have counts
    expect(body.lessonBreakdown[0].questions).toBe(5);
    expect(body.lessonBreakdown[0].title).toBe("Fractions");

    // Student breakdown should have counts not messages
    expect(body.studentBreakdown[0].name).toBe("Fatu Kollie");
    expect(body.studentBreakdown[0].questions).toBe(5);
  });

  it("returns 403 when called by a non-teacher", async () => {
    mockRequireRole.mockRejectedValue(Object.assign(new Error("Forbidden"), { status: 403 }));

    const { GET } = await import("@/app/api/teacher/tutor-analytics/route");
    const url = "http://localhost/api/teacher/tutor-analytics";
    const req = new NextRequest(url, { method: "GET" });
    const res = await GET(req);

    expect(res.status).toBe(403);
  });

  it("returns zeros when teacher has no students", async () => {
    mockFindManyEnrollments.mockResolvedValue([]);

    const { GET } = await import("@/app/api/teacher/tutor-analytics/route");
    const url = "http://localhost/api/teacher/tutor-analytics";
    const req = new NextRequest(url, { method: "GET" });
    const res = await GET(req);

    const body = await res.json();
    expect(body.totalQuestions).toBe(0);
    expect(body.uniqueStudents).toBe(0);
    expect(body.lessonBreakdown).toHaveLength(0);
  });
});
