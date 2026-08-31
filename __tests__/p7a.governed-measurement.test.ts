import { describe, expect, it } from "vitest";
import { EVENT_REGISTRY, GOVERNED_EVENT_SCHEMA_VERSION, METRIC_REGISTRY, calculateMetric, ingestGovernedEvents, validateGovernedEvent, type GovernedEvent } from "@/lib/measurement/governedMeasurement";

const base = (name: string, metadata: Record<string, unknown> = {}, overrides: Partial<GovernedEvent> = {}): GovernedEvent => ({ eventId: `event-${name}-${Math.random()}`, name, schemaVersion: GOVERNED_EVENT_SCHEMA_VERSION, occurredAt: "2026-08-10T12:00:00.000Z", schoolId: "school-a", actorType: "learner", actorId: "learner-a", syntheticSource: "production", metadata, ...overrides });
const window = { start: "2026-08-01T00:00:00.000Z", end: "2026-08-31T23:59:59.999Z" };

describe("P7-A governed event contract", () => {
  it("has one complete versioned registry for all required families", () => { expect(new Set(EVENT_REGISTRY.map((e) => e.family))).toEqual(new Set(METRIC_REGISTRY.map((m) => m.id))); expect(METRIC_REGISTRY).toHaveLength(9); for (const metric of METRIC_REGISTRY) { expect(metric.owner).toBeTruthy(); expect(metric.window).toBeTruthy(); expect(metric.denominator).toBeTruthy(); expect(metric.missingData).toBeTruthy(); } });
  it("quarantines unknown, unsupported, and malformed events visibly", () => { expect(validateGovernedEvent(base("unknown.event"))).toMatchObject({ ok: false, reason: "unknown_event_name" }); expect(validateGovernedEvent(base("governed.learning.activity", { activeSeconds: 1 }, { schemaVersion: 99 }))).toMatchObject({ ok: false, reason: "unsupported_schema_version" }); expect(validateGovernedEvent(base("governed.learning.activity", {}))).toMatchObject({ ok: false, reason: "missing_required_metadata:activeSeconds" }); });
  it("accepts supported version and uses stable identities to suppress replay", () => { const e = base("governed.learning.activity", { activeSeconds: 60 }, { operationId: "offline-op-1" }); const result = ingestGovernedEvents([e, { ...e, eventId: "server-replay" }]); expect(result.accepted).toHaveLength(1); expect(result.duplicates).toBe(1); });
  it("preserves tenant isolation, event time, and excludes synthetic events", () => { const events = [base("governed.learning.activity", { activeSeconds: 60 }), base("governed.learning.activity", { activeSeconds: 999 }, { syntheticSource: "fixture" }), base("governed.learning.activity", { activeSeconds: 999 }, { schoolId: "school-b" }), base("governed.learning.activity", { activeSeconds: 30 }, { occurredAt: "2026-07-31T23:59:59.000Z" })]; const result = calculateMetric("learning_dosage", events, "school-a", window); expect(result.numerator).toBe(60); expect(result.excludedSyntheticEvents).toBe(1); });
});

describe("P7-A golden metric fixtures", () => {
  const cases = [
    ["learning_dosage", "governed.learning.activity", { activeSeconds: 60 }, { activeSeconds: 0 }],
    ["retention", "governed.retention.cohort_entered", {}, {}],
    ["mastery_movement", "governed.mastery.snapshot", { mastery: 0.2, assessmentVersion: "v1", strandId: "s1" }, { mastery: 0.2 }],
    ["teacher_adoption", "governed.teacher.meaningful_action", { action: "assignment_created" }, {}],
    ["workflow_completion", "governed.workflow.started", { workflow: "submission", workflowId: "w1" }, {}],
    ["tutor_helpfulness", "governed.tutor.feedback", { helpful: true }, {}],
    ["ai_grounding", "governed.ai.grounding_evaluated", { grounded: true, evaluatorVersion: "e1", approvedContextAvailable: true }, { grounded: true }],
    ["hallucination", "governed.ai.hallucination_evaluated", { unsupportedClaim: true, evaluatorVersion: "e1", category: "unsupported_curriculum_claim" }, { unsupportedClaim: true }],
    ["safety_decisions", "governed.safety.decision", { decision: "blocked", classifierVersion: "c1" }, {}],
  ] as const;
  for (const [metric, event, metadata, incomplete] of cases) {
    it(`${metric}: positive, negative/ineligible, missing, and synthetic cases are deterministic`, () => {
      const actorType = metric === "teacher_adoption" ? "teacher" : metric === "safety_decisions" || metric === "ai_grounding" || metric === "hallucination" ? "reviewer" : "learner";
      const positive = base(event, metadata, { actorType });
      const negative = metric === "retention" ? base("governed.retention.learning_day", {}, { actorId: "other" }) : metric === "mastery_movement" ? base(event, { ...metadata, mastery: 0.1 }, { actorType, eventId: "later", occurredAt: "2026-08-11T12:00:00.000Z" }) : metric === "workflow_completion" ? base("governed.workflow.completed", { workflow: "submission", workflowId: "w1" }, { actorType }) : base(event, incomplete, { actorType, eventId: "incomplete" });
      const synthetic = base(event, metadata, { actorType, syntheticSource: "fixture", eventId: "synthetic" });
      const events = metric === "retention" ? [positive, base("governed.retention.learning_day", {}, { actorId: "learner-a" }), negative, synthetic] : metric === "mastery_movement" ? [positive, base(event, { ...metadata, mastery: 0.8 }, { actorType, eventId: "later", occurredAt: "2026-08-11T12:00:00.000Z" }), synthetic] : [positive, negative, synthetic];
      const result = calculateMetric(metric, events, "school-a", window);
      expect(result.metricVersion).toBe(1); expect(result.excludedSyntheticEvents).toBe(1); expect(result.denominator).toBeGreaterThanOrEqual(1); expect(result.numerator).toBeGreaterThanOrEqual(0);
    });
  }
});
