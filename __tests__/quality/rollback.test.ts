import { describe, expect, it } from "vitest";
import { evaluateRollbackCandidate } from "@/lib/quality/rollback";
import type { ReleaseGateResult } from "@/lib/quality/releaseGate";

describe("rollback candidate", () => {
  it("recommends rollback with mandatory human authorization when the gate blocks", () => {
    const gate: ReleaseGateResult = { gateId: "g1", version: 1, evaluatedAt: "2026-09-01T00:00:00.000Z", result: "BLOCK", reasons: ["guardrail_breach"], rollbackRecommended: true };
    const candidate = evaluateRollbackCandidate(gate, "2026-09-01T00:00:00.000Z");
    expect(candidate).toMatchObject({ requiresHumanAuthorization: true, reasons: ["guardrail_breach"] });
  });

  it("returns null when the gate passes", () => {
    const gate: ReleaseGateResult = { gateId: "g1", version: 1, evaluatedAt: "2026-09-01T00:00:00.000Z", result: "PASS", reasons: [], rollbackRecommended: false };
    expect(evaluateRollbackCandidate(gate, "2026-09-01T00:00:00.000Z")).toBeNull();
  });
});
