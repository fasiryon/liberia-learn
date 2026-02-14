/**
 * Bridge layer: map your existing Assessment/Assignment data into the universal grading world.
 *
 * Goal:
 * - When you create an Assessment, auto-create a GradableItem(type=ASSESSMENT)
 * - When you create an Assignment, auto-create a GradableItem(type=ASSIGNMENT)
 *
 * You can implement this as:
 * - explicit calls in your existing creation APIs
 * - or Prisma middleware / triggers (later)
 *
 * For now, this file documents the mapping contract.
 */

export const BridgeMapping = {
    Assessment: {
      gradableType: "ASSESSMENT",
      maxPointsFrom: "sum(assessmentItem.points)",
      submissionsFrom: "Submission"
    },
    Assignment: {
      gradableType: "ASSIGNMENT",
      maxPointsFrom: "assignment.points",
      submissionsFrom: "AssignmentSubmission"
    }
  } as const;
  
