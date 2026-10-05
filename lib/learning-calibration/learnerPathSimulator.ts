import {
  deterministicReleaseIdentity, GRADE4_MATH_ONTOLOGY_RELEASE, type CurriculumOntologyRelease,
} from "@/lib/learning-authority/governedGrade4Math";
import {
  generateLearningCandidates, learnerStateRevision, resolveLearningDecision,
  type LearningDecision, type LearningPolicyResolution, type LearningRecommendation, type TeacherOverride,
} from "@/lib/learning-authority/learningOrchestrator";
import {
  createGovernedEvidence, toCanonicalMasteryEvidence, type GovernedEvidence, type GovernedEvidenceType,
} from "@/lib/learning-evidence/evidenceContract";
import {
  createGovernedMisconceptionReview, replayStudentConceptState,
  type CanonicalLearningStateEvent, type StudentConceptState,
} from "@/lib/learning-state/studentLearningModel";
import { calibrateLearner, type LearnerCalibration } from "@/lib/learning-calibration/calibrationState";
import type { CompetencyEstimate } from "@/lib/learning-calibration/competencyEstimate";
import { deriveParticipationSignals, type ParticipationObservation, type ParticipationSnapshot } from "@/lib/learning-calibration/participationSignals";
import { generateInterventionCandidates, type InterventionCandidate } from "@/lib/learning-calibration/teacherInterventions";
import { placementToGovernedEvidence, type PlacementConceptBinding } from "@/lib/learning-calibration/placementReadiness";

/**
 * Deterministic learner-path simulator. SYNTHETIC DATA ONLY.
 *
 * Runs the real governed chain, unchanged, over a scripted learner:
 *   governed evidence -> Student Learning Model replay -> calibration/confidence
 *   -> mastery/retention/misconception projection -> DecisionModel ranking
 *   -> Learning Orchestrator decision -> teacher intervention candidates.
 * It never touches a database and never writes canonical state anywhere.
 */
export const LEARNER_PATH_SIMULATOR_VERSION = "learner-path-simulator/1.0.0" as const;
export const SYNTHETIC_LABEL = "SYNTHETIC — NOT A REAL LEARNER" as const;

export type SimulatedEvidenceKind =
  | "RELEASED_ITEM" | "HOMEWORK" | "CLASSWORK" | "QUIZ" | "TUTOR_PRACTICE" | "LAB" | "TEACHER_EVIDENCE" | "PRIOR_HISTORY";

export type SimulatedStep =
  | Readonly<{ day: number; kind: SimulatedEvidenceKind; conceptId: string; correct: boolean;
      /** RELEASED_ITEM only: answer index, used to exercise governed misconception signals. */
      selectedAnswerIndex?: number; retentionProbe?: boolean; occasion?: string; retries?: number; hints?: number }>
  | Readonly<{ day: number; kind: "PLACEMENT"; responses: readonly Readonly<{ itemKey: string; correct: boolean; difficulty: number }>[] }>
  | Readonly<{ day: number; kind: "MISCONCEPTION_REVIEW"; conceptId: string; signalId: string; decision: "CONFIRMED" | "REJECTED" }>;

export type SimulationScenario = Readonly<{
  name: string;
  label: typeof SYNTHETIC_LABEL;
  enrollmentGrade: number;
  startAt: string;
  steps: readonly SimulatedStep[];
  /** Days (from start) at which to snapshot the full loop. Defaults to each step day. */
  checkpoints?: readonly number[];
  participation?: readonly ParticipationObservation[];
  placementBindings?: readonly PlacementConceptBinding[];
  teacherOverride?: Readonly<{ atDay: number; override: TeacherOverride }>;
}>;

export type SimulationSnapshot = Readonly<{
  day: number;
  asOf: string;
  states: readonly StudentConceptState[];
  calibration: LearnerCalibration;
  estimates: readonly CompetencyEstimate[];
  recommendation: LearningRecommendation;
  resolution: LearningPolicyResolution;
  decision: LearningDecision;
  participation: ParticipationSnapshot;
  interventions: readonly InterventionCandidate[];
}>;

export type SimulationResult = Readonly<{
  simulatorVersion: typeof LEARNER_PATH_SIMULATOR_VERSION;
  label: typeof SYNTHETIC_LABEL;
  scenario: string;
  snapshots: readonly SimulationSnapshot[];
}>;

