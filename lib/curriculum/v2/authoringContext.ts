/**
 * Trusted, pinned authoring context for Curriculum V2 (Codex P1-4).
 *
 * A generated lesson that says objectiveIds: ["X"] does not make X canonical. Every governed
 * reference is resolved here, server-side, against:
 *
 *   structured MOE source (curriculum/structured/moe-structured-v1.json)
 *     → governed template cell (unit placement, interaction need, concept links)
 *       → executable ontology release (concepts, prerequisites, standard/skill bindings, items)
 *
 * Exact ids only: no fuzzy title matching and no fall-back to a first concept or node. A
 * reference that does not resolve is an explicit error (unknown, cross-grade, cross-subject,
 * not bindable) or, where the authority simply has no binding yet, an explicit review gap.
 * The context is pinned by hash so the artifact records exactly what it was generated against.
 */
import { createHash } from "crypto";
import { readFileSync } from "fs";
import path from "path";
import { deterministicReleaseIdentity, validateOntologyRelease, type CurriculumOntologyRelease } from "@/lib/learning-authority/governedGrade4Math";
import { isBindableObjective, type StructuredCurriculumItem } from "@/lib/learning-authority/structuredCurriculumAuthority";
import type { InteractionSpec, TemplateCell } from "@/lib/learning-authority/templateCell";
import { canonicalizeJson } from "@/lib/curriculum/provenance/hash";
import type { AgeBand } from "@/lib/learner-experience/types";
import type { ResolvedObjective, ReviewGap } from "./contract";

export const AUTHORING_CONTEXT_VERSION = "curriculum-v2-authoring-context/1.0.0" as const;

export type GovernedItemRef = Readonly<{ itemId: string; itemVersion: string; conceptId: string; prompt: string; options: readonly string[] }>;

export type AuthoringContext = Readonly<{
  contextVersion: typeof AUTHORING_CONTEXT_VERSION;
  grade: number;
  subject: string;
  ageBand: AgeBand;
  release: Readonly<{ id: string; version: string; identity: string }>;
  cell: Readonly<{ id: string; version: string }>;
  source: Readonly<{ archiveChecksum: string; sourceMember: string; memberChecksum: string | null; structuredReportVersion: string }>;
  /** Exactly the objectives this lesson may reference. */
  objectives: readonly ResolvedObjective[];
  /** Cell interaction classification per objective (tools, lab, offline need, recorded product gaps). */
  interactions: Readonly<Record<string, InteractionSpec>>;
  concepts: readonly Readonly<{ id: string; label: string; revision: number }>[];
  prerequisiteConceptIds: readonly string[];
  governedItems: readonly GovernedItemRef[];
  /** Authority gaps found while resolving (e.g. no standard binding): explicit, never invented. */
  gaps: readonly ReviewGap[];
  contextHash: string;
}>;

export class AuthoringContextError extends Error {
  constructor(readonly code: string, readonly objectiveId?: string) {
    super(objectiveId ? `${code}:${objectiveId}` : code);
    this.name = "AuthoringContextError";
  }
}

export function ageBandForGrade(grade: number): AgeBand {
  if (grade <= 3) return "EARLY_PRIMARY";
  if (grade <= 6) return "UPPER_PRIMARY";
  if (grade <= 9) return "JUNIOR_SECONDARY";
  return "SENIOR_SECONDARY";
}

type StructuredSource = Readonly<{ reportVersion: string; items: readonly StructuredCurriculumItem[] }>;

let cachedSource: StructuredSource | null = null;
/** The repository's structured MOE authority (read-only). */
export function loadStructuredSource(): StructuredSource {
  if (!cachedSource) {
    const raw = JSON.parse(readFileSync(path.join(process.cwd(), "curriculum/structured/moe-structured-v1.json"), "utf8")) as { reportVersion: string; items: StructuredCurriculumItem[] };
    cachedSource = Object.freeze({ reportVersion: String(raw.reportVersion), items: raw.items });
  }
  return cachedSource;
}

