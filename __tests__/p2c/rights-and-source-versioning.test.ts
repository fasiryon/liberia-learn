import { describe, expect, it } from "vitest";
import { assertRightsAllowed, evaluateRights } from "@/lib/curriculum/benchmarking/rightsPolicy";
import { hashAuthoritySource, planAuthoritySourceChange } from "@/lib/curriculum/benchmarking/sourceVersioning";

describe("P2-C fail-closed rights governance", () => {
  it("does not treat unknown rights as permission to distribute", () => {
    expect(evaluateRights({ rightsStatus: "RIGHTS_UNKNOWN", action: "LEARNER_DISPLAY" })).toEqual({
      allowed: false,
      reason: "ACTION_NOT_GRANTED",
    });
  });

  it("allows only explicitly granted actions", () => {
    expect(evaluateRights({ rightsStatus: "OPEN_LICENSE", permittedActions: ["CITATION", "REPRODUCTION"], action: "REPRODUCTION" }).allowed).toBe(true);
    expect(evaluateRights({ rightsStatus: "OPEN_LICENSE", permittedActions: ["CITATION"], action: "TRANSFORMATION" }).allowed).toBe(false);
  });

  it("keeps reference-only sources out of learner distribution", () => {
    expect(evaluateRights({ rightsStatus: "REFERENCE_ONLY", permittedActions: ["AI_ANALYSIS"], action: "AI_ANALYSIS" }).allowed).toBe(true);
    expect(evaluateRights({ rightsStatus: "REFERENCE_ONLY", permittedActions: ["LEARNER_DISPLAY"], action: "LEARNER_DISPLAY" })).toEqual({
      allowed: false,
      reason: "REFERENCE_ONLY_LIMIT",
    });
  });

  it("blocks prohibited, expired, and revoked sources even when an action is listed", () => {
    for (const rightsStatus of ["PROHIBITED", "EXPIRED", "REVOKED"] as const) {
      expect(evaluateRights({ rightsStatus, permittedActions: ["CITATION"], action: "CITATION" }).allowed).toBe(false);
    }
  });

  it("throws a stable denial code", () => {
    expect(() => assertRightsAllowed({ rightsStatus: "RIGHTS_UNKNOWN", action: "OFFLINE_DISTRIBUTION" })).toThrow("SOURCE_RIGHTS_DENIED:ACTION_NOT_GRANTED:OFFLINE_DISTRIBUTION");
  });
});

describe("P2-C authority source change detection", () => {
  it("uses stable SHA-256 hashes", () => {
    expect(hashAuthoritySource("same")).toBe(hashAuthoritySource(new TextEncoder().encode("same")));
    expect(hashAuthoritySource("same")).toHaveLength(64);
  });

  it("does not invalidate alignments for an unchanged source", () => {
    const hash = hashAuthoritySource("v1");
    expect(planAuthoritySourceChange({ content: "v1", previousVersion: { id: "sv1", contentHash: hash }, alignments: [] })).toMatchObject({ changed: false, triggerAiReview: false, alignmentValidityEvents: [] });
  });

  it("marks impacted alignments stale and identifies affected courses", () => {
    const result = planAuthoritySourceChange({
      content: "v2",
      previousVersion: { id: "sv1", contentHash: hashAuthoritySource("v1") },
      alignments: [
        { id: "a1", sourceVersionIds: ["sv1"], impactedCourseRefs: ["G9-MATH", "G12-MATH"] },
        { id: "a2", sourceVersionIds: ["other"], impactedCourseRefs: ["G9-SCIENCE"] },
      ],
    });
    expect(result).toMatchObject({ changed: true, supersedesVersionId: "sv1", triggerAiReview: true, impactedCourseRefs: ["G12-MATH", "G9-MATH"] });
    expect(result.alignmentValidityEvents).toEqual([{ alignmentId: "a1", status: "STALE", reason: "AUTHORITATIVE_SOURCE_VERSION_CHANGED" }]);
  });
});
