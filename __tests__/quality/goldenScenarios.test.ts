import { describe, expect, it, vi, beforeEach } from "vitest";

// This file is the P7-C integration capstone: it composes real functions from
// Task Groups A (fixtures/gate), B (review tasks/calibration), and C
// (release gate/rollback/incidents/experiment quality) end to end. Nothing in
// this repo can reach a real database in this environment, so @/lib/db and
// @/lib/audit are mocked here exactly the way __tests__/quality/reviewTasks.test.ts
// mocks them (Vitest mocks are file-scoped, so this file needs its own copy).
// The business logic under test (evaluateReleaseGate, evaluateExperimentQuality,
// the reviewTasks/calibration domain helpers, incidents, rollback, the stop
// signal) is never stubbed.
vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: vi.fn(),
    qualityReviewTask: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      findFirst: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
    },
    qualityReviewAssessment: { findUnique: vi.fn(), create: vi.fn() },
    reviewerRestriction: { findFirst: vi.fn() },
    qualityReviewCalibrationSession: { findUnique: vi.fn(), create: vi.fn() },
    qualityReviewCalibrationResult: { findUnique: vi.fn(), create: vi.fn() },
  },
}));
vi.mock("@/lib/audit", () => ({
  logAuditRequiredWithId: vi.fn().mockResolvedValue("audit-golden-1"),
  logAuditRequired: vi.fn().mockResolvedValue(undefined),
}));

import { prisma } from "@/lib/db";
import {
  resetFixtureRegistryForTests,
  listFixtures,
  getFixture,
  type QualityFixture,
} from "@/lib/quality/fixtureRegistry";
import { loadRedTeamFixtures } from "@/lib/quality/fixtures/redTeam";
import { loadRegressionFixtures } from "@/lib/quality/fixtures/regression";
import { evaluateFixtureDeterministically } from "@/lib/quality/qualityGate.test-adapter";
import {
  createQualityReviewTask,
  claimQualityReviewTask,
  decideQualityReviewTask,
  recordHelpfulnessDecision,
  recordHallucinationDecision,
  recordGroundingDecision,
  recordModerationFalsePositive,
  recordModerationFalseNegative,
} from "@/lib/quality/reviewTasks";
import { computeDisagreement, createCalibrationSession, recordCalibrationResult } from "@/lib/quality/calibration";
import { evaluateReleaseGate, type ReleaseGateDefinition } from "@/lib/quality/releaseGate";
import { evaluateRollbackCandidate } from "@/lib/quality/rollback";
import { fingerprint, upsertIncident } from "@/lib/quality/incidents";
import { deriveQualityStopSignal } from "@/lib/experiments/qualityStopSignal";
import {
  evaluateExperimentQuality,
  type QualityReport,
  type QualityPolicy,
  type QualitySnapshot,
  type ClusterOutcome,
} from "@/lib/experiments/qualityOperations";
import { createExposureEvent, type Assignment, type ExperimentDefinition } from "@/lib/experiments/controlledExperiment";

// ---------------------------------------------------------------------------
// Shared fixtures for the evaluateExperimentQuality-backed scenarios
// (1, 9, 11). Modeled on the shapes already proven in
// __tests__/p7c.quality-operations.test.ts (the real P7-C evaluator suite),
// rewritten locally since test files cannot import each other's fixtures.
// ---------------------------------------------------------------------------
const experimentDefinition: ExperimentDefinition = {
  experimentId: "golden-layout",
  version: 1,
  metricVersion: 2,
  name: "Golden Layout",
  description: "golden scenario fixture",
  owner: "quality",
  status: "RUNNING",
  unitOfAssignment: "SCHOOL",
  eligiblePopulation: {},
  arms: [
    { id: "control", kind: "CONTROL", allocationBps: 5000 },
    { id: "treatment", kind: "TREATMENT", allocationBps: 5000 },
  ],
  controlArm: "control",
  startAt: "2026-01-01T00:00:00.000Z",
  endAt: "2027-01-01T00:00:00.000Z",
  conflictDomains: [],
  primaryMetrics: ["learning_dosage"],
  secondaryMetrics: [],
  guardrails: [{ metricId: "safety_decisions", direction: "MIN", threshold: 0.9 }],
  earlyStopPolicy: { minimumSample: 2, srmThreshold: 10.827, guardrails: [] },
  createdAt: "2026-01-01T00:00:00.000Z",
};

