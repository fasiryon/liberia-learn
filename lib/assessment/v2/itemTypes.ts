/**
 * Item-type architecture. Each type declares its learner response contract, who may score it,
 * whether partial credit exists, the evidence quality it can produce, its offline limits and
 * whether human moderation is required. scoring.ts and projection.ts read this registry; there is
 * no per-route special case.
 *
 * Rule: an LLM's judgment is never a scoring authority. Types whose authority is HUMAN_MODERATED
 * can receive AI-suggested feedback (scoring.ts `AiScoringSuggestion`) but only an authorized
 * human moderator produces a verified score.
 */
import type { ItemType, ScoringKey } from "./types";

export type ScoringAuthority =
  /** Deterministic server scoring from the protected key. */
  | "SERVER_AUTO"
  /** Server scoring only when the key opts in (exact normalized short answers); otherwise human. */
  | "SERVER_AUTO_OR_HUMAN"
  /** An authorized teacher/moderator applies the rubric. AI may only suggest. */
  | "HUMAN_MODERATED";

export type LearnerResponse =
  | Readonly<{ kind: "SINGLE_SELECT"; optionId: string }>
  | Readonly<{ kind: "MULTI_SELECT"; optionIds: readonly string[] }>
  | Readonly<{ kind: "NUMERIC"; value: string; unit: string | null }>
  | Readonly<{ kind: "ORDERING"; order: readonly string[] }>
  | Readonly<{ kind: "MATCHING"; pairs: readonly Readonly<{ leftId: string; rightId: string }>[] }>
  | Readonly<{ kind: "TEXT"; text: string }>
  /** Uploaded or teacher-captured artifact (photo of paper work, project evidence). */
  | Readonly<{ kind: "ARTIFACT"; artifactRefs: readonly string[]; note: string | null }>;

export type ItemTypeSpec = Readonly<{
  itemType: ItemType;
  responseKind: LearnerResponse["kind"];
  acceptedKeyKinds: readonly ScoringKey["kind"][];
  scoringAuthority: ScoringAuthority;
  partialCredit: "NONE" | "KEY_DEFINED" | "RUBRIC";
  /** Best evidence quality the type can produce once verified. */
  evidenceQuality: "OBJECTIVE_KEYED" | "RUBRIC_MODERATED";
  /** Offline: capture is always local; scoring happens on the server after sync. */
  offline: "CAPTURE_THEN_SERVER_SCORE" | "CAPTURE_THEN_HUMAN_SCORE";
  humanModerationRequired: boolean;
  /** Max serialized response length (characters) accepted at the boundary. */
  maxResponseChars: number;
  accessibility: readonly string[];
}>;

const SELECT_ACCESSIBILITY = ["keyboard-operable options", "screen-reader option labels", "no colour-only meaning"] as const;

