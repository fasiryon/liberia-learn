import { createHash } from "crypto";
import type { LearningAction, TeacherOverride } from "@/lib/learning-authority/learningOrchestrator";
import type { LearnerCalibration } from "@/lib/learning-calibration/calibrationState";
import type { CompetencyEstimate } from "@/lib/learning-calibration/competencyEstimate";
import type { ParticipationSnapshot } from "@/lib/learning-calibration/participationSignals";

/**
 * Teacher intervention engine.
 *
 * Produces explainable *candidates* for a teacher. Each candidate names the
 * evidence or observable signal that triggered it, the reason, how certain the
 * trigger is, and a recommended action. Nothing here acts on the learner: a
 * teacher accepts, modifies or overrides, and any change of next action flows
 * through the Learning Orchestrator's existing TeacherOverride path, which
 * only admits governed candidates.
 */
export const TEACHER_INTERVENTION_POLICY_VERSION = "teacher-intervention-policy/1.0.0" as const;

export type InterventionKind =
  | "PREREQUISITE_GAP" | "REPEATED_MISCONCEPTION" | "RETENTION_DECLINE"
  | "INSUFFICIENT_EVIDENCE" | "INACTIVITY" | "READY_FOR_EXTENSION";

export type RecommendedActionKind =
  | "REMEDIATE_PREREQUISITE" | "REVIEW_MISCONCEPTION" | "SCHEDULE_RETRIEVAL_PRACTICE"
  | "COLLECT_EVIDENCE" | "CHECK_IN_WITH_LEARNER" | "OFFER_EXTENSION";

export type InterventionCandidate = Readonly<{
  id: string;
  policyVersion: typeof TEACHER_INTERVENTION_POLICY_VERSION;
  kind: InterventionKind;
  conceptId: string | null;
  triggeringEvidence: Readonly<{ evidenceIds: readonly string[]; signalCodes: readonly string[]; observationIds: readonly string[] }>;
  reason: string;
  /** Certainty that the trigger is real, not a judgement of the learner. */
  confidence: "HIGH" | "MEDIUM" | "LOW";
  recommendedAction: Readonly<{ kind: RecommendedActionKind; candidateId: string | null; description: string }>;
  teacherResponse: Readonly<{ options: readonly ["ACCEPT", "MODIFY", "OVERRIDE"]; required: true }>;
  learnerStateRevision: string;
  authority: Readonly<{ advisoryOnly: true; mayChangeMastery: false; mayChangeAdministrativeGrade: false; llmGenerated: false }>;
}>;

const OPTIONS = Object.freeze(["ACCEPT", "MODIFY", "OVERRIDE"] as const);
const CERTAINTY_RANK: Readonly<Record<InterventionCandidate["confidence"], number>> = Object.freeze({ LOW: 0, MEDIUM: 1, HIGH: 2 });

function certainty(estimate: CompetencyEstimate): InterventionCandidate["confidence"] {
  if (estimate.sufficiency.level === "SUFFICIENT") return "HIGH";
  if (estimate.sufficiency.level === "PARTIAL") return "MEDIUM";
  return "LOW";
}

function pickCandidate(candidates: readonly LearningAction[], conceptId: string | null, kind?: LearningAction["kind"]): string | null {
  return candidates.find((entry) => entry.conceptId === conceptId && (!kind || entry.kind === kind))?.id
    ?? candidates.find((entry) => entry.conceptId === conceptId)?.id ?? null;
}

