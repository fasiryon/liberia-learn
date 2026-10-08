import { describe, expect, it } from "vitest";
import { studentTutorIdentityForPath } from "@/lib/ai/tutor/routeContext";

describe("student lesson route identity hints", () => {
  it.each(["direct navigation", "reload", "catalog link entry"])("resolves singular catalog context without page markers on %s", () => {
    expect(studentTutorIdentityForPath("/student/lesson/g7-addition")).toEqual({ contentId: "g7-addition" });
  });
  it("resolves scheduled lesson context separately", () => {
    expect(studentTutorIdentityForPath("/student/lessons/scheduled-a")).toEqual({ lessonId: "scheduled-a" });
  });
  it("derives the next route identity instead of retaining previous page hints", () => {
    const previous = { pathname: "/student/lesson/lesson-a", identity: { contentId: "lesson-a", sceneId: "scene-a", objectiveIds: ["objective-a"] } };
    expect(studentTutorIdentityForPath("/student/lesson/lesson-b", previous)).toEqual({ contentId: "lesson-b" });
    expect(studentTutorIdentityForPath("/student/lessons/scheduled-b", previous)).toEqual({ lessonId: "scheduled-b" });
    expect(studentTutorIdentityForPath("/student/ai-tutor", previous)).toBeUndefined();
  });
  it("preserves scene hints only for the same route identity", () => {
    const pathname = "/student/lesson/lesson-a";
    expect(studentTutorIdentityForPath(pathname, { pathname, identity: { contentId: "lesson-a", sceneId: "scene-a" } })).toEqual({ contentId: "lesson-a", sceneId: "scene-a" });
    expect(studentTutorIdentityForPath(pathname, { pathname, identity: { contentId: "forged", sceneId: "scene-a" } })).toEqual({ contentId: "lesson-a" });
  });
  it("decodes URL identifiers and accepts a trailing slash", () => {
    expect(studentTutorIdentityForPath("/student/lesson/lesson%20a/")).toEqual({ contentId: "lesson a" });
  });
  it.each(["/student/lesson/%ZZ", "/student/lesson/", "/student/lesson/a/extra", "/student/lesson/a%2Fb", "/teacher/lesson/a"])("fails closed for malformed/non-lesson path %s", (path) => {
    expect(studentTutorIdentityForPath(path)).toBeUndefined();
  });
});
