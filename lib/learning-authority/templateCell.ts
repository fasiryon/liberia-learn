/**
 * Governed template cell (grade x subject): the reusable authority chain
 *
 *   MOE source page -> structured MOE objective -> cell unit -> concept
 *   -> lesson / governed item -> evidence + tool policy -> ontology release
 *
 * A cell is repository data. `certifyTemplateCell` resolves every reference
 * against the structured MOE authority, the ontology release, repository
 * lesson authority, the toolkit and lab registries, and (optionally) a
 * read-only production snapshot. It never infers a binding from a title.
 *
 * MOE source provenance is not MOE approval: a cell may only claim
 * moeApprovalState=NOT_CLAIMED until MOE approval evidence exists.
 */
import { validateOntologyRelease, type CurriculumOntologyRelease } from "./governedGrade4Math";
import type { StructuredCurriculumItem } from "./structuredCurriculumAuthority";

/** Internal LiberiaLearn interaction standard. */
export type InteractionNeed = "NONE" | "MANIPULATIVE_2D" | "SIMULATION" | "VIRTUAL_LAB" | "PRACTICAL" | "THREE_D";
export type InteractionEvidence = "GOVERNED_ITEM_RESPONSE" | "TEACHER_OBSERVATION" | "NONE";

export type InteractionSpec = Readonly<{
  need: InteractionNeed;
  /** Why this need (required for anything but NONE; for THREE_D it must name the spatial manipulation). */
  rationale: string;
  /** Toolkit registry ids (lib/toolkit/toolRegistry.ts) that implement it online. */
  tools: readonly string[];
  /** Lab engine id (lib/labs/registry.ts) when a typed lab implements it. */
  labId: string | null;
  evidence: InteractionEvidence;
  /** What a learner does with no device or no connection. Required for anything but NONE. */
  offlineFallback: string | null;
  safety: string | null;
}>;

export type ComponentKind = "CLASSWORK" | "HOMEWORK" | "PRACTICE" | "QUIZ" | "DIAGNOSTIC" | "ASSESSMENT" | "PROJECT";
export const COMPONENT_KINDS: readonly ComponentKind[] = ["CLASSWORK", "HOMEWORK", "PRACTICE", "QUIZ", "DIAGNOSTIC", "ASSESSMENT", "PROJECT"];

export type ComponentBinding = Readonly<{
  kind: ComponentKind;
  /** GOVERNED_ITEM: release item id. LESSON_PAYLOAD: payload key of the bound lesson. */
  source: "GOVERNED_ITEM" | "LESSON_PAYLOAD";
  ref: string;
}>;

export type CellLesson = Readonly<{
  contentId: string;
  version: string;
  /**
   * GOVERNED: human-reviewed and bound in the ontology release (counts as
   * governed coverage, must be live). DRAFT_UNREVIEWED: repository draft
   * only; never bound in a release, never counted as governed, never
   * expected in production.
   */
  authority: "GOVERNED" | "DRAFT_UNREVIEWED";
  conceptIds: readonly string[];
  objectiveIds: readonly string[];
  components: readonly ComponentBinding[];
}>;

export type CellObjective = Readonly<{ moeItemId: string; conceptIds: readonly string[]; interaction: InteractionSpec }>;

export type CellUnit = Readonly<{
  id: string;
  sequence: number;
  moeTopicKey: string;
  objectives: readonly CellObjective[];
  lessons: readonly CellLesson[];
}>;

export type ConceptLink = Readonly<{
  conceptId: string;
  basis: "MOE_OBJECTIVE" | "LIBERIALEARN_EXTENSION";
  moeObjectiveIds: readonly string[];
  note: string;
}>;

export type TemplateCell = Readonly<{
  id: string;
  version: string;
  grade: number;
  subject: string;
  releaseId: string;
  authority: Readonly<{
    source: "VERIFIED_LIBERIA_MOE_SOURCE";
    liberiaLearnReviewState: "UNREVIEWED" | "IN_REVIEW" | "REVIEWED";
    moeApprovalState: "NOT_CLAIMED";
  }>;
  units: readonly CellUnit[];
  conceptLinks: readonly ConceptLink[];
}>;

/** Repository lesson authority the cell may bind (contentId -> version + payload). */
export type RepoLesson = Readonly<{ contentId: string; version: string; grade: number; subject: string; authority: "GOVERNED" | "DRAFT_UNREVIEWED"; payload: Readonly<Record<string, unknown>> }>;