function makeAssignment(id: string, armId: string): Assignment {
  return {
    experimentId: experimentDefinition.experimentId,
    experimentVersion: 1,
    definitionHash: "fixed",
    algorithmVersion: "fnv1a-v1",
    schoolId: id,
    assignmentUnit: "SCHOOL",
    assignmentId: id,
    armId,
    armKind: armId === "control" ? "CONTROL" : "TREATMENT",
    assignedAt: "2026-06-01T00:00:00.000Z",
    eligibilityReason: "eligible",
  };
}

const goldenAssignments = [
  makeAssignment("school-c1", "control"),
  makeAssignment("school-c2", "control"),
  makeAssignment("school-t1", "treatment"),
  makeAssignment("school-t2", "treatment"),
];

function exposureFor(row: Assignment) {
  return createExposureEvent({
    assignment: row,
    schoolId: row.schoolId,
    actorType: "learner",
    occurredAt: "2026-06-02T00:00:00.000Z",
    featureKey: "layout",
    contentVersion: "v1",
  });
}

function outcomeFor(row: Assignment, value: number | null, extra: Partial<ClusterOutcome> = {}): ClusterOutcome {
  return {
    assignmentId: row.assignmentId,
    schoolId: row.schoolId,
    armId: row.armId,
    metricId: "learning_dosage",
    metricVersion: 2,
    definitionVersion: 1,
    occurredAt: "2026-06-02T00:00:00.000Z",
    value,
    source: "production",
    ...extra,
  };
}

const qualityPolicy: QualityPolicy = {
  evaluatedAt: "2026-06-03T00:00:00.000Z",
  minimumClustersPerArm: 2,
  maximumMissingRate: 0.1,
  maximumLatencyMs: 10 * 24 * 60 * 60 * 1000,
  maximumFutureSkewMs: 1000,
  maximumLateMs: 10 * 24 * 60 * 60 * 1000,
  requireReviewDimensions: ["safety", "helpfulness"],
  sequentialCheckpoints: ["2026-06-03T00:00:00.000Z"],
  comparisonCount: 1,
  minimumDetectableEffect: 0.05,
};

const goldenReviews = [
  {
    reviewId: "r1",
    reviewerId: "quality-reviewer",
    authorized: true,
    sampledAt: qualityPolicy.evaluatedAt,
    dimension: "safety" as const,
    outcome: "PASS" as const,
    evidenceId: "sample-safety",
  },
  {
    reviewId: "r2",
    reviewerId: "quality-reviewer",
    authorized: true,
    sampledAt: qualityPolicy.evaluatedAt,
    dimension: "helpfulness" as const,
    outcome: "PASS" as const,
    evidenceId: "sample-help",
  },
];

