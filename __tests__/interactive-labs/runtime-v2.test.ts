import { describe, expect, it } from "vitest";
import { acceptLabAction, checkpointSession, restoreSession } from "@/lib/interactive-labs/v2/kernel";
import { resolveCapabilityProfile } from "@/lib/interactive-labs/v2/capabilities";
import { buildLabEvidence } from "@/lib/interactive-labs/v2/evidence";
import { solidsDefinition, initialSolidsState } from "@/lib/interactive-labs/v2/definitions/solids";
import { buildTeacherSummary } from "@/lib/interactive-labs/v2/summary";

describe("interactive lab runtime v2", () => {
  it("rejects unknown objects and transitions valid direct manipulation", () => {
    const start = initialSolidsState();
    expect(acceptLabAction(solidsDefinition, start, { type: "select", objectId: "unknown" }).ok).toBe(false);
    const selected = acceptLabAction(solidsDefinition, start, { type: "select", objectId: "sphere" });
    expect(selected.ok && selected.state.selectedObjectId).toBe("sphere");
    const rotated = acceptLabAction(solidsDefinition, selected.state, { type: "rotate", objectId: "cube", delta: [1, 0] });
    expect(rotated.ok && rotated.state.rotations.cube[1]).toBeGreaterThan(0);
  });

  it("requires manipulation for the cube check", () => {
    const start = initialSolidsState();
    const wrong = acceptLabAction(solidsDefinition, start, { type: "check", checkId: "rotate-cube", response: {} });
    expect(wrong.ok && wrong.state.completedChecks).toEqual([]);
    const moved = acceptLabAction(solidsDefinition, start, { type: "rotate", objectId: "cube", delta: [1, 0] });
    const right = acceptLabAction(solidsDefinition, moved.state, { type: "check", checkId: "rotate-cube", response: {} });
    expect(right.ok && right.state.completedChecks).toContain("rotate-cube");
  });

  it("restores only matching, meaningful checkpoints", () => {
    const checkpoint = checkpointSession({ sessionId: "s", labId: solidsDefinition.id, labVersion: solidsDefinition.version, learnerId: "u", tenantId: "school", mode: "GUIDED", completedChecks: [], retries: 0, hints: 0, state: initialSolidsState() });
    expect(restoreSession(checkpoint, solidsDefinition)?.sessionId).toBe("s");
    expect(restoreSession({ ...checkpoint, labVersion: "stale" }, solidsDefinition)).toBeNull();
  });

  it("selects deterministic low-end profiles and emits governed evidence without mastery mutation", () => {
    expect(resolveCapabilityProfile({ supportsWebGL: false })).toBe("FALLBACK_2D");
    expect(resolveCapabilityProfile({ memoryGb: 1 })).toBe("LOW");
    const evidence = buildLabEvidence({ definition: solidsDefinition, check: solidsDefinition.checks[0], state: { ...initialSolidsState(), selectedObjectId: "sphere" }, response: {}, tenantId: "school", schoolId: "school", studentId: "student", studentUserId: "user", sessionId: "session", retryCount: 0, hintCount: 0 });
    expect(evidence.contractVersion).toBe("governed-learning-evidence/1.0.0");
    expect(evidence.canonicalMasteryMutation).toBe(false);
    expect(evidence.performance.correct).toBe(true);
  });

  it("builds an explainable teacher summary from meaningful state", () => {
    const state = { ...initialSolidsState(), mode: "COMPLETE" as const, completedChecks: ["select-sphere"], retries: 1, rotations: { ...initialSolidsState().rotations, cube: [0, 1, 0] as [number, number, number] } };
    const summary = buildTeacherSummary(solidsDefinition.checks, { sessionId: "s", labId: solidsDefinition.id, labVersion: solidsDefinition.version, learnerId: "u", tenantId: "school", mode: "COMPLETE", completedChecks: state.completedChecks, retries: state.retries, hints: 0, state, updatedAt: new Date().toISOString() });
    expect(summary.status).toBe("COMPLETED");
    expect(summary.meaningfulManipulations).toContain("rotated:cube");
  });
});
