/**
 * Automated triage of the MOE structuring review queue (automated-triage-v1).
 *
 * Every queued item gets exactly one recorded decision, so the queue ends
 * empty and every outcome is auditable:
 *   KEPT         item is sound as parsed
 *   CORRECTED    text repaired (letter-spacing, run-on tail); kind unchanged
 *   RECLASSIFIED a CONTENTS/ACTIVITIES cell that the parser numbered as an
 *                objective; kind changed, text kept
 *   SUPPRESSED   not usable as authority; kept only in the audit list
 *
 * Triage is a deterministic machine decision. It is NOT LiberiaLearn human
 * review and NOT MOE approval: liberiaLearnReviewState stays UNREVIEWED and
 * moeApprovalState stays NOT_CLAIMED.
 */
import { lacksActionVerb, type StructuredCurriculumItem, type StructuredItemKind } from "./structuredCurriculumAuthority";

export const TRIAGE_VERSION = "automated-triage-v1";

export type TriageDecision = "KEPT" | "CORRECTED" | "RECLASSIFIED" | "SUPPRESSED";

export type TriageRecord = Readonly<{
  decision: TriageDecision;
  rule: string;
  by: typeof TRIAGE_VERSION;
  originalText?: string;
  originalKind?: StructuredItemKind;
}>;

export type TriagedItem = StructuredCurriculumItem & Readonly<{ triage?: TriageRecord }>;

/** Word frequencies from clean page text (words of 2+ letters). */
export type Vocabulary = ReadonlyMap<string, number>;

export function buildVocabulary(texts: readonly string[]): Vocabulary {
  const counts = new Map<string, number>();
  for (const text of texts) {
    for (const word of text.toLowerCase().match(/[a-z]{2,}/g) ?? []) counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  return counts;
}

/**
 * Rejoins words the PDF split with spaces ("Descr i be the weathe r" ->
 * "Describe the weather", "sour c es o f li g ht" -> "sources of light").
 * A run of fragments is merged when the joined word is a known word
 * (seen 3+ times in clean text) and at least one fragment is a stray piece.
 * That keeps "in to" and "as a" apart but joins "Class i fy" and "Ident ify".
 */
export function repairLetterSpacing(text: string, vocabulary: Vocabulary): string {
  const tokens = text.split(" ").filter(Boolean);
  const out: string[] = [];
  const lettersOf = (token: string) => token.toLowerCase().replace(/[^a-z]/g, "");
  const freq = (word: string) => vocabulary.get(word) ?? 0;
  let i = 0;
  while (i < tokens.length) {
    let merged: string | null = null;
    let span = 0;
    for (let j = Math.min(tokens.length, i + 7); j >= i + 2; j--) {
      const run = tokens.slice(i, j);
      // Only the last fragment may carry trailing punctuation; inner fragments must be pure letters.
      if (run.slice(0, -1).some((token) => !/^[A-Za-z]+$/.test(token))) continue;
      if (!/^[A-Za-z]+[.,;:)]*$/.test(run[run.length - 1]!)) continue;
      const joined = run.map(lettersOf).join("");
      const joinedFreq = freq(joined);
      if (joined.length < 2 || joinedFreq < 3) continue;
      const fragments = run.map(lettersOf);
      // At least one fragment must be a stray piece: a lone letter other than the
      // words "a"/"i", or a fragment far rarer than the joined word. Runs made only
      // of real words ("in to", "as a") stay apart.
      const stray = (fragment: string) => fragment.length === 1
        ? fragment !== "a" && fragment !== "i"
        : freq(fragment) < Math.max(3, joinedFreq / 4);
      if (!fragments.some(stray)) continue;
      merged = run.join("");
      span = j - i;
      break;
    }
    if (merged) { out.push(merged); i += span; } else { out.push(tokens[i]!); i += 1; }
  }
  return out.join(" ");
}