export type LiveState = Readonly<{
  capturedAt: string;
  lessonContentIds: ReadonlySet<string>;
  learningTargetCodes: ReadonlySet<string>;
  standardCodes: ReadonlySet<string>;
  skillIds: ReadonlySet<string>;
  unitIds: readonly string[];
}>;

export type CertificationInput = Readonly<{
  cell: TemplateCell;
  structuredItems: readonly StructuredCurriculumItem[];
  release: CurriculumOntologyRelease;
  repoLessons: readonly RepoLesson[];
  toolIds: ReadonlySet<string>;
  /** Release ToolPolicy keys -> toolkit registry id (null = deliberately not a toolkit tool, e.g. a prohibited device). */
  releaseToolKeyMap: Readonly<Record<string, string | null>>;
  labIds: ReadonlySet<string>;
  live?: LiveState;
}>;

export type ObjectiveCoverage = Readonly<{
  moeItemId: string;
  unitId: string;
  text: string;
  pages: readonly number[];
  interaction: InteractionNeed;
  interactionImplemented: boolean;
  lessons: readonly string[];
  governedLessons: readonly string[];
  draftLessons: readonly string[];
  /** Components from governed lessons and governed items only. */
  components: Readonly<Record<ComponentKind, number>>;
  /** Components present in unreviewed drafts. */
  draftComponents: Readonly<Record<ComponentKind, number>>;
  conceptIds: readonly string[];
}>;

export type CellCertification = Readonly<{
  cellId: string;
  releaseId: string;
  internallyExecutable: boolean;
  errors: readonly string[];
  objectives: readonly ObjectiveCoverage[];
  summary: Readonly<{
    moeObjectives: number;
    objectivesWithLesson: number;
    objectivesWithGovernedLesson: number;
    objectivesWithDraftLessonOnly: number;
    objectivesWithGovernedItem: number;
    componentCoverage: Readonly<Record<ComponentKind, number>>;
    draftComponentCoverage: Readonly<Record<ComponentKind, number>>;
    interaction: Readonly<Record<InteractionNeed, number>>;
    interactionImplemented: number;
    interactionGaps: readonly string[];
    resources: number;
    teacherAssessmentReferences: number;
    moeActivities: number;
  }>;
  teacherMetadata: readonly Readonly<{
    unitId: string; topic: string; semester: number | null; period: number | null; sourcePages: readonly number[];
    materials: readonly string[]; assessmentReferences: readonly string[]; competencies: readonly string[]; activities: readonly string[];
  }>[];
  live: Readonly<{
    checked: boolean;
    capturedAt: string | null;
    liveExecutable: boolean;
    missing: readonly string[];
    productionUnitsNotInCell: readonly string[];
  }>;
}>;

const emptyComponents = () => Object.fromEntries(COMPONENT_KINDS.map((kind) => [kind, 0])) as Record<ComponentKind, number>;
const nonEmpty = (value: unknown): boolean => value !== null && value !== undefined &&
  (typeof value === "string" ? value.trim().length > 0 : Array.isArray(value) ? value.length > 0 : typeof value === "object" ? Object.values(value as object).some(nonEmpty) : true);

