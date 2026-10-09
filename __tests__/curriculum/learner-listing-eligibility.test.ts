// Curriculum V2 / Codex second-pass P1-3: the learner curriculum listing applies the Tutor's
// learner-visibility rules, so a row a student cannot open through the Tutor is never listed.
import { beforeEach, describe, expect, it, vi } from "vitest";

const findMany = vi.hoisted(() => vi.fn());
const requireRole = vi.hoisted(() => vi.fn());
const studentFindUnique = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db", () => ({ prisma: { curriculumContent: { findMany }, student: { findUnique: studentFindUnique } } }));
vi.mock("@/lib/auth", () => ({ requireRole }));

import { GET } from "@/app/api/curriculum/route";
import { learnerRowAllowed, learnerVisibilityWhere } from "@/lib/curriculum/learnerEligibility";

const LEGACY = { title: "Fractions", body_standard: "## Learn\n\nHalves and quarters." };

function row(contentId: string, overrides: Record<string, unknown> = {}) {
  return {
    id: `row-${contentId}`, contentId, title: contentId, grade: 4, subject: "MATH", contentType: "lesson", status: "published", version: "1",
    payload: LEGACY, visibility: "class_only", versionId: null, curriculumVersion: null, audioAssets: [],
    createdAt: new Date("2026-10-01T00:00:00.000Z"), updatedAt: new Date("2026-10-02T00:00:00.000Z"),
    ...overrides,
  };
}

const student = { id: "u1", role: "STUDENT", schoolId: "school-a" };

beforeEach(() => {
  findMany.mockReset();
  requireRole.mockReset();
  studentFindUnique.mockReset();
  studentFindUnique.mockResolvedValue({
    enrollments: [
      { classId: "class-a1", Class: { schoolId: "school-a" } },
      { classId: "class-b1", Class: { schoolId: "school-b" } },
    ],
  });
});

describe("P1-3 learner listing uses the Tutor's visibility rules", () => {
  it("prefilters on platform, school-wide or class-assigned rows from the student's own-school enrollments only", async () => {
    requireRole.mockResolvedValue(student);
    findMany.mockResolvedValue([]);
    await GET(new Request("http://localhost/api/curriculum"));
    expect(studentFindUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "u1" } }));
    const scope = findMany.mock.calls[0][0].where.AND[1];
    expect(scope).toEqual(learnerVisibilityWhere({ schoolId: "school-a", classIds: ["class-a1"] }));
    const [owner, version, lifecycle, visibility] = scope.AND;
    expect(owner.OR).toEqual([
      { schoolId: null, teacherCreated: false },
      { schoolId: "school-a", visibility: "school_wide" },
      { schoolId: "school-a", scheduledWork: { some: { classId: { in: ["class-a1"] }, class: { schoolId: "school-a" } } } },
      { schoolId: "school-a", teacherLessonAssignments: { some: { classId: { in: ["class-a1"] }, class: { schoolId: "school-a" } } } },
    ]);
    expect(JSON.stringify(scope)).not.toContain("class-b1");
    expect(version).toEqual({ OR: [{ versionId: null }, { curriculumVersion: { is: { status: "ACTIVE" } } }] });
    expect(lifecycle).toEqual({ OR: [{ provenance: { is: null } }, { provenance: { is: { lifecycleState: "APPROVED" } } }] });
    expect(visibility).toEqual({ visibility: { notIn: ["teacher_only", "private"] } });
  });

  it("a student with no school or no classes gets platform rows only, never unassigned own-school rows", () => {
    expect(learnerVisibilityWhere({ schoolId: null, classIds: [] }).AND).toContainEqual({ OR: [{ schoolId: null, teacherCreated: false }] });
    expect(learnerVisibilityWhere({ schoolId: "school-a", classIds: [] }).AND).toContainEqual({
      OR: [{ schoolId: null, teacherCreated: false }, { schoolId: "school-a", visibility: "school_wide" }],
    });
  });

  it("drops teacher-only, private, inactive-version and non-released native rows that pass the prefilter", async () => {
    requireRole.mockResolvedValue(student);
    findMany.mockResolvedValue([
      row("ok"),
      row("ok-active-version", { versionId: "v1", curriculumVersion: { status: "ACTIVE" } }),
      row("teacher-visibility", { visibility: "teacher_only" }),
      row("private-visibility", { visibility: "private" }),
      row("archived-version", { versionId: "v0", curriculumVersion: { status: "ARCHIVED" } }),
      row("audience-teacher", { payload: { ...LEGACY, audience: "teacher" } }),
      row("audience-staff", { payload: { ...LEGACY, visibility: " Staff " } }),
      row("teacher-only-flag", { payload: { ...LEGACY, teacherOnly: true } }),
      row("native-malformed", { payload: { title: "Native", curriculumV2: { contractVersion: "broken" } } }),
      row("native-experience-only", { payload: { title: "Native", lessonExperience: { authority: { status: "APPROVED_RELEASE" } } } }),
    ]);
    const body = await (await GET(new Request("http://localhost/api/curriculum"))).json();
    expect(body.items.map((item: { contentId: string }) => item.contentId)).toEqual(["ok", "ok-active-version"]);
    expect(body.count).toBe(2);
  });

  it("learnerRowAllowed keeps legacy rows without a native payload", () => {
    expect(learnerRowAllowed({ visibility: "class_only", payload: LEGACY })).toBe(true);
    expect(learnerRowAllowed({ visibility: "school_wide", payload: null })).toBe(true);
  });

  it("teachers keep the unchanged authoring view: no learner scope, no enrollment lookup, no extra fields", async () => {
    requireRole.mockResolvedValue({ id: "t1", role: "TEACHER", schoolId: "school-a" });
    findMany.mockResolvedValue([row("teacher-visibility", { visibility: "teacher_only" })]);
    const body = await (await GET(new Request("http://localhost/api/curriculum"))).json();
    expect(studentFindUnique).not.toHaveBeenCalled();
    expect(findMany.mock.calls[0][0].where.AND[1]).toEqual({});
    expect(body.count).toBe(1);
    for (const key of ["visibility", "versionId", "curriculumVersion"]) expect(body.items[0]).not.toHaveProperty(key);
    expect(body.items[0].payload).toEqual(LEGACY);
  });
});
