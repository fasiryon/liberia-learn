import { createHash } from "crypto";

export function hashAuthoritySource(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export type SourceChangePlan = {
  changed: boolean;
  newHash: string;
  supersedesVersionId: string | null;
  alignmentValidityEvents: Array<{
    alignmentId: string;
    status: "STALE";
    reason: "AUTHORITATIVE_SOURCE_VERSION_CHANGED";
  }>;
  impactedCourseRefs: string[];
  triggerAiReview: boolean;
};

export function planAuthoritySourceChange(input: {
  content: Uint8Array | string;
  previousVersion?: { id: string; contentHash: string } | null;
  alignments: Array<{ id: string; sourceVersionIds: string[]; impactedCourseRefs?: string[] }>;
}): SourceChangePlan {
  const newHash = hashAuthoritySource(input.content);
  const changed = Boolean(input.previousVersion && input.previousVersion.contentHash !== newHash);
  if (!changed) {
    return {
      changed: false,
      newHash,
      supersedesVersionId: null,
      alignmentValidityEvents: [],
      impactedCourseRefs: [],
      triggerAiReview: false,
    };
  }

  const impacted = input.alignments.filter((alignment) =>
    alignment.sourceVersionIds.includes(input.previousVersion!.id),
  );
  return {
    changed: true,
    newHash,
    supersedesVersionId: input.previousVersion!.id,
    alignmentValidityEvents: impacted.map((alignment) => ({
      alignmentId: alignment.id,
      status: "STALE",
      reason: "AUTHORITATIVE_SOURCE_VERSION_CHANGED",
    })),
    impactedCourseRefs: Array.from(new Set(impacted.flatMap((alignment) => alignment.impactedCourseRefs ?? []))).sort(),
    triggerAiReview: impacted.length > 0,
  };
}
