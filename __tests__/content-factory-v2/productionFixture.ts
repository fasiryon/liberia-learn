import { hashCurriculumSnapshot } from "@/lib/curriculum/provenance/hash";
import { buildCurriculumContentSnapshot } from "@/lib/curriculum/provenance/snapshot";
export const provenance = { authorizationRef: "SYNTHETIC_AUTHORIZATION_REFERENCE", targetAttestationRef: "SYNTHETIC_TARGET_NOT_PRODUCTION", queryCommit: "a".repeat(40), querySha256: "b".repeat(64) };
export function capture() {
  const projection = { title: "Synthetic fixture", grade: 7, subject: "MATH", contentType: "LESSON", payload: { body: "Synthetic current lesson body" }, unitId: "synthetic-unit", orderInUnit: 1, lessonType: null, learningObjectives: [], moeAlignments: null, waecSyllabusTopics: [], deliveryProfile: null, heroImageUrl: null, heroImageMeta: null, inlineIllustrations: null };
  const contentSnapshot = buildCurriculumContentSnapshot(projection).snapshot;
  const lesson = { kind: "lesson", databaseId: "synthetic-db-id", contentId: "synthetic-logical-id", grade: 7, subject: "MATH", unitId: "synthetic-unit", orderInUnit: 1, contentType: "LESSON", title: "Synthetic fixture", version: "0.1.0", lessonVersion: 1, status: "PUBLISHED", publishedAt: null,
    payload: { body: "Synthetic current lesson body" }, lessonType: null, schoolId: null, visibility: "national", teacherCreated: false, heroImageUrl: null, heroImageMeta: null, inlineIllustrations: null, learningObjectives: [], moeAlignments: null, waecSyllabusTopics: [], deliveryProfile: null, provenanceId: "synthetic-provenance", lifecycleState: "DRAFT", provenanceCompleteness: "COMPLETE", currentRevisionId: "synthetic-rev",
    revisions: [{ revisionId: "synthetic-rev", sequence: 1, snapshotSchemaVersion: 1, contentSnapshot, contentHash: hashCurriculumSnapshot(1, contentSnapshot), originKind: "AI_GENERATED", revisionKind: "INITIAL", sourceRevisionId: null, generatorName: null, generatorVersion: null, primaryPromptKey: null, primaryPromptVersion: null, primaryPromptHash: null }],
    governanceReferences: [], assignmentCount: 2, assignmentSubmissionCount: 5, homeworkCount: 1, homeworkSubmissionCount: 3, gradedSubmissionCount: 7, teacherLessonAssignmentCount: 2, timetableAssignmentCount: 1, scheduledWorkCount: 1, progressCount: 4, studentSessionCount: 6, teacherVersionReferences: [{ versionId: "synthetic-teacher-version", bodySha256: "d".repeat(64) }], learningEventCount: 1,
    learningHistoryReferences: [{ referenceDigest: "c".repeat(64), eventType: "SYNTHETIC_PRACTICE", curriculumVersion: null, assessmentVersion: null }],
  };
  const session = { kind: "session", schemaVersion: "factory-production-capture/1.0.0", capturedAt: "2026-10-16T12:00:00.000000Z", transactionReadOnly: "on", isolation: "repeatable read", snapshot: "synthetic:1:1", serverVersion: "17 (synthetic)", referenceSaltValid: true, rowSecurity: "on", sessionGuard: 1 };
  const coverage = { kind: "coverage", contentTypes: [{ contentType: "LESSON", count: 1 }], lessonCount: 1, legacyLessonMetadataCount: 0 };
  const complete = { kind: "complete", lessonCount: 1, transactionReadOnly: "on" };
  const records: [typeof session, typeof coverage, typeof lesson, typeof complete] = [session, coverage, lesson, complete];
  return records;
}