const ACTIVITY_STEM = /^(?:lead|guide|let|help|allow|ask|have|assist|encourage|take)\s+(?:the\s+)?(?:learners?|students?|pupils?)\b|^learners?\s+(?:will\s+)?(?:work|write|read|discuss|draw|narrate|practice|identify|list)\b/i;
const COMPETENCY_STEM = /^(?:effective\s+communication|creativity(?:\s+and\s+innovation)?|digital\s+(?:skills|literacy)|organi[sz]ational\s+skills|analytical\s+skills|problem[-\s]solving|critical\s+thinking|collaboration|leadership|personal\s+development|citizenship)\b/i;
const ASSESSMENT_TERMS = /^(?:attendances?|oral\s+(?:questions?(?:\s+and\s+answers?)?|presentations?)|class\s+assignments?(?:\s+and\s+participation)?|participation|observations?|assignments?|research|quiz(?:zes)?|tests?|exams?|examinations?|homework|projects?|peer\s+assessment|role\s+play(?:\s*&\s*responsibility)?|demonstrations?(?:\s*&\s*returned\s+demonstration)?|group\s+work|peer\s+work|presentations?|portfolio|practicals?|class\s*work|written\s+(?:test|work|exercise)s?)$/i;

/** Cuts text where an ALL-CAPS column heading bleeds in ("... poetry COMPOSITION DEVELOPMENT I Kinds"). */
export function cutHeadingBleed(text: string): string {
  const match = text.match(/^(.{8,}?)\s+[A-Z]{3,}(?:\s+[A-Z&/]{1,})+\b/);
  return match ? match[1]!.replace(/[\s,;:]+$/, "") : text;
}

/** Objective text that stops mid-phrase lost its continuation on another page. */
export function isTruncated(text: string): boolean {
  return /\b(?:the|of|and|to|a|an|in|for|with|between|on|by|from|as|or|its|their|such)$/i.test(text.replace(/[\s,;:]+$/, ""));
}

/** Cuts a run-on objective at the first sentence end or column boundary. */
function trimRunOn(text: string): string | null {
  const sentence = text.match(/^(.{12,}?[a-z)])[.;](?:\s|$)/);
  if (sentence && sentence[1]!.length < text.length - 2) return sentence[1]!;
  const boundary = text.match(/^(.{12,}?[a-z0-9)])\s+(?=[A-Z][a-z])/);
  if (boundary && text.length > 120) return boundary[1]!;
  return null;
}

export type ObjectiveTriageInput = Readonly<{ item: StructuredCurriculumItem; vocabulary: Vocabulary }>;