export function certifyTemplateCell(input: CertificationInput): CellCertification {
  const { cell, release } = input;
  const errors: string[] = [];
  const items = new Map(input.structuredItems.map((item) => [item.id, item]));
  const cellItems = input.structuredItems.filter((item) => item.grade === cell.grade && item.subject === cell.subject);
  const conceptIds = new Set(release.concepts.map((concept) => concept.id));
  const releaseItems = new Map(release.items.map((item) => [item.id, item]));
  const repoLessons = new Map(input.repoLessons.map((lesson) => [lesson.contentId, lesson]));

  // 1. Cell identity and authority.
  if (cell.releaseId !== release.id) errors.push(`release_mismatch:${cell.releaseId}`);
  if (release.grade !== cell.grade || release.subject !== cell.subject) errors.push("release_scope_mismatch");
  if (cell.authority.moeApprovalState !== "NOT_CLAIMED") errors.push("moe_approval_claimed_without_evidence");
  try { validateOntologyRelease(release); } catch (error) { errors.push(`release_invalid:${error instanceof Error ? error.message : String(error)}`); }

  // 2. ToolPolicies resolve to real toolkit tools.
  for (const policy of release.toolPolicies) {
    for (const key of [...policy.allowed, ...policy.prohibited]) {
      if (!(key in input.releaseToolKeyMap)) errors.push(`tool_policy_key_unmapped:${policy.id}:${key}`);
      const toolId = input.releaseToolKeyMap[key];
      if (toolId && !input.toolIds.has(toolId)) errors.push(`tool_policy_tool_missing:${policy.id}:${key}->${toolId}`);
    }
  }

  // 3. Every MOE objective of the cell is placed exactly once, in its own topic.
  const placed = new Map<string, string>();
  const unitIds = new Set<string>();
  for (const unit of cell.units) {
    if (unitIds.has(unit.id)) errors.push(`unit_duplicate:${unit.id}`);
    unitIds.add(unit.id);
    if (!cellItems.some((item) => item.topicKey === unit.moeTopicKey)) errors.push(`unit_topic_missing:${unit.id}:${unit.moeTopicKey}`);
    for (const objective of unit.objectives) {
      const item = items.get(objective.moeItemId);
      if (!item) { errors.push(`objective_missing:${objective.moeItemId}`); continue; }
      if (item.kind !== "OBJECTIVE") errors.push(`objective_not_objective:${objective.moeItemId}`);
      if (item.grade !== cell.grade || item.subject !== cell.subject) errors.push(`objective_scope_mismatch:${objective.moeItemId}`);
      if (item.topicKey !== unit.moeTopicKey) errors.push(`objective_wrong_unit:${objective.moeItemId}`);
      if (placed.has(objective.moeItemId)) errors.push(`objective_placed_twice:${objective.moeItemId}`);
      placed.set(objective.moeItemId, unit.id);
      for (const conceptId of objective.conceptIds) if (!conceptIds.has(conceptId)) errors.push(`objective_concept_unknown:${objective.moeItemId}:${conceptId}`);
      errors.push(...interactionErrors(objective, input));
    }
  }
  for (const item of cellItems.filter((entry) => entry.kind === "OBJECTIVE")) {
    if (!placed.has(item.id)) errors.push(`objective_unplaced:${item.id}`);
  }

  // 4. Every release concept is linked to MOE objectives or declared an extension.
  for (const concept of release.concepts) {
    const link = cell.conceptLinks.find((entry) => entry.conceptId === concept.id);
    if (!link) { errors.push(`concept_unlinked:${concept.id}`); continue; }
    if (!link.note.trim()) errors.push(`concept_link_note_required:${concept.id}`);
    if (link.basis === "MOE_OBJECTIVE" && !link.moeObjectiveIds.length) errors.push(`concept_link_empty:${concept.id}`);
    if (link.basis === "LIBERIALEARN_EXTENSION" && link.moeObjectiveIds.length) errors.push(`concept_extension_with_objectives:${concept.id}`);
    for (const id of link.moeObjectiveIds) if (!placed.has(id)) errors.push(`concept_link_objective_unplaced:${concept.id}:${id}`);
  }
  for (const link of cell.conceptLinks) if (!conceptIds.has(link.conceptId)) errors.push(`concept_link_unknown_concept:${link.conceptId}`);

  // 5. Lessons resolve to repository lesson authority and match the release content bindings.
  const cellLessonIds = new Set<string>();
  for (const unit of cell.units) {
    for (const lesson of unit.lessons) {
      if (cellLessonIds.has(lesson.contentId)) errors.push(`lesson_duplicate:${lesson.contentId}`);
      cellLessonIds.add(lesson.contentId);
      const repo = repoLessons.get(lesson.contentId);
      if (!repo) { errors.push(`lesson_missing:${lesson.contentId}`); continue; }
      if (repo.version !== lesson.version) errors.push(`lesson_version_mismatch:${lesson.contentId}`);
      if (repo.grade !== cell.grade || repo.subject !== cell.subject) errors.push(`lesson_scope_mismatch:${lesson.contentId}`);
      if (repo.authority !== lesson.authority) errors.push(`lesson_authority_mismatch:${lesson.contentId}`);
      const binding = release.contentBindings.find((entry) => entry.contentId === lesson.contentId);
      if (lesson.authority === "GOVERNED") {
        if (!binding) errors.push(`lesson_not_bound_in_release:${lesson.contentId}`);
        else if (binding.contentVersion !== lesson.version) errors.push(`lesson_release_version_mismatch:${lesson.contentId}`);
      } else {
        // A draft can never be executable authority.
        if (binding) errors.push(`draft_lesson_bound_in_release:${lesson.contentId}`);
        if (lesson.conceptIds.length) errors.push(`draft_lesson_claims_concepts:${lesson.contentId}`);
        if (lesson.components.some((component) => component.source === "GOVERNED_ITEM")) errors.push(`draft_lesson_uses_governed_item:${lesson.contentId}`);
      }
      for (const conceptId of lesson.conceptIds) if (!conceptIds.has(conceptId)) errors.push(`lesson_concept_unknown:${lesson.contentId}:${conceptId}`);
      for (const id of lesson.objectiveIds) if (placed.get(id) !== unit.id) errors.push(`lesson_objective_not_in_unit:${lesson.contentId}:${id}`);
      for (const component of lesson.components) {
        if (component.source === "LESSON_PAYLOAD" && !nonEmpty(repo.payload[component.ref])) errors.push(`component_payload_missing:${lesson.contentId}:${component.ref}`);
        if (component.source === "GOVERNED_ITEM") {
          const item = releaseItems.get(component.ref);
          if (!item) { errors.push(`component_item_missing:${lesson.contentId}:${component.ref}`); continue; }
          const bound = release.bindings.find((entry) => entry.itemId === item.id);
          if (!bound || !lesson.conceptIds.includes(bound.conceptId)) errors.push(`component_item_concept_mismatch:${lesson.contentId}:${component.ref}`);
          if ((component.kind === "DIAGNOSTIC") !== (item.context === "DIAGNOSTIC")) errors.push(`component_item_context_mismatch:${lesson.contentId}:${component.ref}`);
        }
      }
    }
  }
  for (const binding of release.contentBindings) if (!cellLessonIds.has(binding.contentId)) errors.push(`release_lesson_not_in_cell:${binding.contentId}`);

  // Coverage.
  const governedItemConcepts = new Set(release.bindings.map((binding) => binding.conceptId));
  const objectives: ObjectiveCoverage[] = cell.units.flatMap((unit) => unit.objectives.map((objective) => {
    const item = items.get(objective.moeItemId);
    const lessons = unit.lessons.filter((lesson) => lesson.objectiveIds.includes(objective.moeItemId));
    const governed = lessons.filter((lesson) => lesson.authority === "GOVERNED");
    const drafts = lessons.filter((lesson) => lesson.authority === "DRAFT_UNREVIEWED");
    const components = emptyComponents();
    for (const lesson of governed) for (const component of lesson.components) components[component.kind] += 1;
    const draftComponents = emptyComponents();
    for (const lesson of drafts) for (const component of lesson.components) draftComponents[component.kind] += 1;
    for (const conceptId of objective.conceptIds) {
      for (const binding of release.bindings.filter((entry) => entry.conceptId === conceptId)) {
        const kind = releaseItems.get(binding.itemId)?.context === "DIAGNOSTIC" ? "DIAGNOSTIC" : "PRACTICE";
        if (!governed.some((lesson) => lesson.components.some((component) => component.source === "GOVERNED_ITEM" && component.ref === binding.itemId))) components[kind] += 1;
      }
    }
    return {
      moeItemId: objective.moeItemId, unitId: unit.id, text: item?.text ?? "", pages: item?.provenance.pages ?? [],
      interaction: objective.interaction.need, interactionImplemented: interactionImplemented(objective.interaction, input),
      lessons: lessons.map((lesson) => lesson.contentId), governedLessons: governed.map((lesson) => lesson.contentId),
      draftLessons: drafts.map((lesson) => lesson.contentId), components, draftComponents, conceptIds: objective.conceptIds,
    };
  }));

  const componentCoverage = emptyComponents();
  const draftComponentCoverage = emptyComponents();
  for (const objective of objectives) {
    for (const kind of COMPONENT_KINDS) {
      if (objective.components[kind] > 0) componentCoverage[kind] += 1;
      if (objective.draftComponents[kind] > 0) draftComponentCoverage[kind] += 1;
    }
  }
  const interaction = Object.fromEntries((["NONE", "MANIPULATIVE_2D", "SIMULATION", "VIRTUAL_LAB", "PRACTICAL", "THREE_D"] as const).map((need) => [need, objectives.filter((o) => o.interaction === need).length])) as Record<InteractionNeed, number>;
  const topicItems = (topicKey: string, kind: StructuredCurriculumItem["kind"]) => cellItems.filter((item) => item.topicKey === topicKey && item.kind === kind);

  const teacherMetadata = cell.units.map((unit) => {
    const all = cellItems.filter((item) => item.topicKey === unit.moeTopicKey);
    return {
      unitId: unit.id, topic: all[0]?.topic ?? "", semester: all[0]?.semester ?? null, period: all[0]?.period ?? null,
      sourcePages: [...new Set(all.flatMap((item) => item.provenance.pages))].sort((a, b) => a - b),
      materials: topicItems(unit.moeTopicKey, "MATERIAL").map((item) => item.id),
      assessmentReferences: topicItems(unit.moeTopicKey, "ASSESSMENT_REFERENCE").map((item) => item.id),
      competencies: topicItems(unit.moeTopicKey, "COMPETENCY").map((item) => item.id),
      activities: topicItems(unit.moeTopicKey, "ACTIVITY").map((item) => item.id),
    };
  });

  // Live resolution (read-only snapshot).
  const missing: string[] = [];
  if (input.live) {
    // Only governed lessons are expected in production; drafts are never published by the cell.
    const governedIds = cell.units.flatMap((unit) => unit.lessons.filter((lesson) => lesson.authority === "GOVERNED").map((lesson) => lesson.contentId));
    for (const id of governedIds) if (!input.live.lessonContentIds.has(id)) missing.push(`lesson:${id}`);
    for (const binding of release.bindings) {
      if (!input.live.learningTargetCodes.has(binding.learningTargetCode)) missing.push(`learningTarget:${binding.learningTargetCode}`);
      if (!input.live.standardCodes.has(binding.standardCode)) missing.push(`standard:${binding.standardCode}`);
      if (!input.live.skillIds.has(binding.skillId)) missing.push(`skill:${binding.skillId}`);
    }
  }
  const uniqueMissing = [...new Set(missing)].sort();

  return {
    cellId: cell.id,
    releaseId: release.id,
    internallyExecutable: errors.length === 0,
    errors,
    objectives,
    summary: {
      moeObjectives: objectives.length,
      objectivesWithLesson: objectives.filter((o) => o.lessons.length).length,
      objectivesWithGovernedLesson: objectives.filter((o) => o.governedLessons.length).length,
      objectivesWithDraftLessonOnly: objectives.filter((o) => o.draftLessons.length && !o.governedLessons.length).length,
      objectivesWithGovernedItem: objectives.filter((o) => o.conceptIds.some((id) => governedItemConcepts.has(id))).length,
      componentCoverage,
      draftComponentCoverage,
      interaction,
      interactionImplemented: objectives.filter((o) => o.interaction !== "NONE" && o.interactionImplemented).length,
      interactionGaps: objectives.filter((o) => o.interaction !== "NONE" && !o.interactionImplemented).map((o) => `${o.moeItemId}:${o.interaction}`),
      resources: teacherMetadata.reduce((n, unit) => n + unit.materials.length, 0),
      teacherAssessmentReferences: teacherMetadata.reduce((n, unit) => n + unit.assessmentReferences.length, 0),
      moeActivities: teacherMetadata.reduce((n, unit) => n + unit.activities.length, 0),
    },
    teacherMetadata,
    live: {
      checked: !!input.live,
      capturedAt: input.live?.capturedAt ?? null,
      liveExecutable: !!input.live && errors.length === 0 && uniqueMissing.length === 0,
      missing: uniqueMissing,
      productionUnitsNotInCell: input.live ? input.live.unitIds.filter((id) => !unitIds.has(id)) : [],
    },
  };
}

