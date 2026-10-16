/**
 * Server-authoritative scoring. Scores are computed only on the server from the protected spec.
 * Client-asserted correctness or scores are never inputs.
 *
 * Outcomes:
 *   SCORED                    deterministic key scoring, or an authorized human moderation
 *   PENDING_HUMAN_MODERATION  rubric items, and constructed answers that do not exactly match a
 *                             key (ambiguous responses are never auto-zeroed)
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
import type { AssessmentItemV2, ProtectedScoringSpec, Rubric } from "./types";

export type ScorerAuthority = "SERVER_KEYED" | "HUMAN_MODERATOR";

export type ScoringOutcome = Readonly<{
  status: "SCORED" | "PENDING_HUMAN_MODERATION" | "INVALID_RESPONSE";
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

export function scoreResponse(item: AssessmentItemV2, spec: ProtectedScoringSpec, response: LearnerResponse): ScoringOutcome {
  if (spec.itemId !== item.itemId || spec.itemVersion !== item.version || hashScoringSpec(spec) !== item.scoringSpecHash) {
    throw new Error("assessment_scoring_spec_mismatch");
  }
  const typeSpec = itemTypeSpec(item.itemType);
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
    if (response.kind === "TEXT" && response.text.trim() === "") return outcome(item, spec, { status: "INVALID_RESPONSE", reason: "empty_response" });
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
      if (chosen.length === 0 || chosen.some((id) => !known.has(id))) return outcome(item, spec, { status: "INVALID_RESPONSE", reason: "unknown_or_empty_selection" });
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
      if (response.text.trim() === "") return outcome(item, spec, { status: "INVALID_RESPONSE", reason: "empty_response" });
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
  /** Second-marking requirement for high-stakes use, recorded for the gradebook adapter. */
  requiresSecondMarker: boolean;
}>;

export type ModerationActor = Readonly<{ kind: "HUMAN" | "AI"; id: string; role: string; schoolId: string | null }>;

export function recordModeratedScore(input: {
  pending: ScoringOutcome;
  item: AssessmentItemV2;
  spec: ProtectedScoringSpec;
  moderator: ModerationActor;
  attemptSchoolId: string;
  policy: ModerationPolicy | null;
  criterionScores: readonly Readonly<{ criterionId: string; points: number }>[];
  aiSuggestion: AiScoringSuggestion | null;
  moderatedAt: string;
}): Readonly<{ outcome: ScoringOutcome; moderation: Readonly<{ policyId: string; policyVersion: string; moderatorId: string; aiSuggestionConsulted: boolean; secondMarkerRequired: boolean }>; audit: AssessmentAuditEvent }> {
  if (input.moderator.kind !== "HUMAN") throw new Error("assessment_ai_scoring_not_authoritative");
  if (!input.policy) throw new Error("assessment_moderation_policy_required");
  if (!input.policy.moderatorRoles.includes(input.moderator.role as ModerationPolicy["moderatorRoles"][number])) throw new Error("assessment_moderator_role_forbidden");
  if (input.moderator.schoolId !== input.attemptSchoolId) throw new Error("assessment_moderator_school_mismatch");
  if (input.pending.status !== "PENDING_HUMAN_MODERATION") throw new Error("assessment_outcome_not_pending_moderation");
  if (input.pending.itemHash !== input.item.itemHash || input.pending.scoringSpecHash !== hashScoringSpec(input.spec)) throw new Error("assessment_scoring_spec_mismatch");
  assertIsoTimestamp(input.moderatedAt, "moderated_at");

  let points: number;
  if (input.spec.key.kind === "RUBRIC") {
    const rubric: Rubric = input.spec.key.rubric;
    if (input.criterionScores.length !== rubric.criteria.length) throw new Error("assessment_rubric_scores_incomplete");
    points = 0;
    for (const criterion of rubric.criteria) {
      const given = input.criterionScores.find((score) => score.criterionId === criterion.criterionId);
      if (!given || !criterion.levels.some((level) => level.points === given.points)) throw new Error("assessment_rubric_level_invalid");
      points += given.points;
    }
  } else {
    // Constructed response with no exact key match: the moderator awards whole or no credit.
    if (input.criterionScores.length !== 1 || ![0, input.spec.maxPoints].includes(input.criterionScores[0].points)) throw new Error("assessment_moderated_points_invalid");
    points = input.criterionScores[0].points;
  }
  // A suggestion made against a different rubric (or rubric version) cannot be consulted for this item.
  if (input.aiSuggestion && input.spec.key.kind === "RUBRIC" && (
    input.aiSuggestion.rubricId !== input.spec.key.rubric.rubricId || input.aiSuggestion.rubricVersion !== input.spec.key.rubric.rubricVersion
  )) throw new Error("assessment_ai_suggestion_rubric_mismatch");
  const outcome: ScoringOutcome = Object.freeze({
    ...input.pending,
    status: "SCORED",
    points,
    partial: points > 0 && points < input.spec.maxPoints,
    scorerAuthority: "HUMAN_MODERATOR",
    reason: "human_moderated",
  });
  return Object.freeze({
    outcome,
    moderation: Object.freeze({
      policyId: input.policy.policyId,
      policyVersion: input.policy.version,
      moderatorId: input.moderator.id,
      aiSuggestionConsulted: input.aiSuggestion !== null,
      secondMarkerRequired: input.policy.requiresSecondMarker,
    }),
    audit: auditEvent({
      type: "assessment.score.moderated",
      subjectRef: `ITEM:${input.item.itemId}@${input.item.version}#${input.item.itemHash}`,
      actor: { kind: "HUMAN", id: input.moderator.id, role: input.moderator.role },
      schoolId: input.attemptSchoolId,
      occurredAt: input.moderatedAt,
      details: { points, policy: `${input.policy.policyId}@${input.policy.version}`, aiSuggestionConsulted: input.aiSuggestion !== null },
    }),
  });
}
