// Codex merge gate (third pass) P1-C: the learner listing, the learner detail route and the Tutor
// share one eligibility rule set. Each case row is served by a fake database that evaluates the real
// Prisma `where` filters each surface sends, so both the query prefilter and the in-memory gates run.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { runG4Proof } from "@/lib/curriculum/v2/g4Proof";

type Row = Record<string, any>;
const db = vi.hoisted(() => ({ row: null as Row | null }));
const requireRole = vi.hoisted(() => vi.fn());

/** Minimal evaluator for the Prisma where shapes these routes use. */
function matches(row: any, where: any): boolean {
  if (!where) return true;
  return Object.entries(where).every(([key, condition]: [string, any]) => {
    if (key === "AND") return condition.every((part: any) => matches(row, part));
    if (key === "OR") return condition.some((part: any) => matches(row, part));
    const value = row?.[key];
    if (condition === null) return value === null || value === undefined;
    if (typeof condition !== "object") return value === condition;
    if ("in" in condition) return condition.mode === "insensitive"
      ? condition.in.map((entry: string) => entry.toLowerCase()).includes(String(value).toLowerCase())
      : condition.in.includes(value);
    if ("notIn" in condition) return !condition.notIn.includes(value);
    if ("equals" in condition) return String(value).toLowerCase() === String(condition.equals).toLowerCase();
    if ("not" in condition) return value !== condition.not;
    if ("is" in condition) return condition.is === null ? value == null : value != null && matches(value, condition.is);
    if ("some" in condition) return Array.isArray(value) && value.some((entry: any) => matches(entry, condition.some));
    return value != null && matches(value, condition);
  });
}

vi.mock("@/lib/db", () => {
  const assignments = (relation: string) => ({
    findFirst: async ({ where }: any) => {
      const row = db.row;
      if (!row || row.contentId !== where.contentId) return null;
      return (row[relation] ?? []).find((entry: any) => matches(entry, { classId: where.classId, class: where.class })) ? { id: "assignment" } : null;
    },
  });
  const client: any = {
    student: { findUnique: async () => ({ id: "student-record", currentGrade: 7, deletedAt: null, user: { schoolId: "school-a" }, enrollments: [
      { classId: "class-a", Class: { subject: "MATH", schoolId: "school-a" } },
      { classId: "class-b", Class: { subject: "MATH", schoolId: "school-b" } },
    ] }) },
    curriculumContent: {
      findMany: async ({ where }: any) => (db.row && matches(db.row, where) ? [db.row] : []),
      findFirst: async ({ where }: any) => (db.row && matches(db.row, where) ? db.row : null),
    },
    assignment: { findMany: async () => [] },
    scheduledWork: { ...assignments("scheduledWork"), findMany: async () => [] },
    teacherLessonAssignment: assignments("teacherLessonAssignments"),
    curriculumGovernanceEvent: { findFirst: async () => null },
    curriculumContentRevision: { findFirst: async () => null },
  };
  return { prisma: { ...client, $transaction: async (callback: (tx: unknown) => unknown) => callback(client) } };
});
vi.mock("@/lib/auth", () => ({ requireRole }));
vi.mock("@/lib/learning-authority/publishedReleases", () => ({ publishedReleaseForLearner: () => null, publishedRelease: () => null }));

import { GET as learnDiscovery } from "@/app/api/student/learn/route";
import { GET as studentLessons } from "@/app/api/student/lessons/route";
import { NextRequest } from "next/server";
import { GET as listCurriculum } from "@/app/api/curriculum/route";
import { GET as getCurriculum } from "@/app/api/curriculum/[contentId]/route";
import { resolveTutorContext } from "@/lib/ai/tutor/tutorContext";

const student = { id: "learner", role: "STUDENT" as const, schoolId: "school-a", isPlatformAdmin: false };
const BODY = "Addition combines quantities. Subtraction finds what remains.";

function row(overrides: Row = {}): Row {
  return {
    id: "row-1", contentId: "lesson-1", title: "Addition", subject: "MATH", grade: 7, contentType: "lesson", lessonType: "core",
    status: "published", version: "1", versionId: null, curriculumVersion: null, schoolId: null, teacherCreated: false,
    visibility: "class_only", unitId: null, provenance: null, payload: { title: "Addition", body: BODY },
    scheduledWork: [], teacherLessonAssignments: [], audioAssets: [], videoSupplements: [], editedBy: null,
    createdAt: new Date("2026-10-01T00:00:00.000Z"), updatedAt: new Date("2026-10-02T00:00:00.000Z"),
    ...overrides,
  };
}

const nativeLesson = () => {
  const outcome = runG4Proof("equivalent-fractions.json", "moe-math-g4-s1-p3-number-theory-and-fraction-obj5");
  if (outcome.status === "REJECTED") throw new Error(outcome.errors.join());
  return outcome.lesson;
};
const assigned = [{ classId: "class-a", class: { schoolId: "school-a" } }];

const ALLOWED: Array<[string, Row]> = [
  ["eligible platform learner content", row()],
  ["own-school school-wide content", row({ schoolId: "school-a", teacherCreated: true, visibility: "school_wide" })],
  ["own-school content assigned to the student's class", row({ schoolId: "school-a", teacherCreated: true, scheduledWork: assigned })],
  ["own-school content assigned through a teacher lesson assignment", row({ schoolId: "school-a", teacherCreated: true, teacherLessonAssignments: assigned })],
  ["legacy content addressed to students", row({ payload: { title: "Addition", body: BODY, audience: "student", visibility: "class_only" } })],
  ["content on an ACTIVE version", row({ versionId: "v1", curriculumVersion: { status: "ACTIVE" } })],
];

