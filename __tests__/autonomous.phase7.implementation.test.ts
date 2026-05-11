import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---- Hoisted mocks ----
const mockPrisma = vi.hoisted(() => ({
  learningEvent: { findUnique: vi.fn(), findMany: vi.fn(), findFirst: vi.fn() },
  optimizationChangeRequest: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  changeRequestSignoff: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn() },
  stagedRolloutPlan: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  postChangeEvaluationPlan: { findUnique: vi.fn(), create: vi.fn() },
  workflowRun: { create: vi.fn(), update: vi.fn(), findFirst: vi.fn() },
  workflowCheckpoint: { findUnique: vi.fn(), create: vi.fn() },
  workflowStep: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  auditLog: { findMany: vi.fn() },
  approvalRequest: { findMany: vi.fn() },
  actionExecution: { findMany: vi.fn(), count: vi.fn() },
  executionTrace: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
}));
const mockLogLearningEvent = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/db/writeThrottle", () => ({ withDbWriteThrottle: (_name: string, fn: () => unknown) => fn() }));
vi.mock("@/lib/events/logLearningEvent", () => ({ logLearningEvent: mockLogLearningEvent }));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));

// ---- Test fixtures ----
const platformUser = { id: "platform-1", role: "ADMIN", schoolId: null, isPlatformAdmin: true } as any;
const schoolAdmin = { id: "admin-1", role: "ADMIN", schoolId: "school-1", isPlatformAdmin: false } as any;
const moeUser = { id: "moe-1", role: "MOE_OFFICIAL", schoolId: null, isPlatformAdmin: false } as any;
const teacher = { id: "teacher-1", role: "TEACHER", schoolId: "school-1", isPlatformAdmin: false } as any;

function proposalEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: "proposal-1",
    eventType: "autonomous.optimization.proposed",
    schoolId: "school-1",
    districtId: null,
    workflowTraceId: "trace-1",
    occurredAt: new Date(),
    metadata: {
      category: "detector_threshold",
      title: "Review detector threshold",
      confidence: 0.6,
      riskLevel: "medium",
      targetScope: "school",
      approvalRequirement: "Platform admin approval required",
      expectedImpact: "Reduce false positives.",
      rollbackGuidance: "Restore prior threshold config.",
      evidenceRefs: { metrics: { precision: 0.4 } },
      lineage: { source: "detectorTuningService" },
      proposedChange: { recommendationOnly: true },
      reviewStatus: "PENDING_REVIEW",
      applied: false,
    },
    ...overrides,
  };
}

function approvedReviewEvent(proposalId: string) {
  return {
    id: "review-1",
    eventType: "autonomous.optimization.reviewed",
    metadata: { proposalEventId: proposalId, reviewStatus: "APPROVED", applied: false },
    occurredAt: new Date(),
  };
}

