import { describe, expect, it, vi } from "vitest";

const findTask = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db", () => ({
  prisma: { curriculumReviewTask: { findUnique: findTask } },
}));

import { getReviewTaskView } from "@/lib/curriculum/review/taskView";

describe("P2-B blind second review", () => {
  it("hides the first review before a potential second reviewer claims the task", async () => {
    findTask.mockResolvedValue({
      id: "task-1",
      schoolId: "school-a",
      blindSecondReview: true,
      requiredReviewCount: 2,
      provenance: { curriculumContent: {}, currentRevision: { evidence: [] } },
      revision: {},
      assignments: [{
        id: "assignment-1",
        slot: "FIRST",
        status: "SUBMITTED",
        leaseToken: "first-secret",
        idempotencyKey: "claim-1",
        reviewerProfile: { userId: "reviewer-1" },
      }],
      assessments: [{
        id: "assessment-1",
        assignmentId: "assignment-1",
        status: "SUBMITTED",
        recommendation: "APPROVE",
        rationale: "first rationale",
        assignment: { slot: "FIRST" },
      }],
      decision: null,
    });
    const view = await getReviewTaskView("task-1", {
      id: "potential-reviewer-2",
      role: "TEACHER",
      schoolId: "school-a",
    });
    expect(view.blinding.active).toBe(true);
    expect(view.assessments).toEqual([]);
  });

  it("hides the first review from an active second reviewer until independent submission", async () => {
    findTask.mockResolvedValue({
      id: "task-1",
      schoolId: "school-a",
      blindSecondReview: true,
      requiredReviewCount: 2,
      provenance: { curriculumContent: {}, currentRevision: { evidence: [] } },
      revision: {},
      assignments: [{
        id: "assignment-2",
        slot: "SECOND",
        status: "ACTIVE",
        leaseToken: "secret",
        idempotencyKey: "claim-2",
        reviewerProfile: { userId: "reviewer-2" },
      }],
      assessments: [{
        id: "assessment-1",
        assignmentId: "assignment-1",
        status: "SUBMITTED",
        recommendation: "APPROVE",
        rationale: "first rationale",
        assignment: { slot: "FIRST" },
      }],
      decision: null,
    });
    const view = await getReviewTaskView("task-1", {
      id: "reviewer-2",
      role: "TEACHER",
      schoolId: "school-a",
    });
    expect(view.blinding.active).toBe(true);
    expect(view.assessments).toEqual([]);
    expect(view.blinding.hiddenFields).toEqual([
      "firstRecommendation",
      "firstRationale",
      "firstRubricResponses",
    ]);
  });
});
