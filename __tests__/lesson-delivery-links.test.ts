import { beforeEach, expect, it, vi } from "vitest";
import { hydropowerLessonExperience, hydropowerLabLink } from "@/lib/learner-experience/fixtures/hydropowerLesson";
import { resolveAuthorizedLabLinks } from "@/lib/lessons/lessonExperienceDelivery";
import { parseLabLaunchContext, buildStudentLabLaunchHref } from "@/lib/learner-experience/labLaunch";

const labs = vi.hoisted(() => ({ certified: false, lab: null as any }));
vi.mock("@/lib/learner-experience/labExperience", async (original) => ({
  ...await original<typeof import("@/lib/learner-experience/labExperience")>(),
  findLabExperience: () => labs.lab,
  isCertifiedStudentLab: () => labs.certified,
}));
const lesson = { ...hydropowerLessonExperience, authority: { ...hydropowerLessonExperience.authority, status: "APPROVED_RELEASE" as const } };
const link = { ...hydropowerLabLink, status: "APPROVED" as const, authority: { basis: "test-only reviewed link", approvedBy: "reviewer", approvedAt: "2026-10-12" } };
beforeEach(() => {
  labs.certified = true;
  labs.lab = { labId: link.experience.labId, version: link.experience.labVersion, title: "Reviewed lab", objectiveIds: link.objectiveIds, gradeBands: ["Grade 8"], release: { status: "RELEASED", reviewState: "APPROVED", approvalState: "APPROVED" } };
});
it("F: exposes a structurally approved link to a separately certified lab with stable return identity", () => {
  const [result] = resolveAuthorizedLabLinks(lesson, [link]);
  expect(result).toMatchObject({ labId: link.experience.labId, label: "Reviewed lab", sceneId: "lab", authorization: "APPROVED_LINK_CERTIFIED_LAB" });
  expect(result.returnTarget).toEqual({ route: { kind: "CONTENT", contentId: lesson.id }, sceneId: "lab" });
  const query = Object.fromEntries(new URL(buildStudentLabLaunchHref(result.returnTarget.route, result.launchContext), "https://example.test").searchParams);
  expect(parseLabLaunchContext(result.labId, query)?.origin).toMatchObject({ experienceId: lesson.id, experienceVersion: lesson.version, sceneId: "lab" });
});
it("G: denies candidates, incomplete approval, version mismatch and showcase-only labs", () => {
  expect(resolveAuthorizedLabLinks(lesson, [hydropowerLabLink])).toEqual([]);
  expect(resolveAuthorizedLabLinks(lesson, [{ ...link, authority: { ...link.authority, approvedBy: null } }])).toEqual([]);
  expect(resolveAuthorizedLabLinks(lesson, [{ ...link, lesson: { ...link.lesson, experienceVersion: "stale" } }])).toEqual([]);
  labs.certified = false;
  expect(resolveAuthorizedLabLinks(lesson, [link])).toEqual([]);
});
it("denies wrong-grade and unsupported-objective labs", () => {
  labs.lab.gradeBands = ["Grade 12"];
  expect(resolveAuthorizedLabLinks(lesson, [link])).toEqual([]);
  labs.lab.gradeBands = ["Grade 8"];
  labs.lab.objectiveIds = [];
  expect(resolveAuthorizedLabLinks(lesson, [link])).toEqual([]);
});

it("assigned return targets carry exact work identity and version, never a scheduled content URL", () => {
  const target = { kind: "SCHEDULED_WORK" as const, scheduledWorkId: "exact-work", contentId: lesson.id };
  const [result] = resolveAuthorizedLabLinks(lesson, [link], target);
  expect(result.returnTarget).toEqual({ route: target, sceneId: "lab" });
  expect(result.launchContext).toMatchObject({ labVersion: labs.lab.version, origin: { activityId: "exact-work", experienceId: lesson.id, experienceVersion: lesson.version } });
  expect(result).not.toHaveProperty("href");
});
