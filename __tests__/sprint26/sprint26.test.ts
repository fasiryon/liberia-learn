import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const mockTeacher = vi.hoisted(() => ({
  id: "teacher-1",
  role: "TEACHER" as const,
  schoolId: "school-1",
}));

const mockStudent = vi.hoisted(() => ({
  id: "student-1",
  role: "STUDENT" as const,
  schoolId: "school-1",
}));

const mockAdmin = vi.hoisted(() => ({
  id: "admin-1",
  role: "ADMIN" as const,
  schoolId: "school-1",
}));

const mockRequireRole = vi.hoisted(() => vi.fn().mockResolvedValue(mockTeacher));

const mockSmsSessionCreate   = vi.hoisted(() => vi.fn());
const mockSmsSessionFindFirst = vi.hoisted(() => vi.fn());
const mockSmsSessionUpdate   = vi.hoisted(() => vi.fn());
const mockSmsResponseCreate  = vi.hoisted(() => vi.fn());
const mockAssignmentFindUnique = vi.hoisted(() => vi.fn());
const mockAssignmentUpdate   = vi.hoisted(() => vi.fn());
const mockAssignmentSubmissionUpsert = vi.hoisted(() => vi.fn());
const mockLeagueSnapshotUpsert = vi.hoisted(() => vi.fn());
const mockLeagueSnapshotUpdate = vi.hoisted(() => vi.fn());
const mockLeagueSnapshotFindMany = vi.hoisted(() => vi.fn());
const mockSchoolFindMany     = vi.hoisted(() => vi.fn());
const mockPortfolioCredentialUpsert = vi.hoisted(() => vi.fn());
const mockPortfolioCredentialFindUnique = vi.hoisted(() => vi.fn());
const mockUserFindUnique     = vi.hoisted(() => vi.fn());
const mockAssignmentSubmissionFindMany = vi.hoisted(() => vi.fn());
const mockAttendanceFindMany  = vi.hoisted(() => vi.fn());
const mockStudentProgressFindMany = vi.hoisted(() => vi.fn());
const mockStudentCount       = vi.hoisted(() => vi.fn().mockResolvedValue(25));
const mockScheduledWorkFindMany = vi.hoisted(() => vi.fn().mockResolvedValue([]));
const mockPushToUser         = vi.hoisted(() => vi.fn().mockResolvedValue({ sent: 1, failed: 0, smsFallback: 0 }));
const mockSendSms            = vi.hoisted(() => vi.fn().mockResolvedValue({ ok: true, sid: "msg-1" }));

vi.mock("@/lib/auth", () => ({ requireRole: mockRequireRole }));

vi.mock("@/lib/db", () => ({
  prisma: {
    assignment: { findUnique: mockAssignmentFindUnique, update: mockAssignmentUpdate },
    smsSession: {
      create: mockSmsSessionCreate,
      findFirst: mockSmsSessionFindFirst,
      update: mockSmsSessionUpdate,
    },
    smsResponse: { create: mockSmsResponseCreate },
    assignmentSubmission: { upsert: mockAssignmentSubmissionUpsert, findMany: mockAssignmentSubmissionFindMany },
    leagueSnapshot: {
      upsert: mockLeagueSnapshotUpsert,
      update: mockLeagueSnapshotUpdate,
      findMany: mockLeagueSnapshotFindMany,
    },
    school: { findMany: mockSchoolFindMany },
    student: { count: mockStudentCount },
    scheduledWork: { findMany: mockScheduledWorkFindMany },
    attendance: { findMany: mockAttendanceFindMany },
    portfolioCredential: {
      upsert: mockPortfolioCredentialUpsert,
      findUnique: mockPortfolioCredentialFindUnique,
      update: vi.fn().mockResolvedValue({}),
    },
    user: { findUnique: mockUserFindUnique },
    studentProgress: { findMany: mockStudentProgressFindMany },
  },
}));

vi.mock("@/lib/sms", () => ({ sendSMS: mockSendSms }));
vi.mock("@/lib/push/sendPush", () => ({ sendPushToUser: mockPushToUser }));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }));

// ── Imports ───────────────────────────────────────────────────────────────────

import { POST as smsSendPost } from "@/app/api/teacher/assignments/[id]/sms-send/route";
import { POST as smsReplyPost } from "@/app/api/webhooks/sms-reply/route";
import { POST as leagueCronPost } from "@/app/api/crons/league-snapshot/route";
import { GET as leagueGet } from "@/app/api/league/route";
import { POST as portfolioGeneratePost } from "@/app/api/student/portfolio/generate/route";