export function generateInterventionCandidates(input: {
  calibration: LearnerCalibration;
  estimates: readonly CompetencyEstimate[];
  participation: ParticipationSnapshot;
  /** Governed candidates from the orchestrator; recommendations may only point at these. */
  candidates: readonly LearningAction[];
}): readonly InterventionCandidate[] {
  const { calibration, estimates, candidates } = input;
  const out: Omit<InterventionCandidate, "id" | "policyVersion" | "teacherResponse" | "learnerStateRevision" | "authority">[] = [];
  const byConcept = new Map(estimates.map((estimate) => [estimate.conceptId, estimate]));

  for (const estimate of estimates) {
    if (estimate.prerequisite.status === "UNMET") {
      const gaps = estimate.prerequisite.unmetConceptIds;
      out.push({
        kind: "PREREQUISITE_GAP", conceptId: estimate.conceptId,
        triggeringEvidence: { evidenceIds: Object.freeze(gaps.flatMap((id) => byConcept.get(id)?.evidenceIds.negative ?? [])),
          signalCodes: Object.freeze([]), observationIds: Object.freeze([]) },
        reason: `${estimate.label} is blocked: prerequisite ${gaps.join(", ")} is below the governed progression threshold.`,
        // As certain as the least-evidenced blocking prerequisite.
        confidence: gaps.map((id) => byConcept.get(id)).reduce<InterventionCandidate["confidence"]>((lowest, entry) => {
          const level = entry ? certainty(entry) : "LOW";
          return CERTAINTY_RANK[level] < CERTAINTY_RANK[lowest] ? level : lowest;
        }, "HIGH"),
        recommendedAction: { kind: "REMEDIATE_PREREQUISITE", candidateId: pickCandidate(candidates, gaps[0] ?? null),
          description: `Reteach ${gaps.join(", ")} before continuing ${estimate.label}.` },
      });
    }
    const misconception = estimate.misconception.signals.find((signal) =>
      signal.status === "CONFIRMED" || (signal.status === "SUSPECTED" && signal.evidenceIds.length >= 2));
    if (misconception) {
      out.push({
        kind: "REPEATED_MISCONCEPTION", conceptId: estimate.conceptId,
        triggeringEvidence: { evidenceIds: misconception.evidenceIds, signalCodes: Object.freeze([misconception.signalId]), observationIds: Object.freeze([]) },
        reason: misconception.status === "CONFIRMED"
          ? `Teacher-confirmed misconception "${misconception.signalId}" on ${estimate.label}.`
          : `Misconception signal "${misconception.signalId}" appeared on ${misconception.evidenceIds.length} governed responses; awaiting teacher review.`,
        confidence: misconception.status === "CONFIRMED" ? "HIGH" : "MEDIUM",
        recommendedAction: { kind: "REVIEW_MISCONCEPTION", candidateId: pickCandidate(candidates, estimate.conceptId, "PRACTICE"),
          description: misconception.status === "CONFIRMED" ? "Address the misconception directly, then re-check." : "Review the flagged responses and confirm or reject the signal." },
      });
    }
    const lowProbe = estimate.retention.lastProbeResult === "INCORRECT";
    if ((estimate.retention.status === "AT_RISK" || lowProbe) && estimate.mastery.estimate !== null) {
      out.push({
        kind: "RETENTION_DECLINE", conceptId: estimate.conceptId,
        triggeringEvidence: { evidenceIds: Object.freeze([...estimate.evidenceIds.positive.slice(-1), ...(lowProbe ? estimate.evidenceIds.negative.slice(-1) : [])]),
          signalCodes: Object.freeze([`RETENTION_${estimate.retention.status}`]), observationIds: Object.freeze([]) },
        reason: lowProbe
          ? `The latest governed retrieval check on ${estimate.label} was incorrect.`
          : `Last success on ${estimate.label} was over 30 days ago; retention is a policy estimate (${estimate.retention.estimate ?? "unknown"}), not an observed loss.`,
        confidence: lowProbe ? "HIGH" : "LOW",
        recommendedAction: { kind: "SCHEDULE_RETRIEVAL_PRACTICE", candidateId: pickCandidate(candidates, estimate.conceptId, "PRACTICE"),
          description: `Schedule a short retrieval check on ${estimate.label}.` },
      });
    }
    if (estimate.sufficiency.level === "PARTIAL" &&
      (estimate.sufficiency.reasons.includes("CONTRADICTORY_EVIDENCE") || estimate.sufficiency.reasons.includes("CORROBORATION_DISAGREES"))) {
      out.push({
        kind: "INSUFFICIENT_EVIDENCE", conceptId: estimate.conceptId,
        triggeringEvidence: { evidenceIds: Object.freeze([...estimate.evidenceIds.positive, ...estimate.evidenceIds.negative, ...estimate.sufficiency.corroboratingEvidenceIds].sort()),
          signalCodes: Object.freeze(estimate.sufficiency.reasons.filter((reason) => reason === "CONTRADICTORY_EVIDENCE" || reason === "CORROBORATION_DISAGREES")),
          observationIds: Object.freeze([]) },
        reason: `Evidence on ${estimate.label} disagrees; the estimate should not be trusted until a supervised check resolves it.`,
        confidence: "MEDIUM",
        recommendedAction: { kind: "COLLECT_EVIDENCE", candidateId: pickCandidate(candidates, estimate.conceptId, "DIAGNOSTIC"),
          description: `Run a supervised check on ${estimate.label}.` },
      });
    }
    if (estimate.mastery.level === "SECURE" && estimate.sufficiency.level === "SUFFICIENT" &&
      estimate.misconception.state === "NONE" && estimate.retention.status === "FRESH") {
      out.push({
        kind: "READY_FOR_EXTENSION", conceptId: estimate.conceptId,
        triggeringEvidence: { evidenceIds: estimate.evidenceIds.positive, signalCodes: Object.freeze(["MASTERY_SECURE", "SUFFICIENCY_SUFFICIENT"]), observationIds: Object.freeze([]) },
        reason: `${estimate.label} is secure with sufficient independent evidence and fresh retention.`,
        confidence: "HIGH",
        recommendedAction: { kind: "OFFER_EXTENSION", candidateId: null,
          description: `Offer enrichment beyond ${estimate.label}; the official grade is unchanged.` },
      });
    }
  }

  if (calibration.stage === "INITIAL" || calibration.stage === "PROVISIONAL") {
    const thin = calibration.competencies.filter((entry) => entry.sufficiency.level === "NONE" || entry.sufficiency.level === "INSUFFICIENT");
    out.push({
      kind: "INSUFFICIENT_EVIDENCE", conceptId: null,
      triggeringEvidence: { evidenceIds: Object.freeze([]), signalCodes: Object.freeze([`CALIBRATION_${calibration.stage}`]),
        observationIds: Object.freeze([]) },
      reason: `${thin.length} of ${calibration.competencies.length} competencies lack sufficient independent evidence; recommendations stay grade-level until more is collected.`,
      confidence: "HIGH",
      recommendedAction: { kind: "COLLECT_EVIDENCE", candidateId: candidates.find((entry) => entry.kind === "DIAGNOSTIC")?.id ?? null,
        description: "Collect a supervised classwork or diagnostic observation." },
    });
  }

  const inactivity = input.participation.signals.filter((signal) => signal.flagged &&
    (signal.code === "INACTIVITY" || signal.code === "ATTENDANCE_RATE" || signal.code === "ASSIGNMENT_COMPLETION"));
  if (inactivity.length) {
    out.push({
      kind: "INACTIVITY", conceptId: null,
      triggeringEvidence: { evidenceIds: Object.freeze([]), signalCodes: Object.freeze(inactivity.map((signal) => signal.code)),
        observationIds: Object.freeze(inactivity.flatMap((signal) => signal.observationIds)) },
      reason: inactivity.map((signal) => signal.description).join(" "),
      confidence: "HIGH",
      recommendedAction: { kind: "CHECK_IN_WITH_LEARNER", candidateId: null,
        description: "Check in with the learner or guardian about attendance and access." },
    });
  }

  return Object.freeze(out.map((entry) => {
    const body = { ...entry, recommendedAction: Object.freeze(entry.recommendedAction), triggeringEvidence: Object.freeze(entry.triggeringEvidence) };
    return Object.freeze({
      id: "intervention-" + createHash("sha256").update(JSON.stringify({
        kind: body.kind, conceptId: body.conceptId, revision: calibration.learnerStateRevision,
        participation: input.participation.asOf, trigger: body.triggeringEvidence,
      })).digest("hex").slice(0, 32),
      policyVersion: TEACHER_INTERVENTION_POLICY_VERSION,
      ...body,
      teacherResponse: Object.freeze({ options: OPTIONS, required: true as const }),
      learnerStateRevision: calibration.learnerStateRevision,
      authority: Object.freeze({ advisoryOnly: true as const, mayChangeMastery: false as const, mayChangeAdministrativeGrade: false as const, llmGenerated: false as const }),
    });
  }));
}

