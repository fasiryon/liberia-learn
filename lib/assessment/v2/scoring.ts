/**
 * Server-authoritative scoring. Scores are computed only on the server from the protected spec.
 * Client-asserted correctness or scores are never inputs.
 *
 * Outcomes:
 *   SCORED                    deterministic key scoring, or an authorized human moderation
 *   PENDING_HUMAN_MODERATION  rubric items, and constructed answers that do not exactly match a
 *                             key (ambiguous responses are never auto-zeroed)
 *   BLANK                     the learner submitted the item with no answer: 0 points, recorded as
 *                             blank (distinct from invalid, and from an item never presented)
 *   INVALID_RESPONSE          response shape does not fit the item; no score, no zero
 *
 * AI may attach a rubric-aligned suggestion (`AiScoringSuggestion`). It is non-authoritative by
 * type: nothing converts it into a SCORED outcome except `recordModeratedScore`, which requires an
 * authorized human moderator and a versioned moderation policy.
 */
import { auditEvent, type AssessmentAuditEvent } from "./audit";
import { hashScoringSpec } from "./hash";
import { isServerAutoScorable, itemTypeSpec, type LearnerResponse } from "./itemTypes";
import { assertIsoTimestamp } from "./validator";
import { LL_SECOND_MARKING } from "@/lib/academic-policy/llAep001";
import type { AssessmentFormV2, AssessmentItemV2, AssessmentPurpose, ProtectedScoringSpec, Rubric } from "./types";

export type ScorerAuthority = "SERVER_KEYED" | "HUMAN_MODERATOR";

export type ScoringOutcome = Readonly<{
  status: "SCORED" | "BLANK" | "PENDING_HUMAN_MODERATION" | "INVALID_RESPONSE";
  itemId: string;
  itemVersion: string;
  itemHash: string;
  scoringSpecHash: string;
  scoringVersion: string;
  points: number | null;
  maxPoints: number;
  partial: boolean;
  scorerAuthority: ScorerAuthority | null;
  misconceptionIds: readonly string[];
  reason: string;
}>;

const normalizeText = (value: string) => value.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ").replace(/[.]$/, "");

/**
 * Parses a learner number. Accepts "7000", "7,000", "-0.25", "0.5". Rejects anything ambiguous
 * (for example "7.000,5" or "1,23") rather than guessing a locale.
 */
export function parseLearnerNumber(raw: string): number | null {
  const text = raw.trim().replace(/\s/g, "");
  if (/^-?\d+(\.\d+)?$/.test(text)) return Number(text);
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(text)) return Number(text.replace(/,/g, ""));
  return null;
}

function outcome(item: AssessmentItemV2, spec: ProtectedScoringSpec, fields: Partial<ScoringOutcome> & Pick<ScoringOutcome, "status" | "reason">): ScoringOutcome {
  return Object.freeze({
    itemId: item.itemId,
    itemVersion: item.version,
    itemHash: item.itemHash,
    scoringSpecHash: item.scoringSpecHash,
    scoringVersion: spec.scoringVersion,
    points: null,
    maxPoints: spec.maxPoints,
    partial: false,
    scorerAuthority: null,
    misconceptionIds: [],
    ...fields,
  });
}

const round = (value: number) => Math.round(value * 1000) / 1000;

/** An explicit BLANK, or an empty answer of any shape. */
export function isBlankResponse(response: LearnerResponse): boolean {
  switch (response.kind) {
    case "BLANK": return true;
    case "SINGLE_SELECT": return response.optionId.trim() === "";
    case "MULTI_SELECT": return response.optionIds.length === 0;
    case "NUMERIC": return response.value.trim() === "";
    case "ORDERING": return response.order.length === 0;
    case "MATCHING": return response.pairs.length === 0;
    case "TEXT": return response.text.trim() === "";
    case "ARTIFACT": return response.artifactRefs.length === 0 && !response.note?.trim();
  }
}

