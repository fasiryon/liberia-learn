/**
 * Per-lesson inventory record: everything the modernization program needs to know about one live lesson,
 * without its body text and without any learner, user or school identifier.
 */
import type { LibraryExtractRecord, DependencyCounts } from "./extract";
import { isDemoOrTestFixture, type LessonAudit } from "./legacyAudit";
import type { LessonClassification } from "./classify";
import { parseLegacyAlignmentClaims } from "./moeAuthority";
import { flattenText, hasContent, type SnapshotV1 } from "./text";

export const INVENTORY_VERSION = "liberialearn-library-inventory/1.0.0" as const;

/**
 * Where a lesson came from, from the evidence the row carries. LEGACY_UNKNOWN origin on the backfill
 * revision means provenance was never captured at generation time; the payload's generator metadata is
 * the only remaining evidence and is reported as such, not as verified provenance.
 */
export type SourceClass =
  | "AI_GENERATED_MODEL_RECORDED"
  | "TEMPLATE_ENGINE_GENERATED"
  | "AI_UPGRADE_OF_EARLIER_LESSON"
  | "TEACHER_AUTHORED"
  | "DEMO_OR_TEST_FIXTURE"
  | "UNKNOWN_ORIGIN";

export type CatalogScope = "PRODUCTION_CATALOG";

export type InventoryRecord = Readonly<{
  contentId: string;
  contentPk: string;
  scope: CatalogScope;
  title: string | null;
  grade: number;
  subject: string;
  unitId: string | null;
  lessonType: string | null;
  generatorFamily: string;
  publication: Readonly<{ status: string; lifecycleState: string | null; provenanceCompleteness: string | null; publishedAt: string | null; payloadApprovalStatus: string | null; visibility: string }>;
  source: Readonly<{ class: SourceClass; model: string | null; originKind: string | null; revisionKind: string | null; teacherCreated: boolean; schoolScoped: boolean }>;
  revision: Readonly<{ id: string | null; sequence: number | null; revisionCount: number; contentHash: string | null; hashVerified: boolean; liveRowMatchesRevision: boolean; rowHash: string | null }>;
  objectives: Readonly<{ count: number; alignmentMethod: string | null; alignmentClaims: number; structuredMoeIds: number; inventedCodes: number; waecTags: readonly string[] }>;
  format: Readonly<{ lessonFormat: string | null; primaryTextField: string | null; sections: number; learnerWords: number; estimatedMinutes: number | null }>;
  assessment: Readonly<{ questions: number; keyed: number; quiz: boolean; problemSets: boolean; rubric: boolean }>;
  media: Readonly<{ heroImage: boolean; inlineIllustrations: number; labs: number; slideDeckSpecs: number; audioScriptSpecs: number; audioAssets: number; videoSupplements: number }>;
  accessibility: Readonly<{ language: "en"; narrationAvailable: boolean; imagesWithoutAlt: number; textFirst: boolean }>;
  dependencies: DependencyCounts;
  indicators: readonly string[];
  cleanupPlanV1: readonly string[];
  modernization: Readonly<{ candidate: string | null }>;
  audit: Readonly<{ reviewOutcome: string; mechanicalOutcome: string; blocking: number; major: number; minor: number; auditDigest: string }>;
  classification: Readonly<{ track: string; trackAfterHold: string | null; priority: number; foundational: boolean }>;
}>;

export function generatorFamily(version: string): string {
  if (version.startsWith("elite-upgrade")) return "elite-upgrade";
  return version;
}

function sourceClass(record: LibraryExtractRecord): { class: SourceClass; model: string | null } {
  const meta = record.row.payloadMetadata as Record<string, Record<string, unknown> | undefined>;
  const model = (meta.metadata?.model ?? meta.generationMetadata?.model ?? null) as string | null;
  if (record.row.teacherCreated) return { class: "TEACHER_AUTHORED", model };
  if (isDemoOrTestFixture(record.contentId, record.row.version)) return { class: "DEMO_OR_TEST_FIXTURE", model };
  if (record.row.version.startsWith("elite-upgrade") || record.row.payloadKeys.includes("originalImportedVersion")) return { class: "AI_UPGRADE_OF_EARLIER_LESSON", model };
  if (model && /template-engine|national-curriculum-factory/i.test(model)) return { class: "TEMPLATE_ENGINE_GENERATED", model };
  if (model) return { class: "AI_GENERATED_MODEL_RECORDED", model };
  return { class: "UNKNOWN_ORIGIN", model: null };
}

const count = (value: unknown) => (Array.isArray(value) ? value.length : value ? 1 : 0);