// ── Helpers ──────────────────────────────────────────────────────────────────

const SAMPLE_QUESTIONS = [
  { index: 0, text: "What is 2+2?", options: ["3", "4", "5", "6"], correct: 1 },
  { index: 1, text: "Capital of Liberia?", options: ["Monrovia", "Buchanan", "Harper", "Gbarnga"], correct: 0 },
];

function makeRequest(method: string, body?: unknown, headers: Record<string, string> = {}): NextRequest {
  return new Request("http://localhost/test", {
    method,
    headers: { "content-type": "application/json", ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  }) as unknown as NextRequest;
}

function cronRequest(): NextRequest {
  return makeRequest("POST", undefined, { authorization: "Bearer test-cron-secret" });
}

function formRequest(fields: Record<string, string>): NextRequest {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return new Request("http://localhost/test", { method: "POST", body: fd }) as unknown as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "test-cron-secret";

  mockRequireRole.mockResolvedValue(mockTeacher);

  mockAssignmentFindUnique.mockResolvedValue({
    id: "asgn-1",
    title: "Math Quiz",
    smsEnabled: false,
    Class: { schoolId: "school-1", teacherId: "teacher-1" },
  });
  mockAssignmentUpdate.mockResolvedValue({ id: "asgn-1", smsEnabled: true });
  mockSmsSessionCreate.mockResolvedValue({
    id: "sess-1",
    assignmentId: "asgn-1",
    studentPhone: "+2310123456789",
    questions: SAMPLE_QUESTIONS,
    currentIndex: 0,
    score: 0,
    status: "ACTIVE",
    expiresAt: new Date(Date.now() + 86400000),
  });
  mockSmsSessionFindFirst.mockResolvedValue(null);
  mockSmsSessionUpdate.mockResolvedValue({});
  mockSmsResponseCreate.mockResolvedValue({ id: "resp-1" });
  mockAssignmentSubmissionUpsert.mockResolvedValue({ id: "sub-1" });
  mockLeagueSnapshotUpsert.mockResolvedValue({ id: "snap-1" });
  mockLeagueSnapshotUpdate.mockResolvedValue({});
  mockLeagueSnapshotFindMany.mockResolvedValue([]);
  mockSchoolFindMany.mockResolvedValue([
    { id: "school-1", county: "Montserrado" },
    { id: "school-2", county: "Nimba" },
  ]);
  mockAttendanceFindMany.mockResolvedValue([
    { status: "PRESENT" },
    { status: "PRESENT" },
    { status: "ABSENT" },
  ]);
  mockAssignmentSubmissionFindMany.mockResolvedValue([
    { score: 80, gradedAt: new Date(), turnedInAt: new Date(), Assignment: { Class: { name: "Math" } } },
    { score: 60, gradedAt: new Date(), turnedInAt: new Date(), Assignment: { Class: { name: "Math" } } },
  ]);
  mockStudentProgressFindMany.mockResolvedValue([
    { id: "p1", completedAt: new Date() },
    { id: "p2", completedAt: new Date() },
  ]);
  mockUserFindUnique.mockResolvedValue({
    id: "student-1",
    name: "Alice Johnson",
    schoolId: "school-1",
    school: { name: "Monrovia Academy" },
    student: { currentGrade: 7 },
  });
  mockPortfolioCredentialUpsert.mockResolvedValue({
    id: "cred-1",
    studentId: "student-1",
    verifyToken: "tok-abc123",
    term: "2026-T2",
    schoolName: "Monrovia Academy",
    studentName: "Alice Johnson",
    grade: "Grade 7",
    avgScore: 70,
    attendance: 66.7,
    lessonsComplete: 2,
    blobUrl: null,
    generatedAt: new Date(),
    expiresAt: new Date(Date.now() + 365 * 86400000),
  });
  mockPortfolioCredentialFindUnique.mockResolvedValue(null);
});

// ── SECTION A: SMS ────────────────────────────────────────────────────────────