export function scoreResponse(item: AssessmentItemV2, spec: ProtectedScoringSpec, response: LearnerResponse): ScoringOutcome {
  if (spec.itemId !== item.itemId || spec.itemVersion !== item.version || hashScoringSpec(spec) !== item.scoringSpecHash) {
    throw new Error("assessment_scoring_spec_mismatch");
  }
  const typeSpec = itemTypeSpec(item.itemType);
  if (isBlankResponse(response)) {
    // No answer earns nothing. That needs no judgment, so it is server-keyed even for rubric items.
    return outcome(item, spec, { status: "BLANK", reason: "blank_response", points: 0, scorerAuthority: "SERVER_KEYED" });
  }
  if (response.kind !== typeSpec.responseKind) return outcome(item, spec, { status: "INVALID_RESPONSE", reason: "response_kind_mismatch" });
  if (JSON.stringify(response).length > typeSpec.maxResponseChars + 200) return outcome(item, spec, { status: "INVALID_RESPONSE", reason: "response_too_long" });
  const key = spec.key;
  const max = spec.maxPoints;
  const signals = (patterns: readonly string[]) => spec.misconceptionSignals.filter((signal) => patterns.includes(signal.responsePattern)).map((signal) => signal.misconceptionId);
  const scored = (fraction: number, patterns: readonly string[] = []) => outcome(item, spec, {
    status: "SCORED", reason: "server_keyed", scorerAuthority: "SERVER_KEYED",
    points: round(max * Math.max(0, Math.min(1, fraction))), partial: fraction > 0 && fraction < 1,
    misconceptionIds: signals(patterns),
  });

  if (!isServerAutoScorable(item.itemType, key)) {
    return outcome(item, spec, { status: "PENDING_HUMAN_MODERATION", reason: "human_moderation_required" });
  }

  switch (key.kind) {
    case "SINGLE_SELECT": {
      if (response.kind !== "SINGLE_SELECT") break;
      if (!item.stimulus.options.some((option) => option.optionId === response.optionId)) return outcome(item, spec, { status: "INVALID_RESPONSE", reason: "unknown_option" });
      return scored(response.optionId === key.correctOptionId ? 1 : 0, [response.optionId]);
    }
    case "MULTI_SELECT": {
      if (response.kind !== "MULTI_SELECT") break;
      const known = new Set(item.stimulus.options.map((option) => option.optionId));
      const chosen = [...new Set(response.optionIds)];
      if (chosen.some((id) => !known.has(id))) return outcome(item, spec, { status: "INVALID_RESPONSE", reason: "unknown_option" });
      const right = chosen.filter((id) => key.correctOptionIds.includes(id)).length;
      const wrong = chosen.length - right;
      const exact = right === key.correctOptionIds.length && wrong === 0;
      if (key.partialCredit === "NONE") return scored(exact ? 1 : 0, chosen);
      return scored((right - wrong) / key.correctOptionIds.length, chosen);
    }
    case "NUMERIC": {
      if (response.kind !== "NUMERIC") break;
      const value = parseLearnerNumber(response.value);
      if (value === null) return outcome(item, spec, { status: "INVALID_RESPONSE", reason: "number_unparseable" });
      const valueRight = Math.abs(value - key.key.value) <= key.key.absoluteTolerance + 1e-12;
      if (!valueRight) return scored(0, [response.value.trim()]);
      if (key.key.acceptedUnits.length === 0) return scored(1);
      const unitRight = response.unit !== null && key.key.acceptedUnits.includes(normalizeText(response.unit));
      return scored(unitRight ? 1 : key.key.wrongUnitCredit);
    }
    case "ORDERING": {
      if (response.kind !== "ORDERING") break;
      const expected = key.correctOrder;
      if (response.order.length !== expected.length || new Set(response.order).size !== expected.length || !response.order.every((id) => expected.includes(id))) {
        return outcome(item, spec, { status: "INVALID_RESPONSE", reason: "ordering_incomplete" });
      }
      const exact = response.order.every((id, index) => id === expected[index]);
      if (key.partialCredit === "NONE" || exact) return scored(exact ? 1 : 0);
      const position = new Map(response.order.map((id, index) => [id, index]));
      let ordered = 0;
      for (let index = 0; index < expected.length - 1; index += 1) if (position.get(expected[index])! < position.get(expected[index + 1])!) ordered += 1;
      return scored(ordered / (expected.length - 1));
    }
    case "MATCHING": {
      if (response.kind !== "MATCHING") break;
      const leftIds = new Set(item.stimulus.matchingLeft.map((entry) => entry.optionId));
      const rightIds = new Set(item.stimulus.matchingRight.map((entry) => entry.optionId));
      if (response.pairs.some((pair) => !leftIds.has(pair.leftId) || !rightIds.has(pair.rightId)) || new Set(response.pairs.map((pair) => pair.leftId)).size !== response.pairs.length) {
        return outcome(item, spec, { status: "INVALID_RESPONSE", reason: "matching_invalid" });
      }
      const correct = response.pairs.filter((pair) => key.pairs.some((expected) => expected.leftId === pair.leftId && expected.rightId === pair.rightId)).length;
      if (key.partialCredit === "NONE") return scored(correct === key.pairs.length ? 1 : 0);
      return scored(correct / key.pairs.length);
    }
    case "SHORT_CONSTRUCTED": {
      if (response.kind !== "TEXT") break;
      const given = normalizeText(response.text);
      if (key.acceptedAnswers.some((answer) => normalizeText(answer) === given)) return scored(1);
      // Not an exact key match: could be a correct answer in different words. Never auto-zero.
      return outcome(item, spec, { status: "PENDING_HUMAN_MODERATION", reason: "constructed_response_not_exact_match" });
    }
    case "RUBRIC":
      return outcome(item, spec, { status: "PENDING_HUMAN_MODERATION", reason: "human_moderation_required" });
  }
  return outcome(item, spec, { status: "INVALID_RESPONSE", reason: "response_kind_mismatch" });
}

