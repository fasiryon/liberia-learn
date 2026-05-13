import { describe, it, expect, vi, beforeEach } from "vitest";

// ===== Hoisted mocks =====
const {
  mockPrisma,
  mockRequireUser,
  mockSendPushToUser,
  mockBuildPortfolioSummary,
} = vi.hoisted(() => {
  const mockPrisma = {
    student: { findUnique: vi.fn() },
    school: { findUnique: vi.fn() },
    enrollment: { findFirst: vi.fn() },
    certificate: { findMany: vi.fn() },
    learningEvent: { findMany: vi.fn() },
    capstoneProject: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    portfolioShare: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    portfolioItem: { create: vi.fn() },
    discussionPost: { findMany: vi.fn() },
    assessmentAttempt: { findMany: vi.fn() },
    assignmentSubmission: { findMany: vi.fn() },
    studentBadgeAward: { findMany: vi.fn() },
  };
  const mockRequireUser = vi.fn();
  const mockSendPushToUser = vi.fn().mockResolvedValue(undefined);
  const mockBuildPortfolioSummary = vi.fn();
  return { mockPrisma, mockRequireUser, mockSendPushToUser, mockBuildPortfolioSummary };
});

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ requireUser: mockRequireUser, authOptions: {} }));
vi.mock("@/lib/push/sendPush", () => ({ sendPushToUser: mockSendPushToUser }));
vi.mock("@/lib/portfolio/buildPortfolio", () => ({ buildPortfolioSummary: mockBuildPortfolioSummary }));

import { POST as sharePost } from "@/app/api/student/portfolio/share/route";
import { GET as publicShareGet } from "@/app/api/portfolio/[shareCode]/route";
import { POST as capstonePost, GET as capstoneGet } from "@/app/api/student/capstone/route";
import { PATCH as capstonePatch } from "@/app/api/student/capstone/[id]/route";
import { POST as capstoneSubmit } from "@/app/api/student/capstone/[id]/submit/route";
import { POST as capstoneRevise } from "@/app/api/student/capstone/[id]/revise/route";
import { GET as teacherCapstoneGet } from "@/app/api/teacher/capstone/route";
import { PATCH as teacherReview } from "@/app/api/teacher/capstone/[id]/review/route";
import { buildPortfolioSummary } from "@/lib/portfolio/buildPortfolio";

function makeReq(body?: Record<string, unknown>, url = "http://localhost/api") {
  return new Request(url, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

const STUDENT_USER = { id: "u1", role: "STUDENT", name: "Fatu Kollie", schoolId: "s1", isPlatformAdmin: false };
const TEACHER_USER = { id: "t1", role: "TEACHER", name: "Mr. Smith", schoolId: "s1", isPlatformAdmin: false };
const G10_STUDENT = { id: "st1", currentGrade: 10 };
const G9_STUDENT  = { id: "st9", currentGrade: 9 };

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireUser.mockResolvedValue(STUDENT_USER);
  mockPrisma.student.findUnique.mockResolvedValue(G10_STUDENT);
});

// ========= Portfolio share =========

describe("POST /api/student/portfolio/share", () => {
  it("creates share when none exists", async () => {
    mockPrisma.portfolioShare.findFirst.mockResolvedValueOnce(null);
    mockPrisma.portfolioShare.create.mockResolvedValueOnce({ shareCode: "abc123" });

    const res = await sharePost();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.shareCode).toBe("abc123");
    expect(data.shareUrl).toContain("abc123");
  });

  it("returns existing active share", async () => {
    mockPrisma.portfolioShare.findFirst.mockResolvedValueOnce({ shareCode: "existing99" });

    const res = await sharePost();
    const data = await res.json();
    expect(data.shareCode).toBe("existing99");
    expect(mockPrisma.portfolioShare.create).not.toHaveBeenCalled();
  });

  it("returns 403 for non-student", async () => {
    mockRequireUser.mockResolvedValueOnce(TEACHER_USER);
    const res = await sharePost();
    expect(res.status).toBe(403);
  });
});

// ========= Public portfolio share page =========

describe("GET /api/portfolio/[shareCode]", () => {
  const mockSummary = {
    firstName: "Fatu",
    gradeLevel: 10,
    schoolName: "CHA",
    lessonsCompleted: 5,
    quizAverage: 0.85,
    certificatesEarned: 2,
    badgesEarned: 3,
    labSessions: 4,
    dayStreak: 7,
    badges: [{ key: "first_lesson", title: "First Lesson" }],
    subjectsStudied: ["MATH"],
  };

  it("returns safe public fields only", async () => {
    mockPrisma.portfolioShare.findUnique.mockResolvedValueOnce({ studentId: "st1", isActive: true });
    mockBuildPortfolioSummary.mockResolvedValueOnce({ ...mockSummary, fullName: "Fatu Kollie", userId: "u1" });

    const res = await publicShareGet(makeReq() as any, { params: { shareCode: "abc123" } } as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.firstName).toBe("Fatu");
    expect(data).not.toHaveProperty("fullName");
    expect(data).not.toHaveProperty("userId");
    expect(data).not.toHaveProperty("email");
  });

  it("returns 404 for inactive share", async () => {
    mockPrisma.portfolioShare.findUnique.mockResolvedValueOnce({ studentId: "st1", isActive: false });
    const res = await publicShareGet(makeReq() as any, { params: { shareCode: "dead" } } as any);
    expect(res.status).toBe(404);
  });

  it("returns 404 for unknown code", async () => {
    mockPrisma.portfolioShare.findUnique.mockResolvedValueOnce(null);
    const res = await publicShareGet(makeReq() as any, { params: { shareCode: "unknown" } } as any);
    expect(res.status).toBe(404);
  });
});

