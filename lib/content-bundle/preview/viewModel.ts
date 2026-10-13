/**
 * Teacher Preview display models. Pure, serializable and client-safe (no hashing, no I/O).
 *
 * Two models with a hard boundary:
 *   - TeacherPreviewModel is built from the full sealed bundle plus resolver facts.
 *   - StudentPreviewModel is built ONLY from the LearnerContentBundle projection.
 *     It never sees the full bundle, so teacher notes,
 *     answer keys, scoring guides, prohibited tools, internal tool configuration and governance
 *     internals cannot reach Student View even by a rendering mistake.
 *
 * Neither model decides release, certification or toolkit review; they display resolver facts.
 */
import type {
  ActivityDefinition,
  AssessmentReference,
  ContentBundleV1,
  GovernedItemKind,
  LabBinding,
  LessonReference,
  RenderingKind,
  ResourceReference,
  SequenceUnit,
  ToolkitBinding,
  ToolkitBindingMode,
} from "../v1/types";
import type { LearnerContentBundle } from "../v1/projection";
import { activityExperienceOf, PROFILE_LABELS, type ActivityExperienceV1, type LearnerActivityExperience } from "../v1/activityExperience";
import type { LabReadiness, ReleaseStatus, ResolvedContentBundlePreview, PreviewSource } from "./resolver";

// ─── Shared shapes ──────────────────────────────────────────────────────────────────────────────

export type MemberCategory = "LESSON" | "ACTIVITY" | "ASSESSMENT" | "LAB";
export type ItemLink = Readonly<{ itemId: string; title: string }>;
export type SequencePlacement = Readonly<{
  unitId: string;
  unitTitle: string;
  order: number;
  requirement: "REQUIRED" | "OPTIONAL";
  prerequisites: readonly ItemLink[];
  unlocks: readonly ItemLink[];
}>;
export type NavItem = Readonly<{ itemId: string; title: string; itemKind: GovernedItemKind; category: MemberCategory; requirement: "REQUIRED" | "OPTIONAL" | null }>;
export type NavGroup = Readonly<{ groupId: string; title: string; items: readonly NavItem[] }>;
export type ResourceRow = Readonly<{ resourceId: string; resourceVersion: string; title: string; kind: string; audience: string | null; offline: boolean }>;
export type RenderingRow = Readonly<{ kind: RenderingKind; label: string; available: boolean; audience: string | null; artifactVersion: string | null }>;
export type SupportRow = Readonly<{ supportId: string; objectiveIds: readonly string[]; items: readonly ItemLink[]; resources: readonly string[] }>;

const RENDERING_KINDS: readonly RenderingKind[] = ["TEXTBOOK", "WORKBOOK", "TEACHER_GUIDE", "ASSESSMENT_BOOK"];
const RENDERING_LABELS: Readonly<Record<RenderingKind, string>> = { TEXTBOOK: "Textbook", WORKBOOK: "Workbook", TEACHER_GUIDE: "Teacher guide", ASSESSMENT_BOOK: "Assessment book" };

