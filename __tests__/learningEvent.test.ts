import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCreate = vi.hoisted(() => vi.fn());
const mockUpdate = vi.hoisted(() => vi.fn());
const mockDelete = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: {
    learningEvent: {
      create: mockCreate,
      update: mockUpdate,
      delete: mockDelete,
    },
  },
}));

import { logLearningEvent } from "@/lib/events/logLearningEvent";

describe("logLearningEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate.mockResolvedValue({ id: "evt-1" });
  });

  it("writes a normalized immutable event payload", async () => {
    await logLearningEvent({
      schoolId: "school-1",
      userId: "user-1",
      actor: { type: "user", id: "user-1", role: "STUDENT" },
      target: { type: "curriculum_content", id: "content-1" },
      eventType: "lesson.complete",
      source: "/api/student/lessons/1/complete",
      clientEventId: "client-1",
      dedupeKey: "lesson:content-1:user-1",
      contentId: "content-1",
      subject: "MATH",
      grade: 6,
      versionRefs: {
        curriculumVersion: "cv-1",
        promptVersion: "pv-1",
      },
      metadata: { mode: "offline_sync" },
      qualityMarkers: { replaySafe: true },
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          schoolId: "school-1",
          userId: "user-1",
          actorType: "user",
          actorId: "user-1",
          actorRole: "STUDENT",
          targetType: "curriculum_content",
          targetId: "content-1",
          eventType: "lesson.complete",
          clientEventId: "client-1",
          dedupeKey: "lesson:content-1:user-1",
          curriculumVersion: "cv-1",
          promptVersion: "pv-1",
          metadata: { mode: "offline_sync" },
          qualityMarkers: { replaySafe: true },
        }),
      })
    );
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("returns null when the event write fails and throwOnError is not set", async () => {
    mockCreate.mockRejectedValueOnce(new Error("db down"));
    await expect(logLearningEvent({ eventType: "x" })).resolves.toBeNull();
  });

  it("rethrows when throwOnError is enabled", async () => {
    mockCreate.mockRejectedValueOnce(new Error("db down"));
    await expect(
      logLearningEvent({ eventType: "x" }, { throwOnError: true })
    ).rejects.toThrow("db down");
  });
});
