/**
 * Candidate → validated → review → approved state machine, derived by replaying attestations.
 *
 *   CANDIDATE   content exists; integrity validation has not passed
 *   VALIDATED   integrity validation passed; no review on the current hash yet
 *   IN_REVIEW   at least one review or AI recommendation exists on the current hash
 *   APPROVED    enough authorized human approvals on the CURRENT hash, all checks passing
 *   REJECTED    the latest authorized human decision on the current hash is a rejection
 *   RETIRED     withdrawn by an authorized actor (terminal)
 *
 * Invariants:
 *   - approvals bind to an exact (id, version, hash); after any content change the old approvals
 *     become stale and no longer count (approval invalidation is structural, not a flag);
 *   - AI reviewers only ever produce recommendations, which never count toward approval;
 *   - authors cannot approve their own content (separation of duties);
 *   - only reviewer roles can approve; teachers, students and school admins cannot.
 */
import { auditEvent, type AssessmentAuditEvent } from "./audit";
import { assertIsoTimestamp, type ValidationResult } from "./validator";
import {
  REVIEW_CHECKS,
  type AssessmentReviewV2,
  type AssessmentPurpose,
  type ContentStatus,
  type Provenance,
  type ReviewSubject,
  type ReviewerRole,
} from "./types";

export const REVIEWER_ROLES: readonly ReviewerRole[] = ["ASSESSMENT_REVIEWER", "CURRICULUM_LEAD", "PLATFORM_ADMIN"];

export type ReviewPolicy = Readonly<{
  policyId: string;
  version: string;
  minApprovals: number;
}>;

/** Higher-stakes purposes require independent second review by default. */
export function defaultReviewPolicy(purpose: AssessmentPurpose): ReviewPolicy {
  const highStakes = purpose === "EXAMINATION" || purpose === "SUMMATIVE";
  return Object.freeze({ policyId: "assessment-review-default", version: "1.0.0", minApprovals: highStakes ? 2 : 1 });
}

export function subjectRef(subject: ReviewSubject): string {
  const id = subject.kind === "ITEM" ? subject.itemId : subject.kind === "FORM" ? subject.formId : subject.definitionId;
  return `${subject.kind}:${id}@${subject.version}#${subject.hash}`;
}

function sameSubject(a: ReviewSubject, b: ReviewSubject): boolean {
  return subjectRef(a) === subjectRef(b);
}

function sameIdentity(a: ReviewSubject, b: ReviewSubject): boolean {
  const idA = a.kind === "ITEM" ? a.itemId : a.kind === "FORM" ? a.formId : a.definitionId;
  const idB = b.kind === "ITEM" ? b.itemId : b.kind === "FORM" ? b.formId : b.definitionId;
  return a.kind === b.kind && idA === idB;
}

function authorIds(provenance: Provenance): Set<string> {
  return new Set(provenance.authors.map((author) => author.id));
}

export function isAuthorizedApproval(review: AssessmentReviewV2, provenance: Provenance): boolean {
  if (review.actor.kind !== "HUMAN") return false;
  if (!REVIEWER_ROLES.includes(review.actor.role as ReviewerRole)) return false;
  if (authorIds(provenance).has(review.actor.userId)) return false;
  if (review.decision !== "APPROVE") return false;
  return REVIEW_CHECKS.every((check) => review.checks.some((entry) => entry.check === check && entry.outcome === "PASS"))
    && review.checks.every((entry) => entry.outcome === "PASS");
}

function isAuthorizedRejection(review: AssessmentReviewV2): boolean {
  return review.actor.kind === "HUMAN" && REVIEWER_ROLES.includes(review.actor.role as ReviewerRole) && review.decision === "REJECT";
}

/**
 * Boundary check for recording a review. Rejects reviews of a different hash than the content
 * currently under review, AI "approvals", and approvals from unauthorized or authoring actors.
 */
