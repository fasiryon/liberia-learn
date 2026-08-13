import type { CurriculumReviewAuthority } from "@prisma/client";
import {
  appendCurriculumGovernanceEvent,
  type GovernanceInput,
} from "@/lib/curriculum/mutations/governanceWriter";

export type RevokeCurriculumInput = Pick<
  GovernanceInput,
  | "contentId"
  | "revisionId"
  | "actorType"
  | "actorUserId"
  | "actorLabel"
  | "reason"
  | "replacementRevisionId"
  | "schoolId"
  | "traceId"
  | "idempotencyKey"
  | "compatibility"
> & {
  reviewAuthority: CurriculumReviewAuthority;
  urgent?: boolean;
  replaceWithSuccessor?: boolean;
};

export async function revokeCurriculum(input: RevokeCurriculumInput) {
  return appendCurriculumGovernanceEvent({
    ...input,
    eventType: "REVOKED",
    approvalBasis: null,
    futureAssignmentPolicy: input.replaceWithSuccessor
      ? "REPLACE_WITH_SUCCESSOR"
      : "BLOCK_NEW",
    existingAssignmentPolicy: input.replaceWithSuccessor
      ? "REPLACE_WITH_SUCCESSOR"
      : "WITHDRAW_EXISTING",
    offlineCachePolicy: input.urgent
      ? "URGENT_INVALIDATE_ON_NEXT_REFRESH"
      : "INVALIDATE_ON_NEXT_REFRESH",
  });
}