// ========= Capstone — student =========

describe("POST /api/student/capstone (Grade 10+)", () => {
  it("creates capstone for Grade 10 student", async () => {
    mockPrisma.capstoneProject.create.mockResolvedValueOnce({ id: "cp1", title: "My Project", status: "DRAFT" });
    const req = new Request("http://localhost/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "My Project", description: "desc" }),
    });
    const res = await capstonePost(req as any);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.status).toBe("DRAFT");
  });

  it("returns 403 for Grade 9 student", async () => {
    mockPrisma.student.findUnique.mockResolvedValueOnce(G9_STUDENT);
    const req = new Request("http://localhost/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "My Project" }),
    });
    const res = await capstonePost(req as any);
    expect(res.status).toBe(403);
  });
});

describe("PATCH /api/student/capstone/[id] (DRAFT only)", () => {
  it("updates DRAFT project", async () => {
    mockPrisma.capstoneProject.findUnique.mockResolvedValueOnce({ studentId: "st1", status: "DRAFT" });
    mockPrisma.capstoneProject.update.mockResolvedValueOnce({ id: "cp1", title: "Updated", status: "DRAFT" });
    const req = new Request("http://localhost/", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Updated" }),
    });
    const res = await capstonePatch(req as any, { params: { id: "cp1" } } as any);
    expect(res.status).toBe(200);
  });

  it("blocks editing SUBMITTED project", async () => {
    mockPrisma.capstoneProject.findUnique.mockResolvedValueOnce({ studentId: "st1", status: "SUBMITTED" });
    const req = new Request("http://localhost/", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Sneaky edit" }),
    });
    const res = await capstonePatch(req as any, { params: { id: "cp1" } } as any);
    expect(res.status).toBe(400);
  });
});

describe("POST /api/student/capstone/[id]/submit", () => {
  it("submits DRAFT and fires push to teacher", async () => {
    mockPrisma.capstoneProject.findUnique.mockResolvedValueOnce({ studentId: "st1", status: "DRAFT", title: "My Cap" });
    mockPrisma.capstoneProject.update.mockResolvedValueOnce({ id: "cp1", status: "SUBMITTED" });
    mockPrisma.enrollment.findFirst.mockResolvedValueOnce({ Class: { teacherId: "t1" } });

    const res = await capstoneSubmit(makeReq() as any, { params: { id: "cp1" } } as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("SUBMITTED");
    expect(mockSendPushToUser).toHaveBeenCalledWith("t1", expect.objectContaining({ title: "Capstone Submitted" }));
  });
});

// ========= Capstone — teacher review =========

describe("PATCH /api/teacher/capstone/[id]/review", () => {
  beforeEach(() => {
    mockRequireUser.mockResolvedValue(TEACHER_USER);
  });

  it("approves and creates PortfolioItem", async () => {
    mockPrisma.capstoneProject.findUnique.mockResolvedValueOnce({ id: "cp1", studentId: "st1", title: "Cap", status: "SUBMITTED" });
    mockPrisma.capstoneProject.update.mockResolvedValueOnce({ id: "cp1", status: "APPROVED" });
    mockPrisma.portfolioItem.create.mockResolvedValueOnce({ id: "pi1" });
    mockPrisma.student.findUnique.mockResolvedValueOnce({ userId: "u1" });

    const req = new Request("http://localhost/", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision: "APPROVED", feedback: "Great work!" }),
    });
    const res = await teacherReview(req as any, { params: { id: "cp1" } } as any);
    expect(res.status).toBe(200);
    expect(mockPrisma.portfolioItem.create).toHaveBeenCalled();
    expect(mockSendPushToUser).toHaveBeenCalledWith("u1", expect.objectContaining({ title: "Your capstone was approved! 🎉" }));
  });

  it("rejects and fires push to student", async () => {
    mockPrisma.capstoneProject.findUnique.mockResolvedValueOnce({ id: "cp1", studentId: "st1", title: "Cap", status: "SUBMITTED" });
    mockPrisma.capstoneProject.update.mockResolvedValueOnce({ id: "cp1", status: "REJECTED" });
    mockPrisma.student.findUnique.mockResolvedValueOnce({ userId: "u1" });

    const req = new Request("http://localhost/", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision: "REJECTED", feedback: "Needs more detail" }),
    });
    const res = await teacherReview(req as any, { params: { id: "cp1" } } as any);
    expect(res.status).toBe(200);
    expect(mockPrisma.portfolioItem.create).not.toHaveBeenCalled();
    expect(mockSendPushToUser).toHaveBeenCalledWith("u1", expect.objectContaining({ title: "Your capstone needs revision" }));
  });

  it("requires feedback when rejecting", async () => {
    // Route validates feedback BEFORE querying DB — no findUnique mock needed
    const req = new Request("http://localhost/", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision: "REJECTED", feedback: "" }),
    });
    const res = await teacherReview(req as any, { params: { id: "cp1" } } as any);
    expect(res.status).toBe(400);
  });

  it("rejects without creating PortfolioItem", async () => {
    mockPrisma.capstoneProject.findUnique.mockResolvedValueOnce({ id: "cp1", studentId: "st1", title: "Cap", status: "SUBMITTED" });
    mockPrisma.capstoneProject.update.mockResolvedValueOnce({ id: "cp1", status: "REJECTED" });
    mockPrisma.student.findUnique.mockResolvedValueOnce({ userId: "u1" });

    const req = new Request("http://localhost/", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision: "REJECTED", feedback: "Missing analysis section" }),
    });
    await teacherReview(req as any, { params: { id: "cp1" } } as any);
    expect(mockPrisma.portfolioItem.create).not.toHaveBeenCalled();
  });
});

