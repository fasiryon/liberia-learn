import { describe, expect, it } from "vitest";
import { hydropowerLessonExperience as lesson, hydropowerLabLink as link } from "@/lib/learner-experience/fixtures/hydropowerLesson";
import { advance, applyLabReturn, chooseLabFallback, goToScene, initialProgress, isSceneComplete, markLabLaunched, recordResponse, restoreProgress, retreat, revealStep, sceneIndexOf } from "@/lib/learner-experience/progress";
import { buildLabLaunchHref, buildLessonReturnHref, isLabReturnObservation, parseLabLaunchContext, type LabLaunchContext, type LabReturnObservation } from "@/lib/learner-experience/labLaunch";
import { findLabExperience } from "@/lib/learner-experience/labExperience";
import { ExperienceLinkError, isLinkStudentVisible, validateExperienceLink } from "@/lib/learner-experience/links";

const BASE = "/lab-review/experience";
const context: LabLaunchContext = { v: 1, labId: "mount-coffee-hydropower", linkId: link.linkId, origin: { experienceId: lesson.id, experienceVersion: lesson.version, sceneId: "lab", objectiveIds: link.objectiveIds, activityId: lesson.id } };
const observation: LabReturnObservation = { labId: "mount-coffee-hydropower", labVersion: "1.1.0", linkId: link.linkId, completedCheckIds: ["trace-water"], totalChecks: 5, tripObserved: true, resetObserved: true, finalProfile: "LOW", minutesInLab: 7, exit: "RETURNED_EARLY" };

function query(href: string) {
  return Object.fromEntries(new URL(href, "http://x").searchParams.entries());
}

describe("Lesson Player V2 navigation and resume", () => {
  it("Previous / Continue move through scenes and Continue respects completion rules", () => {
    let progress = initialProgress(lesson);
    progress = advance(lesson, progress);
    progress = advance(lesson, progress);
    progress = advance(lesson, progress);
    expect(progress.sceneId).toBe("energy-chain");
    // Diagram scene: Continue is blocked until every step is revealed.
    expect(advance(lesson, progress).sceneId).toBe("energy-chain");
    for (const step of ["headpond", "penstock", "turbine", "generator", "city"]) progress = revealStep(progress, "energy-chain", step);
    progress = advance(lesson, progress);
    expect(progress.sceneId).toBe("quick-check");
    progress = retreat(lesson, progress);
    expect(progress.sceneId).toBe("energy-chain");
    expect(retreat(lesson, goToScene(lesson, progress, "intro")).sceneId).toBe("intro");
  });

  it("restores saved position and answers; discards progress from another lesson version", () => {
    let progress = goToScene(lesson, initialProgress(lesson), "quick-check");
    progress = recordResponse(progress, "quick-check", "qc-generator", 1);
    const restored = restoreProgress(lesson, JSON.parse(JSON.stringify(progress)));
    expect(restored.sceneId).toBe("quick-check");
    expect(restored.responses["quick-check"]["qc-generator"]).toBe(1);
    expect(restoreProgress(lesson, { ...progress, experienceVersion: "9.9.9" }).sceneId).toBe("intro");
    expect(restoreProgress(lesson, { ...progress, sceneId: "deleted-scene" }).sceneId).toBe("intro");
    expect(restoreProgress(lesson, "garbage").sceneId).toBe("intro");
  });
});

describe("Lesson → Lab → Lesson continuity", () => {
  it("launch carries the originating lesson, scene, objective, activity and link", () => {
    const href = buildLabLaunchHref(BASE, context);
    expect(href.startsWith(`${BASE}/${lesson.id}/lab/mount-coffee-hydropower?`)).toBe(true);
    expect(parseLabLaunchContext("mount-coffee-hydropower", query(href))).toEqual(context);
  });

  it("returns to the exact originating scene, never the Labs library", () => {
    const back = buildLessonReturnHref(BASE, context);
    expect(back).toBe(`${BASE}/${lesson.id}?scene=lab&from=lab`);
    expect(back).not.toContain("/student/labs");
    let progress = markLabLaunched(goToScene(lesson, initialProgress(lesson), "lab"), "lab");
    progress = goToScene(lesson, progress, "intro"); // e.g. a fresh tab
    progress = applyLabReturn(lesson, progress, "lab", observation);
    expect(lesson.scenes[sceneIndexOf(lesson, progress)].id).toBe("lab");
    expect(progress.lab.status).toBe("RETURNED");
    expect(isSceneComplete(lesson.scenes[sceneIndexOf(lesson, progress)], progress)).toBe(true);
  });

  it("rejects tampered launch context and base paths (no open redirect)", () => {
    expect(parseLabLaunchContext("mount-coffee-hydropower", { ...query(buildLabLaunchHref(BASE, context)), v: "2" })).toBeNull();
    expect(parseLabLaunchContext("mount-coffee-hydropower", { ...query(buildLabLaunchHref(BASE, context)), scene: "//evil.example" })).toBeNull();
    expect(parseLabLaunchContext("mount-coffee-hydropower", { ...query(buildLabLaunchHref(BASE, context)), obj: "" })).toBeNull();
    expect(() => buildLessonReturnHref("https://evil.example", context)).toThrow("experience_base_path_not_allowed");
    expect(isLabReturnObservation({ ...observation, completedCheckIds: [1] })).toBe(false);
    expect(isLabReturnObservation(observation)).toBe(true);
  });

  it("a learner who cannot open the lab can continue through the non-3D fallback", () => {
    const progress = chooseLabFallback(goToScene(lesson, initialProgress(lesson), "lab"));
    expect(isSceneComplete(lesson.scenes.find((scene) => scene.id === "lab")!, progress)).toBe(true);
  });
});

describe("governed lesson ↔ lab link", () => {
  const lab = findLabExperience("mount-coffee-hydropower")!;

  it("links by objective, not by subject and grade", () => {
    expect(() => validateExperienceLink(link, lesson, lab)).not.toThrow();
    expect(() => validateExperienceLink({ ...link, objectiveIds: ["proto-hydropower-supply-demand"] }, lesson, lab)).toThrow("link_objective_not_supported_by_lab");
    expect(() => validateExperienceLink({ ...link, placement: { sceneId: "review" } }, lesson, lab)).toThrow(ExperienceLinkError);
    expect(() => validateExperienceLink({ ...link, status: "APPROVED" }, lesson, lab)).toThrow("link_approval_provenance_required");
  });

  it("the prototype link, draft lab and fixture lesson are never student-visible", () => {
    expect(lab.release.status).toBe("DRAFT_UNRELEASED");
    expect(isLinkStudentVisible(link, lesson, lab)).toBe(false);
    // Even a link marked approved stays hidden while the lesson is a fixture and the lab is unreleased.
    expect(isLinkStudentVisible({ ...link, status: "APPROVED", authority: { basis: "x", approvedBy: "y", approvedAt: "2026-01-01T00:00:00.000Z" } }, lesson, lab)).toBe(false);
  });
});
