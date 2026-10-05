import type { CurriculumOntologyRelease } from "@/lib/learning-authority/governedGrade4Math";
import { PREREQUISITE_PROGRESSION_THRESHOLD } from "@/lib/learning-authority/progressionPolicy";
import type {
  ConfidenceLevel, MasteryLevel, MisconceptionStatus, RetentionStatus, StudentConceptState,
} from "@/lib/learning-state/studentLearningModel";
import type { EvidenceSufficiency } from "@/lib/learning-calibration/calibrationState";

export const COMPETENCY_ESTIMATE_VERSION = "competency-estimate-projection/1.0.0" as const;

export type PrerequisiteStatus = "NONE_REQUIRED" | "MET" | "UNMET" | "UNKNOWN";

/**
 * Read-only per-competency view of the canonical Student Learning Model.
 *
 * Every mastery, retention, confidence and misconception field is copied
 * verbatim from the canonical replay; nothing here is re-estimated. The only
 * additions are the prerequisite status (from the published release graph and
 * the orchestrator's progression threshold) and the evidence sufficiency
 * computed by the calibration layer.
 */
export type CompetencyEstimate = Readonly<{
  projectionVersion: typeof COMPETENCY_ESTIMATE_VERSION;
  conceptId: string;
  label: string;
  mastery: Readonly<{ estimate: number | null; level: MasteryLevel }>;
  retention: Readonly<{ estimate: number | null; status: RetentionStatus; lastProbeResult: "CORRECT" | "INCORRECT" | null }>;
  /** Certainty of the estimate, not learner ability. Canonical SLM value. */
  confidence: Readonly<{ score: number; level: ConfidenceLevel; reasons: readonly string[] }>;
  evidenceCount: number;
  independentEvidenceCount: number;
  lastEvidenceAt: string | null;
  prerequisite: Readonly<{ status: PrerequisiteStatus; unmetConceptIds: readonly string[]; unknownConceptIds: readonly string[] }>;
  misconception: Readonly<{
    state: "NONE" | MisconceptionStatus;
    signals: readonly Readonly<{ signalId: string; status: MisconceptionStatus; evidenceIds: readonly string[] }>[];
  }>;
  sufficiency: EvidenceSufficiency;
  evidenceIds: Readonly<{ positive: readonly string[]; negative: readonly string[] }>;
  source: Readonly<{ modelVersion: string; reducerVersion: string; inputDigest: string; asOf: string }>;
  authority: Readonly<{ derivedReadProjection: true; canonicalSource: "STUDENT_LEARNING_MODEL"; mayWrite: false }>;
}>;

const MISCONCEPTION_PRIORITY: Readonly<Record<MisconceptionStatus, number>> = Object.freeze({
  CONFIRMED: 4, CONFLICTED: 3, SUSPECTED: 2, REJECTED: 1,
});

export function prerequisiteStatus(
  conceptId: string,
  byConcept: ReadonlyMap<string, StudentConceptState>,
  release: CurriculumOntologyRelease,
): CompetencyEstimate["prerequisite"] {
  const edges = release.prerequisites.filter((edge) => edge.toConceptId === conceptId);
  if (!edges.length) return Object.freeze({ status: "NONE_REQUIRED", unmetConceptIds: Object.freeze([]), unknownConceptIds: Object.freeze([]) });
  const unmet: string[] = [];
  const unknown: string[] = [];
  for (const edge of edges) {
    const score = byConcept.get(edge.fromConceptId)?.mastery.observedScore ?? null;
    if (score === null) unknown.push(edge.fromConceptId);
    else if (score < PREREQUISITE_PROGRESSION_THRESHOLD) unmet.push(edge.fromConceptId);
  }
  const status: PrerequisiteStatus = unmet.length ? "UNMET" : unknown.length ? "UNKNOWN" : "MET";
  return Object.freeze({ status, unmetConceptIds: Object.freeze(unmet.sort()), unknownConceptIds: Object.freeze(unknown.sort()) });
}

export function buildCompetencyEstimate(input: {
  state: StudentConceptState;
  byConcept: ReadonlyMap<string, StudentConceptState>;
  release: CurriculumOntologyRelease;
  sufficiency: EvidenceSufficiency;
}): CompetencyEstimate {
  const { state, release } = input;
  const concept = release.concepts.find((entry) => entry.id === state.scope.conceptId);
  if (!concept) throw new Error("competency_concept_not_released");
  const signals = state.misconceptions
    .filter((entry) => entry.signalEvidenceIds.length > 0)
    .map((entry) => Object.freeze({ signalId: entry.signalId, status: entry.status, evidenceIds: entry.signalEvidenceIds }));
  const strongest = [...signals].sort((a, b) => MISCONCEPTION_PRIORITY[b.status] - MISCONCEPTION_PRIORITY[a.status])[0];
  return Object.freeze({
    projectionVersion: COMPETENCY_ESTIMATE_VERSION,
    conceptId: concept.id,
    label: concept.label,
    mastery: Object.freeze({ estimate: state.mastery.observedScore, level: state.mastery.level }),
    retention: Object.freeze({
      estimate: state.retention.estimatedRetainedMastery,
      status: state.retention.status,
      lastProbeResult: state.retention.lastProbeResult,
    }),
    confidence: Object.freeze({ score: state.confidence.score, level: state.confidence.level, reasons: state.confidence.reasons }),
    evidenceCount: state.conflict.positiveEvidenceIds.length + state.conflict.negativeEvidenceIds.length,
    independentEvidenceCount: state.confidence.independentOccasions,
    lastEvidenceAt: state.recency.lastEvidenceAt,
    prerequisite: prerequisiteStatus(concept.id, input.byConcept, release),
    misconception: Object.freeze({ state: strongest?.status ?? "NONE", signals: Object.freeze(signals) }),
    sufficiency: input.sufficiency,
    evidenceIds: Object.freeze({ positive: state.conflict.positiveEvidenceIds, negative: state.conflict.negativeEvidenceIds }),
    source: Object.freeze({
      modelVersion: state.modelVersion,
      reducerVersion: state.reducerVersion,
      inputDigest: state.replay.inputDigest,
      asOf: state.asOf,
    }),
    authority: Object.freeze({ derivedReadProjection: true as const, canonicalSource: "STUDENT_LEARNING_MODEL" as const, mayWrite: false as const }),
  });
}
