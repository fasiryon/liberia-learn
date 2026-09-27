import { describe, expect, it } from "vitest";
import { acceptLabAction, checkpointSession, restoreSession } from "@/lib/interactive-labs/v2/kernel";
import { resolveCapabilityProfile } from "@/lib/interactive-labs/v2/capabilities";
import { buildLabEvidence } from "@/lib/interactive-labs/v2/evidence";
import { solidsDefinition, initialSolidsState } from "@/lib/interactive-labs/v2/definitions/solids";
import { buildTeacherSummary } from "@/lib/interactive-labs/v2/summary";
import { adaptLabEvidence, LAB_EVIDENCE_AUTHORITY_VERSION, type LabLearningCheckAuthority } from "@/lib/interactive-labs/v2/governance";
import { GRADE4_MATH_ONTOLOGY_RELEASE, deterministicReleaseIdentity } from "@/lib/learning-authority/governedGrade4Math";

describe("interactive lab runtime v2", () => {
  it("rejects unknown objects and transitions valid direct manipulation", () => {
    const start = initialSolidsState();
    expect(acceptLabAction(solidsDefinition, start, { type: "select", objectId: "unknown" }).ok).toBe(false);
    const selected = acceptLabAction(solidsDefinition, start, { type: "select", objectId: "sphere" });
    if (selected.ok === false) throw new Error(selected.reason);
    expect(selected.state.selectedObjectId).toBe("sphere");
    const rotated = acceptLabAction(solidsDefinition, selected.state, { type: "rotate", objectId: "cube", delta: [1, 0] });
    if (rotated.ok === false) throw new Error(rotated.reason);
    expect(rotated.state.rotations.cube[1]).toBeGreaterThan(0);
  });

  it("requires manipulation for the cube check", () => {
    const start = initialSolidsState();
    const wrong = acceptLabAction(solidsDefinition, start, { type: "check", checkId: "rotate-cube", response: {} });
    if (wrong.ok === false) throw new Error(wrong.reason);
    expect(wrong.state.completedChecks).toEqual([]);
    const moved = acceptLabAction(solidsDefinition, start, { type: "rotate", objectId: "cube", delta: [1, 0] });
    if (moved.ok === false) throw new Error(moved.reason);
    const right = acceptLabAction(solidsDefinition, moved.state, { type: "check", checkId: "rotate-cube", response: {} });
    if (right.ok === false) throw new Error(right.reason);
    expect(right.state.completedChecks).toContain("rotate-cube");
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

  it("keeps raw manipulation provisional and proves canonical adaptation uses the existing scored-item semantics", () => {
    const rotated = { ...initialSolidsState(), rotations: { ...initialSolidsState().rotations, cube: [0, 1, 0] as [number, number, number] } };
    const raw = buildLabEvidence({ definition: solidsDefinition, check: solidsDefinition.checks[1], state: rotated, response: {}, tenantId: "school", schoolId: "school", studentId: "student", studentUserId: "user", sessionId: "session", retryCount: 0, hintCount: 0 });
    expect(adaptLabEvidence({ definition: solidsDefinition, check: solidsDefinition.checks[1], evidence: raw }).disposition).toBe("PROVISIONAL");

    const binding = GRADE4_MATH_ONTOLOGY_RELEASE.bindings[0];
    const item = GRADE4_MATH_ONTOLOGY_RELEASE.items.find((candidate) => candidate.id === binding.itemId)!;
    const governedDefinition = { ...solidsDefinition, objectiveIds: [binding.learningTargetCode], conceptIds: [binding.conceptId], releaseBinding: { releaseId: GRADE4_MATH_ONTOLOGY_RELEASE.id, releaseIdentity: deterministicReleaseIdentity(GRADE4_MATH_ONTOLOGY_RELEASE), activityId: solidsDefinition.id, activityVersion: solidsDefinition.version } };
    const governedCheck = { ...solidsDefinition.checks[0], objectiveId: binding.learningTargetCode, conceptId: binding.conceptId };
    const authority: LabLearningCheckAuthority = { contractVersion: LAB_EVIDENCE_AUTHORITY_VERSION, labId: governedDefinition.id, labVersion: governedDefinition.version, objectiveId: binding.learningTargetCode, conceptId: binding.conceptId, releaseId: GRADE4_MATH_ONTOLOGY_RELEASE.id, releaseIdentity: deterministicReleaseIdentity(GRADE4_MATH_ONTOLOGY_RELEASE), learningCheckId: governedCheck.id, evidenceKind: "LEARNING_CHECK_RESPONSE", acceptedState: { selectedAnswerIndex: 2 }, resultSemantics: "CORRECT_IF_SERVER_VALIDATED", evidencePolicyRef: binding.evidencePolicyId, disposition: "CANONICAL", canonicalActivity: { activityId: item.id, activityVersion: item.version, evidenceType: "DIAGNOSTIC" } };
    const accepted = buildLabEvidence({ definition: governedDefinition, check: governedCheck, state: { ...initialSolidsState(), selectedObjectId: "sphere" }, response: { selectedAnswerIndex: 2 }, tenantId: "school", schoolId: "school", studentId: "student", studentUserId: "user", sessionId: "session-2", retryCount: 0, hintCount: 0 });
    const canonical = adaptLabEvidence({ definition: governedDefinition, check: governedCheck, evidence: accepted, authority, release: GRADE4_MATH_ONTOLOGY_RELEASE });
    expect(canonical.disposition).toBe("CANONICAL");
    expect(canonical.canonicalEvidence?.itemId).toBe(item.id);
  });
});
