import { prisma } from "@/lib/db";
import { isAutonomousOptimizationEnabled } from "@/lib/serverFlags";
import { recordOptimizationReview } from "@/lib/autonomous/optimization/optimizationTraceService";
import type { OptimizationReviewStatus } from "@/lib/autonomous/optimization/types";

export type OptimizationReviewer = {
  id: string;
  role?: string | null;
  schoolId?: string | null;
  isPlatformAdmin?: boolean;
};

function ensureEnabled() {
  if (!isAutonomousOptimizationEnabled()) {
    throw Object.assign(new Error("Autonomous optimization is disabled"), { status: 404, code: "autonomous_optimization_disabled" });
  }
}

function canRead(event: any, user: OptimizationReviewer) {
  if (user.isPlatformAdmin) return true;
  if (event.schoolId) return user.role === "ADMIN" && user.schoolId === event.schoolId;
  return ["MOE_OFFICIAL", "MOE_SUPER_ADMIN", "DISTRICT_ADMIN"].includes(String(user.role));
}

function canReview(event: any, user: OptimizationReviewer) {
  if (user.isPlatformAdmin) return true;
  if (event.schoolId) return user.role === "ADMIN" && user.schoolId === event.schoolId;
  return user.role === "MOE_SUPER_ADMIN";
}

export async function listOptimizationRecommendations(input: {
  requester: OptimizationReviewer;
  schoolId?: string | null;
  aggregateOnly?: boolean;
  status?: OptimizationReviewStatus;
  limit?: number;
}) {
  ensureEnabled();
  const where: any = { eventType: "autonomous.optimization.proposed" };
  if (input.aggregateOnly) where.schoolId = null;
  else if (!input.requester.isPlatformAdmin) where.schoolId = input.requester.schoolId ?? "__none__";
  else if (input.schoolId) where.schoolId = input.schoolId;
  const proposals = await (prisma as any).learningEvent.findMany({ where, orderBy: { occurredAt: "desc" }, take: input.limit ?? 100 });
  const reviewEvents = await (prisma as any).learningEvent.findMany({
    where: { eventType: "autonomous.optimization.reviewed" },
    orderBy: { occurredAt: "desc" },
    take: 1000,
  });
  const latestReviewByProposal = new Map<string, any>();
  for (const review of reviewEvents) {
    const proposalId = review.metadata?.proposalEventId;
    if (proposalId && !latestReviewByProposal.has(proposalId)) latestReviewByProposal.set(proposalId, review);
  }
  return proposals
    .filter((event: any) => canRead(event, input.requester))
    .map((event: any) => {
      const review = latestReviewByProposal.get(event.id);
      const reviewStatus = review?.metadata?.reviewStatus ?? event.metadata?.reviewStatus ?? "PENDING_REVIEW";
      return {
        id: event.id,
        occurredAt: event.occurredAt,
        schoolId: event.schoolId,
        districtId: event.districtId,
        category: event.metadata?.category,
        title: event.metadata?.title,
        confidence: event.metadata?.confidence,
        riskLevel: event.metadata?.riskLevel,
        targetScope: event.metadata?.targetScope,
        approvalRequirement: event.metadata?.approvalRequirement,
        expectedImpact: event.metadata?.expectedImpact,
        rollbackGuidance: event.metadata?.rollbackGuidance,
        evidenceRefs: event.metadata?.evidenceRefs,
        lineage: event.metadata?.lineage,
        reviewStatus,
        applied: false,
      };
    })
    .filter((event: any) => !input.status || event.reviewStatus === input.status);
}

export async function getOptimizationRecommendation(input: { proposalEventId: string; requester: OptimizationReviewer }) {
  ensureEnabled();
  const event = await (prisma as any).learningEvent.findUnique({ where: { id: input.proposalEventId } });
  if (!event || event.eventType !== "autonomous.optimization.proposed") throw Object.assign(new Error("Optimization recommendation not found"), { status: 404 });
  if (!canRead(event, input.requester)) throw Object.assign(new Error("Forbidden"), { status: 403 });
  const reviews = await (prisma as any).learningEvent.findMany({
    where: { eventType: "autonomous.optimization.reviewed" },
    orderBy: { occurredAt: "desc" },
    take: 1000,
  });
  return { proposal: event, reviews: reviews.filter((review: any) => review.metadata?.proposalEventId === event.id), applied: false };
}

export async function reviewOptimizationRecommendation(input: {
  proposalEventId: string;
  reviewer: OptimizationReviewer;
  status: Exclude<OptimizationReviewStatus, "PENDING_REVIEW">;
  comment?: string | null;
}) {
  ensureEnabled();
  const event = await (prisma as any).learningEvent.findUnique({ where: { id: input.proposalEventId } });
  if (!event || event.eventType !== "autonomous.optimization.proposed") throw Object.assign(new Error("Optimization recommendation not found"), { status: 404 });
  if (!canReview(event, input.reviewer)) throw Object.assign(new Error("Forbidden"), { status: 403 });
  if (!["APPROVED", "REJECTED", "CANCELLED"].includes(input.status)) throw Object.assign(new Error("Invalid review status"), { status: 400 });
  return recordOptimizationReview({ proposalEvent: event, status: input.status, reviewer: input.reviewer, comment: input.comment });
}