function changeRequest(overrides: Record<string, unknown> = {}) {
  return {
    id: "cr-1",
    proposalEventId: "proposal-1",
    category: "detector_threshold",
    title: "Review detector threshold",
    affectedScope: "school",
    affectedArea: "detector_threshold",
    schoolId: "school-1",
    districtId: null,
    status: "DRAFT",
    implementationStatus: "NOT_STARTED",
    requiresManualImplementation: true,
    requiredReviewerRoles: ["platform_admin", "governance_reviewer", "school_admin"],
    rollbackPlan: { rollbackTrigger: "Any failure", rollbackOwner: "platform_admin", steps: [], expectedRestoredState: {} },
    proposedImplementationPlan: { requiresManualImplementation: true },
    idempotencyKey: "change-request:proposal-1",
    signoffs: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function rolloutPlan(overrides: Record<string, unknown> = {}) {
  return {
    id: "rp-1",
    changeRequestId: "cr-1",
    currentStage: "INTERNAL_ONLY",
    stages: [{ stage: "INTERNAL_ONLY", status: "pending" }],
    status: "DRAFT",
    requiresManualImplementation: true,
    rollbackVerificationChecklist: ["Confirm changes reversed"],
    rolloutVerification: null,
    rollbackVerification: null,
    ...overrides,
  };
}

beforeEach(() => {
  mockLogLearningEvent.mockResolvedValue({ id: "le-1" });
  mockLogAudit.mockResolvedValue(undefined);
  mockPrisma.optimizationChangeRequest.findUnique.mockResolvedValue(null);
  mockPrisma.workflowRun.findFirst.mockResolvedValue(null);
  mockPrisma.workflowCheckpoint.findUnique.mockResolvedValue(null);
  mockPrisma.workflowCheckpoint.create.mockResolvedValue({ id: "ckpt-1" });
  mockPrisma.workflowRun.create.mockResolvedValue({ id: "wf-1", schoolId: "school-1", districtId: null });
  mockPrisma.workflowRun.update.mockResolvedValue({});
  mockPrisma.changeRequestSignoff.findMany.mockResolvedValue([]);
  mockPrisma.auditLog.findMany.mockResolvedValue([]);
  mockPrisma.learningEvent.findMany.mockResolvedValue([]);
  mockPrisma.postChangeEvaluationPlan.findUnique.mockResolvedValue(null);
  mockPrisma.stagedRolloutPlan.findUnique.mockResolvedValue(null);
  mockPrisma.optimizationChangeRequest.findMany.mockResolvedValue([]);
});

afterEach(() => {
  vi.resetAllMocks();
  delete process.env.ENABLE_IMPLEMENTATION_WORKFLOW;
  delete process.env.ENABLE_AUTONOMOUS_OPTIMIZATION;
});

// ---- Feature flag tests ----
describe("feature flag enforcement", () => {
  it("createChangeRequestFromProposal fails closed when flag is off", async () => {
    const { createChangeRequestFromProposal } = await import("@/lib/autonomous/optimization/optimizationChangeRequestService");
    await expect(createChangeRequestFromProposal({ proposalEventId: "proposal-1", actor: platformUser, correlationId: "c1" }))
      .rejects.toMatchObject({ code: "implementation_workflow_disabled" });
  });

  it("prepareStagedRolloutPlan fails closed when flag is off", async () => {
    const { prepareStagedRolloutPlan } = await import("@/lib/autonomous/optimization/stagedRolloutService");
    await expect(prepareStagedRolloutPlan({ changeRequestId: "cr-1", actor: platformUser }))
      .rejects.toMatchObject({ status: 404 });
  });

  it("createPostChangeEvaluationPlan fails closed when flag is off", async () => {
    const { createPostChangeEvaluationPlan } = await import("@/lib/autonomous/optimization/postChangeEvaluationService");
    await expect(createPostChangeEvaluationPlan({ changeRequestId: "cr-1", actor: platformUser }))
      .rejects.toMatchObject({ status: 404 });
  });
});

// ---- Proposal → change request conversion ----
describe("approved proposal → change request", () => {
  it("rejects if proposal is not approved", async () => {
    process.env.ENABLE_IMPLEMENTATION_WORKFLOW = "true";
    process.env.ENABLE_AUTONOMOUS_OPTIMIZATION = "true";
    mockPrisma.learningEvent.findUnique.mockResolvedValue(proposalEvent());
    mockPrisma.learningEvent.findMany.mockResolvedValue([]); // no review events
    const { createChangeRequestFromProposal } = await import("@/lib/autonomous/optimization/optimizationChangeRequestService");
    await expect(createChangeRequestFromProposal({ proposalEventId: "proposal-1", actor: platformUser, correlationId: "c1" }))
      .rejects.toMatchObject({ code: "proposal_not_approved" });
    expect(mockPrisma.optimizationChangeRequest.create).not.toHaveBeenCalled();
  });

  it("creates change request from approved proposal", async () => {
    process.env.ENABLE_IMPLEMENTATION_WORKFLOW = "true";
    process.env.ENABLE_AUTONOMOUS_OPTIMIZATION = "true";
    mockPrisma.learningEvent.findUnique.mockResolvedValue(proposalEvent());
    mockPrisma.learningEvent.findMany.mockResolvedValue([approvedReviewEvent("proposal-1")]);
    const created = changeRequest();
    mockPrisma.optimizationChangeRequest.create.mockResolvedValue(created);
    const { createChangeRequestFromProposal } = await import("@/lib/autonomous/optimization/optimizationChangeRequestService");
    const result = await createChangeRequestFromProposal({ proposalEventId: "proposal-1", actor: platformUser, correlationId: "c1" });
    expect(result.status).toBe("DRAFT");
    expect(result.requiresManualImplementation).toBe(true);
    // Implementation plan must explicitly document that no policy is mutated.
    expect(result.proposedImplementationPlan?.requiresManualImplementation).toBe(true);
    expect(mockLogLearningEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "autonomous.implementation.change_request.created", metadata: expect.objectContaining({ policyMutation: false }) }),
      { throwOnError: true }
    );
  });

  it("is idempotent — reuses existing change request for same proposal", async () => {
    process.env.ENABLE_IMPLEMENTATION_WORKFLOW = "true";
    process.env.ENABLE_AUTONOMOUS_OPTIMIZATION = "true";
    const existing = changeRequest();
    mockPrisma.optimizationChangeRequest.findUnique.mockResolvedValue(existing);
    mockPrisma.learningEvent.findUnique.mockResolvedValue(proposalEvent());
    mockPrisma.learningEvent.findMany.mockResolvedValue([approvedReviewEvent("proposal-1")]);
    const { createChangeRequestFromProposal } = await import("@/lib/autonomous/optimization/optimizationChangeRequestService");
    const result = await createChangeRequestFromProposal({ proposalEventId: "proposal-1", actor: platformUser, correlationId: "c1" });
    expect(mockPrisma.optimizationChangeRequest.create).not.toHaveBeenCalled();
    expect(result.id).toBe("cr-1");
  });

  it("enforces tenant scope — school admin cannot see other school proposals", async () => {
    process.env.ENABLE_IMPLEMENTATION_WORKFLOW = "true";
    process.env.ENABLE_AUTONOMOUS_OPTIMIZATION = "true";
    mockPrisma.learningEvent.findUnique.mockResolvedValue(proposalEvent({ schoolId: "school-2" }));
    mockPrisma.learningEvent.findMany.mockResolvedValue([approvedReviewEvent("proposal-1")]);
    const otherSchoolAdmin = { id: "admin-2", role: "ADMIN", schoolId: "school-1", isPlatformAdmin: false } as any;
    const { createChangeRequestFromProposal } = await import("@/lib/autonomous/optimization/optimizationChangeRequestService");
    await expect(createChangeRequestFromProposal({ proposalEventId: "proposal-1", actor: otherSchoolAdmin, correlationId: "c1" }))
      .rejects.toMatchObject({ status: 403 });
  });
});

