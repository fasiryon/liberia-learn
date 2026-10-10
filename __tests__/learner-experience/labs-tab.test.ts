import { describe, expect, it } from "vitest";
import { buildLabsTab } from "@/lib/learner-experience/labsTab";
import { findLabExperience, fromPracticalLab, labExperienceHref, listLabExperiences } from "@/lib/learner-experience/labExperience";
import { hydropowerLabLink } from "@/lib/learner-experience/fixtures/hydropowerLesson";
import { activeDestination, STUDENT_PRIMARY_NAV } from "@/lib/learner-experience/studentNavigation";

const practical = fromPracticalLab({ labId: "lab-sci-1", title: "Measuring density", subject: "PHYSICAL_SCIENCE", estimatedMinutes: 30, labType: "guided_walkthrough" });

describe("unified Lab Experience contract", () => {
  it("represents legacy, practical and interactive labs through one shape", () => {
    const labs = listLabExperiences();
    const kinds = new Set(labs.map((lab) => lab.runtime.kind));
    expect(kinds).toEqual(new Set(["LEGACY_SIMULATION", "INTERACTIVE_V2"]));
    expect(practical.runtime.kind).toBe("PRACTICAL_GUIDED");
    for (const lab of [...labs, practical]) {
      expect(lab.contractVersion).toBe("lab-experience/1.0.0");
      expect(typeof lab.title).toBe("string");
      expect(Array.isArray(lab.offline.degradation)).toBe(true);
    }
  });

  it("interactive labs degrade without changing objective, ending in a non-3D fallback", () => {
    const hydro = findLabExperience("mount-coffee-hydropower")!;
    expect(hydro.offline.degradation).toEqual(["HIGH", "STANDARD", "LOW", "FALLBACK_2D", "STATIC_TEACHER_GUIDED"]);
    expect(hydro.objectiveIds).toContain("hydropower-cause-and-effect");
  });

  it("uses one canonical learner URL namespace for every runtime", () => {
    expect(labExperienceHref({ labId: "gravity-explorer" })).toBe("/student/labs/gravity-explorer");
    expect(labExperienceHref({ labId: "g4-solid-figures" })).toBe("/student/labs/g4-solid-figures");
  });
});

describe("Labs tab", () => {
  const labs = [...listLabExperiences(), practical];

  it("hides uncertified legacy and unreleased interactive labs", () => {
    const tab = buildLabsTab({ labs, sessions: [], pathLinks: [], grade: 8 });
    const ids = tab.library.map((entry) => entry.lab.labId);
    expect(ids).not.toContain("human-heart");
    expect(ids).not.toContain("mount-coffee-hydropower");
    expect(ids).not.toContain("g4-solid-figures");
    expect(ids).not.toContain("lab-sci-1");
  });

  it("a release flag alone does not certify an interactive runtime", () => {
    const hydro = findLabExperience("mount-coffee-hydropower")!;
    const released = { ...hydro, release: { ...hydro.release, status: "RELEASED" as const } };
    const tab = buildLabsTab({ labs: [released, findLabExperience("human-heart")!], sessions: [], pathLinks: [], grade: 8 });
    expect(tab.library).toEqual([]);
  });

  it("splits sessions into Assigned, Continue and Completed", () => {
    const tab = buildLabsTab({
      labs, grade: 10, pathLinks: [],
      sessions: [
        { sessionId: "s1", labId: "lab-sci-1", assigned: true, startedAt: "2026-10-01T00:00:00.000Z", completedAt: null },
        { sessionId: "s2", labId: "human-heart", assigned: false, startedAt: "2026-10-01T00:00:00.000Z", completedAt: "2026-10-02T00:00:00.000Z" },
        { sessionId: "s3", labId: "mount-coffee-hydropower", assigned: true, startedAt: "2026-10-01T00:00:00.000Z", completedAt: null },
      ],
    });
    expect(tab.assigned.map((entry) => entry.session?.sessionId)).toEqual(["s1"]);
    expect(tab.continue.map((entry) => entry.session?.sessionId)).toEqual(["s1"]);
    expect(tab.completed).toEqual([]);
  });

  it("For You only uses approved governed links; prototype links never reach students", () => {
    expect(buildLabsTab({ labs, sessions: [], pathLinks: [hydropowerLabLink], grade: 8 }).forYou).toEqual([]);
  });
});

describe("Student IA", () => {
  it("defines exactly five primary destinations and maps legacy routes into them", () => {
    expect(STUDENT_PRIMARY_NAV.map((item) => item.label)).toEqual(["Today", "Learn", "Labs", "Progress", "Help"]);
    expect(activeDestination("/student/interactive-labs/g4-solid-figures")).toBe("LABS");
    expect(activeDestination("/student/lessons/abc")).toBe("LEARN");
    expect(activeDestination("/student/work/123")).toBe("TODAY");
    expect(activeDestination("/student/passport")).toBe("PROGRESS");
    expect(activeDestination("/teacher")).toBeNull();
  });
});
