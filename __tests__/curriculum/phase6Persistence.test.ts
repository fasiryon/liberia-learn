import { describe, expect, it } from "vitest";
import { canReplaceExistingPhase6Draft, phase6PersistenceDecision } from "@/lib/curriculum/phase6Persistence";

describe("Phase 6 missing curriculum persistence policy", () => {
  it("allows approved passing reruns to update existing draft-phase6 DRAFT rows", () => {
    expect(
      phase6PersistenceDecision({
        existing: { contentId: "draft-phase6-g5-english-w01-d2-core", status: "DRAFT" },
        approved: true,
        qualityPassed: true,
      })
    ).toBe("updated_existing_phase6_draft");
  });

  it("allows approved passing reruns to update existing draft-phase6 NEEDS_REVIEW rows", () => {
    expect(
      phase6PersistenceDecision({
        existing: { contentId: "draft-phase6-g5-english-w01-d3-core", status: "NEEDS_REVIEW" },
        approved: true,
        qualityPassed: true,
      })
    ).toBe("replaced_thin_content");
  });

  it("allows approved passing reruns to replace legacy NEEDS_REVIEW rows", () => {
    expect(
      phase6PersistenceDecision({
        existing: { contentId: "official-g5-english-w01-d3-core", status: "NEEDS_REVIEW" },
        approved: true,
        qualityPassed: true,
      })
    ).toBe("replaced_thin_content");
  });

  it("does not overwrite APPROVED rows", () => {
    expect(
      phase6PersistenceDecision({
        existing: { contentId: "draft-phase6-g5-english-w01-d4-core", status: "APPROVED" },
        approved: true,
        qualityPassed: true,
      })
    ).toBe("skipped_existing_protected_content");
  });

  it("does not write unapproved reruns over existing draft rows", () => {
    expect(
      canReplaceExistingPhase6Draft({
        existing: { contentId: "draft-phase6-g5-english-w01-d5-core", status: "DRAFT" },
        approved: false,
        qualityPassed: true,
      })
    ).toBe(false);
  });

  it("keeps non-phase6 rows protected even when status is DRAFT", () => {
    expect(
      phase6PersistenceDecision({
        existing: { contentId: "official-g5-english-w01-d2-core", status: "DRAFT" },
        approved: true,
        qualityPassed: true,
      })
    ).toBe("skipped_existing_protected_content");
  });

  it("only allows metadata replacement when the new lesson passes quality", () => {
    expect(
      phase6PersistenceDecision({
        existing: { contentId: "draft-phase6-g5-english-w01-d2-core", status: "DRAFT" },
        approved: true,
        qualityPassed: false,
      })
    ).toBe("skipped_existing_protected_content");
  });

  it("creates when no existing content row is present", () => {
    expect(
      phase6PersistenceDecision({
        existing: null,
        approved: true,
        qualityPassed: true,
      })
    ).toBe("created");
  });
});