// ---- Reviewer sign-off ----
describe("reviewer sign-off", () => {
  it("rejects sign-off from unqualified role", async () => {
    process.env.ENABLE_IMPLEMENTATION_WORKFLOW = "true";
    mockPrisma.optimizationChangeRequest.findUnique.mockResolvedValue({ ...changeRequest(), status: "PENDING_REVIEW" });
    const { recordReviewerSignoff } = await import("@/lib/autonomous/optimization/reviewerSignoffService");
    await expect(recordReviewerSignoff({ changeRequestId: "cr-1", actor: teacher, decision: "APPROVED" }))
      .rejects.toMatchObject({ status: 403 });
  });

  it("rejects duplicate sign-off from same reviewer", async () => {
    process.env.ENABLE_IMPLEMENTATION_WORKFLOW = "true";
    mockPrisma.optimizationChangeRequest.findUnique.mockResolvedValue({ ...changeRequest(), status: "PENDING_REVIEW" });
    mockPrisma.changeRequestSignoff.findUnique.mockResolvedValue({ id: "existing-signoff" });
    const { recordReviewerSignoff } = await import("@/lib/autonomous/optimization/reviewerSignoffService");
    await expect(recordReviewerSignoff({ changeRequestId: "cr-1", actor: platformUser, decision: "APPROVED" }))
      .rejects.toMatchObject({ status: 409 });
  });

  it("records approval and checks all-approved gate", async () => {
    process.env.ENABLE_IMPLEMENTATION_WORKFLOW = "true";
    const cr = { ...changeRequest(), status: "PENDING_REVIEW" };
    mockPrisma.optimizationChangeRequest.findUnique.mockResolvedValue(cr);
    mockPrisma.changeRequestSignoff.findUnique.mockResolvedValue(null);
    const signoff = { id: "sf-1", decision: "APPROVED", reviewerRole: "platform_admin", changeRequestId: "cr-1" };
    mockPrisma.changeRequestSignoff.create.mockResolvedValue(signoff);
    // Only platform_admin signed off; school_admin and governance_reviewer still missing.
    mockPrisma.changeRequestSignoff.findMany.mockResolvedValue([signoff]);
    const { recordReviewerSignoff } = await import("@/lib/autonomous/optimization/reviewerSignoffService");
    const result = await recordReviewerSignoff({ changeRequestId: "cr-1", actor: platformUser, decision: "APPROVED" });
    expect((result.signoff as any).id).toBe("sf-1");
    expect(result.allApproved).toBe(false);
    expect(mockPrisma.optimizationChangeRequest.update).not.toHaveBeenCalled();
  });

  it("sets APPROVED_FOR_ROLLOUT when all required roles approve", async () => {
    process.env.ENABLE_IMPLEMENTATION_WORKFLOW = "true";
    const allRequired = ["platform_admin", "governance_reviewer", "school_admin"];
    const cr = { ...changeRequest({ requiredReviewerRoles: allRequired }), status: "PENDING_REVIEW" };
    mockPrisma.optimizationChangeRequest.findUnique.mockResolvedValue(cr);
    mockPrisma.changeRequestSignoff.findUnique.mockResolvedValue(null);
    const signoff = { id: "sf-school", decision: "APPROVED", reviewerRole: "school_admin", changeRequestId: "cr-1" };
    mockPrisma.changeRequestSignoff.create.mockResolvedValue(signoff);
    mockPrisma.changeRequestSignoff.findMany.mockResolvedValue([
      { decision: "APPROVED", reviewerRole: "platform_admin" },
      { decision: "APPROVED", reviewerRole: "governance_reviewer" },
      signoff,
    ]);
    mockPrisma.optimizationChangeRequest.update.mockResolvedValue({ ...cr, status: "APPROVED_FOR_ROLLOUT" });
    const { recordReviewerSignoff } = await import("@/lib/autonomous/optimization/reviewerSignoffService");
    const result = await recordReviewerSignoff({ changeRequestId: "cr-1", actor: schoolAdmin, decision: "APPROVED" });
    expect(result.allApproved).toBe(true);
    expect(mockPrisma.optimizationChangeRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "APPROVED_FOR_ROLLOUT" }) })
    );
    expect(mockLogLearningEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "autonomous.implementation.change_request.approved_for_rollout" }),
      { throwOnError: true }
    );
  });

  it("immediately sets REJECTED if any signer rejects", async () => {
    process.env.ENABLE_IMPLEMENTATION_WORKFLOW = "true";
    const cr = { ...changeRequest(), status: "PENDING_REVIEW" };
    mockPrisma.optimizationChangeRequest.findUnique.mockResolvedValue(cr);
    mockPrisma.changeRequestSignoff.findUnique.mockResolvedValue(null);
    mockPrisma.changeRequestSignoff.create.mockResolvedValue({ id: "sf-rej", decision: "REJECTED", reviewerRole: "platform_admin" });
    mockPrisma.optimizationChangeRequest.update.mockResolvedValue({ ...cr, status: "REJECTED" });
    const { recordReviewerSignoff } = await import("@/lib/autonomous/optimization/reviewerSignoffService");
    const result = await recordReviewerSignoff({ changeRequestId: "cr-1", actor: platformUser, decision: "REJECTED", comment: "Not safe yet" });
    expect(result.allApproved).toBe(false);
    expect(mockPrisma.optimizationChangeRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "REJECTED" }) })
    );
  });
});

