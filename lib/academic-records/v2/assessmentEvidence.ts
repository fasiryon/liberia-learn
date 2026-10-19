/**
 * Boundary between Assessment Architecture V2 evidence (PR #193) and official academic records.
 *
 * The records branch does not import the assessment branch; it accepts the structural subset of
 * `AssessmentEvidenceEnvelope` it needs. A cross-branch compatibility test feeds real envelopes in.
 *
 *   RAW_OBSERVATION              never a score                         → excluded
 *   PROVISIONAL_FEEDBACK         never official (client check / AI)    → excluded
 *   VERIFIED_ASSESSMENT_EVIDENCE official grade entry only if OFFICIAL delivery, server-keyed or
 *                                human-moderated, reconciled when second marking is required,
 *                                unrevoked, same school and student, and independent
 *   MASTERY_ADMITTED_EVIDENCE    same as verified for grades; also counts toward mastery
 *
 * Academic grades and mastery stay separate: `toGradeEntry` feeds the gradebook calculation,
 * `masterySummaryFromEvidence` feeds masteryPolicy.ts. Neither writes anything.
 */
import type { GradeCategory } from "./gradingPolicy";
import type { GradeEntry, GradeScope } from "./gradeCalculation";
import type { MasteryEvidenceSummary } from "./masteryPolicy";

export type AssessmentEvidenceForRecords = Readonly<{
  evidenceId: string;
  tier: "RAW_OBSERVATION" | "PROVISIONAL_FEEDBACK" | "VERIFIED_ASSESSMENT_EVIDENCE" | "MASTERY_ADMITTED_EVIDENCE";
  scope: Readonly<{ schoolId: string; studentId: string }>;
  pins: Readonly<{ itemId: string; releaseId: string | null }>;
  attempt: Readonly<{ attemptId: string; sessionId: string }>;
  objectiveIds: readonly string[];
  delivery: Readonly<{ official: boolean; purpose: string; itemContext: string }>;
  /**
   * Assessment evidence contract 1.1.0 (PR #193): UNVERIFIED means the server's assistance record
   * could not attest independent work. It is treated exactly like ASSISTED here: held for a teacher
   * in grades, never counted toward mastery.
   */
  independence: "INDEPENDENT" | "ASSISTED" | "UNVERIFIED";
  scoring: Readonly<{
    status: string;
    scorerAuthority: string | null;
    points: number | null;
    maxPoints: number | null;
    moderation: Readonly<{ secondMarkerRequired?: boolean; marking?: string }> | null;
  }>;
}>;

export type EvidenceExclusion = Readonly<{ excluded: true; evidenceId: string; reason: string }>;

const VERIFIED_TIERS = new Set(["VERIFIED_ASSESSMENT_EVIDENCE", "MASTERY_ADMITTED_EVIDENCE"]);
const AUTHORITATIVE_SCORERS = new Set(["SERVER_KEYED", "HUMAN_MODERATOR"]);

function assertScope(evidence: AssessmentEvidenceForRecords, scope: Pick<GradeScope, "schoolId" | "studentId">): void {
  if (evidence.scope.schoolId !== scope.schoolId || evidence.scope.studentId !== scope.studentId) throw new Error("records_evidence_scope_mismatch");
}

