/**
 * December assurance — cross-school writes, duplicate submits, silent grade
 * changes, and public error leakage.
 */
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireRole = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());
const mockCertificateFindUnique = vi.hoisted(() => vi.fn());
const mockCertificateShareUpsert = vi.hoisted(() => vi.fn());
const mockReportCardFindUnique = vi.hoisted(() => vi.fn());
const mockReportCardUpdateMany = vi.hoisted(() => vi.fn());
const mockStudentFindUnique = vi.hoisted(() => vi.fn());
const mockGradedFindUnique = vi.hoisted(() => vi.fn());
const mockGradedUpdate = vi.hoisted(() => vi.fn());
const mockQueryRaw = vi.hoisted(() => vi.fn());
const mockSendPush = vi.hoisted(() => vi.fn());
const mockInbox = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ requireRole: mockRequireRole }));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));
vi.mock("@/lib/push/sendPush", () => ({ sendPushToUser: mockSendPush }));
vi.mock("@/lib/notifications/inboxService", () => ({ createInboxNotification: mockInbox }));
vi.mock("@/lib/autonomous/signals/productSignalService", () => ({ logProductSignal: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    certificate: { findUnique: mockCertificateFindUnique },
    certificateShare: { upsert: mockCertificateShareUpsert },
    scheduledWork: { findUnique: vi.fn() },
    reportCard: { findUnique: mockReportCardFindUnique, updateMany: mockReportCardUpdateMany },
    student: { findUnique: mockStudentFindUnique },
    gradedSubmission: { findUnique: mockGradedFindUnique, update: mockGradedUpdate },
    $queryRaw: mockQueryRaw,
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockSendPush.mockResolvedValue(undefined);
  mockInbox.mockResolvedValue(undefined);
});

describe("certificate share links are school-scoped for admins", () => {
  const certificate = {
    id: "cert-other-school",
    type: "SUBJECT",
    referenceId: "MATH",
    awardedAt: new Date(),
    student: { userId: "student-user-9", user: { name: "Other School Child", schoolId: "school-2" } },
  };

  it("refuses to mint a public link for another school's learner", async () => {
    mockRequireRole.mockResolvedValue({ id: "admin-1", role: "ADMIN", schoolId: "school-1", isPlatformAdmin: false });
    mockCertificateFindUnique.mockResolvedValue(certificate);
    const { POST } = await import("@/app/api/certificates/[id]/share/route");
    const res = await POST(new Request("http://localhost/api/certificates/cert-other-school/share", { method: "POST" }), {
      params: { id: "cert-other-school" },
    });
    expect(res.status).toBe(404);
    expect(mockCertificateShareUpsert).not.toHaveBeenCalled();
    expect(JSON.stringify(await res.json())).not.toContain("Other School Child");
  });

  it("allows an admin of the learner's own school", async () => {
    mockRequireRole.mockResolvedValue({ id: "admin-2", role: "ADMIN", schoolId: "school-2", isPlatformAdmin: false });
    mockCertificateFindUnique.mockResolvedValue(certificate);
    const { POST } = await import("@/app/api/certificates/[id]/share/route");
    const res = await POST(new Request("http://localhost/api/certificates/cert-other-school/share", { method: "POST" }), {
      params: { id: "cert-other-school" },
    });
    expect(res.status).toBe(200);
    expect(mockCertificateShareUpsert).toHaveBeenCalledTimes(1);
  });
});

describe("report card publish is single-shot under concurrency", () => {
  it("a losing concurrent publish sends no notifications", async () => {
    mockRequireRole.mockResolvedValue({ id: "admin-1", role: "ADMIN", schoolId: "school-1" });
    mockReportCardFindUnique.mockResolvedValue({ id: "rc-1", schoolId: "school-1", status: "DRAFT", studentId: "s-1", classId: "c-1", termId: "t-1" });
    mockReportCardUpdateMany.mockResolvedValue({ count: 0 });
    mockStudentFindUnique.mockResolvedValue({ user: { id: "u-1" }, guardians: [{ guardianId: "g-1" }] });
    const { PATCH } = await import("@/app/api/report-cards/[id]/publish/route");
    const res = await PATCH(new NextRequest("http://localhost/api/report-cards/rc-1/publish", { method: "PATCH" }), { params: { id: "rc-1" } });
    expect(res.status).toBe(400);
    expect(mockSendPush).not.toHaveBeenCalled();
    expect(mockInbox).not.toHaveBeenCalled();
    expect(mockReportCardUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: { not: "PUBLISHED" } }) }),
    );
  });
});

describe("teacher grade overrides are audited", () => {
  it("records previous and new score", async () => {
    mockRequireRole.mockResolvedValue({ id: "teacher-1", role: "TEACHER", schoolId: "school-1", isPlatformAdmin: false });
    mockGradedFindUnique.mockResolvedValue({ id: "gs-1", exerciseType: "essay", score: 0.4, studentId: "s-1", student: { user: { schoolId: "school-1" } } });
    mockGradedUpdate.mockResolvedValue({ id: "gs-1", score: 0.9 });
    const { PATCH } = await import("@/app/api/grading/[submissionId]/override/route");
    const res = await PATCH(
      new Request("http://localhost/api/grading/gs-1/override", { method: "PATCH", body: JSON.stringify({ score: 0.9 }) }),
      { params: { submissionId: "gs-1" } },
    );
    expect(res.status).toBe(200);
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "grading.submission.override",
        resourceId: "gs-1",
        details: expect.objectContaining({ previousScore: 0.4, newScore: 0.9 }),
      }),
    );
  });
});

describe("public DB health check", () => {
  const originalEnv = process.env.NODE_ENV;
  afterEach(() => {
    (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv;
  });

  it("does not return the driver error text outside development", async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    mockQueryRaw.mockRejectedValue(new Error("Can't reach database server at `db.secret-host.supabase.co:5432`"));
    const { GET } = await import("@/app/api/health/db/route");
    const res = await GET();
    expect(res.status).toBe(503);
    expect(JSON.stringify(await res.json())).not.toContain("secret-host");
  });
});
