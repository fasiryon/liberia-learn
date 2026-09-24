/**
 * Placement human authority, split into two governed actions:
 *
 *  - PLACEMENT_REVIEW: inspect the result and record an instructional
 *    recommendation (append-only PlacementReview). Never changes grade.
 *  - PLACEMENT_CONFIRM: the official decision (immutable PlacementDecision)
 *    that is the only placement path allowed to set Student.currentGrade.
 *
 * The underlying assessment result (band, estimatedGrade, rawScore) is never
 * rewritten by either action.
 */
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { notifyPlacementConfirmation } from "@/lib/placement-notifications";

type Actor = { id: string; role: string; schoolId?: string | null; isPlatformAdmin?: boolean };

const fail = (status: number, message: string, code?: string) =>
  Object.assign(new Error(message), { status, code: code ?? message });

export const MIN_DECISION_REASON_LENGTH = 20;

function isGrade(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 12;
}

/** Loads a placement the actor may act on; other schools' placements are 404. */
async function loadScopedPlacement(actor: Actor, placementId: string) {
  const placement = await prisma.placementTest.findUnique({
    where: { id: placementId },
    include: {
      decision: true,
      student: {
        select: {
          id: true,
          currentGrade: true,
          guardians: { select: { guardianId: true, guardian: { select: { name: true } } } },
          user: {
            select: { id: true, name: true, schoolId: true, guardianPhoneE164: true, school: { select: { name: true } } },
          },
        },
      },
    },
  });
  const schoolId = placement?.student.user.schoolId ?? null;
  if (!placement || !schoolId) throw fail(404, "Placement not found", "placement_not_found");
  if (!actor.isPlatformAdmin && (!actor.schoolId || actor.schoolId !== schoolId)) {
    throw fail(404, "Placement not found", "placement_not_found");
  }
  return { placement, schoolId };
}

export async function recordPlacementReview(
  actor: Actor,
  placementId: string,
  input: { recommendation?: unknown; recommendedGrade?: unknown; note?: unknown }
) {
  if (!hasPermission(actor, PERMISSIONS.PLACEMENT_REVIEW)) throw fail(403, "Forbidden", "placement_review_forbidden");
  const { placement, schoolId } = await loadScopedPlacement(actor, placementId);

  if (input.recommendation !== "endorse" && input.recommendation !== "adjust") {
    throw fail(400, "recommendation must be 'endorse' or 'adjust'", "invalid_recommendation");
  }
  const note = typeof input.note === "string" ? input.note.trim() : "";
  let recommendedGrade = placement.estimatedGrade;
  if (input.recommendation === "adjust") {
    if (!isGrade(input.recommendedGrade) || input.recommendedGrade === placement.estimatedGrade) {
      throw fail(400, "An adjustment needs a different grade between 1 and 12", "invalid_recommended_grade");
    }
    if (note.length < MIN_DECISION_REASON_LENGTH) {
      throw fail(400, `An adjustment needs a note of at least ${MIN_DECISION_REASON_LENGTH} characters`, "reason_required");
    }
    recommendedGrade = input.recommendedGrade;
  }

  const review = await prisma.placementReview.create({
    data: {
      placementTestId: placement.id,
      schoolId,
      reviewerId: actor.id,
      recommendation: input.recommendation,
      recommendedGrade,
      note: note || null,
    },
  });
  await logAudit({
    userId: actor.id,
    schoolId,
    action: "placement.review.recorded",
    resourceType: "placement_test",
    resourceId: placement.id,
    details: { recommendation: input.recommendation, recommendedGrade, assessedGrade: placement.estimatedGrade },
  });
  return {
    review: {
      id: review.id,
      recommendation: review.recommendation,
      recommendedGrade: review.recommendedGrade,
      note: review.note,
      createdAt: review.createdAt.toISOString(),
    },
    officialGradeChanged: false,
  };
}