/** Converts one assessment envelope into an official grade entry, or explains why it cannot be one. */
export function toGradeEntry(evidence: AssessmentEvidenceForRecords, input: {
  scope: GradeScope;
  classId: string;
  category: GradeCategory;
  revokedReleaseIds: readonly string[];
}): GradeEntry | EvidenceExclusion {
  assertScope(evidence, input.scope);
  const no = (reason: string): EvidenceExclusion => Object.freeze({ excluded: true, evidenceId: evidence.evidenceId, reason });
  if (evidence.tier === "RAW_OBSERVATION") return no("raw_observation_is_not_a_score");
  if (evidence.tier === "PROVISIONAL_FEEDBACK") return no("provisional_feedback_is_not_official");
  if (!VERIFIED_TIERS.has(evidence.tier)) return no("unknown_tier");
  if (evidence.pins.releaseId && input.revokedReleaseIds.includes(evidence.pins.releaseId)) return no("release_revoked");
  if (!evidence.delivery.official) return no("delivery_not_official");
  if (evidence.scoring.status !== "SCORED" || evidence.scoring.points === null || !evidence.scoring.maxPoints) return no("not_scored");
  if (!AUTHORITATIVE_SCORERS.has(evidence.scoring.scorerAuthority ?? "")) return no("scorer_not_authoritative");
  const moderation = evidence.scoring.moderation;
  if (evidence.scoring.scorerAuthority === "HUMAN_MODERATOR" && moderation?.secondMarkerRequired && moderation.marking !== "AGREED" && moderation.marking !== "RECONCILED") {
    return no("second_marking_unreconciled");
  }
  const base = {
    entryId: evidence.evidenceId, sourceRef: `assessment-evidence:${evidence.evidenceId}`,
    studentId: input.scope.studentId, schoolId: input.scope.schoolId, classId: input.classId,
    subject: input.scope.subject, periodId: input.scope.periodId, category: input.category,
    pointsPossible: evidence.scoring.maxPoints, daysLate: 0, teacherConfirmedMissing: false,
  };
  // Assistance during an official assessment, or independence the record could not attest, is an
  // integrity question for a teacher, not an automatic score.
  if (evidence.independence !== "INDEPENDENT") {
    return Object.freeze({ ...base, status: "PENDING_MODERATION" as const, pointsEarned: null, scoreAuthority: null });
  }
  return Object.freeze({ ...base, status: "SCORED" as const, pointsEarned: evidence.scoring.points, scoreAuthority: evidence.scoring.scorerAuthority === "SERVER_KEYED" ? "SERVER_KEYED" as const : "HUMAN_MODERATOR" as const });
}

/**
 * Mastery summary for one objective: verified/admitted, official, independent, unrevoked evidence only.
 * Transfer items are those delivered in a NEW context.
 */
export function masterySummaryFromEvidence(evidence: readonly AssessmentEvidenceForRecords[], input: {
  scope: Pick<GradeScope, "schoolId" | "studentId">;
  objectiveId: string;
  revokedReleaseIds: readonly string[];
}): MasteryEvidenceSummary {
  const usable = evidence.filter((entry) => {
    assertScope(entry, input.scope);
    const moderation = entry.scoring.moderation;
    const unreconciled = entry.scoring.scorerAuthority === "HUMAN_MODERATOR" && Boolean(moderation?.secondMarkerRequired)
      && moderation?.marking !== "AGREED" && moderation?.marking !== "RECONCILED";
    // Unofficial (practice) deliveries and unreconciled high-stakes marks never create mastery (LL-AEP-001).
    return VERIFIED_TIERS.has(entry.tier) && entry.delivery.official && entry.independence === "INDEPENDENT" && entry.objectiveIds.includes(input.objectiveId)
      && entry.scoring.status === "SCORED" && entry.scoring.points !== null && Boolean(entry.scoring.maxPoints)
      && AUTHORITATIVE_SCORERS.has(entry.scoring.scorerAuthority ?? "") && !unreconciled
      && !(entry.pins.releaseId && input.revokedReleaseIds.includes(entry.pins.releaseId));
  });
  // A verified and an admitted envelope can describe the same response; count each item attempt once.
  const unique = new Map<string, AssessmentEvidenceForRecords>();
  for (const entry of usable) {
    const key = `${entry.attempt.attemptId}:${entry.pins.itemId}`;
    if (!unique.has(key) || entry.tier === "MASTERY_ADMITTED_EVIDENCE") unique.set(key, entry);
  }
  const items = [...unique.values()];
  const transfer = items.filter((entry) => entry.delivery.itemContext === "NEW");
  const sum = (list: AssessmentEvidenceForRecords[], field: "points" | "maxPoints") => list.reduce((total, entry) => total + (entry.scoring[field] ?? 0), 0);
  return Object.freeze({
    objectiveId: input.objectiveId,
    source: "VERIFIED_INDEPENDENT_EVIDENCE",
    independentItems: items.length,
    independentPointsEarned: sum(items, "points"),
    independentPointsPossible: sum(items, "maxPoints"),
    independentOccasions: new Set(items.map((entry) => entry.attempt.sessionId)).size,
    verifiedTransferItems: transfer.length,
    transferPointsEarned: sum(transfer, "points"),
    transferPointsPossible: sum(transfer, "maxPoints"),
  });
}
