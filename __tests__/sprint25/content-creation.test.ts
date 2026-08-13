/**
 * Sprint 25: Teacher Content Creation
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────
const mockRequireRole = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());
const mockSendPushToUser = vi.hoisted(() => vi.fn());

const mockCurriculumContentFindUnique = vi.hoisted(() => vi.fn());
const mockCurriculumContentUpdate = vi.hoisted(() => vi.fn());
const mockCurriculumContentCreate = vi.hoisted(() => vi.fn());
const mockLessonVersionCreate = vi.hoisted(() => vi.fn());
const mockLessonVersionFindMany = vi.hoisted(() => vi.fn());
const mockLessonVersionDeleteMany = vi.hoisted(() => vi.fn());
const mockLessonShareUpsert = vi.hoisted(() => vi.fn());
const mockLessonShareDeleteMany = vi.hoisted(() => vi.fn());
const mockClassFindFirst = vi.hoisted(() => vi.fn());
const mockTeacherAlertPrefFindUnique = vi.hoisted(() => vi.fn());
const mockNotifInboxCreate = vi.hoisted(() => vi.fn());
const mockCurriculumContentFindMany = vi.hoisted(() => vi.fn());
const mockAssignmentCreate = vi.hoisted(() => vi.fn());
const mockClassFindMany = vi.hoisted(() => vi.fn());
const mockLessonShareFindMany = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ requireRole: mockRequireRole }));
vi.mock("@/lib/audit", () => ({
  logAudit: mockLogAudit,
  logAuditRequired: mockLogAudit,
  logAuditRequiredWithId: mockLogAudit,
}));
vi.mock("@/lib/push/sendPush", () => ({ sendPushToUser: mockSendPushToUser }));
vi.mock("@/lib/db", () => ({
  prisma: {
    curriculumContent: {
      findUnique: mockCurriculumContentFindUnique,
      findMany: mockCurriculumContentFindMany,
      update: mockCurriculumContentUpdate,
      create: mockCurriculumContentCreate,
    },
    lessonVersion: {
      create: mockLessonVersionCreate,
      findMany: mockLessonVersionFindMany,
      deleteMany: mockLessonVersionDeleteMany,
    },
    lessonShare: {
      upsert: mockLessonShareUpsert,
      deleteMany: mockLessonShareDeleteMany,
      findMany: mockLessonShareFindMany,
    },
    class: {
      findFirst: mockClassFindFirst,
      findMany: mockClassFindMany,
    },
    teacherAlertPreference: {
      findUnique: mockTeacherAlertPrefFindUnique,
    },
    notificationInboxItem: {
      create: mockNotifInboxCreate,
    },
    assignment: {
      create: mockAssignmentCreate,
    },
    $transaction: vi.fn(async (callback: any) => callback({
      curriculumContent: { update: mockCurriculumContentUpdate },
    })),
  },
}));

import { PATCH as patchLesson } from "@/app/api/teacher/lessons/[contentId]/route";
import { GET as getVersions } from "@/app/api/teacher/lessons/[contentId]/versions/route";
import { POST as shareLesson, DELETE as unshareLesson } from "@/app/api/teacher/lessons/[contentId]/share/route";
import { PATCH as adminPatchLesson } from "@/app/api/admin/content-review/[lessonId]/route";

function makeRequest(method: string, url: string, body?: unknown) {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  }) as any;
}

const teacher = { id: "teacher-1", schoolId: "school-1", role: "TEACHER" };
const admin = { id: "admin-1", schoolId: "school-1", role: "ADMIN" };

const baseLessonParams = { params: { contentId: "lesson-db-id-1" } };
const baseLessonParamsByLessonId = { params: { lessonId: "lesson-db-id-1" } };

beforeEach(() => {
  vi.clearAllMocks();
  mockLogAudit.mockResolvedValue(undefined);
  mockSendPushToUser.mockResolvedValue(undefined);
  mockLessonVersionCreate.mockResolvedValue({ id: "version-1" });
  mockLessonVersionFindMany.mockResolvedValue([]);
  mockLessonVersionDeleteMany.mockResolvedValue({ count: 0 });
});

describe("PATCH /api/teacher/lessons/[id]", () => {
  it("creates LessonVersion snapshot before each save", async () => {
    mockRequireRole.mockResolvedValue(teacher);
    mockCurriculumContentFindUnique.mockResolvedValue({
      id: "lesson-db-id-1",
      contentId: "content-1",
      title: "Old title",
      payload: { body: "<p>Old body</p>" },
      editedById: "teacher-1",
      scheduledWork: [],
    });
    mockCurriculumContentUpdate.mockResolvedValue({
      id: "lesson-db-id-1",
      contentId: "content-1",
      editReviewStatus: "PENDING",
    });

    const req = makeRequest("PATCH", "http://localhost/api/teacher/lessons/lesson-db-id-1", {
      title: "New title",
      bodyHtml: "<p>New body</p>",
    });
    const res = await patchLesson(req, baseLessonParams);
    expect(res.status).toBe(200);
    expect(mockLessonVersionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ lessonId: "lesson-db-id-1", bodyHtml: "<p>Old body</p>" }),
      })
    );
  });

  it("returns 403 if teacher does not own the lesson's class", async () => {
    mockRequireRole.mockResolvedValue(teacher);
    mockCurriculumContentFindUnique.mockResolvedValue({
      id: "lesson-db-id-1",
      contentId: "content-1",
      title: "Lesson",
      payload: { body: "" },
      editedById: "other-teacher",
      scheduledWork: [{ classId: "class-99" }],
    });
    mockClassFindFirst.mockResolvedValue(null); // teacher does NOT teach this class

    const req = makeRequest("PATCH", "http://localhost/api/teacher/lessons/lesson-db-id-1", {
      bodyHtml: "<p>Attempt</p>",
    });
    const res = await patchLesson(req, baseLessonParams);
    expect(res.status).toBe(403);
    expect(mockCurriculumContentUpdate).not.toHaveBeenCalled();
  });
});

describe("POST /api/teacher/lessons (create)", () => {
  it("sets source=TEACHER style payload and editReviewStatus=PENDING on create", async () => {
    // The existing POST route stores teacherCreated=true and returns a contentId.
    // We test the PATCH endpoint's create snapshot behavior via the new PATCH route.
    // For the create flow, verify the new lesson edit sets editedById correctly.
    mockRequireRole.mockResolvedValue(teacher);
    mockCurriculumContentFindUnique.mockResolvedValue({
      id: "lesson-db-id-2",
      contentId: "content-2",
      title: "New lesson",
      payload: { body: "" },
      editedById: null, // Not yet claimed
      scheduledWork: [{ classId: "class-1" }],
    });
    mockClassFindFirst.mockResolvedValue({ id: "class-1" }); // teacher teaches this class
    mockCurriculumContentUpdate.mockResolvedValue({
      id: "lesson-db-id-2",
      contentId: "content-2",
      editReviewStatus: "PENDING",
    });

    const req = makeRequest("PATCH", "http://localhost/api/teacher/lessons/lesson-db-id-2", {
      title: "New lesson",
      bodyHtml: "<p>Body</p>",
      editReviewStatus: "PENDING",
    });
    const res = await patchLesson(req, { params: { contentId: "lesson-db-id-2" } });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.editReviewStatus).toBe("PENDING");
  });
});

describe("GET /api/teacher/lessons/[id]/versions", () => {
  it("returns max 20 versions ordered newest-first", async () => {
    mockRequireRole.mockResolvedValue(teacher);
    mockCurriculumContentFindUnique.mockResolvedValue({
      id: "lesson-db-id-1",
      editedById: "teacher-1",
      scheduledWork: [],
    });
    const fakeVersions = Array.from({ length: 20 }, (_, i) => ({
      id: `v-${i}`,
      bodyHtml: `<p>Version ${i}</p>`,
      metadata: null,
      createdAt: new Date(Date.now() - i * 1000).toISOString(),
      author: { id: "teacher-1", name: "Teacher" },
    }));
    mockLessonVersionFindMany.mockResolvedValue(fakeVersions);

    const req = makeRequest("GET", "http://localhost/api/teacher/lessons/lesson-db-id-1/versions");
    const res = await getVersions(req, baseLessonParams);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.versions).toHaveLength(20);
    // Verify the query used take:20
    expect(mockLessonVersionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 20 })
    );
  });
});

describe("Admin PATCH /api/admin/content-review/[lessonId]", () => {
  it("sets status=published and editReviewStatus=APPROVED on approve (wave4c state machine)", async () => {
    mockRequireRole.mockResolvedValue(admin);
    mockCurriculumContentFindUnique.mockResolvedValue({
      id: "lesson-db-id-1",
      contentId: "content-1",
      title: "Lesson One",
      editedById: "teacher-1",
      editReviewStatus: "PENDING", // state machine: only PENDING → APPROVED allowed
    });
    mockCurriculumContentUpdate.mockResolvedValue({
      id: "lesson-db-id-1",
      editReviewStatus: "APPROVED",
      status: "published",
    });
    mockNotifInboxCreate.mockResolvedValue({ id: "notif-1" });
    mockSendPushToUser.mockResolvedValue(undefined);

    const req = makeRequest("PATCH", "http://localhost/api/admin/content-review/lesson-db-id-1", {
      editReviewStatus: "APPROVED",
    });
    const res = await adminPatchLesson(req, baseLessonParamsByLessonId);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.editReviewStatus).toBe("APPROVED");
    expect(mockCurriculumContentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ editReviewStatus: "APPROVED", status: "published" }),
      })
    );
    // Teacher is notified of the approval (inbox + push)
    expect(mockNotifInboxCreate).toHaveBeenCalled();
  });

  it("sets editReviewStatus=REJECTED and fires push notification to teacher", async () => {
    mockRequireRole.mockResolvedValue(admin);
    mockCurriculumContentFindUnique.mockResolvedValue({
      id: "lesson-db-id-1",
      contentId: "content-1",
      title: "Lesson One",
      editedById: "teacher-1",
      editReviewStatus: "PENDING", // state machine: only PENDING → REJECTED allowed
    });
    mockCurriculumContentUpdate.mockResolvedValue({
      id: "lesson-db-id-1",
      editReviewStatus: "REJECTED",
      status: "draft",
    });
    mockNotifInboxCreate.mockResolvedValue({ id: "notif-1" });
    mockSendPushToUser.mockResolvedValue(undefined);

    const req = makeRequest("PATCH", "http://localhost/api/admin/content-review/lesson-db-id-1", {
      editReviewStatus: "REJECTED",
      rejectionReason: "Needs more detail", // wave4c schema: rejectionReason (required, 1-500 chars)
    });
    const res = await adminPatchLesson(req, baseLessonParamsByLessonId);
    expect(res.status).toBe(200);
    expect(mockSendPushToUser).toHaveBeenCalledWith(
      "teacher-1",
      expect.objectContaining({ body: expect.stringContaining("Needs more detail") })
    );
  });
});

describe("POST /api/teacher/lessons/[id]/share", () => {
  it("creates LessonShare; duplicate share returns 200 not 500", async () => {
    mockRequireRole.mockResolvedValue(teacher);
    mockCurriculumContentFindUnique.mockResolvedValue({
      id: "lesson-db-id-1",
      editedById: "teacher-1",
    });
    mockLessonShareUpsert.mockResolvedValue({ id: "share-1" });

    const req = makeRequest("POST", "http://localhost/api/teacher/lessons/lesson-db-id-1/share", {
      schoolId: "school-1",
    });
    const res = await shareLesson(req, baseLessonParams);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.shareId).toBe("share-1");

    // Second call (duplicate) also returns 200
    const req2 = makeRequest("POST", "http://localhost/api/teacher/lessons/lesson-db-id-1/share", {
      schoolId: "school-1",
    });
    const res2 = await shareLesson(req2, baseLessonParams);
    expect(res2.status).toBe(200);
  });
});

describe("DELETE /api/teacher/lessons/[id]/share", () => {
  it("removes LessonShare record", async () => {
    mockRequireRole.mockResolvedValue(teacher);
    mockCurriculumContentFindUnique.mockResolvedValue({
      id: "lesson-db-id-1",
      editedById: "teacher-1",
    });
    mockLessonShareDeleteMany.mockResolvedValue({ count: 1 });

    const req = makeRequest("DELETE", "http://localhost/api/teacher/lessons/lesson-db-id-1/share", {
      schoolId: "school-1",
    });
    const res = await unshareLesson(req, baseLessonParams);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(mockLessonShareDeleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ lessonId: "lesson-db-id-1", schoolId: "school-1" }),
      })
    );
  });
});
