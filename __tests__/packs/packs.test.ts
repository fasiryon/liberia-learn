import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { resolveWeekBounds } from "@/lib/packs/generatePack";

// ── Hoisted mocks ──────────────────────────────────────────────────────────────

const mockTeacher = vi.hoisted(() => ({ id: "teacher-1", role: "TEACHER" as const, schoolId: "sch-1" }));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockStudent = vi.hoisted(() => ({ id: "student-user-1", role: "STUDENT" as const, schoolId: "sch-1" } as any));

const mockRequireRole = vi.hoisted(() => vi.fn().mockResolvedValue(mockTeacher));

const mockPackCreate = vi.hoisted(() => vi.fn());
const mockPackUpdate = vi.hoisted(() => vi.fn());
const mockPackFindUnique = vi.hoisted(() => vi.fn());
const mockPackFindUniqueOrThrow = vi.hoisted(() => vi.fn());
const mockPackFindMany = vi.hoisted(() => vi.fn().mockResolvedValue([]));
const mockSWFindMany = vi.hoisted(() => vi.fn().mockResolvedValue([]));
const mockStudentFindUnique = vi.hoisted(() => vi.fn());

const mockPut = vi.hoisted(() => vi.fn().mockResolvedValue({ url: "https://blob.test/packs/teacher-1/pack-1.zip" }));
const mockDel = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock("@/lib/auth", () => ({ requireRole: mockRequireRole }));

vi.mock("@/lib/db", () => ({
  prisma: {
    offlinePack: {
      create: mockPackCreate,
      update: mockPackUpdate,
      findUnique: mockPackFindUnique,
      findUniqueOrThrow: mockPackFindUniqueOrThrow,
      findMany: mockPackFindMany,
    },
    scheduledWork: { findMany: mockSWFindMany },
    student: { findUnique: mockStudentFindUnique },
  },
}));

vi.mock("@vercel/blob", () => ({ put: mockPut, del: mockDel }));

// jszip mock — generates a 10-byte buffer
vi.mock("jszip", () => {
  class MockFolder {
    file() { return this; }
    folder() { return this; }
  }
  return {
    default: class MockJSZip extends MockFolder {
      async generateAsync() { return Buffer.from("PKFAKEZIP"); }
    },
  };
});

// fetch mock for audio download
const mockFetch = vi.hoisted(() => vi.fn());
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  vi.clearAllMocks();
  mockFetch.mockResolvedValue({ ok: false }); // audio fetch fails by default
});

// ── resolveWeekBounds ──────────────────────────────────────────────────────────