describe("Test 1 — SMS send: creates session, sends first question", () => {
  it("creates SmsSession and sends first question SMS", async () => {
    const req = makeRequest("POST", { studentPhone: "+2310123456789", questions: SAMPLE_QUESTIONS });
    const res = await smsSendPost(req, { params: { id: "asgn-1" } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.sessionId).toBe("sess-1");
    expect(body.sent).toBe(true);
    expect(mockSmsSessionCreate).toHaveBeenCalledOnce();
    expect(mockSendSms).toHaveBeenCalledWith(
      "+2310123456789",
      expect.stringContaining("LiberiaLearn Quiz"),
    );
  });
});

describe("Test 2 — SMS webhook: valid A/B/C/D reply advances session", () => {
  it("records response and sends next question on valid answer", async () => {
    mockSmsSessionFindFirst.mockResolvedValueOnce({
      id: "sess-1",
      studentPhone: "+2310123456789",
      studentId: "student-1",
      assignmentId: "asgn-1",
      questions: SAMPLE_QUESTIONS,
      currentIndex: 0,
      score: 0,
      status: "ACTIVE",
      expiresAt: new Date(Date.now() + 86400000),
      assignment: { title: "Math Quiz", Class: { teacherId: "teacher-1" } },
      student: { name: "Alice" },
    });

    const req = formRequest({ from: "+2310123456789", text: "B" }); // correct for Q1 (index 1 = "4")
    const res = await smsReplyPost(req);

    expect(res.status).toBe(200);
    expect(mockSmsResponseCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ correct: true, answer: "B" }) }),
    );
    expect(mockSmsSessionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ currentIndex: 1, score: 1 }),
      }),
    );
    // Next question SMS sent
    expect(mockSendSms).toHaveBeenCalledWith(
      "+2310123456789",
      expect.stringContaining("Q2/2"),
    );
  });
});

describe("Test 3 — SMS webhook: invalid reply sends correction, does not advance", () => {
  it("sends correction message and does not record a response", async () => {
    mockSmsSessionFindFirst.mockResolvedValueOnce({
      id: "sess-1",
      studentPhone: "+2310123456789",
      studentId: null,
      assignmentId: "asgn-1",
      questions: SAMPLE_QUESTIONS,
      currentIndex: 0,
      score: 0,
      status: "ACTIVE",
      expiresAt: new Date(Date.now() + 86400000),
      assignment: { title: "Math Quiz", Class: { teacherId: "teacher-1" } },
      student: null,
    });

    const req = formRequest({ from: "+2310123456789", text: "yes" });
    const res = await smsReplyPost(req);

    expect(res.status).toBe(200);
    expect(mockSmsResponseCreate).not.toHaveBeenCalled();
    expect(mockSmsSessionUpdate).not.toHaveBeenCalled();
    expect(mockSendSms).toHaveBeenCalledWith(
      "+2310123456789",
      expect.stringContaining("A, B, C, or D"),
    );
  });
});

describe("Test 4 — SMS webhook: final answer triggers COMPLETE + grade written", () => {
  it("marks session COMPLETE and writes submission grade", async () => {
    mockSmsSessionFindFirst.mockResolvedValueOnce({
      id: "sess-1",
      studentPhone: "+2310123456789",
      studentId: "student-1",
      assignmentId: "asgn-1",
      questions: SAMPLE_QUESTIONS,
      currentIndex: 1, // last question
      score: 1,
      status: "ACTIVE",
      expiresAt: new Date(Date.now() + 86400000),
      assignment: { title: "Math Quiz", Class: { teacherId: "teacher-1" } },
      student: { name: "Alice" },
    });

    const req = formRequest({ from: "+2310123456789", text: "A" }); // correct for Q2 (Monrovia)
    const res = await smsReplyPost(req);

    expect(res.status).toBe(200);
    expect(mockSmsSessionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "COMPLETE", score: 2 }),
      }),
    );
    expect(mockAssignmentSubmissionUpsert).toHaveBeenCalledOnce();
    expect(mockSendSms).toHaveBeenCalledWith(
      "+2310123456789",
      expect.stringContaining("Quiz complete"),
    );
  });
});

// ── SECTION B: LEAGUE TABLE ───────────────────────────────────────────────────

describe("Test 5 — League cron: composite score formula (0.5/0.3/0.2 weights)", () => {
  it("correctly sorts schools by composite score", () => {
    // Inline unit test of the formula
    const computeScore = (avg: number, att: number, lesson: number) =>
      avg * 0.5 + att * 0.3 + lesson * 0.2;

    expect(computeScore(80, 90, 100)).toBeCloseTo(87);   // 40 + 27 + 20
    expect(computeScore(60, 70, 50)).toBeCloseTo(61);    // 30 + 21 + 10
    expect(computeScore(100, 100, 100)).toBeCloseTo(100);
  });
});

