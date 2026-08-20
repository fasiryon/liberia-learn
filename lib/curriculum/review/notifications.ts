import type { CurriculumReviewSlot } from "@prisma/client";
import { prisma } from "@/lib/db";
import { sendPushToUser } from "@/lib/push/sendPush";
import { logger } from "@/lib/logger";
import { reviewEligibility } from "./eligibility";

export type ReviewNotificationEvent =
  | "ASSIGNMENT"
  | "HIGH_RISK_QUEUE"
  | "CLAIM_WARNING"
  | "CLAIM_EXPIRED"
  | "SECOND_REVIEW_REQUIRED"
  | "DISAGREEMENT"
  | "ESCALATION"
  | "RETURN_FOR_REVISION"
  | "FINAL_DECISION"
  | "CREDENTIAL_EXPIRY"
  | "CREDENTIAL_SUSPENDED"
  | "CREDENTIAL_REVOKED"
  | "SLA_WARNING"
  | "SLA_BREACH";

const COPY: Record<ReviewNotificationEvent, { title: string; body: string }> = {
  ASSIGNMENT: { title: "Curriculum review assigned", body: "A qualified review task has been assigned to you." },
  HIGH_RISK_QUEUE: { title: "High-risk review available", body: "A high-risk curriculum review matches your verified scope." },
  CLAIM_WARNING: { title: "Review claim expiring", body: "Your curriculum review claim will expire soon." },
  CLAIM_EXPIRED: { title: "Review claim expired", body: "Your curriculum review claim expired and may now be reclaimed." },
  SECOND_REVIEW_REQUIRED: { title: "Second review required", body: "An independent second curriculum review is ready." },
  DISAGREEMENT: { title: "Review disagreement", body: "Two immutable assessments disagree and require resolution." },
  ESCALATION: { title: "Review escalated", body: "A curriculum review requires an eligible resolver." },
  RETURN_FOR_REVISION: { title: "Curriculum returned for revision", body: "Reviewed curriculum needs revision before reapproval." },
  FINAL_DECISION: { title: "Curriculum review completed", body: "A qualified curriculum review decision is final." },
  CREDENTIAL_EXPIRY: { title: "Reviewer credential expiring", body: "One of your reviewer credentials is nearing expiry." },
  CREDENTIAL_SUSPENDED: { title: "Reviewer credential suspended", body: "One of your reviewer credentials was suspended." },
  CREDENTIAL_REVOKED: { title: "Reviewer credential revoked", body: "One of your reviewer credentials was revoked." },
  SLA_WARNING: { title: "Curriculum review SLA warning", body: "A qualified review task is nearing its due time." },
  SLA_BREACH: { title: "Curriculum review overdue", body: "A qualified review task has breached its SLA." },
};

export async function notifyReviewUsers(
  event: ReviewNotificationEvent,
  userIds: string[],
  taskId?: string,
): Promise<void> {
  const unique = Array.from(new Set(userIds));
  if (!unique.length) return;
  const copy = COPY[event];
  await prisma.notificationInboxItem.createMany({
    data: unique.map((userId) => ({
      userId,
      title: copy.title,
      body: copy.body,
      url: taskId ? `/review/tasks/${taskId}` : "/review/queue",
    })),
  });
  await Promise.all(unique.map((userId) => sendPushToUser(userId, copy).catch((error) => {
    logger.warn("[p2b.notify] push failed", { event, userId, error });
  })));
}

export async function notifyDeterministicEligibleReviewers(
  taskId: string,
  slot: CurriculumReviewSlot,
  event: ReviewNotificationEvent,
): Promise<number> {
  const profiles = await prisma.reviewerProfile.findMany({
    where: { status: "ACTIVE", available: true },
    take: 500,
    include: { user: true },
  });
  const eligible: string[] = [];
  for (const profile of profiles) {
    const result = await reviewEligibility({
      taskId,
      slot,
      user: {
        id: profile.user.id,
        role: profile.user.role,
        schoolId: profile.user.schoolId,
        isPlatformAdmin: profile.user.isPlatformAdmin,
      },
    });
    if (result.eligible) eligible.push(profile.userId);
  }
  await notifyReviewUsers(event, eligible, taskId);
  return eligible.length;
}
