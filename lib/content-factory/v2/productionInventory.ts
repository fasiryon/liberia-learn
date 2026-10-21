import { z } from "zod";
import { createHash } from "crypto";
import { canonicalizeJson, hashCurriculumSnapshot } from "@/lib/curriculum/provenance/hash";
import { buildCurriculumContentSnapshot, validateCurriculumContentSnapshot } from "@/lib/curriculum/provenance/snapshot";
import { inventoryLegacy } from "./inventory";

const id = z.string().min(1);
const count = z.number().int().nonnegative();
const sha = z.string().regex(/^[a-f0-9]{64}$/);
const revision = z.strictObject({ revisionId: id, sequence: count, snapshotSchemaVersion: z.number().int().positive(), contentSnapshot: z.unknown(), contentHash: sha,
  originKind: id, revisionKind: id, sourceRevisionId: id.nullable(), generatorName: id.nullable(), generatorVersion: id.nullable(), primaryPromptKey: id.nullable(), primaryPromptVersion: id.nullable(), primaryPromptHash: sha.nullable() });
const sessionSchema = z.strictObject({ kind: z.literal("session"), schemaVersion: z.literal("factory-production-capture/1.0.0"), capturedAt: z.string().datetime(), transactionReadOnly: z.literal("on"), isolation: z.literal("repeatable read"), snapshot: id, serverVersion: id, referenceSaltValid: z.literal(true), rowSecurity: id, sessionGuard: z.literal(1) });
const coverageSchema = z.strictObject({ kind: z.literal("coverage"), contentTypes: z.array(z.strictObject({ contentType: id, count })), lessonCount: count, legacyLessonMetadataCount: count });
const lessonSchema = z.strictObject({ kind: z.literal("lesson"), databaseId: id, contentId: id, grade: z.number().int().min(1).max(12), subject: id, unitId: id.nullable(), orderInUnit: count.nullable(), contentType: id, title: z.string().nullable(), version: id, lessonVersion: count, status: id, publishedAt: z.string().nullable(),
  lessonType: id.nullable(), schoolId: id.nullable(), visibility: id, teacherCreated: z.boolean(), heroImageUrl: id.nullable(), heroImageMeta: z.unknown(), inlineIllustrations: z.unknown(),
  payload: z.unknown(), learningObjectives: z.unknown(), moeAlignments: z.unknown(), waecSyllabusTopics: z.array(z.string()), deliveryProfile: z.unknown(), provenanceId: id.nullable(), lifecycleState: id.nullable(), provenanceCompleteness: id.nullable(), currentRevisionId: id.nullable(), revisions: z.array(revision),
  governanceReferences: z.array(z.strictObject({ eventId: id, sequence: count, revisionId: id, eventType: id, lifecycleResult: id.nullable(), approvalBasis: id.nullable(), reviewAuthority: id.nullable(), occurredAt: id })),
  assignmentCount: count, assignmentSubmissionCount: count, homeworkCount: count, homeworkSubmissionCount: count, gradedSubmissionCount: count, teacherLessonAssignmentCount: count, timetableAssignmentCount: count,
  scheduledWorkCount: count, progressCount: count, studentSessionCount: count, teacherVersionReferences: z.array(z.strictObject({ versionId: id, bodySha256: sha })), learningEventCount: count,
  learningHistoryReferences: z.array(z.strictObject({ referenceDigest: sha, eventType: id, curriculumVersion: id.nullable(), assessmentVersion: id.nullable() })),
});
const completeSchema = z.strictObject({ kind: z.literal("complete"), lessonCount: count, transactionReadOnly: z.literal("on") });
const rawHash = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");