export function buildInventoryRecord(input: {
  record: LibraryExtractRecord;
  audit: LessonAudit;
  classification: LessonClassification;
  cleanupActions: readonly string[];
  candidate: string | null;
}): InventoryRecord {
  const { record, audit, classification } = input;
  const snapshot = record.revision?.contentSnapshot as SnapshotV1 | undefined;
  const meta = record.row.payloadMetadata as Record<string, unknown>;
  const payloadApproval = typeof meta.approvalStatus === "string" ? meta.approvalStatus : null;
  const alignment = record.row.moeAlignments as { method?: unknown } | null;
  const claims = parseLegacyAlignmentClaims(snapshot?.standards.moeAlignments ?? record.row.moeAlignments);
  const d = record.dependencies;

  const indicators: string[] = [];
  const status = record.row.status.toUpperCase();
  const learnerVisible = status === "APPROVED" || status === "PUBLISHED";
  if (!record.row.hash) indicators.push("ROW_HASH_MISSING");
  if (!record.verification.revisionHashMatches) indicators.push("REVISION_HASH_MISMATCH");
  if (!record.verification.liveRowEqualsRevision) indicators.push("LIVE_ROW_DIFFERS_FROM_REVISION");
  if (payloadApproval && learnerVisible && !/^approved$/i.test(payloadApproval)) indicators.push("STATUS_PAYLOAD_APPROVAL_CONFLICT");
  if (record.provenance && learnerVisible && record.provenance.lifecycleState !== "APPROVED") indicators.push("STATUS_LIFECYCLE_CONFLICT");
  if (!learnerVisible && d.scheduledWork > 0) indicators.push("SCHEDULED_WHILE_NOT_LEARNER_VISIBLE");
  if (record.provenance?.completeness === "UNVERIFIED" && learnerVisible) indicators.push("LIVE_WITH_UNVERIFIED_PROVENANCE");
  for (const code of ["DUPLICATE_LEARNER_TEXT", "DUPLICATE_TITLE", "SERIALIZATION_ARTIFACT", "ARITHMETIC_ERROR", "POSSIBLE_SUBJECT_MISLABEL", "ANSWER_KEY_IN_LEARNER_TEXT", "TEMPLATE_SHELL", "PLACEHOLDER_CONTENT", "STUB_CONTENT"]) {
    if (audit.findings.some((finding) => finding.code === code)) indicators.push(code);
  }

  const bySeverity = (severity: string) => audit.findings.filter((finding) => finding.severity === severity).length;
  const src = sourceClass(record);
  return Object.freeze({
    contentId: record.contentId,
    contentPk: record.id,
    scope: "PRODUCTION_CATALOG",
    title: record.row.title,
    grade: record.row.grade,
    subject: record.row.subject,
    unitId: record.row.unitId,
    lessonType: record.row.lessonType,
    generatorFamily: generatorFamily(record.row.version),
    publication: { status: record.row.status, lifecycleState: record.provenance?.lifecycleState ?? null, provenanceCompleteness: record.provenance?.completeness ?? null, publishedAt: record.row.publishedAt, payloadApprovalStatus: payloadApproval, visibility: record.row.visibility },
    source: { class: src.class, model: src.model, originKind: record.revision?.originKind ?? null, revisionKind: record.revision?.revisionKind ?? null, teacherCreated: record.row.teacherCreated, schoolScoped: record.row.hasSchoolScope },
    revision: {
      id: record.revision?.id ?? null, sequence: record.revision?.sequence ?? null, revisionCount: record.provenance?.revisionCount ?? 0, contentHash: record.revision?.contentHash ?? null,
      hashVerified: record.verification.revisionHashMatches, liveRowMatchesRevision: record.verification.liveRowEqualsRevision, rowHash: record.row.hash,
    },
    objectives: {
      count: audit.metrics.objectives,
      alignmentMethod: alignment && typeof alignment === "object" && typeof alignment.method === "string" ? alignment.method : null,
      alignmentClaims: claims.length, structuredMoeIds: audit.metrics.resolvedMoeIds, inventedCodes: audit.metrics.inventedAlignmentCodes,
      waecTags: snapshot?.standards.waecSyllabusTopics ?? record.row.waecSyllabusTopics,
    },
    format: { lessonFormat: snapshot?.delivery.lessonFormat ?? null, primaryTextField: audit.metrics.primaryTextField, sections: audit.metrics.sections, learnerWords: audit.metrics.learnerWords, estimatedMinutes: snapshot?.delivery.estimatedMinutes ?? null },
    assessment: {
      questions: audit.metrics.assessmentQuestions, keyed: audit.metrics.keyedQuestions,
      quiz: hasContent(snapshot?.assessment.quiz), problemSets: count(snapshot?.assessment.problemSets) > 0, rubric: hasContent(snapshot?.assessment.rubric),
    },
    media: {
      heroImage: !!snapshot?.resources.heroImage, inlineIllustrations: count(snapshot?.resources.inlineIllustrations), labs: count(snapshot?.resources.labs),
      slideDeckSpecs: count(snapshot?.resources.slideDeckSpecs), audioScriptSpecs: count(snapshot?.resources.audioScriptSpecs), audioAssets: d.audioAssets, videoSupplements: d.videoSupplements,
    },
    accessibility: { language: "en" as const, narrationAvailable: d.audioAssets > 0, imagesWithoutAlt: audit.metrics.imagesWithoutAlt, textFirst: flattenText(snapshot?.delivery).length > 0 },
    dependencies: d,
    indicators: Object.freeze(indicators),
    cleanupPlanV1: Object.freeze([...input.cleanupActions].sort()),
    modernization: { candidate: input.candidate },
    audit: { reviewOutcome: audit.reviewOutcome, mechanicalOutcome: audit.mechanicalOutcome, blocking: bySeverity("BLOCKING"), major: bySeverity("MAJOR"), minor: bySeverity("MINOR"), auditDigest: audit.auditDigest },
    classification: { track: classification.track, trackAfterHold: classification.trackAfterHold, priority: classification.priority.score, foundational: classification.priority.foundational },
  });
}
