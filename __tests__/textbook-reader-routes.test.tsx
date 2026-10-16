import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireRole: vi.fn(), student: vi.fn(), audio: vi.fn(), list: vi.fn(), reader: vi.fn(), notFound: vi.fn(() => { throw new Error("NOT_FOUND"); }) }));
vi.mock("@/lib/auth", () => ({ requireRole: mocks.requireRole }));
vi.mock("@/lib/db", () => ({ prisma: { student: { findUnique: mocks.student }, curriculumContent: { findFirst: mocks.audio } } }));
vi.mock("@/lib/student/learnDiscovery.server", () => ({ listAuthorizedLearnerContent: mocks.list }));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/components/textbooks/TextbookReader", () => ({ TextbookReader: mocks.reader }));
import ReadingPage from "@/app/student/textbooks/[contentId]/page";
import TeacherPreview from "@/app/teacher/textbooks/preview/page";
import DemoPage from "@/app/pilot-preview/textbooks/page";

describe("textbook route authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireRole.mockResolvedValue({ id: "learner-one", schoolId: "school-one", role: "STUDENT" });
    mocks.student.mockResolvedValue({ currentGrade: 4, deletedAt: null, user: { schoolId: "school-one" } });
    mocks.audio.mockResolvedValue(null);
    mocks.list.mockResolvedValue([{ contentId: "reading-one", title: "Halves", subject: "MATHEMATICS", grade: 4, updatedAt: new Date("2026-01-01"), payload: { title: "Halves", body: "Read about equal parts.\n\n## Answer Key\nConfidential key", answerKey: ["secret"] } }]);
  });
  it("uses the existing student eligibility service and passes only projected reading", async () => {
    const result = await ReadingPage({ params: { contentId: "reading-one" } });
    expect(mocks.requireRole).toHaveBeenCalledWith("STUDENT");
    expect(mocks.list).toHaveBeenCalledWith(expect.objectContaining({ id: "learner-one", schoolId: "school-one" }), { contentId: "reading-one", grade: 4, contentType: "lesson" }, 1);
    expect(result.props.book.source).toBe("authorized-reading");
    expect(result.props.persistenceScope).toBe("school-one:learner-one");
    expect(JSON.stringify(result.props.book)).not.toContain("Confidential key");
    expect(JSON.stringify(result.props.book)).not.toContain("answerKey");
  });
  it("denies missing, foreign-school and deleted student records before reading content", async () => {
    for (const record of [null, { currentGrade: 4, deletedAt: null, user: { schoolId: "other-school" } }, { currentGrade: 4, deletedAt: new Date(), user: { schoolId: "school-one" } }]) {
      mocks.student.mockResolvedValue(record);
      await expect(ReadingPage({ params: { contentId: "reading-one" } })).rejects.toThrow("NOT_FOUND");
    }
    expect(mocks.list).not.toHaveBeenCalled();
  });
  it("fails closed when the shared service denies a curriculum row", async () => {
    mocks.list.mockResolvedValue([]);
    await expect(ReadingPage({ params: { contentId: "foreign-reading" } })).rejects.toThrow("NOT_FOUND");
  });
  it("requires existing staff roles and previews synthetic content only", async () => {
    const result = await TeacherPreview();
    expect(mocks.requireRole).toHaveBeenCalledWith("TEACHER", "ADMIN");
    expect(result.props.preview).toBe(true);
    expect(result.props.book.source).toBe("demonstration");
  });
  it("never exposes the public synthetic showcase in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    try { expect(() => DemoPage()).toThrow("NOT_FOUND"); } finally { vi.unstubAllEnvs(); }
  });
});
