import { describe, expect, it } from "vitest";
import { GRADE4_MATH_ONTOLOGY_RELEASE } from "@/lib/learning-authority/governedGrade4Math";
import { validateReleaseBatch, validateReleaseManifest, type ReleaseManifest } from "@/lib/learning-authority/releaseManifests";

const manifest: ReleaseManifest = {
  manifestVersion: "1.0.0", releaseId: GRADE4_MATH_ONTOLOGY_RELEASE.id, grade: 4, subject: "MATH",
  provenance: { sourceRef: "fixture", authority: "LIBERIA_MOE", moeApprovalStatus: "APPROVED" },
  release: GRADE4_MATH_ONTOLOGY_RELEASE,
};

describe("curriculum release manifests", () => {
  it("validates the reference release and reports its unbound concepts", () => {
    const report = validateReleaseManifest(manifest);
    expect(report.ok).toBe(true);
    expect(report.identity).toMatch(/^[a-f0-9]{64}$/);
    expect(report.gaps).toEqual(expect.arrayContaining([expect.objectContaining({ conceptId: "g4-fractions-equivalence" })]));
  });

  it("fails closed for cross-scope releases and duplicate release ids", () => {
    const wrongScope = { ...manifest, grade: 5 };
    expect(validateReleaseManifest(wrongScope).ok).toBe(false);
    const batch = validateReleaseBatch([manifest, manifest]);
    expect(batch.ok).toBe(false);
    expect(batch.errors).toContain(`release_duplicate:${manifest.releaseId}`);
  });

  it("does not treat missing educational content as approval", () => {
    const gapOnly: ReleaseManifest = { ...manifest, release: undefined, provenance: { ...manifest.provenance, moeApprovalStatus: "NOT_CLAIMED" } };
    const report = validateReleaseManifest(gapOnly);
    expect(report.ok).toBe(true);
    expect(report.warnings).toContain("release_not_attached_content_gap_only");
    expect(report.gaps[0].gaps).toContain("LESSON");
  });
});