// ─── AI suggestion and human moderation ─────────────────────────────────────────────────────────

/** AI output for constructed responses. Advisory by construction; it carries no points field. */
export type AiScoringSuggestion = Readonly<{
  authority: "AI_SUGGESTION_NON_AUTHORITATIVE";
  agentId: string;
  promptRef: string;
  rubricId: string;
  rubricVersion: string;
  suggestedLevels: readonly Readonly<{ criterionId: string; suggestedPoints: number; rationale: string }>[];
  feedbackDraft: string;
  createdAt: string;
}>;

export type ModerationPolicy = Readonly<{
  policyId: string;
  version: string;
  /** Roles that may moderate (score) under this policy. */
  moderatorRoles: readonly ("TEACHER" | "ASSESSMENT_REVIEWER" | "EXAMINER")[];
  /** Independent second marking. Always required for high-stakes purposes (LL-AEP-001). */
  requiresSecondMarker: boolean;
  /** Two marks further apart than this share of the item maximum go to an examiner. */
  reconciliationTolerancePercent: number;
  /** Roles that may reconcile a disagreement. */
  examinerRoles: readonly ("EXAMINER" | "ASSESSMENT_REVIEWER")[];
}>;

export type ModerationActor = Readonly<{ kind: "HUMAN" | "AI"; id: string; role: string; schoolId: string | null }>;

export type ModerationRecord = Readonly<{
  policyId: string;
  policyVersion: string;
  moderatorId: string;
  aiSuggestionConsulted: boolean;
  secondMarkerRequired: boolean;
  marking: "SINGLE" | "AGREED" | "RECONCILED";
}>;

export type MarkRecord = Readonly<{ markerId: string; role: string; points: number; criterionScores: readonly Readonly<{ criterionId: string; points: number }>[]; at: string }>;

/** True when LL-AEP-001 or the policy demands independent second marking. */
export function secondMarkingRequired(policy: ModerationPolicy, purpose: AssessmentPurpose): boolean {
  return policy.requiresSecondMarker || (LL_SECOND_MARKING.highStakesPurposes as readonly string[]).includes(purpose);
}

function assertMarker(policy: ModerationPolicy | null, marker: ModerationActor, attemptSchoolId: string): asserts policy is ModerationPolicy {
  if (marker.kind !== "HUMAN") throw new Error("assessment_ai_scoring_not_authoritative");
  if (!policy) throw new Error("assessment_moderation_policy_required");
  if (!policy.moderatorRoles.includes(marker.role as ModerationPolicy["moderatorRoles"][number])) throw new Error("assessment_moderator_role_forbidden");
  if (marker.schoolId !== attemptSchoolId) throw new Error("assessment_moderator_school_mismatch");
}

