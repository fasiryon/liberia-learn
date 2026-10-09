/**
 * Native Curriculum V2 approval rule (Codex P1-7).
 *
 * A native structured lesson is approved only by an identified, qualified human reviewing the
 * exact current revision. This holds regardless of feature flags:
 *
 *   GENERATION → DRAFT → VALIDATION → HUMAN REVIEW → GOVERNED APPROVAL → RELEASE
 *
 * AUTOMATED_RISK_POLICY, ROLE_POLICY and SCHOOL_POLICY can never approve native instruction;
 * AI_PLATFORM_REVIEW stays advisory. With provenance writers disabled there is no exact revision
 * to approve, so native approval fails closed in that mode. The Curriculum V2 generation
 * modules have no access to the governance writer at all (asserted by tests).
 */
export const NATIVE_APPROVAL_EVENTS = Object.freeze(["APPROVED", "REAPPROVED", "REINSTATED"] as const);

export class NativeCurriculumGovernanceError extends Error {
  constructor(code: string) {
    super(code);
    this.name = "NativeCurriculumGovernanceError";
  }
}

export function assertNativeCurriculumV2Approval(input: {
  native: boolean;
  writersEnabled: boolean;
  eventType: string;
  approvalBasis?: string | null;
  actorType: string;
  actorUserId?: string | null;
  reviewAuthority?: string | null;
  hasQualification: boolean;
  /** Snapshot schema of the exact revision being approved, when known. */
  revisionSnapshotSchemaVersion?: number | null;
  nativeSnapshotSchemaVersion: number;
}): void {
  if (!input.native || !(NATIVE_APPROVAL_EVENTS as readonly string[]).includes(input.eventType)) return;
  if (!input.writersEnabled) throw new NativeCurriculumGovernanceError("NATIVE_CURRICULUM_V2_REQUIRES_EXACT_REVISION: approval needs provenance writers (an exact revision to approve)");
  if (input.approvalBasis !== "HUMAN_REVIEW") throw new NativeCurriculumGovernanceError("NATIVE_CURRICULUM_V2_REQUIRES_HUMAN_REVIEW: automated, policy and AI approval cannot approve native instruction");
  if (input.actorType !== "USER" || !input.actorUserId || !input.hasQualification || !input.reviewAuthority || input.reviewAuthority === "SYSTEM" || input.reviewAuthority === "UNKNOWN") {
    throw new NativeCurriculumGovernanceError("NATIVE_CURRICULUM_V2_REQUIRES_QUALIFIED_HUMAN");
  }
  if (input.revisionSnapshotSchemaVersion != null && input.revisionSnapshotSchemaVersion !== input.nativeSnapshotSchemaVersion) {
    throw new NativeCurriculumGovernanceError("NATIVE_CURRICULUM_V2_REVISION_SNAPSHOT_STALE: the revision under review does not capture native scene structure");
  }
}