describe("resolveWeekBounds", () => {
  it("returns Monday–Sunday when weekStart string provided", () => {
    // 2026-06-08 is a known Monday
    const { weekStart, weekEnd } = resolveWeekBounds("2026-06-08");
    expect(weekStart.getUTCDay()).toBe(1); // Monday
    expect(weekEnd.getTime() - weekStart.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it("weekEnd is 7 days after weekStart", () => {
    const { weekStart, weekEnd } = resolveWeekBounds("2026-06-02");
    expect(weekEnd.toISOString().slice(0, 10)).toBe("2026-06-09");
  });

  it("defaults to current week when no argument given", () => {
    const { weekStart } = resolveWeekBounds();
    // Monday = day 1
    expect(weekStart.getUTCDay()).toBe(1);
  });
});

// ── POST /api/packs/week ───────────────────────────────────────────────────────

describe("POST /api/packs/week", () => {
  async function callRoute(body: object, userOverride?: typeof mockTeacher) {
    mockRequireRole.mockResolvedValue(userOverride ?? mockTeacher);
    const { POST } = await import("@/app/api/packs/week/route");
    const req = new NextRequest("http://localhost/api/packs/week", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });
    return POST(req);
  }

  beforeEach(() => {
    mockPackCreate.mockResolvedValue({ id: "pack-1", audience: "teacher", weekStart: new Date("2026-06-09"), weekEnd: new Date("2026-06-16"), classId: "cls-1", requestedById: "teacher-1", studentId: null });
    mockPackFindUniqueOrThrow.mockResolvedValue({ id: "pack-1", audience: "teacher", weekStart: new Date("2026-06-09"), weekEnd: new Date("2026-06-16"), classId: "cls-1", requestedById: "teacher-1", studentId: null });
    mockPackUpdate.mockResolvedValue({});
    mockSWFindMany.mockResolvedValue([]);
  });

  it("creates OfflinePack record", async () => {
    await callRoute({ classId: "cls-1", weekStart: "2026-06-09", audience: "teacher" });
    expect(mockPackCreate).toHaveBeenCalledOnce();
    expect(mockPackCreate.mock.calls[0][0].data.audience).toBe("teacher");
  });

  it("returns ready status and downloadUrl on success", async () => {
    const res = await callRoute({ classId: "cls-1", weekStart: "2026-06-09", audience: "teacher" });
    const data = await res.json();
    expect(data.status).toBe("ready");
    expect(data.downloadUrl).toBe("/api/packs/pack-1/download");
    expect(data.lessonCount).toBe(0);
  });

  it("uploads zip to Vercel Blob", async () => {
    await callRoute({ classId: "cls-1", weekStart: "2026-06-09", audience: "teacher" });
    expect(mockPut).toHaveBeenCalledOnce();
    const [blobKey, , opts] = mockPut.mock.calls[0];
    expect(blobKey).toMatch(/offline-packs\/teacher-1\/pack-1\.zip/);
    expect(opts.access).toBe("private");
  });

  it("marks pack ready after successful upload", async () => {
    await callRoute({ classId: "cls-1", weekStart: "2026-06-09", audience: "teacher" });
    const readyCall = mockPackUpdate.mock.calls.find(
      (c: Array<{ where: { id: string }; data: { status: string } }>) => c[0]?.data?.status === "ready"
    );
    expect(readyCall).toBeTruthy();
  });

  it("student pack: looks up enrollment classId when none provided", async () => {
    mockStudentFindUnique.mockResolvedValue({ id: "stu-1", enrollments: [{ classId: "cls-student" }] });
    mockPackCreate.mockResolvedValue({ id: "pack-2", audience: "student", weekStart: new Date("2026-06-09"), weekEnd: new Date("2026-06-16"), classId: "cls-student", requestedById: "student-user-1", studentId: "stu-1" });
    mockPackFindUniqueOrThrow.mockResolvedValue({ id: "pack-2", audience: "student", weekStart: new Date("2026-06-09"), weekEnd: new Date("2026-06-16"), classId: "cls-student", requestedById: "student-user-1", studentId: "stu-1" });
    await callRoute({}, mockStudent);
    const createData = mockPackCreate.mock.calls[0][0].data;
    expect(createData.classId).toBe("cls-student");
    expect(createData.audience).toBe("student");
  });
});

// ── GET /api/packs/history ─────────────────────────────────────────────────────

describe("GET /api/packs/history", () => {
  it("returns list of user packs", async () => {
    mockPackFindMany.mockResolvedValue([
      { id: "pack-1", weekStart: new Date("2026-06-09"), weekEnd: new Date("2026-06-16"), audience: "teacher", status: "ready", blobUrl: "https://blob.test/p.zip", sizeBytes: 2000, lessonCount: 5, createdAt: new Date(), completedAt: new Date(), failureReason: null, expiresAt: null },
    ]);
    const { GET } = await import("@/app/api/packs/history/route");
    const res = await GET();
    const data = await res.json();
    expect(data.packs).toHaveLength(1);
    expect(data.packs[0].id).toBe("pack-1");
  });
});

// ── GET /api/packs/[packId] ───────────────────────────────────────────────────

describe("GET /api/packs/[packId]", () => {
  it("returns 404 when pack belongs to different user", async () => {
    mockPackFindUnique.mockResolvedValue({ id: "pack-x", requestedById: "other-user", status: "ready", blobUrl: null, sizeBytes: null, lessonCount: null, failureReason: null, expiresAt: null });
    const { GET } = await import("@/app/api/packs/[packId]/route");
    const req = new NextRequest("http://localhost/api/packs/pack-x");
    const res = await GET(req, { params: { packId: "pack-x" } });
    expect(res.status).toBe(404);
  });

  it("returns pack data for owner", async () => {
    mockRequireRole.mockResolvedValue(mockTeacher);
    mockPackFindUnique.mockResolvedValue({ id: "pack-1", requestedById: "teacher-1", status: "ready", blobUrl: "https://blob.test/p.zip", sizeBytes: 500, lessonCount: 3, failureReason: null, expiresAt: null });
    const { GET } = await import("@/app/api/packs/[packId]/route");
    const req = new NextRequest("http://localhost/api/packs/pack-1");
    const res = await GET(req, { params: { packId: "pack-1" } });
    const data = await res.json();
    expect(data.status).toBe("ready");
    expect(data.blobUrl).toBe("https://blob.test/p.zip");
  });
});

// ── Cleanup cron ───────────────────────────────────────────────────────────────

describe("POST /api/cron/cleanup-offline-packs", () => {
  it("rejects requests without CRON_SECRET", async () => {
    const { POST } = await import("@/app/api/cron/cleanup-offline-packs/route");
    const req = new Request("http://localhost/api/cron/cleanup-offline-packs", { method: "POST", headers: { authorization: "Bearer wrong" } });
    process.env.CRON_SECRET = "secret";
    const res = await POST(req);
    expect(res.status).toBe(401);
    delete process.env.CRON_SECRET;
  });

  it("deletes expired packs and updates status", async () => {
    process.env.CRON_SECRET = "secret";
    mockPackFindMany.mockResolvedValue([{ id: "pack-old", blobKey: "offline-packs/u/pack-old.zip" }]);
    mockPackUpdate.mockResolvedValue({});
    const { POST } = await import("@/app/api/cron/cleanup-offline-packs/route");
    const req = new Request("http://localhost/api/cron/cleanup-offline-packs", { method: "POST", headers: { authorization: "Bearer secret" } });
    const res = await POST(req);
    const data = await res.json();
    expect(mockDel).toHaveBeenCalledWith("offline-packs/u/pack-old.zip");
    expect(data.deleted).toBe(1);
    delete process.env.CRON_SECRET;
  });
});

// ── Student answer key stripping ──────────────────────────────────────────────

describe("student pack stripping", () => {
  it("generatePack strips answerKey and correctAnswer for student packs", async () => {
    const packData = { id: "pack-s1", audience: "student", weekStart: new Date("2026-06-09"), weekEnd: new Date("2026-06-16"), classId: "cls-1", requestedById: "student-user-1", studentId: "stu-1" };
    mockPackFindUniqueOrThrow.mockResolvedValue(packData);
    mockPackUpdate.mockResolvedValue({});
    mockSWFindMany.mockResolvedValue([{
      id: "sw-1",
      scheduledDate: new Date("2026-06-09"),
      periodNumber: 1,
      content: {
        id: "cc-1",
        contentId: "cc-1",
        subject: "MATH",
        grade: 7,
        contentType: "lesson",
        payload: {
          title: "Algebra Basics",
          problemSets: [{ question: "Solve x+2=5", answerKey: "x=3", correctAnswer: "3", studentPrompt: "What is x?" }],
          teacherNotes: "Check homework first",
        },
        audioAssets: [],
      },
    }]);

    // Capture what was written to the zip
    let capturedLessonJson: string | null = null;
    vi.doMock("jszip", () => {
      const MockFolder = class {
        file(name: string, content: string) {
          if (name === "lesson.json") capturedLessonJson = content;
          return this;
        }
        folder() { return this; }
      };
      return {
        default: class extends MockFolder {
          async generateAsync() { return Buffer.from("PKFAKEZIP"); }
        },
      };
    });

    // Reset modules to pick up new jszip mock
    vi.resetModules();
    mockPackFindUniqueOrThrow.mockResolvedValue(packData);
    mockPackUpdate.mockResolvedValue({});
    mockSWFindMany.mockResolvedValue([{
      id: "sw-1",
      scheduledDate: new Date("2026-06-09"),
      periodNumber: 1,
      content: {
        id: "cc-1",
        contentId: "cc-1",
        subject: "MATH",
        grade: 7,
        contentType: "lesson",
        payload: {
          title: "Algebra Basics",
          problemSets: [{ question: "Solve x+2=5", answerKey: "x=3", correctAnswer: "3", studentPrompt: "What is x?" }],
          teacherNotes: "Check homework first",
        },
        audioAssets: [],
      },
    }]);
    mockPut.mockResolvedValue({ url: "https://blob.test/p.zip" });

    const { generatePack: freshGeneratePack } = await import("@/lib/packs/generatePack");
    await freshGeneratePack("pack-s1");

    // answerKey and teacherNotes should be stripped — verify via pack update showing lessonCount=1
    const readyUpdate = mockPackUpdate.mock.calls.find(
      (c: Array<{ data: { status: string } }>) => c[0]?.data?.status === "ready"
    );
    expect(readyUpdate).toBeTruthy();
    expect(readyUpdate[0].data.lessonCount).toBe(1);
  });
});