function interactionErrors(objective: CellObjective, input: CertificationInput): string[] {
  const spec = objective.interaction;
  const id = objective.moeItemId;
  const errors: string[] = [];
  for (const tool of spec.tools) if (!input.toolIds.has(tool)) errors.push(`interaction_tool_missing:${id}:${tool}`);
  if (spec.labId && !input.labIds.has(spec.labId)) errors.push(`interaction_lab_missing:${id}:${spec.labId}`);
  if (spec.need === "NONE") {
    if (spec.tools.length || spec.labId) errors.push(`interaction_none_with_tools:${id}`);
    return errors;
  }
  if (!spec.rationale.trim()) errors.push(`interaction_rationale_required:${id}`);
  if (!spec.offlineFallback?.trim()) errors.push(`interaction_offline_fallback_required:${id}`);
  // Labs, simulations and 3D must produce learning evidence; decorative interaction is not a lab.
  if (["SIMULATION", "VIRTUAL_LAB", "THREE_D"].includes(spec.need) && spec.evidence === "NONE") errors.push(`interaction_evidence_required:${id}`);
  if (spec.need === "VIRTUAL_LAB" && !spec.labId) errors.push(`virtual_lab_requires_lab_engine:${id}`);
  if (spec.need === "PRACTICAL" && !spec.safety?.trim()) errors.push(`practical_safety_required:${id}`);
  if (spec.need === "THREE_D" && !/rotat|spatial|hidden|faces|view/i.test(spec.rationale)) errors.push(`three_d_rationale_not_spatial:${id}`);
  return errors;
}

