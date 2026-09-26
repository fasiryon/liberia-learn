/**
 * Curriculum authority cleanup plan (V1): pure, deterministic, no I/O.
 *
 * Input is a read-only production snapshot. Output is a plan of explicit
 * actions with before-images, plus a validator that simulates the plan on an
 * in-memory copy, re-measures every defect class, and simulates rollback.
 *
 * Lesson state changes are expressed as canonical governance events
 * (lib/curriculum/mutations/governanceWriter.ts), never as raw status writes:
 *   - duplicate non-survivor      -> SUPERSEDED (replacement = survivor revision)
 *   - status/payload conflict     -> RETURNED_FOR_REVIEW (status NEEDS_REVIEW)
 * Graph rows with no governed lifecycle (dangling LessonPrerequisite edges,
 * orphaned LessonVariant rows) are deleted with their full before-image kept
 * for rollback. Dangling unit links are repaired only when exactly one unit
 * matches grade, subject, sequence AND shares a title word with the key.
 * Otherwise the key is retained unchanged: CurriculumContent.unitId doubles
 * as the adaptive mastery grouping key (lib/adaptive/updateMastery.ts,
 * lib/adaptive/routeStuck.ts), so clearing it would regroup learner mastery.
 *
 * Retired duplicates are SUPERSEDED, never deleted, so every existing
 * reference keeps resolving. Only forward-looking bindings (policy REPOINT)
 * move to the survivor; history, ledgers and audit rows (RETAIN_HISTORY) stay
 * attached to the lesson a learner actually saw. A REPOINT binding whose
 * column is unique per lesson is retained when the survivor already owns one.
 */

export type SnapshotContent = Readonly<{
  id: string;
  contentId: string;
  title: string;
  grade: number;
  subject: string;
  canonicalSubject: string | null;
  status: string;
  unitId: string | null;
  payloadApprovalStatus: string | null;
  sectionCount: number;
  currentRevisionId: string | null;
  lastGovernance: "HUMAN_REVIEW" | "AUTOMATED_RISK_POLICY" | "REVOKED" | "NONE";
  updatedAt: string;
}>;

export type SnapshotReference = Readonly<{
  table: string;
  column: string;
  /** Which CurriculumContent key the column stores. */
  key: "id" | "contentId";
  value: string;
  rows: number;
  /** True when the table holds learner or teacher activity (never deleted). */
  learnerData: boolean;
  /** REPOINT: forward binding that should follow the survivor. RETAIN_HISTORY: immutable record of what happened. */
  policy: "REPOINT" | "RETAIN_HISTORY";
  /** True when the column alone is unique (at most one row per lesson). */
  uniquePerLesson: boolean;
}>;

export type SnapshotPrerequisite = Readonly<{ id: string; lessonId: string; prerequisiteLessonId: string }>;
export type SnapshotVariant = Readonly<{ id: string; lessonId: string; row: Readonly<Record<string, unknown>> }>;
export type SnapshotUnit = Readonly<{ id: string; unitId: string; grade: number; subject: string; title: string; sequence: number | null }>;

export type CurriculumSnapshot = Readonly<{
  capturedAt: string;
  database: Readonly<{ db: string; addr: string | null }>;
  contents: readonly SnapshotContent[];
  references: readonly SnapshotReference[];
  prerequisites: readonly SnapshotPrerequisite[];
  variants: readonly SnapshotVariant[];
  units: readonly SnapshotUnit[];
}>;