export function recordReview(input: {
  review: AssessmentReviewV2;
  current: ReviewSubject;
  provenance: Provenance;
  schoolId: string | null;
}): AssessmentAuditEvent {
  const { review, current } = input;
  assertIsoTimestamp(review.occurredAt, "review");
  if (!sameIdentity(review.subject, current)) throw new Error("assessment_review_subject_mismatch");
  if (!sameSubject(review.subject, current)) throw new Error("assessment_review_hash_mismatch");
  if (review.actor.kind === "AI") {
    if (review.decision === "APPROVE" || review.decision === "REJECT") throw new Error("assessment_ai_cannot_decide");
  } else {
    if (review.decision === "RECOMMEND_APPROVE" || review.decision === "RECOMMEND_REJECT") throw new Error("assessment_human_review_must_decide");
    if (!REVIEWER_ROLES.includes(review.actor.role as ReviewerRole)) throw new Error("assessment_reviewer_role_required");
    if (review.decision === "APPROVE" && authorIds(input.provenance).has(review.actor.userId)) throw new Error("assessment_author_cannot_approve");
    if (review.decision === "APPROVE" && !isAuthorizedApproval(review, input.provenance)) throw new Error("assessment_approval_requires_all_checks_pass");
  }
  const actor = review.actor.kind === "AI"
    ? { kind: "AI" as const, id: review.actor.agentId, role: null }
    : { kind: "HUMAN" as const, id: review.actor.userId, role: review.actor.role };
  return auditEvent({
    type: review.actor.kind === "AI" ? "assessment.review.ai_recommendation_recorded" : "assessment.review.recorded",
    subjectRef: subjectRef(current),
    actor,
    schoolId: input.schoolId,
    occurredAt: review.occurredAt,
    details: { reviewId: review.reviewId, decision: review.decision },
  });
}

export type LifecycleState = Readonly<{
  status: ContentStatus;
  currentRef: string;
  authorizedApprovals: readonly string[];
  /** Reviews of earlier hashes: kept for history, never counted. */
  staleReviewIds: readonly string[];
  aiRecommendationIds: readonly string[];
  reasons: readonly string[];
}>;

export function deriveContentStatus(input: {
  current: ReviewSubject;
  provenance: Provenance;
  validation: ValidationResult;
  reviews: readonly AssessmentReviewV2[];
  policy: ReviewPolicy;
  retired?: boolean;
}): LifecycleState {
  const reasons: string[] = [];
  const relevant = input.reviews.filter((review) => sameIdentity(review.subject, input.current));
  const stale = relevant.filter((review) => !sameSubject(review.subject, input.current));
  const onCurrent = relevant.filter((review) => sameSubject(review.subject, input.current));
  const ai = onCurrent.filter((review) => review.actor.kind === "AI");
  const approvals = onCurrent.filter((review) => isAuthorizedApproval(review, input.provenance));
  const approverIds = [...new Set(approvals.map((review) => (review.actor.kind === "HUMAN" ? review.actor.userId : "")))];
  const decisions = onCurrent
    .filter((review) => isAuthorizedApproval(review, input.provenance) || isAuthorizedRejection(review))
    .sort((a, b) => (a.occurredAt < b.occurredAt ? -1 : a.occurredAt > b.occurredAt ? 1 : 0));
  if (stale.length > 0) reasons.push("stale_reviews_ignored");

  let status: ContentStatus;
  if (input.retired) status = "RETIRED";
  else if (!input.validation.ok) {
    status = "CANDIDATE";
    reasons.push("validation_failed");
  } else if (decisions.length > 0 && isAuthorizedRejection(decisions[decisions.length - 1])) status = "REJECTED";
  else if (approverIds.length >= input.policy.minApprovals) status = "APPROVED";
  else if (onCurrent.length > 0) {
    status = "IN_REVIEW";
    if (approverIds.length > 0) reasons.push("additional_independent_approval_required");
    if (ai.length > 0 && approverIds.length === 0) reasons.push("ai_recommendation_is_not_approval");
  } else status = "VALIDATED";

  return Object.freeze({
    status,
    currentRef: subjectRef(input.current),
    authorizedApprovals: Object.freeze(approverIds),
    staleReviewIds: Object.freeze(stale.map((review) => review.reviewId)),
    aiRecommendationIds: Object.freeze(ai.map((review) => review.reviewId)),
    reasons: Object.freeze(reasons),
  });
}
