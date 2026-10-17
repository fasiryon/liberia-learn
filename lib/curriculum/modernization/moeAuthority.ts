/**
 * MOE / WAEC authority resolution for legacy lessons.
 *
 * Source of truth: curriculum/structured/moe-structured-v1.json, parsed from the verified MOE archives
 * listed in curriculum/sources/raw/source-manifest.json. Every structured item is UNREVIEWED and its
 * MOE approval is NOT_CLAIMED: provenance from an MOE document is not MOE approval of a LiberiaLearn
 * mapping.
 *
 * This module never upgrades a claim. A legacy `moeAlignments` code counts as MOE-traceable only when
 * it resolves to a structured MOE item id. Codes such as "LR-CIV-G1_3-01" produced by AI or keyword
 * alignment are LiberiaLearn-invented labels and are reported as such. Objective suggestions produced
 * here are lexical leads for a human curriculum reviewer, never mappings.
 */
import fs from "fs";
import path from "path";

export const MOE_STRUCTURED_PATH = "curriculum/structured/moe-structured-v1.json";

type StructuredItem = Readonly<{
  id: string;
  kind: string;
  grade: number;
  subject: string;
  sourceSubject: string;
  topic: string | null;
  text: string;
  confidence: string;
  provenance: Readonly<{ sourceMember: string; pages: readonly number[] }>;
}>;

export type MoeObjective = Readonly<{
  id: string;
  grade: number;
  subject: string;
  sourceSubject: string;
  topic: string | null;
  text: string;
  confidence: string;
  sourceMember: string;
  pages: readonly number[];
}>;

/**
 * How a lesson's catalog subject relates to the MOE structured cells.
 *   DIRECT     the MOE source has this subject at this grade.
 *   PROXY      only a broader MOE subject exists (e.g. Civics inside Social Studies); using it needs a curriculum-owner decision.
 *   NONE       no MOE source exists: the subject is LiberiaLearn-originated scope.
 */
export type MoeCellRelation = "DIRECT" | "PROXY" | "NONE";

export type MoeCellResolution = Readonly<{
  relation: MoeCellRelation;
  moeSubject: string | null;
  /** Narrower MOE source subjects that match the catalog subject (e.g. HISTORY at grades 10-12). */
  sourceSubjects: readonly string[] | null;
  objectiveCount: number;
  note: string;
}>;

const DIRECT_SUBJECTS: Readonly<Record<string, string>> = Object.freeze({
  MATH: "MATH",
  SCIENCE: "SCIENCE",
  ENGLISH: "LITERACY",
  LITERACY: "LITERACY",
  SOCIAL_STUDIES: "SOCIAL_STUDIES",
});

/** Catalog subjects whose MOE home is a broader subject; adopting the proxy is a curriculum-owner decision. */
const PROXY_SUBJECTS: Readonly<Record<string, Readonly<{ moeSubject: string; note: string }>>> = Object.freeze({
  CIVICS: { moeSubject: "SOCIAL_STUDIES", note: "No MOE Civics document is in the verified archives; civic objectives sit inside MOE Social Studies." },
  HISTORY: { moeSubject: "SOCIAL_STUDIES", note: "MOE History exists only for grades 10-12; below that, history objectives sit inside MOE Social Studies." },
});

let cache: { objectives: MoeObjective[] } | null = null;

export function loadMoeObjectives(root = process.cwd()): readonly MoeObjective[] {
  if (cache) return cache.objectives;
  const document = JSON.parse(fs.readFileSync(path.join(root, MOE_STRUCTURED_PATH), "utf8")) as { items: StructuredItem[] };
  const objectives = document.items
    .filter((item) => item.kind === "OBJECTIVE")
    .map((item) => Object.freeze({
      id: item.id, grade: item.grade, subject: item.subject, sourceSubject: item.sourceSubject, topic: item.topic,
      text: item.text, confidence: item.confidence, sourceMember: item.provenance.sourceMember, pages: item.provenance.pages,
    }));
  cache = { objectives };
  return objectives;
}

export function resolveMoeCell(subject: string, grade: number, objectives: readonly MoeObjective[] = loadMoeObjectives()): MoeCellResolution {
  const upper = subject.toUpperCase();
  if (upper === "HISTORY" && grade >= 10) {
    const count = objectives.filter((o) => o.subject === "SOCIAL_STUDIES" && o.sourceSubject === "HISTORY" && o.grade === grade).length;
    if (count > 0) return Object.freeze({ relation: "DIRECT", moeSubject: "SOCIAL_STUDIES", sourceSubjects: Object.freeze(["HISTORY"]), objectiveCount: count, note: "MOE History 10-12." });
  }
  const direct = DIRECT_SUBJECTS[upper];
  if (direct) {
    const count = objectives.filter((o) => o.subject === direct && o.grade === grade).length;
    return count > 0
      ? Object.freeze({ relation: "DIRECT", moeSubject: direct, sourceSubjects: null, objectiveCount: count, note: `MOE ${direct} grade ${grade}.` })
      : Object.freeze({ relation: "NONE", moeSubject: null, sourceSubjects: null, objectiveCount: 0, note: `No structured MOE ${direct} objectives for grade ${grade}.` });
  }
  const proxy = PROXY_SUBJECTS[upper];
  if (proxy) {
    const count = objectives.filter((o) => o.subject === proxy.moeSubject && o.grade === grade).length;
    return Object.freeze({ relation: count > 0 ? "PROXY" : "NONE", moeSubject: count > 0 ? proxy.moeSubject : null, sourceSubjects: null, objectiveCount: count, note: proxy.note });
  }
  return Object.freeze({ relation: "NONE", moeSubject: null, sourceSubjects: null, objectiveCount: 0, note: `No MOE source document for ${upper} in the verified archives: LiberiaLearn-originated scope.` });
}