const DENIED: Array<[string, Row]> = [
  ["foreign school", row({ schoolId: "school-b", visibility: "school_wide" })],
  ["foreign school assigned to the student's other-school class", row({ schoolId: "school-b", scheduledWork: [{ classId: "class-b", class: { schoolId: "school-b" } }] })],
  ["own-school content not assigned to the student", row({ schoolId: "school-a", teacherCreated: true })],
  ["teacher-created platform row", row({ teacherCreated: true })],
  ["teacher-only row visibility", row({ visibility: "teacher_only" })],
  ["private row visibility", row({ visibility: "private" })],
  ["internal row visibility", row({ visibility: "internal" })],
  ["malformed row visibility", row({ visibility: { level: "public" } })],
  ["reviewer-only payload audience", row({ payload: { body: BODY, audience: "reviewer" } })],
  ["teacher payload audience", row({ payload: { body: BODY, audience: "teacher" } })],
  ["internal payload visibility", row({ payload: { body: BODY, visibility: "internal" } })],
  ["malformed payload audience object", row({ payload: { body: BODY, audience: { teacherNotes: "x" } } })],
  ["malformed payload visibility object", row({ payload: { body: BODY, visibility: ["student"] } })],
  ["student audience with private visibility", row({ payload: { body: BODY, audience: "student", visibility: "private" } })],
  ["legacy published with a teacherOnly flag", row({ payload: { body: BODY, teacherOnly: true } })],
  ["legacy published with a malformed teacherOnly flag", row({ payload: { body: BODY, teacherOnly: "yes" } })],
  ["legacy published with a private flag", row({ payload: { body: BODY, private: true } })],
  ["inactive version", row({ versionId: "v0", curriculumVersion: { status: "ARCHIVED" } })],
  ["stale release version", row({ versionId: "v-old", curriculumVersion: { status: "DEPRECATED" } })],
  ["pending review with a lagging published status", row({ provenance: { id: "p1", lifecycleState: "PENDING_REVIEW", currentRevisionId: null, currentRevision: null, revisions: [] } })],
  ["superseded revision", row({ provenance: { id: "p1", lifecycleState: "SUPERSEDED", currentRevisionId: null, currentRevision: null, revisions: [] } })],
  ["unreleased native lesson", row({ payload: { title: "Fractions", curriculumV2: nativeLesson() } })],
  ["native payload claiming a release in a bare experience", row({ payload: { title: "x", lessonExperience: { authority: { status: "APPROVED_RELEASE" } } } })],
];

async function surfaces(target: Row) {
  db.row = target;
  requireRole.mockResolvedValue(student);
  const list = await (await listCurriculum(new Request("http://localhost/api/curriculum"))).json();
  const detail = await getCurriculum(new Request(`http://localhost/api/curriculum/${target.contentId}`), { params: { contentId: target.contentId } });
  const tutor = await resolveTutorContext(student, { contentId: target.contentId }).then(() => 200, (error) => error.status ?? 500);
  const discovery = await (await learnDiscovery()).json();
  const lessons = await (await studentLessons(new NextRequest("http://localhost/api/student/lessons"))).json();
  expect(discovery.lessons.items.some((item: { contentId: string }) => item.contentId === target.contentId)).toBe(detail.status === 200);
  expect(discovery.resources.items.some((item: { contentId: string }) => item.contentId === target.contentId)).toBe(detail.status === 200);
  expect(lessons.items.some((item: { contentId: string }) => item.contentId === target.contentId)).toBe(detail.status === 200);
  return { listed: list.items.some((item: { contentId: string }) => item.contentId === target.contentId), detail: detail.status, tutor };
}

beforeEach(() => { db.row = null; requireRole.mockReset(); });

describe("P1-C learner eligibility: list, detail and Tutor agree", () => {
  it.each(ALLOWED)("allowed on every surface: %s", async (_name, target) => {
    expect(await surfaces(target)).toEqual({ listed: true, detail: 200, tutor: 200 });
  });

  it.each(DENIED)("denied on every surface: %s", async (_name, target) => {
    const result = await surfaces(target);
    expect(result.listed).toBe(false);
    expect(result.detail).toBe(404);
    expect(result.tutor).toBe(404);
  });

  it("a denied detail response is indistinguishable from a missing row and carries no learner content", async () => {
    db.row = row({ visibility: "teacher_only", payload: { body: "TEACHER_ONLY_SECRET" } });
    requireRole.mockResolvedValue(student);
    const denied = await (await getCurriculum(new Request("http://localhost/api/curriculum/lesson-1"), { params: { contentId: "lesson-1" } })).json();
    db.row = null;
    const missing = await (await getCurriculum(new Request("http://localhost/api/curriculum/lesson-1"), { params: { contentId: "lesson-1" } })).json();
    expect(denied).toEqual(missing);
    expect(JSON.stringify(denied)).not.toContain("TEACHER_ONLY_SECRET");
  });

  it("teachers keep the authoring detail view of restricted rows", async () => {
    db.row = row({ visibility: "teacher_only", schoolId: "school-a", payload: { body: BODY, teacherNotes: "Teacher material" } });
    requireRole.mockResolvedValue({ id: "teacher", role: "TEACHER", schoolId: "school-a", isPlatformAdmin: false });
    const response = await getCurriculum(new Request("http://localhost/api/curriculum/lesson-1"), { params: { contentId: "lesson-1" } });
    expect(response.status).toBe(200);
    expect((await response.json()).payload.teacherNotes).toBe("Teacher material");
  });
});
