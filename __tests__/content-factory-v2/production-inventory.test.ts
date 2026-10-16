import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { hashCurriculumSnapshot } from "@/lib/curriculum/provenance/hash";
import { buildCurriculumContentSnapshot } from "@/lib/curriculum/provenance/snapshot";
import { validateProductionCapture } from "@/lib/content-factory/v2/productionInventory";

const provenance = { authorizationRef: "SYNTHETIC_AUTHORIZATION_REFERENCE", targetAttestationRef: "SYNTHETIC_TARGET_NOT_PRODUCTION", queryCommit: "a".repeat(40), querySha256: "b".repeat(64) };
function capture() {
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
const serialize = (records: unknown[]) => records.map(r => JSON.stringify(r)).join("\n") + "\n";
describe("Prepared production inventory procedure, synthetic offline validation only", () => {
  it("hashes every full record, validates revision lineage and creates no production claims", () => {
    const raw = serialize(capture());
    const result = validateProductionCapture(raw, provenance);
    expect(result.manifest.lessonCount).toBe(1);
    expect(result.manifest.exportBytes).toBe(Buffer.byteLength(raw));
    expect(result.manifest.lessons[0].recordSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result.manifest.lessons[0].gaps).toEqual([]);
    expect(result.manifest.lessons[0].relationshipCounts).toMatchObject({ assignments: 6, submissions: 15, gradedSubmissions: 7, learningEvents: 1, studentSessions: 6 });
    expect(result.manifest.validationStatus).toBe("OFFLINE_INTEGRITY_CHECKED_NOT_PRODUCTION_ATTESTED");
    expect(result.manifest.pending).toContain("FREE_TEXT_PRIVACY_REVIEW");
    expect(result.manifest.writes).toEqual([]);
  });
  it("rejects partial exports, wrong counts and non-read-only sessions", () => {
    expect(() => validateProductionCapture(serialize(capture().slice(0, -1)), provenance)).toThrow();
    const records = capture(); records[0] = { ...records[0], transactionReadOnly: "off" };
    expect(() => validateProductionCapture(serialize(records), provenance)).toThrow();
    const wrong = capture(); wrong[3] = { ...wrong[3], lessonCount: 2 };
    expect(() => validateProductionCapture(serialize(wrong), provenance)).toThrow("capture_count_mismatch");
  });
  it("refuses personal fields in relationship references", () => {
    const records = capture();
    const row = records[2];
    if (!("learningHistoryReferences" in row)) throw new Error("fixture_missing");
    Object.assign(row.learningHistoryReferences[0], { studentId: "must-not-be-exported" });
    expect(() => validateProductionCapture(serialize(records), provenance)).toThrow();
  });
  it("retains a corrupt legacy revision as a visible ineligible gap", () => {
    const records = capture();
    const row = records[2];
    if (!("revisions" in row)) throw new Error("fixture_missing");
    row.revisions[0] = { ...row.revisions[0], contentHash: "0".repeat(64) };
    const result = validateProductionCapture(serialize(records), provenance);
    expect(result.manifest.lessons[0].gaps).toContain("REVISION_HASH_MISMATCH:synthetic-rev");
    expect(result.inventory.selected).toBe(null);
  });
  it("refuses pilot eligibility when the mutable full body differs from its exact revision", () => {
    const records = capture(); records[2].payload.body = "An unreviewed change";
    const result = validateProductionCapture(serialize(records), provenance);
    expect(result.manifest.lessons[0].gaps).toContain("CURRENT_PROJECTION_REVISION_MISMATCH");
    expect(result.inventory.selected).toBe(null);
  });
  it("does not mistake metadata-only payloads for an authoritative instructional body", () => {
    const records = capture();
    const row = records[2];
    Object.assign(row, { payload: { description: "Metadata only, no instructional content" } });
    const projection = buildCurriculumContentSnapshot(row);
    row.revisions[0] = { ...row.revisions[0], snapshotSchemaVersion: projection.schemaVersion,
      contentSnapshot: projection.snapshot, contentHash: hashCurriculumSnapshot(projection.schemaVersion, projection.snapshot) };
    const result = validateProductionCapture(serialize(records), provenance);
    expect(result.manifest.lessons[0].gaps).toContain("CURRENT_INSTRUCTIONAL_CONTENT_INVALID");
    expect(result.inventory.selected).toBe(null);
  });
  it("prepares only SELECT/session-control SQL with rollback and no personal column projection", () => {
    const sql = readFileSync("scripts/content-factory-v2/production-inventory.sql", "utf8");
    const executable = sql.replace(/--[^\n]*/g, "").replace(/'(?:''|[^'])*'/g, "''").replace(/\"(?:\"\"|[^\"])*\"/g, "identifier");
    expect(executable).not.toMatch(/\b(INSERT|UPDATE|DELETE|TRUNCATE|CREATE|ALTER|DROP|GRANT|REVOKE|CALL|COPY|COMMIT)\b/i);
    expect(sql).toContain("REPEATABLE READ READ ONLY");
    expect(sql.trimEnd().endsWith("ROLLBACK;")).toBe(true);
    expect(sql).not.toMatch(/\"(studentId|userId|actorId|responses|answers|score|phone|email|metadata)\"/);
    expect(sql).toContain("sessionGuard");
  });
});