export type CleanupAction =
  | Readonly<{ kind: "SUPERSEDE_DUPLICATE"; key: string; contentPk: string; contentId: string; survivorPk: string; survivorContentId: string; survivorRevisionId: string | null; groupKey: string; before: SnapshotContent }>
  | Readonly<{ kind: "REPOINT_REFERENCE"; key: string; table: string; column: string; from: string; to: string; rows: number; learnerData: boolean }>
  | Readonly<{ kind: "RETURN_FOR_REVIEW"; key: string; contentPk: string; contentId: string; fromStatus: string; payloadApprovalStatus: string; before: SnapshotContent }>
  | Readonly<{ kind: "DELETE_DANGLING_PREREQUISITE"; key: string; edge: SnapshotPrerequisite; missing: ("lesson" | "prerequisite")[] }>
  | Readonly<{ kind: "REPOINT_PREREQUISITE"; key: string; edge: SnapshotPrerequisite; to: SnapshotPrerequisite }>
  | Readonly<{ kind: "DELETE_DUPLICATE_PREREQUISITE"; key: string; edge: SnapshotPrerequisite; reason: "self_loop" | "duplicate_after_repoint" }>
  | Readonly<{ kind: "DELETE_ORPHAN_VARIANT"; key: string; variant: SnapshotVariant }>
  | Readonly<{ kind: "REPAIR_UNIT_LINK"; key: string; contentPk: string; contentId: string; fromUnitId: string; toUnitId: string; rule: string }>
  | Readonly<{ kind: "RETAIN_UNIT_KEY"; key: string; contentPk: string; contentId: string; fromUnitId: string; reason: "no_verified_unit_match" }>;

export type DuplicateGroupDecision = Readonly<{
  groupKey: string;
  survivor: Readonly<{ contentPk: string; contentId: string; reasons: readonly string[] }>;
  retired: readonly Readonly<{ contentPk: string; contentId: string }>[];
}>;

export type RetainedReference = Readonly<{
  table: string;
  column: string;
  value: string;
  rows: number;
  retiredContentId: string;
  reason: "history_preserved" | "unique_binding_survivor_already_bound";
}>;

export type CleanupPlan = Readonly<{
  planVersion: "1.0.0";
  snapshotCapturedAt: string;
  database: CurriculumSnapshot["database"];
  duplicateGroups: readonly DuplicateGroupDecision[];
  actions: readonly CleanupAction[];
  retainedReferences: readonly RetainedReference[];
  counts: Readonly<Record<CleanupAction["kind"], number>>;
  learnerImpact: Readonly<{
    lessonsLeavingLearnerView: number;
    cellsLosingAllVisibleLessons: readonly string[];
    learnerReferenceRowsRepointed: number;
  }>;
}>;

const APPROVED = /^(approved|published)$/i;
const PENDING_PAYLOAD = /NEEDS_REVIEW|PENDING/i;
const VISIBLE = (status: string) => APPROVED.test(status);

export function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

const cellOf = (content: SnapshotContent) => content.canonicalSubject ? `${content.grade}|${content.canonicalSubject}` : null;

function referenceRowsFor(content: SnapshotContent, references: readonly SnapshotReference[]) {
  return references.filter((ref) => (ref.key === "id" ? ref.value === content.id : ref.value === content.contentId));
}

/**
 * Survivor ranking, strongest first:
 *   1. human-reviewed governance approval
 *   2. learner/teacher activity rows attached (moving them is avoided)
 *   3. all reference rows attached
 *   4. payload completeness (non-empty lesson sections)
 *   5. learner-visible status
 *   6. most recently updated
 *   7. contentId (stable tiebreak)
 */
function rankSurvivor(group: readonly SnapshotContent[], references: readonly SnapshotReference[]) {
  const scored = group.map((content) => {
    const refs = referenceRowsFor(content, references);
    return {
      content,
      human: content.lastGovernance === "HUMAN_REVIEW" ? 1 : 0,
      learnerRows: refs.filter((ref) => ref.learnerData).reduce((total, ref) => total + ref.rows, 0),
      refRows: refs.reduce((total, ref) => total + ref.rows, 0),
      sections: content.sectionCount,
      visible: VISIBLE(content.status) ? 1 : 0,
      updatedAt: content.updatedAt,
    };
  });
  scored.sort((a, b) =>
    b.human - a.human || b.learnerRows - a.learnerRows || b.refRows - a.refRows || b.sections - a.sections ||
    b.visible - a.visible || b.updatedAt.localeCompare(a.updatedAt) || a.content.contentId.localeCompare(b.content.contentId));
  const top = scored[0]!;
  const reasons = [
    top.human ? "human_review_approval" : null,
    `learner_rows=${top.learnerRows}`,
    `reference_rows=${top.refRows}`,
    `sections=${top.sections}`,
    top.visible ? "learner_visible" : "not_learner_visible",
    `updatedAt=${top.updatedAt}`,
  ].filter((reason): reason is string => !!reason);
  return { survivor: top.content, reasons, ordered: scored.map((entry) => entry.content) };
}

