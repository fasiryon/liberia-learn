import { describe, expect, it } from "vitest";
import {
  buildUnitSequence,
  deriveUnitName,
} from "@/lib/student/unitSequence";

describe("deriveUnitName", () => {
  it("prefers an explicit CurriculumUnit name when present", () => {
    expect(
      deriveUnitName("math-g8-5-geometry", "Unit 5: Geometry", [
        "Geometry: Foundations",
      ])
    ).toBe("Unit 5: Geometry");
  });

  it("derives the shared title prefix before a colon when no unit row exists", () => {
    expect(
      deriveUnitName("math-g8-5-geometry-and-spatial-thinking", null, [
        "Geometry and Spatial Thinking: Foundations",
        "Geometry and Spatial Thinking: Teacher Modeling",
        "Geometry and Spatial Thinking: Assessment and Reflection",
      ])
    ).toBe("Geometry and Spatial Thinking");
  });

  it("humanises the unitId slug when titles share no usable prefix", () => {
    expect(
      deriveUnitName("math-g8-5-geometry-and-spatial-thinking", null, [
        "Some lesson",
        "Another lesson",
      ])
    ).toBe("Geometry And Spatial Thinking");
  });
});

describe("buildUnitSequence", () => {
  const lessons = [
    { contentId: "c2", title: "Topic: Part 2", orderInUnit: 2, lessonType: "core", grade: 8, subject: "MATH" },
    { contentId: "c1", title: "Topic: Part 1", orderInUnit: 1, lessonType: "core", grade: 8, subject: "MATH" },
    { contentId: "c3", title: "Topic: Part 3", orderInUnit: 3, lessonType: "assessment", grade: 8, subject: "MATH" },
  ];

  it("orders lessons by orderInUnit ascending", () => {
    const seq = buildUnitSequence({
      unitId: "u1",
      curriculumUnitName: null,
      currentContentId: null,
      lessons,
      progressByContentId: new Map(),
    });
    expect(seq.lessons.map((l) => l.contentId)).toEqual(["c1", "c2", "c3"]);
  });

  it("marks completed lessons and computes completion percentage", () => {
    const seq = buildUnitSequence({
      unitId: "u1",
      curriculumUnitName: null,
      currentContentId: null,
      lessons,
      progressByContentId: new Map([
        ["c1", { scheduledWorkId: "sw1", completed: true }],
      ]),
    });
    expect(seq.lessons.find((l) => l.contentId === "c1")!.status).toBe("completed");
    expect(seq.completedCount).toBe(1);
    expect(seq.totalCount).toBe(3);
    expect(seq.completionPct).toBe(33);
  });

  it("marks the viewed lesson as current when it is not completed", () => {
    const seq = buildUnitSequence({
      unitId: "u1",
      curriculumUnitName: null,
      currentContentId: "c2",
      lessons,
      progressByContentId: new Map([
        ["c1", { scheduledWorkId: "sw1", completed: true }],
      ]),
    });
    expect(seq.lessons.find((l) => l.contentId === "c2")!.status).toBe("current");
    expect(seq.lessons.find((l) => l.contentId === "c3")!.status).toBe("upcoming");
  });

  it("falls back to the first incomplete lesson as current when none is being viewed", () => {
    const seq = buildUnitSequence({
      unitId: "u1",
      curriculumUnitName: null,
      currentContentId: null,
      lessons,
      progressByContentId: new Map([
        ["c1", { scheduledWorkId: "sw1", completed: true }],
      ]),
    });
    expect(seq.lessons.find((l) => l.contentId === "c2")!.status).toBe("current");
  });

  it("links scheduled lessons to the delivery page and others to the library viewer", () => {
    const seq = buildUnitSequence({
      unitId: "u1",
      curriculumUnitName: null,
      currentContentId: null,
      lessons,
      progressByContentId: new Map([
        ["c1", { scheduledWorkId: "sw1", completed: true }],
      ]),
    });
    expect(seq.lessons.find((l) => l.contentId === "c1")!.href).toBe("/student/lessons/sw1");
    expect(seq.lessons.find((l) => l.contentId === "c2")!.href).toBe("/student/lesson/c2");
  });

  it("locks a lesson only when it has an incomplete REQUIRED prerequisite", () => {
    const seq = buildUnitSequence({
      unitId: "u1",
      curriculumUnitName: null,
      currentContentId: null,
      lessons,
      progressByContentId: new Map(),
      requiredPrereqsByContentId: new Map([["c3", ["c1"]]]),
    });
    // c1 not completed -> c3 is locked; c2 has no required prereq -> open
    expect(seq.lessons.find((l) => l.contentId === "c3")!.locked).toBe(true);
    expect(seq.lessons.find((l) => l.contentId === "c2")!.locked).toBe(false);
  });

  it("does not lock when the required prerequisite is completed", () => {
    const seq = buildUnitSequence({
      unitId: "u1",
      curriculumUnitName: null,
      currentContentId: null,
      lessons,
      progressByContentId: new Map([["c1", { scheduledWorkId: "sw1", completed: true }]]),
      requiredPrereqsByContentId: new Map([["c3", ["c1"]]]),
    });
    expect(seq.lessons.find((l) => l.contentId === "c3")!.locked).toBe(false);
  });
});