// ========= Capstone revise =========

describe("POST /api/student/capstone/[id]/revise", () => {
  it("resets REJECTED capstone to DRAFT", async () => {
    mockPrisma.capstoneProject.findUnique.mockResolvedValueOnce({ studentId: "st1", status: "REJECTED" });
    mockPrisma.capstoneProject.update.mockResolvedValueOnce({ id: "cp1", status: "DRAFT" });

    const res = await capstoneRevise(makeReq() as any, { params: { id: "cp1" } } as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("DRAFT");
  });

  it("blocks revising SUBMITTED capstone", async () => {
    mockPrisma.capstoneProject.findUnique.mockResolvedValueOnce({ studentId: "st1", status: "SUBMITTED" });
    const res = await capstoneRevise(makeReq() as any, { params: { id: "cp1" } } as any);
    expect(res.status).toBe(400);
  });
});

// ========= buildPortfolioSummary unit =========

describe("buildPortfolioSummary", () => {
  it("aggregates data into summary shape", async () => {
    // Use real implementation (unmocked for this test)
    const { buildPortfolioSummary: realBuild } = await vi.importActual<typeof import("@/lib/portfolio/buildPortfolio")>("@/lib/portfolio/buildPortfolio");

    const student = { userId: "u1", currentGrade: 10 };
    mockPrisma.student.findUnique.mockResolvedValueOnce({ ...student, user: { id: "u1", name: "Fatu Kollie", schoolId: "s1" } });
    mockPrisma.school.findUnique.mockResolvedValueOnce({ name: "CHA School" });
    mockPrisma.learningEvent.findMany
      .mockResolvedValueOnce([
        { eventType: "lesson.completed", occurredAt: new Date("2026-05-01"), metadata: { subject: "MATH" } },
        { eventType: "lesson.completed", occurredAt: new Date("2026-05-02"), metadata: { subject: "SCIENCE" } },
      ])
      .mockResolvedValueOnce([{ id: "lab1" }]);
    mockPrisma.assessmentAttempt.findMany.mockResolvedValueOnce([{ score: 8, maxScore: 10 }]);
    mockPrisma.assignmentSubmission.findMany.mockResolvedValueOnce([{ score: 85 }]);
    mockPrisma.certificate.findMany.mockResolvedValueOnce([{ id: "c1", type: "COURSE_COMPLETION", awardedAt: new Date(), certificateCode: "C001", canvaUrl: null }]);
    mockPrisma.studentBadgeAward.findMany.mockResolvedValueOnce([{ badgeKey: "first_lesson", title: "First Lesson", awardedAt: new Date() }]);
    mockPrisma.capstoneProject.findMany.mockResolvedValueOnce([]);
    mockPrisma.discussionPost.findMany.mockResolvedValueOnce([{ id: "p1" }, { id: "p2" }]);

    const summary = await realBuild("st1");
    expect(summary.lessonsCompleted).toBe(2);
    expect(summary.badgesEarned).toBe(1);
    expect(summary.certificatesEarned).toBe(1);
    expect(summary.subjectsStudied).toContain("MATH");
    expect(summary.discussionContributions).toBe(2);
    expect(summary.firstName).toBe("Fatu");
  });
});

// ========= Share URL uniqueness =========

describe("Share URL uniqueness", () => {
  it("two different students get different share codes", async () => {
    const codes = new Set<string>();
    mockPrisma.portfolioShare.findFirst.mockResolvedValue(null);
    mockPrisma.portfolioShare.create
      .mockResolvedValueOnce({ shareCode: "code-for-student-1" })
      .mockResolvedValueOnce({ shareCode: "code-for-student-2" });

    mockPrisma.student.findUnique
      .mockResolvedValueOnce({ id: "st1" })
      .mockResolvedValueOnce({ id: "st2" });

    for (let i = 0; i < 2; i++) {
      const res = await sharePost();
      const data = await res.json();
      codes.add(data.shareCode);
    }
    expect(codes.size).toBe(2);
  });
});