/** Every mark on a response uses the moderation policy of the first mark (no tolerance swapping). */
function assertSameModerationPolicy(policy: ModerationPolicy, first: ModerationRecord): void {
  if (policy.policyId !== first.policyId || policy.version !== first.policyVersion) throw new Error("assessment_moderation_policy_mismatch");
}

function pointsFromCriteria(spec: ProtectedScoringSpec, criterionScores: readonly Readonly<{ criterionId: string; points: number }>[]): number {
  if (spec.key.kind === "RUBRIC") {
    const rubric: Rubric = spec.key.rubric;
    if (criterionScores.length !== rubric.criteria.length) throw new Error("assessment_rubric_scores_incomplete");
    let points = 0;
    for (const criterion of rubric.criteria) {
      const given = criterionScores.find((score) => score.criterionId === criterion.criterionId);
      if (!given || !criterion.levels.some((level) => level.points === given.points)) throw new Error("assessment_rubric_level_invalid");
      points += given.points;
    }
    return points;
  }
  // Constructed response with no exact key match: whole or no credit (no unauthorized partial credit).
  if (criterionScores.length !== 1 || ![0, spec.maxPoints].includes(criterionScores[0].points)) throw new Error("assessment_moderated_points_invalid");
  return criterionScores[0].points;
}

export type ModeratedResult = Readonly<{ outcome: ScoringOutcome; moderation: ModerationRecord; marks: readonly MarkRecord[]; audit: AssessmentAuditEvent }>;

export type ReconciliationRequired = Readonly<{ status: "RECONCILIATION_REQUIRED"; first: ModeratedResult; second: MarkRecord; difference: number }>;

/**
 * First human mark. For high-stakes purposes the result is SINGLE-marked and is NOT yet usable as
 * verified evidence: `verifyObservation` refuses it until a second mark agrees or an examiner
 * reconciles a disagreement.
 */
export function recordModeratedScore(input: {
  pending: ScoringOutcome;
  item: AssessmentItemV2;
  spec: ProtectedScoringSpec;
  moderator: ModerationActor;
  attemptSchoolId: string;
  purpose: AssessmentPurpose;
  policy: ModerationPolicy | null;
  criterionScores: readonly Readonly<{ criterionId: string; points: number }>[];
  aiSuggestion: AiScoringSuggestion | null;
  moderatedAt: string;
}): ModeratedResult {
  assertMarker(input.policy, input.moderator, input.attemptSchoolId);
  const policy = input.policy;
  if (input.pending.status !== "PENDING_HUMAN_MODERATION") throw new Error("assessment_outcome_not_pending_moderation");
  if (input.pending.itemHash !== input.item.itemHash || input.pending.scoringSpecHash !== hashScoringSpec(input.spec)) throw new Error("assessment_scoring_spec_mismatch");
  assertIsoTimestamp(input.moderatedAt, "moderated_at");
  const points = pointsFromCriteria(input.spec, input.criterionScores);
  // A suggestion made against a different rubric (or rubric version) cannot be consulted for this item.
  if (input.aiSuggestion && input.spec.key.kind === "RUBRIC" && (
    input.aiSuggestion.rubricId !== input.spec.key.rubric.rubricId || input.aiSuggestion.rubricVersion !== input.spec.key.rubric.rubricVersion
  )) throw new Error("assessment_ai_suggestion_rubric_mismatch");
  // A first mark on work that needs second marking is not a final score: it stays pending, so a form
  // total cannot be finalized from one marker (LL-AEP-001).
  const secondMarkerRequired = secondMarkingRequired(policy, input.purpose);
  const outcome: ScoringOutcome = Object.freeze({
    ...input.pending, status: secondMarkerRequired ? "PENDING_HUMAN_MODERATION" : "SCORED", points, partial: points > 0 && points < input.spec.maxPoints,
    scorerAuthority: "HUMAN_MODERATOR", reason: secondMarkerRequired ? "awaiting_second_mark" : "human_moderated",
  });
  return Object.freeze({
    outcome,
    moderation: Object.freeze({
      policyId: policy.policyId, policyVersion: policy.version, moderatorId: input.moderator.id,
      aiSuggestionConsulted: input.aiSuggestion !== null,
      secondMarkerRequired,
      marking: "SINGLE" as const,
    }),
    marks: Object.freeze([{ markerId: input.moderator.id, role: input.moderator.role, points, criterionScores: [...input.criterionScores], at: input.moderatedAt }]),
    audit: auditEvent({
      type: "assessment.score.moderated",
      subjectRef: `ITEM:${input.item.itemId}@${input.item.version}#${input.item.itemHash}`,
      actor: { kind: "HUMAN", id: input.moderator.id, role: input.moderator.role },
      schoolId: input.attemptSchoolId,
      occurredAt: input.moderatedAt,
      details: { points, policy: `${policy.policyId}@${policy.version}`, aiSuggestionConsulted: input.aiSuggestion !== null, marking: "SINGLE" },
    }),
  });
}

