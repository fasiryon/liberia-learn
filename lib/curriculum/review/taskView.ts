import { prisma } from "@/lib/db";
import type { ReviewAccessUser } from "./access";
import { assertReviewReadScope } from "./access";
import { ReviewOperationError } from "./errors";

export async function getReviewTaskView(taskId: string, user: ReviewAccessUser) {
  const task = await prisma.curriculumReviewTask.findUnique({
    where: { id: taskId },
    include: {
      provenance: {
        include: {
          curriculumContent: true,
          currentRevision: { include: { evidence: { where: { status: "ACTIVE" } } } },
        },
      },
      revision: true,
      assignments: { include: { reviewerProfile: { select: { userId: true } } } },
      assessments: { include: { assignment: { select: { slot: true } } } },
      decision: true,
    },
  });
  if (!task) throw new ReviewOperationError("TASK_NOT_FOUND", 404);
  assertReviewReadScope(user, task.schoolId);
  const ownAssignment = task.assignments.find(
    (assignment) => assignment.reviewerProfile.userId === user.id && assignment.status === "ACTIVE",
  ) ?? task.assignments.find((assignment) => assignment.reviewerProfile.userId === user.id);
  const ownSubmitted = task.assessments.some(
    (assessment) => assessment.assignmentId === ownAssignment?.id && assessment.status === "SUBMITTED",
  );
  const independentSubmitted = task.assessments.filter(
    (assessment) =>
      assessment.status === "SUBMITTED" &&
      (assessment.assignment.slot === "FIRST" || assessment.assignment.slot === "SECOND"),
  ).length;
  const blindSecond =
    task.blindSecondReview &&
    !ownSubmitted &&
    independentSubmitted < task.requiredReviewCount &&
    (!ownAssignment || ownAssignment.slot === "SECOND");
  return {
    ...task,
    assignments: task.assignments.map((assignment) =>
      assignment.reviewerProfile.userId === user.id
        ? assignment
        : { ...assignment, leaseToken: null, idempotencyKey: null },
    ),
    assessments: blindSecond
      ? task.assessments
          .filter((assessment) => assessment.assignmentId === ownAssignment?.id)
          .map((assessment) => ({ ...assessment }))
      : task.assessments,
    blinding: {
      active: blindSecond,
      hiddenFields: blindSecond ? ["firstRecommendation", "firstRationale", "firstRubricResponses"] : [],
    },
  };
}