export const ITEM_TYPE_REGISTRY: Readonly<Record<ItemType, ItemTypeSpec>> = Object.freeze({
  SINGLE_SELECT: {
    itemType: "SINGLE_SELECT", responseKind: "SINGLE_SELECT", acceptedKeyKinds: ["SINGLE_SELECT"],
    scoringAuthority: "SERVER_AUTO", partialCredit: "NONE", evidenceQuality: "OBJECTIVE_KEYED",
    offline: "CAPTURE_THEN_SERVER_SCORE", humanModerationRequired: false, maxResponseChars: 200,
    accessibility: SELECT_ACCESSIBILITY,
  },
  MULTI_SELECT: {
    itemType: "MULTI_SELECT", responseKind: "MULTI_SELECT", acceptedKeyKinds: ["MULTI_SELECT"],
    scoringAuthority: "SERVER_AUTO", partialCredit: "KEY_DEFINED", evidenceQuality: "OBJECTIVE_KEYED",
    offline: "CAPTURE_THEN_SERVER_SCORE", humanModerationRequired: false, maxResponseChars: 2_000,
    accessibility: [...SELECT_ACCESSIBILITY, "states how many to choose only if the item says so"],
  },
  NUMERIC: {
    itemType: "NUMERIC", responseKind: "NUMERIC", acceptedKeyKinds: ["NUMERIC"],
    scoringAuthority: "SERVER_AUTO", partialCredit: "KEY_DEFINED", evidenceQuality: "OBJECTIVE_KEYED",
    offline: "CAPTURE_THEN_SERVER_SCORE", humanModerationRequired: false, maxResponseChars: 64,
    accessibility: ["plain text input (no custom keypad required)", "unit field labelled"],
  },
  ORDERING: {
    itemType: "ORDERING", responseKind: "ORDERING", acceptedKeyKinds: ["ORDERING"],
    scoringAuthority: "SERVER_AUTO", partialCredit: "KEY_DEFINED", evidenceQuality: "OBJECTIVE_KEYED",
    offline: "CAPTURE_THEN_SERVER_SCORE", humanModerationRequired: false, maxResponseChars: 2_000,
    accessibility: ["move up/down buttons as drag alternative", "announced positions"],
  },
  MATCHING: {
    itemType: "MATCHING", responseKind: "MATCHING", acceptedKeyKinds: ["MATCHING"],
    scoringAuthority: "SERVER_AUTO", partialCredit: "KEY_DEFINED", evidenceQuality: "OBJECTIVE_KEYED",
    offline: "CAPTURE_THEN_SERVER_SCORE", humanModerationRequired: false, maxResponseChars: 4_000,
    accessibility: ["select-list alternative to drag lines", "announced pairings"],
  },
  SHORT_CONSTRUCTED: {
    itemType: "SHORT_CONSTRUCTED", responseKind: "TEXT", acceptedKeyKinds: ["SHORT_CONSTRUCTED", "RUBRIC"],
    scoringAuthority: "SERVER_AUTO_OR_HUMAN", partialCredit: "RUBRIC", evidenceQuality: "OBJECTIVE_KEYED",
    offline: "CAPTURE_THEN_SERVER_SCORE", humanModerationRequired: false, maxResponseChars: 500,
    accessibility: ["text input with visible label", "paper capture accepted"],
  },
  EXTENDED_WRITING: {
    itemType: "EXTENDED_WRITING", responseKind: "TEXT", acceptedKeyKinds: ["RUBRIC"],
    scoringAuthority: "HUMAN_MODERATED", partialCredit: "RUBRIC", evidenceQuality: "RUBRIC_MODERATED",
    offline: "CAPTURE_THEN_HUMAN_SCORE", humanModerationRequired: true, maxResponseChars: 20_000,
    accessibility: ["criteria visible before writing", "paper capture or scribe accommodation"],
  },
  WORKED_SOLUTION: {
    itemType: "WORKED_SOLUTION", responseKind: "TEXT", acceptedKeyKinds: ["RUBRIC"],
    scoringAuthority: "HUMAN_MODERATED", partialCredit: "RUBRIC", evidenceQuality: "RUBRIC_MODERATED",
    offline: "CAPTURE_THEN_HUMAN_SCORE", humanModerationRequired: true, maxResponseChars: 10_000,
    accessibility: ["photo of paper working accepted", "method credit independent of final answer"],
  },
  PERFORMANCE_TASK: {
    itemType: "PERFORMANCE_TASK", responseKind: "ARTIFACT", acceptedKeyKinds: ["RUBRIC"],
    scoringAuthority: "HUMAN_MODERATED", partialCredit: "RUBRIC", evidenceQuality: "RUBRIC_MODERATED",
    offline: "CAPTURE_THEN_HUMAN_SCORE", humanModerationRequired: true, maxResponseChars: 4_000,
    accessibility: ["teacher observation record accepted", "alternative artifact forms"],
  },
});

export function itemTypeSpec(itemType: ItemType): ItemTypeSpec {
  const spec = ITEM_TYPE_REGISTRY[itemType];
  if (!spec) throw new Error("assessment_item_type_unsupported");
  return spec;
}

/** Whether the server may auto-score this item with this key, without a human. */
export function isServerAutoScorable(itemType: ItemType, key: ScoringKey): boolean {
  const spec = itemTypeSpec(itemType);
  if (spec.scoringAuthority === "SERVER_AUTO") return true;
  if (spec.scoringAuthority === "SERVER_AUTO_OR_HUMAN") return key.kind === "SHORT_CONSTRUCTED" && key.autoScore === "EXACT_NORMALIZED";
  return false;
}
