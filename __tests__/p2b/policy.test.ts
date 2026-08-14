import { describe, expect, it } from "vitest";
import { evaluateReviewPolicy } from "@/lib/curriculum/review/policy";

const base = {
  subject: "MATHEMATICS",
  grade: 7,
  contentType: "lesson",
  requestedAuthority: "SCHOOL" as const,
  riskBand: "STANDARD" as const,
  provenanceComplete: true,
  evidenceCount: 0,
  now: new Date("2026-08-14T12:00:00.000Z"),
};

describe("P2-B deterministic policy", () => {
  it("uses the approved risk-band SLAs", () => {
    expect(evaluateReviewPolicy({ ...base, riskBand: "CRITICAL" }).slaMinutes).toBe(240);
    expect(evaluateReviewPolicy({ ...base, riskBand: "HIGH" }).slaMinutes).toBe(1440);
    expect(evaluateReviewPolicy(base).dueAt.toISOString()).toBe("2026-08-21T12:00:00.000Z");
    expect(evaluateReviewPolicy({ ...base, riskBand: "LOW" }).dueAt.toISOString()).toBe("2026-08-28T12:00:00.000Z");
  });

  it("requires blind independent review for high risk and sensitive subjects", () => {
    expect(evaluateReviewPolicy({ ...base, riskBand: "HIGH" })).toMatchObject({ requiredReviewCount: 2, blindSecondReview: true });
    expect(evaluateReviewPolicy({ ...base, subject: "CIVICS" })).toMatchObject({ requiredReviewCount: 2, evidenceRequired: true });
  });

  it("makes national and WAEC decisions MOE-qualified and proves P2-C types", () => {
    const result = evaluateReviewPolicy({ ...base, nationalPublication: true, waecAuthoritative: true, importedOrLicensed: true, sourceRightsRequired: true });
    expect(result.requiredAuthority).toBe("MOE");
    expect(result.specialistCredentialTypes).toEqual(expect.arrayContaining(["WAEC_SUBJECT_REVIEW", "LICENSED_SOURCE_REVIEW", "SOURCE_RIGHTS_VERIFICATION"]));
    expect(result.approvalBlocked).toBe(true);
  });

  it("allows one-person emergency revocation but not reinstatement", () => {
    expect(evaluateReviewPolicy({ ...base, riskBand: "CRITICAL", emergencyRevocation: true }).requiredReviewCount).toBe(1);
    expect(evaluateReviewPolicy({ ...base, reinstatementAfterRevocation: true }).requiredReviewCount).toBe(2);
  });

  it("does not change risk bands because of queue age", () => {
    const result = evaluateReviewPolicy({ ...base, riskScore: 99 });
    expect(result.priorityBand).toBe("STANDARD");
    expect(result.priorityScore).toBeGreaterThanOrEqual(2000);
    expect(result.priorityScore).toBeLessThan(3000);
  });
});