export type TeacherInterventionResponse = Readonly<{
  interventionId: string;
  response: "ACCEPT" | "MODIFY" | "OVERRIDE";
  actorId: string;
  role: "TEACHER" | "ADMIN";
  /** Required for MODIFY and OVERRIDE. */
  reason?: string;
  /** MODIFY: the governed candidate the teacher prefers instead. */
  candidateId?: string;
}>;

export type ResolvedTeacherIntervention = Readonly<{
  interventionId: string;
  response: TeacherInterventionResponse["response"];
  /** Pass to resolveLearningDecision; null when the response does not change the next action. */
  teacherOverride: TeacherOverride | null;
  dismissed: boolean;
  actorId: string;
  reason: string | null;
}>;

/**
 * Turn a teacher's response into an orchestrator-compatible override. The
 * orchestrator still rejects any candidate it did not generate.
 */
export function resolveTeacherInterventionResponse(input: {
  intervention: InterventionCandidate;
  response: TeacherInterventionResponse;
  candidates: readonly LearningAction[];
}): ResolvedTeacherIntervention {
  const { intervention, response } = input;
  if (response.interventionId !== intervention.id) throw new Error("intervention_response_mismatch");
  if (!response.actorId.trim() || !["TEACHER", "ADMIN"].includes(response.role)) throw new Error("intervention_actor_invalid");
  const reason = response.reason?.trim() ?? "";
  if (response.response !== "ACCEPT" && !reason) throw new Error("intervention_reason_required");
  const governed = new Set(input.candidates.map((entry) => entry.id));
  let candidateId: string | null = null;
  if (response.response === "ACCEPT") candidateId = intervention.recommendedAction.candidateId;
  if (response.response === "MODIFY") {
    if (!response.candidateId) throw new Error("intervention_modify_candidate_required");
    candidateId = response.candidateId;
  }
  if (candidateId !== null && !governed.has(candidateId)) throw new Error("intervention_candidate_not_governed");
  return Object.freeze({
    interventionId: intervention.id,
    response: response.response,
    teacherOverride: candidateId === null ? null : Object.freeze({
      candidateId, actorId: response.actorId, role: response.role,
      reason: reason || `Accepted intervention ${intervention.kind}: ${intervention.reason}`,
    }),
    dismissed: response.response === "OVERRIDE",
    actorId: response.actorId,
    reason: reason || null,
  });
}
