import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({
  work: vi.fn(), student: vi.fn(), enrollment: vi.fn(), audio: vi.fn(), queue: vi.fn(), progress: vi.fn(), mastery: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ requireRole: async () => ({ id: "student-user", role: "STUDENT", schoolId: "school-a" }) }));
vi.mock("@/lib/db", () => ({ prisma: {
  scheduledWork: { findUnique: mocks.work }, student: { findUnique: mocks.student, findFirst: mocks.student }, enrollment: { findUnique: mocks.enrollment },
  studentProgress: { upsert: mocks.progress, updateMany: mocks.progress, create: mocks.progress },
} }));
vi.mock("@/lib/mastery/masteryService", () => ({ updateMasteryProfile: mocks.mastery }));
vi.mock("@/lib/lessons/audioGeneration", () => ({ getCurrentLessonAudio: mocks.audio, queueLessonAudioGeneration: mocks.queue }));
import { POST as audio } from "@/app/api/student/lessons/[id]/audio/route";
import { GET as answer } from "@/app/api/student/work/[scheduledWorkId]/problem-answer/[problemSetId]/route";
import { resolveScheduledLessonContext } from "@/lib/student/resolveScheduledLessonContext";
import { completeScheduledLesson } from "@/lib/student/completeScheduledLesson";

beforeEach(() => {
  vi.clearAllMocks(); mocks.student.mockResolvedValue({ id: "student-record" }); mocks.enrollment.mockResolvedValue({ id: "enrollment" });
  mocks.audio.mockResolvedValue({ status: "GENERATED", audio: { status: "GENERATED" } });
});
const row = () => ({ id: "work", classId: "class", class: { id: "class", schoolId: "school-a" },
  content: { contentId: "lesson", version: "1", subject: "MATH", grade: 4, status: "APPROVED", payload: { body: "Legacy body", problemSets: [] } }, progress: [],
});
describe("legacy auxiliary endpoints never downgrade governed work", () => {
  it.each([{ bundleId: "bundle" }, {
    bundleId: "bundle", bundleVersion: "1", bundleContentHash: "a".repeat(64), itemId: "lesson", itemVersion: "1", itemKind: "LESSON",
  }])("blocks partial/complete pins in legacy audio and answer reads", async pins => {
    mocks.work.mockResolvedValue({ ...row(), ...pins });
    expect((await audio(new Request("http://localhost/audio"), { params: { id: "work" } })).status).toBe(409);
    expect(mocks.audio).not.toHaveBeenCalled(); expect(mocks.queue).not.toHaveBeenCalled();
    expect((await answer(new NextRequest("http://localhost/answer"), { params: Promise.resolve({ scheduledWorkId: "work", problemSetId: "problem" }) })).status).toBe(409);
    await expect(resolveScheduledLessonContext({ id: "student-user", schoolId: "school-a" }, "work")).rejects.toMatchObject({ status: 409 });
    await expect(completeScheduledLesson({ user: { id: "student-user", schoolId: "school-a" }, scheduledWorkId: "work" })).rejects.toMatchObject({ status: 409 });
    expect(mocks.progress).not.toHaveBeenCalled(); expect(mocks.mastery).not.toHaveBeenCalled();
  });
  it("keeps legacy audio behavior", async () => {
    mocks.work.mockResolvedValue(row());
    expect((await audio(new Request("http://localhost/audio"), { params: { id: "work" } })).status).toBe(200);
    expect(mocks.audio).toHaveBeenCalledOnce();
    expect((await resolveScheduledLessonContext({ id: "student-user", schoolId: "school-a" }, "work")).body).toBe("Legacy body");
  });
});