export async function confirmOfficialPlacement(
  actor: Actor,
  placementId: string,
  input: { finalGrade?: unknown; reason?: unknown }
) {
  if (!hasPermission(actor, PERMISSIONS.PLACEMENT_CONFIRM)) throw fail(403, "Forbidden", "placement_confirm_forbidden");
  const { placement, schoolId } = await loadScopedPlacement(actor, placementId);
  if (!isGrade(input.finalGrade)) throw fail(400, "finalGrade must be between 1 and 12", "invalid_final_grade");
  const finalGrade = input.finalGrade;
  const reason = typeof input.reason === "string" ? input.reason.trim() : "";

  // One official decision per placement result. A retry of the same decision
  // is a no-op; a different decision needs a new assessment.
  if (placement.decision) {
    if (placement.decision.finalGrade === finalGrade) {
      return { replayed: true, decision: serializeDecision(placement.decision), officialGradeChanged: false };
    }
    throw fail(409, "An official placement decision already exists for this result", "decision_already_recorded");
  }

  const isOverride = finalGrade !== placement.estimatedGrade;
  // A legacy result was scored in the browser, so confirming it always
  // needs a human justification, exactly like an override.
  const untrustedEvidence = placement.source !== "server_session";
  if ((isOverride || untrustedEvidence) && reason.length < MIN_DECISION_REASON_LENGTH) {
    throw fail(
      400,
      untrustedEvidence && !isOverride
        ? `Legacy client-scored results need a reason of at least ${MIN_DECISION_REASON_LENGTH} characters`
        : `An override needs a reason of at least ${MIN_DECISION_REASON_LENGTH} characters`,
      "reason_required"
    );
  }

  const decidedAt = new Date();
  const decision = await prisma.$transaction(async (tx) => {
    const created = await tx.placementDecision.create({
      data: {
        placementTestId: placement.id,
        studentId: placement.studentId,
        schoolId,
        decidedById: actor.id,
        recommendedGrade: placement.estimatedGrade,
        finalGrade,
        previousGrade: placement.student.currentGrade ?? null,
        isOverride,
        reason: reason || null,
        assessmentSource: placement.source,
      },
    });
    // Official-decision summary columns read by existing reports. The
    // assessment columns (band, estimatedGrade, rawScore) are untouched.
    await tx.placementTest.update({
      where: { id: placement.id },
      data: {
        teacherDecision: isOverride ? "overridden" : "confirmed",
        teacherGrade: isOverride ? finalGrade : null,
        teacherReason: reason || null,
        reviewedAt: decidedAt,
        reviewedBy: actor.id,
      },
    });
    await tx.student.update({ where: { id: placement.studentId }, data: { currentGrade: finalGrade } });
    return created;
  });

  await logAudit({
    userId: actor.id,
    schoolId,
    action: "placement.official.confirmed",
    resourceType: "placement_test",
    resourceId: placement.id,
    details: {
      decisionId: decision.id,
      recommendedGrade: placement.estimatedGrade,
      finalGrade,
      previousGrade: placement.student.currentGrade ?? null,
      isOverride,
      assessmentSource: placement.source,
      reason: reason || null,
    },
  });

  try {
    await notifyPlacementConfirmation({
      actingUserId: actor.id,
      schoolId,
      schoolName: placement.student.user.school?.name ?? "LiberiaLearn",
      student: {
        id: placement.studentId,
        userId: placement.student.user.id,
        name: placement.student.user.name ?? null,
        phone: placement.student.user.guardianPhoneE164 ?? null,
        guardians: placement.student.guardians.map((link) => ({
          guardianId: link.guardianId,
          guardianName: link.guardian.name ?? null,
        })),
      },
      finalGrade,
    });
  } catch (error) {
    console.error("Placement confirmation notification failed", error);
  }

  return { replayed: false, decision: serializeDecision(decision), officialGradeChanged: true };
}

function serializeDecision(decision: {
  id: string;
  recommendedGrade: number;
  finalGrade: number;
  previousGrade: number | null;
  isOverride: boolean;
  reason: string | null;
  decidedById: string;
  createdAt: Date;
}) {
  return {
    id: decision.id,
    recommendedGrade: decision.recommendedGrade,
    finalGrade: decision.finalGrade,
    previousGrade: decision.previousGrade,
    isOverride: decision.isOverride,
    reason: decision.reason,
    decidedById: decision.decidedById,
    decidedAt: decision.createdAt.toISOString(),
  };
}
