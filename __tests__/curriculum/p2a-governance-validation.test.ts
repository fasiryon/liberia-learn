import { describe, expect, it } from "vitest";
import { appendCurriculumGovernanceEvent } from "@/lib/curriculum/mutations/governanceWriter";

describe("P2-A governance validation", () => {
  it("rejects governance actions that lack an accountable actor", async () => {
    await expect(
      appendCurriculumGovernanceEvent({
        contentId: "content-1",
        eventType: "SUBMITTED",
        actorType: "USER",
      }),
    ).rejects.toThrow("USER governance events require actorUserId");
  });

  it("requires explicit approval basis and authority", async () => {
    await expect(
      appendCurriculumGovernanceEvent({
        contentId: "content-1",
        eventType: "APPROVED",
        actorType: "SYSTEM",
        actorLabel: "policy",
      }),
    ).rejects.toThrow("APPROVED requires approvalBasis and reviewAuthority");
  });
});
