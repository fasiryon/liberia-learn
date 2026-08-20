import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(resolve(process.cwd(), "prisma/canonical/migrations/20260813_000001_p2b_qualified_review_operations/migration.sql"), "utf8");
const reviewCyclesSql = readFileSync(resolve(process.cwd(), "prisma/canonical/migrations/20260814_000001_p2b_review_cycles/migration.sql"), "utf8");

describe("P2-B database invariants", () => {
  it.each([
    "ReviewerCredentialScope_grade_range_check",
    "ReviewerCredential_verified_fields_check",
    "CurriculumReviewAssessment_submitted_fields_check",
    "CurriculumReviewAssignment_active_slot_key",
    "CurriculumReviewAssessment_submitted_immutable",
    "CurriculumReviewDecision_final_immutable",
    "ReviewerCredentialStatusEvent_immutable",
    "ReviewCalibrationResult_immutable",
    "ReviewerCredential_verified_core_immutable",
    "ReviewerCredentialScope_verified_immutable",
    "CurriculumReviewTask_revisionId_provenanceId_fkey",
    "CurriculumReviewDecision_integrity_guard",
  ])("contains %s", (guard) => expect(sql).toContain(guard));

  it("supports sequential governed review cycles on an exact revision", () => {
    expect(reviewCyclesSql).toContain('ADD COLUMN "reviewCycle" INTEGER NOT NULL DEFAULT 1');
    expect(reviewCyclesSql).toContain('"revisionId", "policyKey", "policyVersion", "reviewCycle"');
    expect(reviewCyclesSql).toContain('CHECK ("reviewCycle" > 0)');
  });
});
