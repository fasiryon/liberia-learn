import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const appendGovernance = vi.hoisted(() => vi.fn());
vi.mock("@/lib/curriculum/mutations/governanceWriter", async (original) => {
  const actual = await original<typeof import("@/lib/curriculum/mutations/governanceWriter")>();
  return { ...actual, appendCurriculumGovernanceEvent: appendGovernance };
});

import { appendCurriculumEvidence } from "@/lib/curriculum/mutations/evidenceWriter";
import { revokeCurriculum } from "@/lib/curriculum/mutations/revocationWriter";

describe("P2-A governance, evidence, and revocation contracts", () => {
  beforeEach(() => {
    appendGovernance.mockReset().mockResolvedValue({ id: "event-1" });
    process.env.P2A_PROVENANCE_WRITERS_DISABLED = "false";
  });
  afterEach(() => delete process.env.P2A_PROVENANCE_WRITERS_DISABLED);

  it("rejects evidence without a source locator", async () => {
    await expect(
      appendCurriculumEvidence({
        contentId: "content-1",
        revisionId: "revision-1",
        evidenceType: "DOCUMENT",
        evidencePurpose: "REVIEW_SUPPORT",
        title: "Review evidence",
      }),
    ).rejects.toThrow("Evidence requires a URI, document reference, or citation");
  });

  it("applies the approved default revocation and offline policies", async () => {
    await revokeCurriculum({
      contentId: "content-1",
      actorType: "SYSTEM",
      actorLabel: "integrity-policy",
      reason: "Integrity issue",
      reviewAuthority: "SYSTEM",
    });
    expect(appendGovernance).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "REVOKED",
        futureAssignmentPolicy: "BLOCK_NEW",
        existingAssignmentPolicy: "WITHDRAW_EXISTING",
        offlineCachePolicy: "INVALIDATE_ON_NEXT_REFRESH",
      }),
    );
  });

  it("supports urgent invalidation and successor replacement", async () => {
    await revokeCurriculum({
      contentId: "content-1",
      actorType: "SYSTEM",
      actorLabel: "urgent-policy",
      reason: "Urgent replacement",
      reviewAuthority: "SYSTEM",
      urgent: true,
      replaceWithSuccessor: true,
      replacementRevisionId: "revision-2",
    });
    expect(appendGovernance).toHaveBeenCalledWith(
      expect.objectContaining({
        futureAssignmentPolicy: "REPLACE_WITH_SUCCESSOR",
        existingAssignmentPolicy: "REPLACE_WITH_SUCCESSOR",
        offlineCachePolicy: "URGENT_INVALIDATE_ON_NEXT_REFRESH",
        replacementRevisionId: "revision-2",
      }),
    );
  });
});