// ---- Staged rollout ----
describe("staged rollout", () => {
  it("rejects rollout plan if change request is not APPROVED_FOR_ROLLOUT", async () => {
    process.env.ENABLE_IMPLEMENTATION_WORKFLOW = "true";
    mockPrisma.optimizationChangeRequest.findUnique.mockResolvedValue(changeRequest({ status: "PENDING_REVIEW" }));
    const { prepareStagedRolloutPlan } = await import("@/lib/autonomous/optimization/stagedRolloutService");
    await expect(prepareStagedRolloutPlan({ changeRequestId: "cr-1", actor: platformUser })).rejects.toMatchObject({ status: 422 });
    expect(mockPrisma.stagedRolloutPlan.create).not.toHaveBeenCalled();
  });

  it("creates staged rollout plan with manual implementation flag", async () => {
    process.env.ENABLE_IMPLEMENTATION_WORKFLOW = "true";
    const cr = changeRequest({ status: "APPROVED_FOR_ROLLOUT" });
    mockPrisma.optimizationChangeRequest.findUnique.mockResolvedValue(cr);
    mockPrisma.stagedRolloutPlan.findUnique.mockResolvedValue(null);
    const plan = rolloutPlan();
    mockPrisma.stagedRolloutPlan.create.mockResolvedValue(plan);
    mockPrisma.optimizationChangeRequest.update.mockResolvedValue({});
    const { prepareStagedRolloutPlan } = await import("@/lib/autonomous/optimization/stagedRolloutService");
    const result = await prepareStagedRolloutPlan({ changeRequestId: "cr-1", actor: platformUser });
    expect(result.requiresManualImplementation).toBe(true);
    expect(mockPrisma.stagedRolloutPlan.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ requiresManualImplementation: true }) })
    );
    expect(mockPrisma.optimizationChangeRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "ROLLING_OUT" }) })
    );
  });

  it("all rollout stages are explicitly marked as manual", async () => {
    process.env.ENABLE_IMPLEMENTATION_WORKFLOW = "true";
    const cr = changeRequest({ status: "APPROVED_FOR_ROLLOUT" });
    mockPrisma.optimizationChangeRequest.findUnique.mockResolvedValue(cr);
    mockPrisma.stagedRolloutPlan.findUnique.mockResolvedValue(null);
    mockPrisma.stagedRolloutPlan.create.mockImplementation(({ data }: any) => Promise.resolve({ ...data, id: "rp-created" }));
    mockPrisma.optimizationChangeRequest.update.mockResolvedValue({});
    const { prepareStagedRolloutPlan } = await import("@/lib/autonomous/optimization/stagedRolloutService");
    const result = await prepareStagedRolloutPlan({ changeRequestId: "cr-1", actor: platformUser });
    const stages: any[] = result.stages ?? [];
    expect(stages.length).toBeGreaterThan(0);
    expect(stages.every((s: any) => s.requiresManualImplementation === true)).toBe(true);
  });

  it("pause requires ROLLING_OUT status", async () => {
    process.env.ENABLE_IMPLEMENTATION_WORKFLOW = "true";
    mockPrisma.optimizationChangeRequest.findUnique.mockResolvedValue(changeRequest({ status: "DRAFT" }));
    const { pauseRollout } = await import("@/lib/autonomous/optimization/stagedRolloutService");
    await expect(pauseRollout({ changeRequestId: "cr-1", actor: platformUser })).rejects.toMatchObject({ status: 422 });
  });
});