const STOP = new Set(["unit", "draft", "phase", "and", "the", "with", "from", "into", "for"]);
const words = (value: string) => new Set(value.toLowerCase().split(/[^a-z]+/).filter((word) => word.length >= 4 && !STOP.has(word)));

/**
 * Deterministic unit repair: a dangling key shaped like
 * `<subject>-g<grade>-<n>-<topic>` maps to the unit with the same grade,
 * canonical subject and sequence n, when exactly one exists AND its title
 * shares a topic word with the key. Sequence alone is not evidence: the
 * year-map units reuse sequence numbers for unrelated topics.
 */
function unitRepair(content: SnapshotContent, units: readonly SnapshotUnit[]): { toUnitId: string; rule: string } | null {
  const match = content.unitId?.match(/^[a-z_]+-g(\d{1,2})-(\d{1,2})-(.+)$/i);
  if (!match || !content.canonicalSubject) return null;
  const grade = Number(match[1]);
  const sequence = Number(match[2]);
  if (grade !== content.grade) return null;
  const topic = words(match[3]!);
  const candidates = units.filter((unit) => unit.grade === grade && unit.subject.toUpperCase() === content.canonicalSubject && unit.sequence === sequence &&
    [...words(unit.title)].some((word) => topic.has(word)));
  if (candidates.length !== 1) return null;
  return { toUnitId: candidates[0]!.unitId, rule: `grade=${grade},subject=${content.canonicalSubject},sequence=${sequence},title_overlap` };
}