/** "SMALL_GROUP" → "Small group". Display only; never parsed back. */
export function humanize(value: string): string {
  const words = value.replace(/[_-]+/g, " ").trim().toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function categoryOf(kind: GovernedItemKind): MemberCategory {
  if (kind === "LESSON" || kind === "LAB") return kind;
  return kind === "QUIZ" || kind === "ASSESSMENT" ? "ASSESSMENT" : "ACTIVITY";
}

type AnyMember = Readonly<{ identity: Readonly<{ itemId: string; itemVersion: string; itemKind: GovernedItemKind }>; title?: string }>;

function memberTitle(member: AnyMember, labTitle: (lab: LabBinding) => string): string {
  if ("title" in member && typeof member.title === "string") return member.title;
  return labTitle(member as LabBinding);
}

/** Labs carry no title in the contract; name them by lab identity rather than inventing one. */
const labDisplayTitle = (lab: Readonly<{ lab: Readonly<{ labId: string; labVersion: string }> }>) => `Lab ${lab.lab.labId}`;

function buildSequence(units: readonly SequenceUnit[], titleOf: (itemId: string) => string) {
  const placements = new Map<string, SequencePlacement>();
  const link = (itemId: string): ItemLink => ({ itemId, title: titleOf(itemId) });
  for (const unit of [...units].sort((a, b) => a.order - b.order)) {
    for (const entry of unit.entries) {
      placements.set(entry.itemId, {
        unitId: unit.unitId,
        unitTitle: unit.title,
        order: entry.order,
        requirement: entry.requirement,
        prerequisites: entry.prerequisiteItemIds.map(link),
        unlocks: entry.unlocksItemIds.map(link),
      });
    }
  }
  return placements;
}

function buildNav(units: readonly SequenceUnit[], members: readonly AnyMember[], titleOf: (itemId: string) => string): NavGroup[] {
  const kindOf = new Map(members.map((m) => [m.identity.itemId, m.identity.itemKind]));
  const sequenced = new Set<string>();
  const groups: NavGroup[] = [...units]
    .sort((a, b) => a.order - b.order)
    .map((unit) => ({
      groupId: unit.unitId,
      title: unit.title,
      items: [...unit.entries]
        .sort((a, b) => a.order - b.order)
        .filter((entry) => kindOf.has(entry.itemId))
        .map((entry) => {
          sequenced.add(entry.itemId);
          const kind = kindOf.get(entry.itemId)!;
          return { itemId: entry.itemId, title: titleOf(entry.itemId), itemKind: kind, category: categoryOf(kind), requirement: entry.requirement };
        }),
    }));
  const loose = members.filter((m) => !sequenced.has(m.identity.itemId));
  if (loose.length > 0) {
    groups.push({
      groupId: "__unsequenced",
      title: "Not in the sequence",
      items: loose.map((m) => ({ itemId: m.identity.itemId, title: titleOf(m.identity.itemId), itemKind: m.identity.itemKind, category: categoryOf(m.identity.itemKind), requirement: null })),
    });
  }
  return groups;
}

// ─── Teacher model ──────────────────────────────────────────────────────────────────────────────

export type TeacherToolRow = Readonly<{
  toolId: string;
  mode: ToolkitBindingMode;
  scope: string;
  configuration: readonly Readonly<{ key: string; value: string }>[];
  context: string | null;
  runtimeTools: readonly string[];
}>;

export type TeacherItemTool = Readonly<{ toolId: string; effectiveMode: ToolkitBindingMode; sources: readonly string[] }>;

export type TeacherInstruction = Readonly<{ stepId: string; text: string; resources: readonly string[] }>;

export type TeacherMemberDetail =
  | Readonly<{ category: "LESSON"; estimatedMinutes: number; resources: readonly ResourceRow[] }>
  | Readonly<{
      category: "ACTIVITY";
      activityType: string;
      /** "Guided practice", "Classwork", ... from the experience profile; null without one. */
      profileLabel: string | null;
      expectedDurationMinutes: number;
      collaborationMode: string;
      scaffolding: string | null;
      evidence: string;
      learnerInstructions: readonly TeacherInstruction[];
      teacherInstructions: readonly TeacherInstruction[];
      rubric: Readonly<{ rubricId: string; rubricVersion: string; criteria: readonly string[]; scoringGuide: string | null }> | null;
      extendsLessons: readonly ItemLink[];
      resources: readonly ResourceRow[];
      /** Full experience, teacher section included. Teacher model only. */
      experience: ActivityExperienceV1 | null;
    }>
  | Readonly<{
      category: "ASSESSMENT";
      role: string;
      definitionId: string;
      definitionVersion: string;
      itemCount: number;
      itemOrder: string;
      learnerInstructions: readonly string[];
      answerKey: string | null;
      scoringGuide: string | null;
    }>
  | Readonly<{
      category: "LAB";
      linkId: string;
      linkRevision: string;
      labId: string;
      labVersion: string;
      role: string;
      placement: string;
      authorityBasis: string;
      readiness: LabReadiness;
      runnable: boolean;
    }>;

export type TeacherMember = Readonly<{
  itemId: string;
  itemVersion: string;
  itemKind: GovernedItemKind;
  category: MemberCategory;
  title: string;
  objectiveIds: readonly string[];
  sequence: SequencePlacement | null;
  tools: readonly TeacherItemTool[];
  detail: TeacherMemberDetail;
}>;

/** What Student View will not carry, by category. Counts and labels only, never the content. */
export type WithheldRow = Readonly<{ label: string; count: number }>;

export type TeacherPreviewModel = Readonly<{
  header: Readonly<{ bundleId: string; title: string; gradeLevel: number; subject: string; version: string; locale: string; contentHash: string }>;
  source: PreviewSource;
  release: ReleaseStatus;
  objectives: readonly Readonly<{ objectiveId: string; description: string; boundItems: readonly ItemLink[] }>[];
  standards: readonly string[];
  authority: Readonly<{ releaseId: string; releaseIdentity: string; sourceVersionRefs: readonly string[]; conceptRefs: readonly string[]; constructBindingRefs: readonly string[] }>;
  nav: readonly NavGroup[];
  members: readonly TeacherMember[];
  resources: readonly ResourceRow[];
  tools: readonly TeacherToolRow[];
  toolkitMapping: Readonly<{ pinned: string | null; checkedAgainst: string | null; reviewed: boolean | null; issues: readonly string[] }>;
  learnerSupport: Readonly<{ remediation: readonly SupportRow[]; enrichment: readonly SupportRow[]; accommodations: readonly string[]; languageVariants: readonly string[] }>;
  renderings: readonly RenderingRow[];
  offline: Readonly<{
    ready: boolean;
    packageable: boolean;
    capabilities: readonly string[];
    reconnectRequiredFor: readonly string[];
    maxOfflineDays: number | null;
    learnerAssets: Readonly<{ count: number; bytes: number }>;
    staffOnlyAssets: Readonly<{ count: number; bytes: number }>;
    pins: Readonly<{ bundle: string; contentHash: string; releaseIdentity: string; projectionVersion: string; members: readonly string[]; assets: readonly string[] }>;
  }>;
  governance: Readonly<{ provenanceRefs: readonly string[]; reviewRefs: readonly string[]; lifecycleRefs: readonly string[]; releaseRefs: readonly string[] }>;
  withheldFromStudents: readonly WithheldRow[];
}>;

const configRows = (config: Readonly<Record<string, string | number | boolean>>) =>
  Object.keys(config).sort().map((key) => ({ key, value: String(config[key]) }));

const scopeLabel = (binding: ToolkitBinding, titleOf: (itemId: string) => string) =>
  binding.scope.kind === "BUNDLE" ? "Whole bundle" : `Only: ${titleOf(binding.scope.itemId)}`;

/** Documented composition rule (CONTENT_BUNDLE_V1_FOUNDATION): an item may narrow a bundle-wide tool; prohibition wins. */
function itemTools(bindings: readonly ToolkitBinding[], itemId: string): TeacherItemTool[] {
  const applicable = bindings.filter((b) => b.scope.kind === "BUNDLE" || b.scope.itemId === itemId);
  const toolIds = [...new Set(applicable.map((b) => b.toolId))].sort();
  return toolIds.map((toolId) => {
    const forTool = applicable.filter((b) => b.toolId === toolId);
    const itemScoped = forTool.find((b) => b.scope.kind === "ITEM");
    const effectiveMode: ToolkitBindingMode = forTool.some((b) => b.mode === "PROHIBITED") ? "PROHIBITED" : (itemScoped ?? forTool[0]).mode;
    return { toolId, effectiveMode, sources: forTool.map((b) => `${humanize(b.mode)} (${b.scope.kind === "BUNDLE" ? "whole bundle" : "this item"})`) };
  });
}

const profileLabelOf = (experience: Readonly<{ profile: keyof typeof PROFILE_LABELS }> | null) => (experience ? PROFILE_LABELS[experience.profile] : null);

function sumBytes(assets: readonly Readonly<{ byteSize: number }>[]) {
  return assets.reduce((total, asset) => total + asset.byteSize, 0);
}

export function buildTeacherPreviewModel(resolved: ResolvedContentBundlePreview): TeacherPreviewModel {
  const { bundle, contentHash, learnerProjection, labReadiness, toolkit } = resolved;
  const members: readonly (LessonReference | ActivityDefinition | AssessmentReference | LabBinding)[] = [...bundle.lessons, ...bundle.activities, ...bundle.assessments, ...bundle.labs];
  const titles = new Map(members.map((m) => [m.identity.itemId, memberTitle(m, labDisplayTitle)]));
  const titleOf = (itemId: string) => titles.get(itemId) ?? itemId;
  const resourcesById = new Map(bundle.resources.map((r) => [r.resourceId, r]));
  const offlineAssetIds = new Set(bundle.offline.assets.map((a) => a.assetId));
  const resourceRow = (r: ResourceReference): ResourceRow => ({ resourceId: r.resourceId, resourceVersion: r.resourceVersion, title: r.title, kind: humanize(r.kind), audience: humanize(r.audience), offline: r.assetId !== null && offlineAssetIds.has(r.assetId) });
  const resourceRows = (ids: readonly string[]) => ids.map((id) => resourcesById.get(id)).filter((r): r is ResourceReference => !!r).map(resourceRow);
  const resourceLabel = (id: string | null) => {
    if (id === null) return null;
    const r = resourcesById.get(id);
    return r ? `${r.title} (${humanize(r.audience)} only)` : id;
  };
  const instruction = (step: Readonly<{ stepId: string; text: string; resourceIds: readonly string[] }>): TeacherInstruction => ({ stepId: step.stepId, text: step.text, resources: step.resourceIds.map((id) => resourcesById.get(id)?.title ?? id) });
  const placements = buildSequence(bundle.sequence.units, titleOf);

  const base = (m: AnyMember & { objectiveIds: readonly string[] }) => ({
    itemId: m.identity.itemId,
    itemVersion: m.identity.itemVersion,
    itemKind: m.identity.itemKind,
    category: categoryOf(m.identity.itemKind),
    title: titleOf(m.identity.itemId),
    objectiveIds: [...m.objectiveIds],
    sequence: placements.get(m.identity.itemId) ?? null,
    tools: itemTools(bundle.toolkitBindings, m.identity.itemId),
  });

  const teacherMembers: TeacherMember[] = [
    ...bundle.lessons.map((lesson): TeacherMember => ({ ...base(lesson), detail: { category: "LESSON", estimatedMinutes: lesson.estimatedMinutes, resources: resourceRows(lesson.resourceIds) } })),
    ...bundle.activities.map((activity): TeacherMember => ({
      ...base(activity),
      detail: {
        category: "ACTIVITY",
        activityType: humanize(activity.identity.itemKind),
        profileLabel: profileLabelOf(activityExperienceOf(activity)),
        expectedDurationMinutes: activity.expectedDurationMinutes,
        collaborationMode: humanize(activity.collaborationMode),
        scaffolding: activity.scaffolding ? humanize(activity.scaffolding) : null,
        evidence: activity.evidenceIntent.forms.length > 0 ? `${humanize(activity.evidenceIntent.kind)}: ${activity.evidenceIntent.forms.map(humanize).join(", ")}` : humanize(activity.evidenceIntent.kind),
        learnerInstructions: activity.instructions.learner.map(instruction),
        teacherInstructions: activity.instructions.teacher.map(instruction),
        rubric: activity.rubric ? { rubricId: activity.rubric.rubricId, rubricVersion: activity.rubric.rubricVersion, criteria: [...activity.rubric.learnerVisibleCriteria], scoringGuide: resourceLabel(activity.rubric.scoringGuideResourceId) } : null,
        extendsLessons: activity.lessonItemIds.map((id) => ({ itemId: id, title: titleOf(id) })),
        resources: resourceRows(activity.resourceIds),
        experience: activityExperienceOf(activity),
      },
    })),
    ...bundle.assessments.map((assessment): TeacherMember => ({
      ...base(assessment),
      detail: {
        category: "ASSESSMENT",
        role: humanize(assessment.role),
        definitionId: assessment.definition.definitionId,
        definitionVersion: assessment.definition.definitionVersion,
        itemCount: assessment.items.length,
        itemOrder: assessment.itemOrder.kind === "FIXED" ? "Fixed order" : `Randomized by policy ${assessment.itemOrder.policyId}@${assessment.itemOrder.policyVersion}`,
        learnerInstructions: [...assessment.learnerInstructions],
        answerKey: resourceLabel(assessment.secured.answerKeyResourceId),
        scoringGuide: resourceLabel(assessment.secured.scoringGuideResourceId),
      },
    })),
    ...bundle.labs.map((lab): TeacherMember => {
      const claimed = labReadiness[lab.identity.itemId] ?? { state: "NOT_EVALUATED" as const, reason: "The resolver returned no readiness for this lab." };
      const readiness = !resolved.source.authoritative && claimed.state === "CERTIFIED_RUNNABLE" ? { state: "NOT_EVALUATED" as const, reason: "Fixture certification is not production authority." } : claimed;
      return {
        ...base(lab),
        detail: {
          category: "LAB",
          linkId: lab.link.linkId,
          linkRevision: lab.link.linkRevision,
          labId: lab.lab.labId,
          labVersion: lab.lab.labVersion,
          role: humanize(lab.role),
          placement: lab.placement.sceneId ? `${titleOf(lab.placement.lessonItemId)}, scene ${lab.placement.sceneId}` : titleOf(lab.placement.lessonItemId),
          authorityBasis: humanize(lab.authorityBasis),
          readiness,
          runnable: resolved.source.authoritative && readiness.state === "CERTIFIED_RUNNABLE",
        },
      };
    }),
  ];

  const objectiveIds = bundle.curriculumAuthority.objectiveIds;
  const runtimeFor = (toolId: string) => {
    const ids = toolkit.mapping?.reviewed && Object.prototype.hasOwnProperty.call(toolkit.mapping.entries, toolId) ? toolkit.mapping.entries[toolId] : [];
    return ids.map((id) => (toolkit.runtimeToolNames[id] ? `${toolkit.runtimeToolNames[id]} (${id})` : id));
  };
  const supportRow = (s: Readonly<{ supportId: string; objectiveIds: readonly string[]; itemIds: readonly string[]; resourceIds: readonly string[] }>): SupportRow => ({ supportId: s.supportId, objectiveIds: [...s.objectiveIds], items: s.itemIds.map((id) => ({ itemId: id, title: titleOf(id) })), resources: s.resourceIds.map((id) => resourcesById.get(id)?.title ?? id) });

  const learnerAssets = bundle.offline.assets.filter((a) => a.audience === "LEARNER");
  const staffAssets = bundle.offline.assets.filter((a) => a.audience !== "LEARNER");
  const internalConfigCount = bundle.toolkitBindings.filter((b) => Object.keys(b.internalConfiguration).length > 0).length;
  const withheld: WithheldRow[] = [
    { label: "Teacher instruction steps", count: bundle.activities.reduce((n, a) => n + a.instructions.teacher.length, 0) },
    { label: "Activity facilitation guides (flow, look-fors, misconceptions, alignment)", count: bundle.activities.filter((a) => activityExperienceOf(a) !== null).length },
    { label: "Teacher and system resources (notes, answer keys)", count: bundle.resources.filter((r) => r.audience !== "LEARNER").length },
    { label: "Assessment answer keys and scoring guides", count: bundle.assessments.reduce((n, a) => n + (a.secured.answerKeyResourceId ? 1 : 0) + (a.secured.scoringGuideResourceId ? 1 : 0), 0) },
    { label: "Rubric scoring guides", count: bundle.activities.filter((a) => a.rubric?.scoringGuideResourceId).length },
    { label: "Assessment item lists", count: bundle.assessments.length },
    { label: "Tool prohibitions (enforced by the server, not shown)", count: bundle.toolkitBindings.filter((b) => b.mode === "PROHIBITED").length },
    { label: "Internal tool configurations", count: internalConfigCount },
    { label: "Teacher-only renderings", count: bundle.renderings.length - learnerProjection.renderings.length },
    { label: "Teacher-only offline assets", count: staffAssets.length },
    { label: "Governance and review references", count: bundle.governance.provenanceRefs.length + bundle.governance.reviewRefs.length + bundle.governance.lifecycleRefs.length + bundle.governance.releaseRefs.length },
  ];

  return {
    header: { bundleId: bundle.identity.bundleId, title: bundle.identity.title, gradeLevel: bundle.identity.gradeLevel, subject: humanize(bundle.identity.subject), version: bundle.identity.version, locale: bundle.identity.locale, contentHash },
    source: resolved.source,
    release: resolved.release,
    objectives: objectiveIds.map((objectiveId) => ({ objectiveId, description: resolved.authorityMetadata.objectiveDescriptions[objectiveId] ?? "description unavailable", boundItems: teacherMembers.filter((m) => m.objectiveIds.includes(objectiveId)).map((m) => ({ itemId: m.itemId, title: m.title })) })),
    standards: [...bundle.curriculumAuthority.standardIds],
    authority: {
      releaseId: bundle.curriculumAuthority.releaseId,
      releaseIdentity: bundle.curriculumAuthority.releaseIdentity,
      sourceVersionRefs: [...bundle.curriculumAuthority.sourceVersionRefs],
      conceptRefs: [...bundle.curriculumAuthority.conceptRefs],
      constructBindingRefs: [...bundle.curriculumAuthority.constructBindingRefs],
    },
    nav: buildNav(bundle.sequence.units, members, titleOf),
    members: teacherMembers,
    resources: bundle.resources.map(resourceRow),
    tools: bundle.toolkitBindings.map((b) => ({ toolId: b.toolId, mode: b.mode, scope: scopeLabel(b, titleOf), configuration: configRows(b.configuration), context: b.context, runtimeTools: runtimeFor(b.toolId) })),
    toolkitMapping: {
      pinned: bundle.toolkitMapping ? `${bundle.toolkitMapping.mappingId}@${bundle.toolkitMapping.mappingVersion}` : null,
      checkedAgainst: toolkit.mapping ? `${toolkit.mapping.mappingId}@${toolkit.mapping.mappingVersion}` : null,
      reviewed: toolkit.mapping ? toolkit.mapping.reviewed : null,
      issues: toolkit.issues.map((issue) => issue.message),
    },
    learnerSupport: {
      remediation: bundle.learnerSupport.remediation.map(supportRow),
      enrichment: bundle.learnerSupport.enrichment.map(supportRow),
      accommodations: bundle.learnerSupport.accommodations.map((a) => humanize(a.kind)),
      languageVariants: bundle.learnerSupport.languageVariants.map((v) => `${v.locale}: ${titleOf(v.itemId)}`),
    },
    renderings: RENDERING_KINDS.map((kind) => {
      const r = bundle.renderings.find((x) => x.kind === kind);
      return { kind, label: RENDERING_LABELS[kind], available: !!r, audience: r ? humanize(r.audience) : null, artifactVersion: r?.artifactVersion ?? null };
    }),
    offline: {
      ready: resolved.authorityMetadata.offlinePackageClosed,
      packageable: bundle.offline.packageable,
      capabilities: bundle.offline.allowedCapabilities.map(humanize),
      reconnectRequiredFor: bundle.offline.reconnectSemantics.requiredFor.map(humanize),
      maxOfflineDays: bundle.offline.reconnectSemantics.maxOfflineDays,
      learnerAssets: { count: learnerAssets.length, bytes: sumBytes(learnerAssets) },
      staffOnlyAssets: { count: staffAssets.length, bytes: sumBytes(staffAssets) },
      pins: {
        bundle: `${learnerProjection.offline.bundleId}@${learnerProjection.offline.bundleVersion}`,
        contentHash: learnerProjection.offline.contentHash,
        releaseIdentity: learnerProjection.offline.releaseIdentity,
        projectionVersion: learnerProjection.offline.projectionVersion,
        members: learnerProjection.offline.members.map((m) => `${m.itemId}@${m.itemVersion}`),
        assets: learnerProjection.offline.assets.map((a) => `${a.assetId}@${a.assetVersion} sha256:${a.sha256.slice(0, 12)}`),
      },
    },
    governance: {
      provenanceRefs: bundle.governance.provenanceRefs.length ? [`${bundle.governance.provenanceRefs.length} recorded; server details withheld`] : [],
      reviewRefs: bundle.governance.reviewRefs.length ? [`${bundle.governance.reviewRefs.length} recorded; server details withheld`] : [],
      lifecycleRefs: bundle.governance.lifecycleRefs.length ? [`${bundle.governance.lifecycleRefs.length} recorded; server details withheld`] : [],
      releaseRefs: bundle.governance.releaseRefs.length ? [`${bundle.governance.releaseRefs.length} recorded; server details withheld`] : [],
    },
    withheldFromStudents: withheld.filter((row) => row.count > 0),
  };
}

// ─── Student model (from the learner projection only) ───────────────────────────────────────────

export type StudentMemberDetail =
  | Readonly<{ category: "LESSON"; estimatedMinutes: number; resources: readonly string[] }>
  | Readonly<{
      category: "ACTIVITY";
      activityType: string;
      profileLabel: string | null;
      expectedDurationMinutes: number;
      collaborationMode: string;
      /** Learner projection of the experience only; teacher fields cannot exist here. */
      experience: LearnerActivityExperience | null;
      instructions: readonly Readonly<{ stepId: string; text: string; resources: readonly string[] }>[];
      criteria: readonly string[];
      resources: readonly string[];
    }>
  | Readonly<{ category: "ASSESSMENT"; kindLabel: string; instructions: readonly string[] }>
  | Readonly<{ category: "LAB"; available: boolean }>;

export type StudentMember = Readonly<{
  itemId: string;
  itemKind: GovernedItemKind;
  category: MemberCategory;
  title: string;
  sequence: SequencePlacement | null;
  tools: readonly Readonly<{ toolId: string; mode: "REQUIRED" | "OPTIONAL"; context: string | null }>[];
  detail: StudentMemberDetail;
}>;

export type StudentPreviewModel = Readonly<{
  fixture: boolean;
  header: Readonly<{ title: string; gradeLevel: number; subject: string; locale: string }>;
  nav: readonly NavGroup[];
  members: readonly StudentMember[];
  objectiveIds: readonly string[];
  resources: readonly ResourceRow[];
  tools: readonly Readonly<{ toolId: string; mode: "REQUIRED" | "OPTIONAL"; context: string | null; configuration: readonly Readonly<{ key: string; value: string }>[] }>[];
  renderings: readonly RenderingRow[];
  accommodations: readonly string[];
  offline: Readonly<{ packageable: boolean; assetCount: number; bytes: number; capabilities: readonly string[]; reconnectRequiredFor: readonly string[] }>;
}>;

/** Student-facing assessment wording from the projected role. */
const STUDENT_ASSESSMENT_LABEL: Readonly<Record<string, string>> = { FORMATIVE_CHECK: "Quick check", QUIZ: "Quiz", UNIT_ASSESSMENT: "Unit test", EXAM: "Exam", WAEC_STYLE: "Exam practice" };

/**
 * Everything comes from the learner projection, never from teacher metadata.
 * Current V1 links cannot establish runnable lab authority; displayed labs stay unavailable.
 */
export function buildStudentPreviewModel(learner: LearnerContentBundle): StudentPreviewModel {
  const members = [...learner.lessons, ...learner.activities, ...learner.assessments, ...learner.labs];
  const titles = new Map(members.map((m) => [m.identity.itemId, memberTitle(m, labDisplayTitle)]));
  const titleOf = (itemId: string) => titles.get(itemId) ?? itemId;
  const resourceTitle = new Map(learner.resources.map((r) => [r.resourceId, r.title]));
  const titlesFor = (ids: readonly string[]) => ids.map((id) => resourceTitle.get(id) ?? id);
  const placements = buildSequence(learner.sequence.units, titleOf);
  const offlineAssets = new Set(learner.offline.assets.map((a) => a.assetId));
  const itemScopedTools = (itemId: string) =>
    learner.tools.filter((t) => t.scope.kind === "ITEM" && t.scope.itemId === itemId).map((t) => ({ toolId: t.toolId, mode: t.mode, context: t.context }));
  const base = (m: AnyMember) => ({ itemId: m.identity.itemId, itemKind: m.identity.itemKind, category: categoryOf(m.identity.itemKind), title: titleOf(m.identity.itemId), sequence: placements.get(m.identity.itemId) ?? null, tools: itemScopedTools(m.identity.itemId) });

  return {
    fixture: learner.source.bundleId.startsWith("fixture.") || learner.source.bundleVersion.includes("fixture"),
    header: { title: learner.identity.title, gradeLevel: learner.identity.gradeLevel, subject: humanize(learner.identity.subject), locale: learner.identity.locale },
    nav: buildNav(learner.sequence.units, members, titleOf),
    objectiveIds: [...learner.objectives.objectiveIds],
    members: [
      ...learner.lessons.map((l): StudentMember => ({ ...base(l), detail: { category: "LESSON", estimatedMinutes: l.estimatedMinutes, resources: titlesFor(l.resourceIds) } })),
      ...learner.activities.map((a): StudentMember => ({
        ...base(a),
        detail: {
          category: "ACTIVITY",
          activityType: humanize(a.identity.itemKind),
          profileLabel: profileLabelOf(a.experience ?? null),
          expectedDurationMinutes: a.expectedDurationMinutes,
          collaborationMode: humanize(a.collaborationMode),
          experience: a.experience ?? null,
          instructions: a.instructions.map((s) => ({ stepId: s.stepId, text: s.text, resources: titlesFor(s.resourceIds) })),
          criteria: a.rubric ? [...a.rubric.criteria] : [],
          resources: titlesFor(a.resourceIds),
        },
      })),
      ...learner.assessments.map((a): StudentMember => ({ ...base(a), detail: { category: "ASSESSMENT", kindLabel: STUDENT_ASSESSMENT_LABEL[a.role] ?? humanize(a.role), instructions: [...a.learnerInstructions] } })),
      ...learner.labs.map((l): StudentMember => ({ ...base(l), detail: { category: "LAB", available: false } })),
    ],
    resources: learner.resources.map((r) => ({ resourceId: r.resourceId, resourceVersion: r.resourceVersion, title: r.title, kind: humanize(r.kind), audience: null, offline: r.assetId !== null && offlineAssets.has(r.assetId) })),
    tools: learner.tools.filter((t) => t.scope.kind === "BUNDLE").map((t) => ({ toolId: t.toolId, mode: t.mode, context: t.context, configuration: configRows(t.configuration) })),
    renderings: RENDERING_KINDS.filter((k) => k === "TEXTBOOK" || k === "WORKBOOK").map((kind) => {
      const r = learner.renderings.find((x) => x.kind === kind);
      return { kind, label: RENDERING_LABELS[kind], available: !!r, audience: null, artifactVersion: r?.artifactVersion ?? null };
    }),
    accommodations: learner.learnerSupport.accommodations.map((a) => humanize(a.kind)),
    offline: {
      packageable: learner.offline.packageable,
      assetCount: learner.offline.assets.length,
      bytes: sumBytes(learner.offline.assets),
      capabilities: learner.offline.allowedCapabilities.map(humanize),
      reconnectRequiredFor: learner.offline.reconnectSemantics.requiredFor.map(humanize),
    },
  };
}

export type ContentBundlePreviewModels = Readonly<{ teacher: TeacherPreviewModel; student: StudentPreviewModel }>;

export function buildPreviewModels(resolved: ResolvedContentBundlePreview): ContentBundlePreviewModels {
  return { teacher: buildTeacherPreviewModel(resolved), student: buildStudentPreviewModel(resolved.learnerProjection) };
}