/**
 * Independent second mark. Within tolerance the marks AGREE and the official points are their mean;
 * otherwise an examiner must reconcile, and the response stays unusable as verified evidence.
 */
export function recordSecondMark(first: ModeratedResult, input: {
  item: AssessmentItemV2;
  spec: ProtectedScoringSpec;
  marker: ModerationActor;
  attemptSchoolId: string;
  policy: ModerationPolicy;
  criterionScores: readonly Readonly<{ criterionId: string; points: number }>[];
  markedAt: string;
}): ModeratedResult | ReconciliationRequired {
  assertMarker(input.policy, input.marker, input.attemptSchoolId);
  assertSameModerationPolicy(input.policy, first.moderation);
  if (first.moderation.marking !== "SINGLE") throw new Error("assessment_second_mark_not_expected");
  if (first.marks.some((mark) => mark.markerId === input.marker.id)) throw new Error("assessment_second_marker_must_be_independent");
  if (first.outcome.itemHash !== input.item.itemHash || first.outcome.scoringSpecHash !== hashScoringSpec(input.spec)) throw new Error("assessment_scoring_spec_mismatch");
  assertIsoTimestamp(input.markedAt, "marked_at");
  const points = pointsFromCriteria(input.spec, input.criterionScores);
  const second: MarkRecord = Object.freeze({ markerId: input.marker.id, role: input.marker.role, points, criterionScores: [...input.criterionScores], at: input.markedAt });
  const difference = Math.abs(points - first.marks[0].points);
  const tolerance = (input.policy.reconciliationTolerancePercent / 100) * input.spec.maxPoints;
  if (difference > tolerance + 1e-9) return Object.freeze({ status: "RECONCILIATION_REQUIRED" as const, first, second, difference });
  const agreed = round((points + first.marks[0].points) / 2);
  return Object.freeze({
    outcome: Object.freeze({ ...first.outcome, status: "SCORED" as const, points: agreed, partial: agreed > 0 && agreed < input.spec.maxPoints, reason: "second_marking_agreed" }),
    moderation: Object.freeze({ ...first.moderation, marking: "AGREED" as const }),
    marks: Object.freeze([...first.marks, second]),
    audit: auditEvent({
      type: "assessment.score.moderated", subjectRef: `ITEM:${input.item.itemId}@${input.item.version}#${input.item.itemHash}`,
      actor: { kind: "HUMAN", id: input.marker.id, role: input.marker.role }, schoolId: input.attemptSchoolId, occurredAt: input.markedAt,
      details: { points: agreed, marking: "AGREED", difference },
    }),
  });
}

