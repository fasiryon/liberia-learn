import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const mockUser = vi.hoisted(() => ({ id: "user-1", role: "TEACHER" as const, schoolId: "school-1" }));
const mockStudent = vi.hoisted(() => ({ id: "user-s1", role: "STUDENT" as const, schoolId: "school-1" }));

const mockRequireUser  = vi.hoisted(() => vi.fn().mockResolvedValue(mockUser));
const mockRequireRole  = vi.hoisted(() => vi.fn().mockResolvedValue(mockStudent));

const mockUserUpdate   = vi.hoisted(() => vi.fn().mockResolvedValue({ id: "user-1" }));
const mockStudentFindMany = vi.hoisted(() => vi.fn().mockResolvedValue([]));
const mockGradeFindMany   = vi.hoisted(() => vi.fn().mockResolvedValue([]));
const mockAttendanceFindMany = vi.hoisted(() => vi.fn().mockResolvedValue([]));
const mockUserFindMany = vi.hoisted(() => vi.fn().mockResolvedValue([]));
const mockStudentGuardianFindMany = vi.hoisted(() => vi.fn().mockResolvedValue([]));
const mockEscalationQueueFindMany = vi.hoisted(() => vi.fn().mockResolvedValue([]));
const mockAgentInvocationFindMany = vi.hoisted(() => vi.fn().mockResolvedValue([]));

const mockPut  = vi.hoisted(() => vi.fn().mockResolvedValue({ url: "https://blob.example/backups/2026-05-17/students.csv" }));
const mockList = vi.hoisted(() => vi.fn().mockResolvedValue({ blobs: [] }));
const mockDel  = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock("@/lib/auth", () => ({
  requireUser: mockRequireUser,
  requireRole: mockRequireRole,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: { update: mockUserUpdate, findMany: mockUserFindMany },
    student: { findMany: mockStudentFindMany },
    grade: { findMany: mockGradeFindMany },
    attendance: { findMany: mockAttendanceFindMany },
    studentGuardian: { findMany: mockStudentGuardianFindMany },
    escalationQueue: { findMany: mockEscalationQueueFindMany },
    agentInvocation: { findMany: mockAgentInvocationFindMany },
  },
}));

vi.mock("@vercel/blob", () => ({
  put: mockPut,
  list: mockList,
  del: mockDel,
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import { PATCH as tourCompletePatch } from "@/app/api/user/tour-complete/route";
import { PATCH as privacyAcceptPatch } from "@/app/api/user/privacy-accept/route";
import { POST as backupPost }          from "@/app/api/cron/nightly-backup/route";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(headers: Record<string, string> = {}, body?: unknown): Request {
  return new Request("http://localhost/api/test", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

function cronRequest(): Request {
  return makeRequest({ authorization: "Bearer test-cron-secret" });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "test-cron-secret";
  mockRequireUser.mockResolvedValue(mockUser);
  mockRequireRole.mockResolvedValue(mockStudent);
  mockUserUpdate.mockResolvedValue({ id: "user-1" });
  mockStudentFindMany.mockResolvedValue([
    { id: "s1", currentGrade: "7", createdAt: new Date("2026-01-01"), user: { name: "Alice", schoolId: "school-1" } },
  ]);
  mockGradeFindMany.mockResolvedValue([
    { id: "g1", studentId: "s1", classId: "c1", percent: 85, letter: "B", computedAt: new Date("2026-01-01") },
  ]);
  mockAttendanceFindMany.mockResolvedValue([
    { id: "a1", studentId: "s1", classId: "c1", date: new Date("2026-01-01"), status: "PRESENT" },
  ]);
  mockPut.mockResolvedValue({ url: "https://blob.example/test.csv" });
  mockList.mockResolvedValue({ blobs: [] });
  mockDel.mockResolvedValue(undefined);
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("tour-complete PATCH", () => {
  it("marks tourCompletedAt for authenticated user", async () => {
    const res = await tourCompletePatch();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: expect.objectContaining({ tourCompletedAt: expect.any(Date) }),
    });
  });

  it("returns 401 when user not authenticated", async () => {
    mockRequireUser.mockRejectedValueOnce(Object.assign(new Error("Unauthorized"), { status: 401 }));
    const res = await tourCompletePatch();
    expect(res.status).toBe(401);
  });
});

describe("privacy-accept PATCH", () => {
  it("marks privacyAcceptedAt for authenticated student", async () => {
    const res = await privacyAcceptPatch();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: "user-s1" },
      data: expect.objectContaining({ privacyAcceptedAt: expect.any(Date) }),
    });
  });

  it("rejects non-student roles (403)", async () => {
    mockRequireRole.mockRejectedValueOnce(Object.assign(new Error("Forbidden"), { status: 403 }));
    const res = await privacyAcceptPatch();
    expect(res.status).toBe(403);
  });
});

describe("nightly-backup POST", () => {
  it("rejects request with wrong cron secret", async () => {
    const req = makeRequest({ authorization: "Bearer wrong-secret" });
    const res = await backupPost(req);
    expect(res.status).toBe(401);
  });

  it("rejects request with missing authorization header", async () => {
    const req = makeRequest();
    const res = await backupPost(req);
    expect(res.status).toBe(401);
  });

  it("uploads all 7 CSV files (2026-07-15: extended beyond students/grades/attendance) and returns backed_up list", async () => {
    const req = cronRequest();
    const res = await backupPost(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.backed_up).toEqual(
      expect.arrayContaining(["students", "grades", "attendance", "users", "student_guardians", "escalation_queue", "agent_invocations"])
    );
    expect(body.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(mockPut).toHaveBeenCalledTimes(7);
  });

  it("CSV contains correct headers for students", async () => {
    const req = cronRequest();
    await backupPost(req);
    const studentsPutCall = (mockPut.mock.calls as unknown[]).find((c) => ((c as unknown[])[0] as string).includes("students.csv")) as unknown[];
    expect(studentsPutCall).toBeDefined();
    const csv = (studentsPutCall as unknown[])[1] as string;
    const header = csv.split("\n")[0];
    expect(header).toBe("id,name,grade,schoolId,createdAt");
  });

  it("prunes old blobs beyond 90 days", async () => {
    const oldDate = new Date(Date.now() - 91 * 24 * 60 * 60 * 1000);
    mockList.mockResolvedValueOnce({
      blobs: [
        { url: "https://blob.example/old/students.csv", uploadedAt: oldDate },
        { url: "https://blob.example/old/grades.csv", uploadedAt: oldDate },
      ],
    });
    const req = cronRequest();
    await backupPost(req);
    expect(mockDel).toHaveBeenCalledWith([
      "https://blob.example/old/students.csv",
      "https://blob.example/old/grades.csv",
    ]);
  });

  it("does NOT prune blobs within 90 days", async () => {
    const recentDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    mockList.mockResolvedValueOnce({
      blobs: [{ url: "https://blob.example/recent/students.csv", uploadedAt: recentDate }],
    });
    const req = cronRequest();
    await backupPost(req);
    expect(mockDel).not.toHaveBeenCalled();
  });

  it("partial success: returns fulfilled uploads even if one fails", async () => {
    mockPut
      .mockResolvedValueOnce({ url: "https://blob.example/students.csv" })
      .mockRejectedValueOnce(new Error("Blob quota exceeded"))
      .mockResolvedValueOnce({ url: "https://blob.example/attendance.csv" });
    const req = cronRequest();
    const res = await backupPost(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.backed_up).toContain("students");
    expect(body.backed_up).not.toContain("grades");
    expect(body.backed_up).toContain("attendance");
  });
});