const DAY_MS = 86_400_000;
const LEARNER = Object.freeze({ tenantId: "synthetic-tenant", schoolId: "synthetic-school", studentId: "synthetic-student", studentUserId: "synthetic-user" });

const CORROBORATING_SHAPE: Readonly<Record<Exclude<SimulatedEvidenceKind, "RELEASED_ITEM">, {
  type: GovernedEvidenceType; source: "ONLINE" | "TEACHER" | "SYSTEM"; runtime: "WEB" | "LAB" | "IMPORT";
  humanVerified: boolean; serverScored: boolean; assistanceUsed: boolean;
  directness: "DIRECT" | "INDIRECT"; reliability: "UNASSESSED" | "REVIEWED" | "VERIFIED";
}>> = Object.freeze({
  HOMEWORK: { type: "HOMEWORK", source: "ONLINE", runtime: "WEB", humanVerified: false, serverScored: false, assistanceUsed: false, directness: "DIRECT", reliability: "UNASSESSED" },
  CLASSWORK: { type: "CLASSWORK", source: "ONLINE", runtime: "WEB", humanVerified: false, serverScored: true, assistanceUsed: false, directness: "DIRECT", reliability: "UNASSESSED" },
  QUIZ: { type: "QUIZ", source: "ONLINE", runtime: "WEB", humanVerified: false, serverScored: true, assistanceUsed: false, directness: "DIRECT", reliability: "UNASSESSED" },
  // AI tutor practice is always assisted; it can never stand in for independent mastery evidence.
  TUTOR_PRACTICE: { type: "PRACTICE", source: "SYSTEM", runtime: "WEB", humanVerified: false, serverScored: false, assistanceUsed: true, directness: "DIRECT", reliability: "UNASSESSED" },
  LAB: { type: "LAB", source: "ONLINE", runtime: "LAB", humanVerified: false, serverScored: true, assistanceUsed: false, directness: "INDIRECT", reliability: "UNASSESSED" },
  TEACHER_EVIDENCE: { type: "CLASSWORK", source: "TEACHER", runtime: "WEB", humanVerified: true, serverScored: false, assistanceUsed: false, directness: "DIRECT", reliability: "VERIFIED" },
  PRIOR_HISTORY: { type: "EXAM_TEST", source: "SYSTEM", runtime: "IMPORT", humanVerified: false, serverScored: false, assistanceUsed: false, directness: "DIRECT", reliability: "REVIEWED" },
});

function at(startAt: string, day: number): string {
  return new Date(Date.parse(startAt) + day * DAY_MS).toISOString();
}

function scope(conceptId: string, release: CurriculumOntologyRelease) {
  return { schoolId: LEARNER.schoolId, studentId: LEARNER.studentId, studentUserId: LEARNER.studentUserId, conceptId,
    ontologyReleaseId: release.id, ontologyReleaseIdentity: deterministicReleaseIdentity(release) };
}

