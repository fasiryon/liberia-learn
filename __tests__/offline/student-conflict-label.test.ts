// T1 R4 browser acceptance (run5, 2026-11-14): the offline-status "Kept for your teacher" list showed a learner the
// internal model name "studentProgress:" (screens/a5-offline/status-conflict-390.png). Introduced by R4: the list labels
// each kept item with item.entity, which is the server's Prisma entity name, not learner wording. This test fails on
// 6fdb4285 and passes once the page maps items to learner words.
import fs from "node:fs";
import { describe, expect, it } from "vitest";

const PAGE = "app/student/offline-status/page.tsx";

describe("offline status: a kept conflict is named in learner words", () => {
  it("the label is not the raw server entity name", () => {
    const page = fs.readFileSync(PAGE, "utf8");
    // item.entity carries values such as "studentProgress" / "labSession" straight from /api/student/sync results.
    expect(page, "item.entity must not be rendered as the learner-visible label").not.toMatch(/item\.entity\s*\?\?/);
  });
});

describe("learnerItemLabel: learner words for an offline item (#29)", () => {
  it("maps each queued work type to learner words, with 'Lesson work' as the neutral fallback", async () => {
    const { learnerItemLabel } = await import("@/lib/offline/conflictCopy");
    expect(learnerItemLabel({ type: "lesson-complete", entity: "studentProgress" })).toBe("Lesson work");
    expect(learnerItemLabel({ type: "assignment-submission", entity: "assignmentSubmission" })).toBe("Assignment");
    expect(learnerItemLabel({ type: "homework" })).toBe("Homework");
    expect(learnerItemLabel({ type: "lab-submission", entity: "labSession" })).toBe("Lab work");
    for (const item of [{}, { entity: "studentProgress" }, { type: "something-new", entity: "attendanceRecord" }, { type: "" }]) {
      expect(learnerItemLabel(item)).toBe("Lesson work");
    }
  });
  it("the page labels both lists through learnerItemLabel", () => {
    const page = fs.readFileSync(PAGE, "utf8");
    expect(page).toContain("learnerItemLabel(item)");
    expect(page).not.toMatch(/itemName\(/);
  });
});
