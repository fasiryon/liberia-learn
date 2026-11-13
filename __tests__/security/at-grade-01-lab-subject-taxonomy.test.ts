/**
 * AT-GRADE-01 lab subjects for a subject co-teacher (founder decision 3, 2026-10-27; replaces the withdrawn CoS
 * ruling 1). A co-teacher's lab access applies only when VirtualLab.subject is EXACTLY the assigned Subject value.
 * Free-text labels such as "Physics", "Chemistry", "Biology" and "Earth Science" are unclassified and never grant
 * SCIENCE access by inference; neither does a differently written "science" or a missing subject.
 * Whole-class viewers (class teacher, school ADMIN) are unaffected. Synthetic identities and mocks only.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ assigned: [] as string[], viewer: "teacher-co" }));
const LABS: readonly (readonly [string, string | null])[] = [
  ["physics-lab", "Physics"], ["chemistry-lab", "Chemistry"], ["biology-lab", "Biology"], ["earth-lab", "Earth Science"],
  ["science-lab", "SCIENCE"], ["lower-science-lab", "science"], ["spaced-science-lab", " SCIENCE "], ["null-lab", null], ["empty-lab", ""],
];
vi.mock("@/lib/serverFlags", () => ({ isVirtualLabsEnabled: () => true }));
vi.mock("@/lib/auth", () => ({ requireRole: async () => ({ id: m.viewer, role: "TEACHER", schoolId: "school-a" }) }));
vi.mock("@/lib/db", () => ({ prisma: {
  class: { findUnique: async () => ({ schoolId: "school-a", teacherId: "teacher-primary" }) },
  teacherAssignment: { findMany: async () => m.assigned.map((subject) => ({ subject })) },
  enrollment: { findMany: async () => [{ Student: { userId: "s1" } }] },
  scheduledWork: { findMany: async () => [{ id: "w1" }] },
  labSession: { findMany: async () => LABS.map(([labId]) => ({ id: labId, labId, scheduledWorkId: "w1", startedAt: new Date(0), completedAt: new Date(0), score: 80, teacherFeedback: "Clear evidence." })) },
  virtualLab: { findMany: async () => LABS.map(([labId, subject]) => ({ labId, subject, title: labId })) },
} }));

import { GET } from "@/app/api/teacher/labs/sessions/route";

const labs = async () => {
  const res = await GET(new Request("http://localhost/api/teacher/labs/sessions?classId=c1") as any);
  expect(res.status).toBe(200);
  return ((await res.json()).sessions as { labId: string }[]).map((s) => s.labId).sort();
};
beforeEach(() => { m.assigned = ["SCIENCE"]; m.viewer = "teacher-co"; });

describe("a SCIENCE co-teacher of the class", () => {
  it("sees only the lab whose subject is exactly SCIENCE", async () => {
    expect(await labs()).toEqual(["science-lab"]);
  });
  it.each(["physics-lab", "chemistry-lab", "biology-lab", "earth-lab"])("is denied free-text %s (no inferred mapping)", async (lab) => {
    expect(await labs()).not.toContain(lab);
  });
  it.each(["lower-science-lab", "spaced-science-lab"])("is denied %s, written differently from the enum value", async (lab) => {
    expect(await labs()).not.toContain(lab);
  });
  it.each(["null-lab", "empty-lab"])("is denied %s, a lab with no subject", async (lab) => {
    expect(await labs()).not.toContain(lab);
  });
});

describe("unchanged around it", () => {
  it("a MATH co-teacher sees none of these labs", async () => {
    m.assigned = ["MATH"];
    expect(await labs()).toEqual([]);
  });
  it("the class's primary teacher still sees every lab of the class", async () => {
    m.viewer = "teacher-primary";
    expect(await labs()).toEqual(LABS.map(([labId]) => labId).sort());
  });
});
