import { describe, expect, it } from "vitest";
import { deriveQualityStopSignal } from "@/lib/experiments/qualityStopSignal";
import type { QualityReport } from "@/lib/experiments/qualityOperations";

const base: QualityReport = { state: "READY", evidenceHash: "h", reasons: [], reconciliation: { assigned: 1, exposed: 1, assignmentWithoutExposure: 0, exposureWithoutAssignment: 0, duplicates: 0, malformed: 0, crossSchool: 0 }, freshness: { late: 0, futureDated: 0, outOfWindow: 0, missingOutcomes: 0, missingRate: 0, maximumLatencyMs: 0 }, srm: { status: "NORMAL", total: 1, chiSquare: 0, threshold: 3.84, observed: {} }, comparisons: [], reviews: { required: [], missing: [], unauthorized: 0, failures: 0 }, audit: [] };

describe("quality stop signal for P7-B", () => {
  it("signals stop for STOPPED quality state", () => {
    expect(deriveQualityStopSignal({ ...base, state: "STOPPED" })).toEqual({ shouldStop: true, reason: "quality_stopped" });
  });
  it("signals stop for INVALID quality state", () => {
    expect(deriveQualityStopSignal({ ...base, state: "INVALID" })).toEqual({ shouldStop: true, reason: "quality_invalid" });
  });
  it("does not signal stop for READY, DEGRADED, PENDING_REVIEW, or INSUFFICIENT", () => {
    for (const state of ["READY", "DEGRADED", "PENDING_REVIEW", "INSUFFICIENT"] as const) {
      expect(deriveQualityStopSignal({ ...base, state })).toEqual({ shouldStop: false, reason: null });
    }
  });
});