/** Decides one queued objective. Returns the (possibly changed) item, or null when suppressed. */
export function triageObjective({ item, vocabulary }: ObjectiveTriageInput): { item: TriagedItem | null; record: TriageRecord } {
  const record = (decision: TriageDecision, rule: string, extra: Partial<TriageRecord> = {}): TriageRecord => ({ decision, rule, by: TRIAGE_VERSION, ...extra });
  let text = item.text;
  const rules: string[] = [];

  if (/\s[a-z]{1,2}\s|\b[A-Za-z]\s[a-z]{2,}\b/.test(` ${text} `)) {
    const repaired = repairLetterSpacing(text, vocabulary);
    if (repaired !== text) { text = repaired; rules.push("letter_spacing_repaired"); }
  }
  const unbled = cutHeadingBleed(text);
  if (unbled !== text) { text = unbled; rules.push("heading_bleed_cut"); }
  const trimmed = item.qualityFlags.includes("TAIL_BOUNDARY_UNCERTAIN") || text.length > 160 ? trimRunOn(text) : null;
  if (trimmed) { text = trimmed; rules.push("run_on_tail_trimmed"); }
  text = text.replace(/\s+/g, " ").replace(/\s+([.,;:])/g, "$1").trim();

  if (text.length < 6 || !/[a-z]{3,}/i.test(text)) {
    return { item: null, record: record("SUPPRESSED", "too_short_or_no_words", { originalText: item.text }) };
  }
  if (ACTIVITY_STEM.test(text)) {
    return { item: { ...item, kind: "ACTIVITY", text, triage: record("RECLASSIFIED", [...rules, "activity_stem_numbered_as_objective"].join("+"), { originalKind: "OBJECTIVE", originalText: item.text }) }, record: record("RECLASSIFIED", "activity") };
  }
  if (ASSESSMENT_TERMS.test(text.replace(/[.:]$/, ""))) {
    return { item: { ...item, kind: "ASSESSMENT_REFERENCE", text, triage: record("RECLASSIFIED", [...rules, "assessment_strategy_numbered_as_objective"].join("+"), { originalKind: "OBJECTIVE", originalText: item.text }) }, record: record("RECLASSIFIED", "assessment") };
  }
  if (COMPETENCY_STEM.test(text)) {
    return { item: { ...item, kind: "COMPETENCY", text, triage: record("RECLASSIFIED", [...rules, "competency_numbered_as_objective"].join("+"), { originalKind: "OBJECTIVE", originalText: item.text }) }, record: record("RECLASSIFIED", "competency") };
  }
  if (lacksActionVerb(text)) {
    if (/^[A-Za-z]/.test(text)) {
      // A CONTENTS cell (topic noun phrase or gerund) numbered in sequence with objectives.
      if (item.confidence === "LOW" && item.qualityFlags.includes("AMBIGUOUS_COLUMN_ASSIGNMENT")) {
        return { item: null, record: record("SUPPRESSED", "ambiguous_column_and_not_an_objective", { originalText: item.text }) };
      }
      return { item: { ...item, kind: "CONTENT", text, triage: record("RECLASSIFIED", [...rules, "content_cell_numbered_as_objective"].join("+"), { originalKind: "OBJECTIVE", originalText: item.text }) }, record: record("RECLASSIFIED", "content") };
    }
    return { item: null, record: record("SUPPRESSED", "no_action_verb_unclassifiable", { originalText: item.text }) };
  }
  if (isTruncated(text)) {
    return { item: null, record: record("SUPPRESSED", "objective_text_truncated", { originalText: item.text }) };
  }
  if (item.confidence === "LOW" && item.qualityFlags.includes("AMBIGUOUS_COLUMN_ASSIGNMENT")) {
    // Verb-led but the continuation page could not say which column it belongs to.
    // Objectives and activities are both verb-led; keep it only as an activity-neutral
    // objective when short and imperative, otherwise suppress.
    if (text.length > 140) return { item: null, record: record("SUPPRESSED", "ambiguous_column_long_text", { originalText: item.text }) };
  }
  const flags = item.qualityFlags.filter((flag) => flag !== "OBJECTIVE_LACKS_ACTION_VERB" && !(rules.includes("letter_spacing_repaired") && flag === "LETTER_SPACING_ARTIFACTS") && !(rules.includes("run_on_tail_trimmed") && flag === "TAIL_BOUNDARY_UNCERTAIN"));
  if (rules.length) {
    return { item: { ...item, text, qualityFlags: flags, triage: record("CORRECTED", rules.join("+"), { originalText: item.text }) }, record: record("CORRECTED", rules.join("+")) };
  }
  return { item: { ...item, qualityFlags: flags, triage: record("KEPT", "verb_led_objective_as_parsed") }, record: record("KEPT", "as_parsed") };
}

export type UnassignedTriage =
  | { decision: "RECLASSIFIED"; kind: "ASSESSMENT_REFERENCE" | "MATERIAL"; parts: string[]; rule: string }
  | { decision: "SUPPRESSED"; rule: string };

/** Salvages assessment and material fragments from unassigned table text; suppresses the rest. */
export function triageUnassigned(text: string): UnassignedTriage[] {
  const parts = text.split(/\s[•¯]\s|\s[-–]\s(?=[A-Z])|^[-–•]\s/).map((part) => part.trim()).filter(Boolean);
  const assessments = parts.filter((part) => ASSESSMENT_TERMS.test(part));
  const materials = parts.flatMap((part) => part.match(/\bwww\.[^\s]+/g) ?? []).concat(parts.filter((part) => /^(?:primary|secondary)\s+(?:school\s+)?text\b|textbook|USAID|reader\b/i.test(part)));
  const results: UnassignedTriage[] = [];
  if (assessments.length) results.push({ decision: "RECLASSIFIED", kind: "ASSESSMENT_REFERENCE", parts: assessments, rule: "assessment_vocabulary" });
  if (materials.length) results.push({ decision: "RECLASSIFIED", kind: "MATERIAL", parts: [...new Set(materials)], rule: "material_reference" });
  const salvaged = assessments.length + materials.length;
  if (salvaged < parts.length) results.push({ decision: "SUPPRESSED", rule: salvaged ? "remaining_text_column_not_determinable" : "column_not_determinable" });
  return results;
}