/** Offline integrity validation only. Caller attestations do not prove live target or permissions. */
export function validateProductionCapture(raw: string, provenance: {
  authorizationRef: string; targetAttestationRef: string; queryCommit: string; querySha256: string;
}) {
  z.strictObject({ authorizationRef: id, targetAttestationRef: id, queryCommit: z.string().regex(/^[a-f0-9]{40}$/), querySha256: sha }).parse(provenance);
  const lines = raw.split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 4) throw new Error("capture_incomplete");
  const records: unknown[] = lines.map(line => JSON.parse(line));
  const session = sessionSchema.parse(records[0]);
  const coverage = coverageSchema.parse(records[1]);
  const complete = completeSchema.parse(records.at(-1));
  const lessons = records.slice(2, -1).map(record => lessonSchema.parse(record));
  if (coverage.lessonCount !== lessons.length || complete.lessonCount !== lessons.length || lessons.length === 0) throw new Error("capture_count_mismatch_or_empty");
  const declaredLessonCount = coverage.contentTypes.filter(t => t.contentType.toUpperCase() === "LESSON").reduce((n, t) => n + t.count, 0);
  if (declaredLessonCount !== lessons.length) throw new Error("capture_coverage_mismatch");
  if (new Set(lessons.map(l => l.databaseId)).size !== lessons.length || new Set(lessons.map(l => l.contentId)).size !== lessons.length) throw new Error("capture_duplicate_identity");
  const grouping = new Map<string, number>();
  const summaries = lessons.map(lesson => {
    if (lesson.contentType.toUpperCase() !== "LESSON") throw new Error("capture_nonlesson_row");
    if (lesson.learningEventCount !== lesson.learningHistoryReferences.length || new Set(lesson.learningHistoryReferences.map(r => r.referenceDigest)).size !== lesson.learningEventCount) throw new Error("capture_learning_reference_count_mismatch");
    const gaps: string[] = [];
    if (lesson.payload === null || lesson.payload === undefined || lesson.payload === "" || (typeof lesson.payload === "object" && Object.keys(lesson.payload).length === 0)) gaps.push("CURRENT_CONTENT_BODY_MISSING");
    if (!lesson.provenanceId || !lesson.currentRevisionId) gaps.push("CURRENT_REVISION_MISSING");
    if (new Set(lesson.revisions.map(r => r.revisionId)).size !== lesson.revisions.length || new Set(lesson.revisions.map(r => r.sequence)).size !== lesson.revisions.length) throw new Error("capture_duplicate_revision");
    for (const r of lesson.revisions) if (hashCurriculumSnapshot(r.snapshotSchemaVersion, r.contentSnapshot) !== r.contentHash) gaps.push(`REVISION_HASH_MISMATCH:${r.revisionId}`);
    const current = lesson.revisions.find(r => r.revisionId === lesson.currentRevisionId);
    if (!current) gaps.push("CURRENT_REVISION_UNRESOLVED");
    const projection = buildCurriculumContentSnapshot(lesson);
    try { validateCurriculumContentSnapshot(projection.schemaVersion, projection.snapshot); }
    catch { gaps.push("CURRENT_INSTRUCTIONAL_CONTENT_INVALID"); }
    const delivery = projection.snapshot.delivery;
    const legacyBodyPresent = [delivery.body, delivery.bodyStandard, delivery.bodyBlock, delivery.legacyContent, delivery.lessonContent].some(body => typeof body === "string" && body.trim().length > 0);
    const nativeBodyPresent = "experience" in projection.snapshot && Object.values(projection.snapshot.experience).some(document =>
      document && typeof document === "object" && !Array.isArray(document) && Array.isArray(document.scenes) && document.scenes.length >= 2 && document.scenes.every(scene =>
        scene && typeof scene === "object" && !Array.isArray(scene) && scene.content && typeof scene.content === "object" && !Array.isArray(scene.content) && typeof scene.content.body === "string" && scene.content.body.trim().length > 0));
    if (!legacyBodyPresent && !nativeBodyPresent) gaps.push("AUTHORITATIVE_FULL_BODY_UNRESOLVED");
    const projectionHash = hashCurriculumSnapshot(projection.schemaVersion, projection.snapshot);
    if (current && (projection.schemaVersion !== current.snapshotSchemaVersion || projectionHash !== current.contentHash)) gaps.push("CURRENT_PROJECTION_REVISION_MISMATCH");
    const key = `${lesson.grade}/${lesson.subject}/${lesson.status}`;
    grouping.set(key, (grouping.get(key) ?? 0) + 1);
    return { databaseId: lesson.databaseId, contentId: lesson.contentId, grade: lesson.grade, subject: lesson.subject, unitId: lesson.unitId, status: lesson.status, currentRevisionId: lesson.currentRevisionId,
      schoolId: lesson.schoolId, visibility: lesson.visibility, teacherCreated: lesson.teacherCreated,
      recordSha256: rawHash(canonicalizeJson(lesson)), payloadSha256: rawHash(canonicalizeJson(lesson.payload)), currentProjectionHash: projectionHash, revisions: lesson.revisions.map(r => ({ revisionId: r.revisionId, sequence: r.sequence, contentHash: r.contentHash })),
      teacherVersionReferences: lesson.teacherVersionReferences,
      relationshipCounts: { assignments: lesson.assignmentCount + lesson.homeworkCount + lesson.teacherLessonAssignmentCount + lesson.timetableAssignmentCount,
        submissions: lesson.assignmentSubmissionCount + lesson.homeworkSubmissionCount + lesson.gradedSubmissionCount,
        assignmentSubmissions: lesson.assignmentSubmissionCount, homeworkSubmissions: lesson.homeworkSubmissionCount, gradedSubmissions: lesson.gradedSubmissionCount,
        teacherLessonAssignments: lesson.teacherLessonAssignmentCount, timetableAssignments: lesson.timetableAssignmentCount,
        learningEvents: lesson.learningEventCount, scheduledWork: lesson.scheduledWorkCount, progress: lesson.progressCount, studentSessions: lesson.studentSessionCount }, gaps };
  });
  const inventory = inventoryLegacy({ schemaVersion: "factory-legacy-inventory/1.0.0", environment: "PRODUCTION_READ_ONLY_EXPORT", capturedAt: new Date(session.capturedAt).toISOString(), queryRef: `${provenance.queryCommit}#${provenance.querySha256}`,
    lessons: lessons.map((l, i) => { const current = l.revisions.find(r => r.revisionId === l.currentRevisionId); return { databaseId: l.databaseId, contentId: l.contentId, grade: l.grade, subject: l.subject, contentType: l.contentType, version: l.version, status: l.status, revisionId: current?.revisionId ?? null, revisionNumber: current?.sequence ?? null, snapshotSchemaVersion: current?.snapshotSchemaVersion ?? null, contentSnapshot: current?.contentSnapshot ?? null, contentHash: current?.contentHash ?? null,
      captureGaps: summaries[i].gaps,
      relationshipCounts: { assignments: summaries[i].relationshipCounts.assignments, submissions: summaries[i].relationshipCounts.submissions, learningEvents: l.learningEventCount, scheduledWork: l.scheduledWorkCount } }; }) });
  // Keep truthful bodies/revisions in the export and projection. Candidate suggestions also require
  // consistency between the live projection and its exact immutable current revision.
  const rows = inventory.rows.map((row, i) => ({ ...row, gaps: [...new Set([...row.gaps, ...summaries[i].gaps])], candidateEligible: row.candidateEligible && summaries[i].gaps.length === 0 }));
  return { manifest: { schemaVersion: "factory-production-manifest/1.0.0", validationStatus: "OFFLINE_INTEGRITY_CHECKED_NOT_PRODUCTION_ATTESTED", capturedAt: session.capturedAt, session, provenance,
    exportSha256: rawHash(raw), exportBytes: Buffer.byteLength(raw), lessonCount: lessons.length, gradeSubjectStatusCounts: Object.fromEntries(grouping), contentTypeCoverage: coverage.contentTypes,
    lessons: summaries, legacyLessonMetadataCount: coverage.legacyLessonMetadataCount,
    pending: ["TARGET_AND_ROLE_ATTESTATION", "FULL_VISIBILITY_ATTESTATION", "FREE_TEXT_PRIVACY_REVIEW", "QUALIFIED_CURRICULUM_PILOT_SELECTION", ...(coverage.legacyLessonMetadataCount ? ["LEGACY_LESSON_METADATA_RECONCILIATION_REQUIRED"] : [])], writes: [] }, inventory: { ...inventory, rows, selected: rows.filter(r => r.candidateEligible).sort((a, b) => a.databaseId.localeCompare(b.databaseId))[0] ?? null } };
}
