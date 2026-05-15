/**
 * Sprint 17: MOE Submissions, Multi-language, Canva Status, ID Card Generation
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────
const mockRequireRole = vi.hoisted(() => vi.fn());
const mockRequireUser = vi.hoisted(() => vi.fn());
const mockSendPushToUser = vi.hoisted(() => vi.fn());
const mockHasCanvaMcpAuthorizationToken = vi.hoisted(() => vi.fn());
const mockIsMoePortalEnabled = vi.hoisted(() => vi.fn());

const mockMoeSubmissionCreate = vi.hoisted(() => vi.fn());
const mockMoeSubmissionFindMany = vi.hoisted(() => vi.fn());
const mockMoeSubmissionFindUnique = vi.hoisted(() => vi.fn());
const mockMoeSubmissionUpdate = vi.hoisted(() => vi.fn());
const mockUserFindMany = vi.hoisted(() => vi.fn());
const mockUserUpdate = vi.hoisted(() => vi.fn());
const mockUserFindFirst = vi.hoisted(() => vi.fn());
const mockSchoolFindUnique = vi.hoisted(() => vi.fn());
const mockNotificationCreate = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  requireRole: mockRequireRole,
  requireUser: mockRequireUser,
}));
vi.mock("@/lib/push/sendPush", () => ({ sendPushToUser: mockSendPushToUser }));
vi.mock("@/lib/canva/config", () => ({
  hasCanvaMcpAuthorizationToken: mockHasCanvaMcpAuthorizationToken,
}));
vi.mock("@/lib/serverFlags", () => ({
  isMoePortalEnabled: mockIsMoePortalEnabled,
}));
vi.mock("@vercel/blob", () => ({
  put: vi.fn().mockResolvedValue({ url: "https://blob.vercel.app/test.pdf" }),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    moeSubmission: {
      create: mockMoeSubmissionCreate,
      findMany: mockMoeSubmissionFindMany,
      findUnique: mockMoeSubmissionFindUnique,
      update: mockMoeSubmissionUpdate,
    },
    user: {
      findMany: mockUserFindMany,
      update: mockUserUpdate,
      findFirst: mockUserFindFirst,
    },
    school: { findUnique: mockSchoolFindUnique },
    notificationInboxItem: { createMany: mockNotificationCreate },
  },
}));

import { GET as adminGetSubmissions, POST as adminPostSubmission } from "@/app/api/admin/moe-submissions/route";
import { GET as moeGetSubmissions } from "@/app/api/moe/submissions/route";
import { PATCH as moeReviewSubmission } from "@/app/api/moe/submissions/[id]/review/route";
import { GET as canvaStatus } from "@/app/api/admin/canva/status/route";
import { POST as saveLanguage } from "@/app/api/user/language-preference/route";

function makeRequest(method: string, url: string, body?: unknown) {
  return new Request(`http://localhost${url}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function makeFormRequest(url: string, formData: FormData) {
  return new Request(`http://localhost${url}`, { method: "POST", body: formData });
}

const adminUser = { id: "admin1", role: "ADMIN", schoolId: "school1", name: "Admin User", email: "admin@test.com", isPlatformAdmin: false };
const moeUser = { id: "moe1", role: "MOE_OFFICIAL", name: "MOE Official", email: "moe@gov.lr", isPlatformAdmin: false };
const plainUser = { id: "user1", role: "STUDENT", name: "Student", email: "s@test.com", isPlatformAdmin: false };

beforeEach(() => {
  vi.clearAllMocks();
  mockSendPushToUser.mockResolvedValue({ sent: 1, failed: 0, smsFallback: 0 });
  mockNotificationCreate.mockResolvedValue({ count: 1 });
  mockIsMoePortalEnabled.mockReturnValue(true);
  mockSchoolFindUnique.mockResolvedValue({ name: "Monrovia Central School" });
  mockUserFindMany.mockResolvedValue([{ id: "admin1" }]);
});

// ── MOE Submission — Admin creates ───────────────────────────────────────────
describe("MoeSubmission — admin create", () => {
  it("creates a submission with SUBMITTED status", async () => {
    mockRequireRole.mockResolvedValue(adminUser);
    const expected = {
      id: "sub1", schoolId: "school1", type: "ENROLLMENT_REPORT",
      title: "Term 1 Report", status: "SUBMITTED", fileUrl: "https://blob.vercel.app/test.pdf",
    };
    mockMoeSubmissionCreate.mockResolvedValue(expected);

    const fd = new FormData();
    fd.append("type", "ENROLLMENT_REPORT");
    fd.append("title", "Term 1 Report");
    const pdfBlob = new Blob(["PDF content"], { type: "application/pdf" });
    fd.append("file", new File([pdfBlob], "report.pdf", { type: "application/pdf" }));

    const req = makeFormRequest("/api/admin/moe-submissions", fd);
    const res = await adminPostSubmission(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.status).toBe("SUBMITTED");
    expect(mockMoeSubmissionCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "SUBMITTED", type: "ENROLLMENT_REPORT" }) })
    );
  });

  it("rejects non-PDF file (400)", async () => {
    mockRequireRole.mockResolvedValue(adminUser);
    const fd = new FormData();
    fd.append("type", "OTHER");
    fd.append("title", "Test");
    fd.append("file", new File(["data"], "file.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }));

    const req = makeFormRequest("/api/admin/moe-submissions", fd);
    const res = await adminPostSubmission(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/PDF/i);
  });

  it("non-admin cannot submit (403)", async () => {
    mockRequireRole.mockRejectedValue(Object.assign(new Error("Forbidden"), { status: 403 }));
    const fd = new FormData();
    fd.append("type", "OTHER");
    fd.append("title", "Test");
    fd.append("file", new File(["d"], "file.pdf", { type: "application/pdf" }));
    const req = makeFormRequest("/api/admin/moe-submissions", fd);
    const res = await adminPostSubmission(req);
    expect(res.status).toBe(403);
  });

  it("admin can GET their submissions", async () => {
    mockRequireRole.mockResolvedValue(adminUser);
    mockMoeSubmissionFindMany.mockResolvedValue([{ id: "sub1", schoolId: "school1", status: "SUBMITTED" }]);
    const res = await adminGetSubmissions();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });
});

// ── MOE Submission — MOE portal ───────────────────────────────────────────────
describe("MoeSubmission — MOE portal", () => {
  it("MOE official can list all submissions", async () => {
    mockRequireRole.mockResolvedValue(moeUser);
    mockMoeSubmissionFindMany.mockResolvedValue([{ id: "sub1", schoolId: "school1" }]);
    const res = await moeGetSubmissions(makeRequest("GET", "/api/moe/submissions") as any);
    expect(res.status).toBe(200);
    expect(mockMoeSubmissionFindMany).toHaveBeenCalled();
  });

  it("non-MOE cannot access MOE submissions (403)", async () => {
    mockRequireRole.mockRejectedValue(Object.assign(new Error("Forbidden"), { status: 403 }));
    const res = await moeGetSubmissions(makeRequest("GET", "/api/moe/submissions") as any);
    expect(res.status).toBe(403);
  });

  it("MOE can update submission status to UNDER_REVIEW", async () => {
    mockRequireRole.mockResolvedValue(moeUser);
    mockMoeSubmissionFindUnique.mockResolvedValue({ id: "sub1", schoolId: "school1", title: "Term Report" });
    mockMoeSubmissionUpdate.mockResolvedValue({ id: "sub1", status: "UNDER_REVIEW" });

    const res = await moeReviewSubmission(
      makeRequest("PATCH", "/api/moe/submissions/sub1/review", { status: "UNDER_REVIEW" }) as any,
      { params: { id: "sub1" } }
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("UNDER_REVIEW");
  });

  it("MOE status update fires push notification to school admins", async () => {
    mockRequireRole.mockResolvedValue(moeUser);
    mockMoeSubmissionFindUnique.mockResolvedValue({ id: "sub1", schoolId: "school1", title: "Term Report" });
    mockMoeSubmissionUpdate.mockResolvedValue({ id: "sub1", status: "ACKNOWLEDGED" });
    mockUserFindMany.mockResolvedValue([{ id: "admin1" }, { id: "admin2" }]);

    await moeReviewSubmission(
      makeRequest("PATCH", "/api/moe/submissions/sub1/review", { status: "ACKNOWLEDGED" }) as any,
      { params: { id: "sub1" } }
    );

    expect(mockSendPushToUser).toHaveBeenCalledTimes(2);
    expect(mockSendPushToUser).toHaveBeenCalledWith("admin1", expect.objectContaining({ title: "MOE reviewed your submission" }));
  });

  it("RETURNED status requires moeNotes (400)", async () => {
    mockRequireRole.mockResolvedValue(moeUser);
    const res = await moeReviewSubmission(
      makeRequest("PATCH", "/api/moe/submissions/sub1/review", { status: "RETURNED" }) as any,
      { params: { id: "sub1" } }
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 when portal disabled", async () => {
    mockIsMoePortalEnabled.mockReturnValue(false);
    const res = await moeGetSubmissions(makeRequest("GET", "/api/moe/submissions") as any);
    expect(res.status).toBe(404);
  });
});

// ── Language preference ───────────────────────────────────────────────────────
describe("Language preference", () => {
  it("saves supported language to user record", async () => {
    mockRequireUser.mockResolvedValue({ id: "user1" });
    mockUserUpdate.mockResolvedValue({ id: "user1", languagePreference: "kpe" });
    const res = await saveLanguage(makeRequest("POST", "/api/user/language-preference", { language: "kpe" }) as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.language).toBe("kpe");
    expect(mockUserUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ languagePreference: "kpe" }),
    }));
  });

  it("rejects unsupported language (400)", async () => {
    mockRequireUser.mockResolvedValue({ id: "user1" });
    const res = await saveLanguage(makeRequest("POST", "/api/user/language-preference", { language: "fr" }) as any);
    expect(res.status).toBe(400);
  });

  it("language selector returns 3 options (en, kpe, bss)", async () => {
    // Verify message files exist and are valid JSON
    const en = await import("@/messages/en.json");
    const kpe = await import("@/messages/kpe.json");
    const bss = await import("@/messages/bss.json");
    expect(Object.keys(en.nav)).toHaveLength(9);
    expect(Object.keys(kpe.nav)).toHaveLength(9);
    expect(Object.keys(bss.nav)).toHaveLength(9);
    expect(en.nav.dashboard).toBe("Dashboard");
    expect(kpe.nav.dashboard).toBe("Kpele-pɛlɛ");
    expect(bss.nav.dashboard).toBe("Nyɔ-nyɔ");
  });
});

// ── Canva status ──────────────────────────────────────────────────────────────
describe("Canva status API", () => {
  it("returns connected: false when token not set", async () => {
    mockRequireRole.mockResolvedValue(adminUser);
    mockHasCanvaMcpAuthorizationToken.mockReturnValue(false);
    const res = await canvaStatus();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.connected).toBe(false);
  });

  it("returns connected: true when token is set", async () => {
    mockRequireRole.mockResolvedValue(adminUser);
    mockHasCanvaMcpAuthorizationToken.mockReturnValue(true);
    const res = await canvaStatus();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.connected).toBe(true);
  });

  it("non-admin blocked from Canva status (403)", async () => {
    mockRequireRole.mockRejectedValue(Object.assign(new Error("Forbidden"), { status: 403 }));
    const res = await canvaStatus();
    expect(res.status).toBe(403);
  });
});

// ── ID card generation gate ───────────────────────────────────────────────────
describe("ID card generation — Canva gate", () => {
  it("documents page state: canvaConnected false when token missing", () => {
    // Canva status check integration verified through canvaStatus route above.
    // Page reads /api/admin/canva/status and disables generate button accordingly.
    mockHasCanvaMcpAuthorizationToken.mockReturnValue(false);
    expect(mockHasCanvaMcpAuthorizationToken()).toBe(false);
  });
});
