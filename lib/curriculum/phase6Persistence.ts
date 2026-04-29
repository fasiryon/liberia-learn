export type Phase6PersistenceDecision =
  | "created"
  | "updated_existing_phase6_draft"
  | "skipped_existing_protected_content";

export type ExistingPhase6Content = {
  contentId: string;
  status: string;
};

const REPLACEABLE_STATUSES = new Set(["DRAFT", "NEEDS_REVIEW"]);

export function canReplaceExistingPhase6Draft(input: {
  existing: ExistingPhase6Content;
  approved: boolean;
  qualityPassed: boolean;
}) {
  return (
    input.existing.contentId.startsWith("draft-phase6-") &&
    REPLACEABLE_STATUSES.has(input.existing.status) &&
    input.approved &&
    input.qualityPassed
  );
}

export function phase6PersistenceDecision(input: {
  existing?: ExistingPhase6Content | null;
  approved: boolean;
  qualityPassed: boolean;
}): Phase6PersistenceDecision {
  if (!input.existing) return "created";
  if (canReplaceExistingPhase6Draft({ existing: input.existing, approved: input.approved, qualityPassed: input.qualityPassed })) {
    return "updated_existing_phase6_draft";
  }
  return "skipped_existing_protected_content";
}