// ---- Rollout verification ----
describe("rollout verification", () => {
  it("requires existing rollout plan before recording verification", async () => {
    process.env.ENABLE_IMPLEMENTATION_WORKFLOW = "true";
    mockPrisma.optimizationChangeRequest.findUnique.mockResolvedValue(changeRequest({ status: "ROLLING_OUT" }));
    mockPrisma.stagedRolloutPlan.findUnique.mockResolvedValue(null);
    const { recordRolloutVerification } = await import("@/lib/autonomous/optimization/rolloutVerificationService");
    await expect(recordRolloutVerification({ changeRequestId: "cr-1", actor: platformUser, stage: "INTERNAL_ONLY", outcome: "PASSED", notes: "All OK" }))
      .rejects.toMatchObject({ status: 422 });
  });

  it("records PASSED verification and sets ROLLOUT_VERIFIED status", async () => {
    process.env.ENABLE_IMPLEMENTATION_WORKFLOW = "true";
    mockPrisma.optimizationChangeRequest.findUnique.mockResolvedValue(changeRequest({ status: "ROLLING_OUT" }));
    mockPrisma.stagedRolloutPlan.findUnique.mockResolvedValue(rolloutPlan());
    const updatedPlan = rolloutPlan({ status: "ROLLOUT_VERIFIED", rolloutVerification: { outcome: "PASSED" } });
    mockPrisma.stagedRolloutPlan.update.mockResolvedValue(updatedPlan);
    mockPrisma.optimizationChangeRequest.update.mockResolvedValue({});
    const { recordRolloutVerification } = await import("@/lib/autonomous/optimization/rolloutVerificationService");
    const result = await recordRolloutVerification({ changeRequestId: "cr-1", actor: platformUser, stage: "INTERNAL_ONLY", outcome: "PASSED", notes: "Verified OK" });
    expect((result.plan as any).status).toBe("ROLLOUT_VERIFIED");
    expect(result.verificationRecord.outcome).toBe("PASSED");
    expect(mockPrisma.optimizationChangeRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "ROLLOUT_VERIFIED" }) })
    );
  });
});