export type AlignmentClaimKind = "STRUCTURED_MOE_ID" | "LIBERIALEARN_INVENTED_CODE" | "FREE_TEXT" | "EMPTY";

export type LegacyAlignmentClaim = Readonly<{
  code: string | null;
  description: string | null;
  method: string | null;
  confidence: string | null;
  kind: AlignmentClaimKind;
  resolvedObjectiveId: string | null;
}>;

/** Parses the heterogeneous legacy `moeAlignments` shapes into claims, resolving only true structured ids. */
export function parseLegacyAlignmentClaims(moeAlignments: unknown, objectives: readonly MoeObjective[] = loadMoeObjectives()): readonly LegacyAlignmentClaim[] {
  const ids = new Set(objectives.map((objective) => objective.id));
  const out: LegacyAlignmentClaim[] = [];
  const visit = (entry: unknown, method: string | null) => {
    if (typeof entry === "string") {
      const code = entry.trim();
      if (!code) return;
      out.push({ code, description: null, method, confidence: null, kind: ids.has(code) ? "STRUCTURED_MOE_ID" : /^[A-Z]{2,}[-_]/.test(code) ? "LIBERIALEARN_INVENTED_CODE" : "FREE_TEXT", resolvedObjectiveId: ids.has(code) ? code : null });
      return;
    }
    if (!entry || typeof entry !== "object") return;
    const record = entry as Record<string, unknown>;
    const code = typeof record.code === "string" ? record.code : typeof record.id === "string" ? record.id : typeof record.objectiveId === "string" ? record.objectiveId : null;
    const description = typeof record.description === "string" ? record.description : typeof record.text === "string" ? record.text : typeof record.statement === "string" ? record.statement : null;
    if (!code && !description) return;
    const resolved = code && ids.has(code) ? code : null;
    out.push({
      code, description, method, confidence: typeof record.confidence === "string" ? record.confidence : null,
      kind: resolved ? "STRUCTURED_MOE_ID" : code ? "LIBERIALEARN_INVENTED_CODE" : "FREE_TEXT",
      resolvedObjectiveId: resolved,
    });
  };
  if (Array.isArray(moeAlignments)) moeAlignments.forEach((entry) => visit(entry, null));
  else if (moeAlignments && typeof moeAlignments === "object") {
    const record = moeAlignments as Record<string, unknown>;
    const method = typeof record.method === "string" ? record.method : null;
    const list = Array.isArray(record.standards) ? record.standards : Array.isArray(record.objectives) ? record.objectives : Array.isArray(record.alignments) ? record.alignments : null;
    if (list) list.forEach((entry) => visit(entry, method));
    else visit(record, method);
  }
  return Object.freeze(out);
}

const STOP = new Set("the a an and or of to in on for with by from at as is are be be able will students student learners learner understand identify describe explain use using their its it this that these those into about how what why which can".split(" "));
export const tokens = (text: string) => text.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter((word) => word.length > 2 && !STOP.has(word));

export type ObjectiveSuggestion = Readonly<{ objectiveId: string; text: string; score: number; pages: readonly number[]; status: "LEXICAL_LEAD_UNREVIEWED" }>;

/**
 * Lexical leads: structured MOE objectives in the lesson's cell that share vocabulary with its title and
 * objectives. A lead is a starting point for a human reviewer and is never stored as an alignment.
 */
export function suggestMoeObjectives(input: { subject: string; grade: number; text: string; limit?: number }, objectives: readonly MoeObjective[] = loadMoeObjectives()): readonly ObjectiveSuggestion[] {
  const cell = resolveMoeCell(input.subject, input.grade, objectives);
  if (cell.relation === "NONE") return Object.freeze([]);
  const lessonTokens = new Set(tokens(input.text));
  if (lessonTokens.size === 0) return Object.freeze([]);
  return Object.freeze(objectives
    .filter((o) => o.subject === cell.moeSubject && o.grade === input.grade && (!cell.sourceSubjects || cell.sourceSubjects.includes(o.sourceSubject)))
    .map((o) => {
      const objectiveTokens = new Set([...tokens(o.text), ...tokens(o.topic ?? "")]);
      let shared = 0;
      for (const token of objectiveTokens) if (lessonTokens.has(token)) shared += 1;
      return { o, score: objectiveTokens.size ? shared / Math.sqrt(objectiveTokens.size * lessonTokens.size) : 0 };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.o.id.localeCompare(b.o.id))
    .slice(0, input.limit ?? 3)
    .map(({ o, score }) => Object.freeze({ objectiveId: o.id, text: o.text, score: Math.round(score * 1000) / 1000, pages: o.pages, status: "LEXICAL_LEAD_UNREVIEWED" as const })));
}

/** WAEC examinations that apply to a grade. LJHSCE closes grade 9; WASSCE closes grade 12 and is prepared for from grade 10. */
export function applicableExaminations(grade: number): readonly ("LJHSCE" | "WASSCE")[] {
  if (grade >= 7 && grade <= 9) return Object.freeze(["LJHSCE" as const]);
  if (grade >= 10) return Object.freeze(["WASSCE" as const]);
  return Object.freeze([]);
}

/**
 * lib/waec/syllabus.ts is compiled from public syllabus aggregations, not from a verified WAEC source
 * document held by LiberiaLearn, and tags are assigned by keyword. A tag therefore says "topic may be
 * relevant", never "aligned to WAEC".
 */
export const WAEC_TAG_EVIDENCE = "KEYWORD_TAG_UNVERIFIED_SOURCE" as const;