export function buildAuthoringContext(input: {
  objectiveIds: readonly string[];
  grade: number;
  subject: string;
  source: StructuredSource;
  cell: TemplateCell;
  release: CurriculumOntologyRelease;
}): AuthoringContext {
  validateOntologyRelease(input.release);
  if (input.release.grade !== input.grade || input.release.subject !== input.subject) throw new AuthoringContextError("release_scope_mismatch");
  if (input.cell.grade !== input.grade || input.cell.subject !== input.subject) throw new AuthoringContextError("cell_scope_mismatch");
  if (input.objectiveIds.length === 0) throw new AuthoringContextError("objectives_required");

  const byId = new Map(input.source.items.map((item) => [item.id, item]));
  const gaps: ReviewGap[] = [];
  const objectives: ResolvedObjective[] = [];
  const interactions: Record<string, InteractionSpec> = {};
  const conceptIds = new Set<string>();
  let provenance: StructuredCurriculumItem["provenance"] | null = null;

  for (const objectiveId of input.objectiveIds) {
    const item = byId.get(objectiveId);
    if (!item) throw new AuthoringContextError("objective_unknown", objectiveId);
    if (item.kind !== "OBJECTIVE") throw new AuthoringContextError("objective_not_an_objective", objectiveId);
    if (item.grade !== input.grade) throw new AuthoringContextError("objective_cross_grade", objectiveId);
    if (item.subject !== input.subject) throw new AuthoringContextError("objective_cross_subject", objectiveId);
    if (!isBindableObjective(item)) throw new AuthoringContextError("objective_not_bindable", objectiveId);
    const units = input.cell.units.filter((unit) => unit.objectives.some((objective) => objective.moeItemId === objectiveId));
    if (units.length !== 1) throw new AuthoringContextError(units.length ? "objective_ambiguous_unit" : "objective_not_in_cell", objectiveId);
    const unit = units[0];
    if (unit.moeTopicKey !== item.topicKey) throw new AuthoringContextError("objective_topic_mismatch", objectiveId);
    const cellObjective = unit.objectives.find((objective) => objective.moeItemId === objectiveId)!;
    // Concepts only through an explicit governed link: the cell objective, or an MOE_OBJECTIVE concept link.
    const linked = new Set<string>([...cellObjective.conceptIds, ...input.cell.conceptLinks.filter((link) => link.basis === "MOE_OBJECTIVE" && link.moeObjectiveIds.includes(objectiveId)).map((link) => link.conceptId)]);
    for (const conceptId of linked) if (!input.release.concepts.some((concept) => concept.id === conceptId)) throw new AuthoringContextError("concept_not_in_release", conceptId);
    const bindings = input.release.bindings.filter((binding) => linked.has(binding.conceptId));
    const standardCodes = [...new Set(bindings.map((binding) => binding.standardCode))].sort();
    const skillIds = [...new Set(bindings.map((binding) => binding.skillId))].sort();
    if (linked.size === 0) gaps.push({ code: "CONCEPT_UNBOUND", severity: "ADVISORY", detail: `${objectiveId} has no governed concept in ${input.release.id}; concept-level evidence stays unbound.` });
    if (standardCodes.length === 0) gaps.push({ code: "STANDARD_UNBOUND", severity: "ADVISORY", detail: `${objectiveId} has no standard/skill binding in ${input.release.id}.` });
    if (item.confidence === "MEDIUM") gaps.push({ code: "SOURCE_CONFIDENCE_MEDIUM", severity: "ADVISORY", detail: `${objectiveId} text was extracted at MEDIUM confidence; the reviewer confirms the wording.` });
    linked.forEach((conceptId) => conceptIds.add(conceptId));
    interactions[objectiveId] = cellObjective.interaction;
    provenance = provenance ?? item.provenance;
    if (provenance.sourceMember !== item.provenance.sourceMember) throw new AuthoringContextError("objectives_span_sources", objectiveId);
    objectives.push(Object.freeze({
      id: item.id, statement: item.text.trim(), grade: item.grade, subject: item.subject, topicKey: item.topicKey, unitId: unit.id,
      sourcePages: [...item.provenance.pages], sourceConfidence: item.confidence, conceptIds: [...linked].sort(), standardCodes, skillIds,
    }));
  }

  const unitIds = new Set(objectives.map((objective) => objective.unitId));
  if (unitIds.size !== 1) throw new AuthoringContextError("objectives_span_units");
  const prerequisiteConceptIds = [...new Set(input.release.prerequisites.filter((edge) => conceptIds.has(edge.toConceptId)).map((edge) => edge.fromConceptId))].sort();
  const concepts = input.release.concepts.filter((concept) => conceptIds.has(concept.id) || prerequisiteConceptIds.includes(concept.id)).map((concept) => ({ id: concept.id, label: concept.label, revision: concept.revision }));
  // Learner-safe refs to governed items bound to these concepts (keys stay inside the release).
  const governedItems: GovernedItemRef[] = input.release.bindings.filter((binding) => conceptIds.has(binding.conceptId)).flatMap((binding) => {
    const item = input.release.items.find((candidate) => candidate.id === binding.itemId && candidate.version === binding.itemVersion);
    return item ? [{ itemId: item.id, itemVersion: item.version, conceptId: binding.conceptId, prompt: item.prompt, options: [...item.options] }] : [];
  });

  const body = {
    contextVersion: AUTHORING_CONTEXT_VERSION,
    grade: input.grade,
    subject: input.subject,
    ageBand: ageBandForGrade(input.grade),
    release: { id: input.release.id, version: input.release.version, identity: deterministicReleaseIdentity(input.release) },
    cell: { id: input.cell.id, version: input.cell.version },
    source: { archiveChecksum: provenance!.archiveChecksum, sourceMember: provenance!.sourceMember, memberChecksum: provenance!.memberChecksum, structuredReportVersion: input.source.reportVersion },
    objectives,
    interactions,
    concepts,
    prerequisiteConceptIds,
    governedItems,
    gaps,
  };
  const contextHash = createHash("sha256").update(canonicalizeJson(body)).digest("hex");
  return Object.freeze({ ...body, contextHash });
}

export function contextObjective(context: AuthoringContext, objectiveId: string): ResolvedObjective | null {
  return context.objectives.find((objective) => objective.id === objectiveId) ?? null;
}