// ---- Rollback verification ----
describe("rollback verification", () => {
  it("requires platform admin for rollback verification", async () => {
    process.env.ENABLE_IMPLEMENTATION_WORKFLOW = "true";
    mockPrisma.optimizationChangeRequest.findUnique.mockResolvedValue(changeRequest({ status: "ROLLING_OUT" }));
    mockPrisma.stagedRolloutPlan.findUnique.mockResolvedValue(rolloutPlan());
    const { recordRollbackVerification } = await import("@/lib/autonomous/optimization/rollbackVerificationService");
    await expect(recordRollbackVerification({ changeRequestId: "cr-1", actor: schoolAdmin, checklistResults: { item1: true }, restoredStateConfirmed: true, notes: "Done" }))
      .rejects.toMatchObject({ status: 403 });
  });

  it("sets ROLLED_BACK when all checklist items pass and state confirmed", async () => {
    process.env.ENABLE_IMPLEMENTATION_WORKFLOW = "true";
    mockPrisma.optimizationChangeRequest.findUnique.mockResolvedValue(changeRequest({ status: "ROLLING_OUT" }));
    mockPrisma.stagedRolloutPlan.findUnique.mockResolvedValue(rolloutPlan());
    mockPrisma.stagedRolloutPlan.update.mockResolvedValue(rolloutPlan({ status: "ROLLBACK_VERIFIED" }));
    mockPrisma.optimizationChangeRequest.update.mockResolvedValue({});
    const { recordRollbackVerification } = await import("@/lib/autonomous/optimization/rollbackVerificationService");
    const result = await recordRollbackVerification({
      changeRequestId: "cr-1",
      actor: platformUser,
      checklistResults: { "Confirm reversed": true, "Verify baseline": true },
      restoredStateConfirmed: true,
      notes: "All clear",
    });
    expect(result.verificationRecord.allChecklistPassed).toBe(true);
    expect(mockPrisma.optimizationChangeRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "ROLLED_BACK" }) })
    );
  });

  it("does NOT set ROLLED_BACK if checklist items fail", async () => {
    process.env.ENABLE_IMPLEMENTATION_WORKFLOW = "true";
    mockPrisma.optimizationChangeRequest.findUnique.mockResolvedValue(changeRequest({ status: "ROLLING_OUT" }));
    mockPrisma.stagedRolloutPlan.findUnique.mockResolvedValue(rolloutPlan());
    mockPrisma.stagedRolloutPlan.update.mockResolvedValue(rolloutPlan({ status: "PAUSED" }));
    const { recordRollbackVerification } = await import("@/lib/autonomous/optimization/rollbackVerificationService");
    await recordRollbackVerification({
      changeRequestId: "cr-1",
      actor: platformUser,
      checklistResults: { "Confirm reversed": false },
      restoredStateConfirmed: false,
      notes: "Not done",
    });
    expect(mockPrisma.optimizationChangeRequest.update).not.toHaveBeenCalled();
  });
});