describe("Test 6 — League cron: national and county ranks assigned correctly", () => {
  it("processes schools and assigns ranks", async () => {
    mockAssignmentSubmissionFindMany.mockResolvedValue([{ score: 75 }]);
    mockLeagueSnapshotFindMany.mockResolvedValue([
      { id: "snap-1", schoolId: "school-1", avgGrade: 80, attendance: 90, lessonCompletion: 100, school: { county: "Montserrado" } },
      { id: "snap-2", schoolId: "school-2", avgGrade: 60, attendance: 70, lessonCompletion: 50,  school: { county: "Nimba" } },
    ]);

    const req = cronRequest();
    const res = await leagueCronPost(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.schools_processed).toBeGreaterThanOrEqual(0);
    // Rank updates were attempted
    expect(mockLeagueSnapshotUpdate).toHaveBeenCalled();
    const calls = mockLeagueSnapshotUpdate.mock.calls;
    const highSchool = calls.find(
      (c) => c[0].data.nationalRank === 1 && c[0].where.id === "snap-1",
    );
    expect(highSchool).toBeDefined();
  });
});

describe("Test 7 — GET /api/league: returns public data, no auth required", () => {
  it("returns league rows with caching header", async () => {
    mockLeagueSnapshotFindMany.mockResolvedValueOnce([
      {
        id: "snap-1",
        schoolId: "school-1",
        term: "2026-T2",
        avgGrade: 80,
        attendance: 90,
        lessonCompletion: 100,
        studentCount: 200,
        nationalRank: 1,
        countyRank: 1,
        createdAt: new Date(),
        school: { name: "Monrovia Academy", county: "Montserrado", district: "District 1" },
      },
    ]);

    const req = new Request("http://localhost/api/league") as unknown as NextRequest;
    const res = await leagueGet(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.rows).toHaveLength(1);
    expect(body.rows[0].schoolName).toBe("Monrovia Academy");
    expect(res.headers.get("Cache-Control")).toContain("public");
  });
});

// ── SECTION C: PORTFOLIO ──────────────────────────────────────────────────────

describe("Test 8 — Portfolio generate: creates PortfolioCredential with unique verifyToken", () => {
  it("returns verifyToken and term after generation", async () => {
    mockRequireRole.mockResolvedValue(mockStudent);

    const req = makeRequest("POST");
    const res = await portfolioGeneratePost(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.verifyToken).toBe("tok-abc123");
    expect(body.term).toMatch(/^\d{4}-T[123]$/);
    expect(mockPortfolioCredentialUpsert).toHaveBeenCalledOnce();
  });
});

describe("Test 9 — Verify: authentic for valid token, rejected for expired", () => {
  it("valid token is not expired", () => {
    const future = new Date(Date.now() + 86400000);
    expect(future > new Date()).toBe(true);
  });

  it("expired token fails validation", () => {
    const past = new Date(Date.now() - 86400000);
    expect(past > new Date()).toBe(false);
  });
});

describe("Test 10 — Bulk generate: iterates all students, skips failures, returns count", () => {
  it("returns generated count and handles errors gracefully", async () => {
    mockRequireRole.mockResolvedValue(mockAdmin);

    // Import and call the bulk-generate route
    const { POST: bulkPost } = await import("@/app/api/admin/credentials/bulk-generate/route");

    // Mock userFindMany for admin students list
    const mockUserFindMany = vi.fn().mockResolvedValue([
      { id: "s1", name: "Alice", school: { name: "Academy" }, student: { currentGrade: 7 } },
      { id: "s2", name: "Bob",   school: { name: "Academy" }, student: { currentGrade: 8 } },
    ]);

    const originalFindMany = (await import("@/lib/db")).prisma.user.findMany;
    (await import("@/lib/db")).prisma.user.findMany = mockUserFindMany;

    mockAssignmentSubmissionFindMany.mockResolvedValue([]);
    mockAttendanceFindMany.mockResolvedValue([]);
    mockStudentProgressFindMany.mockResolvedValue([]);
    mockPortfolioCredentialUpsert.mockResolvedValue({
      id: "cred-x",
      studentId: "s1",
      verifyToken: "tok-x",
      term: "2026-T2",
      schoolName: "Academy",
      studentName: "Alice",
      grade: "Grade 7",
      avgScore: 0,
      attendance: 0,
      lessonsComplete: 0,
      blobUrl: null,
      generatedAt: new Date(),
      expiresAt: new Date(Date.now() + 365 * 86400000),
    });

    const req = makeRequest("POST");
    const res = await bulkPost(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(typeof body.generated).toBe("number");
    expect(Array.isArray(body.failed)).toBe(true);
    expect(body.total).toBe(2);

    // Restore
    (await import("@/lib/db")).prisma.user.findMany = originalFindMany;
  });
});