function buildSnapshot(overrides: Partial<QualitySnapshot> = {}): QualitySnapshot {
  return {
    snapshotId: "golden-snapshot-1",
    tenantId: "tenant-golden",
    definition: experimentDefinition,
    assignments: goldenAssignments,
    exposures: goldenAssignments.map(exposureFor),
    metricEvents: [],
    outcomes: [
      outcomeFor(goldenAssignments[0], 0.2),
      outcomeFor(goldenAssignments[1], 0.3),
      outcomeFor(goldenAssignments[2], 0.7),
      outcomeFor(goldenAssignments[3], 0.8),
    ],
    reviews: goldenReviews,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Shared fixtures for the release-gate-focused scenarios (2-8, 12). A single
// READY QualityReport literal is reused where the scenario is really about
// review/fixture semantics rather than the experiment-evidence evaluator's
// own internals (explicitly permitted by the task brief).
// ---------------------------------------------------------------------------
const readyQualityReport: QualityReport = {
  state: "READY",
  evidenceHash: "golden-ready",
  reasons: [],
  reconciliation: { assigned: 4, exposed: 4, assignmentWithoutExposure: 0, exposureWithoutAssignment: 0, duplicates: 0, malformed: 0, crossSchool: 0 },
  freshness: { late: 0, futureDated: 0, outOfWindow: 0, missingOutcomes: 0, missingRate: 0, maximumLatencyMs: 0 },
  srm: { status: "NORMAL", total: 4, chiSquare: 0, threshold: 3.84, observed: {} },
  comparisons: [{ armId: "treatment", clusters: 2, difference: 0.1, confidenceInterval95: [0.01, 0.19], conclusion: "POSITIVE" }],
  reviews: { required: [], missing: [], unauthorized: 0, failures: 0 },
  audit: [],
};

const baseGateDefinition: ReleaseGateDefinition = {
  gateId: "tutor-release",
  version: 1,
  scope: "tutor-runtime",
  requiredMetricIds: ["learning_dosage"],
  requiredReviewDomains: [],
  minimumSamples: 2,
  blockingSeverities: ["CRITICAL"],
  owner: "quality-team",
};

// Test-only glue (explicitly sanctioned by the task brief): evaluateReleaseGate
// takes a plain `Array<{ domain; outcome }>` for reviews, not a Prisma
// QualityReviewAssessment, so this adapts one to the other. It also uses the
// real (but otherwise unconsumed-by-evaluateReleaseGate) `blockingSeverities`
// field on ReleaseGateDefinition as the policy a caller is expected to apply
// before calling evaluateReleaseGate: a review assessment whose severity
// crosses the gate's configured blocking threshold is folded into the
// `fixtureFailures` hard-block list, exactly the way a caller wiring this
// gate up in production would have to.
function toGateReview(domain: string, assessment: { outcome: string }): { domain: string; outcome: string } {
  return { domain, outcome: assessment.outcome === "PASS" ? "PASS" : "FAIL" };
}

// NOTE: `evaluateReleaseGate` has no severity awareness at all (confirmed:
// `blockingSeverities` is read nowhere in lib/quality/releaseGate.ts, only
// declared on the type). When this helper folds a severity decision into
// `fixtureFailures`, `evaluateReleaseGate` will label it in `gate.reasons` as
// `regression_fixture_failed:<id>`, identically to a real fixture failure,
// because from evaluateReleaseGate's point of view there is no difference:
// it is the same hard-block branch (`fixtureFailures.length > 0`) either way.
// The `caller_policy_block:` prefix below exists so a synthesized id can
// never be misread as a real `regr-*`/fixture-registry id if it shows up in
// a failure message or `gate.reasons` output.
function blockingIdsFor(definition: ReleaseGateDefinition, assessment: { id: string; severity: string }): string[] {
  return definition.blockingSeverities.includes(assessment.severity) ? [`caller_policy_block:${assessment.id}`] : [];
}

function setupClaimedTask(taskId: string, domain: string) {
  (prisma.$transaction as any).mockImplementation(async (fn: any) => fn(prisma));
  (prisma.qualityReviewTask.findUnique as any).mockResolvedValue({
    id: taskId,
    domain,
    schoolId: null,
    status: "CLAIMED",
    claimedByProfileId: "reviewer-golden-1",
    version: 1,
  });
  (prisma.qualityReviewAssessment.findUnique as any).mockResolvedValue(null);
  (prisma.qualityReviewTask.updateMany as any).mockResolvedValue({ count: 1 });
  (prisma.qualityReviewAssessment.create as any).mockImplementation(async ({ data }: any) => ({
    id: `assessment-${taskId}`,
    ...data,
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  resetFixtureRegistryForTests();
});

describe("P7-C golden quality-operations scenarios", () => {
  it("scenario 1: a clean release (passing fixtures, healthy experiment evidence, a helpful review) composes end to end to PASS", async () => {
    loadRegressionFixtures();
    loadRedTeamFixtures();
    // Guard against a silent loader no-op: `toEqual([])` below would pass
    // trivially if the registry ended up empty, so first confirm both
    // domains actually registered a non-empty fixture set.
    expect(listFixtures().length).toBeGreaterThan(0);
    expect(listFixtures({ domain: "regression" }).length).toBeGreaterThan(0);
    expect(listFixtures({ domain: "red_team" }).length).toBeGreaterThan(0);
    const fixtureResults = await Promise.all(listFixtures().map(evaluateFixtureDeterministically));
    const fixtureFailures = fixtureResults.filter((result) => !result.passed).map((result) => result.fixtureId);
    expect(fixtureFailures).toEqual([]);

    const quality = evaluateExperimentQuality(buildSnapshot(), qualityPolicy);
    expect(quality.state).toBe("READY");

    let taskState: any = null;
    (prisma.$transaction as any).mockImplementation(async (fn: any) => fn(prisma));
    (prisma.qualityReviewTask.findUnique as any).mockImplementation(async ({ where }: any) => {
      if ("idempotencyKey" in where) return taskState?.idempotencyKey === where.idempotencyKey ? taskState : null;
      if ("id" in where) return taskState?.id === where.id ? taskState : null;
      return null;
    });
    (prisma.qualityReviewTask.findUniqueOrThrow as any).mockImplementation(async () => taskState);
    (prisma.qualityReviewTask.create as any).mockImplementation(async ({ data }: any) => {
      taskState = { id: "task-golden-1", status: "QUEUED", version: 1, claimedByProfileId: null, ...data };
      return taskState;
    });
    (prisma.reviewerRestriction.findFirst as any).mockResolvedValue(null);
    (prisma.qualityReviewTask.updateMany as any).mockImplementation(async ({ data }: any) => {
      taskState = { ...taskState, ...data, version: taskState.version + 1 };
      return { count: 1 };
    });
    (prisma.qualityReviewAssessment.findUnique as any).mockResolvedValue(null);
    (prisma.qualityReviewAssessment.create as any).mockImplementation(async ({ data }: any) => ({
      id: "assessment-golden-1",
      ...data,
    }));

    const operator = { id: "op-golden-1", role: "ADMIN" };
    const task = await createQualityReviewTask({
      operator,
      domain: "TUTOR_HELPFULNESS",
      artifactRef: "tutor-session-golden-1",
      requiredAuthority: "PLATFORM",
      dueAt: new Date("2026-09-05T00:00:00.000Z"),
      idempotencyKey: "golden-create-1",
    });
    expect(task.status).toBe("QUEUED");

    const claimed = await claimQualityReviewTask({
      operator,
      taskId: task.id,
      reviewerProfileId: "reviewer-golden-1",
      idempotencyKey: "golden-claim-1",
    });
    expect(claimed.status).toBe("CLAIMED");

    const assessment = await recordHelpfulnessDecision({
      operator,
      taskId: claimed.id,
      outcome: "helpful",
      idempotencyKey: "golden-decide-1",
    });
    expect(assessment.outcome).toBe("PASS");

    const gate = evaluateReleaseGate(
      { ...baseGateDefinition, requiredReviewDomains: ["TUTOR_HELPFULNESS"] },
      quality,
      fixtureFailures,
      [{ domain: "TUTOR_HELPFULNESS", outcome: assessment.outcome }],
      "2026-09-05T00:00:00.000Z",
    );
    expect(gate.result).toBe("PASS");
    expect(gate.rollbackRecommended).toBe(false);
  });

  // This BLOCK is driven by test-authored caller policy (blockingIdsFor
  // folding the assessment's severity into fixtureFailures), not by any
  // severity logic inside evaluateReleaseGate itself, which has none.
  it("scenario 2: a hallucination regression assessment feeds evaluateReleaseGate to a BLOCK", async () => {
    setupClaimedTask("task-hallucination-1", "HALLUCINATION");
    const assessment = await recordHallucinationDecision({
      operator: { id: "op-golden-2", role: "ADMIN" },
      taskId: "task-hallucination-1",
      outcome: "confident_unsupported",
      idempotencyKey: "golden-hallucination-1",
    });
    expect(assessment.outcome).toBe("FAIL");
    expect(assessment.severity).toBe("CRITICAL");

    const fixtureFailures = blockingIdsFor(baseGateDefinition, assessment);
    expect(fixtureFailures.length).toBeGreaterThan(0);

    const gate = evaluateReleaseGate(
      baseGateDefinition,
      readyQualityReport,
      fixtureFailures,
      [toGateReview("HALLUCINATION", assessment)],
      "2026-09-01T00:00:00.000Z",
    );
    expect(gate.result).toBe("BLOCK");
    // Make the caller-synthesized nature of this block explicit: evaluateReleaseGate
    // has no concept of "review severity", so it reports this exactly like a real
    // regression-fixture failure. Assert on the actual reason string so this
    // mislabeling is visible in the suite rather than silently indistinguishable
    // from scenarios 7/8's genuine fixture failures.
    expect(gate.reasons).toContain(`regression_fixture_failed:${fixtureFailures[0]}`);
    expect(fixtureFailures[0]).toMatch(/^caller_policy_block:/);
  });

  // This BLOCK is driven by test-authored caller policy (blockingIdsFor
  // folding the assessment's real severity into fixtureFailures), not by any
  // severity logic inside evaluateReleaseGate itself, which has none.
  it("scenario 3: a grounding regression (misrepresented source) blocks release under a grounding-safety gate", async () => {
    setupClaimedTask("task-grounding-1", "GROUNDING");
    const assessment = await recordGroundingDecision({
      operator: { id: "op-golden-3", role: "ADMIN" },
      taskId: "task-grounding-1",
      outcome: "misrepresented_source",
      idempotencyKey: "golden-grounding-1",
    });
    expect(assessment.outcome).toBe("FAIL");
    expect(assessment.severity).toBe("HIGH");

    const groundingGate: ReleaseGateDefinition = {
      ...baseGateDefinition,
      requiredReviewDomains: ["GROUNDING"],
      blockingSeverities: ["HIGH", "CRITICAL"],
    };
    const fixtureFailures = blockingIdsFor(groundingGate, assessment);
    expect(fixtureFailures.length).toBeGreaterThan(0);

    const gate = evaluateReleaseGate(
      groundingGate,
      readyQualityReport,
      fixtureFailures,
      [toGateReview("GROUNDING", assessment)],
      "2026-09-01T00:00:00.000Z",
    );
    expect(gate.result).toBe("BLOCK");
  });

  // This BLOCK is driven by test-authored caller policy (blockingIdsFor
  // folding the assessment's severity into fixtureFailures), not by any
  // severity logic inside evaluateReleaseGate itself, which has none.
  it("scenario 4: a moderation false positive warns when non-critical but blocks when the assessed severity is CRITICAL", async () => {
    setupClaimedTask("task-fp-1", "MODERATION_FALSE_POSITIVE");
    const nonCritical = await recordModerationFalsePositive({
      operator: { id: "op-golden-4a", role: "ADMIN" },
      taskId: "task-fp-1",
      outcome: "confirmed_false_positive",
      idempotencyKey: "golden-fp-1",
    });
    expect(nonCritical.severity).toBe("HIGH");
    const warnGate = evaluateReleaseGate(
      { ...baseGateDefinition, requiredReviewDomains: ["MODERATION_FALSE_POSITIVE"] },
      readyQualityReport,
      blockingIdsFor(baseGateDefinition, nonCritical),
      [toGateReview("MODERATION_FALSE_POSITIVE", nonCritical)],
      "2026-09-01T00:00:00.000Z",
    );
    expect(warnGate.result).toBe("WARN");

    setupClaimedTask("task-fp-2", "MODERATION_FALSE_POSITIVE");
    // The real recordModerationFalsePositive domain helper hardcodes severity
    // "HIGH" for a confirmed false positive and can never itself produce
    // "CRITICAL" (see reviewTasks.ts). This calls the general decideQualityReviewTask
    // primitive directly with a hand-constructed severity:"CRITICAL" purely to
    // demonstrate where blockingIdsFor's BLOCK threshold sits, not to claim the
    // false-positive domain helper ever emits CRITICAL in production.
    const critical = await decideQualityReviewTask({
      operator: { id: "op-golden-4b", role: "ADMIN" },
      taskId: "task-fp-2",
      outcome: "FALSE_POSITIVE",
      severity: "CRITICAL",
      idempotencyKey: "golden-fp-2",
    });
    const blockGate = evaluateReleaseGate(
      { ...baseGateDefinition, requiredReviewDomains: ["MODERATION_FALSE_POSITIVE"] },
      readyQualityReport,
      blockingIdsFor(baseGateDefinition, critical),
      [toGateReview("MODERATION_FALSE_POSITIVE", critical)],
      "2026-09-01T00:00:00.000Z",
    );
    expect(blockGate.result).toBe("BLOCK");
  });

  // This BLOCK is driven by test-authored caller policy (blockingIdsFor
  // folding the assessment's severity into fixtureFailures), not by any
  // severity logic inside evaluateReleaseGate itself, which has none.
  it("scenario 5: a confirmed moderation false negative blocks release and opens a quality incident", async () => {
    setupClaimedTask("task-fn-1", "MODERATION_FALSE_NEGATIVE");
    const assessment = await recordModerationFalseNegative({
      operator: { id: "op-golden-5", role: "ADMIN" },
      taskId: "task-fn-1",
      outcome: "confirmed_false_negative",
      idempotencyKey: "golden-fn-1",
    });
    expect(assessment.outcome).toBe("FALSE_NEGATIVE");
    expect(assessment.severity).toBe("CRITICAL");

    const fixtureFailures = blockingIdsFor(baseGateDefinition, assessment);
    const gate = evaluateReleaseGate(
      { ...baseGateDefinition, requiredReviewDomains: ["MODERATION_FALSE_NEGATIVE"] },
      readyQualityReport,
      fixtureFailures,
      [toGateReview("MODERATION_FALSE_NEGATIVE", assessment)],
      "2026-09-01T00:00:00.000Z",
    );
    expect(gate.result).toBe("BLOCK");

    const rollback = evaluateRollbackCandidate(gate, "2026-09-01T00:00:00.000Z");
    expect(rollback).not.toBeNull();

    const candidate = {
      domain: "MODERATION_FALSE_NEGATIVE",
      severity: "CRITICAL",
      detectedBy: "release-gate",
      reference: { fixtureId: assessment.taskId },
      affectedVersion: gate.version,
      owner: baseGateDefinition.owner,
    };
    const { incidents, created } = upsertIncident([], candidate, "2026-09-01T00:00:00.000Z");
    expect(created).toBe(true);
    expect(incidents).toHaveLength(1);
    expect(incidents[0].status).toBe("OPEN");
  });

  // This BLOCK is driven by test-authored caller policy (blockingIdsFor
  // folding the assessment's real severity into fixtureFailures), not by any
  // severity logic inside evaluateReleaseGate itself, which has none.
  it("scenario 6: tutor helpfulness decline warns for a moderate finding and blocks for a critical (unsafe) one", async () => {
    setupClaimedTask("task-help-1", "TUTOR_HELPFULNESS");
    const notHelpful = await recordHelpfulnessDecision({
      operator: { id: "op-golden-6a", role: "ADMIN" },
      taskId: "task-help-1",
      outcome: "not_helpful",
      idempotencyKey: "golden-help-1",
    });
    expect(notHelpful.severity).toBe("MEDIUM");
    const warnGate = evaluateReleaseGate(
      { ...baseGateDefinition, requiredReviewDomains: ["TUTOR_HELPFULNESS"] },
      readyQualityReport,
      blockingIdsFor(baseGateDefinition, notHelpful),
      [toGateReview("TUTOR_HELPFULNESS", notHelpful)],
      "2026-09-01T00:00:00.000Z",
    );
    expect(warnGate.result).toBe("WARN");

    setupClaimedTask("task-help-2", "TUTOR_HELPFULNESS");
    const unsafe = await recordHelpfulnessDecision({
      operator: { id: "op-golden-6b", role: "ADMIN" },
      taskId: "task-help-2",
      outcome: "unsafe",
      idempotencyKey: "golden-help-2",
    });
    expect(unsafe.severity).toBe("CRITICAL");
    const blockGate = evaluateReleaseGate(
      { ...baseGateDefinition, requiredReviewDomains: ["TUTOR_HELPFULNESS"] },
      readyQualityReport,
      blockingIdsFor(baseGateDefinition, unsafe),
      [toGateReview("TUTOR_HELPFULNESS", unsafe)],
      "2026-09-01T00:00:00.000Z",
    );
    expect(blockGate.result).toBe("BLOCK");
  });

  it("scenario 7: an answer-key-leakage regression fixture failing blocks release and recommends rollback", async () => {
    loadRegressionFixtures();
    const original = getFixture("regr-client-supplied-answer-key");
    expect(original).toBeDefined();
    // Simulate this exact known defect having regressed: the deterministic
    // proxy no longer recognizes the historical trigger phrasing recorded in
    // the fixture's own input (evaluateFixtureDeterministically is documented
    // as a narrow pattern proxy, not the real moderation classifier, so
    // "the fixture is failing" is expressed here as the proxy no longer
    // detecting the known-bad wording).
    const regressed: QualityFixture = {
      ...original!,
      input: { ...original!.input, prompt: original!.input.prompt.replace(/client-supplied/gi, "provided") },
    };
    const result = await evaluateFixtureDeterministically(regressed);
    expect(result.passed).toBe(false);

    const gate = evaluateReleaseGate(baseGateDefinition, readyQualityReport, [result.fixtureId], [], "2026-09-01T00:00:00.000Z");
    expect(gate.result).toBe("BLOCK");
    expect(gate.rollbackRecommended).toBe(true);
  });

  it("scenario 8: a cross-tenant-leakage regression fixture failing blocks release", async () => {
    loadRegressionFixtures();
    const original = getFixture("regr-cross-school-grading-idor");
    expect(original).toBeDefined();
    const regressed: QualityFixture = {
      ...original!,
      input: {
        ...original!.input,
        prompt: original!.input.prompt.replace(/school-a/gi, "schoolA").replace(/school-b/gi, "schoolB"),
      },
    };
    const result = await evaluateFixtureDeterministically(regressed);
    expect(result.passed).toBe(false);

    const gate = evaluateReleaseGate(baseGateDefinition, readyQualityReport, [result.fixtureId], [], "2026-09-01T00:00:00.000Z");
    expect(gate.result).toBe("BLOCK");
  });

  it("scenario 9: an experiment with a real but statistically insufficient effect never reports PASS", () => {
    const quality = evaluateExperimentQuality(
      buildSnapshot({
        outcomes: [
          outcomeFor(goldenAssignments[0], 0.5),
          outcomeFor(goldenAssignments[1], 0.5),
          outcomeFor(goldenAssignments[2], 0.51),
          outcomeFor(goldenAssignments[3], 0.49),
        ],
      }),
      qualityPolicy,
    );
    expect(quality.state).toBe("INSUFFICIENT");

    const gate = evaluateReleaseGate(baseGateDefinition, quality, [], [], "2026-06-03T00:00:00.000Z");
    // If evaluateReleaseGate ever let insufficient statistical evidence read
    // as good enough to ship, this would incorrectly come back PASS.
    expect(gate.result).toBe("INSUFFICIENT_EVIDENCE");
    expect(gate.result).not.toBe("PASS");
  });

  it("scenario 10: reviewer disagreement in a calibration round is surfaced, not silently treated as agreement", async () => {
    let sessionState: any = null;
    (prisma.$transaction as any).mockImplementation(async (fn: any) => fn(prisma));
    (prisma.qualityReviewCalibrationSession.findUnique as any).mockImplementation(async ({ where }: any) => {
      if ("idempotencyKey" in where) return sessionState?.idempotencyKey === where.idempotencyKey ? sessionState : null;
      if ("id" in where) return sessionState?.id === where.id ? sessionState : null;
      return null;
    });
    (prisma.qualityReviewCalibrationSession.create as any).mockImplementation(async ({ data }: any) => {
      // Honest with the real schema default: createCalibrationSession's data
      // object never sets status, so Prisma applies the QualityReviewCalibrationSession
      // default of DRAFT, not OPEN. See docs/P7C_QUALITY_OPERATIONS.md's calibration
      // lifecycle note: no code path in this repository currently transitions a
      // session from DRAFT to OPEN (the same gap already documented for the
      // curriculum-review calibration module this one mirrors).
      sessionState = { id: "session-golden-1", ...data, status: "DRAFT" };
      return sessionState;
    });
    (prisma.qualityReviewCalibrationResult.findUnique as any).mockResolvedValue(null);
    (prisma.qualityReviewCalibrationResult.create as any).mockImplementation(async ({ data }: any) => ({
      id: `result-${data.reviewerProfileId}`,
      ...data,
    }));

    const session = await createCalibrationSession({
      name: "golden calibration",
      domain: "TUTOR_HELPFULNESS",
      referenceTaskId: "task-reference-1",
      referenceSnapshot: { outcome: "PASS" },
      createdByUserId: "user-golden-1",
      idempotencyKey: "golden-calibration-session-1",
    });
    expect(session.status).toBe("DRAFT");

    // recordCalibrationResult requires an OPEN session. Since no production code
    // path performs that DRAFT -> OPEN transition, simulate it directly on the
    // mocked session state here (an out-of-band admin action, not something
    // createCalibrationSession itself does) so the rest of this scenario can
    // exercise recordCalibrationResult/computeDisagreement in isolation.
    sessionState.status = "OPEN";

    const agreeing = await recordCalibrationResult({
      sessionId: session.id,
      reviewerProfileId: "reviewer-a",
      outcome: "PASS",
      idempotencyKey: "golden-calibration-result-a",
    });
    const disagreeing = await recordCalibrationResult({
      sessionId: session.id,
      reviewerProfileId: "reviewer-b",
      outcome: "FAIL",
      idempotencyKey: "golden-calibration-result-b",
    });

    expect((agreeing.comparisonResult as any).outcomeMatchesReference).toBe(true);
    // The core property: a genuine mismatch must be surfaced as false, never
    // silently coerced to match the reference just because the session is
    // diagnostic-only.
    expect((disagreeing.comparisonResult as any).outcomeMatchesReference).toBe(false);

    const disagreement = computeDisagreement([
      { reviewerProfileId: agreeing.reviewerProfileId, outcome: (agreeing.assessmentSnapshot as any).outcome },
      { reviewerProfileId: disagreeing.reviewerProfileId, outcome: (disagreeing.assessmentSnapshot as any).outcome },
    ]);
    expect(disagreement.agreementRate).toBe(0);
    expect(disagreement.disagreements).toEqual([{ a: "reviewer-a", b: "reviewer-b" }]);
  });

  it("scenario 11: an experiment guardrail breach makes deriveQualityStopSignal require a stop", () => {
    const clean = buildSnapshot();
    const quality = evaluateExperimentQuality(
      buildSnapshot({
        outcomes: [...clean.outcomes, outcomeFor(goldenAssignments[0], 0.2, { metricId: "safety_decisions", value: 0.2 })],
      }),
      qualityPolicy,
    );
    expect(quality.state).toBe("STOPPED");
    expect(quality.reasons).toContain("guardrail_breach");
    expect(quality.srm.status).not.toBe("SRM_DETECTED");

    const signal = deriveQualityStopSignal(quality);
    expect(signal).toEqual({ shouldStop: true, reason: "quality_stopped" });
  });

  it("scenario 12: re-detecting the same regression a second time does not duplicate the incident", () => {
    const gate = evaluateReleaseGate(
      baseGateDefinition,
      readyQualityReport,
      ["regr-client-supplied-answer-key"],
      [],
      "2026-09-01T00:00:00.000Z",
    );
    expect(gate.result).toBe("BLOCK");
    const rollback = evaluateRollbackCandidate(gate, "2026-09-01T00:00:00.000Z");
    expect(rollback).not.toBeNull();

    const candidate = {
      domain: "regression_fixture",
      severity: "CRITICAL",
      detectedBy: "release-gate",
      reference: { fixtureId: "regr-client-supplied-answer-key" },
      affectedVersion: gate.version,
      owner: baseGateDefinition.owner,
    };
    const first = upsertIncident([], candidate, "2026-09-01T00:00:00.000Z");
    expect(first.created).toBe(true);
    expect(first.incidents).toHaveLength(1);
    expect(first.incidents[0].fingerprint).toBe(
      fingerprint({ domain: candidate.domain, reference: candidate.reference, affectedVersion: candidate.affectedVersion }),
    );

    const second = upsertIncident(first.incidents, candidate, "2026-09-02T00:00:00.000Z");
    expect(second.created).toBe(false);
    expect(second.incidents).toHaveLength(1);
    expect(second.incidents[0].incidentId).toBe(first.incidents[0].incidentId);
  });
});