function stepEvidence(step: Extract<SimulatedStep, { conceptId: string; correct: boolean }>, index: number, startAt: string,
  release: CurriculumOntologyRelease): GovernedEvidence {
  const occurredAt = at(startAt, step.day);
  const id = `sim-${index}-${step.kind.toLowerCase()}-${step.conceptId}`;
  const base = {
    evidenceId: id, idempotencyKey: id, attemptId: `sim-attempt-${index}`, tenantId: LEARNER.tenantId, schoolId: LEARNER.schoolId,
    learner: { studentId: LEARNER.studentId, studentUserId: LEARNER.studentUserId },
    offline: { isOffline: false, syncIdentity: null },
    curriculum: { ontologyReleaseId: release.id, ontologyReleaseIdentity: deterministicReleaseIdentity(release) },
  };
  if (step.kind === "RELEASED_ITEM") {
    const binding = release.bindings.find((entry) => entry.conceptId === step.conceptId);
    const item = binding && release.items.find((entry) => entry.id === binding.itemId && entry.version === binding.itemVersion);
    if (!binding || !item) throw new Error("simulator_concept_has_no_released_item");
    const selected = step.selectedAnswerIndex ?? (step.correct ? item.correctIndex : (item.correctIndex + 1) % item.options.length);
    return createGovernedEvidence({
      ...base, objective: { conceptId: step.conceptId, objectiveId: `${step.conceptId}-objective` },
      activity: { activityId: item.id, activityVersion: item.version },
      evidenceType: item.context === "DIAGNOSTIC" ? "DIAGNOSTIC" : "PRACTICE", modality: "INTERACTIVE", occurredAt,
      performance: { outcome: selected === item.correctIndex ? "CORRECT" : "INCORRECT", score: null, maxScore: null,
        correct: selected === item.correctIndex, selectedAnswerIndex: selected, signals: [] },
      provenance: { source: "ONLINE", actorId: LEARNER.studentUserId, actorRole: "STUDENT", runtime: "WEB", recordedAt: occurredAt, clientEventId: null, syncBatchId: null },
      strength: { serverScored: true, humanVerified: false, assistanceUsed: false, retryCount: step.retries ?? 0, hintCount: step.hints ?? 0,
        independenceKey: step.occasion ?? `occasion-${index}`, directness: "DIRECT", reliability: "UNASSESSED", policyRef: "simulator" },
    });
  }
  const shape = CORROBORATING_SHAPE[step.kind];
  return createGovernedEvidence({
    ...base, objective: { conceptId: step.conceptId, objectiveId: `${step.conceptId}-objective` },
    activity: { activityId: `sim-${step.kind.toLowerCase()}-${step.conceptId}`, activityVersion: "1" },
    evidenceType: shape.type, modality: step.kind === "TEACHER_EVIDENCE" ? "TEACHER_RECORDED" : step.kind === "LAB" ? "LAB_RUNTIME" : "INTERACTIVE",
    occurredAt,
    performance: { outcome: step.correct ? "CORRECT" : "INCORRECT", score: step.correct ? 9 : 3, maxScore: 10, correct: null, signals: [] },
    provenance: { source: shape.source, actorId: step.kind === "TEACHER_EVIDENCE" ? "synthetic-teacher" : null,
      actorRole: step.kind === "TEACHER_EVIDENCE" ? "TEACHER" : "SYSTEM", runtime: shape.runtime, recordedAt: occurredAt, clientEventId: null, syncBatchId: null },
    strength: { serverScored: shape.serverScored, humanVerified: shape.humanVerified, assistanceUsed: shape.assistanceUsed,
      retryCount: step.retries ?? 0, hintCount: step.hints ?? 0, independenceKey: step.occasion ?? `occasion-${index}`,
      directness: shape.directness, reliability: shape.reliability, policyRef: "simulator" },
  });
}