// ---- Post-change evaluation ----
describe("post-change evaluation", () => {
  it("requires rollout verification before creating eval plan", async () => {
    process.env.ENABLE_IMPLEMENTATION_WORKFLOW = "true";
    mockPrisma.optimizationChangeRequest.findUnique.mockResolvedValue(changeRequest({ status: "ROLLOUT_VERIFIED" }));
    mockPrisma.stagedRolloutPlan.findUnique.mockResolvedValue(rolloutPlan({ rolloutVerification: null }));
    const { createPostChangeEvaluationPlan } = await import("@/lib/autonomous/optimization/postChangeEvaluationService");
    await expect(createPostChangeEvaluationPlan({ changeRequestId: "cr-1", actor: platformUser }))
      .rejects.toMatchObject({ code: "rollout_verification_required" });
    expect(mockPrisma.postChangeEvaluationPlan.create).not.toHaveBeenCalled();
  });

  it("creates eval plan with baseline metrics", async () => {
    process.env.ENABLE_IMPLEMENTATION_WORKFLOW = "true";
    mockPrisma.optimizationChangeRequest.findUnique.mockResolvedValue(changeRequest({ status: "ROLLOUT_VERIFIED" }));
    mockPrisma.stagedRolloutPlan.findUnique.mockResolvedValue(rolloutPlan({ rolloutVerification: { outcome: "PASSED" } }));
    mockPrisma.learningEvent.findMany.mockResolvedValue([]);
    const evalPlan = { id: "ep-1", status: "BASELINE_RECORDED", evaluationWindowDays: 14, feedbackLoopStatus: "pending", baselineMetrics: { capturedAt: new Date().toISOString() } };
    mockPrisma.postChangeEvaluationPlan.create.mockResolvedValue(evalPlan);
    mockPrisma.optimizationChangeRequest.update.mockResolvedValue({});
    const { createPostChangeEvaluationPlan } = await import("@/lib/autonomous/optimization/postChangeEvaluationService");
    const result = await createPostChangeEvaluationPlan({ changeRequestId: "cr-1", actor: platformUser });
    expect(result.status).toBe("BASELINE_RECORDED");
    expect(mockLogLearningEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "autonomous.implementation.post_change_eval.created", metadata: expect.objectContaining({ policyMutation: false }) }),
      { throwOnError: true }
    );
    expect(mockPrisma.optimizationChangeRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "COMPLETED" }) })
    );
  });

  it("is idempotent — reuses existing eval plan", async () => {
    process.env.ENABLE_IMPLEMENTATION_WORKFLOW = "true";
    mockPrisma.optimizationChangeRequest.findUnique.mockResolvedValue(changeRequest({ status: "ROLLOUT_VERIFIED" }));
    mockPrisma.stagedRolloutPlan.findUnique.mockResolvedValue(rolloutPlan({ rolloutVerification: { outcome: "PASSED" } }));
    mockPrisma.postChangeEvaluationPlan.findUnique.mockResolvedValue({ id: "ep-existing", status: "BASELINE_RECORDED" });
    const { createPostChangeEvaluationPlan } = await import("@/lib/autonomous/optimization/postChangeEvaluationService");
    const result = await createPostChangeEvaluationPlan({ changeRequestId: "cr-1", actor: platformUser });
    expect(mockPrisma.postChangeEvaluationPlan.create).not.toHaveBeenCalled();
    expect(result.id).toBe("ep-existing");
  });
});

