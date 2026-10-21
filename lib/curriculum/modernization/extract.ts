/**
 * Shape of the read-only live-catalog extract (scripts/extract-library-modernization-inventory.ts).
 *
 * The extract holds lesson content and dependency COUNTS only. It never carries learner, user,
 * author, submission or school identifiers.
 */
import fs from "fs";
import path from "path";
import { createHash } from "crypto";

export const LIBRARY_EXTRACT_DIR = "artifacts/library-modernization-v1/extract";

/** Payload fields outside the revision snapshot that still describe the lesson (generation, approval and trust metadata). */
export const PAYLOAD_METADATA_FIELDS = [
  "metadata", "generationMetadata", "approvalStatus", "approvedAt", "reviewStage", "trustSignal", "contentCompleteness",
  "originalContentReference", "originalImportedVersion", "eliteUpgrade", "generationStage", "demoReady", "difficulty",
  "primaryConcept", "nextConcepts", "prerequisites", "misconceptions", "commonMisconceptions", "accessibility", "localContextEnrichment",
] as const;

export type DependencyCounts = Readonly<{
  scheduledWork: number;
  scheduledWorkBundlePinned: number;
  scheduledWorkClasses: number;
  scheduledWorkSchools: number;
  studentProgress: number;
  assignments: number;
  homework: number;
  learningEvents: number;
  gradedSubmissions: number;
  teacherLessonAssignments: number;
  lessonPlans: number;
  tutorConversations: number;
  helpFlags: number;
  timetableAssignments: number;
  performanceEvents: number;
  curriculumFlags: number;
  lessonVersions: number;
  lessonShares: number;
  audioAssets: number;
  videoSupplements: number;
  prerequisiteLinks: number;
  dependentLessons: number;
}>;

export type LibraryExtractRecord = Readonly<{
  /** CurriculumContent.id (cuid primary key). */
  id: string;
  /** CurriculumContent.contentId (stable public content id). */
  contentId: string;
  row: Readonly<{
    title: string | null;
    grade: number;
    subject: string;
    contentType: string;
    status: string;
    version: string;
    hash: string | null;
    createdAt: string;
    updatedAt: string;
    publishedAt: string | null;
    unitId: string | null;
    orderInUnit: number | null;
    lessonType: string | null;
    teacherCreated: boolean;
    hasSchoolScope: boolean;
    hasEditor: boolean;
    visibility: string;
    parentLessonId: string | null;
    derivedFromContentId: string | null;
    lessonVersion: number;
    versionId: string | null;
    isHero: boolean;
    imageGenerationStatus: string | null;
    editReviewStatus: string | null;
    moeAlignments: unknown;
    waecSyllabusTopics: readonly string[];
    payloadKeys: readonly string[];
    payloadMetadata: Readonly<Record<string, unknown>>;
    payloadBytes: number;
  }>;
  provenance: Readonly<{ completeness: string; lifecycleState: string; revisionCount: number }> | null;
  revision: Readonly<{
    id: string;
    sequence: number;
    revisionKind: string;
    originKind: string;
    snapshotSchemaVersion: number;
    contentHash: string;
    generatorName: string | null;
    generatorVersion: string | null;
    aiProvider: string | null;
    aiModel: string | null;
    generatedAt: string | null;
    createdAt: string;
    hasAuthor: boolean;
    contentSnapshot: unknown;
  }> | null;
  /** The live row's own projection, present only when it differs from the current revision. */
  liveSnapshot: Readonly<{ schemaVersion: number; snapshot: unknown }> | null;
  verification: Readonly<{
    hasProvenance: boolean;
    hasCurrentRevision: boolean;
    storedRevisionHash: string | null;
    recomputedRevisionHash: string | null;
    revisionHashMatches: boolean;
    liveRowEqualsRevision: boolean;
    liveSnapshotHash: string;
  }>;
  dependencies: DependencyCounts;
}>;

export type LibraryExtractManifest = Readonly<{
  capturedAt: string;
  lessons: number;
  revisionHashMismatches: number;
  liveRowsDifferingFromCurrentRevision: number;
  extractSha256: string;
  target: string;
  transactionReadOnly: string;
}>;

export class LibraryExtractError extends Error {
  constructor(code: string, detail?: string) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = "LibraryExtractError";
  }
}

/** Loads the local extract and refuses it if the file no longer matches the manifest digest. */
export function loadLibraryExtract(dir = LIBRARY_EXTRACT_DIR): { manifest: LibraryExtractManifest; records: LibraryExtractRecord[] } {
  const manifestFile = path.join(dir, "manifest.json");
  const dataFile = path.join(dir, "lessons.jsonl");
  if (!fs.existsSync(manifestFile) || !fs.existsSync(dataFile)) {
    throw new LibraryExtractError("EXTRACT_MISSING", `run scripts/extract-library-modernization-inventory.ts first (${dir})`);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8")) as LibraryExtractManifest;
  const raw = fs.readFileSync(dataFile, "utf8");
  const digest = createHash("sha256").update(raw).digest("hex");
  if (digest !== manifest.extractSha256) throw new LibraryExtractError("EXTRACT_MODIFIED", `${digest} != manifest ${manifest.extractSha256}`);
  const records = raw.split("\n").filter(Boolean).map((line) => JSON.parse(line) as LibraryExtractRecord);
  if (records.length !== manifest.lessons) throw new LibraryExtractError("EXTRACT_INCOMPLETE", `${records.length} != ${manifest.lessons}`);
  return { manifest, records };
}