export async function simulateLearnerPath(scenario: SimulationScenario, release: CurriculumOntologyRelease = GRADE4_MATH_ONTOLOGY_RELEASE): Promise<SimulationResult> {
  if (scenario.label !== SYNTHETIC_LABEL) throw new Error("simulator_requires_synthetic_label");
  const canonical = new Map<string, CanonicalLearningStateEvent[]>(release.concepts.map((concept) => [concept.id, []]));
  const corroborating: { day: number; evidence: GovernedEvidence }[] = [];
  const canonicalDays = new Map<CanonicalLearningStateEvent, number>();

  scenario.steps.forEach((step, index) => {
    if (step.kind === "PLACEMENT") {
      const result = placementToGovernedEvidence({
        placementSessionId: `sim-placement-${index}`, tenantId: LEARNER.tenantId, schoolId: LEARNER.schoolId,
        learner: { studentId: LEARNER.studentId, studentUserId: LEARNER.studentUserId }, release,
        bindings: scenario.placementBindings ?? [],
        responses: step.responses.map((response) => ({ placementItemKey: response.itemKey, itemVersion: "1", difficulty: response.difficulty,
          isCorrect: response.correct, answeredAt: at(scenario.startAt, step.day) })),
      });
      for (const evidence of result.evidence) corroborating.push({ day: step.day, evidence });
      return;
    }
    if (step.kind === "MISCONCEPTION_REVIEW") {
      const signalEvidence = (canonical.get(step.conceptId) ?? [])
        .filter((event) => event.type === "GOVERNED_EVIDENCE" && event.misconceptionSignalId === step.signalId)
        .map((event) => (event as Extract<CanonicalLearningStateEvent, { type: "GOVERNED_EVIDENCE" }>).evidenceId);
      const review = createGovernedMisconceptionReview({
        reviewId: `sim-review-${index}`, scope: scope(step.conceptId, release), signalId: step.signalId, decision: step.decision,
        evidenceIds: signalEvidence, actor: { userId: "synthetic-teacher", role: "TEACHER" }, occurredAt: at(scenario.startAt, step.day),
      });
      canonical.get(step.conceptId)!.push(review);
      canonicalDays.set(review, step.day);
      return;
    }
    const evidence = stepEvidence(step, index, scenario.startAt, release);
    if (step.kind === "RELEASED_ITEM") {
      const event = { ...toCanonicalMasteryEvidence(evidence, release), retentionProbe: step.retentionProbe ?? false };
      canonical.get(step.conceptId)!.push(event);
      canonicalDays.set(event, step.day);
    } else {
      corroborating.push({ day: step.day, evidence });
    }
  });

  const checkpoints = [...new Set(scenario.checkpoints ?? scenario.steps.map((step) => step.day))].sort((a, b) => a - b);
  if (!checkpoints.length) checkpoints.push(0);
  const snapshots: SimulationSnapshot[] = [];
  for (const day of checkpoints) {
    const asOf = at(scenario.startAt, day);
    const states = release.concepts.map((concept) => replayStudentConceptState(
      (canonical.get(concept.id) ?? []).filter((event) => (canonicalDays.get(event) ?? 0) <= day),
      { asOf, expectedScope: scope(concept.id, release) }));
    const { calibration, estimates } = calibrateLearner({
      states, release, enrollmentGrade: scenario.enrollmentGrade, asOf,
      corroboratingEvidence: corroborating.filter((entry) => entry.day <= day).map((entry) => entry.evidence),
    });
    const revision = learnerStateRevision(states, release);
    const override = scenario.teacherOverride && scenario.teacherOverride.atDay === day ? scenario.teacherOverride.override : undefined;
    const { recommendation, resolution, decision } = await resolveLearningDecision({
      states, release, calibration, teacherOverride: override,
      currentRevision: async () => revision, idempotencyKey: `${scenario.name}:day-${day}`,
    });
    const lastEvidenceAt = states.map((state) => state.recency.lastEvidenceAt).filter((value): value is string => value !== null).sort().at(-1) ?? null;
    const participation = deriveParticipationSignals({ observations: scenario.participation ?? [], lastGovernedEvidenceAt: lastEvidenceAt, asOf });
    const interventions = generateInterventionCandidates({
      calibration, estimates, participation, candidates: generateLearningCandidates({ states, release }),
    });
    snapshots.push(Object.freeze({ day, asOf, states, calibration, estimates, recommendation, resolution, decision, participation, interventions }));
  }
  return Object.freeze({ simulatorVersion: LEARNER_PATH_SIMULATOR_VERSION, label: SYNTHETIC_LABEL, scenario: scenario.name, snapshots: Object.freeze(snapshots) });
}

/** Compact, human-readable trace of each loop stage. */
export function formatSimulationTrace(result: SimulationResult): string {
  const lines = [`# ${result.label}`, `scenario: ${result.scenario} (${result.simulatorVersion})`];
  for (const snap of result.snapshots) {
    lines.push(``, `## day ${snap.day} (${snap.asOf})`, `calibration: ${snap.calibration.stage} sufficientShare=${snap.calibration.sufficientShare} enrollmentGrade=${snap.calibration.enrollment.grade}`);
    for (const estimate of snap.estimates) {
      lines.push(`  SLM ${estimate.conceptId}: mastery=${estimate.mastery.estimate ?? "-"} (${estimate.mastery.level}) confidence=${estimate.confidence.score} (${estimate.confidence.level}) retention=${estimate.retention.status} misconception=${estimate.misconception.state} prereq=${estimate.prerequisite.status} sufficiency=${estimate.sufficiency.level} occasions=${estimate.sufficiency.effectiveOccasions}`);
    }
    lines.push(`DecisionModel: ${snap.recommendation.modelId} ranked=[${snap.recommendation.rankedCandidates.map((entry) => entry.id).join(", ")}]`);
    const early = snap.resolution.earlyLearning;
    lines.push(`Orchestrator: ${snap.decision.status} -> ${snap.decision.action?.id ?? "none"} (${snap.resolution.reason}${early ? `; early-learning ${early.intendedCategory}->${early.appliedCategory}` : ""})`);
    for (const intervention of snap.interventions) {
      lines.push(`  intervention ${intervention.kind}${intervention.conceptId ? ` [${intervention.conceptId}]` : ""} (${intervention.confidence}): ${intervention.recommendedAction.kind}`);
    }
  }
  return lines.join("\n");
}