function interactionImplemented(spec: InteractionSpec, input: CertificationInput): boolean {
  switch (spec.need) {
    case "NONE": return true;
    case "PRACTICAL": return !!spec.offlineFallback;
    case "VIRTUAL_LAB": return !!spec.labId && input.labIds.has(spec.labId);
    default: return spec.tools.length > 0 && spec.tools.every((tool) => input.toolIds.has(tool)) || (!!spec.labId && input.labIds.has(spec.labId));
  }
}

export type LiveGateCheck = Readonly<{ id: string; requirement: string; pass: boolean; detail: string }>;

/**
 * Live certification gate. A cell is live-certified only when every check
 * passes. Drafts never satisfy a governed requirement.
 */
export function liveCertificationChecklist(report: CellCertification): readonly LiveGateCheck[] {
  const total = report.summary.moeObjectives;
  const missingKind = (kinds: readonly ComponentKind[]) => report.objectives
    .filter((objective) => kinds.some((kind) => objective.components[kind] === 0))
    .map((objective) => objective.moeItemId);
  const errorsMatching = (pattern: RegExp) => report.errors.filter((error) => pattern.test(error));
  const check = (id: string, requirement: string, failures: readonly string[], ok = `${total}/${total}`): LiveGateCheck =>
    ({ id, requirement, pass: failures.length === 0, detail: failures.length ? `${failures.length} failing: ${failures.slice(0, 5).join(", ")}${failures.length > 5 ? ", ..." : ""}` : ok });
  return [
    check("governed-lessons", `${total}/${total} objectives have reviewed governed lessons`,
      report.objectives.filter((o) => !o.governedLessons.length).map((o) => o.moeItemId)),
    check("instruction-bindings", "classwork, homework and practice resolve from governed sources", missingKind(["CLASSWORK", "HOMEWORK", "PRACTICE"])),
    check("assessment-bindings", "quiz, diagnostic check and exit assessment resolve from governed sources", missingKind(["QUIZ", "DIAGNOSTIC", "ASSESSMENT"])),
    check("evidence-bindings", "evidence bindings and policies resolve", errorsMatching(/^(release_invalid|component_item|ontology)/), "release valid"),
    check("tool-policies", "ToolPolicies resolve to enabled toolkit tools", errorsMatching(/^tool_policy_/), "all keys mapped"),
    check("interaction", "interaction classifications resolve", errorsMatching(/^(interaction_|virtual_lab_|practical_|three_d_)/).filter((e) => !/offline/.test(e)), "all classified"),
    check("offline", "every interaction has a valid offline behavior", errorsMatching(/offline_fallback/), "all present"),
    check("release-live", "release references resolve in production", report.live.checked ? report.live.missing : ["live snapshot not checked"], "all present live"),
    check("no-draft-as-governed", "no draft artifact is treated as governed", errorsMatching(/^(draft_|lesson_authority_mismatch)/), "none"),
    check("no-moe-claim", "no MOE approval is claimed without recorded evidence", errorsMatching(/^moe_approval_claimed/), "NOT_CLAIMED"),
    check("internal", "cell is internally executable", report.errors, "no errors"),
  ];
}