export function buildCleanupPlan(snapshot: CurriculumSnapshot): CleanupPlan {
  const actions: CleanupAction[] = [];
  const byPk = new Map(snapshot.contents.map((content) => [content.id, content]));

  // 1. Duplicates: same in-scope cell + normalized title.
  const groups = new Map<string, SnapshotContent[]>();
  for (const content of snapshot.contents) {
    const cell = cellOf(content);
    if (!cell || !normalizeTitle(content.title)) continue;
    const groupKey = `${cell}|${normalizeTitle(content.title)}`;
    groups.set(groupKey, [...(groups.get(groupKey) ?? []), content]);
  }
  const duplicateGroups: DuplicateGroupDecision[] = [];
  const retiredToSurvivor = new Map<string, SnapshotContent>(); // pk -> survivor
  const retainedReferences: RetainedReference[] = [];
  for (const [groupKey, group] of [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (group.length < 2) continue;
    const { survivor, reasons, ordered } = rankSurvivor(group, snapshot.references);
    const retired = ordered.filter((content) => content.id !== survivor.id);
    duplicateGroups.push({ groupKey, survivor: { contentPk: survivor.id, contentId: survivor.contentId, reasons }, retired: retired.map((content) => ({ contentPk: content.id, contentId: content.contentId })) });
    for (const content of retired) {
      retiredToSurvivor.set(content.id, survivor);
      actions.push({ kind: "SUPERSEDE_DUPLICATE", key: `supersede:${content.id}`, contentPk: content.id, contentId: content.contentId, survivorPk: survivor.id, survivorContentId: survivor.contentId, survivorRevisionId: survivor.currentRevisionId, groupKey, before: content });
      const survivorRefs = referenceRowsFor(survivor, snapshot.references);
      for (const ref of referenceRowsFor(content, snapshot.references)) {
        if (ref.policy === "RETAIN_HISTORY") {
          retainedReferences.push({ table: ref.table, column: ref.column, value: ref.value, rows: ref.rows, retiredContentId: content.contentId, reason: "history_preserved" });
          continue;
        }
        if (ref.uniquePerLesson && survivorRefs.some((other) => other.table === ref.table && other.column === ref.column)) {
          retainedReferences.push({ table: ref.table, column: ref.column, value: ref.value, rows: ref.rows, retiredContentId: content.contentId, reason: "unique_binding_survivor_already_bound" });
          continue;
        }
        actions.push({ kind: "REPOINT_REFERENCE", key: `repoint:${ref.table}.${ref.column}:${ref.value}`, table: ref.table, column: ref.column, from: ref.value, to: ref.key === "id" ? survivor.id : survivor.contentId, rows: ref.rows, learnerData: ref.learnerData });
      }
    }
  }

  // 2. Status/payload conflicts (skip rows already superseded).
  for (const content of snapshot.contents) {
    if (retiredToSurvivor.has(content.id)) continue;
    if (VISIBLE(content.status) && PENDING_PAYLOAD.test(content.payloadApprovalStatus ?? "") && content.lastGovernance !== "HUMAN_REVIEW") {
      actions.push({ kind: "RETURN_FOR_REVIEW", key: `review:${content.id}`, contentPk: content.id, contentId: content.contentId, fromStatus: content.status, payloadApprovalStatus: content.payloadApprovalStatus!, before: content });
    }
  }

  // 3. Prerequisite graph.
  const seenEdges = new Set<string>();
  for (const edge of [...snapshot.prerequisites].sort((a, b) => a.id.localeCompare(b.id))) {
    const missing: ("lesson" | "prerequisite")[] = [];
    if (!byPk.has(edge.lessonId)) missing.push("lesson");
    if (!byPk.has(edge.prerequisiteLessonId)) missing.push("prerequisite");
    if (missing.length) {
      actions.push({ kind: "DELETE_DANGLING_PREREQUISITE", key: `edge-delete:${edge.id}`, edge, missing });
      continue;
    }
    const to = {
      ...edge,
      lessonId: retiredToSurvivor.get(edge.lessonId)?.id ?? edge.lessonId,
      prerequisiteLessonId: retiredToSurvivor.get(edge.prerequisiteLessonId)?.id ?? edge.prerequisiteLessonId,
    };
    const pair = `${to.lessonId}->${to.prerequisiteLessonId}`;
    if (to.lessonId === to.prerequisiteLessonId) {
      actions.push({ kind: "DELETE_DUPLICATE_PREREQUISITE", key: `edge-dup:${edge.id}`, edge, reason: "self_loop" });
    } else if (seenEdges.has(pair)) {
      actions.push({ kind: "DELETE_DUPLICATE_PREREQUISITE", key: `edge-dup:${edge.id}`, edge, reason: "duplicate_after_repoint" });
    } else {
      seenEdges.add(pair);
      if (to.lessonId !== edge.lessonId || to.prerequisiteLessonId !== edge.prerequisiteLessonId) {
        actions.push({ kind: "REPOINT_PREREQUISITE", key: `edge-repoint:${edge.id}`, edge, to });
      }
    }
  }

  // 4. Orphaned variants.
  for (const variant of [...snapshot.variants].sort((a, b) => a.id.localeCompare(b.id))) {
    if (!byPk.has(variant.lessonId)) actions.push({ kind: "DELETE_ORPHAN_VARIANT", key: `variant-delete:${variant.id}`, variant });
  }

  // 5. Dangling unit links.
  const unitKeys = new Set(snapshot.units.map((unit) => unit.unitId));
  // Superseded duplicates are included: they stay in the table and keep their unit key.
  for (const content of snapshot.contents) {
    if (!content.unitId || unitKeys.has(content.unitId)) continue;
    const repair = unitRepair(content, snapshot.units);
    if (repair) actions.push({ kind: "REPAIR_UNIT_LINK", key: `unit:${content.id}`, contentPk: content.id, contentId: content.contentId, fromUnitId: content.unitId, toUnitId: repair.toUnitId, rule: repair.rule });
    else actions.push({ kind: "RETAIN_UNIT_KEY", key: `unit:${content.id}`, contentPk: content.id, contentId: content.contentId, fromUnitId: content.unitId, reason: "no_verified_unit_match" });
  }

  // Learner impact.
  const leaving = new Set(actions.flatMap((action) =>
    (action.kind === "SUPERSEDE_DUPLICATE" || action.kind === "RETURN_FOR_REVIEW") && VISIBLE(action.before.status) ? [action.contentPk] : []));
  const visibleByCell = new Map<string, number>();
  const leavingByCell = new Map<string, number>();
  for (const content of snapshot.contents) {
    const cell = cellOf(content);
    if (!cell || !VISIBLE(content.status)) continue;
    visibleByCell.set(cell, (visibleByCell.get(cell) ?? 0) + 1);
    if (leaving.has(content.id)) leavingByCell.set(cell, (leavingByCell.get(cell) ?? 0) + 1);
  }
  const cellsLosingAll = [...visibleByCell.entries()].filter(([cell, n]) => (leavingByCell.get(cell) ?? 0) === n).map(([cell]) => cell).sort();

  const kinds: CleanupAction["kind"][] = ["SUPERSEDE_DUPLICATE", "REPOINT_REFERENCE", "RETURN_FOR_REVIEW", "DELETE_DANGLING_PREREQUISITE", "REPOINT_PREREQUISITE", "DELETE_DUPLICATE_PREREQUISITE", "DELETE_ORPHAN_VARIANT", "REPAIR_UNIT_LINK", "RETAIN_UNIT_KEY"];
  return {
    planVersion: "1.0.0",
    snapshotCapturedAt: snapshot.capturedAt,
    database: snapshot.database,
    duplicateGroups,
    actions,
    retainedReferences: retainedReferences.sort((a, b) => `${a.table}.${a.column}:${a.value}`.localeCompare(`${b.table}.${b.column}:${b.value}`)),
    counts: Object.fromEntries(kinds.map((kind) => [kind, actions.filter((action) => action.kind === kind).length])) as Record<CleanupAction["kind"], number>,
    learnerImpact: {
      lessonsLeavingLearnerView: leaving.size,
      cellsLosingAllVisibleLessons: cellsLosingAll,
      learnerReferenceRowsRepointed: actions.reduce((total, action) => total + (action.kind === "REPOINT_REFERENCE" && action.learnerData ? action.rows : 0), 0),
    },
  };
}

// ---------------------------------------------------------------------------
// Validation: simulate apply on a copy, re-measure, simulate rollback.
// ---------------------------------------------------------------------------

type MutableState = {
  contents: Map<string, SnapshotContent>;
  references: Map<string, SnapshotReference>;
  prerequisites: Map<string, SnapshotPrerequisite>;
  variants: Map<string, SnapshotVariant>;
};

const refKey = (ref: Pick<SnapshotReference, "table" | "column" | "value">) => `${ref.table}.${ref.column}:${ref.value}`;

function stateOf(snapshot: CurriculumSnapshot): MutableState {
  return {
    contents: new Map(snapshot.contents.map((content) => [content.id, { ...content }])),
    references: new Map(snapshot.references.map((ref) => [refKey(ref), { ...ref }])),
    prerequisites: new Map(snapshot.prerequisites.map((edge) => [edge.id, { ...edge }])),
    variants: new Map(snapshot.variants.map((variant) => [variant.id, { ...variant }])),
  };
}

type Undo = () => void;

function applyAction(state: MutableState, action: CleanupAction): Undo {
  switch (action.kind) {
    case "SUPERSEDE_DUPLICATE": {
      const before = state.contents.get(action.contentPk)!;
      state.contents.set(action.contentPk, { ...before, status: "SUPERSEDED" });
      return () => state.contents.set(action.contentPk, before);
    }
    case "RETURN_FOR_REVIEW": {
      const before = state.contents.get(action.contentPk)!;
      state.contents.set(action.contentPk, { ...before, status: "NEEDS_REVIEW" });
      return () => state.contents.set(action.contentPk, before);
    }
    case "REPOINT_REFERENCE": {
      const fromKey = refKey({ table: action.table, column: action.column, value: action.from });
      const before = state.references.get(fromKey)!;
      const toKey = refKey({ table: action.table, column: action.column, value: action.to });
      const existing = state.references.get(toKey);
      state.references.delete(fromKey);
      state.references.set(toKey, { ...before, value: action.to, rows: before.rows + (existing?.rows ?? 0) });
      return () => {
        if (existing) state.references.set(toKey, existing); else state.references.delete(toKey);
        state.references.set(fromKey, before);
      };
    }
    case "DELETE_DANGLING_PREREQUISITE":
    case "DELETE_DUPLICATE_PREREQUISITE": {
      const before = state.prerequisites.get(action.edge.id)!;
      state.prerequisites.delete(action.edge.id);
      return () => state.prerequisites.set(action.edge.id, before);
    }
    case "REPOINT_PREREQUISITE": {
      const before = state.prerequisites.get(action.edge.id)!;
      state.prerequisites.set(action.edge.id, action.to);
      return () => state.prerequisites.set(action.edge.id, before);
    }
    case "DELETE_ORPHAN_VARIANT": {
      const before = state.variants.get(action.variant.id)!;
      state.variants.delete(action.variant.id);
      return () => state.variants.set(action.variant.id, before);
    }
    case "REPAIR_UNIT_LINK": {
      const before = state.contents.get(action.contentPk)!;
      state.contents.set(action.contentPk, { ...before, unitId: action.toUnitId });
      return () => state.contents.set(action.contentPk, before);
    }
    case "RETAIN_UNIT_KEY":
      return () => undefined;
  }
}

export type DefectCounts = Readonly<{
  statusPayloadConflicts: number;
  duplicateVisibleRows: number;
  danglingPrerequisites: number;
  orphanVariants: number;
  danglingUnitLinks: number;
  /** Dangling unit keys the plan does not explicitly retain. */
  unaccountedUnitLinks: number;
  referencesToRetiredLessons: number;
}>;

function measure(state: MutableState, units: readonly SnapshotUnit[], retained: ReadonlySet<string> = new Set(), retainedUnitKeys: ReadonlySet<string> = new Set()): DefectCounts {
  const contents = [...state.contents.values()];
  const live = new Set(contents.map((content) => content.id));
  const unitKeys = new Set(units.map((unit) => unit.unitId));
  const visibleGroups = new Map<string, number>();
  for (const content of contents) {
    const cell = cellOf(content);
    if (!cell || !VISIBLE(content.status) || !normalizeTitle(content.title)) continue;
    const key = `${cell}|${normalizeTitle(content.title)}`;
    visibleGroups.set(key, (visibleGroups.get(key) ?? 0) + 1);
  }
  const retired = new Set(contents.filter((content) => content.status === "SUPERSEDED").flatMap((content) => [content.id, content.contentId]));
  return {
    statusPayloadConflicts: contents.filter((content) => VISIBLE(content.status) && PENDING_PAYLOAD.test(content.payloadApprovalStatus ?? "") && content.lastGovernance !== "HUMAN_REVIEW").length,
    duplicateVisibleRows: [...visibleGroups.values()].filter((n) => n > 1).reduce((total, n) => total + n, 0),
    danglingPrerequisites: [...state.prerequisites.values()].filter((edge) => !live.has(edge.lessonId) || !live.has(edge.prerequisiteLessonId)).length,
    orphanVariants: [...state.variants.values()].filter((variant) => !live.has(variant.lessonId)).length,
    danglingUnitLinks: contents.filter((content) => content.unitId && !unitKeys.has(content.unitId)).length,
    unaccountedUnitLinks: contents.filter((content) => content.unitId && !unitKeys.has(content.unitId) && !retainedUnitKeys.has(content.id)).length,
    // Forward bindings still pointing at a retired lesson, excluding ones the plan retains on purpose.
    referencesToRetiredLessons: [...state.references.values()].filter((ref) => ref.policy === "REPOINT" && retired.has(ref.value) && !retained.has(refKey(ref))).length,
  };
}

function canonical(state: MutableState): string {
  const sorted = <T>(map: Map<string, T>) => [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify({ c: sorted(state.contents), r: sorted(state.references), p: sorted(state.prerequisites), v: sorted(state.variants) });
}

export type PlanValidation = Readonly<{
  ok: boolean;
  errors: readonly string[];
  before: DefectCounts;
  after: DefectCounts;
  rollbackRestoresSnapshot: boolean;
}>;

export function validateCleanupPlan(plan: CleanupPlan, snapshot: CurriculumSnapshot): PlanValidation {
  const errors: string[] = [];
  const keys = new Set<string>();
  const state = stateOf(snapshot);
  const pristine = canonical(state);
  const before = measure(state, snapshot.units);

  for (const action of plan.actions) {
    if (keys.has(action.key)) errors.push(`duplicate_action_key:${action.key}`);
    keys.add(action.key);
  }
  for (const group of plan.duplicateGroups) {
    if (group.retired.some((entry) => entry.contentPk === group.survivor.contentPk)) errors.push(`survivor_also_retired:${group.groupKey}`);
    if (!state.contents.has(group.survivor.contentPk)) errors.push(`survivor_missing:${group.groupKey}`);
  }
  const retiredPks = new Set(plan.actions.flatMap((action) => action.kind === "SUPERSEDE_DUPLICATE" ? [action.contentPk] : []));
  for (const action of plan.actions) {
    if (action.kind === "SUPERSEDE_DUPLICATE" && retiredPks.has(action.survivorPk)) errors.push(`survivor_is_retired:${action.key}`);
    if (action.kind === "REPOINT_REFERENCE" && [...retiredPks].some((pk) => pk === action.to || state.contents.get(pk)?.contentId === action.to)) errors.push(`repoint_targets_retired:${action.key}`);
    if ((action.kind === "SUPERSEDE_DUPLICATE" || action.kind === "RETURN_FOR_REVIEW") && !state.contents.has(action.contentPk)) errors.push(`target_missing:${action.key}`);
  }

  const undo: Undo[] = [];
  for (const action of plan.actions) {
    try { undo.push(applyAction(state, action)); } catch (error) { errors.push(`apply_failed:${action.key}:${error instanceof Error ? error.message : String(error)}`); }
  }
  const retainedUnitKeys = new Set(plan.actions.flatMap((action) => action.kind === "RETAIN_UNIT_KEY" ? [action.contentPk] : []));
  const after = measure(state, snapshot.units, new Set(plan.retainedReferences.map(refKey)), retainedUnitKeys);
  if (after.statusPayloadConflicts !== 0) errors.push(`residual_conflicts:${after.statusPayloadConflicts}`);
  if (after.duplicateVisibleRows !== 0) errors.push(`residual_duplicates:${after.duplicateVisibleRows}`);
  if (after.danglingPrerequisites !== 0) errors.push(`residual_dangling_prerequisites:${after.danglingPrerequisites}`);
  if (after.orphanVariants !== 0) errors.push(`residual_orphan_variants:${after.orphanVariants}`);
  if (after.unaccountedUnitLinks !== 0) errors.push(`residual_dangling_unit_links:${after.unaccountedUnitLinks}`);
  if (after.referencesToRetiredLessons !== 0) errors.push(`residual_references_to_retired:${after.referencesToRetiredLessons}`);

  for (const step of undo.reverse()) step();
  const rollbackRestoresSnapshot = canonical(state) === pristine;
  if (!rollbackRestoresSnapshot) errors.push("rollback_does_not_restore_snapshot");
  return { ok: errors.length === 0, errors, before, after, rollbackRestoresSnapshot };
}
