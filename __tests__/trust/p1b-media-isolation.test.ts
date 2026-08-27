import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireRole = vi.hoisted(() => vi.fn());
const mockFindContent = vi.hoisted(() => vi.fn());
const mockFindGovernance = vi.hoisted(() => vi.fn());
const mockTransaction = vi.hoisted(() => vi.fn());
const mockFindVideo = vi.hoisted(() => vi.fn());
const mockUpdateVideo = vi.hoisted(() => vi.fn());
const mockUpdateManyVideos = vi.hoisted(() => vi.fn());
const mockHead = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ requireRole: mockRequireRole }));
vi.mock("@vercel/blob", () => ({
  head: mockHead,
  del: vi.fn(async () => undefined),
}));
vi.mock("@/lib/content-availability-manifest.server", () => ({
  buildContentAvailabilityExpiry: vi.fn(() => "2026-09-01T00:00:00.000Z"),
  hashContentAvailabilityData: vi.fn(() => "0".repeat(64)),
  signContentAvailability: vi.fn((payload) => ({
    payload: { ...payload, issuedAt: "2026-08-03T00:00:00.000Z" },
    signature: "signed",
    keyId: "test-key",
  })),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: mockTransaction,
    curriculumContent: { findFirst: mockFindContent },
    curriculumGovernanceEvent: { findFirst: mockFindGovernance },
    lessonVideo: {
      findUnique: mockFindVideo,
      update: mockUpdateVideo,
      updateMany: mockUpdateManyVideos,
      delete: vi.fn(),
    },
  },
}));

import { GET as getCurriculum } from "@/app/api/curriculum/[contentId]/route";
import { PATCH as patchVideo } from "@/app/api/teacher/lessons/[contentId]/video/[videoId]/route";

describe("P1-B tenant-scoped lesson media", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTransaction.mockImplementation(async (callback) => callback({
      curriculumContent: { findFirst: mockFindContent },
      curriculumGovernanceEvent: { findFirst: mockFindGovernance },
    }));
  });

  it("deactivates competing videos only inside the activated video's school", async () => {
    mockRequireRole.mockResolvedValue({
      id: "teacher-1",
      role: "TEACHER",
      schoolId: "school-a",
      isPlatformAdmin: false,
    });
    mockFindVideo.mockResolvedValue({
      id: "video-a",
      lessonId: "lesson-1",
      uploadedBy: "teacher-1",
      schoolId: "school-a",
    });
    mockUpdateVideo.mockResolvedValue({ id: "video-a", isActive: true });

    const response = await patchVideo(
      new Request("http://localhost/api/teacher/lessons/lesson-1/video/video-a", {
        method: "PATCH",
        body: JSON.stringify({ isActive: true }),
      }),
      { params: { contentId: "lesson-1", videoId: "video-a" } }
    );

    expect(response.status).toBe(200);
    expect(mockUpdateManyVideos).toHaveBeenCalledWith({
      where: {
        lessonId: "lesson-1",
        schoolId: "school-a",
        isActive: true,
        id: { not: "video-a" },
      },
      data: { isActive: false },
    });
  });

  it("filters content and signed private video URLs to the student's school and approved active state", async () => {
    mockRequireRole.mockResolvedValue({
      id: "student-1",
      role: "STUDENT",
      schoolId: "school-a",
      isPlatformAdmin: false,
    });
    mockFindContent.mockResolvedValue({
      contentId: "lesson-1",
      grade: 7,
      subject: "SCIENCE",
      contentType: "lesson",
      status: "published",
      version: "3",
      payload: { title: "Cells" },
      teacherCreated: false,
      editedBy: null,
      audioAssets: [],
      videoSupplements: [{
        id: "video-a",
        title: "Cells",
        description: null,
        storageUrl: "https://blob/private-video",
        thumbnailUrl: null,
        durationSeconds: 120,
        fileSize: 1000,
        isActive: true,
        uploadedAt: new Date("2026-08-03T00:00:00.000Z"),
        uploadedBy: "teacher-1",
      }],
      createdAt: new Date("2026-08-01T00:00:00.000Z"),
      updatedAt: new Date("2026-08-02T00:00:00.000Z"),
    });
    mockHead.mockResolvedValue({ downloadUrl: "https://blob/signed-video" });

    const response = await getCurriculum(new Request("http://localhost/api/curriculum/lesson-1"), {
      params: { contentId: "lesson-1" },
    });

    expect(response.status).toBe(200);
    const query = mockFindContent.mock.calls[0][0];
    expect(query.where).toEqual(expect.objectContaining({
      contentId: "lesson-1",
      OR: [{ schoolId: null }, { schoolId: "school-a" }],
    }));
    expect(query.select.videoSupplements.where).toEqual({
      schoolId: "school-a",
      status: "APPROVED",
      isActive: true,
    });
    expect(mockHead).toHaveBeenCalledTimes(1);
    expect((await response.json()).videos[0].storageUrl).toBe("https://blob/signed-video");
  });
});
