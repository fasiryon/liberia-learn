import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const curriculumContent = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    curriculumContent,
  },
}));
vi.mock("@/lib/audit", () => ({ logAuditRequired: vi.fn() }));

import {
  createCurriculumContent,
  updateCurriculumContent,
  upsertCurriculumContent,
} from "@/lib/curriculum/mutations/repository";

const context = {
  revisionKind: "HUMAN_CREATE",
  originKind: "HUMAN_AUTHORED",
  requestedCompleteness: "VERIFIED",
  auditAction: "test.curriculum.write",
} as const;

describe("P2-A authoritative content-write boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.P2A_PROVENANCE_WRITERS_DISABLED = "true";
    curriculumContent.create.mockResolvedValue({ id: "content-1", contentId: "lesson-1" });
  });

  afterEach(() => {
    delete process.env.P2A_PROVENANCE_WRITERS_DISABLED;
  });

  it("allows compatibility draft creation without manufacturing approval", async () => {
    await expect(createCurriculumContent({
      id: "content-1",
      contentId: "lesson-1",
      grade: 7,
      subject: "MATHEMATICS",
      contentType: "lesson",
      version: "1",
      status: "draft",
      payload: {},
    } as any, context as any)).resolves.toMatchObject({ provenance: null, revision: null });
    expect(curriculumContent.create).toHaveBeenCalledTimes(1);
  });

  it.each(["true", "false"])(
    "blocks direct publication with writers-disabled=%s",
    async (flag) => {
      process.env.P2A_PROVENANCE_WRITERS_DISABLED = flag;
      await expect(createCurriculumContent({
        id: "content-1",
        contentId: "lesson-1",
        grade: 7,
        subject: "MATHEMATICS",
        contentType: "lesson",
        version: "1",
        status: "published",
        payload: {},
      } as any, context as any)).rejects.toThrow("P2A_COMPATIBILITY_AUTHORITY_REQUIRED");
      expect(curriculumContent.create).not.toHaveBeenCalled();
    },
  );

  it("blocks update and upsert aliases for authoritative state", async () => {
    await expect(updateCurriculumContent(
      { contentId: "lesson-1" },
      { editReviewStatus: "APPROVED" } as any,
      { ...context, revisionKind: "HUMAN_EDIT" } as any,
    )).rejects.toThrow("P2A_COMPATIBILITY_AUTHORITY_REQUIRED");
    await expect(upsertCurriculumContent(
      { contentId: "lesson-1" },
      {
        id: "content-1",
        contentId: "lesson-1",
        grade: 7,
        subject: "MATHEMATICS",
        contentType: "lesson",
        version: "1",
        status: "draft",
        payload: {},
      } as any,
      { publishedAt: new Date() } as any,
      context as any,
    )).rejects.toThrow("P2A_COMPATIBILITY_AUTHORITY_REQUIRED");
    expect(curriculumContent.update).not.toHaveBeenCalled();
    expect(curriculumContent.upsert).not.toHaveBeenCalled();
  });
});
