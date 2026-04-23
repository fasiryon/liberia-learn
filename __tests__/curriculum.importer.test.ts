import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCurriculumVersionCreate = vi.hoisted(() => vi.fn());
const mockCurriculumContentUpsert = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: {
    curriculumVersion: { create: mockCurriculumVersionCreate },
    curriculumContent: { upsert: mockCurriculumContentUpsert },
  },
}));

describe("curriculum importer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurriculumVersionCreate.mockResolvedValue({
      id: "version-1",
      versionName: "import-math-lesson-1",
    });
    mockCurriculumContentUpsert.mockImplementation(async (args) => ({
      id: "content-db-1",
      contentId: args.create.contentId,
      title: args.create.title,
    }));
  });

  it("normalizes structured text into existing curriculum lesson payloads", async () => {
    const { normalizeImportedCurriculum } = await import("@/lib/curriculum/importer");
    const imported = normalizeImportedCurriculum({
      format: "text",
      fileName: "math.txt",
      subject: "MATH",
      grade: 7,
      text: [
        "Subject: MATH",
        "Grade: 7",
        "Unit: Ratios",
        "Lesson: Ratios in Market Prices",
        "Objective: Compare two quantities using ratio language",
        "Students compare rice and cassava prices in a market table.",
        "Assessment: Explain which market bundle is better value.",
        "Teacher Notes: Ask learners to justify the comparison.",
      ].join("\n"),
    });

    expect(imported.subject).toBe("MATH");
    expect(imported.grade).toBe(7);
    expect(imported.units[0].lessons[0]).toMatchObject({
      title: "Ratios in Market Prices",
      objectives: ["Compare two quantities using ratio language"],
      assessment: "Explain which market bundle is better value.",
      teacherNotes: "Ask learners to justify the comparison.",
    });
  });

  it("persists imports as CurriculumContent records tied to a CurriculumVersion", async () => {
    const { normalizeImportedCurriculum, persistImportedCurriculum } = await import(
      "@/lib/curriculum/importer"
    );
    const imported = normalizeImportedCurriculum({
      format: "text",
      fileName: "math.txt",
      subject: "MATH",
      grade: 7,
      text: [
        "Unit: Ratios",
        "Lesson: Ratios in Market Prices",
        "Objective: Compare two quantities using ratio language",
        "Students compare rice and cassava prices in a market table.",
      ].join("\n"),
    });

    const result = await persistImportedCurriculum({
      imported,
      user: { id: "admin-1", role: "ADMIN", schoolId: "school-1" },
    });

    expect(result.lessonCount).toBe(1);
    expect(mockCurriculumVersionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ createdById: "admin-1", status: "DRAFT" }),
      })
    );
    expect(mockCurriculumContentUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          contentType: "lesson",
          status: "pending_approval",
          versionId: "version-1",
          payload: expect.objectContaining({
            approvalStatus: "PENDING_APPROVAL",
            originalImportedVersion: true,
          }),
        }),
      })
    );
  });
});
