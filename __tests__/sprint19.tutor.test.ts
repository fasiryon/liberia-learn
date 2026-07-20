/**
 * Sprint 19 — Lesson Help Flags, Teacher Tutor Analytics
 *
 * The AI Conversational Tutor coverage (POST /api/student/tutor/[contentId]/chat
 * and its history route) was removed by the Tutor Architecture Consolidation
 * sprint: that path was a deprecated, zero-retrieval duplicate of the grounded
 * GlobalAssistantShell experience and had zero real TutorConversation rows.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockFindUniqueCurriculum = vi.fn();
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

const mockRequireRole = vi.fn();
vi.mock("@/lib/auth", () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
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

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireRole.mockResolvedValue(STUDENT_USER);
  mockCountFlag.mockResolvedValue(1);
  mockCreateFlag.mockResolvedValue({ id: "flag-1" });
  mockFindFirstEnrollment.mockResolvedValue({ Class: { teacherId: "teacher-1" } });
  mockFindManyEnrollments.mockResolvedValue([]);
  mockFindManyConversations.mockResolvedValue([]);
  mockFindManyFlags.mockResolvedValue([]);
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