// ---- No autonomous policy mutation ----
describe("no autonomous policy mutation", () => {
  it("change request implementation plan always requires manual implementation", async () => {
    process.env.ENABLE_IMPLEMENTATION_WORKFLOW = "true";
    process.env.ENABLE_AUTONOMOUS_OPTIMIZATION = "true";
    mockPrisma.learningEvent.findUnique.mockResolvedValue(proposalEvent());
    mockPrisma.learningEvent.findMany.mockResolvedValue([approvedReviewEvent("proposal-1")]);
    let capturedData: any = null;
    mockPrisma.optimizationChangeRequest.create.mockImplementation(({ data }: any) => {
      capturedData = data;
      return Promise.resolve({ ...data, id: "cr-created" });
    });
    const { createChangeRequestFromProposal } = await import("@/lib/autonomous/optimization/optimizationChangeRequestService");
    await createChangeRequestFromProposal({ proposalEventId: "proposal-1", actor: platformUser, correlationId: "c1" });
    expect(capturedData.requiresManualImplementation).toBe(true);
    expect(capturedData.proposedImplementationPlan?.requiresManualImplementation).toBe(true);
    expect(capturedData.status).toBe("DRAFT");
  });

  it("audit logs record policyMutation=false for all implementation actions", async () => {
    process.env.ENABLE_IMPLEMENTATION_WORKFLOW = "true";
    process.env.ENABLE_AUTONOMOUS_OPTIMIZATION = "true";
    mockPrisma.learningEvent.findUnique.mockResolvedValue(proposalEvent());
    mockPrisma.learningEvent.findMany.mockResolvedValue([approvedReviewEvent("proposal-1")]);
    mockPrisma.optimizationChangeRequest.create.mockResolvedValue(changeRequest());
    const { createChangeRequestFromProposal } = await import("@/lib/autonomous/optimization/optimizationChangeRequestService");
    await createChangeRequestFromProposal({ proposalEventId: "proposal-1", actor: platformUser, correlationId: "c1" });
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({ details: expect.objectContaining({ policyMutation: false }) })
    );
  });
});

// ---- Implementation workflow orchestrator ----
describe("implementation workflow orchestrator", () => {
  it("fails closed when both flags are off", async () => {
    const { createImplementationWorkflow } = await import("@/lib/autonomous/optimization/implementationWorkflowService");
    await expect(createImplementationWorkflow({ proposalEventId: "p1", actor: platformUser }))
      .rejects.toMatchObject({ code: "implementation_workflow_disabled" });
  });

  it("creates workflowRun and change request from approved proposal", async () => {
    process.env.ENABLE_IMPLEMENTATION_WORKFLOW = "true";
    process.env.ENABLE_AUTONOMOUS_OPTIMIZATION = "true";
    mockPrisma.learningEvent.findUnique.mockResolvedValue(proposalEvent());
    mockPrisma.learningEvent.findMany.mockResolvedValue([approvedReviewEvent("proposal-1")]);
    mockPrisma.optimizationChangeRequest.create.mockResolvedValue(changeRequest());
    const { createImplementationWorkflow } = await import("@/lib/autonomous/optimization/implementationWorkflowService");
    const result = await createImplementationWorkflow({ proposalEventId: "proposal-1", actor: platformUser });
    expect(result.workflowRun.id).toBe("wf-1");
    expect(result.changeRequest.status).toBe("DRAFT");
    expect(mockPrisma.workflowRun.create).toHaveBeenCalled();
    expect(mockPrisma.workflowCheckpoint.create).toHaveBeenCalled();
  });
});

// ---- MOE aggregate safety ----
describe("MOE aggregate safety", () => {
  it("MOE user can list aggregate change requests without school filter", async () => {
    process.env.ENABLE_IMPLEMENTATION_WORKFLOW = "true";
    process.env.ENABLE_AUTONOMOUS_OPTIMIZATION = "true";
    const aggregateCr = changeRequest({ schoolId: null, affectedScope: "national" });
    mockPrisma.optimizationChangeRequest.findMany.mockResolvedValue([aggregateCr]);
    const { listChangeRequests } = await import("@/lib/autonomous/optimization/optimizationChangeRequestService");
    const results = await listChangeRequests({ actor: moeUser });
    expect(results.every((cr: any) => cr.schoolId === null)).toBe(true);
  });
});