/** Examiner reconciliation of a disagreement. The examiner is neither marker and sets valid rubric levels. */
export function reconcileMarks(pending: ReconciliationRequired, input: {
  item: AssessmentItemV2;
  spec: ProtectedScoringSpec;
  examiner: ModerationActor;
  attemptSchoolId: string;
  policy: ModerationPolicy;
  criterionScores: readonly Readonly<{ criterionId: string; points: number }>[];
  rationale: string;
  reconciledAt: string;
}): ModeratedResult {
  if (input.examiner.kind !== "HUMAN") throw new Error("assessment_ai_scoring_not_authoritative");
  if (!input.policy.examinerRoles.includes(input.examiner.role as ModerationPolicy["examinerRoles"][number])) throw new Error("assessment_examiner_role_required");
  if (input.examiner.schoolId !== input.attemptSchoolId) throw new Error("assessment_moderator_school_mismatch");
  assertSameModerationPolicy(input.policy, pending.first.moderation);
  const markers = [...pending.first.marks.map((mark) => mark.markerId), pending.second.markerId];
  if (markers.includes(input.examiner.id)) throw new Error("assessment_examiner_must_be_independent");
  if (input.rationale.trim().length < 15) throw new Error("assessment_reconciliation_rationale_required");
  assertIsoTimestamp(input.reconciledAt, "reconciled_at");
  const points = pointsFromCriteria(input.spec, input.criterionScores);
  return Object.freeze({
    outcome: Object.freeze({ ...pending.first.outcome, status: "SCORED" as const, points, partial: points > 0 && points < input.spec.maxPoints, reason: "examiner_reconciled" }),
    moderation: Object.freeze({ ...pending.first.moderation, moderatorId: input.examiner.id, marking: "RECONCILED" as const }),
    marks: Object.freeze([...pending.first.marks, pending.second, { markerId: input.examiner.id, role: input.examiner.role, points, criterionScores: [...input.criterionScores], at: input.reconciledAt }]),
    audit: auditEvent({
      type: "assessment.score.moderated", subjectRef: `ITEM:${input.item.itemId}@${input.item.version}#${input.item.itemHash}`,
      actor: { kind: "HUMAN", id: input.examiner.id, role: input.examiner.role }, schoolId: input.attemptSchoolId, occurredAt: input.reconciledAt,
      details: { points, marking: "RECONCILED" },
    }),
  });
}

// ─── Form-level scoring with approved points ───────────────────────────────────────────────────

export type FormScore = Readonly<{
  status: "IN_PROGRESS" | "SCORED" | "PENDING_MODERATION" | "NEEDS_RESOLUTION";
  earnedPoints: number | null;
  possiblePoints: number;
  items: readonly Readonly<{ itemId: string; formPoints: number; earned: number | null; status: ScoringOutcome["status"] | "NOT_ANSWERED" }>[];
}>;

/**
 * Scores an attempt against the form's APPROVED points (hashed into the reviewed form): each item
 * contributes `formPoints × points / maxPoints`. After submission an unanswered item counts as blank
 * (0); before submission the attempt is IN_PROGRESS. Invalid responses block the total.
 */
export function scoreAttemptForm(input: {
  form: AssessmentFormV2;
  outcomes: ReadonlyMap<string, ScoringOutcome>;
  submitted: boolean;
}): FormScore {
  const possible = input.form.items.reduce((sum, ref) => sum + ref.points, 0);
  let pending = false;
  let invalid = false;
  let unanswered = false;
  const items = input.form.items.map((ref) => {
    const result = input.outcomes.get(`${ref.itemId}@${ref.itemVersion}`);
    if (result && result.itemHash !== ref.itemHash) throw new Error("assessment_outcome_pin_mismatch");
    if (!result) {
      if (!input.submitted) unanswered = true;
      return Object.freeze({ itemId: ref.itemId, formPoints: ref.points, earned: input.submitted ? 0 : null, status: "NOT_ANSWERED" as const });
    }
    if (result.status === "PENDING_HUMAN_MODERATION") pending = true;
    if (result.status === "INVALID_RESPONSE") invalid = true;
    const earned = result.points === null ? null : round((ref.points * result.points) / result.maxPoints);
    return Object.freeze({ itemId: ref.itemId, formPoints: ref.points, earned, status: result.status });
  });
  const status: FormScore["status"] = unanswered ? "IN_PROGRESS" : invalid ? "NEEDS_RESOLUTION" : pending ? "PENDING_MODERATION" : "SCORED";
  return Object.freeze({
    status,
    earnedPoints: status === "SCORED" ? round(items.reduce((sum, item) => sum + (item.earned ?? 0), 0)) : null,
    possiblePoints: possible,
    items: Object.freeze(items),
  });
}
